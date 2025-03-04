import * as Camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import {
  Image,
  Text,
  TouchableOpacity,
  View,
  FlatList,
  StyleSheet,
  Dimensions,
  Modal,
} from "react-native";
import { AntDesign } from "@expo/vector-icons";

const screenWidth = Dimensions.get("window").width;
const imageSize = screenWidth / 2 - 40;

const UploadScreen = ({ route }: any) => {
  const { category } = route.params;
  const [media, setMedia] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [permission, requestPermission] = Camera.useCameraPermissions();

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsMultipleSelection: true,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setMedia([...media, ...result.assets.map((asset) => asset.uri)]);
    }
  };

  const takePhoto = async () => {
    if (!permission?.granted) {
      const { status } = await requestPermission();
      if (status !== "granted") {
        alert("Camera permission is required!");
        return;
      }
    }

    let result = await ImagePicker.launchCameraAsync({
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setMedia([...media, result.assets[0].uri]);
    }
  };

  const removeImage = (index: number) => {
    const updatedMedia = [...media];
    updatedMedia.splice(index, 1);
    setMedia(updatedMedia);
  };

  const openImage = (uri: string) => {
    setSelectedImage(uri);
    setModalVisible(true);
  };

  return (
    <View style={styles.container}>
      <Text style={styles.title}>Upload to {category?.category}</Text>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#347ab8" }]}
        onPress={pickImage}
      >
        <Text style={styles.buttonText}>Choose from Gallery</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.button, { backgroundColor: "#28a745" }]}
        onPress={takePhoto}
      >
        <Text style={styles.buttonText}>Take a Photo/Video</Text>
      </TouchableOpacity>

      {/* Image Grid */}
      <FlatList
        data={media}
        keyExtractor={(item, index) => index.toString()}
        numColumns={2}
        renderItem={({ item, index }) => (
          <TouchableOpacity onPress={() => openImage(item)}>
            <View style={styles.imageContainer}>
              <Image source={{ uri: item }} style={styles.image} />
              <TouchableOpacity
                style={styles.removeButton}
                onPress={() => removeImage(index)}
              >
                <AntDesign name="closecircle" size={24} color="red" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
        contentContainerStyle={styles.grid}
      />

      {/* Image Modal */}
      <Modal visible={modalVisible} transparent={true} animationType="slide">
        <View style={styles.modalContainer}>
          <TouchableOpacity
            style={styles.closeModal}
            onPress={() => setModalVisible(false)}
          >
            <AntDesign name="close" size={30} color="white" />
          </TouchableOpacity>
          {selectedImage && (
            <Image source={{ uri: selectedImage }} style={styles.fullImage} />
          )}

          {/* Thumbnail Preview */}
          <FlatList
            data={media}
            horizontal
            keyExtractor={(item, index) => index.toString()}
            renderItem={({ item }) => (
              <TouchableOpacity onPress={() => setSelectedImage(item)}>
                <Image source={{ uri: item }} style={styles.thumbnail} />
              </TouchableOpacity>
            )}
            contentContainerStyle={styles.thumbnailContainer}
          />
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    alignItems: "center",
  },
  title: {
    fontSize: 24,
    fontWeight: "bold",
    marginBottom: 20,
    color: "#333",
  },
  button: {
    padding: 12,
    borderRadius: 8,
    marginBottom: 10,
    width: "80%",
    alignItems: "center",
  },
  buttonText: {
    fontSize: 18,
    color: "#fff",
  },
  grid: {
    marginTop: 20,
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
    backgroundColor: "rgba(255, 255, 255, 0.6)",
    borderRadius: 12,
    padding: 2,
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
