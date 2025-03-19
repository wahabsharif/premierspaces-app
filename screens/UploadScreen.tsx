import { AntDesign } from "@expo/vector-icons";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import * as Camera from "expo-camera";
import * as FileSystem from "expo-file-system";
import * as ImagePicker from "expo-image-picker";
import { baseApiUrl } from "../Constants/env";

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
import style from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { getFileId } from "../helper";

interface UploadScreenProps {
  route: any;
  navigation: any;
}

const screenWidth = Dimensions.get("window").width;
const imageSize = screenWidth / 2 - 40;

const UploadScreen: React.FC<UploadScreenProps> = ({ route, navigation }) => {
  const { category, subCategory } = route.params;
  const [media, setMedia] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [permission, requestPermission] = Camera.useCameraPermissions();
  const [storedProperty, setStoredProperty] = useState<any>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<{
    [key: string]: string;
  }>({});
  const [snackbarVisible, setSnackbarVisible] = useState(false);
  const [snackbarMessage, setSnackbarMessage] = useState("");

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");
  const [uploadedCount, setUploadedCount] = useState(0);

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

  const showAlert = (title: string, message: string) => {
    setAlertTitle(title);
    setAlertMessage(message);
    setAlertVisible(true);
  };

  const showSnackbar = (message: string) => {
    setSnackbarMessage(message);
    setSnackbarVisible(true);
  };

  const pickImage = async () => {
    try {
      navigation.setParams({ isPickingImage: true });

      let result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ImagePicker.MediaTypeOptions.Images,
        allowsMultipleSelection: true,
        allowsEditing: true,
        quality: 1,
      });

      if (!result.canceled) {
        setMedia([...media, ...result.assets.map((asset) => asset.uri)]);
      }
    } catch (error) {
      showAlert("Error", "Failed to pick an image. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
    }
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== "granted") {
        showAlert("Permission Required", "Camera permission is required!");
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
        setMedia([...media, result.assets[0].uri]);
      }
    } catch (error) {
      showAlert("Error", "Failed to take a photo. Please try again.");
    } finally {
      navigation.setParams({ isPickingImage: false });
    }
  };

  const removeImage = (index: number) => {
    const updatedMedia = [...media];
    updatedMedia.splice(index, 1);
    setMedia(updatedMedia);
  };
  const getFileHeader = async (uri: string) => {
    try {
      const base64Data = await FileSystem.readAsStringAsync(uri, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const mimeType = uri.endsWith(".png") ? "image/png" : "image/jpeg";
      return `data:${mimeType};base64,${base64Data.slice(0, 50)}...`;
    } catch (error) {
      console.error("Error reading file as base64:", error);
      return "";
    }
  };

  const openImage = (uri: string) => {
    setSelectedImage(uri);
    setModalVisible(true);
  };

  const getFileSize = async (uri: string): Promise<number | null> => {
    try {
      const fileInfo = await FileSystem.getInfoAsync(uri, { size: true });

      if (!fileInfo.exists) {
        console.error("File does not exist:", uri);
        return null;
      }

      return fileInfo.size; // fileInfo.size should now be available
    } catch (error) {
      console.error("Error getting file size:", error);
      return null;
    }
  };

  const uploadImages = async () => {
    if (media.length === 0) {
      showAlert("Error", "Please select at least one image to upload.");
      return;
    }

    if (!storedProperty) {
      showAlert(
        "Error",
        "No property selected. Please select a property first."
      );
      return;
    }

    setUploading(true);
    setUploadedCount(0);

    const fileId = getFileId();
    console.log(`Generated file ID: ${fileId}`);

    const totalFiles = media.length;
    const newUploadProgress = { ...uploadProgress };

    try {
      const uploadPromises = media.map(async (uri, index) => {
        const fileSize = await getFileSize(uri);
        if (fileSize === null) return;

        const formData = new FormData();
        const fileName = uri.split("/").pop() || `image_${index}.jpg`;
        const fileType = fileName.endsWith(".png") ? "image/png" : "image/jpeg";
        const fileHeaderValue = await getFileHeader(uri);

        formData.append("id", fileId);
        formData.append("total_segments", totalFiles.toString());
        formData.append("segment_number", (index + 1).toString());
        formData.append("main_category", category?.id?.toString() || "");
        formData.append("category_level_1", subCategory?.id?.toString() || "");
        formData.append("property_id", storedProperty.id || "");
        formData.append("job_id", storedProperty.job_id || "");
        formData.append("file_header", fileHeaderValue);
        formData.append("file_name", fileName);
        formData.append("file_type", fileType);
        formData.append("file_size", fileSize.toString()); // Add file size

        formData.append("content", {
          uri: uri,
          type: fileType,
          name: fileName,
        } as any);

        try {
          const response = await axios.post(
            `${baseApiUrl}/upload.php`,
            formData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
              onUploadProgress: (progressEvent) => {
                if (progressEvent.total) {
                  const percentCompleted = Math.round(
                    (progressEvent.loaded * 100) / progressEvent.total
                  );
                  newUploadProgress[uri] = `${percentCompleted}%`;
                  setUploadProgress({ ...newUploadProgress });
                }
              },
            }
          );

          newUploadProgress[uri] = "Complete";
          setUploadProgress({ ...newUploadProgress });
          setUploadedCount((prevCount) => prevCount + 1);
          return response.data;
        } catch (error) {
          console.error(`Error uploading image ${index + 1}:`, error);
          if (axios.isAxiosError(error)) {
            console.error("Error details:", error.response?.data);
          }
          newUploadProgress[uri] = "Failed";
          setUploadProgress({ ...newUploadProgress });
          throw error;
        }
      });

      await Promise.all(uploadPromises);
      showSnackbar("All images uploaded successfully!");
      setMedia([]); // Clear the images after successful upload
    } catch (error) {
      console.error("Error uploading images:", error);
      if (axios.isAxiosError(error)) {
        console.error("Network error details:", error.message);
        console.error("Error config:", error.config);
      }
      showAlert(
        "Upload Error",
        "Some images failed to upload. Please check your network connection and try again."
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
          <Text style={style.heading}>Upload Images</Text>
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
        <Text style={internalStyle.buttonHeading}>Choose Image From</Text>

        <View style={internalStyle.buttonContainer}>
          <TouchableOpacity
            style={[internalStyle.button, { backgroundColor: color.gray }]}
            onPress={pickImage}
            disabled={uploading}
          >
            <Text style={internalStyle.buttonText}>
              <Entypo name="images" size={24} color="white" /> Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[internalStyle.button, { backgroundColor: color.primary }]}
            onPress={takePhoto}
            disabled={uploading}
          >
            <Text style={internalStyle.buttonText}>
              <Feather name="camera" size={24} color="white" /> Camera
            </Text>
          </TouchableOpacity>
        </View>
        {uploading && (
          <ProgressBar
            progress={Math.round((uploadedCount / media.length) * 100)}
            uploadedCount={uploadedCount}
            totalCount={media.length}
          />
        )}
        {/* Image Grid */}
        <FlatList
          data={media}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => openImage(item)}>
              <View style={internalStyle.imageContainer}>
                <Image source={{ uri: item }} style={internalStyle.image} />
                {uploadProgress[item] && (
                  <View style={internalStyle.progressOverlay}>
                    <Text style={internalStyle.progressText}>
                      {uploadProgress[item]}
                    </Text>
                  </View>
                )}
                {!uploading && (
                  <TouchableOpacity
                    style={internalStyle.removeButton}
                    onPress={() => removeImage(index)}
                  >
                    <AntDesign name="closecircle" size={24} color="red" />
                  </TouchableOpacity>
                )}
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={internalStyle.grid}
        />

        {/* Upload Button */}
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
                Upload {media.length} Image{media.length > 1 ? "s" : ""}
              </Text>
            )}
          </TouchableOpacity>
        )}

        {/* Image Modal */}
        <Modal visible={modalVisible} transparent={true} animationType="slide">
          <View style={internalStyle.modalContainer}>
            <TouchableOpacity
              style={internalStyle.closeModal}
              onPress={() => setModalVisible(false)}
            >
              <AntDesign name="close" size={30} color="white" />
            </TouchableOpacity>
            {selectedImage && (
              <Image
                source={{ uri: selectedImage }}
                style={internalStyle.fullImage}
              />
            )}

            {/* Thumbnail Preview */}
            <FlatList
              data={media}
              horizontal
              keyExtractor={(item, index) => index.toString()}
              renderItem={({ item }) => (
                <TouchableOpacity onPress={() => setSelectedImage(item)}>
                  <Image
                    source={{ uri: item }}
                    style={[
                      internalStyle.thumbnail,
                      selectedImage === item && internalStyle.selectedThumbnail,
                    ]}
                  />
                </TouchableOpacity>
              )}
              contentContainerStyle={internalStyle.thumbnailContainer}
            />
          </View>
        </Modal>

        {/* Custom Alert Dialog */}
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

        {/* Snackbar for notifications */}
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
  button: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    width: "40%",
    alignItems: "center",
  },
  buttonText: {
    fontSize: fontSize.medium,
    color: color.white,
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
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    alignItems: "center",
    marginVertical: 10,
  },
});

export default UploadScreen;
