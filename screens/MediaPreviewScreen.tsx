import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  FlatList,
  Image,
  ActivityIndicator,
  StyleSheet,
  Dimensions,
  Modal,
  TouchableOpacity,
  SafeAreaView,
  StatusBar,
} from "react-native";
import Video from "react-native-video";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamList } from "../types";
import styles from "../Constants/styles";
import Header from "../components/Common/Header";

const { width, height } = Dimensions.get("window");
const ITEM_MARGIN = 2;
const NUM_COLUMNS = 2;
const ITEM_SIZE = (width - ITEM_MARGIN * (NUM_COLUMNS + 1)) / NUM_COLUMNS;

interface MediaFile {
  id: string;
  date_created: string;
  file_category: string;
  stream_url: string;
  path: string;
  file_name: string;
}

type Props = NativeStackScreenProps<RootStackParamList, "MediaPreviewScreen">;

const MediaPreviewScreen: React.FC<Props> = ({ route }) => {
  const { jobId, fileCategory } = route.params;
  const [allMedia, setAllMedia] = useState<MediaFile[]>([]);
  const [mediaFiles, setMediaFiles] = useState<MediaFile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Modal state
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedItem, setSelectedItem] = useState<MediaFile | null>(null);

  // Video player reference for modal
  const videoRef = useRef(null);
  const [isPaused, setIsPaused] = useState(false);

  // Active tab state
  const [activeTab, setActiveTab] = useState<string>(fileCategory);

  // Map the fileCategory string to the numeric category used in the API
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

  // Load media from API
  useEffect(() => {
    const loadMedia = async () => {
      try {
        const userDataRaw = await AsyncStorage.getItem("userData");
        const propRaw = await AsyncStorage.getItem("selectedProperty");

        if (!userDataRaw || !propRaw) {
          setError("Missing user or property data");
          return;
        }

        const userData = JSON.parse(userDataRaw);
        const property = JSON.parse(propRaw);
        const userId = userData.payload?.userid || userData.userid;
        const propertyId = property.id;

        const url =
          `http://192.168.18.130:8000/api/mapp/get-files.php` +
          `?userid=${userId}&property_id=${propertyId}&job_id=${jobId}`;

        const res = await fetch(url);
        const contentType = res.headers.get("content-type");

        if (!contentType?.includes("application/json")) {
          throw new Error("Server returned non-JSON response");
        }

        const json = await res.json();
        if (json.status !== 1 || !Array.isArray(json.payload)) {
          throw new Error("Invalid API response");
        }

        setAllMedia(json.payload);
      } catch (e: any) {
        console.error("[MediaPreview] Error in loadMedia():", e);
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    loadMedia();
  }, [jobId]);

  // Filter media based on activeTab
  useEffect(() => {
    const categoryNumber = getFileCategoryNumber(activeTab);
    const filtered = allMedia.filter(
      (item) => item.file_category === categoryNumber
    );
    setMediaFiles(filtered);
  }, [activeTab, allMedia]);

  // Handle opening modal with selected item
  const openModal = (item: MediaFile) => {
    setSelectedItem(item);
    setModalVisible(true);
    setIsPaused(false);
  };

  // Handle closing modal
  const closeModal = () => {
    if (activeTab === "video" && videoRef.current) {
      setIsPaused(true);
    }
    setModalVisible(false);
  };

  // Video placeholder
  const VideoThumbnail = ({ uri }: { uri: string }) => (
    <View style={innerStyles.videoPlaceholder}>
      <View style={innerStyles.playButton}>
        <Text style={innerStyles.playButtonText}>▶</Text>
      </View>
      <Text style={innerStyles.videoText}>Video</Text>
    </View>
  );

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
        <VideoThumbnail uri={item.stream_url} />
      ) : (
        <View style={innerStyles.documentPlaceholder}>
          <Text style={innerStyles.documentText}>Document</Text>
          <Text style={innerStyles.documentName}>
            {item.file_name.length > 20
              ? item.file_name.substring(0, 18) + "..."
              : item.file_name}
          </Text>
        </View>
      )}
    </TouchableOpacity>
  );

  const renderModalContent = () => {
    if (!selectedItem) return null;
    return activeTab === "image" ? (
      <Image
        source={{ uri: selectedItem.stream_url }}
        style={innerStyles.modalImage}
        resizeMode="contain"
      />
    ) : activeTab === "video" ? (
      <View style={innerStyles.modalVideoContainer}>
        <Video
          ref={videoRef}
          source={{ uri: selectedItem.stream_url }}
          style={innerStyles.videoPlayer}
          resizeMode="contain"
          paused={isPaused}
          controls
        />
        <TouchableOpacity
          style={innerStyles.playPauseButton}
          onPress={() => setIsPaused(!isPaused)}
        >
          <Text style={innerStyles.playPauseButtonText}>
            {isPaused ? "▶" : "II"}
          </Text>
        </TouchableOpacity>
      </View>
    ) : (
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
        </View>
      </View>
    );
  }

  // Tab labels
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
          ListEmptyComponent={() => (
            <View style={innerStyles.center}>
              <Text>No {activeTab} files found.</Text>
            </View>
          )}
        />

        <Modal
          visible={modalVisible}
          transparent
          animationType="fade"
          onRequestClose={closeModal}
        >
          <SafeAreaView style={innerStyles.modalContainer}>
            <StatusBar backgroundColor="#000000" barStyle="light-content" />
            <TouchableOpacity
              style={innerStyles.closeButton}
              onPress={closeModal}
            >
              <Text style={innerStyles.closeButtonText}>×</Text>
            </TouchableOpacity>
            <View style={innerStyles.modalContent}>{renderModalContent()}</View>
            {selectedItem && (
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
    width: 200,
    height: 200,
    borderRadius: 8,
    backgroundColor: "#fff",
    overflow: "hidden",
    elevation: 2,
  },
  image: {
    width: "100%",
    height: "100%",
  },
  videoPlaceholder: {
    width: "100%",
    height: "100%",
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#0077B6",
  },
  playButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.3)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 10,
  },
  playButtonText: {
    color: "#fff",
    fontSize: 20,
    marginLeft: 3,
  },
  videoText: {
    color: "#fff",
    textAlign: "center",
    padding: 4,
    fontWeight: "bold",
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
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  errorText: { color: "red", padding: 16, textAlign: "center" },
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.9)",
    justifyContent: "center",
  },
  modalContent: { flex: 1, justifyContent: "center", alignItems: "center" },
  modalImage: {
    width: width,
    height: height * 0.7,
    maxHeight: height - 150,
  },
  videoPlayer: {
    width: width,
    height: width * (9 / 16), // 16:9 aspect ratio
    backgroundColor: "#000",
  },
  modalVideoContainer: {
    width: width,
    height: width * (9 / 16), // 16:9 aspect ratio for the container
    justifyContent: "center",
    alignItems: "center",
  },
  playPauseButton: {
    position: "absolute",
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  playPauseButtonText: {
    color: "#fff",
    fontSize: 24,
  },
  modalVideoText: {
    color: "#fff",
    fontSize: 18,
    fontWeight: "bold",
  },
  modalDocContainer: {
    width: width * 0.8,
    height: height * 0.6,
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
    zIndex: 2,
  },
  closeButtonText: {
    color: "#fff",
    fontSize: 24,
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
