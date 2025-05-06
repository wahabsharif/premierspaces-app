import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  FlatList,
  Modal,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Toast } from "toastify-react-native";
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
  selectIsJobTypesStale,
} from "../store/createJobSlice";
import { PropertyData, RootStackParamList, Job } from "../types";
import NetInfo from "@react-native-community/netinfo";

type TasksState = Record<string, string>;
const TASK_KEYS = Array.from({ length: 10 }, (_, i) => `task${i + 1}`);

const OpenNewJobScreen = ({
  navigation,
}: NativeStackScreenProps<RootStackParamList, "OpenNewJobScreen">) => {
  const dispatch = useDispatch<AppDispatch>();
  const { loading, success, error } = useSelector(selectJobState);
  const { items: jobTypes, loading: typesLoading } =
    useSelector(selectJobTypes);
  const isStale = useSelector(selectIsJobTypesStale);

  const [propertyData, setPropertyData] = useState<PropertyData | null>(null);
  const [selectedJobType, setSelectedJobType] = useState<Job | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<View>(null);
  const [dropdownPos, setDropdownPos] = useState({ top: 0, left: 0, width: 0 });

  const [userId, setUserId] = useState<string>("");
  const [isOnline, setIsOnline] = useState(true);
  const emptyTasks = TASK_KEYS.reduce(
    (a, k) => ({ ...a, [k]: "" }),
    {} as TasksState
  );
  const [jobTasks, setJobTasks] = useState<TasksState>(emptyTasks);
  const initialHeights = TASK_KEYS.reduce(
    (a, k) => ({ ...a, [k]: 40 }),
    {} as Record<string, number>
  );
  const [inputHeights, setInputHeights] = useState(initialHeights);

  const showSuccess = useCallback((msg: string) => Toast.success(msg), []);
  const showError = useCallback((msg: string) => Toast.error(msg), []);
  const showInfo = useCallback((msg: string) => Toast.info(msg), []);

  // Network status monitoring
  useEffect(() => {
    const unsub = NetInfo.addEventListener((state) => {
      const online = state.isConnected ?? false;
      setIsOnline(online);
      if (online && userId && isStale) {
        dispatch(fetchJobTypes({ userId }));
        showInfo("Connected. Refreshing job types.");
      }
    });
    return unsub;
  }, [dispatch, userId, isStale]);

  // Initial data loading
  useEffect(() => {
    (async () => {
      try {
        const [propStr, userStr, typeStr] = await Promise.all([
          AsyncStorage.getItem("selectedProperty"),
          AsyncStorage.getItem("userData"),
          AsyncStorage.getItem("selectedJobType"),
        ]);

        if (propStr) setPropertyData(JSON.parse(propStr));
        if (userStr) {
          const u = JSON.parse(userStr);
          const uid = u.payload?.userid ?? u.userid;
          setUserId(uid);

          // Only fetch job types if they are stale - we rely on app initialization to have pre-cached them
          if (isStale) {
            dispatch(fetchJobTypes({ userId: uid }));
          }
        }
        if (typeStr) setSelectedJobType(JSON.parse(typeStr));
      } catch {
        showError("Error loading initial data");
      }
    })();
    return () => {
      dispatch(resetJobTypes());
    };
  }, [dispatch, isStale]);

  useEffect(() => {
    if (success) {
      showSuccess("Job created successfully!");
      navigation.navigate("JobsScreen");
      dispatch(resetJobState());
      resetForm();
    }
    if (error) {
      showError(error);
      dispatch(resetJobState());
    }
  }, [success, error]);

  const handleSelectJobType = useCallback(async (job: Job) => {
    setSelectedJobType(job);
    setDropdownOpen(false);
    await AsyncStorage.setItem("selectedJobType", JSON.stringify(job));
  }, []);

  const handleTaskChange = useCallback((key: string, val: string) => {
    setJobTasks((prev) => ({ ...prev, [key]: val }));
  }, []);

  const resetForm = useCallback(() => {
    setJobTasks(emptyTasks);
    setSelectedJobType(null);
    setInputHeights(initialHeights);
  }, []);

  const handleSubmit = useCallback(() => {
    if (!isOnline) return showError("Cannot create job while offline");
    if (!propertyData?.id || !selectedJobType?.id)
      return showError("Select property and job type");
    const payload = {
      property_id: propertyData.id,
      job_type: `${selectedJobType.id}`,
      ...TASK_KEYS.reduce(
        (acc, key) => ({ ...acc, [key]: jobTasks[key] || "" }),
        {}
      ),
    } as Job;
    dispatch(createJob({ userId, jobData: payload }));
  }, [dispatch, isOnline, propertyData, selectedJobType, jobTasks, userId]);

  const measureDropdown = useCallback(() => {
    dropdownRef.current?.measure((x, y, w, h, px, py) =>
      setDropdownPos({ top: py + h, left: px, width: w })
    );
  }, []);

  interface ContentSizeChangeEvent {
    nativeEvent: {
      contentSize: {
        height: number;
      };
    };
  }

  const handleContentSizeChange = useCallback(
    (key: string, e: ContentSizeChangeEvent) => {
      const h = e.nativeEvent.contentSize.height;
      setInputHeights((prev) => ({ ...prev, [key]: Math.max(40, h) }));
    },
    []
  );

  const renderDropdownItem = useCallback(
    ({ item }: { item: Job }) => (
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
              onPress={() => {
                measureDropdown();
                setDropdownOpen(true);
              }}
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
              transparent
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
                      top: dropdownPos.top,
                      left: dropdownPos.left,
                      width: dropdownPos.width,
                      maxHeight:
                        Dimensions.get("window").height - dropdownPos.top - 20,
                    },
                  ]}
                >
                  {jobTypes.length === 0 ? (
                    <View style={innerStyles.noDataContainer}>
                      <Text style={styles.smallText}>
                        {isOnline
                          ? "No job types available"
                          : "No cached job types"}
                      </Text>
                    </View>
                  ) : (
                    <FlatList
                      data={jobTypes}
                      keyExtractor={(i) => i.id.toString()}
                      renderItem={renderDropdownItem}
                    />
                  )}
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
              (loading || !isOnline) && { backgroundColor: color.gray },
            ]}
            onPress={handleSubmit}
            disabled={loading || !isOnline}
          >
            <Text style={styles.buttonText}>
              {loading
                ? "Submitting..."
                : !isOnline
                ? "Offline (Cannot Submit)"
                : "Submit"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const innerStyles = StyleSheet.create({
  dropdownContainer: { position: "relative", margin: 10, width: "100%" },
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
  noDataContainer: { padding: 15, alignItems: "center" },
});

export default OpenNewJobScreen;
