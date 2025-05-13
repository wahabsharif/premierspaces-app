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
    const jobs = await getAllJobs();
    const costs = await getAllCosts();
    if ((jobs.length || costs.length) && (await NetInfo.fetch()).isConnected) {
      this.syncAll();
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
      console.log("User data from AsyncStorage:", userStr);

      const userId = userStr ? JSON.parse(userStr).payload?.userid : null;
      if (!userId) throw new Error("No user ID");

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

          await axios.post(`${BASE_API_URL}/newjob.php`, jobData, {
            timeout: 10000,
            validateStatus: () => true, // Allow checking response status manually
          });

          await deleteJob(job.id);
          jobSynced++;

          this.notify({
            status: "in_progress",
            message: `Jobs ${jobSynced}/${jobs.length}`,
            progress: jobSynced / jobs.length,
            syncedCount: jobSynced,
            failedCount: jobFailed,
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
          // Ensure proper data structure for API request
          const costData = {
            userid: userId,
            payload: {
              ...cost,
              id: undefined, // Remove local ID if present
            },
          };

          const response = await axios.post(
            `${BASE_API_URL}/costs.php`,
            costData,
            {
              timeout: 10000,
              validateStatus: () => true,
            }
          );

          // Check server response status
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
            message: `Costs ${costSynced}/${costs.length}`,
            progress: costSynced / costs.length,
            syncedCount: costSynced,
            failedCount: costFailed,
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

      if (totalSynced) Toast.success(msg);
    } catch (error) {
      console.error("Sync operation failed:", error);
      Toast.error("Sync failed; will retry when online.");
    } finally {
      this.isSyncing = false;
    }
  }

  // Add network monitoring
  // public initialize() {
  //   NetInfo.addEventListener((state) => {
  //     if (state.isConnected && !this.isSyncing) {
  //       this.checkAndSync();
  //     }
  //   });

  //   // Initial sync check
  //   this.checkAndSync();
  // }

  public async manualSync() {
    this.syncAll();
  }
}

export const syncManager = SyncManager.getInstance();
