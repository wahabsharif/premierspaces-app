import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import Header from "../components/Common/Header";
import { baseApiUrl } from "../Constants/env";
import commonStyles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { Job, RootStackParamList } from "../types";

const JobsScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "JobsScreen">) => {
  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
    id: string;
  } | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [jobs, setJobs] = useState<Job[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  // Retrieve stored property and user data from AsyncStorage
  useEffect(() => {
    const fetchStoredData = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem("selectedProperty");
        const storedUser = await AsyncStorage.getItem("userData");
        if (storedProperty) {
          const parsedProperty = JSON.parse(storedProperty);
          setPropertyData(parsedProperty);
        }
        if (storedUser) {
          const parsedUser = JSON.parse(storedUser);
          setUserData(parsedUser);
        }
      } catch (err) {
        console.error("Error retrieving stored data", err);
      }
    };
    fetchStoredData();
  }, []);

  // Once we have both user and property data, fetch the jobs data
  useEffect(() => {
    const fetchJobs = async () => {
      if (!userData || !propertyData) return;
      setLoading(true);
      setError(null);
      try {
        const userid = userData.payload
          ? userData.payload.userid
          : userData.userid;
        const endpoint = `${baseApiUrl}/getjobs.php?userid=${userid}&property_id=${propertyData.id}`;
        const response = await fetch(endpoint);
        const json = await response.json();
        if (json.status === 1) {
          setJobs(json.payload);
        } else {
          setError("No jobs found or session expired.");
        }
      } catch (err) {
        console.error("Error fetching jobs", err);
        setError("Error fetching jobs.");
      } finally {
        setLoading(false);
      }
    };
    fetchJobs();
  }, [userData, propertyData]);

  const renderJob = ({ item }: { item: Job }) => {
    const tasks = [
      item.task1,
      item.task2,
      item.task3,
      item.task4,
      item.task5,
      item.task6,
      item.task7,
      item.task8,
      item.task9,
      item.task10,
    ].filter((task) => task && task.trim().length > 0);

    const getStatusBackground = (status: number) => {
      switch (status) {
        case 1:
          return color.orange;
        case 2:
          return color.green;
        case 3:
          return color.red;
        default:
          return color.gray;
      }
    };

    const handleJobPress = async () => {
      try {
        await AsyncStorage.setItem("jobData", JSON.stringify(item));
        console.log("jobData saved to AsyncStorage:", item);
        navigation.navigate("JobDetailScreen", { id: item.id });
      } catch (err) {
        console.error("Error storing job data", err);
      }
    };

    return (
      <TouchableOpacity style={styles.jobContainer} onPress={handleJobPress}>
        <View style={styles.jobDetails}>
          <Text style={styles.jobNum}>{item.job_num}</Text>
          <Text>{item.date_created}</Text>

          <View
            style={[
              styles.statusContainer,
              { backgroundColor: getStatusBackground(Number(item.status)) },
            ]}
          >
            <Text style={styles.statusText}>
              {Number(item.status) === 1
                ? "Open"
                : Number(item.status) === 2
                ? "Completed"
                : "Closed"}
            </Text>
          </View>

          <Text>{item.job_type}</Text>
        </View>
        <View style={styles.taskListContainer}>
          {tasks.map((task, index) => (
            <Text key={index} style={styles.taskItem}>
              {"\u2022"} {task}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <View style={styles.container}>
        <View style={commonStyles.headingContainer}>
          <Text style={commonStyles.heading}>Jobs List</Text>
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
        {loading && <Text style={styles.statusText}>Loading jobs...</Text>}
        {error && <Text style={styles.statusText}>{error}</Text>}
        {!loading && jobs.length > 0 && (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            renderItem={renderJob}
            contentContainerStyle={{ paddingBottom: 20 }}
          />
        )}
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
    marginBottom: 20,
  },
  buttonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "600",
    textAlign: "center",
  },
  jobContainer: {
    flexDirection: "row",
    backgroundColor: color.white,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color.secondary,
    marginBottom: 15,
  },
  jobDetails: {
    flex: 0.3,
  },
  jobNum: {
    fontSize: fontSize.medium,
    color: color.primary,
    fontWeight: "600",
    marginBottom: 5,
  },
  taskListContainer: {
    flex: 0.7,
    paddingLeft: 10,
    borderLeftWidth: 1,
    borderColor: color.secondary,
  },
  taskItem: {
    fontSize: fontSize.medium,
    color: color.gray,
  },
  statusContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  statusText: {
    color: color.gray,
    fontWeight: "bold",
  },
});

export default JobsScreen;
