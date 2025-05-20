import { AntDesign, Feather } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useState } from "react";
import {
  ActivityIndicator,
  Modal,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { AppDispatch } from "../store";
import { retryFailedUploads, selectFailedFiles } from "../store/uploaderSlice";
import { RootStackParamList } from "../types";

interface UploadStatusModalProps {
  visible: boolean;
  onClose: () => void;
  successCount: number;
  failedCount: number;
  totalCount: number;
  jobId?: string;
  materialCost?: string;
}

// Define the type for our navigation prop
type NavigationProp = NativeStackNavigationProp<RootStackParamList>;

const UploadStatusModal: React.FC<UploadStatusModalProps> = ({
  visible,
  onClose,
  successCount,
  failedCount,
  totalCount,
  jobId,
}) => {
  // Properly type the navigation hook
  const dispatch = useDispatch<AppDispatch>();
  const [isRetrying, setIsRetrying] = useState(false);
  const [retryProgress, setRetryProgress] = useState(0);

  // Get only the failed files
  const failedFiles = useSelector(selectFailedFiles);

  const allSuccess = failedCount === 0;

  const handleOkay = () => {
    onClose();
  };

  const handleRetry = async () => {
    // If there are no failed files, don't do anything
    if (failedCount === 0 || failedFiles.length === 0) return;

    setIsRetrying(true);
    setRetryProgress(0);

    try {
      // Simulate progress updates
      const progressInterval = setInterval(() => {
        setRetryProgress((prev) => {
          const newProgress = prev + 5;
          if (newProgress >= 95) {
            clearInterval(progressInterval);
            return 95;
          }
          return newProgress;
        });
      }, 300);

      // Get necessary data for the upload
      const [userDataStr, propertyStr] = await Promise.all([
        AsyncStorage.getItem("userData"),
        AsyncStorage.getItem("selectedProperty"),
      ]);

      let userData = null;
      let storedProperty = null;

      if (userDataStr) userData = JSON.parse(userDataStr);
      if (propertyStr) storedProperty = JSON.parse(propertyStr);

      const mainCategoryId = ""; // You should get this from context or navigation params
      const subCategoryId = ""; // You should get this from context or navigation params
      const propertyId = storedProperty ? storedProperty.id : "";
      const userName = userData?.payload?.name || "";
      const common_id = ""; // You should get this from context or navigation params

      // Dispatch the retry action for failed files only
      await dispatch(
        retryFailedUploads({
          mainCategoryId,
          subCategoryId,
          propertyId,
          job_id: jobId || "",
          userName,
          common_id,
        })
      );

      // Complete the progress
      clearInterval(progressInterval);
      setRetryProgress(100);

      // Small delay before resetting state
      setTimeout(() => {
        setIsRetrying(false);
        setRetryProgress(0);
      }, 1000);
    } catch (error) {
      console.error("Error retrying uploads:", error);
      setIsRetrying(false);
      setRetryProgress(0);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={handleOkay}
    >
      <View style={styles.modalContainer}>
        <View style={styles.modalView}>
          <View style={{ marginBottom: 15 }}>
            {allSuccess ? (
              <AntDesign
                name="checkcircle"
                size={60}
                color={color.lightGreen}
              />
            ) : (
              <AntDesign
                name="exclamationcircle"
                size={60}
                color={color.orange}
              />
            )}
          </View>

          <Text style={styles.modalTitle}>
            {allSuccess ? "Upload Complete" : "Upload Status"}
          </Text>

          <View style={innerStyles.statusContainer}>
            <View style={innerStyles.statusRow}>
              <Text style={styles.label}>Total:</Text>
              <Text style={innerStyles.statusValue}>{totalCount} files</Text>
            </View>

            <View style={innerStyles.statusRow}>
              <Text style={styles.label}>Successful:</Text>
              <Text
                style={[innerStyles.statusValue, { color: color.lightGreen }]}
              >
                {successCount} files
              </Text>
            </View>

            {failedCount > 0 && (
              <View style={innerStyles.statusRow}>
                <Text style={styles.label}>Failed:</Text>
                <View style={innerStyles.failedContainer}>
                  <Text style={[innerStyles.statusValue, { color: color.red }]}>
                    {failedCount} files
                  </Text>
                  {!isRetrying && (
                    <TouchableOpacity
                      style={innerStyles.retryButton}
                      onPress={handleRetry}
                      disabled={isRetrying}
                    >
                      <Feather
                        name="refresh-cw"
                        size={16}
                        color={color.white}
                      />
                      <Text style={innerStyles.retryText}>Retry</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            )}

            {isRetrying && (
              <View style={innerStyles.retryProgressContainer}>
                <Text style={innerStyles.retryProgressText}>
                  Retrying... {retryProgress}%
                </Text>
                <View style={innerStyles.progressBarContainer}>
                  <View
                    style={[
                      innerStyles.progressBar,
                      { width: `${retryProgress}%` },
                    ]}
                  />
                </View>
              </View>
            )}
          </View>

          <Text style={styles.modalText}>
            {allSuccess
              ? "All files were uploaded successfully!"
              : `${successCount} of ${totalCount} files were uploaded successfully.`}
          </Text>

          <TouchableOpacity
            style={[
              styles.primaryButton,
              isRetrying && innerStyles.disabledButton,
            ]}
            onPress={handleOkay}
            disabled={isRetrying}
          >
            <Text style={styles.buttonText}>
              {isRetrying ? "Please wait..." : "Okay"}
            </Text>
            {isRetrying && (
              <ActivityIndicator
                color={color.white}
                size="small"
                style={innerStyles.buttonSpinner}
              />
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const innerStyles = StyleSheet.create({
  statusContainer: {
    width: "100%",
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    padding: 15,
    marginBottom: 20,
  },
  statusRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  statusValue: {
    fontSize: fontSize.medium,
    fontWeight: "600",
  },
  failedContainer: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  retryButton: {
    flexDirection: "row",
    backgroundColor: color.secondary,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 4,
    alignItems: "center",
    gap: 4,
  },
  retryText: {
    color: color.white,
    fontSize: 12,
    fontWeight: "600",
  },
  retryProgressContainer: {
    marginTop: 12,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  retryProgressText: {
    fontSize: fontSize.small,
    color: color.secondary,
    marginBottom: 4,
  },
  progressBarContainer: {
    height: 6,
    backgroundColor: "#e0e0e0",
    borderRadius: 3,
    overflow: "hidden",
  },
  progressBar: {
    height: "100%",
    backgroundColor: color.secondary,
  },
  disabledButton: {
    backgroundColor: color.gray,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  buttonSpinner: {
    marginLeft: 8,
  },
});

export default UploadStatusModal;
