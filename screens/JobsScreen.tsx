import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState, memo } from "react";
import {
  ActivityIndicator,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { fetchJobs, selectJobsList } from "../store/jobSlice";
import { Job, RootStackParamList } from "../types";

// Memoized Job item component to improve FlatList performance
const JobItem = memo(
  ({ item, onPress }: { item: Job; onPress: (item: Job) => void }) => {
    const tasks = useMemo(
      () =>
        [
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
        ].filter((task) => task && task.trim().length > 0),
      [item]
    );

    const getStatusBackground = useCallback((status: number) => {
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
    }, []);

    const statusBackground = useMemo(
      () => getStatusBackground(Number(item.status)),
      [item.status, getStatusBackground]
    );

    const statusText = useMemo(() => {
      return Number(item.status) === 1
        ? "Open"
        : Number(item.status) === 2
        ? "Completed"
        : "Closed";
    }, [item.status]);

    const handleJobPress = useCallback(() => {
      onPress(item);
    }, [item, onPress]);

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
              { backgroundColor: statusBackground },
            ]}
          >
            <Text style={innerStyles.statusText}>{statusText}</Text>
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
  }
);

const JobsScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "JobsScreen">) => {
  const dispatch = useDispatch();
  const { items: allJobs, loading, error } = useSelector(selectJobsList);

  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
    id: string;
  } | null>(null);
  const [userData, setUserData] = useState<any>(null);

  // Filter jobs for the current property
  const jobs = useMemo(() => {
    if (!propertyData) return [];
    return allJobs.filter((job) => job.property_id === propertyData.id);
  }, [allJobs, propertyData]);

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

  // Define fetchJobsData as a callback function
  const fetchJobsData = useCallback(async () => {
    if (!userData) return;

    try {
      const userid = userData.payload?.userid ?? userData.userid;
      // Dispatch the fetch jobs action - only using userId
      dispatch(
        fetchJobs({
          userId: userid,
        }) as any
      );
    } catch (err) {
      console.error("Error dispatching fetchJobs", err);
    }
  }, [userData, dispatch]);

  // Initial fetch when user data changes
  useEffect(() => {
    fetchJobsData();
  }, [fetchJobsData]);

  // Re-fetch jobs whenever the screen comes into focus
  useFocusEffect(
    useCallback(() => {
      fetchJobsData();
    }, [fetchJobsData])
  );

  // Handle job item press
  const handleJobPress = useCallback(
    async (item: Job) => {
      try {
        await AsyncStorage.setItem("jobData", JSON.stringify(item));
        navigation.navigate("JobDetailScreen", { id: item.id });
      } catch (err) {
        console.error("Error storing job data", err);
      }
    },
    [navigation]
  );

  // Optimized renderItem function
  const renderJob = useCallback(
    ({ item }: { item: Job }) => {
      return <JobItem item={item} onPress={handleJobPress} />;
    },
    [handleJobPress]
  );

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
