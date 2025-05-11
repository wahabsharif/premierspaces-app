import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useMemo, useState } from "react";
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
import { useReloadOnFocus } from "../hooks";
import { RootState } from "../store";
import {
  Contractor,
  fetchContractors,
  selectContractorsForJob,
  selectContractorsLoading,
} from "../store/contractorSlice";
import { fetchJobs, selectJobsList } from "../store/jobSlice";
import { RootStackParamList } from "../types";

interface Property {
  address: string;
  company: string;
  id: string;
}

interface JobDetail {
  job_type: string;
  task1?: string;
  task2?: string;
  task3?: string;
  task4?: string;
  task5?: string;
  task6?: string;
  task7?: string;
  task8?: string;
  task9?: string;
  task10?: string;
  image_file_count: number;
  doc_file_count: number;
  video_file_count: number;
  id: string;
}

type Props = NativeStackScreenProps<RootStackParamList, "JobDetailScreen">;

const JobDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id: jobId } = route.params;
  const dispatch = useDispatch();
  const [userId, setUserId] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);

  // Get jobs and job loading state from Redux store
  const {
    items: jobItems,
    loading: jobsLoading,
    error: jobsError,
  } = useSelector(selectJobsList);

  // Get the specific job from the jobs list
  const jobDetail = useMemo(
    () =>
      jobItems.find((job) => job.id === jobId) as unknown as
        | JobDetail
        | undefined,
    [jobItems, jobId]
  );

  // Get contractors from Redux store using memoized selector
  const contractors = useSelector((state: RootState) =>
    selectContractorsForJob(state, jobId)
  );
  const contractorsLoading = useSelector(selectContractorsLoading);

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
        const property = JSON.parse(propJson);
        console.log("Property saved to AsyncStorage:", property);
        setProperty(property);
      }
    } catch (e) {
      console.error("Error loading local data", e);
    }
  }, []);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  // Fetch jobs using Redux action
  useEffect(() => {
    if (userId) {
      dispatch(fetchJobs({ userId }) as any);
    }
  }, [userId, dispatch]);

  // Fetch contractors using Redux action
  useEffect(() => {
    if (userId && jobId) {
      dispatch(fetchContractors({ userId, jobId }) as any);
    }
  }, [userId, jobId, dispatch]);

  // Reload data when screen comes into focus
  const reloadData = useCallback(async () => {
    if (userId) {
      await dispatch(fetchJobs({ userId }) as any);
      if (jobId) {
        await dispatch(fetchContractors({ userId, jobId }) as any);
      }
    }
  }, [userId, jobId, dispatch]);

  useReloadOnFocus(reloadData);

  const tasks = useMemo(
    () =>
      [
        jobDetail?.task1,
        jobDetail?.task2,
        jobDetail?.task3,
        jobDetail?.task4,
        jobDetail?.task5,
        jobDetail?.task6,
        jobDetail?.task7,
        jobDetail?.task8,
        jobDetail?.task9,
        jobDetail?.task10,
      ].filter((t): t is string => Boolean(t && t.trim())),
    [jobDetail]
  );

  // Calculate total amount from contractors array
  const totalAmount = useMemo(() => {
    if (!Array.isArray(contractors)) {
      return 0;
    }

    return contractors.reduce((sum, c) => {
      // Parse amount safely, defaulting to 0 if invalid
      const amount = c.amount ? parseFloat(c.amount) : 0;
      return sum + (isNaN(amount) ? 0 : amount);
    }, 0);
  }, [contractors]);

  const renderTask = ({ item }: { item: string }) => (
    <Text style={styles.smallText}>{`\u2022 ${item}`}</Text>
  );

  if (jobsLoading) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1f3759" />
      </View>
    );
  }

  if (jobsError || !jobDetail) {
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={styles.errorText}>
          {jobsError ?? "No job details available."}
        </Text>
      </View>
    );
  }

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
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
        <View style={{ width: "100%", marginVertical: 10 }}>
          <Text style={styles.label}>Job Type</Text>
          <Text style={styles.smallText}>{jobDetail.job_type}</Text>
        </View>

        {tasks.length > 0 && (
          <View style={{ width: "100%", marginVertical: 10 }}>
            <Text style={styles.label}>Tasks</Text>
            <FlatList
              data={tasks}
              keyExtractor={(_, i) => i.toString()}
              renderItem={renderTask}
            />
          </View>
        )}

        <View style={{ width: "100%" }}>
          <Text style={{ ...styles.label, alignItems: "center" }}>Costs</Text>
          <TouchableOpacity
            style={{ ...styles.primaryButton, width: 120 }}
            // onPress={() => navigation.navigate("AddCostScreen", { jobId })}
          >
            <Text style={styles.buttonText}>Add Cost</Text>
          </TouchableOpacity>
          {contractorsLoading ? (
            <ActivityIndicator size="small" color="#1f3759" />
          ) : Array.isArray(contractors) && contractors.length > 0 ? (
            <>
              {contractors.map((c: Contractor, idx: number) => (
                <View key={idx} style={innerStyles.costItem}>
                  <Text style={styles.smallText}>{c.name || "Unknown"}</Text>
                  <Text style={innerStyles.contractorAmount}>
                    {`£ ${parseFloat(c.amount || "0").toFixed(2)}`}
                  </Text>
                </View>
              ))}
              <View style={innerStyles.totalContainer}>
                <Text style={innerStyles.totalLabel}>Total Cost</Text>
                <Text style={innerStyles.totalAmount}>
                  {`£ ${totalAmount.toFixed(2)}`}
                </Text>
              </View>
            </>
          ) : (
            <Text style={innerStyles.noDataText}>No cost data available</Text>
          )}
        </View>

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
              <MaterialCommunityIcons name="image" size={40} color="#1f3759" />
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
              <MaterialCommunityIcons name="video" size={40} color="#1f3759" />
              <Text style={innerStyles.countItem}>
                {jobDetail.video_file_count}
              </Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
};

const innerStyles = StyleSheet.create({
  taskItem: { fontSize: fontSize.medium, color: color.gray, paddingLeft: 10 },
  countsContainer: {
    flexDirection: "row",
    justifyContent: "space-around",
    marginTop: 20,
    width: "100%",
  },
  countBlock: {
    flex: 1,
    alignItems: "center",
  },
  countItemRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  countItem: {
    fontSize: fontSize.xl,
    marginLeft: 5,
    fontWeight: "bold",
    color: "#1f3759",
  },
  costItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  contractorAmount: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    flex: 1,
    textAlign: "right",
  },
  noDataText: {
    fontSize: fontSize.medium,
    fontStyle: "italic",
    color: color.gray,
  },
  totalContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderTopWidth: 1,
    borderTopColor: color.secondary,
    paddingVertical: 8,
    marginTop: 5,
  },
  totalLabel: { fontSize: fontSize.medium, fontWeight: "bold", flex: 2 },
  totalAmount: {
    fontSize: fontSize.large,
    fontWeight: "bold",
    flex: 1,
    textAlign: "right",
  },
});

export default JobDetailScreen;
