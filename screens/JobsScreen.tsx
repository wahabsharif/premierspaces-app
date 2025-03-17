import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import Header from "../components/Common/Header";
import { color, fontSize } from "../Constants/theme";
import { RootStackParamList } from "../types";
import commonStyles from "../Constants/styles";

const JobsScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "JobsScreen">) => {
  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
  } | null>(null);

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem("selectedProperty");
        if (storedProperty) {
          setPropertyData(JSON.parse(storedProperty));
        }
      } catch (error) {
        console.error("Error retrieving property data", error);
      }
    };

    fetchPropertyData();
  }, []);

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={styles.container}>
        <View style={commonStyles.headingContainer}>
          <Text style={commonStyles.heading}>Jobs Lists</Text>
        </View>
        {propertyData && (
          <View style={styles.propertyContainer}>
            <Text style={styles.propertyLabel}>Selected Property:</Text>
            <View style={styles.propertyDetails}>
              <Text style={styles.propertyItem}>{propertyData.address}</Text>
              <Text style={styles.propertyItem}>{propertyData.company}</Text>
            </View>
          </View>
        )}
        <TouchableOpacity
          style={styles.button}
          onPress={() => navigation.navigate("OpenNewJobScreen")}
        >
          <Text style={styles.buttonText}>Open New Job</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
  },
  propertyContainer: {
    backgroundColor: color.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: color.secondary,
  },
  propertyLabel: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    color: color.black,
    marginBottom: 5,
  },
  propertyDetails: {
    paddingLeft: 10,
  },
  propertyItem: {
    fontSize: fontSize.medium,
    color: color.gray,
  },
  button: {
    backgroundColor: color.primary,
    paddingHorizontal: 10,
    width: "40%",
    paddingVertical: 10,
    borderRadius: 5,
    alignSelf: "center",
  },
  buttonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "600",
    textAlign: "center",
  },
});

export default JobsScreen;
