import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import { BASE_API_URL } from "../Constants/env";
import { Job } from "../types";
import {
  getPendingJobs,
  getOfflineJob,
  markJobAsSynced,
  deleteOfflineJob,
} from "./offlineJobService";
import { Toast } from "toastify-react-native";

/**
 * Manages synchronization of offline data with the server
 */
export class SyncManager {
  private static instance: SyncManager;
  private isSyncing: boolean = false;
  private syncListeners: Array<(syncState: SyncState) => void> = [];

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  /**
   * Initialize sync manager and set up network listeners
   */
  public initialize(): void {
    // Listen for network state changes
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.syncPendingJobs();
      }
    });
  }

  /**
   * Add a listener for sync state changes
   */
  public addSyncListener(listener: (syncState: SyncState) => void): () => void {
    this.syncListeners.push(listener);
    return () => {
      this.syncListeners = this.syncListeners.filter((l) => l !== listener);
    };
  }

  /**
   * Notify listeners of sync state changes
   */
  private notifySyncListeners(state: SyncState): void {
    this.syncListeners.forEach((listener) => listener(state));
  }

  /**
   * Syncs all pending jobs with the server
   */
  public async syncPendingJobs(): Promise<void> {
    if (this.isSyncing) return;

    try {
      this.isSyncing = true;
      this.notifySyncListeners({
        status: "syncing",
        message: "Syncing offline jobs...",
      });

      const pendingJobIds = await getPendingJobs();
      if (pendingJobIds.length === 0) {
        this.notifySyncListeners({
          status: "complete",
          message: "No jobs to sync",
        });
        return;
      }

      const totalJobs = pendingJobIds.length;
      let syncedCount = 0;
      let failedCount = 0;

      for (const jobId of pendingJobIds) {
        try {
          const job = await getOfflineJob(jobId);
          if (!job) continue;

          const { _syncData, ...jobData } = job as any;
          if (!_syncData?.userId) continue;

          // Send to server
          const postData = {
            userid: _syncData.userId,
            payload: jobData,
          };

          await axios.post(`${BASE_API_URL}/newjob.php`, postData);

          // Mark as synced and delete from local storage
          await markJobAsSynced(jobId);
          await deleteOfflineJob(jobId);

          syncedCount++;
          this.notifySyncListeners({
            status: "in_progress",
            message: `Synced ${syncedCount}/${totalJobs} jobs`,
            progress: syncedCount / totalJobs,
          });
        } catch (error) {
          console.error(`Failed to sync job ${jobId}:`, error);
          failedCount++;
        }
      }

      // Notify completion
      const finalMessage =
        failedCount > 0
          ? `Synced ${syncedCount} jobs, ${failedCount} failed`
          : `Successfully synced ${syncedCount} jobs`;

      this.notifySyncListeners({
        status: "complete",
        message: finalMessage,
        syncedCount,
        failedCount,
      });

      Toast.success(finalMessage);
    } catch (error) {
      console.error("Error during sync:", error);
      this.notifySyncListeners({
        status: "error",
        message: "Sync failed. Will retry when connection is available.",
      });
      Toast.error("Sync failed. Will retry when connection is available.");
    } finally {
      this.isSyncing = false;
    }
  }

  /**
   * Manual trigger for sync
   */
  public async manualSync(): Promise<void> {
    const isConnected = (await NetInfo.fetch()).isConnected;

    if (isConnected) {
      await this.syncPendingJobs();
    } else {
      Toast.info("No internet connection. Will sync when online.");
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

// Export singleton instance
export const syncManager = SyncManager.getInstance();
