// components/DataSyncManager.tsx

import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
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
    } catch (err) {
      // console.error("[DataSyncManager] Error fetching pending counts:", err);
    }
  };

  /** Handle sync state changes from SyncManager */
  const handleSyncStateChange = (state: SyncState) => {
    if (state.status === "syncing") {
      setIsSyncing(true);
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

  /** Auto‑trigger sync when network returns and any queue is non‑empty */
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener(({ isConnected }) => {
      if (
        isConnected &&
        !isSyncing &&
        (pendingJobs > 0 || pendingCosts > 0 || pendingUploads > 0)
      ) {
        syncManager.syncAll();
      }
    });
    return unsubscribe;
  }, [pendingJobs, pendingCosts, pendingUploads, isSyncing]);

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

    return () => {
      removeListener();
      startSub.remove();
      completeSub.remove();
      failSub.remove();
      manualSub.remove();
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default DataSyncManager;
