import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { ResizeMode, Video } from "expo-av";
import * as Camera from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal, Snackbar } from "react-native-paper";
import { Header, ProgressBar, UploadStatusModal } from "../components";
import { BASE_API_URL } from "../Constants/env";
import { default as style, default as styles } from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { getFileId } from "../helper";
import { UploadScreenProps } from "../types";

const screenWidth = Dimensions.get("window").width;
const imageSize = screenWidth / 2 - 40;

type MediaFile = {
  uri: string;
  type: "image" | "video" | "document";
  name: string;
  mimeType: string;
  size?: number;
};

// Helper function to limit concurrency of async tasks
const uploadQueue = async (tasks: (() => Promise<any>)[], limit: number) => {
  const results: any[] = [];
  const executing: Promise<any>[] = [];
  for (const task of tasks) {
    const p = task().then((result) => {
      executing.splice(executing.indexOf(p), 1);
      return result;
    });
    results.push(p);
    executing.push(p);
    if (executing.length >= limit) {
      await Promise.race(executing);
    }
  }
  return Promise.all(results);
};

const UploadScreen: React.FC<UploadScreenProps> = ({ route, navigation }) => {
  const { category = {}, subCategory = {} } = route.params || {};
  const [media, setMedia] = useState<MediaFile[]>([]);
  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [micPermission, requestMicPermission] =
    Camera.useMicrophonePermissions();
  const [storedProperty, setStoredProperty] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: string;
  }>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [jobData, setJobData] = useState<any>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [successCount, setSuccessCount] = useState(0);
  const [failedCount, setFailedCount] = useState(0);

  // Helper function to infer mimeType from file name (for documents)
  const inferMimeType = (fileName: string) => {
    const ext = fileName.split(".").pop()?.toLowerCase();
    switch (ext) {
      case "pdf":
        return "application/pdf";
      case "doc":
        return "application/msword";
      case "docx":
        return "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
      case "xls":
        return "application/vnd.ms-excel";
      case "xlsx":
        return "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      default:
        return "application/octet-stream";
    }
  };

  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUserData = await AsyncStorage.getItem("userData");
        if (storedUserData) {
          const parsedUserData = JSON.parse(storedUserData);
          setUserData(parsedUserData);
          console.log("User Data:", parsedUserData);
        }
      } catch (error) {
        // console.error("Error fetching user data:", error);
      }
    };
    fetchUserData();
  }, []);

  useEffect(() => {
    const fetchStoredProperty = async () => {
      try {
        const storedPropertyString = await AsyncStorage.getItem(
          "selectedProperty"
        );
        if (storedPropertyString) {
          const parsedProperty = JSON.parse(storedPropertyString);
          setStoredProperty(parsedProperty);
        }
      } catch (error) {
        // console.error("Error fetching stored property:", error);
      }
    };
    fetchStoredProperty();
  }, []);

  useEffect(() => {
    const fetchJobData = async () => {
      try {
        const storedJob = await AsyncStorage.getItem("jobData");
        if (storedJob) {
          try {
            const parsedJob = JSON.parse(storedJob);
            setJobData(parsedJob);
          } catch (parseError) {
            // console.error("Error parsing job data:", parseError);
          }
        } else {
          console.log("No job data found in AsyncStorage");
        }
      } catch (error) {
        // console.error("Error retrieving job data", error);
      }
    };
    fetchJobData();
  }, []);

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  // Permission check functions
  const checkCameraPermission = async () => {
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== "granted") {
        showAlert("Permission Required", "Camera permission is required!");
        return false;
      }
    }
    return true;
  };

  const checkMicPermission = async () => {
    if (!micPermission?.granted) {
      const { status } = await requestMicPermission();
      if (status !== "granted") {
        showAlert(
          "Permission Required",
          "Microphone permission is required for video recording!"
        );
        return false;
      }
    }
    return true;
  };

  // Pick images or videos from the gallery
  // Replace the pickImage function with this updated version:
  const pickImage = async () => {
    setLoadingMedia(true);
    try {
      navigation.setParams({ isPickingImage: true });
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images", "videos"],
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled) {
        const newFiles: MediaFile[] = result.assets.map((asset) => {
          const fileType = asset.type === "video" ? "video" : "image";
          const name = asset.uri.split("/").pop() || `file_${Date.now()}`;
          let mimeType = "";
          if (fileType === "image") {
            mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";
          } else if (fileType === "video") {
            mimeType = name.endsWith(".mp4") ? "video/mp4" : "video/mp4";
          }
          return { uri: asset.uri, type: fileType, name, mimeType };
        });
        setMedia([...media, ...newFiles]);
      }
    } catch (error) {
      showAlert("Error", "Failed to pick media. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

  const recordVideo = async () => {
    setLoadingMedia(true);
    try {
      const hasCameraPermission = await checkCameraPermission();
      const hasMicPermission = await checkMicPermission();
      if (!hasCameraPermission || !hasMicPermission) {
        setLoadingMedia(false);
        return;
      }
      navigation.setParams({ isPickingImage: true });
      const result = await ImagePicker.launchCameraAsync({
        mediaTypes: ["videos"],
        allowsEditing: false,
        quality: 1,
        videoMaxDuration: 60,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const name = asset.uri.split("/").pop() || `video_${Date.now()}.mp4`;
        const mimeType = "video/mp4";
        setMedia([...media, { uri: asset.uri, type: "video", name, mimeType }]);
      }
    } catch (error) {
      showAlert("Error", "Failed to record video. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

  // Take a photo
  const takePhoto = async () => {
    setLoadingMedia(true);
    try {
      const hasCameraPermission = await checkCameraPermission();
      if (!hasCameraPermission) {
        setLoadingMedia(false);
        return;
      }
      navigation.setParams({ isPickingImage: true });
      const result = await ImagePicker.launchCameraAsync({
        allowsEditing: false,
        quality: 1,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const asset = result.assets[0];
        const name = asset.uri.split("/").pop() || `photo_${Date.now()}.jpg`;
        const mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";
        setMedia([...media, { uri: asset.uri, type: "image", name, mimeType }]);
      }
    } catch (error) {
      showAlert("Error", "Failed to take photo. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

  // Pick a document
  const pickDocument = async () => {
    setLoadingMedia(true);
    try {
      navigation.setParams({ isPickingImage: true });
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
      });
      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const name = doc.name;
        const mimeType = doc.mimeType || inferMimeType(name);
        const newFile: MediaFile = {
          uri: doc.uri,
          type: "document",
          name,
          mimeType,
          size: doc.size,
        };
        setMedia((prev) => [...prev, newFile]);
      }
    } catch (error) {
      showAlert("Error", "Failed to pick a document. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

  const removeFile = (index: number) => {
    const updatedMedia = [...media];
    updatedMedia.splice(index, 1);
    setMedia(updatedMedia);
  };

  const getFileHeader = async (
    uri: string,
    mimeType: string
  ): Promise<string> => {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      return `data:${mimeType};base64,${base64Data.slice(0, 50)}...`;
    } catch (error) {
      // console.error("Error reading file as base64:", error);
      return "";
    }
  };

  const openFile = (file: MediaFile) => {
    setSelectedFile(file);
    setModalVisible(true);
  };

  const getFileSize = async (uri: string): Promise<number | null> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });
      if (!fileInfo.exists) {
        // console.error("File does not exist:", uri);
        return null;
      }
      return fileInfo.size;
    } catch (error) {
      // console.error("Error getting file size:", error);
      return null;
    }
  };

  const uploadImages = async () => {
    if (media.length === 0) {
      showAlert("Error", "Please select at least one file to upload.");
      return;
    }

    setUploading(true);
    setUploadedCount(0);
    setSuccessCount(0);
    setFailedCount(0);

    const fileId = getFileId();
    const totalFiles = media.length;
    const newUploadProgress = { ...uploadProgress };

    const tasks = media.map((file, index) => async () => {
      const fileSize = file.size ? file.size : await getFileSize(file.uri);
      if (fileSize === null) return;
      const formData = new FormData();
      const fileName =
        file.name || file.uri.split("/").pop() || `file_${index}`;
      const fileType = file.mimeType;
      const fileHeaderValue = await getFileHeader(file.uri, file.mimeType);
      const propertyId = storedProperty ? storedProperty.id : "";
      const jobId =
        route.params?.source === "CategoryScreen"
          ? ""
          : jobData
          ? jobData.id
          : "";
      const userName = userData?.payload?.name || "";
      formData.append("id", fileId || "");
      formData.append("total_segments", totalFiles.toString());
      formData.append("segment_number", (index + 1).toString());
      formData.append("main_category", category?.id?.toString() || "");
      formData.append("category_level_1", subCategory?.id?.toString() || "");
      formData.append("property_id", propertyId);
      formData.append("job_id", jobId);
      formData.append("file_header", fileHeaderValue);
      formData.append("file_name", fileName);
      formData.append("file_type", fileType);
      formData.append("file_size", fileSize.toString());
      formData.append("user_name", userName);
      formData.append("content", {
        uri: file.uri,
        type: fileType,
        name: fileName,
      } as any);
      try {
        const response = await axios.post(
          `${BASE_API_URL}/media-uploader.php`,
          formData,
          {
            headers: { "Content-Type": "multipart/form-data" },
            onUploadProgress: (progressEvent) => {
              if (progressEvent.total) {
                const percentCompleted = Math.round(
                  (progressEvent.loaded * 100) / progressEvent.total
                );
                newUploadProgress[file.uri] = `${percentCompleted}%`;
                setUploadProgress({ ...newUploadProgress });
              }
            },
          }
        );

        newUploadProgress[file.uri] = "Complete";
        setUploadProgress({ ...newUploadProgress });
        setUploadedCount((prevCount) => prevCount + 1);
        setSuccessCount((prevCount) => prevCount + 1);
        return response.data;
      } catch (error) {
        // console.error(`Error uploading file ${index + 1}:`, error);
        newUploadProgress[file.uri] = "Failed";
        setUploadProgress({ ...newUploadProgress });
        setFailedCount((prevCount) => prevCount + 1);
        throw error;
      }
    });

    try {
      await uploadQueue(tasks, 3);
      setStatusModalVisible(true);
      setMedia([]);
    } catch (error) {
      // console.error("Error uploading files:", error);
      setStatusModalVisible(true);
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={style.container}>
        <View style={style.headingContainer}>
          <Text style={style.heading}>Upload Files</Text>
        </View>
        {storedProperty && (
          <View style={styles.screenBanner}>
            <Text style={styles.bannerLabel}>Selected Property:</Text>
            <Text style={styles.bannerText}>{storedProperty.address}</Text>
            <Text style={styles.extraSmallText}>{storedProperty.company}</Text>
          </View>
        )}
        <Text style={style.subHeading}>
          {category?.category}
          {subCategory ? ` - ${subCategory.sub_category}` : ""}
        </Text>
        <Text style={style.subHeading}>Choose File From</Text>
        <View
          style={{
            flexDirection: "row",
            marginHorizontal: 10,
            marginVertical: 10,
          }}
        >
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.orange, marginHorizontal: 5 },
            ]}
            onPress={pickImage}
            disabled={uploading}
          >
            <Entypo name="images" size={24} color="white" />
            <Text style={internalStyle.actionButtonLabel}>Gallery</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.primary, marginHorizontal: 5 },
            ]}
            onPress={takePhoto}
            disabled={uploading}
          >
            <Feather name="camera" size={24} color="white" />
            <Text style={internalStyle.actionButtonLabel}>Take Photo</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.secondary, marginHorizontal: 5 },
            ]}
            onPress={recordVideo}
            disabled={uploading}
          >
            <MaterialIcons name="videocam" size={24} color="white" />
            <Text style={internalStyle.actionButtonLabel}>Record Video</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.lightGreen, marginHorizontal: 5 },
            ]}
            onPress={pickDocument}
            disabled={uploading}
          >
            <Feather name="file-text" size={24} color="white" />
            <Text style={internalStyle.actionButtonLabel}>Document</Text>
          </TouchableOpacity>
        </View>
        {loadingMedia && (
          <View style={internalStyle.loadingOverlay}>
            <ActivityIndicator size="large" color={color.primary} />
          </View>
        )}
        {uploading && (
          <ProgressBar
            progress={Math.round((uploadedCount / media.length) * 100)}
            uploadedCount={uploadedCount}
            totalCount={media.length}
          />
        )}
        <FlatList
          data={media}
          keyExtractor={(_, index) => index.toString()}
          numColumns={2}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => openFile(item)}>
              <View style={internalStyle.imageContainer}>
                {item.type === "image" ? (
                  <Image
                    source={{ uri: item.uri }}
                    style={internalStyle.image}
                  />
                ) : item.type === "video" ? (
                  <View style={internalStyle.videoPlaceholder}>
                    <Feather name="video" size={imageSize * 0.5} color="gray" />
                  </View>
                ) : (
                  <View style={internalStyle.documentPlaceholder}>
                    <Feather
                      name="file-text"
                      size={imageSize * 0.5}
                      color="gray"
                    />
                  </View>
                )}
                {uploadProgress[item.uri] && (
                  <View style={internalStyle.progressOverlay}>
                    <Text style={internalStyle.progressText}>
                      {uploadProgress[item.uri]}
                    </Text>
                  </View>
                )}
                {!uploading && (
                  <TouchableOpacity
                    style={internalStyle.removeButton}
                    onPress={() => removeFile(index)}
                  >
                    <AntDesign name="closecircle" size={24} color="red" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={internalStyle.grid}
        />
        {media.length > 0 && (
          <TouchableOpacity
            style={[
              style.primaryButton,
              uploading && { backgroundColor: color.gray },
            ]}
            onPress={uploadImages}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={style.buttonText}>
                Upload {media.length} File{media.length > 1 ? "s" : ""}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <Modal visible={modalVisible} transparent={true} animationType="slide">
          <View style={style.modalContainer}>
            <View style={internalStyle.modalView}>
              <TouchableOpacity
                style={style.modalButtonClose}
                onPress={() => setModalVisible(false)}
              >
                <AntDesign name="close" size={30} color="white" />
              </TouchableOpacity>
              {selectedFile && selectedFile.type === "image" && (
                <Image
                  source={{ uri: selectedFile.uri }}
                  style={internalStyle.fullImage}
                />
              )}
              {selectedFile && selectedFile.type === "video" && (
                <Video
                  source={{ uri: selectedFile.uri }}
                  style={internalStyle.fullImage}
                  useNativeControls
                  resizeMode={ResizeMode.CONTAIN}
                  isLooping
                />
              )}
              {selectedFile && selectedFile.type === "document" && (
                <View style={internalStyle.documentPreview}>
                  <Feather name="file-text" size={80} color="gray" />
                  <Text style={{ color: "white", marginTop: 10 }}>
                    No preview available
                  </Text>
                </View>
              )}
              <FlatList
                data={media}
                horizontal
                keyExtractor={(_, index) => index.toString()}
                renderItem={({ item }) => (
                  <TouchableOpacity onPress={() => setSelectedFile(item)}>
                    {item.type === "image" ? (
                      <Image
                        source={{ uri: item.uri }}
                        style={[
                          internalStyle.thumbnail,
                          selectedFile?.uri === item.uri &&
                            internalStyle.selectedThumbnail,
                        ]}
                      />
                    ) : item.type === "video" ? (
                      <View
                        style={[
                          internalStyle.thumbnail,
                          { justifyContent: "center", alignItems: "center" },
                          selectedFile?.uri === item.uri &&
                            internalStyle.selectedThumbnail,
                        ]}
                      >
                        <Feather name="video" size={20} color="gray" />
                      </View>
                    ) : (
                      <View
                        style={[
                          internalStyle.thumbnail,
                          { justifyContent: "center", alignItems: "center" },
                          selectedFile?.uri === item.uri &&
                            internalStyle.selectedThumbnail,
                        ]}
                      >
                        <Feather name="file-text" size={20} color="gray" />
                      </View>
                    )}
                  </TouchableOpacity>
                )}
                contentContainerStyle={internalStyle.thumbnailContainer}
              />
            </View>
          </View>
        </Modal>
        <Portal>
          <Dialog
            visible={alertVisible}
            onDismiss={() => setAlertVisible(false)}
          >
            <Dialog.Title>{alertTitle}</Dialog.Title>
            <Dialog.Content>
              <Text>{alertMessage}</Text>
            </Dialog.Content>
            <Dialog.Actions>
              <Button onPress={() => setAlertVisible(false)}>OK</Button>
            </Dialog.Actions>
          </Dialog>
        </Portal>
        <Snackbar
          visible={snackbarVisible}
          onDismiss={() => setSnackbarVisible(false)}
          duration={4000}
          action={{
            label: "OK",
            onPress: () => setSnackbarVisible(false),
          }}
        >
          {snackbarMessage}
        </Snackbar>
      </View>
      <UploadStatusModal
        visible={statusModalVisible}
        onClose={() => setStatusModalVisible(false)}
        successCount={successCount}
        failedCount={failedCount}
        totalCount={successCount + failedCount}
      />
    </View>
  );
};

const internalStyle = StyleSheet.create({
  modalView: {
    alignItems: "center",
    width: "100%",
    position: "relative",
  },
  actionButton: {
    flex: 1, // Equal width for all buttons
    height: 80,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonLabel: {
    marginTop: 4,
    fontSize: 12, // Smaller font size to fit
    color: color.white,
    textAlign: "center",
  },
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(255,255,255,0.7)",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 10,
  },
  grid: {
    marginTop: 20,
    paddingBottom: 80,
    alignItems: "center",
  },
  imageContainer: {
    position: "relative",
    margin: 5,
  },
  image: {
    width: imageSize,
    height: imageSize,
    borderRadius: 10,
  },
  videoPlaceholder: {
    width: imageSize,
    height: imageSize,
    borderRadius: 10,
    backgroundColor: "#eee",
    justifyContent: "center",
    alignItems: "center",
  },
  documentPlaceholder: {
    width: imageSize,
    height: imageSize,
    borderRadius: 10,
    backgroundColor: "#f5f5f5",
    justifyContent: "center",
    alignItems: "center",
  },
  removeButton: {
    position: "absolute",
    top: 5,
    right: 5,
    backgroundColor: color.secondary,
    borderRadius: 12,
    padding: 2,
  },
  progressOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: "rgba(0, 0, 0, 0.5)",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 10,
  },
  progressText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "bold",
  },
  fullImage: {
    width: "90%",
    height: "70%",
    borderRadius: 10,
    resizeMode: "contain",
  },
  documentPreview: {
    width: "90%",
    height: "70%",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailContainer: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "center",
  },
  selectedThumbnail: {
    borderColor: color.primary,
  },
  thumbnail: {
    width: 60,
    height: 60,
    borderRadius: 8,
    marginHorizontal: 5,
    borderWidth: 2,
    borderColor: "white",
  },
});

export default UploadScreen;
