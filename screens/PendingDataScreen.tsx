import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import { SYNC_EVENTS } from "../Constants/env";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { formatDate } from "../helper";
import { getAllJobs } from "../services/jobService";
import { AppDispatch } from "../store";
import { selectPendingJobsCount, syncPendingJobs } from "../store/jobSlice";
import { Job } from "../types";
import GetAllCache from "../components/TestCases/GetAllCache";

const PendingDataScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const pendingCount = useSelector(selectPendingJobsCount);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);

  // Load jobs on initial render and when pending count changes
  useEffect(() => {
    loadJobs();
  }, [pendingCount]);

  // Set up event listeners for sync events
  useEffect(() => {
    // Listen for sync events
    const syncStartedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_STARTED,
      () => {
        setSyncing(true);
      }
    );

    const syncCompletedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_COMPLETED,
      (data) => {
        setSyncing(false);
        loadJobs();
      }
    );

    const syncFailedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.SYNC_FAILED,
      (data) => {
        setSyncing(false);
        Alert.alert("Sync Failed", "Failed to sync jobs with server.");
      }
    );

    const pendingCountUpdatedListener = DeviceEventEmitter.addListener(
      SYNC_EVENTS.PENDING_COUNT_UPDATED,
      (data) => {
        if (data.jobs) {
          setJobs(data.jobs);
          setLoading(false);
          setRefreshing(false);
        }
      }
    );

    return () => {
      syncStartedListener.remove();
      syncCompletedListener.remove();
      syncFailedListener.remove();
      pendingCountUpdatedListener.remove();
    };
  }, []);

  const loadJobs = async () => {
    try {
      setLoading(true);

      const allJobs = await getAllJobs();
      setJobs(allJobs);
    } catch (error) {
      console.error("[PendingDataScreen] Error loading Pending Data:", error);
      Alert.alert("Error", "Failed to load Pending Data. Please try again.", [
        { text: "OK" },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  const triggerManualSync = () => {
    jobs.length > 0;
    dispatch(syncPendingJobs());
  };

  const renderJobItem = ({ item }: { item: Job }) => {
    return (
      <View style={innerStyles.jobCard}>
        <View style={innerStyles.jobHeader}>
          <Text style={{ fontWeight: "bold", color: color.primary }}>
            Property Id #{item.property_id || "N/A"}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: color.gray }}>
            {formatDate(item.date_created)}
          </Text>
        </View>
        <View style={{ flexDirection: "row", alignItems: "center" }}>
          <Text style={{ fontWeight: "bold", marginRight: 5 }}>Job Type:</Text>
          <Text>#{item.job_type || "N/A"}</Text>
        </View>
        <View>
          <Text style={{ fontWeight: "bold" }}>Tasks:</Text>
          {renderTasks(item)}
        </View>
      </View>
    );
  };

  const renderTasks = (job: Job) => {
    const taskElements = [];
    for (let i = 1; i <= 10; i++) {
      const taskKey = `task${i}` as keyof Job;
      const task = job[taskKey];
      if (task && typeof task === "string" && task.trim() !== "") {
        taskElements.push(
          <View key={`task-${i}`} style={innerStyles.taskRow}>
            <Text style={innerStyles.taskText}>
              {i}. {task}
            </Text>
          </View>
        );
      }
    }

    return taskElements.length > 0 ? (
      taskElements
    ) : (
      <Text>No tasks specified</Text>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={color.primary} />
        <Text style={innerStyles.loadingText}>Loading all jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={innerStyles.headerRow}>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={styles.heading}>
              Pending Data ({jobs.length} Records)
            </Text>
          </View>
          <View style={{ flexDirection: "row" }}>
            {syncing ? (
              <View style={innerStyles.syncingIndicator}>
                <ActivityIndicator size="small" color={color.white} />
              </View>
            ) : jobs.length > 0 ? (
              <TouchableOpacity
                style={innerStyles.syncButton}
                onPress={triggerManualSync}
              >
                <Ionicons name="cloud-upload" size={18} color={color.white} />
              </TouchableOpacity>
            ) : null}
            <TouchableOpacity
              style={innerStyles.refreshButton}
              onPress={loadJobs}
            >
              <Ionicons name="refresh" size={18} color={color.white} />
            </TouchableOpacity>
          </View>
        </View>

        {jobs.length === 0 ? (
          <View style={innerStyles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={64} color="#ccc" />
            <Text style={innerStyles.emptyText}>No Pending Data</Text>
          </View>
        ) : (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            renderItem={renderJobItem}
            style={{ width: "100%" }}
            refreshControl={
              <RefreshControl
                refreshing={refreshing}
                onRefresh={onRefresh}
                colors={[color.primary]}
              />
            }
          />
        )}
      </View>
      <GetAllCache />
    </View>
  );
};

const innerStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 10,
    width: "100%",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  jobCard: {
    backgroundColor: "#fff",
    borderRadius: 8,
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  jobHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
  taskRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginVertical: 1,
  },
  taskText: {
    flex: 1,
    fontSize: fontSize.xs,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  emptyText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    marginBottom: 20,
  },
  refreshButton: {
    backgroundColor: color.primary,
    padding: 8,
    borderRadius: 50,
    marginLeft: 8,
  },
  syncButton: {
    backgroundColor: color.green,
    padding: 8,
    borderRadius: 50,
  },
  syncingIndicator: {
    backgroundColor: color.green,
    padding: 8,
    borderRadius: 50,
    marginRight: 8,
  },
});

export default PendingDataScreen;
