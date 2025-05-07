import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { DeviceEventEmitter } from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { SYNC_EVENTS } from "../Constants/env";
import { getAllJobs } from "../services/jobService";
import { syncManager } from "../services/syncManager";
import { AppDispatch } from "../store";
import {
  selectPendingJobsCount,
  syncPendingJobs,
  updatePendingCount,
} from "../store/jobSlice";

interface DataSyncManagerProps {
  children: React.ReactNode;
}

const DataSyncManager: React.FC<DataSyncManagerProps> = ({ children }) => {
  const dispatch = useDispatch<AppDispatch>();
  const pendingCount = useSelector(selectPendingJobsCount);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const updateOfflineJobCount = async () => {
      try {
        const jobs = await getAllJobs();
        dispatch(updatePendingCount(jobs.length));

        DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
          count: jobs.length,
          jobs: jobs,
        });
      } catch (error) {
        console.error("[DataSyncManager] Error updating job count:", error);
      }
    };

    updateOfflineJobCount();

    const intervalId = setInterval(updateOfflineJobCount, 30000);

    return () => {
      clearInterval(intervalId);
    };
  }, [dispatch]);

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      if (state.isConnected && pendingCount > 0 && !isSyncing) {
        setIsSyncing(true);
        DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_STARTED);
        dispatch(syncPendingJobs())
          .unwrap()
          .then((result) => {
            getAllJobs().then((jobs) => {
              dispatch(updatePendingCount(jobs.length));
              DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_COMPLETED, {
                result,
                remainingJobs: jobs,
              });
            });
          })
          .catch((error) => {
            console.error("[DataSyncManager] Sync error:", error);
            DeviceEventEmitter.emit(SYNC_EVENTS.SYNC_FAILED, { error });
          })
          .finally(() => {
            setIsSyncing(false);
          });
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch, pendingCount, isSyncing]);

  useEffect(() => {
    syncManager.initialize();

    const syncListener = syncManager.addSyncListener((syncState) => {
      if (syncState.status === "complete") {
        getAllJobs().then((jobs) => {
          dispatch(updatePendingCount(jobs.length));
          DeviceEventEmitter.emit(SYNC_EVENTS.PENDING_COUNT_UPDATED, {
            count: jobs.length,
            jobs: jobs,
          });
        });
      }
    });

    return () => {
      syncListener();
    };
  }, [dispatch]);

  return <>{children}</>;
};

export default DataSyncManager;
