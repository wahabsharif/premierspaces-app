import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Common/Header";
import { baseApiUrl } from "../Constants/env";
import { color, fontSize } from "../Constants/theme";
import { RootStackParamList } from "../types";

const JobDetailScreen = ({
  route,
  navigation,
}: NativeStackScreenProps<RootStackParamList, "JobDetailScreen">) => {
  const { id } = route.params;
  console.log("JobDetailScreen id:", id);
  const [userData, setUserData] = useState<any>(null);
  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
    id: string;
  } | null>(null);
  const [jobDetail, setJobDetail] = useState<any>(null);
  const [contractorData, setContractorData] = useState<any[]>([]);
  const [totalAmount, setTotalAmount] = useState<number>(0);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  // Retrieve stored user data from AsyncStorage
  useEffect(() => {
    const fetchUserData = async () => {
      try {
        const storedUser = await AsyncStorage.getItem("userData");
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserData(parsedUser);
        }
      } catch (err) {
        console.error("Error retrieving user data", err);
      }
    };
    fetchUserData();
  }, []);

  // Retrieve stored property data from AsyncStorage
  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem("selectedProperty");
        if (storedProperty) {
          const parsedProperty = JSON.parse(storedProperty);
          setPropertyData(parsedProperty);
        }
      } catch (err) {
        console.error("Error retrieving property data", err);
      }
    };
    fetchPropertyData();
  }, []);

  useEffect(() => {
    if (!userData) return;
    const fetchJobDetail = async () => {
      setLoading(true);
      setError(null);
      try {
        const userid = userData.payload
          ? userData.payload.userid
          : userData.userid;
        const endpoint = `${baseApiUrl}/getjobs.php?userid=${userid}&id=${id}`;
        const response = await fetch(endpoint);
        const json = await response.json();
        if (json.status === 1) {
          const detail =
            Array.isArray(json.payload) && json.payload.length > 0
              ? json.payload[0]
              : json.payload;
          setJobDetail(detail);
        } else {
          setError("Job details not found.");
        }
      } catch (err) {
        console.error("Error fetching job details", err);
        setError("Error fetching job details.");
      } finally {
        setLoading(false);
      }
    };
    fetchJobDetail();
  }, [userData, id]);

  useEffect(() => {
    if (!userData || !jobDetail) return;

    const fetchContractorData = async () => {
      try {
        const userid = userData.payload
          ? userData.payload.userid
          : userData.userid;
        const endpoint = `${baseApiUrl}/get-contractor-data.php?userid=${userid}&job_id=${id}`;
        const response = await fetch(endpoint);
        const json = await response.json();

        if (json.status === 1 && json.payload) {
          const contractors = Array.isArray(json.payload)
            ? json.payload
            : [json.payload];

          setContractorData(contractors);
          const total = contractors.reduce(
            (sum: number, contractor: { amount: string }) => {
              return sum + (parseFloat(contractor.amount) || 0);
            },
            0
          );

          setTotalAmount(total);
        } else {
          console.log("No contractor data available or error in response");
        }
      } catch (err) {
        console.error("Error fetching contractor data", err);
      }
    };

    fetchContractorData();
  }, [userData, jobDetail, id]);

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator size="large" color={color.primary} />
      </View>
    );
  }

  if (error || !jobDetail) {
    return (
      <View style={styles.container}>
        <Text style={styles.errorText}>
          {error || "No job details available."}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={styles.container}>
        {/* Display Property Details */}
        {propertyData && (
          <View style={styles.propertyContainer}>
            <Text style={styles.propertyLabel}>Selected Property:</Text>
            <View style={styles.propertyDetails}>
              <Text style={styles.propertyItem}>{propertyData.address}</Text>
              <Text style={styles.propertyItem}>{propertyData.company}</Text>
            </View>
            {/* Upload Files Button aligned to the right */}
            <TouchableOpacity
              style={styles.uploadButton}
              //   onPress={() => navigation.navigate("UploadScreen")}
            >
              <Text style={styles.uploadButtonText}>Upload Files</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.header}>Job Detail</Text>
        <Text style={styles.label}>Landlord</Text>
        <Text style={styles.value}></Text>
        <Text style={styles.label}>Job Type</Text>
        <Text style={styles.value}>{jobDetail.job_type}</Text>
        <Text style={styles.label}>Tasks:</Text>
        {[
          jobDetail.task1,
          jobDetail.task2,
          jobDetail.task3,
          jobDetail.task4,
          jobDetail.task5,
          jobDetail.task6,
          jobDetail.task7,
          jobDetail.task8,
          jobDetail.task9,
          jobDetail.task10,
        ]
          .filter((task) => task && task.trim().length > 0)
          .map((task, index) => (
            <Text key={index} style={styles.taskItem}>
              {"\u2022"} {task}
            </Text>
          ))}
        <Text style={styles.label}>Costs:</Text>

        {/* Display contractor costs */}
        <View style={styles.costsContainer}>
          {contractorData.length > 0 ? (
            <>
              {contractorData.map((contractor, index) => (
                <View key={index} style={styles.costItem}>
                  <Text style={styles.contractorName}>{contractor.name}</Text>
                  <Text style={styles.contractorAmount}>
                    £ {contractor.amount}
                  </Text>
                </View>
              ))}

              {/* Display total amount */}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalAmount}>
                  £ {totalAmount.toFixed(2)}
                </Text>
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>No cost data available</Text>
          )}
        </View>

        {/* Display file counts with icons */}
        <View style={styles.countsContainer}>
          <View style={styles.countContainer}>
            <MaterialCommunityIcons name="image" size={40} color="#1f3759" />
            <Text style={styles.countItem}>{jobDetail.image_file_count}</Text>
          </View>
          <View style={styles.countContainer}>
            <MaterialCommunityIcons
              name="file-document"
              size={40}
              color="#1f3759"
            />
            <Text style={styles.countItem}>{jobDetail.doc_file_count}</Text>
          </View>
          <View style={styles.countContainer}>
            <MaterialCommunityIcons name="video" size={40} color="#1f3759" />
            <Text style={styles.countItem}>{jobDetail.video_file_count}</Text>
          </View>
        </View>
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 20,
    backgroundColor: color.white,
  },
  header: {
    fontSize: fontSize.large,
    fontWeight: "bold",
    marginBottom: 20,
    color: color.primary,
  },
  label: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    marginTop: 10,
    color: color.black,
    textTransform: "uppercase",
  },
  value: {
    fontSize: fontSize.medium,
    marginLeft: 5,
  },
  taskItem: {
    fontSize: fontSize.medium,
    color: color.gray,
    paddingLeft: 10,
  },
  countItem: {
    fontSize: fontSize.xl,
    color: " #1f3759",
    paddingLeft: 5,
    fontWeight: "bold",
  },
  errorText: {
    color: "red",
    fontSize: fontSize.medium,
    textAlign: "center",
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
  uploadButton: {
    marginTop: 10,
    alignSelf: "flex-end",
    backgroundColor: color.primary,
    paddingVertical: 8,
    paddingHorizontal: 15,
    borderRadius: 5,
  },
  uploadButtonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "600",
  },
  countsContainer: {
    flexDirection: "row",
    marginTop: 20,
    justifyContent: "space-around",
  },
  countContainer: {
    flexDirection: "row",
    alignItems: "center",
  },
  costsContainer: {
    marginLeft: 10,
    marginTop: 5,
  },
  costItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  contractorName: {
    fontSize: fontSize.medium,
    color: "#FF0000",
    flex: 2,
  },
  contractorAmount: {
    fontSize: fontSize.medium,
    color: "#FF0000",
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  noDataText: {
    fontSize: fontSize.medium,
    color: color.gray,
    fontStyle: "italic",
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    marginTop: 5,
    borderTopWidth: 2,
    borderTopColor: color.secondary,
  },
  totalLabel: {
    fontSize: fontSize.medium,
    fontWeight: "bold",
    color: color.primary,
    flex: 2,
  },
  totalAmount: {
    fontSize: fontSize.large,
    fontWeight: "bold",
    color: color.primary,
    flex: 1,
    textAlign: "right",
  },
});

export default JobDetailScreen;
