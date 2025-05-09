import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, {
  memo,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { formatDate } from "../helper";
import { useReloadOnFocus } from "../hooks";
import { getAllJobs } from "../services/jobService";
import {
  fetchJobs,
  fetchJobTypes,
  resetJobsList,
  selectJobsList,
  selectJobTypes,
} from "../store/jobSlice";
import { Job, RootStackParamList } from "../types";

// Memoized JobItem now looks up human-readable type from Redux
const JobItem = memo(
  ({
    item,
    typeName,
    onPress,
  }: {
    item: Job;
    typeName: string;
    onPress: (item: Job) => void;
  }) => {
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
        ].filter((t) => t && t.trim().length > 0),
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

    const handlePress = useCallback(() => onPress(item), [item, onPress]);

    return (
      <TouchableOpacity style={innerStyles.jobContainer} onPress={handlePress}>
        <View style={innerStyles.jobDetails}>
          <Text style={innerStyles.jobNum}>{item.job_num}</Text>
          <Text>{formatDate(item.date_created)}</Text>
          <View
            style={[
              innerStyles.statusContainer,
              { backgroundColor: statusBackground },
            ]}
          >
            <Text style={innerStyles.statusText}>{statusText}</Text>
          </View>
          <Text>{typeName}</Text>
        </View>
        <View style={innerStyles.taskListContainer}>
          {tasks.map((task, i) => (
            <Text key={i} style={innerStyles.taskItem}>
              {"\u2022"} {task}
            </Text>
          ))}
        </View>
      </TouchableOpacity>
    );
  }
);

const NoJobsFound = ({ address }: { address: string }) => (
  <View style={innerStyles.noJobsContainer}>
    <Text style={innerStyles.noJobsText}>No Jobs Found for {address}</Text>
  </View>
);

const JobsScreen = ({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "JobsScreen">) => {
  const dispatch = useDispatch();
  const { items: allJobs, loading, error } = useSelector(selectJobsList);
  const { items: jobTypes } = useSelector(selectJobTypes);
  const [refreshing, setRefreshing] = useState(false);
  const [offlineJobs, setOfflineJobs] = useState<Job[]>([]);
  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
    id: string;
  } | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const isFetchingRef = useRef(false);

  // Build a lookup map from ID -> display name
  const jobTypeMap = useMemo(
    () =>
      jobTypes.reduce(
        (map, jt) => ({ ...map, [String(jt.id)]: jt.name || jt.label || "" }),
        {} as Record<string, string>
      ),
    [jobTypes]
  );

  // Merge online + offline
  const jobs = useMemo(() => {
    if (!propertyData) return [];
    const combined = [...allJobs];
    offlineJobs.forEach((oj) => {
      if (
        oj.property_id === propertyData.id &&
        !combined.some((j) => j.id === oj.id)
      ) {
        combined.push(oj);
      }
    });
    // Filter & sort
    return combined
      .filter((j) => j.property_id === propertyData.id)
      .sort(
        (a, b) =>
          new Date(b.date_created).getTime() -
          new Date(a.date_created).getTime()
      );
  }, [allJobs, offlineJobs, propertyData]);

  // Load AsyncStorage
  useEffect(() => {
    (async () => {
      try {
        const p = await AsyncStorage.getItem("selectedProperty");
        const u = await AsyncStorage.getItem("userData");
        if (p) setPropertyData(JSON.parse(p));
        if (u) setUserData(JSON.parse(u));
      } catch (e) {
        console.error(e);
      }
    })();
  }, []);

  // Load offline jobs from SQLite
  const loadOfflineJobs = useCallback(async () => {
    try {
      const local = await getAllJobs();
      setOfflineJobs(local);
    } catch (e) {
      console.error(e);
    }
  }, []);

  // Fetch job types once we have userData
  useEffect(() => {
    if (userData) {
      const uid = userData.payload?.userid ?? userData.userid;
      dispatch(fetchJobTypes({ userId: uid }) as any);
    }
  }, [userData, dispatch]);

  // Unified fetch (jobs + offline + optional reset)
  const fetchJobsData = useCallback(
    async (force = false) => {
      if (isFetchingRef.current) return;
      isFetchingRef.current = true;
      try {
        if (!userData) return;
        const uid = userData.payload?.userid ?? userData.userid;
        if (force) dispatch(resetJobsList());
        setRefreshing(true);
        await loadOfflineJobs();
        dispatch(
          fetchJobs({ userId: uid, propertyId: propertyData?.id }) as any
        );
      } finally {
        setRefreshing(false);
        isFetchingRef.current = false;
      }
    },
    [userData, dispatch, propertyData, loadOfflineJobs]
  );

  // Initial + on focus + on pull
  useEffect(() => {
    fetchJobsData();
  }, [fetchJobsData]);
  useReloadOnFocus(() => fetchJobsData(true));

  const onRefresh = useCallback(() => fetchJobsData(true), [fetchJobsData]);

  const handlePress = useCallback(
    async (job: Job) => {
      await AsyncStorage.setItem("jobData", JSON.stringify(job));
      navigation.navigate("JobDetailScreen", { id: job.id });
    },
    [navigation]
  );

  const renderJob = useCallback(
    ({ item }: { item: Job }) => {
      const typeName = jobTypeMap[item.job_type] ?? item.job_type;
      return <JobItem item={item} typeName={typeName} onPress={handlePress} />;
    },
    [jobTypeMap, handlePress]
  );

  // Handle external refresh param
  useEffect(() => {
    if (route.params?.refresh) {
      navigation.setParams({ refresh: undefined });
      fetchJobsData(true);
    }
  }, [route.params, navigation, fetchJobsData]);

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

        {loading && !refreshing && <ActivityIndicator color={color.primary} />}
        {!loading && error && <Text style={styles.errorText}>{error}</Text>}

        {!loading &&
          !error &&
          (jobs.length > 0 ? (
            <FlatList
              data={jobs}
              keyExtractor={(j) => j.id}
              renderItem={renderJob}
              contentContainerStyle={{ paddingBottom: 20 }}
              style={{ width: "100%" }}
              refreshControl={
                <RefreshControl
                  refreshing={refreshing}
                  onRefresh={onRefresh}
                  colors={[color.primary]}
                />
              }
            />
          ) : (
            propertyData && <NoJobsFound address={propertyData.address} />
          ))}
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
    fontWeight: "600",
  },
  noJobsContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 50,
    width: "100%",
  },
  noJobsText: {
    fontSize: fontSize.large,
    color: color.gray,
    textAlign: "center",
    fontWeight: "500",
  },
});

export default JobsScreen;
