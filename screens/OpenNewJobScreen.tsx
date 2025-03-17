import AntDesign from "@expo/vector-icons/AntDesign";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import axios from "axios";
import React, { useEffect, useState, useRef } from "react";
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
import { RootStackParamList } from "../types";

interface PropertyData {
  address: string;
  company: string;
  id: string;
}

interface JobType {
  id: number;
  type: string;
  color: string;
}

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

  const emptyTasks = {
    task1: "",
    task2: "",
    task3: "",
    task4: "",
    task5: "",
    task6: "",
    task7: "",
    task8: "",
    task9: "",
    task10: "",
  };

  const [jobTasks, setJobTasks] = useState({ ...emptyTasks });

  // State to hold dynamic heights for each input field
  const [inputHeights, setInputHeights] = useState<Record<string, number>>({
    task1: 40,
    task2: 40,
    task3: 40,
    task4: 40,
    task5: 40,
    task6: 40,
    task7: 40,
    task8: 40,
    task9: 40,
    task10: 40,
  });

  useEffect(() => {
    const fetchPropertyData = async () => {
      try {
        const storedProperty = await AsyncStorage.getItem("selectedProperty");
        if (storedProperty) {
          setPropertyData(JSON.parse(storedProperty));
        }
      } catch (error) {
        console.error("Error retrieving property data", error);
      }
    };

    const fetchJobTypes = async () => {
      try {
        const response = await axios.get(
          "http://192.168.18.45:8000/api/job-types.php"
        );
        setJobTypes(response.data);
      } catch (error) {
        console.error("Error fetching job types", error);
      }
    };

    const fetchSelectedJobType = async () => {
      try {
        const storedJobType = await AsyncStorage.getItem("selectedJobType");
        if (storedJobType) {
          setSelectedJobType(JSON.parse(storedJobType));
        }
      } catch (error) {
        console.error("Error retrieving selected job type", error);
      }
    };

    fetchPropertyData();
    fetchJobTypes();
    fetchSelectedJobType();
  }, []);

  const handleSelectJobType = async (job: JobType) => {
    setSelectedJobType(job);
    setDropdownOpen(false);
    try {
      await AsyncStorage.setItem("selectedJobType", JSON.stringify(job));
      console.log("Selected job type", job);
    } catch (error) {
      console.error("Error storing selected job type", error);
    }
  };

  // Handler for text input changes
  const handleTaskChange = (key: keyof typeof jobTasks, value: string) => {
    setJobTasks((prevTasks) => ({ ...prevTasks, [key]: value }));
  };

  const showToast = (message: string) => {
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
  };

  const resetForm = () => {
    setJobTasks({ ...emptyTasks });
    setSelectedJobType(null);

    const resetHeights = Object.keys(inputHeights).reduce((acc, key) => {
      acc[key] = 40;
      return acc;
    }, {} as Record<string, number>);

    setInputHeights(resetHeights);
  };

  const handleSubmit = async () => {
    if (!propertyData?.id || !selectedJobType?.id) {
      showToast("Please select property and job type");
      return;
    }

    setLoading(true);

    const jobData = {
      property_id: propertyData?.id,
      job_type: selectedJobType?.id,
      invoice_no: 0,
      ...jobTasks,
    };

    try {
      const response = await axios.post(
        "http://192.168.18.45:8000/api/jobs.php",
        jobData
      );
      console.log("Job posted successfully:", response.data);

      // Show success toast
      showToast("Job created successfully!");

      setTimeout(() => {
        resetForm();
      }, 500);
    } catch (error) {
      console.error("Error posting job", error);
      showToast("Failed to create job. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  const measureDropdown = () => {
    if (dropdownRef.current) {
      dropdownRef.current.measure((x, y, width, height, pageX, pageY) => {
        setDropdownPosition({
          top: pageY + height,
          left: pageX,
          width: width,
        });
      });
    }
  };

  const openDropdown = () => {
    measureDropdown();
    setDropdownOpen(true);
  };

  return (
    <View style={{ flex: 1 }}>
      <Header />
      <ScrollView contentContainerStyle={styles.container}>
        <View style={commonStyles.headingContainer}>
          <Text style={commonStyles.heading}>Create New Job</Text>
        </View>
        {propertyData && (
          <View style={styles.propertyContainer}>
            <Text style={styles.propertyLabel}>Selected Property:</Text>
            <View style={styles.propertyDetails}>
              <Text style={styles.propertyItem}>{propertyData.address}</Text>
              <Text style={styles.propertyItem}>{propertyData.company}</Text>
            </View>
          </View>
        )}
        <Text style={styles.label}>Job Category:</Text>
        <View style={styles.dropdownContainer}>
          <TouchableOpacity
            ref={dropdownRef}
            style={styles.dropdown}
            onPress={openDropdown}
          >
            <View style={styles.dropdownInner}>
              <Text style={styles.dropdownText}>
                {selectedJobType
                  ? selectedJobType.type
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
              style={styles.modalOverlay}
              activeOpacity={1}
              onPress={() => setDropdownOpen(false)}
            >
              <View
                style={[
                  styles.dropdownListContainer,
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
                  renderItem={({ item }) => (
                    <TouchableOpacity
                      style={styles.dropdownItem}
                      onPress={() => handleSelectJobType(item)}
                    >
                      <Text style={styles.dropdownItemText}>{item.type}</Text>
                    </TouchableOpacity>
                  )}
                />
              </View>
            </TouchableOpacity>
          </Modal>
        </View>

        <Text style={styles.label}>Job Tasks:</Text>
        {Object.keys(jobTasks).map((key) => (
          <TextInput
            key={key}
            multiline
            onContentSizeChange={(event) => {
              const height = event.nativeEvent.contentSize.height;
              setInputHeights((prevHeights) => ({
                ...prevHeights,
                [key]: Math.max(40, height),
              }));
            }}
            style={[styles.input, { height: inputHeights[key] }]}
            placeholder={`Enter ${key}`}
            value={(jobTasks as any)[key]}
            onChangeText={(text) =>
              handleTaskChange(key as keyof typeof jobTasks, text)
            }
          />
        ))}

        <TouchableOpacity
          style={[styles.button, loading ? styles.buttonDisabled : null]}
          onPress={handleSubmit}
          disabled={loading}
        >
          <Text style={styles.buttonText}>
            {loading ? "Submitting..." : "Submit"}
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexGrow: 1,
    padding: 20,
  },
  propertyContainer: {
    backgroundColor: color.white,
    padding: 15,
    borderRadius: 8,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: color.secondary,
  },
  propertyLabel: {
    fontSize: fontSize.medium,
    fontWeight: "600",
    color: color.black,
    marginBottom: 5,
  },
  propertyDetails: {
    paddingLeft: 10,
  },
  propertyItem: {
    fontSize: fontSize.medium,
    color: color.gray,
  },
  label: {
    fontSize: fontSize.medium,
    color: color.black,
    marginBottom: 5,
  },
  dropdownContainer: {
    position: "relative",
    marginBottom: 20,
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
  dropdownText: {
    fontSize: fontSize.medium,
    color: color.black,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
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
  dropdownItemText: {
    fontSize: fontSize.medium,
    color: color.black,
  },
  input: {
    borderWidth: 1,
    borderColor: color.secondary,
    borderRadius: 8,
    paddingHorizontal: 10,
    marginBottom: 10,
    backgroundColor: color.white,
    fontSize: fontSize.medium,
    color: color.black,
    textAlignVertical: "top",
  },
  button: {
    backgroundColor: color.primary,
    padding: 15,
    borderRadius: 8,
    alignItems: "center",
    marginTop: 20,
  },
  buttonDisabled: {
    backgroundColor: color.gray,
  },
  buttonText: {
    color: color.white,
    fontSize: fontSize.medium,
    fontWeight: "bold",
  },
});

export default OpenNewJobScreen;
