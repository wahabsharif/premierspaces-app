import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import * as BackgroundTask from "expo-background-task";
import Constants from "expo-constants";
import * as FileSystem from "expo-file-system";
import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { DeviceEventEmitter, Platform } from "react-native";
import { Toast } from "toastify-react-native";
import { BASE_API_URL, SYNC_EVENTS } from "../Constants/env";
import { deleteCost, getAllCosts } from "./costService";
import { deleteJob, getAllJobs } from "./jobService";
import { deleteUpload, getAllUploads } from "./uploadService";

// Define the background task name
const BACKGROUND_SYNC_TASK = "background-sync";

// Determine if running in Expo Go and improve detection
const isExpoGo = Constants.appOwnership === "expo";
const isNotificationsSupported = !(isExpoGo && Platform.OS === "android");

export interface SyncState {
  status: "idle" | "syncing" | "in_progress" | "complete" | "error";
  message: string;
  progress?: number;
  syncedCount?: number;
  failedCount?: number;
}

// Only set notification handler if not in Expo Go on Android
if (isNotificationsSupported) {
  Notifications.setNotificationHandler({
    handleNotification: async () => ({
      shouldPlaySound: false,
      shouldSetBadge: false,
      shouldShowBanner: true,
      shouldShowList: true,
    }),
  });
}

export class SyncManager {
  private static instance: SyncManager;
  private isSyncing = false;
  private listeners: ((state: SyncState) => void)[] = [];
  private previousNetworkState: boolean | null = null;
  private syncInProgress = new Set<string>();
  private lastSyncAttempt = 0;
  private syncNotificationId: string | null = null;
  private abortControllers: Map<string, AbortController> = new Map();
  private debounceTimers: Record<string, NodeJS.Timeout> = {};

  private constructor() {}

  public static getInstance(): SyncManager {
    if (!SyncManager.instance) {
      SyncManager.instance = new SyncManager();
    }
    return SyncManager.instance;
  }

  public async initialize() {
    if (isExpoGo) {
      console.log(
        "Running in Expo Go environment with limited notification support"
      );
      if (Platform.OS === "android") {
        console.warn(
          "Notifications functionality removed from Expo Go on Android since SDK 53. Use a development build for full functionality."
        );
      }
    }

    // Only try notifications if supported
    if (isNotificationsSupported) {
      await this.requestNotificationPermissions();
    }

    await this.defineBackgroundTask();

    // Skip background task registration in Expo Go on Android
    if (!isExpoGo || Platform.OS !== "android") {
      await this.registerBackgroundTask();
    } else {
      console.warn(
        "Background task registration skipped in Expo Go on Android"
      );
    }

    NetInfo.fetch().then((state) => {
      this.previousNetworkState = state.isConnected;
    });

    NetInfo.addEventListener((state) => {
      const isNowConnected = state.isConnected === true;
      const wasOffline = this.previousNetworkState === false;

      if (isNowConnected && wasOffline) {
        this.checkAndSync(true);
      }
      this.previousNetworkState = isNowConnected;
    });

    this.checkAndSync();
  }

  private async defineBackgroundTask(): Promise<void> {
    try {
      await TaskManager.defineTask(BACKGROUND_SYNC_TASK, async () => {
        try {
          const syncManager = SyncManager.getInstance();
          await syncManager.backgroundSync();
          return { success: true };
        } catch (error) {
          console.error("Background sync failed:", error);
          return { success: false };
        }
      });
      console.log("Background sync task defined successfully");
    } catch (error) {
      console.warn("Failed to define background sync task:", error);
    }
  }

  private async requestNotificationPermissions(): Promise<boolean> {
    try {
      if (!isNotificationsSupported) {
        console.log(
          "Skipping notification permissions in unsupported environment"
        );
        return false;
      }

      const { status: existingStatus } =
        await Notifications.getPermissionsAsync();
      let finalStatus = existingStatus;

      if (existingStatus !== "granted") {
        const { status } = await Notifications.requestPermissionsAsync();
        finalStatus = status;
      }

      return finalStatus === "granted";
    } catch (error) {
      console.error("Failed to get notification permissions:", error);
      return false;
    }
  }

