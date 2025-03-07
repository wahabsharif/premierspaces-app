import { AntDesign } from "@expo/vector-icons";
import * as Camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useEffect, useState } from "react";
import {
  Dimensions,
  FlatList,
  Image,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Button, Dialog, Portal } from "react-native-paper";
import style from "../Constants/styles";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { color, fontSize } from "../Constants/theme";
import Entypo from "@expo/vector-icons/Entypo";
import Feather from "@expo/vector-icons/Feather";
import Header from "../components/Common/Header";
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

  // Custom Alert State
  const [alertVisible, setAlertVisible] = useState(false);
  const [alertTitle, setAlertTitle] = useState("");
  const [alertMessage, setAlertMessage] = useState("");

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

  const openImage = (uri: string) => {
    setSelectedImage(uri);
    setModalVisible(true);
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
          >
            <Text style={internalStyle.buttonText}>
              <Entypo name="images" size={24} color="white" /> Gallery
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[internalStyle.button, { backgroundColor: color.primary }]}
            onPress={takePhoto}
          >
            <Text style={internalStyle.buttonText}>
              <Feather name="camera" size={24} color="white" /> Camera
            </Text>
          </TouchableOpacity>
        </View>

        {/* Image Grid */}
        <FlatList
          data={media}
          keyExtractor={(item, index) => index.toString()}
          numColumns={2}
          renderItem={({ item, index }) => (
            <TouchableOpacity onPress={() => openImage(item)}>
              <View style={internalStyle.imageContainer}>
                <Image source={{ uri: item }} style={internalStyle.image} />
                <TouchableOpacity
                  style={internalStyle.removeButton}
                  onPress={() => removeImage(index)}
                >
                  <AntDesign name="closecircle" size={24} color="red" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          contentContainerStyle={internalStyle.grid}
        />

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
                    style={internalStyle.thumbnail}
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
