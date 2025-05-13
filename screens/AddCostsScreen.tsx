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
import { color } from "../Constants/theme";
import { AppDispatch, RootState } from "../store";
import { fetchContractors } from "../store/contractorSlice";
import {
  createCost,
  fetchCosts,
  resetCostsForJob,
  selectCostsForJob,
} from "../store/costsSlice";

interface CostRow {
  contractorId: string;
  amount: string;
}

interface Props {
  route: { params: { jobId: string } };
  navigation: any;
}

const AddCostsScreen: React.FC<Props> = ({ route, navigation }) => {
  const { jobId } = route.params;
  const dispatch = useDispatch<AppDispatch>();

  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const jobs = useSelector((s: RootState) => selectCostsForJob(s, jobId));
  const jobDetail = useMemo(
    () => jobs.find((j) => j.id === jobId),
    [jobs, jobId]
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

      if (jobDetail?.material_cost !== undefined) {
        const mc = String(jobDetail.material_cost || "0");
        setMaterialCost(mc);
        setInitialMaterialCost(mc);
      }

      setLoadingUser(false);
    })();
  }, [jobDetail]);

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
      dispatch(fetchCosts({ userId, jobId }));
    }
  }, [dispatch, userId, jobId]);

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
          <View style={inner.row}>
            <Text style={[styles.label, { width: 200 }]}>Material Cost</Text>
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
                  <Picker.Item label="Contractors" value="" />
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
    backgroundColor: "#fff",
    width: 200,
    height: 41,
    justifyContent: "center",
    paddingHorizontal: 10,
  },
  addMore: { alignSelf: "flex-end", marginVertical: 8 },
  addMoreText: { color: color.primary, fontWeight: "bold" },
  error: { color: color.red, textAlign: "center", marginTop: 20 },
});

export default AddCostsScreen;
