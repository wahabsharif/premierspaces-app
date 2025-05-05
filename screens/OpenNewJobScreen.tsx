import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import axios from "axios";
import React, { useEffect, useState, useRef, useCallback } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
  ScrollView,
  Modal,
  Dimensions,
  ToastAndroid,
  Platform,
  Alert,
} from "react-native";
import Header from "../components/Common/Header";
import commonStyles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import {
  RootStackParamList,
  PropertyData,
  JobType,
  TasksState,
} from "../types";
import { baseApiUrl } from "../Constants/env";
import styles from "../Constants/styles";

const TASK_KEYS = Array.from({ length: 10 }, (_, i) => `task${i + 1}`);

const OpenNewJobScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "OpenNewJobScreen">) => {
  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [jobTypes, setJobTypes] = useState<JobType[]>([]);
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const dropdownRef = useRef<View>(null);
  const [loading, setLoading] = useState(false);
  const [userId, setUserId] = useState<string>("");

  const emptyTasks = TASK_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {} as TasksState);
  const [jobTasks, setJobTasks] = useState(emptyTasks);

  // Initialize input heights dynamically
  const initialHeights = TASK_KEYS.reduce((acc, key) => {
    acc[key] = 40;
    return acc;
  }, {} as Record<string, number>);
  const [inputHeights, setInputHeights] = useState(initialHeights);

  // Combined fetch function for initial data
  useEffect(() => {
    const fetchInitialData = async () => {
      try {
        const [propertyResult, storedUserData, jobTypeResult] =
          await Promise.all([
            AsyncStorage.getItem("selectedProperty"),
            AsyncStorage.getItem("userData"), // Ensure this key is correct
            AsyncStorage.getItem("selectedJobType"),
          ]);

        if (propertyResult) {
          setPropertyData(JSON.parse(propertyResult));
        }

        if (!storedUserData) {
          // console.error("User data not found in storage.");
          return;
        }

        // Parse and verify user data structure
        const parsedUserData = JSON.parse(storedUserData);
        const extractedUserId =
          (parsedUserData.payload && parsedUserData.payload.userid) ||
          parsedUserData.userid;
        if (!extractedUserId) {
          // console.error("User ID not found in the parsed user data.");
          return;
        }
        setUserId(extractedUserId);

        const userId =
          (parsedUserData.payload && parsedUserData.payload.userid) ||
          parsedUserData.userid;
        if (!userId) {
          // console.error("User ID not found in the parsed user data.");
          return;
        }

        // Use the retrieved user ID in the API URL
        const jobTypesResult = await axios.get(
          `${baseApiUrl}/jobtypes.php?userid=${userId}`
        );
        setJobTypes(jobTypesResult.data.payload);

        if (jobTypeResult) {
          setSelectedJobType(JSON.parse(jobTypeResult));
        }
      } catch (error) {
        // console.error("Error fetching initial data", error);
      }
    };

    fetchInitialData();
  }, []);

  const handleSelectJobType = useCallback(async (job: JobType) => {
    setSelectedJobType(job);
    setDropdownOpen(false);
    try {
      await AsyncStorage.setItem("selectedJobType", JSON.stringify(job));
      console.log("Stored Job Type:", job);
    } catch (error) {
      // console.error("Error storing selected job type", error);
    }
  }, []);

  const handleTaskChange = useCallback((key: string, value: string) => {
    setJobTasks((prev) => ({ ...prev, [key]: value }));
  }, []);

  const showToast = useCallback((message: string) => {
    if (Platform.OS === "android") {
      ToastAndroid.showWithGravityAndOffset(
        message,
        ToastAndroid.LONG,
        ToastAndroid.BOTTOM,
        0,
        100
      );
    } else {
      Alert.alert("Success", message, [{ text: "OK" }], { cancelable: true });
    }
  }, []);

  const resetForm = useCallback(() => {
    setJobTasks(emptyTasks);
    setSelectedJobType(null);
    setInputHeights(initialHeights);
  }, [emptyTasks, initialHeights]);

  const handleSubmit = useCallback(async () => {
    if (!propertyData?.id || !selectedJobType?.id) {
      showToast("Please select property and job type");
      return;
    }
    if (!userId) {
      // console.error("User ID not available");
      showToast("User ID missing. Please try again later.");
      return;
    }
    setLoading(true);
    const jobData = {
      property_id: propertyData.id,
      job_type: selectedJobType.id,
      ...jobTasks,
    };
    const postData = {
      userid: userId,
      payload: jobData,
    };
    try {
      const response = await axios.post(
        `${baseApiUrl}/newjob.php?userid=${userId}`,
        postData
      );
      console.log("Server Response:", response.data);
      showToast("Job created successfully!");
      navigation.navigate("JobsScreen");
      setTimeout(resetForm, 500);
    } catch (error) {
      // console.error("Error posting job", error);
      showToast("Failed to create job. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [propertyData, selectedJobType, jobTasks, showToast, resetForm, userId]);

  const measureDropdown = useCallback(() => {
    if (dropdownRef.current) {
      dropdownRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownPosition({
          top: pageY + height,
          left: pageX,
          width: width,
        });
      });
    }
  }, []);

  const openDropdown = useCallback(() => {
    measureDropdown();
    setDropdownOpen(true);
  }, [measureDropdown]);

  // Memoized handler for content size changes
  const handleContentSizeChange = useCallback((key: string, event: any) => {
    const height = event.nativeEvent.contentSize.height;
    setInputHeights((prev) => ({
      ...prev,
      [key]: Math.max(40, height),
    }));
  }, []);

  // Memoized render item for dropdown
  const renderDropdownItem = useCallback(
    ({ item }: { item: JobType }) => (
      <TouchableOpacity
        style={innerStyles.dropdownItem}
        onPress={() => handleSelectJobType(item)}
      >
        <Text style={styles.smallText}>{item.job_type}</Text>
      </TouchableOpacity>
    ),
    [handleSelectJobType]
  );

  return (
    <View style={styles.screenContainer}>
      <Header />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <View style={styles.headingContainer}>
            <Text style={styles.heading}>Create New Job</Text>
          </View>

          {propertyData && (
            <View style={styles.screenBanner}>
              <Text style={styles.bannerLabel}>Selected Property:</Text>
              <Text style={styles.bannerText}>{propertyData.address}</Text>
              <Text style={styles.extraSmallText}>{propertyData.company}</Text>
            </View>
          )}

          <View style={innerStyles.dropdownContainer}>
            <Text style={[styles.smallText, { textAlign: "left", margin: 5 }]}>
              Job Category:
            </Text>

            <TouchableOpacity
              ref={dropdownRef}
              style={innerStyles.dropdown}
              onPress={openDropdown}
            >
              <View style={innerStyles.dropdownInner}>
                <Text style={styles.smallText}>
                  {selectedJobType
                    ? selectedJobType.job_type
                    : "Select a job type..."}
                </Text>
                <AntDesign
                  name="caretdown"
                  size={20}
                  color={color.black}
                  style={{
                    transform: [{ rotate: dropdownOpen ? "180deg" : "0deg" }],
                  }}
                />
              </View>
            </TouchableOpacity>

            <Modal
              visible={dropdownOpen}
              transparent={true}
              animationType="fade"
              onRequestClose={() => setDropdownOpen(false)}
            >
              <TouchableOpacity
                style={styles.modalContainer}
                activeOpacity={1}
                onPress={() => setDropdownOpen(false)}
              >
                <View
                  style={[
                    innerStyles.dropdownListContainer,
                    {
                      position: "absolute",
                      top: dropdownPosition.top,
                      left: dropdownPosition.left,
                      width: dropdownPosition.width,
                      maxHeight:
                        Dimensions.get("window").height -
                        dropdownPosition.top -
                        20,
                    },
                  ]}
                >
                  <FlatList
                    data={jobTypes}
                    keyExtractor={(item) => item.id.toString()}
                    renderItem={renderDropdownItem}
                    initialNumToRender={10}
                    maxToRenderPerBatch={10}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>

          <View>
            <Text style={styles.smallText}>Job Tasks:</Text>
            {TASK_KEYS.map((taskKey) => (
              <View key={taskKey} style={styles.inputContainer}>
                <TextInput
                  multiline
                  onContentSizeChange={(e) =>
                    handleContentSizeChange(taskKey, e)
                  }
                  placeholder={`Enter ${taskKey}`}
                  value={jobTasks[taskKey]}
                  onChangeText={(text) => handleTaskChange(taskKey, text)}
                  style={[styles.input, { height: inputHeights[taskKey] }]}
                />
              </View>
            ))}
          </View>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              loading && { backgroundColor: color.gray },
            ]}
            onPress={handleSubmit}
            disabled={loading}
          >
            <Text style={styles.buttonText}>
              {loading ? "Submitting..." : "Submit"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const innerStyles = StyleSheet.create({
  dropdownContainer: {
    position: "relative",
    margin: 10,
    width: "100%",
  },
  dropdown: {
    height: 40,
    borderRadius: 8,
    justifyContent: "center",
    paddingHorizontal: 10,
    backgroundColor: color.white,
    borderWidth: 1,
    borderColor: color.secondary,
  },
  dropdownInner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  dropdownListContainer: {
    backgroundColor: color.white,
    borderRadius: 8,
    maxHeight: 200,
    zIndex: 1000,
    elevation: 5,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
    borderWidth: 1,
    borderColor: color.secondary,
  },
  dropdownItem: {
    padding: 15,
    borderBottomWidth: 1,
    borderBottomColor: color.secondary,
  },
});

export default OpenNewJobScreen;
