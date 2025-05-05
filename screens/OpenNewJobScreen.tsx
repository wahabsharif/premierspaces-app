import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Alert,
  Dimensions,
  FlatList,
  Modal,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  ToastAndroid,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import Header from "../components/Common/Header";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";
import { AppDispatch } from "../store";
import {
  createJob,
  fetchJobTypes,
  resetJobState,
  resetJobTypes,
  selectJobState,
  selectJobTypes,
} from "../store/createJobSlice";
import {
  JobType,
  PropertyData,
  RootStackParamList,
  TasksState,
} from "../types";

const TASK_KEYS = Array.from({ length: 10 }, (_, i) => `task${i + 1}`);

const OpenNewJobScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "OpenNewJobScreen">) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, success, error } = useSelector(selectJobState);
  const { items: jobTypes, loading: typesLoading } =
    useSelector(selectJobTypes);

  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [selectedJobType, setSelectedJobType] = useState<JobType | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [dropdownPosition, setDropdownPosition] = useState({
    top: 0,
    left: 0,
    width: 0,
  });
  const dropdownRef = useRef<View>(null);
  const [userId, setUserId] = useState<string>("");
  const emptyTasks = TASK_KEYS.reduce((acc, key) => {
    acc[key] = "";
    return acc;
  }, {} as TasksState);
  const [jobTasks, setJobTasks] = useState(emptyTasks);
  const initialHeights = TASK_KEYS.reduce((acc, key) => {
    acc[key] = 40;
    return acc;
  }, {} as Record<string, number>);
  const [inputHeights, setInputHeights] = useState(initialHeights);

  useEffect(() => {
    const fetchInitial = async () => {
      const [propertyRes, userRes, typeRes] = await Promise.all([
        AsyncStorage.getItem("selectedProperty"),
        AsyncStorage.getItem("userData"),
        AsyncStorage.getItem("selectedJobType"),
      ]);
      if (propertyRes) setPropertyData(JSON.parse(propertyRes));
      if (!userRes) return;
      const parsed = JSON.parse(userRes);
      const uid = (parsed.payload?.userid || parsed.userid) as string;
      setUserId(uid);
      dispatch(fetchJobTypes({ userId: uid }));
      if (typeRes) setSelectedJobType(JSON.parse(typeRes));
    };
    fetchInitial();
    return () => {
      dispatch(resetJobTypes());
    };
  }, []);

  useEffect(() => {
    if (success) {
      showToast("Job created successfully!");
      navigation.navigate("JobsScreen");
      dispatch(resetJobState());
      resetForm();
    }
    if (error) {
      showToast(error);
      dispatch(resetJobState());
    }
  }, [success, error]);

  const handleSelectJobType = useCallback(async (job: JobType) => {
    setSelectedJobType(job);
    setDropdownOpen(false);
    await AsyncStorage.setItem("selectedJobType", JSON.stringify(job));
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
      Alert.alert("Notice", message, [{ text: "OK" }]);
    }
  }, []);

  const resetForm = useCallback(() => {
    setJobTasks(emptyTasks);
    setSelectedJobType(null);
    setInputHeights(initialHeights);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!propertyData?.id || !selectedJobType?.id) {
      showToast("Please select property and job type");
      return;
    }
    dispatch(
      createJob({
        userId,
        jobData: {
          property_id: propertyData.id,
          job_type: selectedJobType.id.toString(),
          tasks: jobTasks,
        },
      })
    );
  }, [propertyData, selectedJobType, jobTasks, userId]);

  const measureDropdown = useCallback(() => {
    dropdownRef.current?.measure((x, y, w, h, px, py) => {
      setDropdownPosition({ top: py + h, left: px, width: w });
    });
  }, []);

  const openDropdown = useCallback(() => {
    measureDropdown();
    setDropdownOpen(true);
  }, [measureDropdown]);

  const handleContentSizeChange = useCallback((key: string, e: any) => {
    const h = e.nativeEvent.contentSize.height;
    setInputHeights((prev) => ({ ...prev, [key]: Math.max(40, h) }));
  }, []);

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
        contentContainerStyle={{ flexGrow: 1 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.container}>
          <Text style={styles.heading}>Create New Job</Text>
          {propertyData && (
            <View style={styles.screenBanner}>
              <Text style={styles.bannerLabel}>Selected Property:</Text>
              <Text style={styles.bannerText}>{propertyData.address}</Text>
            </View>
          )}
          <View style={innerStyles.dropdownContainer}>
            <Text style={styles.smallText}>Job Category:</Text>
            <TouchableOpacity
              ref={dropdownRef}
              style={innerStyles.dropdown}
              onPress={openDropdown}
            >
              <View style={innerStyles.dropdownInner}>
                <Text style={styles.smallText}>
                  {selectedJobType?.job_type ||
                    (typesLoading ? "Loading..." : "Select a job type...")}
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
                    keyExtractor={(i) => i.id.toString()}
                    renderItem={renderDropdownItem}
                  />
                </View>
              </TouchableOpacity>
            </Modal>
          </View>
          <Text style={[styles.smallText, { width: "100%" }]}>Job Tasks:</Text>
          {TASK_KEYS.map((key) => (
            <View key={key} style={styles.inputContainer}>
              <TextInput
                multiline
                placeholder={`Enter ${key}`}
                value={jobTasks[key]}
                onChangeText={(text) => handleTaskChange(key, text)}
                onContentSizeChange={(e) => handleContentSizeChange(key, e)}
                style={[styles.input, { height: inputHeights[key] }]}
              />
            </View>
          ))}
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
