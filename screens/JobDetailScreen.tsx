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
import styles from "../Constants/styles";
import { useReloadOnFocus } from "../hooks";

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

  useEffect(() => {
    loadLocalData();
  }, [loadLocalData]);

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

  // 🔄 Reload data on screen focus
  useReloadOnFocus(fetchJob);
  useReloadOnFocus(fetchContractors);

  // Derive tasks list and total amount
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
    <Text style={styles.smallText}>{`\u2022 ${item}`}</Text>
  );

  // Loading and error states
  if (loading)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color="#1f3759" />
      </View>
    );

  if (error || !jobDetail)
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <Text style={styles.errorText}>
          {error ?? "No job details available."}
        </Text>
      </View>
    );

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        {property && (
          <View style={styles.screenBanner}>
            <Text style={styles.bannerLabel}>Selected Property:</Text>
            <Text style={styles.bannerText}>{property.address}</Text>
            <Text style={styles.extraSmallText}>{property.company}</Text>
            <TouchableOpacity
              style={styles.primaryButton}
              onPress={() => navigation.navigate("UploadScreen", { jobId })}
            >
              <Text style={styles.buttonText}>Upload Files</Text>
            </TouchableOpacity>
          </View>
        )}
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Job Detail</Text>
        </View>
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
          <Text style={styles.label}>Costs</Text>
          {contractors.length > 0 ? (
            <>
              {contractors.map((c, idx) => (
                <View key={idx} style={innerStyles.costItem}>
                  <Text style={styles.smallText}>{c.name}</Text>
                  <Text
                    style={innerStyles.contractorAmount}
                  >{`£ ${c.amount}`}</Text>
                </View>
              ))}
              <View style={innerStyles.totalContainer}>
                <Text style={innerStyles.totalLabel}>Total Cost</Text>
                <Text style={innerStyles.totalAmount}>{`£ ${totalAmount.toFixed(
                  2
                )}`}</Text>
              </View>
            </>
          ) : (
            <Text style={innerStyles.noDataText}>No cost data available</Text>
          )}
        </View>
        <View style={innerStyles.countsContainer}>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons name="image" size={40} color="#1f3759" />
            <Text style={innerStyles.countItem}>
              {jobDetail.image_file_count}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons
              name="file-document"
              size={40}
              color="#1f3759"
            />
            <Text style={innerStyles.countItem}>
              {jobDetail.doc_file_count}
            </Text>
          </View>
          <View style={{ flexDirection: "row", alignItems: "center" }}>
            <MaterialCommunityIcons name="video" size={40} color="#1f3759" />
            <Text style={innerStyles.countItem}>
              {jobDetail.video_file_count}
            </Text>
          </View>
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
  countItem: {
    fontSize: fontSize.xl,
    marginLeft: 5,
    fontWeight: "bold",
    color: "1f3759",
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
