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
    const tasks = useMemo(() => {
      return [
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
      ].filter((t) => t && t.trim());
    }, [item]);

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
  const [isManualRefreshing, setIsManualRefreshing] = useState(false);
  const [isOffline, setIsOffline] = useState(false);
  const [lastRefreshTime, setLastRefreshTime] = useState<number>(Date.now());

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

  // Add a ref to track if initial fetch has happened
  const initialFetchDone = React.useRef(false);

  // Modified jobs useMemo with more debugging
  const jobs = useMemo(() => {
    if (!propertyData) {
      return [];
    }

    if (!allJobs || allJobs.length === 0) {
      return [];
    }

    // Normalize property ID to string for consistent comparison
    const propIdStr = String(propertyData.id);

    const filtered = allJobs.filter((job) => {
      const jobPropId = String(job.property_id);
      const matches = jobPropId === propIdStr;
      if (matches) return matches;
    });

    return filtered;
  }, [allJobs, propertyData]);

  // Add a useEffect to force an initial fetch when both userData and propertyData are available
  useEffect(() => {
    if (userData && propertyData && !initialFetchDone.current && !loading) {
      const uid = userData.payload?.userid ?? userData.userid;
      initialFetchDone.current = true;

      // Force a fetch with force=true to bypass cache
      // Define interfaces for typed responses
      interface FetchJobsResult {
        payload: JobPayload[];
        type: string;
        meta?: any;
      }

      interface JobPayload {
        id: string;
        job_num: string;
        property_id: string | number;
      }

      dispatch(
        fetchJobs({
          userId: uid,
          propertyId: propertyData.id,
          force: true,
          useCache: false,
        }) as any
      );
    }
  }, [userData, propertyData, dispatch, loading]);

  // Handle skeleton loader visibility with delay to prevent flickering
  useEffect(() => {
    let skeletonTimer: NodeJS.Timeout;

    // Show skeletons when loading, unless it's a manual pull-to-refresh
    if ((loading && !isManualRefreshing) || initialLoad) {
      // Show skeletons after a small delay to avoid flickering
      skeletonTimer = setTimeout(() => {
        setShowSkeletons(true);
      }, 200); // Reduced delay to make skeleton appear faster
    } else {
      setShowSkeletons(false);
    }

    return () => {
      clearTimeout(skeletonTimer);
    };
  }, [loading, initialLoad, isManualRefreshing]);

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
      const timeSinceLastRefresh = Math.max(0, now - lastRefreshTime);
      // Modified condition to force refresh if jobs is empty but we should have jobs
      const shouldForceRefresh = jobs.length === 0 && allJobs.length > 0;

      if (
        timeSinceLastRefresh < MIN_REFRESH_INTERVAL &&
        !needsRefresh &&
        !shouldForceRefresh
      ) {
        return;
      }

      const CACHE_TIME = 5 * 60 * 1000;
      const isCacheValid = lastFetched && Date.now() - lastFetched < CACHE_TIME;

      if (
        !needsRefresh &&
        isCacheValid &&
        jobs.length > 0 &&
        !shouldForceRefresh
      ) {
        return;
      }

      // We're doing a screen focus refresh, not a manual pull-to-refresh
      setRefreshing(true);
      setLastRefreshTime(now);
      const uid = userData.payload?.userid ?? userData.userid;

      // Get network status
      NetInfo.fetch().then((state) => {
        const isConnected = !!state.isConnected;
        interface FetchJobsResult {
          payload: JobPayload[];
          type: string;
          meta?: any;
        }

        interface JobPayload {
          id: string;
          property_id: string | number;
          job_num?: string;
          common_id?: string;
        }

        interface FetchJobsParams {
          userId: string;
          propertyId: string;
          force: boolean;
          useCache: boolean;
        }

        dispatch(
          fetchJobs({
            userId: uid,
            propertyId: propertyData.id,
            force: isConnected || needsRefresh || shouldForceRefresh,
            useCache: !isConnected,
          } as FetchJobsParams) as any
        )
          .then((result: FetchJobsResult) => {
            if (result.payload) {
              // Debug the returned job propertyIds to verify correct data
              const returnedPropertyIds = result.payload.map((j: JobPayload) =>
                String(j.property_id)
              );
              // Check if any jobs match our property
              const matchingJobs = result.payload.filter(
                (j: JobPayload) =>
                  String(j.property_id) === String(propertyData.id)
              );
            }
          })
          .finally(() => {
            setRefreshing(false);

            if (needsRefresh && navigation.setParams) {
              setTimeout(() => {
                navigation.setParams({ refresh: false });
              }, 100);
            }
          });
      });
    }, [
      userData,
      propertyData,
      lastFetched,
      route.params?.refresh,
      lastRefreshTime,
      navigation,
      jobs.length,
      allJobs.length,
    ])
  );

  const onRefresh = useCallback(() => {
    if (!userData || !propertyData) {
      return;
    }

    // This is a manual pull-to-refresh, so we use isManualRefreshing
    setRefreshing(true);
    setIsManualRefreshing(true);

    const uid = userData.payload?.userid ?? userData.userid;
    const propId = propertyData.id;

    if (isOffline) {
      // In offline mode, explicitly set useCache to true
      dispatch(
        fetchJobs({
          userId: uid,
          propertyId: propId,
          useCache: true,
        }) as any
      ).finally(() => {
        setRefreshing(false);
        setIsManualRefreshing(false);
      });
    } else {
      dispatch(syncPendingJobs() as any)
        .then(() => {
          return dispatch(
            fetchJobs({
              userId: uid,
              propertyId: propId,
              force: true,
              useCache: false,
            }) as any
          );
        })
        .catch(() => {
          return dispatch(
            fetchJobs({
              userId: uid,
              propertyId: propId,
              force: true,
              useCache: false,
            }) as any
          );
        })
        .finally(() => {
          setRefreshing(false);
          setIsManualRefreshing(false);
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
  // Show content when NOT initial loading AND we have property data AND we're not showing skeletons
  const shouldShowContent = !initialLoad && propertyData && !showSkeletons;

  // Enhanced useEffect for loading stored property & user
  useEffect(() => {
    let mounted = true;

    (async () => {
      try {
        // First, let's check if we have property data directly
        const rawProp = await AsyncStorage.getItem("selectedProperty");
        // Try to fetch user data and property data in parallel
        const [prop, user] = await Promise.all([
          rawProp || AsyncStorage.getItem("selectedProperty"),
          AsyncStorage.getItem("userData"),
        ]);

        if (!mounted) return;

        // Handle property data with better error checking
        if (prop) {
          try {
            const parsed = JSON.parse(prop);
            if (!parsed.id || !parsed.address) {
              console.error(
                "[JobsScreen:useEffect] Property data invalid, missing id or address:",
                parsed
              );
              // Try to recover by checking if we can find the data elsewhere
              const selectedPropId = await AsyncStorage.getItem(
                "selectedPropertyId"
              );
              if (selectedPropId) {
                // If we have at least an ID, create a minimal valid property object
                setPropertyData({
                  id: selectedPropId,
                  address: "Property ID: " + selectedPropId,
                  company: "Unknown company",
                });
              }
            } else {
              setPropertyData(parsed);
            }
          } catch (parseError) {
            console.error(
              "[JobsScreen:useEffect] Error parsing property data:",
              parseError,
              "Raw data:",
              prop
            );
          }
        } else {
          // Try alternate property storage locations as a fallback
          try {
            const propId = await AsyncStorage.getItem("selectedPropertyId");
            if (propId) {
              setPropertyData({
                id: propId,
                address: "Property ID: " + propId,
                company: "Unknown company",
              });
            } else {
              // Check if there's a default property we could use
              const allProps = await AsyncStorage.getItem("allProperties");
              if (allProps) {
                const properties = JSON.parse(allProps);
                if (properties && properties.length > 0) {
                  setPropertyData(properties[0]);
                }
              }
            }
          } catch (fallbackError) {
            console.error(
              "[JobsScreen:useEffect] Fallback strategy failed:",
              fallbackError
            );
          }
        }

        // Handle user data
        if (user) {
          try {
            const parsed = JSON.parse(user);
            const uid = parsed.payload?.userid ?? parsed.userid;
            setUserData(parsed);
          } catch (parseError) {
            console.error(
              "[JobsScreen:useEffect] Error parsing user data:",
              parseError
            );
          }
        }

        setInitialLoad(false);
      } catch (err) {
        console.error("[JobsScreen:useEffect] Error loading stored data:", err);
        if (mounted) setInitialLoad(false);
      }
    })();

    return () => {
      mounted = false;
    };
  }, []);

  // Add a property data debug button if needed
  const debugPropertyData = async () => {
    try {
      // Check all possible storage locations
      const checks = [
        "selectedProperty",
        "selectedPropertyId",
        "allProperties",
      ];

      for (const key of checks) {
        const value = await AsyncStorage.getItem(key);
        if (value) {
          try {
            const parsed = JSON.parse(value);
          } catch (e) {}
        }
      }
    } catch (err) {
      console.error("[JobsScreen:debugPropertyData] Error:", err);
    }
  };

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

            {jobs.length === 0 && !error && (
              <Text style={{ textAlign: "center" }}>
                No jobs found for this property.
              </Text>
            )}

            <FlatList
              data={jobs}
              keyExtractor={(item) =>
                item.id || item.common_id || String(Math.random())
              }
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
