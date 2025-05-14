/* services/syncManager.ts */
import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import { DeviceEventEmitter } from "react-native";
import { Toast } from "toastify-react-native";
import { BASE_API_URL, SYNC_EVENTS } from "../Constants/env";
import { deleteJob, getAllJobs } from "./jobService";
import { getAllCosts, deleteCost } from "./costService";
import { Costs } from "../types";

export interface SyncState {
  status: "idle" | "syncing" | "in_progress" | "complete" | "error";
  message: string;
  progress?: number;
  syncedCount?: number;
  failedCount?: number;
}

export class SyncManager {
  private static instance: SyncManager;
  private isSyncing = false;
  private listeners: ((state: SyncState) => void)[] = [];
  private constructor() {}
  public static getInstance(): SyncManager {
    if (!SyncManager.instance) SyncManager.instance = new SyncManager();
    return SyncManager.instance;
  }

  public initialize() {
    NetInfo.addEventListener((state) => {
      if (state.isConnected) this.checkAndSync();
    });
    this.checkAndSync();
  }

  public scheduleCostSync() {
    NetInfo.fetch().then((s) => {
      if (s.isConnected) this.syncAll();
    });
  }

  private async checkAndSync() {
    if (this.isSyncing) return;

    try {
      const jobs = await getAllJobs();
      const costs = await getAllCosts();

      if (
        (jobs.length > 0 || costs.length > 0) &&
        (await NetInfo.fetch()).isConnected
      ) {
        this.syncAll();
      }
    } catch (error) {
      console.error("[SyncManager] Error checking for pending data:", error);
    }
  }

  private notify(state: SyncState) {
    this.listeners.forEach((l) => l(state));
    switch (state.status) {
      case "syncing":
        DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_STARTED);
        break;
      case "complete":
        DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_COMPLETED, {
          syncedCount: state.syncedCount,
          failedCount: state.failedCount,
        });
        break;
      case "error":
        DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_FAILED, {
          message: state.message,
        });
        break;
    }
  }

  public addSyncListener(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
  }

  public async syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify({ status: "syncing", message: "Syncing data..." });

    let jobSynced = 0,
      jobFailed = 0,
      costSynced = 0,
      costFailed = 0;

    try {
      const userStr = await AsyncStorage.getItem("userData");

      const userData = userStr ? JSON.parse(userStr) : null;
      const userId = userData?.payload?.userid || userData?.userid;

      if (!userId) {
        throw new Error("No user ID found in AsyncStorage");
      }

      // Sync Jobs
      const jobs = await getAllJobs();
      for (const job of jobs) {
        try {
          // Ensure proper data structure for API request
          const jobData = {
            userid: userId,
            payload: {
              ...job,
              id: undefined, // Remove local ID if present
            },
          };

          const response = await axios.post(
            `${BASE_API_URL}/newjob.php?userid=${userId}`, // Fixed: Added userId to URL
            jobData,
            {
              timeout: 10000,
              validateStatus: (status) => status < 500, // Allow 4xx responses to be handled
            }
          );

          if (response.status >= 400) {
            throw new Error(
              `Server error ${response.status}: ${
                response.data?.message || "Unknown error"
              }`
            );
          }

          await deleteJob(job.id);
          jobSynced++;

          this.notify({
            status: "in_progress",
            message: `Syncing jobs ${jobSynced}/${jobs.length}`,
            progress: jobs.length > 0 ? jobSynced / jobs.length : 1,
            syncedCount: jobSynced + costSynced,
            failedCount: jobFailed + costFailed,
          });
        } catch (error) {
          console.error(`Job sync failed for job ${job.id}:`, error);
          jobFailed++;
        }
      }

      // Sync Costs
      const costs = await getAllCosts();
      for (const cost of costs) {
        try {
          // FIX: Format the cost data according to what the API expects
          // The API expects direct properties at the top level, not nested in payload
          const costData = {
            userid: userId,
            job_id: cost.job_id,
            contractor_id: cost.contractor_id,
            amount: cost.amount,
            material_cost: cost.material_cost,
          };

          const response = await axios.post(
            `${BASE_API_URL}/costs.php?userid=${userId}`,
            costData,
            {
              timeout: 10000,
              validateStatus: (status) => status < 500, // Allow 4xx responses to be handled
            }
          );

          if (response.status >= 400) {
            throw new Error(
              `Server error ${response.status}: ${
                response.data?.message || "Unknown error"
              }`
            );
          }

          await deleteCost(String(cost.id));
          costSynced++;

          this.notify({
            status: "in_progress",
            message: `Syncing costs ${costSynced}/${costs.length}`,
            progress: costs.length > 0 ? costSynced / costs.length : 1,
            syncedCount: jobSynced + costSynced,
            failedCount: jobFailed + costFailed,
          });
        } catch (error) {
          console.error(`Cost sync failed for cost ${cost.id}:`, error);
          costFailed++;
        }
      }

      const totalSynced = jobSynced + costSynced;
      const totalFailed = jobFailed + costFailed;

      const msg = totalFailed
        ? `Synced ${totalSynced}, ${totalFailed} failed`
        : `Successfully synced ${totalSynced}`;

      this.notify({
        status: "complete",
        message: msg,
        syncedCount: totalSynced,
        failedCount: totalFailed,
      });

      if (totalSynced > 0) {
        Toast.success(msg);
        // Emit event to notify about pending data changes
        DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_DATA_CHANGED, {
          jobsSynced: jobSynced,
          costsSynced: costSynced,
          jobsFailed: jobFailed,
          costsFailed: costFailed,
        });
      }
    } catch (error: any) {
      console.error("Sync operation failed:", error);
      this.notify({
        status: "error",
        message: error.message || "Sync failed; will retry when online.",
      });
      Toast.error("Sync failed; will retry when online.");
    } finally {
      this.isSyncing = false;
    }
  }

  public async manualSync() {
    this.syncAll();
  }

  // Utility method to check if there's pending data
  public async hasPendingData(): Promise<{ jobs: number; costs: number }> {
    try {
      const jobs = await getAllJobs();
      const costs = await getAllCosts();
      return { jobs: jobs.length, costs: costs.length };
    } catch (error) {
      console.error("[SyncManager] Error checking pending data:", error);
      return { jobs: 0, costs: 0 };
    }
  }
}

export const syncManager = SyncManager.getInstance();
