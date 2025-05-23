import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { useEvent } from "expo";
import * as ScreenOrientation from "expo-screen-orientation";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  Image,
  Modal,
  RefreshControl,
  SafeAreaView,
  SectionList,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";
import { Header, VideoThumbnail } from "../components";
import {
  loadFiles,
  selectFiles,
  selectFilesError,
  selectFilesLoading,
} from "../store/filesSlice";
import { FileItem, RootStackParamList } from "../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 5;
const CONTAINER_PADDING = 12; // Container padding on both sides
const ITEM_SPACING = 4; // Space between items
const PAGE_SIZE = 30;

// Calculate item width correctly based on available space
const AVAILABLE_WIDTH = SCREEN_WIDTH - 2 * CONTAINER_PADDING;
const ITEM_WIDTH = AVAILABLE_WIDTH / NUM_COLUMNS - ITEM_SPACING;

type Props = NativeStackScreenProps<RootStackParamList, "MediaPreviewScreen">;

interface MediaSection {
  title: string;
  data: FileItem[][];
}

const formatSectionDate = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) {
    return "Today";
  } else if (date.toDateString() === yesterday.toDateString()) {
    return "Yesterday";
  } else {
    // Format date like "January 15, 2023"
    return date.toLocaleDateString("en-US", {
      month: "long",
      day: "numeric",
      year: "numeric",
    });
  }
};

