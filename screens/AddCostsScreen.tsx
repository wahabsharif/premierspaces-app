import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { useDispatch, useSelector } from "react-redux";
import { Toast } from "toastify-react-native";
import { Header } from "../components";
import styles from "../Constants/styles";
import { color, fontSize } from "../Constants/theme";
import { AppDispatch, RootState } from "../store";
import { fetchContractors } from "../store/contractorSlice";
import {
  createCost,
  fetchCosts,
  resetCostsForJob,
  selectCostsForJob,
} from "../store/costsSlice";
import { selectJobsList } from "../store/jobSlice";

interface CostRow {
  contractorId: string;
  amount: string;
}

interface Props {
  route: {
    params: { jobId: string; common_id: string; materialCost?: string };
  };
  navigation: any;
}

const AddCostsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId, common_id } = route.params;
  const dispatch = useDispatch<AppDispatch>();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Get the job details from the jobs slice instead of costs slice
  const { items: jobItems } = useSelector(selectJobsList);
  const jobDetail = useMemo(
    () => jobItems.find((j) => j.id === jobId),
    [jobItems, jobId]
  );

  const [materialCost, setMaterialCost] = useState("0");
  const [initialMaterialCost, setInitialMaterialCost] = useState("0");
  const [costRows, setCostRows] = useState<CostRow[]>([
    { contractorId: "", amount: "" },
  ]);

  useEffect(() => {
    (async () => {
      const json = await AsyncStorage.getItem("userData");
      const data = json ? JSON.parse(json) : null;
      const id = data?.payload?.userid ?? data?.userid ?? null;

      setUserId(id);

      if (route.params.materialCost !== undefined) {
        const mc = String(route.params.materialCost || "0");
        setMaterialCost(mc);
        setInitialMaterialCost(mc);
      } else if (jobDetail?.material_cost !== undefined) {
        const mc = String(jobDetail.material_cost || "0");
        setMaterialCost(mc);
        setInitialMaterialCost(mc);
      }

      setLoadingUser(false);
    })();
  }, [jobDetail, route.params.materialCost]);

  const contractors = useSelector((s: RootState) => s.contractors.data);
  const loadingContractors = useSelector(
    (s: RootState) => s.contractors.isLoading
  );
  const contractorError = useSelector((s: RootState) => s.contractors.error);

  const costs = useSelector((s: RootState) => selectCostsForJob(s, jobId));
  const isOffline = useSelector((s: RootState) => s.cost.isOffline);

  useEffect(() => {
    if (userId) {
      dispatch(fetchContractors(userId));
      dispatch(fetchCosts({ userId, jobId, common_id }));
    }
  }, [dispatch, userId, jobId, common_id]);

  const addRow = () => {
    const idx = costRows.findIndex(
      (r) =>
        (r.contractorId || r.amount) &&
        (!r.contractorId.trim() || !r.amount.trim())
    );
    if (idx !== -1) {
      Toast.error(`Please fill both contractor and amount for row ${idx + 1}`);
      return;
    }
    setCostRows((rows) => [...rows, { contractorId: "", amount: "" }]);
  };

  const removeRow = (i: number) => {
    setCostRows((rows) => rows.filter((_, idx) => idx !== i));
  };

  const updateRow = (i: number, field: keyof CostRow, val: string) => {
    setCostRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))
    );
  };

  const hasEmptyRow = costRows.some(
    (r) =>
      (r.contractorId.trim() !== "" || r.amount.trim() !== "") &&
      (!r.contractorId.trim() || !r.amount.trim())
  );
  const materialChanged = materialCost.trim() !== initialMaterialCost.trim();
  const hasAnyChanges =
    materialChanged ||
    costRows.some(
      (r) => r.contractorId.trim() !== "" && r.amount.trim() !== ""
    );

  if (loadingUser || loadingContractors) {
    return (
      <View style={inner.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (contractorError && !isOffline) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <Text style={inner.error}>{contractorError}</Text>
      </View>
    );
  }

  const handleSubmit = async () => {
    if (hasEmptyRow) {
      Toast.error(
        "Please complete or remove all incomplete rows before saving."
      );
      return;
    }

    try {
      setIsSubmitting(true);
      dispatch(resetCostsForJob(jobId));

      const validRows = costRows.filter(
        (row) => row.contractorId.trim() && row.amount.trim()
      );

      const costPromises = validRows.map((row) =>
        dispatch(
          createCost({
            userId: userId!,
            jobId,
            common_id, // Use common_id from route params directly
            amount: row.amount,
            materialCost: materialChanged ? materialCost : undefined,
            contractorId: row.contractorId,
          })
        ).unwrap()
      );

      if (validRows.length === 0 && materialChanged) {
        costPromises.push(
          dispatch(
            createCost({
              userId: userId!,
              jobId,
              common_id, // Use common_id from route params directly
              amount: "0",
              materialCost,
            })
          ).unwrap()
        );
      }

      if (costPromises.length === 0) {
        Toast.info("No changes to save");
        setIsSubmitting(false);
        return;
      }

      const results = await Promise.allSettled(costPromises);
      const errors = results.filter(
        (result) => result.status === "rejected"
      ) as PromiseRejectedResult[];

      if (errors.length > 0) {
        errors.forEach((error, index) => {
          const rowNumber = index + 1;
          console.error(
            `Error creating cost for row ${rowNumber}:`,
            error.reason
          );
          Toast.error(
            `Row ${rowNumber} failed: ${error.reason || "Unknown error"}`
          );
        });
        if (errors.length < costPromises.length) {
          Toast.success("Some costs were saved successfully.");
        }
      } else {
        Toast.success("Costs and material cost updated successfully!");
        navigation.navigate("JobDetailScreen", {
          id: jobId,
          refresh: Date.now(),
        });
      }
    } catch (e: any) {
      console.error("Unexpected error submitting costs:", e);
      Toast.error(`Unexpected error: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <ScrollView>
        <View style={styles.container}>
          <View style={styles.headingContainer}>
            <Text style={styles.heading}>Add Costs</Text>
          </View>
          <View style={inner.row}>
            <Text style={[styles.label, { width: 250 }]}>Material Cost</Text>
            <TextInput
              style={styles.input}
              placeholder="Material Cost"
              keyboardType="decimal-pad"
              value={materialCost}
              onChangeText={setMaterialCost}
            />
          </View>

          {costRows.map((row, idx) => (
            <View key={idx} style={inner.row}>
              <View style={inner.pickerWrapper}>
                <Picker
                  selectedValue={row.contractorId}
                  onValueChange={(val) => updateRow(idx, "contractorId", val)}
                >
                  <Picker.Item label="Select Contractor" value="" />
                  {contractors.map((c) => (
                    <Picker.Item key={c.id} label={c.name} value={c.id} />
                  ))}
                </Picker>
              </View>
              <TextInput
                style={[styles.input, { marginLeft: 10 }]}
                placeholder="Amount"
                keyboardType="decimal-pad"
                value={row.amount}
                onChangeText={(val) => updateRow(idx, "amount", val)}
              />

              {idx > 0 && (
                <TouchableOpacity
                  onPress={() => removeRow(idx)}
                  style={{ paddingLeft: 10 }}
                >
                  <FontAwesome5 name="times" size={24} color={color.red} />
                </TouchableOpacity>
              )}
            </View>
          ))}

          <TouchableOpacity style={inner.addMore} onPress={addRow}>
            <Text style={inner.addMoreText}>+ Add More</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[
              styles.primaryButton,
              (!hasAnyChanges || hasEmptyRow || isSubmitting) && {
                opacity: 0.5,
              },
            ]}
            onPress={handleSubmit}
            disabled={!hasAnyChanges || hasEmptyRow || isSubmitting}
          >
            <Text style={styles.buttonText}>
              {isSubmitting ? "Saving..." : "Save"}
            </Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </View>
  );
};

const inner = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: {
    flexDirection: "row",
    alignItems: "center",
    width: "100%",
    marginBottom: 12,
  },
  pickerWrapper: {
    borderColor: color.secondary,
    borderWidth: 1,
    borderRadius: 5,
    backgroundColor: color.white,
    width: 250,
    height: 41,
    justifyContent: "center",
  },
  addMore: {
    alignSelf: "flex-end",
    marginVertical: 8,
  },
  addMoreText: {
    color: color.primary,
    fontWeight: "bold",
    fontSize: fontSize.medium,
  },
  error: { color: color.red, textAlign: "center", marginTop: 20 },
});

export default AddCostsScreen;
