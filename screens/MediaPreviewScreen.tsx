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
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useDispatch, useSelector } from "react-redux";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { Header, VideoThumbnail } from "../components";
import SkeletonLoader from "../components/SkeletonLoader";
import { formatDate } from "../helper";
import {
  loadFiles,
  selectFiles,
  selectFilesError,
  selectFilesLoading,
} from "../store/filesSlice";
import { FileItem, RootStackParamList } from "../types";

// Constants
const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const CONTAINER_PADDING = 12;
const ITEM_SPACING = 4;
const MIN_ITEM_WIDTH = 80;
const PAGE_SIZE = 30;

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

const createFileRows = (
  files: FileItem[],
  numColumns: number
): FileItem[][] => {
  const rows: FileItem[][] = [];
  for (let i = 0; i < files.length; i += numColumns) {
    rows.push(files.slice(i, i + numColumns));
  }
  return rows;
};

const groupFilesByDate = (
  files: FileItem[],
  numColumns: number
): MediaSection[] => {
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
    data: createFileRows(groupedByDate[dateStr], numColumns),
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
  const [, setSwipeIndicator] = useState({ visible: false, direction: "" });

  // Animation shared values
  const scale = useSharedValue(1);
  const savedScale = useSharedValue(1);
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const lastTranslateX = useSharedValue(0);
  const lastTranslateY = useSharedValue(0);

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

  // Dynamic grid calculations
  const availableWidth = dimensions.width - 2 * CONTAINER_PADDING;
  const numColumns = useMemo(() => {
    let N = 5;
    while (N >= 1) {
      const itemWidth = (availableWidth - (N - 1) * ITEM_SPACING) / N;
      if (itemWidth >= MIN_ITEM_WIDTH || N === 1) return N;
      N--;
    }
    return 1;
  }, [availableWidth]);
  const itemWidth = useMemo(
    () => (availableWidth - (numColumns - 1) * ITEM_SPACING) / numColumns,
    [availableWidth, numColumns]
  );

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
      const jobIdStr = String(jobId);
      const jobFiles = allFiles.filter(
        (item) => String(item.job_id) === jobIdStr
      );
      return jobFiles.filter((item) => item.file_category === categoryNumber);
    }
    return [];
  }, [activeTab, allFiles, jobId, filesFromRoute]);

  const paginatedFiles = useMemo(
    () => allFilteredFiles.slice(0, currentPage * PAGE_SIZE),
    [allFilteredFiles, currentPage]
  );
  const groupedMedia = useMemo(
    () => groupFilesByDate(paginatedFiles, numColumns),
    [paginatedFiles, numColumns]
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
      // Reset zoom values when modal closes
      scale.value = 1;
      savedScale.value = 1;
      translateX.value = 0;
      translateY.value = 0;
      lastTranslateX.value = 0;
      lastTranslateY.value = 0;
      if (orientation !== 1)
        ScreenOrientation.lockAsync(
          ScreenOrientation.OrientationLock.PORTRAIT_UP
        ).catch(() => {});
    }
    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [
    modalVisible,
    orientation,
    scale,
    savedScale,
    translateX,
    translateY,
    lastTranslateX,
    lastTranslateY,
  ]);

  // Gesture
  const panGesture = useMemo(
    () =>
      Gesture.Pan()
        .runOnJS(true)
        .activeOffsetX([-20, 20])
        .failOffsetY([-5, 5])
        .onEnd((event) => {
          try {
            if (!enableTabSwipe) return;
            const SWIPE_THRESHOLD = 50;
            const { translationX } = event;
            const currentIndex = tabs.findIndex((tab) => tab.key === activeTab);
            if (translationX > SWIPE_THRESHOLD && currentIndex > 0) {
              setActiveTab(tabs[currentIndex - 1].key);
              setSwipeIndicator({ visible: true, direction: "right" });
              setTimeout(
                () => setSwipeIndicator({ visible: false, direction: "" }),
                500
              );
            } else if (
              translationX < -SWIPE_THRESHOLD &&
              currentIndex < tabs.length - 1
            ) {
              setActiveTab(tabs[currentIndex + 1].key);
              setSwipeIndicator({ visible: true, direction: "left" });
              setTimeout(
                () => setSwipeIndicator({ visible: false, direction: "" }),
                500
              );
            }
          } catch (error) {}
        })
        .simultaneousWithExternalGesture(Gesture.Tap(), Gesture.LongPress()),
    [activeTab, enableTabSwipe, tabs]
  );

  // Create image zoom and pan gestures
  const pinchGesture = Gesture.Pinch()
    .onUpdate((event) => {
      scale.value = savedScale.value * event.scale;
    })
    .onEnd(() => {
      savedScale.value = scale.value;
      if (scale.value < 1) {
        scale.value = withTiming(1);
        savedScale.value = 1;
        translateX.value = withTiming(0);
        translateY.value = withTiming(0);
        lastTranslateX.value = 0;
        lastTranslateY.value = 0;
      }
    });

  const panGestureImage = Gesture.Pan()
    .onUpdate((event) => {
      if (scale.value > 1) {
        translateX.value = lastTranslateX.value + event.translationX;
        translateY.value = lastTranslateY.value + event.translationY;
      }
    })
    .onEnd(() => {
      lastTranslateX.value = translateX.value;
      lastTranslateY.value = translateY.value;
    });

  const combinedGesture = Gesture.Simultaneous(pinchGesture, panGestureImage);

  // Create animated style for image transforms
  const imageAnimatedStyle = useAnimatedStyle(() => {
    return {
      transform: [
        { translateX: translateX.value },
        { translateY: translateY.value },
        { scale: scale.value },
      ],
    };
  });

  // Handlers
  const loadJobFiles = useCallback(async () => {
    try {
      const { id: propertyId } = await getProperty();
      await dispatch(loadFiles({ propertyId }) as any);
    } catch (e: any) {
      setError(e.message);
    }
  }, [dispatch, getProperty]);

  const loadMoreData = useCallback(() => {
    if (isLoadingMore) return;
    setIsLoadingMore(true);
    setTimeout(() => {
      setCurrentPage((prev) => prev + 1);
      setIsLoadingMore(false);
    }, 300);
  }, [isLoadingMore]);

  const onRefresh = useCallback(async () => {
    setIsRefreshing(true);
    setError(null);
    if (filesFromRoute) {
      setTimeout(() => {
        setCurrentPage(1);
        setIsRefreshing(false);
      }, 800);
      return;
    }
    try {
      await loadJobFiles();
    } catch (e) {
      console.error("Refresh failed:", e);
    } finally {
      setTimeout(() => setIsRefreshing(false), 800);
    }
  }, [filesFromRoute, loadJobFiles]);

  const handleOpenDocument = useCallback(async (url: string) => {
    try {
      await Linking.openURL(url);
    } catch (error) {
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
    if (videoPlayer && videoUrl) videoPlayer.pause();
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

  useEffect(() => {
    if (!filesFromRoute) loadJobFiles();
  }, [filesFromRoute, loadJobFiles]);
  useEffect(() => {
    if (!filesFromRoute && jobId) loadJobFiles();
  }, [filesFromRoute, loadJobFiles, jobId]);

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
    let IconComponent = MaterialCommunityIcons;
    let iconName: keyof typeof MaterialCommunityIcons.glyphMap =
      "file-document-outline";
    let iconColor = "#2C7DA0";
    switch (docType) {
      case "pdf":
        iconName = "file-pdf-box";
        iconColor = "#F40F02";
        break;
      case "word":
        iconName = "file-word-box";
        iconColor = "#295496";
        break;
      case "excel":
        iconName = "file-excel-box";
        iconColor = "#1D6F42";
        break;
      case "powerpoint":
        iconName = "file-powerpoint-box";
        iconColor = "#D24625";
        break;
      case "text":
        iconName = "file-document-outline";
        iconColor = "#424242";
        break;
      default:
        iconName = "file-outline";
        iconColor = "#607D8B";
    }
    return (
      <View style={innerStyles.documentPlaceholder}>
        <IconComponent name={iconName} size={fontSize.xl} color={iconColor} />
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
    if (activeTab === "video" && !isModalReady)
      return <ActivityIndicator size="large" color="#fff" />;
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
        <GestureDetector gesture={combinedGesture}>
          <Animated.View
            style={[innerStyles.zoomableImageContainer, imageAnimatedStyle]}
          >
            <Image
              source={{ uri: selectedItem.stream_url }}
              style={innerStyles.modalImage}
              resizeMode="contain"
              onError={() => handleImageError(selectedItem.stream_url)}
            />
          </Animated.View>
        </GestureDetector>
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
    combinedGesture,
    imageAnimatedStyle,
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
        <View style={styles.container}>
          <View style={innerStyles.tabsContainer}>
            {[1, 2, 3].map((tab) => (
              <View key={`tab-skeleton-${tab}`} style={innerStyles.tabItem}>
                <SkeletonLoader.Line
                  width="60%"
                  height={16}
                  style={{ marginVertical: 8 }}
                />
              </View>
            ))}
          </View>
          <View style={{ flex: 1, paddingHorizontal: CONTAINER_PADDING }}>
            <SkeletonLoader.Line
              width="40%"
              height={20}
              style={{ marginVertical: 10 }}
            />
            <SkeletonLoader.Grid
              columns={numColumns}
              items={15}
              itemHeight={itemWidth}
              style={{ marginTop: 8 }}
            />
          </View>
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
      <GestureHandlerRootView style={styles.container}>
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
        <View style={{ flex: 1, width: "100%" }}>
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
                    progressBackgroundColor="rgba(255, 255, 255, 0.8)"
                    progressViewOffset={10}
                  />
                }
              />
            </View>
          </GestureDetector>
        </View>
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
                  {formatDate(selectedItem.date_created)}
                </Text>
              </View>
            )}
          </SafeAreaView>
        </Modal>
      </GestureHandlerRootView>
    </View>
  );
};

