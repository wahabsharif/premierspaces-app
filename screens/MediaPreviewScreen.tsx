import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import {
  AVPlaybackStatus,
  ResizeMode,
  Video,
  VideoFullscreenUpdate,
} from "expo-av";
import * as ScreenOrientation from "expo-screen-orientation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import styles from "../Constants/styles";
import { Header, VideoThumbnail } from "../components";
import { RootStackParamList } from "../types";

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get("window");
const NUM_COLUMNS = 2;

interface MediaFile {
  id: string;
  date_created: string;
  file_category: string;
  stream_url: string;
  path: string;
  file_name: string;
}

type Props = NativeStackScreenProps<RootStackParamList, "MediaPreviewScreen">;

const MediaPreviewScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId, fileCategory } = route.params;
  const [allMedia, setAllMedia] = useState<MediaFile[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaFile | null>(null);
  const [isModalReady, setIsModalReady] = useState(false);
  const videoRef = useRef<Video>(null);
  const [status, setStatus] = useState<AVPlaybackStatus | null>(null);
  const [dimensions, setDimensions] = useState({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
  });
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [orientation, setOrientation] = useState(1); // 1 for portrait, 2 for landscape

  const [activeTab, setActiveTab] = useState<string>(fileCategory || "image");
  const thumbnailCache = useMemo(() => new Map<string, string>(), []);

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

  useEffect(() => {
    const loadMedia = async () => {
      try {
        const userDataRaw = await AsyncStorage.getItem("userData");
        const propRaw = await AsyncStorage.getItem("selectedProperty");
        if (!userDataRaw || !propRaw) {
          setError("Missing user or property data");
          setLoading(false);
          return;
        }
        const userData = JSON.parse(userDataRaw);
        const property = JSON.parse(propRaw);
        const userId = userData.payload?.userid || userData.userid;
        const propertyId = property.id;
        const url = `http://192.168.18.130:8000/api/mapp/get-files.php?userid=${userId}&property_id=${propertyId}&job_id=${jobId}`;
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000);
        const res = await fetch(url, { signal: controller.signal });
        clearTimeout(timeout);
        if (!res.ok) throw new Error(`Server status: ${res.status}`);
        const json = await res.json();
        if (json.status !== 1 || !Array.isArray(json.payload)) {
          throw new Error("Invalid data received");
        }
        setAllMedia(json.payload);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadMedia();
  }, [jobId]);

  useEffect(() => {
    const categoryNumber = getFileCategoryNumber(activeTab);
    setMediaFiles(
      allMedia.filter((item) => item.file_category === categoryNumber)
    );
  }, [activeTab, allMedia]);

  useEffect(() => {
    if (modalVisible) {
      const t = setTimeout(() => setIsModalReady(true), 100);
      return () => clearTimeout(t);
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
  }, [modalVisible]);

  const openModal = async (item: MediaFile) => {
    setSelectedItem(item);
    setModalVisible(true);
    setStatus(null);

    // Allow screen rotation if it's a video
    if (item.file_category === getFileCategoryNumber("video")) {
      await ScreenOrientation.unlockAsync().catch(() => {});
    }
  };

  const closeModal = async () => {
    if (videoRef.current) {
      videoRef.current.pauseAsync().catch(() => {});
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

  const renderItem = ({ item }: { item: MediaFile }) => (
    <TouchableOpacity
      style={innerStyles.itemContainer}
      onPress={() => openModal(item)}
      activeOpacity={0.7}
    >
      {activeTab === "image" ? (
        <Image
          source={{ uri: item.stream_url }}
          style={innerStyles.image}
          resizeMode="cover"
        />
      ) : activeTab === "video" ? (
        <VideoThumbnail
          uri={item.stream_url}
          onPress={() => openModal(item)}
          active
          cache={thumbnailCache}
        />
      ) : (
        <View style={innerStyles.documentPlaceholder}>
          <Text style={innerStyles.documentText}>Document</Text>
          <Text style={innerStyles.documentName} numberOfLines={1}>
            {item.file_name}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderModalContent = () => {
    if (!selectedItem) return null;

    if (activeTab === "video" && !isModalReady) {
      return <ActivityIndicator size="large" color="#fff" />;
    }

    if (activeTab === "image") {
      return (
        <Image
          source={{ uri: selectedItem.stream_url }}
          style={innerStyles.modalImage}
          resizeMode={ResizeMode.CONTAIN}
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
          <Video
            ref={videoRef}
            source={{ uri: selectedItem.stream_url }}
            style={videoStyles}
            useNativeControls={
              !(status && "isPlaying" in status && status.isPlaying)
            } // show controls only when not playing
            resizeMode={ResizeMode.CONTAIN}
            isLooping={false}
            onPlaybackStatusUpdate={(status) => {
              setStatus(status);

              // Auto-rewind when ended
              if (
                status &&
                "didJustFinish" in status &&
                status.didJustFinish &&
                !status.isLooping
              ) {
                videoRef.current?.setPositionAsync(0);
              }
            }}
            onFullscreenUpdate={({ fullscreenUpdate }) => {
              if (
                fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_PRESENT
              ) {
                setIsFullscreen(true);
              } else if (
                fullscreenUpdate === VideoFullscreenUpdate.PLAYER_WILL_DISMISS
              ) {
                setIsFullscreen(false);
              }
            }}
          />
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

  if (loading) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={[styles.container, innerStyles.center]}>
          <ActivityIndicator size="large" color="#0077B6" />
          <Text style={innerStyles.loadingText}>Loading media...</Text>
        </View>
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={[styles.container, innerStyles.center]}>
          <Text style={innerStyles.errorText}>{error}</Text>
          <TouchableOpacity
            style={innerStyles.retryButton}
            onPress={() => {
              setLoading(true);
              setError(null);
            }}
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
      <View style={styles.container}>
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
        <FlatList
          data={mediaFiles}
          keyExtractor={(item) => item.id}
          renderItem={renderItem}
          numColumns={NUM_COLUMNS}
          contentContainerStyle={
            mediaFiles.length === 0
              ? { flex: 1, justifyContent: "center" }
              : undefined
          }
          ListEmptyComponent={() => (
            <View style={innerStyles.emptyContainer}>
              <Text style={innerStyles.emptyText}>
                No {activeTab} files found.
              </Text>
            </View>
          )}
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
    margin: 10,
    width: 160,
    height: 160,
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
});

export default MediaPreviewScreen;