  private async registerBackgroundTask(): Promise<void> {
    try {
      if (isExpoGo) {
        console.warn(
          "Background task registration not fully supported in Expo Go"
        );
        return;
      }

      const isRegistered = await TaskManager.isTaskRegisteredAsync(
        BACKGROUND_SYNC_TASK
      );

      if (!isRegistered) {
        console.log("Background sync task is not registered yet.");
        await BackgroundTask.registerTaskAsync(BACKGROUND_SYNC_TASK, {
          minimumInterval: 60,
        });
        console.log("Background sync task registered successfully");
      } else {
        console.log("Background sync task is already registered.");
      }
    } catch (error) {
      console.error("Failed to register background task:", error);
    }
  }

  private async notify(state: SyncState) {
    this.listeners.forEach((l) => l(state));

    // Always show Toast notifications as a reliable fallback
    this.showToastForState(state);

    // Only try to show system notifications if supported
    if (isNotificationsSupported) {
      await this.updateSyncNotification(state);
    }

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

  // New method to consistently show Toasts
  private showToastForState(state: SyncState) {
    switch (state.status) {
      case "syncing":
        Toast.info("Starting sync...");
        break;
      case "in_progress":
        if (state.progress && Math.round(state.progress * 100) % 20 === 0) {
          // Limit toast frequency to avoid flooding
          Toast.info(`${state.message} (${Math.round(state.progress * 100)}%)`);
        }
        break;
      case "complete":
        Toast.success(state.message);
        break;
      case "error":
        Toast.error(state.message);
        break;
    }
  }

  private async updateSyncNotification(state: SyncState) {
    try {
      // Skip if notifications not supported
      if (!isNotificationsSupported) {
        return;
      }

      const hasPermission = await this.requestNotificationPermissions();
      if (!hasPermission) return;

      const baseNotification = { title: "Data Sync", sound: false };

      if (this.syncNotificationId) {
        await Notifications.dismissNotificationAsync(this.syncNotificationId);
      }

      switch (state.status) {
        case "syncing":
          this.syncNotificationId =
            await Notifications.scheduleNotificationAsync({
              content: {
                ...baseNotification,
                body: `Starting sync...`,
                data: { type: "sync_progress" },
              },
              trigger: null,
            });
          break;
        case "in_progress":
          const progressText = state.progress
            ? ` (${Math.round(state.progress * 100)}%)`
            : "";
          this.syncNotificationId =
            await Notifications.scheduleNotificationAsync({
              content: {
                ...baseNotification,
                body: `${state.message}${progressText} - Synced: ${
                  state.syncedCount || 0
                }, Failed: ${state.failedCount || 0}`,
                data: {
                  type: "sync_progress",
                  progress: state.progress || 0,
                  syncedCount: state.syncedCount || 0,
                  failedCount: state.failedCount || 0,
                },
              },
              trigger: null,
            });
          break;
        case "complete":
          await Notifications.scheduleNotificationAsync({
            content: {
              ...baseNotification,
              title: "Sync Complete ✅",
              body: state.message,
              data: { type: "sync_complete" },
            },
            trigger: null,
          });
          setTimeout(async () => {
            await Notifications.dismissAllNotificationsAsync();
          }, 3000);
          break;
        case "error":
          await Notifications.scheduleNotificationAsync({
            content: {
              ...baseNotification,
              title: "Sync Error ❌",
              body: state.message,
              data: { type: "sync_error" },
            },
            trigger: null,
          });
          break;
      }
    } catch (error) {
      console.error("Failed to update sync notification:", error);
    }
  }

  private async checkAndSync(forceSync = false) {
    if (this.isSyncing) return;
    const now = Date.now();
    if (!forceSync && now - this.lastSyncAttempt < 5000) return;
    this.lastSyncAttempt = now;

    try {
      const [jobs, costs, uploads] = await Promise.all([
        getAllJobs(),
        getAllCosts(),
        getAllUploads(),
      ]);
      DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
        jobsCount: jobs.length,
        costsCount: costs.length,
        uploadsCount: uploads.length,
        jobs,
        costs,
        uploads,
      });

      const anyPending =
        jobs.length > 0 || costs.length > 0 || uploads.length > 0;
      const net = await NetInfo.fetch();

      if (anyPending && net.isConnected) {
        if (forceSync) this.syncAll(true);
        else setTimeout(() => this.syncAll(), 1000);
      }
    } catch (error) {
      console.error("[SyncManager] checkAndSync error:", error);
    }
  }

  // Optimized network quality assessment
  private async assessNetworkQuality(): Promise<
    "high" | "medium" | "low" | "offline"
  > {
    try {
      const netInfo = await NetInfo.fetch();
      if (!netInfo.isConnected) return "offline";

      if (netInfo.type === "wifi") {
        // On WiFi, we generally have good bandwidth
        return "high";
      }

      if (netInfo.type === "cellular") {
        // On cellular, consider the effective type
        if (netInfo.details?.cellularGeneration) {
          const gen = netInfo.details.cellularGeneration;
          if (gen === "4g" || gen === "5g") return "medium";
          return "low";
        }
      }

      return "medium"; // Default to medium
    } catch (e) {
      console.warn("Error assessing network quality:", e);
      return "medium";
    }
  }

  // Debounce implementation for better performance
  private debounce(key: string, fn: Function, delay: number) {
    if (this.debounceTimers[key]) {
      clearTimeout(this.debounceTimers[key]);
    }

    this.debounceTimers[key] = setTimeout(() => {
      delete this.debounceTimers[key];
      fn();
    }, delay);
  }

  // Enhanced syncAll with sequential API calls
  public async syncAll(skipTimeCheck = false) {
    if (this.isSyncing) return;

    if (!skipTimeCheck) {
      const lastSyncTime = await AsyncStorage.getItem("lastSyncTime");
      const now = Date.now();
      if (lastSyncTime && now - Number(lastSyncTime) < 30000) return;
    }

    this.isSyncing = true;
    this.syncInProgress.clear();

    // Clear any existing abort controllers
    this.abortControllers.forEach((controller) => controller.abort());
    this.abortControllers.clear();

    await this.notify({ status: "syncing", message: "Syncing all data..." });

    let jobSynced = 0,
      jobFailed = 0;
    let costSynced = 0,
      costFailed = 0;
    let uploadSynced = 0,
      uploadFailed = 0;

    try {
      const userStr = await AsyncStorage.getItem("userData");
      const userData = userStr ? JSON.parse(userStr) : null;
      const userId = userData?.payload?.userid || userData?.userid;
      if (!userId) throw new Error("No user ID in AsyncStorage");

      // Get network quality to optimize sync strategy
      const networkQuality = await this.assessNetworkQuality();
      
      // Maximum number of retries for failed requests
      const MAX_RETRIES = 3;
      const RETRY_DELAY = 3000; // 3 seconds between retries

      const retryWithDelay = async (fn: () => Promise<any>, retries: number): Promise<any> => {
        try {
          return await fn();
        } catch (error) {
          if (retries > 0) {
            await new Promise(resolve => setTimeout(resolve, RETRY_DELAY));
            return retryWithDelay(fn, retries - 1);
          }
          throw error;
        }
      };

      // 1. STEP ONE: Sync Jobs first
      const jobs = await getAllJobs();
      let allJobsSuccessful = true;
      
      if (jobs.length > 0) {
        this.notify({
          status: "in_progress",
          message: `Syncing jobs (${jobs.length})...`,
          syncedCount: 0,
          failedCount: 0,
        });
        
        for (const job of jobs) {
          const itemKey = `job_${job.id}`;
          if (this.syncInProgress.has(itemKey)) continue;

          this.syncInProgress.add(itemKey);
          
          try {
            await retryWithDelay(async () => {
              const jobData = {
                userid: userId,
                payload: { ...job, id: undefined },
              };

              // Create abort controller for this request
              const controller = new AbortController();
              this.abortControllers.set(itemKey, controller);

              const resp = await axios.post(
                `${BASE_API_URL}/newjob.php?userid=${userId}`,
                jobData,
                {
                  timeout: 15000,
                  signal: controller.signal,
                  validateStatus: (s) => s < 500,
                }
              );

              this.abortControllers.delete(itemKey);

              if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`);

              // Remove from DB only after successful sync
              await deleteJob(job.id);
              jobSynced++;

              this.notify({
                status: "in_progress",
                message: `Jobs ${jobSynced}/${jobs.length}`,
                progress: jobs.length ? jobSynced / jobs.length : 1,
                syncedCount: jobSynced,
                failedCount: jobFailed,
              });
              
            }, MAX_RETRIES);
          } catch (err) {
            console.error(`[SyncManager] Job sync failed after retries:`, err);
            Toast.error(`Job sync failed (${job.id}) after ${MAX_RETRIES} retries`);
            jobFailed++;
            allJobsSuccessful = false;
            this.syncInProgress.delete(itemKey);
          }
        }
        
        // If any job failed, don't proceed to costs
        if (!allJobsSuccessful) {
          throw new Error(`Failed to sync ${jobFailed} jobs. Stopping sync process.`);
        }
        
        this.notify({
          status: "in_progress",
          message: `All jobs synced successfully (${jobSynced})`,
          syncedCount: jobSynced,
          failedCount: 0,
        });
      }

      // 2. STEP TWO: Sync Costs ONLY if all jobs were successful
      const costs = await getAllCosts();
      let allCostsSuccessful = true;
      
      if (costs.length > 0) {
        this.notify({
          status: "in_progress",
          message: `Syncing costs (${costs.length})...`,
          syncedCount: jobSynced,
          failedCount: 0,
        });
        
        for (const cost of costs) {
          const itemKey = `cost_${cost.id}`;
          if (this.syncInProgress.has(itemKey)) continue;

          this.syncInProgress.add(itemKey);
          
          try {
            await retryWithDelay(async () => {
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
                syncedCount: jobSynced + costSynced,
                failedCount: costFailed,
              });
            }, MAX_RETRIES);
          } catch (err) {
            console.error(`[SyncManager] Cost sync failed after retries:`, err);
            Toast.error(`Cost sync failed (${cost.id}) after ${MAX_RETRIES} retries`);
            costFailed++;
            allCostsSuccessful = false;
            this.syncInProgress.delete(itemKey);
          }
        }
        
        // If any cost failed, don't proceed to uploads
        if (!allCostsSuccessful) {
          throw new Error(`Failed to sync ${costFailed} costs. Stopping sync process.`);
        }
        
        this.notify({
          status: "in_progress",
          message: `All costs synced successfully (${costSynced})`,
          syncedCount: jobSynced + costSynced,
          failedCount: 0,
        });
      }

      // 3. STEP THREE: Sync Media Uploads ONLY if all costs were successful
      const uploads = await getAllUploads();
      
      if (uploads.length > 0) {
        this.notify({
          status: "in_progress",
          message: `Syncing media uploads (${uploads.length})...`,
          syncedCount: jobSynced + costSynced,
          failedCount: 0,
        });
        
        for (const upload of uploads) {
          const uploadKey = `upload_${upload.id}`;
          if (this.syncInProgress.has(uploadKey)) continue;
          
          this.syncInProgress.add(uploadKey);
          
          try {
            await retryWithDelay(async () => {
              const fileInfo = await FileSystem.getInfoAsync(
                upload.content_path ?? upload.uri ?? ""
              );

              const contentUri = fileInfo.exists
                ? upload.content_path!
                : upload.uri!;

              // Standard upload
              const formData = new FormData();
              formData.append("id", upload.id.toString());
              formData.append(
                "total_segments",
                String(upload.total_segments)
              );
              formData.append(
                "segment_number",
                String(upload.segment_number)
              );
              formData.append("main_category", String(upload.main_category));
              formData.append(
                "category_level_1",
                String(upload.category_level_1)
              );
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

              const controller = new AbortController();
              this.abortControllers.set(uploadKey, controller);

              const resp = await axios.post(
                `${BASE_API_URL}/media-uploader.php`,
                formData,
                {
                  headers: { "Content-Type": "multipart/form-data" },
                  timeout: 60000, // Longer timeout for uploads
                  signal: controller.signal,
                  onUploadProgress: (evt) => {
                    const pct = evt.total
                      ? Math.round((evt.loaded * 100) / evt.total)
                      : null;
                    this.notify({
                      status: "in_progress",
                      message:
                        pct !== null
                          ? `Uploading media ${uploadSynced+1}/${uploads.length} (${pct}%)`
                          : `Uploading media ${uploadSynced+1}/${uploads.length}...`,
                      syncedCount: jobSynced + costSynced + uploadSynced,
                      failedCount: uploadFailed,
                    });
                  },
                  validateStatus: (s) => s < 500,
                }
              );

              this.abortControllers.delete(uploadKey);

              if (resp.status >= 400) throw new Error(`HTTP ${resp.status}`);

              await deleteUpload(upload.id);
              uploadSynced++;

              this.notify({
                status: "in_progress",
                message: `Media ${uploadSynced}/${uploads.length}`,
                progress: uploads.length ? uploadSynced / uploads.length : 1,
                syncedCount: jobSynced + costSynced + uploadSynced,
                failedCount: uploadFailed,
              });
            }, MAX_RETRIES);
          } catch (err) {
            console.error(`[SyncManager] Upload sync failed after retries:`, err);
            Toast.error(`Upload sync failed (${upload.id}) after ${MAX_RETRIES} retries`);
            uploadFailed++;
            this.syncInProgress.delete(uploadKey);
          }
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
      console.error("[SyncManager] syncAll error:", err);
      const msg = err.message || "Sync failed; will retry when online.";
      await this.notify({ status: "error", message: msg });
    } finally {
      // Clean up resources
      this.abortControllers.forEach((controller) => controller.abort());
      this.abortControllers.clear();

      Object.keys(this.debounceTimers).forEach((key) => {
        clearTimeout(this.debounceTimers[key]);
      });

      await AsyncStorage.setItem("lastSyncTime", Date.now().toString());
      this.isSyncing = false;
      this.syncInProgress.clear();
      this.syncNotificationId = null;
    }
  }

  public async backgroundSync() {
    console.log("Starting background sync...");
    try {
      const net = await NetInfo.fetch();
      if (!net.isConnected) {
        console.log("No network connection for background sync");
        return;
      }
      const [jobs, costs, uploads] = await Promise.all([
        getAllJobs(),
        getAllCosts(),
        getAllUploads(),
      ]);
      const hasPendingData =
        jobs.length > 0 || costs.length > 0 || uploads.length > 0;
      if (hasPendingData) {
        await this.syncAll(true);
        console.log("Background sync completed");
      } else {
        console.log("No pending data for background sync");
      }
    } catch (error) {
      console.error("Background sync error:", error);
      await this.notify({ status: "error", message: "Background sync failed" });
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
      console.error("[SyncManager] hasPendingData error:", err);
      return { jobs: 0, costs: 0, uploads: 0 };
    }
  }

  public addSyncListener(listener: (state: SyncState) => void): () => void {
    this.listeners.push(listener);
    return () => {
      this.removeSyncListener(listener);
    };
  }

  public removeSyncListener(listener: (state: SyncState) => void): void {
    const index = this.listeners.indexOf(listener);
    if (index > -1) this.listeners.splice(index, 1);
  }

  public getSyncStatus(): { isSyncing: boolean; syncInProgress: string[] } {
    return {
      isSyncing: this.isSyncing,
      syncInProgress: Array.from(this.syncInProgress),
    };
  }

  // Cancel sync with proper resource cleanup
  public cancelSync(): void {
    if (this.isSyncing) {
      // Abort all in-progress requests
      this.abortControllers.forEach((controller) => controller.abort());
      this.abortControllers.clear();

      this.isSyncing = false;
      this.syncInProgress.clear();
      this.notify({ status: "error", message: "Sync cancelled by user" });
    }
  }

  public async cleanup() {
    if (isNotificationsSupported) {
      try {
        await Notifications.dismissAllNotificationsAsync();
      } catch (error) {
        console.error("Failed to dismiss notifications:", error);
      }
    }
  }
}

export const syncManager = SyncManager.getInstance();
