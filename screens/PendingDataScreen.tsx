import { Ionicons, MaterialIcons } from "@expo/vector-icons";
import { useEvent } from "expo";
import * as FileSystem from "expo-file-system";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  DeviceEventEmitter,
  Dimensions,
  FlatList,
  Image,
  Modal,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Toast } from "toastify-react-native";
import { Header } from "../components";
import { SYNC_EVENTS } from "../Constants/env";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { formatDate } from "../helper";
import { getAllCosts } from "../services/costService";
import { getAllJobs } from "../services/jobService";
import { getAllUploads, UploadSegment } from "../services/uploadService";
import { AppDispatch, RootState } from "../store";
import { selectPendingJobsCount, syncPendingJobs } from "../store/jobSlice";
import { syncOfflineUploads } from "../store/uploaderSlice";
import { Costs, Job } from "../types";

const { width } = Dimensions.get("window");

const PendingDataScreen = () => {
  const dispatch = useDispatch<AppDispatch>();
  const pendingCount = useSelector(selectPendingJobsCount);
  const syncingOfflineUploads = useSelector(
    (state: RootState) => state.uploader.syncingOfflineUploads
  );
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [costs, setCosts] = useState<Costs[]>([]);
  const [uploads, setUploads] = useState<UploadSegment[]>([]);
  const [selectedMedia, setSelectedMedia] = useState<{
    uri: string | null;
    type: string | null;
    name: string | null;
  } | null>(null);
  const [previewVisible, setPreviewVisible] = useState(false);

  // Add state for video URL
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Always call useVideoPlayer without conditions
  const videoPlayer = useVideoPlayer(videoUrl, (player) => {
    if (videoUrl) {
      player.play();
    }
  });

  // Get playing state from the video player
  const { isPlaying } = useEvent(videoPlayer, "playingChange", {
    isPlaying: videoPlayer.playing,
  });

  // Update video URL when media selection changes
  useEffect(() => {
    if (
      selectedMedia &&
      selectedMedia.type?.startsWith("video/") &&
      previewVisible
    ) {
      setVideoUrl(selectedMedia.uri || "");
    } else {
      setVideoUrl("");
    }
  }, [selectedMedia, previewVisible]);

  // Load data on initial render and when counts change
  useEffect(() => {
    loadJobs();
  }, [pendingCount]);

  useEffect(() => {
    loadCosts();
  }, []);

  useEffect(() => {
    loadUploads();
  }, []);

  const loadCosts = async () => {
    try {
      setLoading(true);
      const all = await getAllCosts();
      setCosts(all);
    } catch (err) {
      Toast.error(
        `[CostDataScreen] Error loading costs: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

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
      Toast.error(
        `Error loading Pending Data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const loadUploads = async () => {
    try {
      setLoading(true);
      const allUploads = await getAllUploads();
      setUploads(allUploads);
    } catch (err) {
      Toast.error(
        `[PendingDataScreen] Error loading uploads: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const onRefresh = () => {
    setRefreshing(true);
    loadJobs();
    loadCosts();
    loadUploads();
  };

  const triggerManualSync = () => {
    if (jobs.length > 0) {
      dispatch(syncPendingJobs());
    }
  };

  const triggerUploadSync = () => {
    if (uploads.length > 0) {
      dispatch(syncOfflineUploads({ userName: "current_user" }));
      // Reload uploads after a delay to allow syncing to start
      setTimeout(loadUploads, 1000);
    }
  };

  const getFileTypeIcon = (fileType: string | null) => {
    if (!fileType) return "help";

    if (fileType.startsWith("image/")) return "image";
    if (fileType.startsWith("video/")) return "videocam";
    if (fileType.startsWith("application/pdf")) return "picture-as-pdf";
    if (fileType.startsWith("text/")) return "text-snippet";
    if (fileType.includes("word") || fileType.includes("document"))
      return "description";
    if (fileType.includes("excel") || fileType.includes("sheet"))
      return "table-chart";

    return "insert-drive-file";
  };

  const handlePreviewMedia = async (item: UploadSegment) => {
    try {
      // If there's no content path, we can't preview
      if (!item.content_path) {
        Alert.alert("Preview Error", "No content available for preview");
        return;
      }

      // Check if file exists
      const fileInfo = await FileSystem.getInfoAsync(item.content_path);
      if (!fileInfo.exists) {
        Alert.alert("Preview Error", "File not found");
        return;
      }

      setSelectedMedia({
        uri: item.content_path,
        type: item.file_type,
        name: item.file_name,
      });
      setPreviewVisible(true);
    } catch (error) {
      Toast.error(
        `Error previewing media: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
      Alert.alert("Preview Error", "Failed to load media preview");
    }
  };

  const renderJobItem = ({ item }: { item: Job }) => {
    return (
      <View style={innerStyles.jobCard}>
        <View style={innerStyles.jobHeader}>
          <Text style={{ fontWeight: "bold", color: color.primary }}>
            Property Id #{item.property_id || "N/A"}
          </Text>
          <Text style={{ fontWeight: "bold", color: color.primary }}>
            Common Id #{item.common_id || "N/A"}
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

  const renderCostItem = ({ item }: { item: Costs }) => (
    <View style={innerStyles.card}>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Job ID:</Text>
        <Text style={innerStyles.value}>{item.job_id}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Common ID:</Text>
        <Text style={innerStyles.value}>{item.common_id}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Contractor ID:</Text>
        <Text style={innerStyles.value}>{item.contractor_id ?? "N/A"}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Amount:</Text>
        <Text style={innerStyles.value}>{Number(item.amount).toFixed(2)}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Material Cost:</Text>
        <Text style={innerStyles.value}>
          {Number(item.material_cost).toFixed(2)}
        </Text>
      </View>
    </View>
  );

  const renderUploadItem = ({ item }: { item: UploadSegment }) => (
    <View style={innerStyles.card}>
      <View style={innerStyles.uploadHeader}>
        <View style={innerStyles.fileIconContainer}>
          <MaterialIcons
            name={getFileTypeIcon(item.file_type)}
            size={24}
            color={color.primary}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text
            style={innerStyles.fileName}
            numberOfLines={1}
            ellipsizeMode="middle"
          >
            {item.file_name ?? "Unnamed File"}
          </Text>
          <Text style={innerStyles.fileType}>
            {item.file_type ?? "Unknown type"}
          </Text>
        </View>
      </View>

      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Job ID:</Text>
        <Text style={innerStyles.value}>{item.job_id ?? "N/A"}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Common ID:</Text>
        <Text style={innerStyles.value}>{item.common_id ?? "N/A"}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Property ID:</Text>
        <Text style={innerStyles.value}>{item.property_id ?? "N/A"}</Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>File Size:</Text>
        <Text style={innerStyles.value}>
          {item.file_size
            ? (item.file_size / 1024).toFixed(2) + " KB"
            : "Unknown"}
        </Text>
      </View>
      <View style={innerStyles.row}>
        <Text style={innerStyles.label}>Segment:</Text>
        <Text style={innerStyles.value}>
          {item.segment_number ?? "?"} / {item.total_segments ?? "?"}
        </Text>
      </View>

      {/* Bottom action buttons */}
      <View style={innerStyles.uploadActions}>
        {(item.file_type?.startsWith("image/") ||
          item.file_type?.startsWith("video/")) && (
          <TouchableOpacity
            style={innerStyles.actionButton}
            onPress={() => handlePreviewMedia(item)}
          >
            <Ionicons name="eye-outline" size={16} color={color.white} />
            <Text style={innerStyles.actionText}>Preview</Text>
          </TouchableOpacity>
        )}
      </View>
    </View>
  );

  // Media Preview Modal - Modified to use state instead of conditional hooks
  const renderMediaPreview = () => {
    if (!selectedMedia) return null;

    const isVideo = selectedMedia.type?.startsWith("video/");
    const isImage = selectedMedia.type?.startsWith("image/");

    return (
      <Modal
        visible={previewVisible}
        transparent={true}
        animationType="fade"
        onRequestClose={() => {
          setPreviewVisible(false);
          setSelectedMedia(null);
        }}
      >
        <View style={innerStyles.modalContainer}>
          <View style={innerStyles.modalContent}>
            <View style={innerStyles.modalHeader}>
              <Text style={innerStyles.modalTitle} numberOfLines={1}>
                {selectedMedia.name || "Media Preview"}
              </Text>
              <TouchableOpacity
                onPress={() => {
                  setPreviewVisible(false);
                  setSelectedMedia(null);
                }}
                style={innerStyles.closeButton}
              >
                <Ionicons name="close" size={24} color="#fff" />
              </TouchableOpacity>
            </View>

            <View style={innerStyles.mediaContainer}>
              {isImage && (
                <Image
                  source={{ uri: selectedMedia.uri || undefined }}
                  style={innerStyles.mediaPreview}
                  resizeMode="contain"
                />
              )}

              {isVideo && videoUrl && (
                <View style={{ width: "100%", height: "100%" }}>
                  <VideoView
                    style={innerStyles.mediaPreview}
                    player={videoPlayer}
                    allowsFullscreen
                    allowsPictureInPicture
                  />
                </View>
              )}

              {!isImage && !isVideo && (
                <View style={innerStyles.unsupportedContainer}>
                  <MaterialIcons name="file-present" size={64} color="#ccc" />
                  <Text style={innerStyles.unsupportedText}>
                    Preview not available for this file type
                  </Text>
                </View>
              )}
            </View>
          </View>
        </View>
      </Modal>
    );
  };

  if (loading && !refreshing) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={color.primary} />
        <Text style={innerStyles.loadingText}>Loading data...</Text>
      </View>
    );
  }

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

  const hasAnyData = jobs.length > 0 || uploads.length > 0 || costs.length > 0;

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View
        style={{
          ...styles.headingContainer,
          flexDirection: "row",
          justifyContent: "space-between",
          alignItems: "center",
          paddingHorizontal: 20,
          paddingBottom: 10,
        }}
      >
        <Text style={{ ...styles.heading, marginBottom: 3 }}>
          Pending Data ({jobs.length + costs.length + uploads.length})
        </Text>
        {hasAnyData && (
          <TouchableOpacity
            style={{
              backgroundColor: color.primary,
              padding: 8,
              borderRadius: 50,
            }}
            onPress={onRefresh}
          >
            <Ionicons name="refresh" size={18} color={color.white} />
          </TouchableOpacity>
        )}
      </View>

      {!hasAnyData ? (
        <View style={innerStyles.noDataContainer}>
          <Ionicons name="cloud-offline-outline" size={64} color="#ccc" />
          <Text style={innerStyles.noDataText}>No Pending Data Found</Text>
        </View>
      ) : (
        <ScrollView
          style={innerStyles.scrollContainer}
          contentContainerStyle={innerStyles.scrollContent}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              colors={[color.primary]}
            />
          }
        >
          {/* Jobs Section */}
          {jobs.length > 0 && (
            <View style={innerStyles.section}>
              <View style={innerStyles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={innerStyles.sectionTitle}>
                    Jobs ({jobs.length})
                  </Text>
                </View>
                <View style={{ flexDirection: "row" }}>
                  {syncing ? (
                    <View style={innerStyles.syncingIndicator}>
                      <ActivityIndicator size="small" color={color.white} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={innerStyles.syncButton}
                      onPress={triggerManualSync}
                    >
                      <Ionicons
                        name="cloud-upload"
                        size={18}
                        color={color.white}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <FlatList
                data={jobs}
                keyExtractor={(item) => item.id}
                renderItem={renderJobItem}
                style={{ width: "100%" }}
                scrollEnabled={false} // Disable scrolling for nested FlatList
              />
            </View>
          )}

          {/* Uploads Section */}
          {uploads.length > 0 && (
            <View style={innerStyles.section}>
              <View style={innerStyles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={innerStyles.sectionTitle}>
                    Files ({uploads.length})
                  </Text>
                </View>
                <View style={{ flexDirection: "row" }}>
                  {syncingOfflineUploads ? (
                    <View style={innerStyles.syncingIndicator}>
                      <ActivityIndicator size="small" color={color.white} />
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={innerStyles.syncButton}
                      onPress={triggerUploadSync}
                    >
                      <Ionicons
                        name="cloud-upload"
                        size={18}
                        color={color.white}
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>

              <FlatList
                data={uploads}
                keyExtractor={(item) => item.id}
                renderItem={renderUploadItem}
                style={{ width: "100%" }}
                scrollEnabled={false} // Disable scrolling for nested FlatList
              />
            </View>
          )}

          {/* Costs Section */}
          {costs.length > 0 && (
            <View style={innerStyles.section}>
              <View style={innerStyles.headerRow}>
                <View style={{ flex: 1 }}>
                  <Text style={innerStyles.sectionTitle}>
                    Costs ({costs.length})
                  </Text>
                </View>
              </View>

              <FlatList
                data={costs}
                keyExtractor={(item) => `${item.job_id}-${item.contractor_id}`}
                renderItem={renderCostItem}
                style={{ width: "100%" }}
                scrollEnabled={false} // Disable scrolling for nested FlatList
              />
            </View>
          )}
        </ScrollView>
      )}
      {/* Media Preview Modal */}
      {renderMediaPreview()}
    </View>
  );
};

const innerStyles = StyleSheet.create({
  scrollContainer: {
    flex: 1,
    width: "100%",
  },
  scrollContent: {
    paddingBottom: 20,
  },
  section: {
    width: "100%",
    marginBottom: 15,
    backgroundColor: "#fff",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.1,
    shadowRadius: 2,
    elevation: 2,
    overflow: "hidden",
  },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 16,
    paddingVertical: 12,
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderBottomWidth: 1,
    borderBottomColor: "#efefef",
  },
  loadingText: {
    marginTop: 10,
    fontSize: 16,
    color: "#666",
  },
  jobCard: {
    backgroundColor: "#fff",
    marginVertical: 4,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
  },
  card: {
    backgroundColor: "#fff",
    marginVertical: 0,
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#f0f0f0",
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
  noDataContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  noDataText: {
    fontSize: 16,
    color: "#666",
    marginTop: 16,
    textAlign: "center",
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
  },
  row: {
    flexDirection: "row",
    marginBottom: 4,
  },
  label: {
    fontWeight: "bold",
    width: 120,
    color: color.primary,
  },
  value: {
    flex: 1,
    fontSize: fontSize.small,
    color: color.gray,
  },
  uploadHeader: {
    flexDirection: "row",
    marginBottom: 10,
    alignItems: "center",
  },
  fileIconContainer: {
    width: 40,
    height: 40,
    backgroundColor: "#f0f0f0",
    borderRadius: 20,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  fileName: {
    fontWeight: "bold",
    color: color.primary,
    fontSize: fontSize.small,
  },
  fileType: {
    color: color.gray,
    fontSize: fontSize.xs,
  },
  uploadActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "#f0f0f0",
  },
  actionButton: {
    backgroundColor: color.primary,
    paddingVertical: 5,
    paddingHorizontal: 10,
    borderRadius: 5,
    flexDirection: "row",
    alignItems: "center",
  },
  actionText: {
    color: color.white,
    fontSize: fontSize.xs,
    marginLeft: 5,
  },
  sectionTitle: {
    fontSize: fontSize.medium,
    fontWeight: "bold",
    color: color.primary,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.8)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: width * 0.9,
    height: width * 1.2,
    backgroundColor: "#fff",
    borderRadius: 10,
    overflow: "hidden",
  },
  modalHeader: {
    padding: 10,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: color.primary,
  },
  modalTitle: {
    color: "#fff",
    fontSize: fontSize.small,
    fontWeight: "bold",
    flex: 1,
  },
  closeButton: {
    padding: 5,
  },
  mediaContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f9f9f9",
  },
  mediaPreview: {
    width: "100%",
    height: "100%",
  },
  unsupportedContainer: {
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  unsupportedText: {
    marginTop: 10,
    textAlign: "center",
    color: "#666",
  },
});

export default PendingDataScreen;
