import { AntDesign } from "@expo/vector-icons";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React from "react";
import { Modal, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
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
  materialCost = "0",
}) => {
  // Properly type the navigation hook
  const navigation = useNavigation<NavigationProp>();
  const allSuccess = failedCount === 0;

  const handleOkay = () => {
    onClose();
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
                <Text style={[innerStyles.statusValue, { color: color.red }]}>
                  {failedCount} files
                </Text>
              </View>
            )}
          </View>

          <Text style={styles.modalText}>
            {allSuccess
              ? "All files were uploaded successfully!"
              : `${successCount} of ${totalCount} files were uploaded successfully.`}
          </Text>

          <TouchableOpacity style={styles.primaryButton} onPress={handleOkay}>
            <Text style={styles.buttonText}>Okay</Text>
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
});

export default UploadStatusModal;
