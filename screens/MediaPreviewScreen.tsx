import { MaterialCommunityIcons } from "@expo/vector-icons";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import * as ScreenOrientation from "expo-screen-orientation";
import { useVideoPlayer, VideoView } from "expo-video";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Image,
  Linking,
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
import {
  Gesture,
  GestureDetector,
  GestureHandlerRootView,
} from "react-native-gesture-handler";
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

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 5;
const CONTAINER_PADDING = 12;
const ITEM_SPACING = 4;
const PAGE_SIZE = 30;
const AVAILABLE_WIDTH = SCREEN_WIDTH - 2 * CONTAINER_PADDING;
const ITEM_WIDTH = AVAILABLE_WIDTH / NUM_COLUMNS - ITEM_SPACING;

// Types
type Props = NativeStackScreenProps<RootStackParamList, "MediaPreviewScreen">;

interface MediaSection {
  title: string;
  data: FileItem[][];
}

interface ViewDimensions {
  width: number;
  height: number;
}

// Utility functions
const getFileCategoryNumber = (category: string): string => {
  const categoryMap: Record<string, string> = {
    image: "1",
    document: "2",
    video: "3",
  };
  return categoryMap[category] || "1";
};

const getDocumentType = (fileName: string): string => {
  if (!fileName) return "unknown";
  const extension = fileName.split(".").pop()?.toLowerCase() || "";

  const typeMap: Record<string, string> = {
    pdf: "pdf",
    doc: "word",
    docx: "word",
    xls: "excel",
    xlsx: "excel",
    ppt: "powerpoint",
    pptx: "powerpoint",
    txt: "text",
  };

  return typeMap[extension] || "generic";
};

const formatSectionDate = (date: Date): string => {
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(yesterday.getDate() - 1);

  if (date.toDateString() === today.toDateString()) return "Today";
  if (date.toDateString() === yesterday.toDateString()) return "Yesterday";

  return date.toLocaleDateString("en-US", {
    month: "long",
    day: "numeric",
    year: "numeric",
  });
};

const createFileRows = (files: FileItem[]): FileItem[][] => {
  const rows: FileItem[][] = [];
  for (let i = 0; i < files.length; i += NUM_COLUMNS) {
    rows.push(files.slice(i, i + NUM_COLUMNS));
  }
  return rows;
};

const groupFilesByDate = (files: FileItem[]): MediaSection[] => {
  const groupedByDate = files.reduce<Record<string, FileItem[]>>(
    (acc, file) => {
      const dateStr = new Date(file.date_created).toDateString();
      if (!acc[dateStr]) acc[dateStr] = [];
      acc[dateStr].push(file);
      return acc;
    },
    {}
  );

  const sortedDates = Object.keys(groupedByDate).sort(
    (a, b) => new Date(b).getTime() - new Date(a).getTime()
  );

  return sortedDates.map((dateStr) => ({
    title: formatSectionDate(new Date(dateStr)),
    data: createFileRows(groupedByDate[dateStr]),
  }));
};

// Custom hooks
const useAsyncStorage = () => {
  const getProperty = useCallback(async () => {
    const AsyncStorage = await import(
      "@react-native-async-storage/async-storage"
    ).then((m) => m.default);
    const propRaw = await AsyncStorage.getItem("selectedProperty");
    if (!propRaw) throw new Error("Missing property data");
    return JSON.parse(propRaw);
  }, []);

  return { getProperty };
};

const useScreenOrientation = () => {
  const [dimensions, setDimensions] = useState<ViewDimensions>({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });
  const [orientation, setOrientation] = useState(1);

  useEffect(() => {
    const subscription = Dimensions.addEventListener("change", ({ window }) => {
      setDimensions(window);
      setOrientation(window.width > window.height ? 2 : 1);
    });

    return () => subscription?.remove();
  }, []);

  return { dimensions, orientation };
};

