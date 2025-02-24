import React, { useState } from "react";
import { View, Button, Image, Text, TouchableOpacity } from "react-native";
import * as ImagePicker from "expo-image-picker";
import * as Camera from "expo-camera";

const UploadScreen = ({ route }: any) => {
  const { category } = route.params;
  const [media, setMedia] = useState<string | null>(null);

  const pickImage = async () => {
    let result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ImagePicker.MediaTypeOptions.All,
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
    if (status !== "granted") {
      alert("Camera permission is required!");
      return;
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
    <View style={{ flex: 1, padding: 20, alignItems: "center" }}>
      <Text style={{ fontSize: 20, marginBottom: 10 }}>
        Upload to {category}
      </Text>
      <TouchableOpacity style={{ marginBottom: 20 }} onPress={pickImage}>
        <Text style={{ fontSize: 18, color: "blue" }}>Choose from Gallery</Text>
      </TouchableOpacity>
      <TouchableOpacity style={{ marginBottom: 20 }} onPress={takePhoto}>
        <Text style={{ fontSize: 18, color: "blue" }}>Take a Photo/Video</Text>
      </TouchableOpacity>
      {media && (
        <Image source={{ uri: media }} style={{ width: 200, height: 200 }} />
      )}
    </View>
  );
};

export default UploadScreen;
