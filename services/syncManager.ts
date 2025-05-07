import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import { DeviceEventEmitter } from "react-native";
import { Toast } from "toastify-react-native";
import { SYNC_EVENTS } from "../Constants/env";
import { BASE_API_URL } from "../Constants/env";
import { deleteJob, getAllJobs } from "./jobService";

export class SyncManager {
  private static instance: SyncManager;
  private isSyncing: boolean = false;
  private syncListeners: Array<(syncState: SyncState) => void> = [];
  private networkChangeListener: (() => void) | null = null;

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public initialize(): void {
    if (this.networkChangeListener) {
      this.networkChangeListener();
      this.networkChangeListener = null;
    }

    this.networkChangeListener = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.checkAndSync();
      }
    });

    this.checkAndSync();
  }

  private async checkAndSync(): Promise<void> {
    try {
      const jobs = await getAllJobs();
      if (jobs.length > 0) {
        const isConnected = (await NetInfo.fetch()).isConnected;
        if (isConnected && !this.isSyncing) {
          console.log(`[SyncManager] Found ${jobs.length} jobs to sync`);
          this.syncPendingJobs();
        }
      }
    } catch (error) {
      console.error("[SyncManager] Error checking jobs:", error);
    }
  }

  public addSyncListener(listener: (syncState: SyncState) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  private notifySyncListeners(state: SyncState): void {
    this.syncListeners.forEach((listener) => listener(state));

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

  public async syncPendingJobs(): Promise<void> {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notifySyncListeners({
      status: "syncing",
      message: "Syncing offline jobs...",
    });

    try {
      const userDataStr = await AsyncStorage.getItem("userData");
      const userData = userDataStr ? JSON.parse(userDataStr) : null;
      const userId = userData?.userid || userData?.payload?.userid;
      if (!userId) {
        throw new Error("No user ID in storage; cannot sync jobs.");
      }
      const allJobs = await getAllJobs();
      if (allJobs.length === 0) {
        this.notifySyncListeners({
          status: "complete",
          message: "No jobs to sync",
        });
        this.isSyncing = false;
        return;
      }

      let syncedCount = 0;
      let failedCount = 0;

      for (const job of allJobs as any[]) {
        try {
          await axios.post(`${BASE_API_URL}/newjob.php`, {
            userid: userId,
            payload: job,
          });

          await deleteJob(job.id);
          syncedCount++;

          this.notifySyncListeners({
            status: "in_progress",
            message: `Synced ${syncedCount}/${allJobs.length} jobs`,
            progress: syncedCount / allJobs.length,
            syncedCount,
            failedCount,
          });
          DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
            count: allJobs.length - syncedCount,
          });
        } catch (err) {
          console.error(`[SyncManager] Failed to sync job ${job.id}`, err);
          failedCount++;
        }
      }

      const finalMsg =
        failedCount > 0
          ? `Synced ${syncedCount} jobs, ${failedCount} failed`
          : `Successfully synced ${syncedCount} jobs`;
      this.notifySyncListeners({
        status: "complete",
        message: finalMsg,
        syncedCount,
        failedCount,
      });
      if (syncedCount > 0) {
        Toast.success(finalMsg);
      }
      const remainingJobs = await getAllJobs();
      DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
        count: remainingJobs.length,
        jobs: remainingJobs,
      });
    } catch (err: any) {
      console.error("[SyncManager] Error during sync:", err);
      this.notifySyncListeners({
        status: "error",
        message: err.message || "Sync failed; will retry when online.",
      });
      Toast.error("Sync failed; will retry when online.");
    } finally {
      this.isSyncing = false;
    }
  }

  public async manualSync(): Promise<void> {
    const isConnected = (await NetInfo.fetch()).isConnected;
    if (isConnected) {
      await this.syncPendingJobs();
    } else {
      Toast.info("No internet connection. Try Later.");
    }
  }
}

export interface SyncState {
  status: "idle" | "syncing" | "in_progress" | "complete" | "error";
  message: string;
  progress?: number;
  syncedCount?: number;
  failedCount?: number;
}

export const syncManager = SyncManager.getInstance();