// Component
const MediaPreviewScreen: React.FC<Props> = ({ route }) => {
  const { jobId, fileCategory, files: routeFiles } = route.params;
  const dispatch = useDispatch();
  const insets = useSafeAreaInsets();
  const { getProperty } = useAsyncStorage();
  const { dimensions, orientation } = useScreenOrientation();

  // Redux state
  const allFiles = useSelector(selectFiles);
  const isLoading = useSelector(selectFilesLoading);
  const reduxError = useSelector(selectFilesError);

  // Local state
  const [activeTab, setActiveTab] = useState<string>(fileCategory || "image");
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<FileItem | null>(null);
  const [isModalReady, setIsModalReady] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [failedImages, setFailedImages] = useState<Set<string>>(new Set());
  const [videoUrl, setVideoUrl] = useState<string>("");
  const [enableTabSwipe] = useState(true);
  const [, setSwipeIndicator] = useState({
    visible: false,
    direction: "",
  });

  // Refs and memoized values
  const videoUrlRef = useRef<string | null>(null);
  const thumbnailCache = useMemo(() => new Map<string, string>(), []);
  const filesFromRoute = useMemo(
    () => (routeFiles ? [...routeFiles] : undefined),
    [routeFiles]
  );

  // Video player
  const videoPlayer = useVideoPlayer(videoUrl, (player) => {
    if (videoUrl) player.play();
  });

  // Computed values
  const allFilteredFiles = useMemo(() => {
    if (filesFromRoute) {
      const categoryNumber = getFileCategoryNumber(activeTab);
      return filesFromRoute.filter(
        (item) => item.file_category === categoryNumber
      );
    }

    if (allFiles.length > 0 && jobId) {
      const categoryNumber = getFileCategoryNumber(activeTab);
      return allFiles
        .filter((item) => item.job_id === jobId)
        .filter((item) => item.file_category === categoryNumber);
    }

    return [];
  }, [activeTab, allFiles, jobId, filesFromRoute]);

  const paginatedFiles = useMemo(
    () => allFilteredFiles.slice(0, currentPage * PAGE_SIZE),
    [allFilteredFiles, currentPage]
  );

  const groupedMedia = useMemo(
    () => groupFilesByDate(paginatedFiles),
    [paginatedFiles]
  );

  const tabs = useMemo(
    () => [
      { key: "image", label: "Images" },
      { key: "video", label: "Videos" },
      { key: "document", label: "Documents" },
    ],
    []
  );

  // Effects
  useEffect(() => {
    setCurrentPage(1);
  }, [activeTab, allFiles, jobId, filesFromRoute]);

  useEffect(() => {
    if (reduxError) setError(reduxError);
  }, [reduxError]);

  useEffect(() => {
    if (selectedItem && activeTab === "video" && isModalReady && modalVisible) {
      setVideoUrl(selectedItem.stream_url);
      videoUrlRef.current = selectedItem.stream_url;
    } else {
      setVideoUrl("");
      videoUrlRef.current = null;
    }
  }, [selectedItem, activeTab, isModalReady, modalVisible]);

  useEffect(() => {
    let timeoutId: NodeJS.Timeout | null = null;

    if (modalVisible) {
      timeoutId = setTimeout(() => setIsModalReady(true), 100);
    } else {
      setIsModalReady(false);
      setIsFullscreen(false);
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

  // Define the pan gesture using Gesture.Pan()
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        // Only activate the gesture for significant horizontal movement
        .activeOffsetX([-20, 20])
        // Don't activate for vertical scrolling
        .failOffsetY([-5, 5])
        .onEnd((event) => {
          try {
            if (!enableTabSwipe) return;

            // Threshold for tab switching (higher = less sensitive)
            const SWIPE_THRESHOLD = 50;
            const { translationX } = event;

            if (translationX > SWIPE_THRESHOLD) {
              // Right swipe - go to previous tab
              const currentIndex = tabs.findIndex(
                (tab) => tab.key === activeTab
              );
              if (currentIndex > 0) {
                setActiveTab(tabs[currentIndex - 1].key);
                setSwipeIndicator({ visible: true, direction: "right" });
                setTimeout(
                  () => setSwipeIndicator({ visible: false, direction: "" }),
                  500
                );
              }
            } else if (translationX < -SWIPE_THRESHOLD) {
              // Left swipe - go to next tab
              const currentIndex = tabs.findIndex(
                (tab) => tab.key === activeTab
              );
              if (currentIndex < tabs.length - 1) {
                setActiveTab(tabs[currentIndex + 1].key);
                setSwipeIndicator({ visible: true, direction: "left" });
                setTimeout(
                  () => setSwipeIndicator({ visible: false, direction: "" }),
                  500
                );
              }
            }
          } catch (error) {
            console.log("Gesture error:", error);
          }
        })
        .simultaneousWithExternalGesture(Gesture.Tap(), Gesture.LongPress()),
    [activeTab, enableTabSwipe, tabs]
  );

  // Handlers
  const loadJobFiles = useCallback(async () => {
    try {
      const { id: propertyId } = await getProperty();
      dispatch(loadFiles({ propertyId }) as any);
    } catch (e: any) {
      setError(e.message);
    }
  }, [dispatch, getProperty]);

  const loadMoreData = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev + 1);
      setTimeout(() => setIsLoadingMore(false), 500);
    }, 300);
  }, [isLoadingMore]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);

    if (filesFromRoute) {
      setTimeout(() => {
        setCurrentPage(1);
        setIsRefreshing(false);
      }, 1000);
      return;
    }

    try {
      await loadJobFiles();
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 1000);
    }
  }, [filesFromRoute, loadJobFiles]);

  const handleOpenDocument = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
      console.error("Error opening document:", error);
      Alert.alert(
        "Error",
        "There was a problem opening this document. Please try again.",
        [{ text: "OK" }]
      );
    }
  }, []);

  const openModal = useCallback(
    async (item: FileItem) => {
      setSelectedItem(item);

      if (item.file_category === getFileCategoryNumber("document")) {
        handleOpenDocument(item.stream_url);
        return;
      }

      setModalVisible(true);

      if (item.file_category === getFileCategoryNumber("video")) {
        await ScreenOrientation.unlockAsync().catch(() => {});
      }
    },
    [handleOpenDocument]
  );

  const closeModal = useCallback(async () => {
    if (videoPlayer && videoUrl) {
      videoPlayer.pause();
    }

    await ScreenOrientation.lockAsync(
      ScreenOrientation.OrientationLock.PORTRAIT_UP
    ).catch(() => {});
    setModalVisible(false);
  }, [videoPlayer, videoUrl]);

  const toggleFullscreen = useCallback(async () => {
    const newState = !isFullscreen;
    setIsFullscreen(newState);

    const lockOrientation = newState
      ? ScreenOrientation.OrientationLock.LANDSCAPE
      : ScreenOrientation.OrientationLock.PORTRAIT_UP;

    await ScreenOrientation.lockAsync(lockOrientation).catch(() => {});
  }, [isFullscreen]);

  const handleImageError = useCallback((url: string) => {
    setFailedImages((prev) => new Set(prev).add(url));
  }, []);

  const handleRetry = useCallback(() => {
    setError(null);
    loadJobFiles();
  }, [loadJobFiles]);

  // Load files on mount
  useEffect(() => {
    if (!filesFromRoute) {
      loadJobFiles();
    }
  }, [filesFromRoute, loadJobFiles]);

  // Render functions
  const renderImageItem = useCallback(
    (item: FileItem) => {
      const isFailed = failedImages.has(item.stream_url);

      if (isFailed) {
        return (
          <View style={innerStyles.brokenImageContainer}>
            <Image
              source={require("../assets/images/broken-image.png")}
              style={{ width: 80, height: 80 }}
              resizeMode="contain"
            />
          </View>
        );
      }

      return (
        <Image
          source={{ uri: item.stream_url }}
          style={innerStyles.image}
          resizeMode="cover"
          onError={() => handleImageError(item.stream_url)}
        />
      );
    },
    [failedImages, handleImageError]
  );

  const renderVideoItem = useCallback(
    (item: FileItem) => (
      <View style={innerStyles.videoThumbnailContainer}>
        <View style={innerStyles.videoThumbnail}>
          <VideoThumbnail
            uri={item.stream_url}
            onPress={() => openModal(item)}
            active
            cache={thumbnailCache}
          />
        </View>
        <Text style={innerStyles.videoLabel} numberOfLines={1}>
          {item.file_name || "Video"}
        </Text>
      </View>
    ),
    [openModal, thumbnailCache]
  );

  const renderDocumentItem = useCallback((item: FileItem) => {
    const docType = getDocumentType(item.file_name || "");

    // Choose icon based on document type
    let IconComponent = MaterialCommunityIcons;
    // Use type assertion for icon names to match the expected literal type
    let iconName: keyof typeof MaterialCommunityIcons.glyphMap =
      "file-document-outline";
    let iconColor = "#2C7DA0";

    switch (docType) {
      case "pdf":
        iconName =
          "file-pdf-box" as keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor = "#F40F02";
        break;
      case "word":
        iconName =
          "file-word-box" as keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor = "#295496";
        break;
      case "excel":
        iconName =
          "file-excel-box" as keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor = "#1D6F42";
        break;
      case "powerpoint":
        iconName =
          "file-powerpoint-box" as keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor = "#D24625";
        break;
      case "text":
        iconName =
          "file-document-outline" as keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor = "#424242";
        break;
      default:
        iconName =
          "file-outline" as keyof typeof MaterialCommunityIcons.glyphMap;
        iconColor = "#607D8B";
    }

    return (
      <View style={innerStyles.documentPlaceholder}>
        <IconComponent
          name={iconName}
          size={60}
          color={iconColor}
          style={innerStyles.documentIcon}
        />
        <Text style={innerStyles.documentName} numberOfLines={1}>
          {item.file_name}
        </Text>
      </View>
    );
  }, []);

  const renderItem = useCallback(
    (item: FileItem) => {
      switch (activeTab) {
        case "image":
          return renderImageItem(item);
        case "video":
          return renderVideoItem(item);
        case "document":
          return renderDocumentItem(item);
        default:
          return renderImageItem(item);
      }
    },
    [activeTab, renderImageItem, renderVideoItem, renderDocumentItem]
  );

  const renderRow = useCallback(
    (items: FileItem[], rowKey: string) => (
      <View style={innerStyles.row} key={rowKey}>
        {items.map((item) => (
          <TouchableOpacity
            key={`file-${item.id}`}
            style={innerStyles.itemContainer}
            onPress={() => openModal(item)}
            activeOpacity={0.7}
          >
            {renderItem(item)}
          </TouchableOpacity>
        ))}
        {Array.from({ length: NUM_COLUMNS - items.length }).map((_, i) => (
          <View
            key={`placeholder-${rowKey}-${i}`}
            style={innerStyles.placeholderItem}
          />
        ))}
      </View>
    ),
    [openModal, renderItem]
  );

  const renderSectionHeader = useCallback(
    ({ section }: { section: MediaSection }) => (
      <View style={innerStyles.sectionHeader}>
        <Text style={innerStyles.sectionHeaderText}>{section.title}</Text>
      </View>
    ),
    []
  );

  const renderModalContent = useCallback(() => {
    if (!selectedItem) return null;

    if (activeTab === "video" && !isModalReady) {
      return <ActivityIndicator size="large" color="#fff" />;
    }

    if (activeTab === "image") {
      const isFailed = failedImages.has(selectedItem.stream_url);

      if (isFailed) {
        return (
          <View style={innerStyles.modalBrokenImageContainer}>
            <Image
              source={require("../assets/images/broken-image.png")}
              style={{ width: 200, height: 200 }}
              resizeMode="contain"
            />
          </View>
        );
      }

      return (
        <Image
          source={{ uri: selectedItem.stream_url }}
          style={innerStyles.modalImage}
          resizeMode="contain"
          onError={() => handleImageError(selectedItem.stream_url)}
        />
      );
    }

    if (activeTab === "video") {
      const isLandscape = orientation === 2 || isFullscreen;
      const videoStyles = isLandscape
        ? [
            innerStyles.videoPlayer,
            { width: dimensions.width, height: dimensions.height },
          ]
        : [innerStyles.videoPlayer];

      return (
        <View
          style={[
            innerStyles.modalVideoContainer,
            isLandscape && {
              width: dimensions.width,
              height: dimensions.height,
            },
          ]}
        >
          {videoUrl && (
            <VideoView
              style={videoStyles}
              player={videoPlayer}
              allowsFullscreen
              allowsPictureInPicture
            />
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
  }, [
    selectedItem,
    activeTab,
    isModalReady,
    failedImages,
    orientation,
    isFullscreen,
    dimensions,
    videoUrl,
    videoPlayer,
    handleImageError,
  ]);

  const renderFooter = useCallback(
    () => (
      <View
        style={[
          innerStyles.loaderFooter,
          { paddingBottom: insets.bottom + 20 },
        ]}
      >
        {isLoadingMore && (
          <ActivityIndicator size="large" color={color.primary} />
        )}
      </View>
    ),
    [isLoadingMore, insets.bottom]
  );

  const renderEmptyComponent = useCallback(
    () => (
      <View style={innerStyles.emptyContainer}>
        <Text style={innerStyles.emptyText}>No {activeTab} files found.</Text>
      </View>
    ),
    [activeTab]
  );

  // Loading state
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

  // Error state
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

  const isLandscapeModal =
    activeTab === "video" && (orientation === 2 || isFullscreen);

  return (
    <View style={styles.screenContainer}>
      <Header />
      <GestureHandlerRootView style={{ flex: 1 }}>
        {/* Tabs */}
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

        {/* Content with swipe gestures */}
        <View style={{ flex: 1 }}>
          <GestureDetector gesture={panGesture}>
            <View style={{ flex: 1 }}>
              <SectionList
                sections={groupedMedia}
                keyExtractor={(items, sectionIndex) =>
                  `section-${sectionIndex}-${items
                    .map((item) => item.id)
                    .join("-")}`
                }
                renderItem={({ item, index, section }) =>
                  renderRow(item, `row-${section.title}-${index}`)
                }
                renderSectionHeader={renderSectionHeader}
                stickySectionHeadersEnabled={false}
                contentContainerStyle={
                  paginatedFiles.length === 0
                    ? { flex: 1, justifyContent: "center" }
                    : { paddingBottom: insets.bottom }
                }
                ListEmptyComponent={renderEmptyComponent}
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
            </View>
          </GestureDetector>
        </View>

        {/* Modal */}
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
              isLandscapeModal && innerStyles.fullscreenModalContainer,
            ]}
          >
            <StatusBar
              backgroundColor="#000"
              barStyle="light-content"
              translucent
            />

            <TouchableOpacity
              style={[innerStyles.closeButton, isLandscapeModal && { top: 20 }]}
              onPress={closeModal}
              hitSlop={{ top: 20, bottom: 20, left: 20, right: 20 }}
            >
              <Text style={innerStyles.closeButtonText}>×</Text>
            </TouchableOpacity>

            {activeTab === "video" && (
              <TouchableOpacity
                style={[
                  innerStyles.fullscreenButton,
                  isLandscapeModal && { top: 20, right: 70 },
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
                isLandscapeModal && { padding: 0 },
              ]}
            >
              {renderModalContent()}
            </View>

            {selectedItem && !isLandscapeModal && (
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
      </GestureHandlerRootView>
    </View>
  );
};

// Styles remain the same
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
  image: {
    width: "100%",
    height: "100%",
  },
  documentPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 10,
  },
  documentIcon: {
    width: 60,
    height: 60,
    marginBottom: 5,
  },
  documentText: {
    color: "#444",
    textAlign: "center",
    padding: 4,
    fontWeight: "bold",
  },
  documentName: {
    color: "#333",
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
