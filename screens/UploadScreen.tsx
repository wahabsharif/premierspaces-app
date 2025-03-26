import { AntDesign } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { Video, ResizeMode } from "expo-av";
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
import Header from "../components/Common/Header";
import { ProgressBar } from "../components/Common/ProgressBar";
import { baseApiUrl } from "../Constants/env";
import style from "../Constants/styles";
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
  const [storedProperty, setStoredProperty] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: string;
  }>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [jobData, setJobData] = useState<any>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

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
        console.error("Error fetching stored property:", error);
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
            console.error("Error parsing job data:", parseError);
          }
        } else {
          console.log("No job data found in AsyncStorage");
        }
      } catch (error) {
        console.error("Error retrieving job data", error);
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

  // Pick images or videos from the library
  const pickImage = async () => {
    setLoadingMedia(true);
    try {
      navigation.setParams({ isPickingImage: true });
      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        allowsEditing: true,
        quality: 1, // Consider reducing quality to compress images
      });
      if (!result.canceled) {
        const newFiles: MediaFile[] = result.assets.map((asset) => {
          const fileType = asset.type === "video" ? "video" : "image";
          const name = asset.uri.split("/").pop() || `file_${Date.now()}`;
          let mimeType = "";
          if (fileType === "image") {
            mimeType = name.endsWith(".png")
              ? "image/png"
              : name.endsWith(".jpg") || name.endsWith(".jpeg")
              ? "image/jpeg"
              : "image/jpeg";
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

  // Use the camera to take a photo
  const takePhoto = async () => {
    setLoadingMedia(true);
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== "granted") {
        showAlert("Permission Required", "Camera permission is required!");
        setLoadingMedia(false);
        return;
      }
    }
    try {
      navigation.setParams({ isPickingImage: true });
      let result = await ImagePicker.launchCameraAsync({
        allowsEditing: true,
        quality: 1,
      });
      if (!result.canceled) {
        const asset = result.assets[0];
        const name = asset.uri.split("/").pop() || `file_${Date.now()}`;
        const mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";
        setMedia([...media, { uri: asset.uri, type: "image", name, mimeType }]);
      }
    } catch (error) {
      showAlert("Error", "Failed to take a photo. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

  const pickDocument = async () => {
    setLoadingMedia(true);
    try {
      navigation.setParams({ isPickingImage: true });
      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
      });
      console.log("DocumentPicker result:", result);
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
      } else {
        console.log(
          "Document picker was cancelled or returned an unexpected result"
        );
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

  // Only  a base64 header for images
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
      console.error("Error reading file as base64:", error);
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
        console.error("File does not exist:", uri);
        return null;
      }
      return fileInfo.size;
    } catch (error) {
      console.error("Error getting file size:", error);
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
    const fileId = getFileId();
    console.log(`Generated file ID: ${fileId}`);
    const totalFiles = media.length;
    const newUploadProgress = { ...uploadProgress };

    // Create an array of upload tasks
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
      formData.append("content", {
        uri: file.uri,
        type: fileType,
        name: fileName,
      } as any);
      try {
        const response = await axios.post(
          `${baseApiUrl}/upload.php`,
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
        return response.data;
      } catch (error) {
        console.error(`Error uploading file ${index + 1}:`, error);
        newUploadProgress[file.uri] = "Failed";
        setUploadProgress({ ...newUploadProgress });
        throw error;
      }
    });

    try {
      // Limit concurrent uploads to 3 at a time.
      await uploadQueue(tasks, 3);
      showSnackbar("All files uploaded successfully!");
      setMedia([]);
    } catch (error) {
      console.error("Error uploading files:", error);
      showAlert(
        "Upload Error",
        "Some files failed to upload. Please check your network connection and try again."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={style.container}>
        <View style={style.headingContainer}>
          <Text style={style.heading}>Upload Files</Text>
        </View>
        {storedProperty && (
          <View style={internalStyle.propertyInfo}>
            <Text style={internalStyle.propertyText}>
              {storedProperty.address}
            </Text>
            <Text style={internalStyle.propertyText}>
              {storedProperty.company}
            </Text>
          </View>
        )}
        <Text style={internalStyle.title}>
          {category?.category}
          {subCategory ? ` - ${subCategory.sub_category}` : ""}
        </Text>
        <Text style={internalStyle.buttonHeading}>Choose File From</Text>
        <View style={internalStyle.buttonContainer}>
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.gray },
            ]}
            onPress={pickImage}
            disabled={uploading}
          >
            <Entypo name="images" size={28} color="white" />
            <Text style={internalStyle.actionButtonLabel}>Gallery/Video</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.primary },
            ]}
            onPress={takePhoto}
            disabled={uploading}
          >
            <Feather name="camera" size={28} color="white" />
            <Text style={internalStyle.actionButtonLabel}>Camera</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              internalStyle.actionButton,
              { backgroundColor: color.secondary },
            ]}
            onPress={pickDocument}
            disabled={uploading}
          >
            <Feather name="file-text" size={28} color="white" />
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
              internalStyle.uploadButton,
              uploading && internalStyle.disabledButton,
            ]}
            onPress={uploadImages}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={internalStyle.uploadButtonText}>
                Upload {media.length} File{media.length > 1 ? "s" : ""}
              </Text>
            )}
          </TouchableOpacity>
        )}
        <Modal visible={modalVisible} transparent={true} animationType="slide">
          <View style={internalStyle.modalContainer}>
            <TouchableOpacity
              style={internalStyle.closeModal}
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
    </View>
  );
};

const internalStyle = StyleSheet.create({
  title: {
    fontSize: fontSize.large,
    fontWeight: "600",
    marginBottom: 20,
    color: color.gray,
    borderBottomWidth: 1,
    borderColor: "#ddd",
    paddingVertical: 10,
  },
  actionButton: {
    width: 120,
    height: 90,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
  },
  actionButtonLabel: {
    marginTop: 4,
    fontSize: fontSize.medium,
    color: color.white,
    textAlign: "center",
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    marginVertical: 10,
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
  modalContainer: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.9)",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 20,
  },
  closeModal: {
    position: "absolute",
    top: 40,
    right: 20,
    zIndex: 10,
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
  uploadButton: {
    backgroundColor: color.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginVertical: 20,
  },
  uploadButtonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "bold",
  },
  disabledButton: {
    backgroundColor: color.gray,
  },
  propertyInfo: {
    padding: 5,
    borderBottomWidth: 1,
    borderColor: "#ddd",
  },
  propertyText: {
    fontSize: fontSize.medium,
    marginBottom: 5,
  },
  buttonHeading: {
    fontSize: fontSize.large,
    textAlign: "center",
    fontWeight: "600",
    marginBottom: 5,
  },
});

export default UploadScreen;