const MediaPreviewScreen: React.FC<Props> = ({ route }) => {
  // Handle both navigation sources
  const { jobId, fileCategory, files: routeFiles } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();

  // Redux state
  const allFiles = useSelector(selectFiles);
  const isLoading = useSelector(selectFilesLoading);
  const reduxError = useSelector(selectFilesError);

  // Local state
  const [mediaFiles, setMediaFiles] = useState<FileItem[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [isModalReady, setIsModalReady] = useState(false);
  const [dimensions, setDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState(1);
  const [groupedMedia, setGroupedMedia] = useState<MediaSection[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [allFilteredFiles, setAllFilteredFiles] = useState<FileItem[]>([]);
  const [isRefreshing, setIsRefreshing] = useState(false);
  // Add state to track failed images
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());

  // Use files from route.params if provided, otherwise undefined
  const filesFromRoute = useMemo(
    () => (routeFiles ? [...routeFiles] : undefined),
    [routeFiles]
  );

  const [activeTab, setActiveTab] = useState<string>(fileCategory || "image");
  const thumbnailCache = useMemo(() => new Map<string, string>(), []);

  // Add state to track current video URL
  const [videoUrl, setVideoUrl] = useState<string>("");

  // Use refs to store the video URL for reference
  const videoUrlRef = React.useRef<string | null>(null);

  // Always call the hook unconditionally with the state URL
  const videoPlayer = useVideoPlayer(videoUrl, (player) => {
    if (videoUrl) {
      player.play();
    }
  });

  // Update video URL when needed
  useEffect(() => {
    if (selectedItem && activeTab === "video" && isModalReady && modalVisible) {
      setVideoUrl(selectedItem.stream_url);
      videoUrlRef.current = selectedItem.stream_url;
    } else {
      // Clear URL when not needed
      setVideoUrl("");
      videoUrlRef.current = null;
    }
  }, [selectedItem, activeTab, isModalReady, modalVisible]);

  // Get playing state from the video player
  const { isPlaying } = useEvent(videoPlayer, "playingChange", {
    isPlaying: videoPlayer.playing,
  });

  useEffect(() => {
    const dimensionsListener = Dimensions.addEventListener(
      "change",
      ({ window }) => {
        const { width, height } = window;
        setDimensions({ width, height });
        setOrientation(width > height ? 2 : 1);
      }
    );

    return () => {
      dimensionsListener.remove();
    };
  }, []);

  const getFileCategoryNumber = (category: string): string => {
    switch (category) {
      case "image":
        return "1";
      case "document":
        return "2";
      case "video":
        return "3";
      default:
        return "1";
    }
  };

  // Load files function
  const loadJobFiles = useCallback(async () => {
    try {
      const AsyncStorage = await import(
        "@react-native-async-storage/async-storage"
      ).then((m) => m.default);
      const propRaw = await AsyncStorage.getItem("selectedProperty");
      if (!propRaw) {
        setError("Missing property data");
        return;
      }
      const { id: propertyId } = JSON.parse(propRaw);
      dispatch(loadFiles({ propertyId }) as any);
    } catch (e: any) {
      setError(e.message);
    }
  }, [dispatch]);

  // Load files using Redux
  useEffect(() => {
    if (filesFromRoute) {
      return;
    }
    loadJobFiles();
  }, [filesFromRoute, loadJobFiles]);

  // Update error state if Redux has an error - only when reduxError changes
  useEffect(() => {
    if (reduxError) {
      setError(reduxError);
    }
  }, [reduxError]);

  // Filter files for the current job and active tab
  useEffect(() => {
    let filteredFiles: FileItem[] = [];

    if (filesFromRoute) {
      // If files were passed via route params, use those
      const categoryNumber = getFileCategoryNumber(activeTab);
      filteredFiles = filesFromRoute.filter(
        (item) => item.file_category === categoryNumber
      );
    } else if (allFiles.length > 0 && jobId) {
      // Filter from Redux store using jobId
      const categoryNumber = getFileCategoryNumber(activeTab);
      filteredFiles = allFiles
        .filter((item) => item.job_id === jobId)
        .filter((item) => item.file_category === categoryNumber);
    }

    setAllFilteredFiles(filteredFiles);
    setCurrentPage(1);
  }, [activeTab, allFiles, jobId, filesFromRoute]);

  useEffect(() => {
    const paginatedFiles = allFilteredFiles.slice(0, currentPage * PAGE_SIZE);
    setMediaFiles(paginatedFiles);

    // Group files by date
    const groupedByDate = paginatedFiles.reduce<Record<string, FileItem[]>>(
      (acc, file) => {
        const dateStr = new Date(file.date_created).toDateString();
        if (!acc[dateStr]) {
          acc[dateStr] = [];
        }
        acc[dateStr].push(file);
        return acc;
      },
      {}
    );

    // Sort dates in descending order (newest first)
    const sortedDates = Object.keys(groupedByDate).sort(
      (a, b) => new Date(b).getTime() - new Date(a).getTime()
    );

    // Create sections with date headers
    const sections: MediaSection[] = sortedDates.map((dateStr) => {
      const date = new Date(dateStr);
      const files = groupedByDate[dateStr];

      // Create rows for grid layout (NUM_COLUMNS items per row)
      const rows: FileItem[][] = [];
      for (let i = 0; i < files.length; i += NUM_COLUMNS) {
        rows.push(files.slice(i, i + NUM_COLUMNS));
      }

      return {
        title: formatSectionDate(date),
        data: rows,
      };
    });

    setGroupedMedia(sections);
  }, [allFilteredFiles, currentPage]);

  const loadMoreData = () => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev + 1);
      setTimeout(() => {
        setIsLoadingMore(false);
      }, 500);
    }, 300);
  };

  // Pull to refresh handler
  const onRefresh = useCallback(async () => {
    if (filesFromRoute) {
      // If using route files, just reset the view
      setIsRefreshing(true);
      setTimeout(() => {
        setCurrentPage(1);
        setIsRefreshing(false);
      }, 1000);
      return;
    }

    setIsRefreshing(true);
    setError(null);
    try {
      await loadJobFiles();
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setTimeout(() => {
        setIsRefreshing(false);
      }, 1000);
    }
  }, [filesFromRoute, loadJobFiles]);

  // Handle modal ready state
  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (modalVisible) {
      timeoutId = setTimeout(() => setIsModalReady(true), 100);
    } else {
      setIsModalReady(false);
      setIsFullscreen(false);
      // Reset orientation when closing modal
      if (orientation !== 1) {
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(() => {});
      }
    }

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [modalVisible, orientation]);

  const openModal = async (item: FileItem) => {
    setSelectedItem(item);
    setModalVisible(true);

    // Allow screen rotation if it's a video
    if (item.file_category === getFileCategoryNumber("video")) {
      await ScreenOrientation.unlockAsync().catch(() => {});
    }
  };

  const closeModal = async () => {
    // Stop video playback if needed
    if (videoPlayer && videoUrl) {
      videoPlayer.pause();
    }

    // Lock back to portrait when closing
    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    ).catch(() => {});

    setModalVisible(false);
  };

  const toggleFullscreen = async () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);

    if (newState) {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.LANDSCAPE
      ).catch(() => {});
    } else {
      await ScreenOrientation.lockAsync(
        ScreenOrientation.OrientationLock.PORTRAIT_UP
      ).catch(() => {});
    }
  };

  // Create a renderSectionHeader function
  const renderSectionHeader = ({ section }: { section: MediaSection }) => (
    <View style={innerStyles.sectionHeader}>
      <Text style={innerStyles.sectionHeaderText}>{section.title}</Text>
    </View>
  );

  // Create a renderRow function for displaying a row of items
  const renderRow = (items: FileItem[], rowKey: string) => (
    <View style={innerStyles.row} key={rowKey}>
      {items.map((item) => (
        <TouchableOpacity
          key={`file-${item.id}`}
          style={innerStyles.itemContainer}
          onPress={() => openModal(item)}
          activeOpacity={0.7}
        >
          {activeTab === "image" ? (
            failedImages.has(item.stream_url) ? (
              <View style={innerStyles.brokenImageContainer}>
                <Image
                  source={require("../assets/images/broken-image.png")}
                  style={{ width: 80, height: 80 }}
                  resizeMode="contain"
                />
              </View>
            ) : (
              <Image
                source={{ uri: item.stream_url }}
                style={innerStyles.image}
                resizeMode="cover"
                onError={() => {
                  setFailedImages((prev) => new Set(prev).add(item.stream_url));
                }}
              />
            )
          ) : activeTab === "video" ? (
            <View style={innerStyles.videoThumbnailContainer}>
              <View style={innerStyles.videoThumbnail}>
                <VideoThumbnail
                  uri={item.stream_url}
                  onPress={() => openModal(item)}
                  active
                  cache={thumbnailCache}
                />
              </View>
              <View style={innerStyles.videoThumbnailOverlay}>
                <Text style={innerStyles.videoIcon}>▶</Text>
              </View>
              <Text style={innerStyles.videoLabel} numberOfLines={1}>
                {item.file_name || "Video"}
              </Text>
            </View>
          ) : (
            <View style={innerStyles.documentPlaceholder}>
              <Text style={innerStyles.documentText}>Document</Text>
              <Text style={innerStyles.documentName} numberOfLines={1}>
                {item.file_name}
              </Text>
            </View>
          )}
        </TouchableOpacity>
      ))}
      {/* Add empty placeholders with unique keys */}
      {Array.from({ length: NUM_COLUMNS - items.length }).map((_, i) => (
        <View
          key={`placeholder-${rowKey}-${i}`}
          style={innerStyles.placeholderItem}
        />
      ))}
    </View>
  );

  const renderModalContent = () => {
    if (!selectedItem) return null;

    if (activeTab === "video" && !isModalReady) {
      return <ActivityIndicator size="large" color="#fff" />;
    }

    if (activeTab === "image") {
      return failedImages.has(selectedItem.stream_url) ? (
        <View style={innerStyles.modalBrokenImageContainer}>
          <Image
            source={require("../assets/images/broken-image.png")}
            style={{ width: 200, height: 200 }}
            resizeMode="contain"
          />
        </View>
      ) : (
        <Image
          source={{ uri: selectedItem.stream_url }}
          style={innerStyles.modalImage}
          resizeMode="contain"
          onError={() => {
            setFailedImages((prev) =>
              new Set(prev).add(selectedItem.stream_url)
            );
          }}
        />
      );
    }

    if (activeTab === "video") {
      const videoStyles =
        orientation === 2 || isFullscreen
          ? [
              innerStyles.videoPlayer,
              { width: dimensions.width, height: dimensions.height },
            ]
          : [innerStyles.videoPlayer];

      return (
        <View
          style={[
            innerStyles.modalVideoContainer,
            orientation === 2 || isFullscreen
              ? { width: dimensions.width, height: dimensions.height }
              : {},
          ]}
        >
          {videoUrl && (
            <>
              <VideoView
                style={videoStyles}
                player={videoPlayer}
                allowsFullscreen
                allowsPictureInPicture
              />
            </>
          )}
        </View>
      );
    }

    return (
      <View style={innerStyles.modalDocContainer}>
        <Text style={innerStyles.modalDocText}>Document Preview</Text>
        <Text style={innerStyles.modalFileName}>{selectedItem.file_name}</Text>
      </View>
    );
  };

  const handleRetry = () => {
    setError(null);
    loadJobFiles();
  };

  const renderFooter = () => {
    return (
      <View
        style={[
          innerStyles.loaderFooter,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        {isLoadingMore ? (
          <ActivityIndicator size="large" color={color.primary} />
        ) : null}
      </View>
    );
  };

  if (isLoading && !filesFromRoute) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={[styles.container, innerStyles.center]}>
          <ActivityIndicator size="large" color={color.primary} />
        </View>
      </View>
    );
  }

  if (error && !filesFromRoute) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={[styles.container, innerStyles.center]}>
          <Text style={innerStyles.errorText}>{error}</Text>
          <TouchableOpacity
            style={innerStyles.retryButton}
            onPress={handleRetry}
          >
            <Text style={innerStyles.retryButtonText}>Retry</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const tabs = [
    { key: "image", label: "Images" },
    { key: "video", label: "Videos" },
    { key: "document", label: "Documents" },
  ];

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={{ flex: 1 }}>
        <View style={innerStyles.tabsContainer}>
          {tabs.map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={innerStyles.tabItem}
              onPress={() => setActiveTab(tab.key)}
            >
              <Text
                style={[
                  innerStyles.tabText,
                  activeTab === tab.key && innerStyles.activeTabText,
                ]}
              >
                {tab.label}
              </Text>
              {activeTab === tab.key && (
                <View style={innerStyles.tabUnderline} />
              )}
            </TouchableOpacity>
          ))}
        </View>

        <SectionList
          sections={groupedMedia}
          keyExtractor={(items, sectionIndex) =>
            `section-${sectionIndex}-${items.map((item) => item.id).join("-")}`
          }
          renderItem={({ item, index, section }) =>
            renderRow(item, `row-${section.title}-${index}`)
          }
          renderSectionHeader={renderSectionHeader}
          stickySectionHeadersEnabled={false}
          contentContainerStyle={
            mediaFiles.length === 0
              ? { flex: 1, justifyContent: "center" }
              : { paddingBottom: insets.bottom }
          }
          ListEmptyComponent={() => (
            <View style={innerStyles.emptyContainer}>
              <Text style={innerStyles.emptyText}>
                No {activeTab} files found.
              </Text>
            </View>
          )}
          ListFooterComponent={renderFooter}
          onEndReached={loadMoreData}
          onEndReachedThreshold={0.5}
          refreshControl={
            <RefreshControl
              refreshing={isRefreshing}
              onRefresh={onRefresh}
              colors={[color.primary]}
              tintColor={color.primary}
              title="Pull to refresh"
              titleColor={color.primary}
            />
          }
        />
        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
          statusBarTranslucent
        >
          <SafeAreaView
            style={[
              innerStyles.modalContainer,
              activeTab === "video" &&
                (orientation === 2 || isFullscreen) &&
                innerStyles.fullscreenModalContainer,
            ]}
          >
            <StatusBar
              backgroundColor="#000"
              barStyle="light-content"
              translucent
            />

            <TouchableOpacity
              style={[
                innerStyles.closeButton,
                (orientation === 2 || isFullscreen) && { top: 20 },
              ]}
              onPress={closeModal}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={innerStyles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {activeTab === "video" && (
              <TouchableOpacity
                style={[
                  innerStyles.fullscreenButton,
                  (orientation === 2 || isFullscreen) && { top: 20, right: 70 },
                ]}
                onPress={toggleFullscreen}
                hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
              >
                <Text style={innerStyles.fullscreenButtonText}>
                  {isFullscreen ? "↙" : "↗"}
                </Text>
              </TouchableOpacity>
            )}

            <View
              style={[
                innerStyles.modalContent,
                activeTab === "video" &&
                  (orientation === 2 || isFullscreen) && { padding: 0 },
              ]}
            >
              {renderModalContent()}
            </View>

            {selectedItem &&
              !(
                activeTab === "video" &&
                (orientation === 2 || isFullscreen)
              ) && (
                <View style={innerStyles.fileInfoContainer}>
                  <Text style={innerStyles.fileInfoText}>
                    {selectedItem.file_name}
                  </Text>
                  <Text style={innerStyles.fileInfoDate}>
                    {new Date(selectedItem.date_created).toLocaleDateString()}
                  </Text>
                </View>
              )}
          </SafeAreaView>
        </Modal>
      </View>
    </View>
  );
};

