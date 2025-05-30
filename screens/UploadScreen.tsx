import { AntDesign, MaterialIcons } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Camera from "expo-camera";
import * as DocumentPicker from "expo-document-picker";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { useVideoPlayer, VideoView } from "expo-video";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
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
import { useDispatch, useSelector } from "react-redux";
import { Header, ProgressBar, UploadStatusModal } from "../components";
import { default as style, default as styles } from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { AppDispatch } from "../store";
import {
  clearFiles,
  selectFiles,
  selectProgress,
  selectUploadCounts,
  selectUploading,
  setFiles,
  uploadFiles,
} from "../store/uploaderSlice";
import { MediaFile, UploadScreenProps } from "../types";

const screenWidth = Dimensions.get("window").width;
const imageSize = screenWidth / 2 - 40;

// Memoized file item for better performance
const FileItem = memo(
  ({
    item,
    index,
    onPress,
    onRemove,
    progress,
    uploading,
  }: {
    item: MediaFile;
    index: number;
    onPress: () => void;
    onRemove: () => void;
    progress?: string;
    uploading: boolean;
  }) => {
    return (
      <TouchableOpacity onPress={onPress}>
        <View style={internalStyle.imageContainer}>
          {item.type === "image" ? (
            <Image
              source={{ uri: item.uri }}
              style={internalStyle.image}
              fadeDuration={0}
            />
          ) : item.type === "video" ? (
            <View style={internalStyle.videoPlaceholder}>
              <Feather name="video" size={imageSize * 0.5} color="gray" />
            </View>
          ) : (
            <View style={internalStyle.documentPlaceholder}>
              <Feather name="file-text" size={imageSize * 0.5} color="gray" />
            </View>
          )}
          {progress && (
            <View style={internalStyle.progressOverlay}>
              <Text style={internalStyle.progressText}>{progress}</Text>
            </View>
          )}
          {!uploading && (
            <TouchableOpacity
              style={internalStyle.removeButton}
              onPress={onRemove}
            >
              <AntDesign name="closecircle" size={24} color="red" />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    );
  }
);

const UploadScreen: React.FC<UploadScreenProps> = ({ route, navigation }) => {
  const {
    category = {},
    subCategory = {},
    common_id = "",
    job_id = "",
    materialCost = "0",
  } = route.params || {};
  const dispatch = useDispatch<AppDispatch>();

  // Use selectors for better performance
  const files = useSelector(selectFiles);
  const uploading = useSelector(selectUploading);
  const uploadProgress = useSelector(selectProgress);
  const { successCount, failedCount } = useSelector(selectUploadCounts);

  const [selectedFile, setSelectedFile] = useState<MediaFile | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [micPermission, requestMicPermission] =
    Camera.useMicrophonePermissions();
  const [storedProperty, setStoredProperty] = useState<any>(null);
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");
  const [jobData, setJobData] = useState<any>(null);
  const [loadingMedia, setLoadingMedia] = useState(false);
  const [userData, setUserData] = useState<any>(null);
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [statusModalVisible, setStatusModalVisible] = useState(false);
  const [statusModalData, setStatusModalData] = useState({
    successCount: 0,
    failedCount: 0,
  });

  // Memoized mime type inference function
  const inferMimeType = useCallback((fileName: string) => {
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
  }, []);

  // Optimized data loading
  useEffect(() => {
    let isMounted = true;

    const loadData = async () => {
      try {
        // Fetch all data in parallel for better performance
        const [userDataStr, propertyStr, jobStr] = await Promise.all([
          AsyncStorage.getItem("userData"),
          AsyncStorage.getItem("selectedProperty"),
          AsyncStorage.getItem("jobData"),
        ]);

        if (!isMounted) return;

        if (userDataStr) setUserData(JSON.parse(userDataStr));
        if (propertyStr) setStoredProperty(JSON.parse(propertyStr));
        if (jobStr) setJobData(JSON.parse(jobStr));
      } catch (error) {
        // Error handling...
      }
    };

    loadData();
    return () => {
      isMounted = false;
    };
  }, []);

  // Track upload completion
  useEffect(() => {
    if (
      !uploading &&
      files.length > 0 &&
      successCount + failedCount === files.length
    ) {
      // Store the current counts before showing modal
      setStatusModalData({
        successCount,
        failedCount,
      });
      setStatusModalVisible(true);
    }
  }, [uploading, successCount, failedCount, files.length]);

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

  // Optimized image picking with better memory management
  const pickImage = useCallback(async () => {
    setLoadingMedia(true);
    try {
      navigation.setParams({ isPickingImage: true });

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.All,
        allowsMultipleSelection: true,
        allowsEditing: false,
        quality: 0.8, // Reduced quality for better performance
        exif: false, // Don't load EXIF data we don't need
      });

      if (!result.canceled) {
        // Process files in batches to prevent memory issues
        const batchSize = 5;
        let allNewFiles: MediaFile[] = [];

        for (let i = 0; i < result.assets.length; i += batchSize) {
          const currentBatch = result.assets.slice(i, i + batchSize);

          const batchFiles = currentBatch.map((asset) => {
            const fileType: "image" | "video" =
              asset.type === "video" ? "video" : "image";
            const name = asset.uri.split("/").pop() || `file_${Date.now()}`;
            let mimeType = "";

            if (fileType === "image") {
              mimeType = name.endsWith(".png") ? "image/png" : "image/jpeg";
            } else if (fileType === "video") {
              mimeType = name.endsWith(".mp4") ? "video/mp4" : "video/mp4";
            }

            // Don't read file content until upload time
            return {
              uri: asset.uri,
              type: fileType,
              name,
              mimeType,
              content: "",
            } as MediaFile;
          });

          allNewFiles = [...allNewFiles, ...batchFiles];

          // Update state incrementally for better UI responsiveness with many files
          if (i + batchSize < result.assets.length) {
            dispatch(setFiles([...files, ...allNewFiles]));
            // Small delay to allow UI to update
            await new Promise((resolve) => setTimeout(resolve, 50));
          }
        }

        // Final update with all files
        dispatch(setFiles([...files, ...allNewFiles]));
      }
    } catch (error) {
      showAlert("Error", "Failed to pick media. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  }, [dispatch, files, navigation]);

  // Optimized document picking with streaming
  const pickDocument = useCallback(async () => {
    setLoadingMedia(true);
    try {
      navigation.setParams({ isPickingImage: true });

      const result = await DocumentPicker.getDocumentAsync({
        type: "*/*",
        multiple: false,
        copyToCacheDirectory: false, // Don't copy unnecessarily
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const doc = result.assets[0];
        const name = doc.name;
        const mimeType = doc.mimeType || inferMimeType(name);

        // Don't read file content in advance - will be streamed during upload
        const newFile: MediaFile = {
          uri: doc.uri,
          type: "document",
          name,
          mimeType,
          content: "",
          size: doc.size,
        };

        dispatch(setFiles([...files, newFile]));
      }
    } catch (error) {
      showAlert("Error", "Failed to pick a document. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  }, [dispatch, files, inferMimeType, navigation]);

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
        dispatch(
          setFiles([
            ...files,
            { uri: asset.uri, type: "video", name, mimeType },
          ])
        );
      }
    } catch (error) {
      showAlert("Error", "Failed to record video. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

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
        dispatch(
          setFiles([
            ...files,
            { uri: asset.uri, type: "image", name, mimeType },
          ])
        );
      }
    } catch (error) {
      showAlert("Error", "Failed to take photo. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
      setLoadingMedia(false);
    }
  };

  const removeFile = (index: number) => {
    const updatedFiles = [...files];
    updatedFiles.splice(index, 1);
    dispatch(setFiles(updatedFiles));
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

  // Optimized functions for photo/video capturing
  // ...existing takePhoto and recordVideo functions...

  // Optimized file upload handling
  const handleUpload = useCallback(() => {
    if (files.length === 0) {
      showAlert("Error", "Please select at least one file to upload.");
      return;
    }

    const mainCategoryId = category?.id?.toString() || "";
    const subCategoryId = subCategory?.id?.toString() || "";
    const propertyId = storedProperty ? storedProperty.id : "";
    const userName = userData?.payload?.name || "";

    dispatch(
      uploadFiles({
        mainCategoryId,
        subCategoryId,
        propertyId,
        job_id,
        userName,
        common_id,
      })
    );
  }, [
    category?.id,
    common_id,
    dispatch,
    files.length,
    job_id,
    showAlert,
    storedProperty,
    subCategory?.id,
    userData,
  ]);

  const videoUri =
    selectedFile?.type === "video" && modalVisible ? selectedFile.uri : null;
  const videoPlayer = useVideoPlayer(videoUri || "", (player) => {
    if (videoUri) {
      player.loop = true;
      player.play();
    }
  });
  // Optimized rendering with memoization
  const renderFileItem = useCallback(
    ({ item, index }: { item: MediaFile; index: number }) => (
      <FileItem
        item={item}
        index={index}
        onPress={() => openFile(item)}
        onRemove={() => removeFile(index)}
        progress={uploadProgress[item.uri]}
        uploading={uploading}
      />
    ),
    [openFile, removeFile, uploadProgress, uploading]
  );

  interface KeyExtractor {
    (item: MediaFile, index: number): string;
  }

  const keyExtractor: KeyExtractor = useCallback(
    (_, index: number) => `file-${index}`,
    []
  );

  const uploadProgressPercent = useMemo(
    () =>
      files.length
        ? Math.round(((successCount + failedCount) / files.length) * 100)
        : 0,
    [files.length, successCount, failedCount]
  );

  function handleStatusModalClose() {
    setStatusModalVisible(false);
    dispatch(clearFiles());
    if (job_id) {
      navigation.navigate("JobDetailScreen", {
        id: job_id,
        common_id: common_id,
        refresh: true,
        materialCost: materialCost || "0",
      });
    } else {
      navigation.goBack();
    }
  }

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
        {(category?.category || (subCategory && subCategory.sub_category)) && (
          <Text style={style.subHeading}>
            {category?.category}
            {subCategory && subCategory.sub_category
              ? ` - ${subCategory.sub_category}`
              : ""}
          </Text>
        )}
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
            progress={Math.min(
              100,
              Math.round(((successCount + failedCount) / files.length) * 100)
            )}
            uploadedCount={Math.min(files.length, successCount + failedCount)}
            totalCount={files.length}
          />
        )}
        <FlatList
          data={files}
          keyExtractor={keyExtractor}
          numColumns={2}
          renderItem={renderFileItem}
          contentContainerStyle={internalStyle.grid}
        />
        {files.length > 0 && (
          <TouchableOpacity
            style={[
              style.primaryButton,
              uploading && { backgroundColor: color.gray },
            ]}
            onPress={handleUpload}
            disabled={uploading}
          >
            {uploading ? (
              <ActivityIndicator color="white" size="small" />
            ) : (
              <Text style={style.buttonText}>
                Upload {files.length} File{files.length > 1 ? "s" : ""}
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
              <View style={internalStyle.mediaContentContainer}>
                {selectedFile && selectedFile.type === "image" && (
                  <Image
                    source={{ uri: selectedFile.uri }}
                    style={internalStyle.fullImage}
                  />
                )}
                {selectedFile && selectedFile.type === "video" && (
                  <VideoView
                    style={internalStyle.fullImage}
                    player={videoPlayer}
                    allowsFullscreen
                    allowsPictureInPicture
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
              </View>
              <View style={internalStyle.thumbnailContainerWrapper}>
                <FlatList
                  data={files}
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
        onClose={handleStatusModalClose}
        successCount={statusModalData.successCount}
        failedCount={statusModalData.failedCount}
        totalCount={statusModalData.successCount + statusModalData.failedCount}
        jobId={job_id}
        materialCost={materialCost}
        category={category}
        subCategory={subCategory}
        common_id={common_id}
      />
    </View>
  );
};

const internalStyle = StyleSheet.create({
  modalView: {
    alignItems: "center",
    width: "100%",
    height: "100%",
    position: "relative",
    justifyContent: "space-between",
  },
  mediaContentContainer: {
    flex: 1,
    width: "100%",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailContainerWrapper: {
    width: "100%",
    paddingBottom: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
  },
  actionButton: {
    flex: 1,
    height: 80,
    borderRadius: 8,
    justifyContent: "center",
    alignItems: "center",
  },
  actionButtonLabel: {
    marginTop: 4,
    fontSize: 12,
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
    width: "95%",
    height: "90%",
    borderRadius: 10,
    resizeMode: "contain",
  },
  documentPreview: {
    width: "95%",
    height: "90%",
    justifyContent: "center",
    alignItems: "center",
  },
  thumbnailContainer: {
    flexDirection: "row",
    paddingVertical: 10,
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
function showAlert(arg0: string, arg1: string) {
  throw new Error("Function not implemented.");
}
