import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useRef, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Toast } from "toastify-react-native";
import { SYNC_EVENTS } from "../Constants/env";
import { getAllCosts } from "../services/costService";
import { getAllJobs } from "../services/jobService";
import { syncManager, SyncState } from "../services/syncManager";
import { getAllUploads } from "../services/uploadService";
import { AppDispatch } from "../store";
import {
  selectPendingJobsCount,
  updatePendingCount as updatePendingJobsCount,
} from "../store/jobSlice";

interface DataSyncManagerProps {
  children: React.ReactNode;
}

const DataSyncManager: React.FC<DataSyncManagerProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const pendingJobs = useSelector(selectPendingJobsCount);

  const [pendingCosts, setPendingCosts] = useState(0);
  const [pendingUploads, setPendingUploads] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  // Keep track of previous network state with ref to avoid re-renders
  const prevNetworkState = useRef<boolean | null>(null);
  // Add a ref to track network change handling
  const networkChangeHandlingRef = useRef<boolean>(false);

  /** Refresh counts of jobs, costs, and uploads */
  const refreshPendingCounts = async () => {
    try {
      const [jobs, costs, uploads] = await Promise.all([
        getAllJobs(),
        getAllCosts(),
        getAllUploads(),
      ]);

      dispatch(updatePendingJobsCount(jobs.length));
      setPendingCosts(costs.length);
      setPendingUploads(uploads.length);

      DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
        jobsCount: jobs.length,
        costsCount: costs.length,
        uploadsCount: uploads.length,
        jobs,
        costs,
        uploads,
      });

      return {
        jobs: jobs.length,
        costs: costs.length,
        uploads: uploads.length,
      };
    } catch (err) {
      console.error("[DataSyncManager] Error fetching pending counts:", err);
      return {
        jobs: pendingJobs,
        costs: pendingCosts,
        uploads: pendingUploads,
      };
    }
  };

  /** Handle sync state changes from SyncManager */
  const handleSyncStateChange = (state: SyncState) => {
    if (state.status === "syncing") {
      setIsSyncing(true);
      Toast.info("Starting sync in sequence: Jobs → Costs → Uploads");
      return;
    }

    if (state.status === "complete" || state.status === "error") {
      setIsSyncing(false);
      refreshPendingCounts();

      if (state.status === "complete") {
        const synced = state.syncedCount ?? 0;
        const failed = state.failedCount ?? 0;
        const msg = failed
          ? `Synced ${synced} items, ${failed} failed`
          : `Successfully synced ${synced} items`;
        Toast.success(msg);
      }
    }
  };

  /** Periodically refresh counts every 30s */
  useEffect(() => {
    refreshPendingCounts();
    const id = setInterval(refreshPendingCounts, 30_000);
    return () => clearInterval(id);
  }, [dispatch]);

  /** Enhanced network change handler with explicit offline-to-online detection */
  useEffect(() => {
    // Initialize the previous state
    NetInfo.fetch().then((state) => {
      prevNetworkState.current = state.isConnected;
    });

    const handleNetStateChange = async (state: {
      isConnected: boolean | null;
    }) => {
      // Prevent concurrent handling of network changes
      if (networkChangeHandlingRef.current) {
        return;
      }

      networkChangeHandlingRef.current = true;

      try {
        const isNowConnected = state.isConnected === true;
        const wasOffline = prevNetworkState.current === false;

        // Only handle the offline-to-online transition
        if (isNowConnected && wasOffline) {
          // Refresh counts to get the latest data
          const counts = await refreshPendingCounts();
          const hasPendingData =
            counts.jobs > 0 || counts.costs > 0 || counts.uploads > 0;

          if (hasPendingData && !isSyncing) {
            // Let syncManager handle the sync - avoid direct trigger
            // Wait a moment to allow system to stabilize after network change
            setTimeout(() => {
              if (!isSyncing) {
                syncManager.manualSync();
              }
            }, 2000);
          }
        }

        // Update the previous state reference
        prevNetworkState.current = isNowConnected;
      } finally {
        // Reset the handling flag
        setTimeout(() => {
          networkChangeHandlingRef.current = false;
        }, 3000); // Prevent handling another network change for 3 seconds
      }
    };

    const unsubscribe = NetInfo.addEventListener(handleNetStateChange);
    return unsubscribe;
  }, [isSyncing]); // Only depend on isSyncing to avoid unnecessary re-subscriptions

  /** Initialize SyncManager and register listeners */
  useEffect(() => {
    syncManager.initialize();
    const removeListener = syncManager.addSyncListener(handleSyncStateChange);

    const startSub = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_STARTED,
      () => setIsSyncing(true)
    );
    const completeSub = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_COMPLETED,
      () => {
        setIsSyncing(false);
        refreshPendingCounts();
      }
    );
    const failSub = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_FAILED,
      () => {
        setIsSyncing(false);
        refreshPendingCounts();
      }
    );
    const manualSub = DeviceEventEmitter.addListener(
      SYNC_EVENTS.MANUAL_SYNC_REQUESTED,
      () => syncManager.manualSync()
    );

    // Listen for pending count updates from SyncManager
    const pendingUpdateSub = DeviceEventEmitter.addListener(
      SYNC_EVENTS.PENDING_COUNT_UPDATED,
      (data) => {
        if (data.jobsCount !== undefined) {
          dispatch(updatePendingJobsCount(data.jobsCount));
        }
        if (data.costsCount !== undefined) {
          setPendingCosts(data.costsCount);
        }
        if (data.uploadsCount !== undefined) {
          setPendingUploads(data.uploadsCount);
        }
      }
    );

    return () => {
      removeListener();
      startSub.remove();
      completeSub.remove();
      failSub.remove();
      manualSub.remove();
      pendingUpdateSub.remove();
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default DataSyncManager;
