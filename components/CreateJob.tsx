import { Ionicons } from "@expo/vector-icons";
import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  Alert,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
} from "react-native";
import { Picker } from "@react-native-picker/picker";
import { useSelector } from "react-redux";
import { selectJobTypes, fetchJobTypes } from "../store/jobSlice";
import { useDispatch } from "react-redux";
import { AppDispatch } from "../store";
import { v4 as uuidv4 } from "uuid";
import { Job } from "../types";
import * as jobService from "../services/jobService"; // Import the SQLite job service

interface CreateJobProps {
  visible: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

const CreateJob: React.FC<CreateJobProps> = ({
  visible,
  onClose,
  onSuccess,
}) => {
  const dispatch = useDispatch<AppDispatch>();
  const { items: jobTypes, loading: jobTypesLoading } =
    useSelector(selectJobTypes);

  // Form state
  const [jobType, setJobType] = useState<string>("");
  const [importance, setImportance] = useState<string>("Normal");
  const [tasks, setTasks] = useState<Array<{ task: string; cost: string }>>([
    { task: "", cost: "" },
  ]);
  const [materialCost, setMaterialCost] = useState<string>("");
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);

  // Load job types when component mounts
  useEffect(() => {
    if (visible && jobTypes.length === 0) {
      // Get user ID from somewhere (e.g. AsyncStorage, Redux) in a real app
      const userId = "current_user_id";
      dispatch(fetchJobTypes({ userId }));
    }
  }, [visible, dispatch, jobTypes.length]);

  // Add a new task field
  const addTask = () => {
    if (tasks.length < 10) {
      setTasks([...tasks, { task: "", cost: "" }]);
    } else {
      Alert.alert("Limit Reached", "Maximum of 10 tasks allowed per job.");
    }
  };

  // Update a task field
  const updateTask = (index: number, field: "task" | "cost", value: string) => {
    const updatedTasks = [...tasks];
    updatedTasks[index][field] = value;
    setTasks(updatedTasks);
  };

  // Remove a task field
  const removeTask = (index: number) => {
    if (tasks.length > 1) {
      const updatedTasks = [...tasks];
      updatedTasks.splice(index, 1);
      setTasks(updatedTasks);
    }
  };

  // Reset form
  const resetForm = () => {
    setJobType("");
    setImportance("Normal");
    setTasks([{ task: "", cost: "" }]);
    setMaterialCost("");
  };

