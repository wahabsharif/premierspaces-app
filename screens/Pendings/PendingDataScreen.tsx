import { Ionicons } from "@expo/vector-icons";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import styles from "../../Constants/styles";
import { color, fontSize } from "../../Constants/theme";
import Header from "../../components/Common/Header";
// import CreateJob from "../../components/CreateJob";
import { formatDate } from "../../helper";
import { getAllJobs } from "../../services/jobService";
import { Job } from "../../types";

const PendingDataScreen = () => {
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  // const [createJobModalVisible, setCreateJobModalVisible] = useState(false);

  // Fetch jobs on component mount
  useEffect(() => {
    loadJobs();
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

  // Handle refresh gesture
  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
  };

  // Handle job creation success
  // const handleJobCreated = () => {
  //   loadJobs();
  // };

  // Render a job item
  const renderJobItem = ({ item }: { item: Job }) => {
    return (
      <View style={innerStyles.jobCard}>
        <View style={innerStyles.jobHeader}>
          <Text style={innerStyles.jobNumber}>
            Job #{item.job_num || "N/A"}
          </Text>
          <Text style={{ fontSize: fontSize.xs, color: color.gray }}>
            {formatDate(item.date_created)}
          </Text>
        </View>

        <View>
          <Text style={{ fontWeight: "bold" }}>Tasks:</Text>
          {renderTasks(item)}
        </View>
      </View>
    );
  };

  // Render tasks for a job
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

  // Show loading indicator while fetching data
  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color="#0066cc" />
        <Text style={innerStyles.loadingText}>Loading all jobs...</Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={innerStyles.headerRow}>
          <Text style={[styles.heading, { textAlign: "center", flex: 1 }]}>
            pending Data
          </Text>
          <TouchableOpacity
            style={{
              padding: 8,
              backgroundColor: color.primary,
              borderRadius: 50,
            }}
            onPress={loadJobs}
          >
            <Ionicons name="refresh" size={18} color={color.white} />
          </TouchableOpacity>
        </View>

        {/* Create Job Modal */}
        {/* <CreateJob
          visible={createJobModalVisible}
          onClose={() => setCreateJobModalVisible(false)}
          onSuccess={handleJobCreated}
        /> */}

        {/* Add Job Button */}
        {/* <TouchableOpacity
          style={innerStyles.addButton}
          onPress={() => setCreateJobModalVisible(true)}
        >
          <Ionicons name="add" size={24} color="#fff" />
        </TouchableOpacity> */}

        {jobs.length === 0 ? (
          <View style={innerStyles.emptyContainer}>
            <Ionicons name="clipboard-outline" size={64} color="#ccc" />
            <Text style={innerStyles.emptyText}>No jobs found</Text>
            <TouchableOpacity
              style={innerStyles.refreshButton}
              onPress={loadJobs}
            >
              <Text style={innerStyles.refreshButtonText}>Refresh</Text>
            </TouchableOpacity>
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
                colors={["#0066cc"]}
              />
            }
          />
        )}
      </View>
    </View>
  );
};

const innerStyles = StyleSheet.create({
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between", // pushes items to ends
    alignItems: "center", // vertically centers them
    paddingHorizontal: 16, // optional horizontal padding
    paddingVertical: 10, // optional vertical padding
    width: "100%", // full width
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
    marginBottom: 8,
  },
  jobNumber: {
    fontWeight: "bold",
    fontSize: fontSize.medium,
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
    backgroundColor: "#0066cc",
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 4,
  },
  refreshButtonText: {
    color: "#fff",
    fontWeight: "500",
  },
  addButton: {
    position: "absolute",
    bottom: 20,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: "#0066cc",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 3,
    elevation: 5,
    zIndex: 100,
  },
});

export default PendingDataScreen;
