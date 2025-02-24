import * as Camera from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import React, { useState } from "react";
import { Image, Text, TouchableOpacity, View } from "react-native";

const UploadScreen = ({ route }: any) => {
  const { category } = route.params;
  const [media, setMedia] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.Images,
      allowsEditing: true,
      quality: 1,
    });

    if (!result.canceled) {
      setMedia(result.assets[0].uri);
    }
  };

  const takePhoto = async () => {
    const [permission, requestPermission] = Camera.useCameraPermissions();
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
      setMedia(result.assets[0].uri);
    }
  };

  return (
    <View
      style={{
        flex: 1,
        padding: 20,
        alignItems: "center",
        backgroundColor: "#f8f9fa",
      }}
    >
      <Text
        style={{
          fontSize: 24,
          fontWeight: "bold",
          marginBottom: 20,
          color: "#333",
        }}
      >
        Upload to {category}
      </Text>
      <TouchableOpacity
        style={{
          backgroundColor: "#007bff",
          padding: 12,
          borderRadius: 8,
          marginBottom: 10,
          width: "80%",
          alignItems: "center",
        }}
        onPress={pickImage}
      >
        <Text style={{ fontSize: 18, color: "#fff" }}>Choose from Gallery</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={{
          backgroundColor: "#28a745",
          padding: 12,
          borderRadius: 8,
          marginBottom: 20,
          width: "80%",
          alignItems: "center",
        }}
        onPress={takePhoto}
      >
        <Text style={{ fontSize: 18, color: "#fff" }}>Take a Photo/Video</Text>
      </TouchableOpacity>
      {media && (
        <Image
          source={{ uri: media }}
          style={{ width: 200, height: 200, borderRadius: 10, marginTop: 20 }}
        />
      )}
    </View>
  );
};

export default UploadScreen;
