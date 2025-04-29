import { View, Text } from "react-native";
import styles from "../Constants/styles";
import Header from "../components/Common/Header";
import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

export default function FilesScreen() {
  const [property, setProperty] = useState<{
    address: string;
    company: string;
  } | null>(null);

  useEffect(() => {
    const fetchProperty = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem("selectedProperty");
        console.log("Loaded property from storage:", storedProperty);
        if (storedProperty) setProperty(JSON.parse(storedProperty));
      } catch (error) {
        console.error("Failed to load property:", error);
      }
    };

    fetchProperty();
  }, []);

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Uploaded Files</Text>
        </View>
        {property ? (
          <View style={styles.screenBanner}>
            <Text style={styles.bannerLabel}>Selected Property:</Text>
            <Text style={styles.bannerText}>{property.address}</Text>
            <Text style={styles.extraSmallText}>{property.company}</Text>
          </View>
        ) : (
          <Text style={styles.extraSmallText}>No property selected.</Text>
        )}
      </View>
    </View>
  );
}
