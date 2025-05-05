import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
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
import styles from "../Constants/styles";

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
        // // console.error("Error retrieving stored data", err);
      }
    };
    fetchStoredData();
  }, []);

  // Define fetchJobs as a callback function
  const fetchJobs = useCallback(async () => {
    if (!userData || !propertyData) return;
    setLoading(true);
    setError(null);

    try {
      const userid = userData.payload?.userid ?? userData.userid;
      const endpoint = `${baseApiUrl}/getjobs.php?userid=${userid}&property_id=${propertyData.id}`;
      const response = await fetch(endpoint);
      const json = await response.json();

      if (json.status === 1) {
        const sortedJobs = json.payload.sort(
          (a: Job, b: Job) =>
            new Date(b.date_created).getTime() -
            new Date(a.date_created).getTime()
        );

        if (sortedJobs.length > 0) {
          setJobs(sortedJobs);
        } else {
          // API says “OK” but no jobs found
          setJobs([]);
          setError("No jobs found with the selected property.");
        }
      } else {
        // status !== 1 => treat as “no jobs” rather than generic error
        setJobs([]);
        setError("No jobs found with the selected property.");
      }
    } catch (err) {
      // console.error("Error fetching jobs", err);
      setError("Error fetching jobs.");
    } finally {
      setLoading(false);
    }
  }, [userData, propertyData]);

  // Initial fetch when jobs or property/user data changes
  useEffect(() => {
    fetchJobs();
  }, [fetchJobs]);

  // Re-fetch jobs whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchJobs();
    }, [fetchJobs])
  );

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
        // console.error("Error storing job data", err);
      }
    };

    return (
      <TouchableOpacity
        style={innerStyles.jobContainer}
        onPress={handleJobPress}
      >
        <View style={innerStyles.jobDetails}>
          <Text style={innerStyles.jobNum}>{item.job_num}</Text>
          <Text>{item.date_created}</Text>

          <View
            style={[
              innerStyles.statusContainer,
              {
                backgroundColor: getStatusBackground(Number(item.status)),
              },
            ]}
          >
            <Text style={innerStyles.statusText}>
              {Number(item.status) === 1
                ? "Open"
                : Number(item.status) === 2
                ? "Completed"
                : "Closed"}
            </Text>
          </View>

          <Text>{item.job_type}</Text>
        </View>
        <View style={innerStyles.taskListContainer}>
          {tasks.map((task, index) => (
            <Text key={index} style={innerStyles.taskItem}>
              {"\u2022"} {task}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Jobs List</Text>
        </View>
        {propertyData && (
          <View style={styles.screenBanner}>
            <Text style={styles.bannerLabel}>Selected Property:</Text>
            <Text style={styles.bannerText}>{propertyData.address}</Text>
            <Text style={styles.extraSmallText}>{propertyData.company}</Text>
          </View>
        )}
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => navigation.navigate("OpenNewJobScreen")}
        >
          <Text style={styles.buttonText}>Open New Job</Text>
        </TouchableOpacity>
        {loading && <ActivityIndicator color={color.primary} />}
        {!loading && error && <Text style={styles.errorText}>{error}</Text>}
        {!loading && !error && jobs.length > 0 && (
          <FlatList
            data={jobs}
            keyExtractor={(item) => item.id}
            renderItem={renderJob}
            contentContainerStyle={{ paddingBottom: 20 }}
            style={{ width: "100%" }}
          />
        )}
      </View>
    </View>
  );
};

const innerStyles = StyleSheet.create({
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
    color: color.white,
    fontWeight: "semibold",
  },
});

export default JobsScreen;
