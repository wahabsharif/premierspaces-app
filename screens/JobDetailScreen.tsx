import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import axios from "axios";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useEffect, useState, useCallback, useMemo } from "react";
import {
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  FlatList,
} from "react-native";
import Header from "../components/Common/Header";
import { baseApiUrl } from "../Constants/env";
import { color, fontSize } from "../Constants/theme";
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
}

interface Contractor {
  name: string;
  amount: string;
}

type Props = NativeStackScreenProps<RootStackParamList, "JobDetailScreen">;

const JobDetailScreen: React.FC<Props> = ({ route, navigation }) => {
  const { id: jobId } = route.params;
  const [userId, setUserId] = useState<string | null>(null);
  const [property, setProperty] = useState<Property | null>(null);
  const [jobDetail, setJobDetail] = useState<JobDetail | null>(null);
  const [contractors, setContractors] = useState<Contractor[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Load user and property from AsyncStorage
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
      if (propJson) setProperty(JSON.parse(propJson));
    } catch (e) {
      console.error("Error loading local data", e);
    }
  }, []);

  // Fetch job detail
  const fetchJob = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    try {
      const { data: jd } = await axios.get<{
        status: number;
        payload: JobDetail | JobDetail[];
      }>(`${baseApiUrl}/getjobs.php`, {
        params: { userid: userId, id: jobId },
      });
      if (jd.status === 1) {
        const detail = Array.isArray(jd.payload) ? jd.payload[0] : jd.payload;
        setJobDetail(detail);
      } else {
        setError("Job details not found.");
      }
    } catch (e) {
      console.error(e);
      setError("Error fetching job details.");
    } finally {
      setLoading(false);
    }
  }, [userId, jobId]);

  // Fetch contractor data
  const fetchContractors = useCallback(async () => {
    if (!userId) return;
    try {
      const { data: cd } = await axios.get<{
        status: number;
        payload: Contractor | Contractor[];
      }>(`${baseApiUrl}/get-contractor-data.php`, {
        params: { userid: userId, job_id: jobId },
      });
      if (cd.status === 1) {
        setContractors(Array.isArray(cd.payload) ? cd.payload : [cd.payload]);
      }
    } catch (e) {
      console.error(e);
    }
  }, [userId, jobId]);

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

  useEffect(() => {
    fetchJob();
  }, [fetchJob]);

  useEffect(() => {
    fetchContractors();
  }, [fetchContractors]);

  // Derive tasks list and total amount using useMemo, always before returns
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

  const totalAmount = useMemo(
    () => contractors.reduce((sum, c) => sum + parseFloat(c.amount || "0"), 0),
    [contractors]
  );

  const renderTask = ({ item }: { item: string }) => (
    <Text style={styles.taskItem}>{`\u2022 ${item}`}</Text>
  );

  // Loading and error states
  if (loading)
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color="#1f3759" />
      </View>
    );

  if (error || !jobDetail)
    return (
      <View style={styles.centered}>
        <Text style={styles.errorText}>
          {error ?? "No job details available."}
        </Text>
      </View>
    );

  // Main UI
  return (
    <View style={styles.screen}>
      <Header />
      <View style={styles.container}>
        {property && (
          <View style={styles.propertyContainer}>
            <Text style={styles.propertyLabel}>Selected Property:</Text>
            <Text style={styles.propertyItem}>{property.address}</Text>
            <Text style={styles.propertyItem}>{property.company}</Text>
            <TouchableOpacity
              style={styles.uploadButton}
              onPress={() => navigation.navigate("UploadScreen", { jobId })}
            >
              <Text style={styles.uploadButtonText}>Upload Files</Text>
            </TouchableOpacity>
          </View>
        )}
        <Text style={styles.header}>Job Detail</Text>
        <Text style={styles.label}>Job Type</Text>
        <Text style={styles.value}>{jobDetail.job_type}</Text>
        {tasks.length > 0 && (
          <>
            <Text style={styles.label}>Tasks</Text>
            <FlatList
              data={tasks}
              keyExtractor={(_, i) => i.toString()}
              renderItem={renderTask}
            />
          </>
        )}
        <Text style={styles.label}>Costs</Text>
        <View style={styles.costsContainer}>
          {contractors.length > 0 ? (
            <>
              {contractors.map((c, idx) => (
                <View key={idx} style={styles.costItem}>
                  <Text style={styles.contractorName}>{c.name}</Text>
                  <Text style={styles.contractorAmount}>{`£ ${c.amount}`}</Text>
                </View>
              ))}
              <View style={styles.totalContainer}>
                <Text style={styles.totalLabel}>Total Cost</Text>
                <Text style={styles.totalAmount}>{`£ ${totalAmount.toFixed(
                  2
                )}`}</Text>
              </View>
            </>
          ) : (
            <Text style={styles.noDataText}>No cost data available</Text>
          )}
        </View>
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
  screen: { flex: 1 },
  container: { flex: 1, padding: 20, backgroundColor: color.white },
  centered: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    fontSize: fontSize.large,
    fontWeight: "bold",
    color: color.primary,
    marginBottom: 15,
  },
  label: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    marginTop: 10,
    color: color.black,
    textTransform: "uppercase",
  },
  value: { fontSize: fontSize.medium, marginLeft: 5 },
  taskItem: { fontSize: fontSize.medium, color: color.gray, paddingLeft: 10 },
  errorText: { color: "red", fontSize: fontSize.medium, textAlign: "center" },
  propertyContainer: {
    marginBottom: 20,
    padding: 15,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: color.secondary,
    backgroundColor: color.white,
  },
  propertyLabel: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    marginBottom: 5,
  },
  propertyItem: { fontSize: fontSize.medium, color: color.gray },
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
    justifyContent: "space-around",
    marginTop: 20,
  },
  countContainer: { flexDirection: "row", alignItems: "center" },
  countItem: {
    fontSize: fontSize.xl,
    marginLeft: 5,
    fontWeight: "bold",
    color: "1f3759",
  },
  costsContainer: { marginTop: 10 },
  costItem: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 5,
  },
  contractorName: { fontSize: fontSize.medium, flex: 2 },
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
