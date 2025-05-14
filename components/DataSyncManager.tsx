import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SYNC_EVENTS } from "../Constants/env";
import { getAllJobs } from "../services/jobService";
import { getAllCosts } from "../services/costService";
import { syncManager, SyncState } from "../services/syncManager";
import { AppDispatch } from "../store";
import {
  selectPendingJobsCount,
  syncPendingJobs,
  updatePendingCount,
} from "../store/jobSlice";
import { Toast } from "toastify-react-native";

interface DataSyncManagerProps {
  children: React.ReactNode;
}

const DataSyncManager: React.FC<DataSyncManagerProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const pendingCount = useSelector(selectPendingJobsCount);
  const [isSyncing, setIsSyncing] = useState(false);
  const [pendingCostsCount, setPendingCostsCount] = useState(0);

  // Function to update counts of pending data (jobs and costs)
  const updatePendingDataCounts = async () => {
    try {
      const jobs = await getAllJobs();
      const costs = await getAllCosts();

      dispatch(updatePendingCount(jobs.length));
      setPendingCostsCount(costs.length);

      DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
        jobsCount: jobs.length,
        costsCount: costs.length,
        jobs,
        costs,
      });
    } catch (error) {
      console.error(
        "[DataSyncManager] Error updating pending data counts:",
        error
      );
    }
  };

  // Handle sync state changes
  const handleSyncStateChange = (syncState: SyncState) => {
    if (syncState.status === "syncing") {
      setIsSyncing(true);
    } else if (["complete", "error"].includes(syncState.status)) {
      setIsSyncing(false);
      updatePendingDataCounts();

      if (syncState.status === "complete") {
        const totalSynced = syncState.syncedCount || 0;
        const totalFailed = syncState.failedCount || 0;

        if (totalSynced > 0 || totalFailed > 0) {
          const message = totalFailed
            ? `Synced ${totalSynced} items, ${totalFailed} failed`
            : `Successfully synced ${totalSynced} items`;

          Toast.success(message);
        }
      }
    }
  };

  // Initialize periodic data count updates
  useEffect(() => {
    updatePendingDataCounts();
    const intervalId = setInterval(updatePendingDataCounts, 30000);
    return () => clearInterval(intervalId);
  }, [dispatch]);

  // Initialize network connectivity monitoring
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (
        state.isConnected &&
        (pendingCount > 0 || pendingCostsCount > 0) &&
        !isSyncing
      ) {
        syncManager.syncAll();
      }
    });
    return () => unsubscribe();
  }, [dispatch, pendingCount, pendingCostsCount, isSyncing]);

  // Initialize sync manager and add listener
  useEffect(() => {
    syncManager.initialize();
    const syncListener = syncManager.addSyncListener(handleSyncStateChange);

    // Listen for sync events
    const startedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_STARTED,
      () => {
        setIsSyncing(true);
      }
    );

    const completedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_COMPLETED,
      () => {
        setIsSyncing(false);
        updatePendingDataCounts();
      }
    );

    const failedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_FAILED,
      () => {
        setIsSyncing(false);
        updatePendingDataCounts();
      }
    );

    const manualSyncListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.MANUAL_SYNC_REQUESTED,
      () => {
        syncManager.manualSync();
      }
    );

    return () => {
      syncListener();
      startedListener.remove();
      completedListener.remove();
      failedListener.remove();
      manualSyncListener.remove();
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default DataSyncManager;
