import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
import {
  RefreshControl,
  ScrollView,
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
import { useReloadOnFocus } from "../hooks";
import { RootState } from "../store";
import { fetchContractors } from "../store/contractorSlice";
import { fetchCosts, selectCostsForJobWithNames } from "../store/costsSlice";
import { fetchJobs, selectJobsList } from "../store/jobSlice";
import { RootStackParamList } from "../types";

type Props = NativeStackScreenProps<RootStackParamList, "JobDetailScreen">;

// Skeleton components for loading state
const PropertySkeleton = () => (
  <View style={styles.screenBanner}>
    <SkeletonLoader.Line width="40%" height={14} style={{ marginBottom: 8 }} />
    <SkeletonLoader.Line width="70%" height={16} style={{ marginBottom: 4 }} />
    <SkeletonLoader.Line width="50%" height={12} />
  </View>
);

const JobDetailSkeleton = () => (
  <>
    <View style={{ marginVertical: 10 }}>
      <SkeletonLoader.Line
        width="30%"
        height={16}
        style={{ marginBottom: 8 }}
      />
      <SkeletonLoader.Line width="60%" height={14} />
    </View>

    <View style={{ marginVertical: 10 }}>
      <SkeletonLoader.Line
        width="25%"
        height={16}
        style={{ marginBottom: 8 }}
      />
      {[1, 2, 3].map((i) => (
        <SkeletonLoader.Line
          key={i}
          width={`${70 + Math.random() * 20}%`}
          height={14}
          style={{ marginBottom: 6 }}
        />
      ))}
    </View>
  </>
);

const CostsSkeleton = () => (
  <View style={{ marginVertical: 10 }}>
    <SkeletonLoader.Line width="20%" height={16} style={{ marginBottom: 12 }} />

    <SkeletonLoader.Line
      width="35%"
      height={40}
      style={{
        borderRadius: 20,
        marginVertical: 8,
      }}
    />

    {[1, 2, 3].map((i) => (
      <View key={i} style={innerStyles.costItem}>
        <SkeletonLoader.Line width="40%" height={14} />
        <SkeletonLoader.Line
          width="20%"
          height={14}
          style={{ alignSelf: "flex-end" }}
        />
      </View>
    ))}

    <View style={innerStyles.totalContainer}>
      <SkeletonLoader.Line width="30%" height={18} />
      <SkeletonLoader.Line
        width="25%"
        height={18}
        style={{ alignSelf: "flex-end" }}
      />
    </View>
  </View>
);

const FileCountsSkeleton = () => (
  <View style={innerStyles.countsContainer}>
    {[1, 2, 3].map((i) => (
      <View key={i} style={innerStyles.countBlock}>
        <View style={innerStyles.countItemRow}>
          <SkeletonLoader.Circle size={40} />
          <SkeletonLoader.Line
            width={30}
            height={24}
            style={{ marginLeft: 5 }}
          />
        </View>
      </View>
    ))}
  </View>
);

const JobDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id: jobId } = route.params;
  const dispatch = useDispatch();
  const [userId, setUserId] = useState<string | null>(null);
  const [property, setProperty] = useState<{
    address: string;
    company: string;
  } | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [showSkeletons, setShowSkeletons] = useState(false);

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

  // Setup skeleton loader with delay to prevent flickering
  useEffect(() => {
    let skeletonTimer: NodeJS.Timeout;

    if (isLoading) {
      skeletonTimer = setTimeout(() => {
        setShowSkeletons(true);
      }, 300); // 300ms delay before showing skeletons
    } else {
      setShowSkeletons(false);
    }

    return () => {
      clearTimeout(skeletonTimer);
    };
  }, [isLoading]);

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

  // Function to load data
  const loadData = useCallback(async () => {
    if (!userId) return;
    setIsLoading(true);
    try {
      await Promise.all([
        dispatch(fetchJobs({ userId }) as any),
        dispatch(fetchContractors(userId) as any),
        dispatch(
          fetchCosts({
            userId,
            jobId,
            common_id: jobDetail?.common_id ?? "",
          }) as any
        ),
      ]);
    } catch (err) {
      console.error("Error loading data:", err);
    } finally {
      setIsLoading(false);
    }
  }, [userId, jobId, jobDetail?.common_id, dispatch]);

  // Use our custom hook to reload data when screen comes into focus
  useReloadOnFocus(loadData, [userId, jobId]);

  // Pull-to-refresh
  const onRefresh = useCallback(async () => {
    if (!userId) return;
    setRefreshing(true);
    try {
      await loadData();
    } catch (err) {
      console.error("Error refreshing:", err);
    } finally {
      setRefreshing(false);
    }
  }, [userId, loadData]);

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

  const showContent = !isLoading && jobDetail;
  const showError = !isLoading && !jobDetail;

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={{ ...styles.container, width: "100%" }}>
        <View style={innerStyles.fixedSection}>
          <View style={styles.headingContainer}>
            <Text style={styles.heading}>Job Detail</Text>
          </View>

          {showSkeletons ? (
            <PropertySkeleton />
          ) : (
            property && (
              <View style={styles.screenBanner}>
                <Text style={styles.bannerLabel}>Selected Property:</Text>
                <Text style={styles.bannerText}>{property.address}</Text>
                <Text style={styles.extraSmallText}>{property.company}</Text>
              </View>
            )
          )}

          {showSkeletons ? (
            <SkeletonLoader.Line
              width="100%"
              height={48}
              style={{
                borderRadius: 24,
                marginVertical: 8,
              }}
            />
          ) : (
            showContent && (
              <TouchableOpacity
                style={styles.primaryButton}
                onPress={() => {
                  const id = jobId || jobDetail?.job_id || "";
                  navigation.navigate("UploadScreen", {
                    job_id: id,
                    common_id: jobDetail.common_id,
                  });
                }}
              >
                <Text style={styles.buttonText}>Upload Files</Text>
              </TouchableOpacity>
            )
          )}
        </View>

        {showError ? (
          <View style={innerStyles.loader}>
            <Text style={styles.errorText}>No job details available.</Text>
          </View>
        ) : (
          <ScrollView
            style={innerStyles.scrollableSection}
            contentContainerStyle={innerStyles.scrollContent}
            refreshControl={
              <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
            }
          >
            {showSkeletons ? (
              <>
                <JobDetailSkeleton />
                <CostsSkeleton />
                <FileCountsSkeleton />
              </>
            ) : (
              showContent && (
                <>
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
                        <SkeletonLoader.Line
                          width={16}
                          height={16}
                          style={{
                            borderRadius: 8,
                            marginLeft: 8,
                          }}
                        />
                      )}
                    </View>

                    <TouchableOpacity
                      style={{
                        ...styles.primaryButton,
                        width: 120,
                        marginVertical: 8,
                      }}
                      onPress={() => {
                        navigation.navigate("AddCostsScreen", {
                          jobId,
                          materialCost: jobDetail?.material_cost,
                          common_id: jobDetail?.common_id ?? "",
                        });
                      }}
                    >
                      <Text style={styles.buttonText}>Add Cost</Text>
                    </TouchableOpacity>

                    {parseFloat(String(jobDetail.material_cost || 0)) > 0 && (
                      <View style={innerStyles.costItem}>
                        <Text
                          style={[styles.smallText, { fontWeight: "bold" }]}
                        >
                          Material Cost
                        </Text>
                        <Text style={innerStyles.costAmount}>
                          £{" "}
                          {parseFloat(String(jobDetail.material_cost)).toFixed(
                            2
                          )}
                        </Text>
                      </View>
                    )}

                    {parseFloat(String(jobDetail.smart_care_amount || 0)) >
                      0 && (
                      <View style={innerStyles.costItem}>
                        <Text
                          style={[styles.smallText, { fontWeight: "bold" }]}
                        >
                          Smart Care Cost
                        </Text>
                        <Text style={innerStyles.costAmount}>
                          £{" "}
                          {parseFloat(
                            String(jobDetail.smart_care_amount)
                          ).toFixed(2)}
                        </Text>
                      </View>
                    )}

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
                      <Text style={innerStyles.noDataText}>
                        No cost data available
                      </Text>
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
                </>
              )
            )}
          </ScrollView>
        )}
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
