import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { memo, useCallback, useEffect, useMemo, useState } from "react";
import {
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import SkeletonLoader from "../components/SkeletonLoader";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { formatDate } from "../helper";
import { AppDispatch } from "../store";

import {
  fetchJobs,
  fetchJobTypes,
  selectJobsList,
  selectJobTypes,
  syncPendingJobs,
} from "../store/jobSlice";
import { Job, RootStackParamList } from "../types";

const JobItem = memo(
  ({
    item,
    typeName,
    onPress,
    onEdit,
  }: {
    item: Job;
    typeName: string;
    onPress: (item: Job) => void;
    onEdit: (item: Job) => void;
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
        ].filter((t) => t && t.trim()),
      [item]
    );

    const statusNum = Number(item.status);
    const statusBackground =
      statusNum === 1
        ? color.orange
        : statusNum === 2
        ? color.green
        : statusNum === 3
        ? color.red
        : color.gray;
    const statusText =
      statusNum === 1 ? "Open" : statusNum === 2 ? "Completed" : "Closed";

    return (
      <TouchableOpacity
        style={innerStyles.jobContainer}
        onPress={() => onPress(item)}
      >
        <View style={innerStyles.jobDetails}>
          <View>
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

          {statusNum === 1 && (
            <TouchableOpacity
              style={[styles.primaryButton, { marginTop: 10 }]}
              onPress={(e) => {
                e.stopPropagation();
                onEdit(item);
              }}
            >
              <Text style={styles.buttonText}>Edit</Text>
            </TouchableOpacity>
          )}
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

const JobItemSkeleton = memo(() => {
  return (
    <View style={innerStyles.jobContainer}>
      <View style={innerStyles.jobDetails}>
        <SkeletonLoader.Line
          width="50%"
          height={16}
          style={{ marginBottom: 5 }}
        />
        <SkeletonLoader.Line
          width="70%"
          height={12}
          style={{ marginBottom: 5 }}
        />
        <View style={{ height: 25, marginBottom: 5 }}>
          <SkeletonLoader.Line width="30%" height={20} />
        </View>
        <SkeletonLoader.Line width="40%" height={12} />
      </View>
      <View style={innerStyles.taskListContainer}>
        {[1, 2, 3].map((i) => (
          <SkeletonLoader.Line
            key={i}
            width="90%"
            height={12}
            style={{ marginBottom: 8 }}
          />
        ))}
      </View>
    </View>
  );
});

const PropertyBannerSkeleton = memo(() => (
  <View style={styles.screenBanner}>
    <SkeletonLoader.Line width="50%" height={14} style={{ marginBottom: 8 }} />
    <SkeletonLoader.Line width="80%" height={16} style={{ marginBottom: 4 }} />
    <SkeletonLoader.Line width="60%" height={12} />
  </View>
));

const JobsScreen = ({
  navigation,
  route,
}: NativeStackScreenProps<RootStackParamList, "JobsScreen">) => {
  const dispatch: AppDispatch = useDispatch();
  const {
    items: allJobs,
    loading,
    error,
    lastFetched,
  } = useSelector(selectJobsList);
  const { items: jobTypes } = useSelector(selectJobTypes);

  const [propertyData, setPropertyData] = useState<{
    address: string;
    company: string;
    id: string;
  } | null>(null);
  const [userData, setUserData] = useState<any>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [showSkeletons, setShowSkeletons] = useState(false);
  const [initialLoad, setInitialLoad] = useState(true);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(0);

  const jobTypeMap = useMemo(() => {
    const map = jobTypes.reduce(
      (map, jt) => ({
        ...map,
        [String(jt.id)]: jt.job_type || jt.label || "",
      }),
      {} as Record<string, string>
    );
    return map;
  }, [jobTypes]);

  const jobs = useMemo(() => {
    if (!propertyData || !allJobs.length) {
      return [];
    }

    // Normalize property ID to string for consistent comparison
    const propIdStr = String(propertyData.id);

    const filtered = allJobs.filter(
      (job) => String(job.property_id) === propIdStr
    );

    return filtered;
  }, [allJobs, propertyData]);

  // Load stored property & user
  useEffect(() => {
    let mounted = true;
    (async () => {
      const [prop, user] = await Promise.all([
        AsyncStorage.getItem("selectedProperty"),
        AsyncStorage.getItem("userData"),
      ]);
      if (!mounted) return;
      if (prop) {
        const parsed = JSON.parse(prop);
        setPropertyData(parsed);
      }

      if (user) {
        const parsed = JSON.parse(user);
        const uid = parsed.payload?.userid ?? parsed.userid;
        setUserData(parsed);
      }

      setInitialLoad(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  // Fetch job types once userData is ready
  useEffect(() => {
    if (userData) {
      const uid = userData.payload?.userid ?? userData.userid;
      dispatch(fetchJobTypes({ userId: uid }) as any);
    }
  }, [userData, dispatch]);

  // Handle skeleton loader visibility with delay to prevent flickering
  useEffect(() => {
    let skeletonTimer: NodeJS.Timeout;

    if (loading || initialLoad) {
      // Show skeletons after a small delay to avoid flickering
      skeletonTimer = setTimeout(() => {
        setShowSkeletons(true);
      }, 300); // 300ms delay before showing skeletons
    } else {
      setShowSkeletons(false);
    }

    return () => {
      clearTimeout(skeletonTimer);
    };
  }, [loading, initialLoad]);

  // Check for network connectivity
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      const offline = !state.isConnected;
      setIsOffline(offline);
    });

    return () => unsubscribe();
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!userData || !propertyData) {
        return;
      }

      const needsRefresh = route.params?.refresh === true;
      const MIN_REFRESH_INTERVAL = 2000; // 2 seconds
      const now = Date.now();
      const timeSinceLastRefresh = now - lastRefreshTime;
      if (timeSinceLastRefresh < MIN_REFRESH_INTERVAL && !needsRefresh) {
        return;
      }
      const CACHE_TIME = 5 * 60 * 1000;
      const isCacheValid = lastFetched && Date.now() - lastFetched < CACHE_TIME;
      if (!needsRefresh && isCacheValid) {
        return;
      }
      setRefreshing(true);
      setLastRefreshTime(now);
      const uid = userData.payload?.userid ?? userData.userid;
      dispatch(
        fetchJobs({
          userId: uid,
          propertyId: propertyData.id,
          force: needsRefresh,
        }) as any
      ).finally(() => {
        setRefreshing(false);

        if (needsRefresh && navigation.setParams) {
          setTimeout(() => {
            navigation.setParams({ refresh: false });
          }, 100);
        }
      });
    }, [
      userData,
      propertyData,
      lastFetched,
      route.params?.refresh,
      lastRefreshTime,
      navigation,
    ])
  );

  const onRefresh = useCallback(() => {
    if (!userData || !propertyData) {
      return;
    }
    setRefreshing(true);
    const uid = userData.payload?.userid ?? userData.userid;
    const propId = propertyData.id;

    if (isOffline) {
      // In offline mode, just refresh from local sources
      dispatch(fetchJobs({ userId: uid, propertyId: propId }) as any).finally(
        () => {
          setRefreshing(false);
        }
      );
    } else {
      // When online, try to sync pending jobs first, then refresh
      // Define interfaces for type safety
      interface SyncPendingJobsResult {
        success?: boolean;
        synced?: number;
        [key: string]: any; // For any additional properties in the result
      }

      type SyncError =
        | Error
        | {
            message: string;
            [key: string]: any;
          };

      dispatch(syncPendingJobs() as any)
        .then((result: SyncPendingJobsResult) => {
          return dispatch(
            fetchJobs({ userId: uid, propertyId: propId, force: true }) as any
          );
        })
        .catch((err: SyncError) => {
          return dispatch(
            fetchJobs({ userId: uid, propertyId: propId, force: true }) as any
          );
        })
        .finally(() => {
          setRefreshing(false);
        });
    }
  }, [userData, propertyData, dispatch, isOffline]);

  const handleJobPress = useCallback(
    async (item: Job) => {
      await AsyncStorage.setItem("jobData", JSON.stringify(item));
      const jobId = item.id || "";
      navigation.navigate("JobDetailScreen", {
        id: jobId,
        common_id: item.common_id || "", // Pass common_id as empty string if null
        refresh: true,
        materialCost: item.material_cost || "",
      });
    },
    [navigation]
  );

  const handleEditJob = useCallback(
    (item: Job) => {
      navigation.navigate("CreateEditJobScreen", {
        jobId: item.id,
        common_id: item.common_id,
        isEditMode: true,
      });
    },
    [navigation]
  );

  const handleOpenNewJob = () => {
    navigation.navigate("CreateEditJobScreen");
  };

  // We separate initial loading from refresh loading
  const shouldShowContent = !initialLoad && propertyData && !showSkeletons;

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Jobs List</Text>
        </View>
        {showSkeletons ? (
          <>
            <PropertyBannerSkeleton />
            <SkeletonLoader.Line
              width="100%"
              height={48}
              style={{
                borderRadius: 24,
                marginVertical: 16,
              }}
            />

            {[1, 2, 3, 4].map((i) => (
              <JobItemSkeleton key={i} />
            ))}
          </>
        ) : shouldShowContent ? (
          <>
            <View style={styles.screenBanner}>
              <Text style={styles.bannerLabel}>Selected Property:</Text>
              <Text style={styles.bannerText}>{propertyData.address}</Text>
              <Text style={styles.extraSmallText}>{propertyData.company}</Text>
            </View>

            <TouchableOpacity
              style={styles.primaryButton}
              onPress={handleOpenNewJob}
            >
              <Text style={styles.buttonText}>Open New Job</Text>
            </TouchableOpacity>

            {error && <Text style={styles.errorText}>{error}</Text>}

            <FlatList
              data={jobs}
              keyExtractor={(item) => item.id}
              renderItem={({ item }) => (
                <JobItem
                  item={item}
                  typeName={jobTypeMap[item.job_type] ?? ""}
                  onPress={handleJobPress}
                  onEdit={handleEditJob}
                />
              )}
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
          </>
        ) : null}
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
    paddingRight: 15,
    justifyContent: "space-between",
    display: "flex",
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
  taskItem: { fontSize: fontSize.medium, color: color.gray },
  statusContainer: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 5,
    alignSelf: "flex-start",
    marginTop: 5,
  },
  statusText: { color: color.white, fontWeight: "semibold" },
});

export default JobsScreen;