const innerStyles = StyleSheet.create({
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  tabItem: {
    alignItems: "center",
    paddingVertical: 6,
    flex: 1,
  },
  tabText: {
    fontSize: 16,
    color: "#444",
  },
  activeTabText: {
    fontWeight: "bold",
    color: "#0077B6",
  },
  tabUnderline: {
    height: 2,
    backgroundColor: "#0077B6",
    width: "60%",
    marginTop: 4,
  },
  itemContainer: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    margin: ITEM_SPACING / 2,
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    elevation: 2,
  },
  imageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  errorItem: {
    backgroundColor: "#f0f0f0",
    justifyContent: "center",
    alignItems: "center",
  },
  errorItemText: {
    color: "#666",
    fontSize: 12,
    textAlign: "center",
    padding: 5,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  loadingText: {
    marginTop: 10,
    color: "#666",
  },
  documentPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#2C7DA0",
    padding: 10,
  },
  documentText: {
    color: "#fff",
    textAlign: "center",
    padding: 4,
    fontWeight: "bold",
  },
  documentName: {
    color: "#fff",
    textAlign: "center",
    fontSize: 12,
    marginTop: 5,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    color: "#666",
    textAlign: "center",
    fontSize: 16,
  },
  errorText: {
    color: "red",
    padding: 16,
    textAlign: "center",
    marginBottom: 20,
  },
  retryButton: {
    backgroundColor: "#0077B6",
    paddingHorizontal: 24,
    paddingVertical: 10,
    borderRadius: 4,
  },
  retryButtonText: {
    color: "#fff",
    fontWeight: "bold",
  },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
  },
  fullscreenModalContainer: {
    backgroundColor: "#000",
  },
  modalContent: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 10,
  },
  errorModalContent: {
    width: SCREEN_WIDTH * 0.8,
    height: 200,
    backgroundColor: "#aa3333",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
  },
  errorModalText: {
    color: "#fff",
    fontSize: 16,
    textAlign: "center",
  },
  modalImage: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (4 / 3),
    maxHeight: SCREEN_HEIGHT - 150,
  },
  videoPlayer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: "#000",
  },
  modalVideoContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    justifyContent: "center",
    alignItems: "center",
  },
  modalDocContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH,
    backgroundColor: "#2C7DA0",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 8,
    padding: 20,
  },
  modalDocText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalFileName: {
    color: "#fff",
    fontSize: 14,
    marginTop: 10,
    textAlign: "center",
  },
  closeButton: {
    position: "absolute",
    top: 40,
    right: 20,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
    fontWeight: "bold",
  },
  fullscreenButton: {
    position: "absolute",
    top: 40,
    right: 70,
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 5,
  },
  fullscreenButtonText: {
    color: "#fff",
    fontSize: 20,
    fontWeight: "bold",
  },
  fileInfoContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 15,
    alignItems: "center",
  },
  fileInfoText: {
    color: "#fff",
    fontSize: 16,
    fontWeight: "500",
  },
  fileInfoDate: {
    color: "#ccc",
    fontSize: 12,
    marginTop: 4,
  },
  videoThumbnailContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  videoThumbnail: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222",
  },
  videoThumbnailOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(0,0,0,0.3)",
  },
  videoIcon: {
    color: "#fff",
    fontSize: 40,
    textShadowColor: "rgba(0,0,0,0.5)",
    textShadowOffset: { width: 1, height: 1 },
    textShadowRadius: 3,
  },
  videoLabel: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.7)",
    color: "#fff",
    padding: 4,
    fontSize: 12,
    textAlign: "center",
  },
  sectionHeader: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    marginBottom: ITEM_SPACING,
  },
  sectionHeaderText: {
    fontSize: 18,
    fontWeight: "bold",
    color: "#333",
  },
  row: {
    flexDirection: "row",
    justifyContent: "center",
    flexWrap: "nowrap",
    paddingHorizontal: CONTAINER_PADDING - ITEM_SPACING / 2,
    marginBottom: ITEM_SPACING,
  },
  placeholderItem: {
    width: ITEM_WIDTH,
    height: ITEM_WIDTH,
    margin: ITEM_SPACING / 2,
  },
  loaderFooter: {
    padding: 20,
    alignItems: "center",
    justifyContent: "center",
    height: 80,
    width: "100%",
  },
  loadingMoreText: {
    color: "#666",
    marginTop: 8,
    fontSize: 14,
    textAlign: "center",
  },
  brokenImageContainer: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
  modalBrokenImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (4 / 3),
    maxHeight: SCREEN_HEIGHT - 150,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f0f0f0",
  },
});
export default MediaPreviewScreen;