// Styles
const innerStyles = StyleSheet.create({
  tabsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: "#ccc",
  },
  tabItem: { alignItems: "center", paddingVertical: 6, flex: 1 },
  tabText: { fontSize: 16, color: "#444" },
  activeTabText: { fontWeight: "bold", color: "#0077B6" },
  tabUnderline: {
    height: 2,
    backgroundColor: "#0077B6",
    width: "60%",
    marginTop: 4,
  },
  image: { width: "100%", height: "100%" },
  documentPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#f5f5f5",
    padding: 10,
  },
  documentName: {
    color: "#333",
    textAlign: "center",
    fontSize: fontSize.xs,
    marginTop: 5,
  },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyContainer: { flex: 1, justifyContent: "center", alignItems: "center" },
  emptyText: { color: "#666", textAlign: "center", fontSize: 16 },
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
  retryButtonText: { color: "#fff", fontWeight: "bold" },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
  },
  fullscreenModalContainer: { backgroundColor: "#000" },
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
  modalDocText: { color: "#fff", fontSize: 18, fontWeight: "bold" },
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
  closeButtonText: { color: "#fff", fontSize: 24, fontWeight: "bold" },
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
  fullscreenButtonText: { color: "#fff", fontSize: 20, fontWeight: "bold" },
  fileInfoContainer: {
    position: "absolute",
    bottom: 30,
    left: 0,
    right: 0,
    backgroundColor: "rgba(0,0,0,0.5)",
    padding: 15,
    alignItems: "center",
  },
  fileInfoText: { color: "#fff", fontSize: 16, fontWeight: "500" },
  fileInfoDate: { color: "#ccc", fontSize: 12, marginTop: 4 },
  videoThumbnailContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#111",
    justifyContent: "center",
    alignItems: "center",
    position: "relative",
  },
  videoThumbnail: { width: "100%", height: "100%", backgroundColor: "#222" },
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
  sectionHeaderText: { fontSize: 18, fontWeight: "bold", color: "#333" },
  row: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginHorizontal: -ITEM_SPACING / 2,
    marginBottom: ITEM_SPACING,
  },
  itemContainer: {
    flex: 1,
    marginHorizontal: ITEM_SPACING / 2,
    aspectRatio: 1,
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    elevation: 2,
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
  zoomableImageContainer: {
    width: SCREEN_WIDTH,
    height: SCREEN_WIDTH * (4 / 3),
    maxHeight: SCREEN_HEIGHT - 150,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
});

export default MediaPreviewScreen;
