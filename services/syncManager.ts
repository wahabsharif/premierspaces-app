import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import * as FileSystem from "expo-file-system";
import { DeviceEventEmitter } from "react-native";
import { Toast } from "toastify-react-native";
import { BASE_API_URL, SYNC_EVENTS } from "../Constants/env";
import { deleteCost, getAllCosts } from "./costService";
import { deleteJob, getAllJobs } from "./jobService";
import { deleteUpload, getAllUploads } from "./uploadService";

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
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public initialize() {
    NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.checkAndSync();
      }
    });
    // initial check
    this.checkAndSync();
  }

  public addSyncListener(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.listeners = this.listeners.filter((l) => l !== listener);
    };
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

  private async checkAndSync() {
    if (this.isSyncing) return;

    try {
      const [jobs, costs, uploads] = await Promise.all([
        getAllJobs(),
        getAllCosts(),
        getAllUploads(),
      ]);
      const anyPending =
        jobs.length > 0 || costs.length > 0 || uploads.length > 0;
      const net = await NetInfo.fetch();
      if (anyPending && net.isConnected) {
        this.syncAll();
      }
    } catch (error) {
      Toast.error("[SyncManager] checkAndSync error:");
    }
  }

  public async syncAll() {
    if (this.isSyncing) return;
    this.isSyncing = true;
    this.notify({ status: "syncing", message: "Syncing all data..." });

    let jobSynced = 0,
      jobFailed = 0;
    let costSynced = 0,
      costFailed = 0;
    let uploadSynced = 0,
      uploadFailed = 0;

    // Track last sync time to prevent too frequent syncs
    const lastSyncTime = await AsyncStorage.getItem("lastSyncTime");
    const now = Date.now();
    if (lastSyncTime) {
      const timeSinceLastSync = now - Number(lastSyncTime);
      // If synced in the last 30 seconds, don't sync again
      if (timeSinceLastSync < 30000) {
        this.isSyncing = false;
        return;
      }
    }

    try {
      // get user ID from storage
      const userStr = await AsyncStorage.getItem("userData");
      const userData = userStr ? JSON.parse(userStr) : null;
      const userId = userData?.payload?.userid || userData?.userid;
      if (!userId) throw new Error("No user ID in AsyncStorage");

      // 1. Sync Jobs
      const jobs = await getAllJobs();
      for (const job of jobs) {
        try {
          const jobData = {
            userid: userId,
            payload: { ...job, id: undefined },
          };
          const resp = await axios.post(
            `${BASE_API_URL}/newjob.php?userid=${userId}`,
            jobData,
            { timeout: 10000, validateStatus: (s) => s < 500 }
          );
          if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`);
          await deleteJob(job.id);
          jobSynced++;
          this.notify({
            status: "in_progress",
            message: `Jobs ${jobSynced}/${jobs.length}`,
            progress: jobs.length ? jobSynced / jobs.length : 1,
            syncedCount: jobSynced + costSynced + uploadSynced,
            failedCount: jobFailed + costFailed + uploadFailed,
          });
        } catch (err) {
          Toast.error(`Job sync failed (${job.id}):`);
          jobFailed++;
        }
      }

      // 2. Sync Costs
      const costs = await getAllCosts();
      for (const cost of costs) {
        try {
          const costData = {
            userid: userId,
            job_id: cost.job_id,
            common_id: cost.common_id,
            contractor_id: cost.contractor_id,
            amount: cost.amount,
            material_cost: cost.material_cost,
          };
          const resp = await axios.post(
            `${BASE_API_URL}/costs.php?userid=${userId}`,
            costData,
            { timeout: 10000, validateStatus: (s) => s < 500 }
          );
          if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`);
          await deleteCost(String(cost.id));
          costSynced++;
          this.notify({
            status: "in_progress",
            message: `Costs ${costSynced}/${costs.length}`,
            progress: costs.length ? costSynced / costs.length : 1,
            syncedCount: jobSynced + costSynced + uploadSynced,
            failedCount: jobFailed + costFailed + uploadFailed,
          });
        } catch (err) {
          Toast.error(`Cost sync failed (${cost.id}):`);
          costFailed++;
        }
      }

      // 3. Sync Media Uploads
      const uploads = await getAllUploads();
      for (const upload of uploads) {
        try {
          // build FormData
          const formData = new FormData();
          const fileInfo = await FileSystem.getInfoAsync(
            upload.content_path ?? upload.uri ?? ""
          );
          const contentUri = fileInfo.exists
            ? upload.content_path!
            : upload.uri!;

          formData.append("id", upload.id.toString());
          formData.append("total_segments", String(upload.total_segments));
          formData.append("segment_number", String(upload.segment_number));
          formData.append("main_category", String(upload.main_category));
          formData.append("category_level_1", String(upload.category_level_1));
          formData.append("property_id", String(upload.property_id));
          formData.append("job_id", String(upload.job_id));
          formData.append("file_name", upload.file_name || "");
          if (upload.file_type) {
            formData.append("file_type", upload.file_type);
          }
          formData.append("user_name", userData?.payload?.username || "");
          formData.append("common_id", upload.common_id || "");

          formData.append("content", {
            uri: contentUri,
            type: upload.file_type || "application/octet-stream",
            name: upload.file_name,
          } as any);
          const resp = await axios.post(
            `${BASE_API_URL}/media-uploader.php`,
            formData,
            {
              headers: { "Content-Type": "multipart/form-data" },
              timeout: 10000,
              onUploadProgress: (evt) => {
                const pct = evt.total
                  ? Math.round((evt.loaded * 100) / evt.total)
                  : null;
                this.notify({
                  status: "in_progress",
                  message:
                    pct !== null
                      ? `Uploading media ${pct}%`
                      : "Uploading media...",
                  syncedCount: jobSynced + costSynced + uploadSynced,
                  failedCount: jobFailed + costFailed + uploadFailed,
                });
              },
              validateStatus: (s) => s < 500,
            }
          );
          if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`);
          await deleteUpload(upload.id);
          uploadSynced++;
          this.notify({
            status: "in_progress",
            message: `Media ${uploadSynced}/${uploads.length}`,
            progress: uploads.length ? uploadSynced / uploads.length : 1,
            syncedCount: jobSynced + costSynced + uploadSynced,
            failedCount: jobFailed + costFailed + uploadFailed,
          });
        } catch (err) {
          Toast.error(`Upload sync failed (${upload.id}):`);
          uploadFailed++;
        }
      }

      // Finalize
      const totalSynced = jobSynced + costSynced + uploadSynced;
      const totalFailed = jobFailed + costFailed + uploadFailed;
      const summary = totalFailed
        ? `Synced ${totalSynced}, ${totalFailed} failed`
        : `Successfully synced ${totalSynced}`;

      this.notify({
        status: "complete",
        message: summary,
        syncedCount: totalSynced,
        failedCount: totalFailed,
      });

      if (totalSynced > 0) {
        Toast.success(summary);
        DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_DATA_CHANGED, {
          jobsSynced: jobSynced,
          costsSynced: costSynced,
          uploadsSynced: uploadSynced,
          jobsFailed: jobFailed,
          costsFailed: costFailed,
          uploadsFailed: uploadFailed,
        });
      }
    } catch (err: any) {
      Toast.error("[SyncManager] syncAll error:", err);
      const msg = err.message || "Sync failed; will retry when online.";
      this.notify({ status: "error", message: msg });
      Toast.error(msg);
    } finally {
      // Store the sync time
      await AsyncStorage.setItem("lastSyncTime", now.toString());
      this.isSyncing = false;
    }
  }

  public manualSync() {
    this.syncAll();
  }

  public async hasPendingData(): Promise<{
    jobs: number;
    costs: number;
    uploads: number;
  }> {
    try {
      const [jobs, costs, uploads] = await Promise.all([
        getAllJobs(),
        getAllCosts(),
        getAllUploads(),
      ]);
      return {
        jobs: jobs.length,
        costs: costs.length,
        uploads: uploads.length,
      };
    } catch (err) {
      Toast.error("[SyncManager] hasPendingData error:");
      return { jobs: 0, costs: 0, uploads: 0 };
    }
  }
}

export const syncManager = SyncManager.getInstance();