  // Handle form submission
  const handleSubmit = async () => {
    // Validate form
    if (!jobType) {
      Alert.alert("Error", "Please select a job type.");
      return;
    }

    if (tasks[0].task.trim() === "") {
      Alert.alert("Error", "Please add at least one task.");
      return;
    }

    try {
      setIsSubmitting(true);

      // Prepare job data
      const jobData: Job = {
        id: uuidv4(),
        job_num: `JOB-${Date.now().toString().substring(6)}`,
        date_created: new Date().toISOString(),
        job_type: jobType,
        importance: importance,
        status: "pending",
        material_cost: materialCost,
        property_id: "default_property_id", // Replace with actual value
        tenant_id: "default_tenant_id", // Replace with actual value
        assignto_user_id: "default_user_id", // Replace with actual value
        ll_informed: "false", // Replace with actual value
        ...Object.fromEntries(
          tasks
            .map(({ task, cost }, index) => {
              const taskNum = index + 1;
              return [
                [`task${taskNum}`, task],
                [`task${taskNum}_status`, "pending"],
                [`task${taskNum}_cost`, cost],
              ];
            })
            .flat()
        ),
      };

      // Use SQLite jobService directly instead of Redux
      const resultId = await jobService.createJob(jobData);

      console.log("Job creation result:", resultId);

      // Show success message
      Alert.alert("Success", "Job created successfully", [
        {
          text: "OK",
          onPress: () => {
            resetForm();
            onSuccess();
            onClose();
          },
        },
      ]);
    } catch (error) {
      console.error("Error creating job:", error);
      Alert.alert("Error", "Failed to create job. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      transparent={false}
      onRequestClose={onClose}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : "height"}
        style={styles.container}
      >
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Create New Job</Text>
          <TouchableOpacity style={styles.closeButton} onPress={onClose}>
            <Ionicons name="close" size={24} color="#000" />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.form}>
          <Text style={styles.label}>Job Type *</Text>
          <View style={styles.pickerContainer}>
            {jobTypesLoading ? (
              <ActivityIndicator size="small" color="#0066cc" />
            ) : (
              <Picker
                selectedValue={jobType}
                onValueChange={(itemValue) => setJobType(itemValue)}
                style={styles.picker}
              >
                <Picker.Item label="Select a job type..." value="" />
                {jobTypes.map((job, index) => (
                  <Picker.Item
                    key={index}
                    label={job.job_type || `Job Type ${index + 1}`}
                    value={job.job_type}
                  />
                ))}
              </Picker>
            )}
          </View>

          <Text style={styles.label}>Importance</Text>
          <View style={styles.pickerContainer}>
            <Picker
              selectedValue={importance}
              onValueChange={(itemValue) => setImportance(itemValue)}
              style={styles.picker}
            >
              <Picker.Item label="Normal" value="Normal" />
              <Picker.Item label="Low" value="Low" />
              <Picker.Item label="Medium" value="Medium" />
              <Picker.Item label="High" value="High" />
            </Picker>
          </View>

          <Text style={styles.label}>Tasks</Text>
          {tasks.map((task, index) => (
            <View key={index} style={styles.taskContainer}>
              <View style={styles.taskRow}>
                <Text style={styles.taskNumber}>{index + 1}.</Text>
                <TextInput
                  style={styles.taskInput}
                  placeholder="Task description"
                  value={task.task}
                  onChangeText={(text) => updateTask(index, "task", text)}
                />
                <TouchableOpacity
                  style={styles.removeButton}
                  onPress={() => removeTask(index)}
                >
                  <Ionicons name="trash-outline" size={18} color="#e74c3c" />
                </TouchableOpacity>
              </View>
              <View style={styles.costRow}>
                <Text style={styles.costLabel}>Cost ($):</Text>
                <TextInput
                  style={styles.costInput}
                  placeholder="0.00"
                  keyboardType="decimal-pad"
                  value={task.cost}
                  onChangeText={(text) => updateTask(index, "cost", text)}
                />
              </View>
            </View>
          ))}

          <TouchableOpacity style={styles.addTaskButton} onPress={addTask}>
            <Ionicons name="add-circle-outline" size={20} color="#fff" />
            <Text style={styles.addTaskText}>Add Task</Text>
          </TouchableOpacity>

          <Text style={styles.label}>Material Cost ($)</Text>
          <TextInput
            style={styles.input}
            placeholder="0.00"
            keyboardType="decimal-pad"
            value={materialCost}
            onChangeText={setMaterialCost}
          />

          <View style={styles.buttonContainer}>
            <TouchableOpacity
              style={[styles.button, styles.cancelButton]}
              onPress={onClose}
              disabled={isSubmitting}
            >
              <Text style={styles.buttonText}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.button, styles.submitButton]}
              onPress={handleSubmit}
              disabled={isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.buttonText}>Create Job</Text>
              )}
            </TouchableOpacity>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#fff",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 16,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  headerTitle: {
    fontSize: 18,
    fontWeight: "bold",
  },
  closeButton: {
    padding: 8,
  },
  form: {
    padding: 16,
  },
  label: {
    fontSize: 16,
    fontWeight: "500",
    marginTop: 16,
    marginBottom: 8,
  },
  input: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 12,
    fontSize: 16,
    backgroundColor: "#f9f9f9",
  },
  pickerContainer: {
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    backgroundColor: "#f9f9f9",
  },
  picker: {
    height: 50,
  },
  taskContainer: {
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#eee",
    borderRadius: 4,
    padding: 12,
    backgroundColor: "#f9f9f9",
  },
  taskRow: {
    flexDirection: "row",
    alignItems: "center",
  },
  taskNumber: {
    fontSize: 16,
    fontWeight: "bold",
    marginRight: 8,
    width: 20,
  },
  taskInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#fff",
  },
  removeButton: {
    marginLeft: 8,
    padding: 8,
  },
  costRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
    marginLeft: 28,
  },
  costLabel: {
    fontSize: 14,
    width: 60,
  },
  costInput: {
    flex: 1,
    borderWidth: 1,
    borderColor: "#ddd",
    borderRadius: 4,
    padding: 8,
    backgroundColor: "#fff",
  },
  addTaskButton: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#0066cc",
    borderRadius: 4,
    padding: 12,
    marginTop: 8,
    marginBottom: 16,
  },
  addTaskText: {
    color: "#fff",
    fontWeight: "500",
    marginLeft: 8,
  },
  buttonContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: 24,
    marginBottom: 40,
  },
  button: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 16,
    borderRadius: 4,
  },
  cancelButton: {
    backgroundColor: "#ccc",
    marginRight: 8,
  },
  submitButton: {
    backgroundColor: "#0066cc",
    marginLeft: 8,
  },
  buttonText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});

export default CreateJob;
