import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useFocusEffect } from "@react-navigation/native";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";

import { Header } from "../components";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { RootState } from "../store";
import { fetchContractors } from "../store/contractorSlice";
import { fetchCosts, selectCostsForJobWithNames } from "../store/costsSlice";
import { fetchJobs, selectJobsList } from "../store/jobSlice";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "JobDetailScreen">;

const JobDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id: jobId } = route.params;
  const dispatch = useDispatch();
  const [userId, setUserId] = useState<string | null>(null);
  const [property, setProperty] = useState<{
    address: string;
    company: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  // Redux selectors
  const { items: jobItems } = useSelector(selectJobsList);
  const jobDetail = useMemo(
    () => jobItems.find((j) => j.id === jobId),
    [jobItems, jobId]
  );
  const costs = useSelector((state: RootState) =>
    selectCostsForJobWithNames(state, jobId)
  );
  const costsLoading = useSelector((state: RootState) => state.cost.loading);

  // Load local storage
  const loadLocalData = useCallback(async () => {
    try {
      const [userJson, propJson] = await Promise.all([
        AsyncStorage.getItem("userData"),
        AsyncStorage.getItem("selectedProperty"),
      ]);
      if (userJson) {
        const user = JSON.parse(userJson);
        setUserId(user.payload?.userid ?? user.userid ?? null);
      }
      if (propJson) {
        setProperty(JSON.parse(propJson));
      }
    } catch (e) {
      console.error("Error loading local data", e);
    }
  }, []);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // Whenever userId becomes available, fetch contractors & jobs
  useEffect(() => {
    if (!userId) return;
    dispatch(fetchContractors(userId) as any);
    dispatch(fetchJobs({ userId }) as any);
  }, [userId, dispatch]);

  // On screen focus, reload jobs + costs
  useFocusEffect(
    useCallback(() => {
      if (!userId) return;
      setIsLoading(true);
      Promise.all([
        dispatch(fetchJobs({ userId }) as any),
        dispatch(fetchContractors(userId) as any),
        dispatch(fetchCosts({ userId, jobId }) as any),
      ]).finally(() => setIsLoading(false));
    }, [userId, jobId, dispatch])
  );

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await Promise.all([
        dispatch(fetchJobs({ userId }) as any),
        dispatch(fetchContractors(userId) as any),
        dispatch(fetchCosts({ userId, jobId }) as any),
      ]);
    } catch (err) {
      console.error("Error reloading:", err);
    } finally {
      setRefreshing(false);
    }
  }, [userId, jobId, dispatch]);

  // Tasks array
  const tasks = useMemo(() => {
    if (!jobDetail) return [];
    return [
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
    ].filter((t): t is string => !!t?.trim());
  }, [jobDetail]);

  // Total cost
  const totalAmount = useMemo(() => {
    const sum = costs.reduce(
      (acc, c) => acc + parseFloat(String(c.amount ?? "0")),
      0
    );
    const mat = parseFloat(String(jobDetail?.material_cost || 0));
    const sc = parseFloat(String(jobDetail?.smart_care_amount || 0));
    return sum + mat + sc;
  }, [costs, jobDetail]);

  if (isLoading) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={innerStyles.loader}>
          <ActivityIndicator size="large" color={color.primary} />
        </View>
      </View>
    );
  }

  if (!jobDetail) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <View style={innerStyles.loader}>
          <Text style={styles.errorText}>No job details available.</Text>
        </View>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={{ ...styles.container, width: "100%" }}>
        <View style={innerStyles.fixedSection}>
          <View style={styles.headingContainer}>
            <Text style={styles.heading}>Job Detail</Text>
          </View>

          {property && (
            <View style={styles.screenBanner}>
              <Text style={styles.bannerLabel}>Selected Property:</Text>
              <Text style={styles.bannerText}>{property.address}</Text>
              <Text style={styles.extraSmallText}>{property.company}</Text>
            </View>
          )}

          <TouchableOpacity
            style={styles.primaryButton}
            onPress={() => navigation.navigate("UploadScreen", { jobId })}
          >
            <Text style={styles.buttonText}>Upload Files</Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={innerStyles.scrollableSection}
          contentContainerStyle={innerStyles.scrollContent}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
          }
        >
          {/* Job Type */}
          <View style={{ marginVertical: 10 }}>
            <Text style={styles.label}>Job Type</Text>
            <Text style={styles.smallText}>{jobDetail.job_type}</Text>
          </View>

          {/* Tasks */}
          {tasks.length > 0 && (
            <View style={{ marginVertical: 10 }}>
              <Text style={styles.label}>Tasks</Text>
              {tasks.map((t, i) => (
                <Text key={i} style={styles.smallText}>
                  {`\u2022 ${t}`}
                </Text>
              ))}
            </View>
          )}

          {/* Costs */}
          <View style={{ marginVertical: 10 }}>
            <View style={innerStyles.sectionHeader}>
              <Text style={styles.label}>Costs</Text>
              {costsLoading && (
                <ActivityIndicator
                  size="small"
                  color={color.primary}
                  style={{ marginLeft: 8 }}
                />
              )}
            </View>

            <TouchableOpacity
              style={{
                ...styles.primaryButton,
                width: 120,
                marginVertical: 8,
              }}
              onPress={() => navigation.navigate("AddCostsScreen", { jobId })}
            >
              <Text style={styles.buttonText}>Add Cost</Text>
            </TouchableOpacity>

            <View style={innerStyles.costItem}>
              <Text style={[styles.smallText, { fontWeight: "bold" }]}>
                Material Cost
              </Text>
              <Text style={innerStyles.costAmount}>
                £ {parseFloat(String(jobDetail.material_cost || 0)).toFixed(2)}
              </Text>
            </View>

            <View style={innerStyles.costItem}>
              <Text style={[styles.smallText, { fontWeight: "bold" }]}>
                Smart Care Cost
              </Text>
              <Text style={innerStyles.costAmount}>
                £{" "}
                {parseFloat(String(jobDetail.smart_care_amount || 0)).toFixed(
                  2
                )}
              </Text>
            </View>

            {costs.length > 0 ? (
              costs.map((c, idx) => (
                <View key={c.id ?? idx} style={innerStyles.costItem}>
                  <Text style={styles.smallText}>{c.name}</Text>
                  <Text style={innerStyles.costAmount}>
                    £ {parseFloat(String(c.amount ?? "0")).toFixed(2)}
                  </Text>
                </View>
              ))
            ) : (
              <Text style={innerStyles.noDataText}>No cost data available</Text>
            )}

            <View style={innerStyles.totalContainer}>
              <Text style={innerStyles.totalLabel}>Total Cost</Text>
              <Text style={innerStyles.totalAmount}>
                £ {totalAmount.toFixed(2)}
              </Text>
            </View>
          </View>

          {/* File counts */}
          <View style={innerStyles.countsContainer}>
            <TouchableOpacity
              style={innerStyles.countBlock}
              onPress={() =>
                navigation.navigate("MediaPreviewScreen", {
                  jobId,
                  fileCategory: "image",
                })
              }
            >
              <View style={innerStyles.countItemRow}>
                <MaterialCommunityIcons
                  name="image"
                  size={40}
                  color="#1f3759"
                />
                <Text style={innerStyles.countItem}>
                  {jobDetail.image_file_count}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={innerStyles.countBlock}
              onPress={() =>
                navigation.navigate("MediaPreviewScreen", {
                  jobId,
                  fileCategory: "document",
                })
              }
            >
              <View style={innerStyles.countItemRow}>
                <MaterialCommunityIcons
                  name="file-document"
                  size={40}
                  color="#1f3759"
                />
                <Text style={innerStyles.countItem}>
                  {jobDetail.doc_file_count}
                </Text>
              </View>
            </TouchableOpacity>

            <TouchableOpacity
              style={innerStyles.countBlock}
              onPress={() =>
                navigation.navigate("MediaPreviewScreen", {
                  jobId,
                  fileCategory: "video",
                })
              }
            >
              <View style={innerStyles.countItemRow}>
                <MaterialCommunityIcons
                  name="video"
                  size={40}
                  color="#1f3759"
                />
                <Text style={innerStyles.countItem}>
                  {jobDetail.video_file_count}
                </Text>
              </View>
            </TouchableOpacity>
          </View>
        </ScrollView>
      </View>
    </View>
  );
};

const innerStyles = StyleSheet.create({
  fixedSection: { width: "100%" },
  scrollableSection: { flex: 1, width: "100%" },
  scrollContent: {
    paddingBottom: 20,
    paddingHorizontal: 15,
    width: "100%",
  },
  sectionHeader: { flexDirection: "row", alignItems: "center" },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },

  costItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 4,
  },
  costAmount: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  noDataText: {
    fontSize: fontSize.medium,
    fontStyle: "italic",
    color: color.gray,
    marginVertical: 4,
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: color.secondary,
    paddingVertical: 8,
    marginTop: 6,
  },
  totalLabel: {
    fontSize: fontSize.large,
    fontWeight: "bold",
    flex: 2,
  },
  totalAmount: {
    fontSize: fontSize.large,
    fontWeight: "bold",
    flex: 1,
    textAlign: "right",
  },

  countsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginVertical: 20,
    width: "100%",
  },
  countBlock: { flex: 1, alignItems: "center" },
  countItemRow: { flexDirection: "row", alignItems: "center" },
  countItem: {
    fontSize: fontSize.xl,
    marginLeft: 5,
    fontWeight: "bold",
    color: "#1f3759",
  },
});

export default JobDetailScreen;
