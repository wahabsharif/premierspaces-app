import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { Picker } from "@react-native-picker/picker";
import React, { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
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
import { selectJobsList } from "../store/jobSlice";

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

  // Local auth state
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // ----- FIX: grab the jobs array, not the whole slice object -----
  const jobsSlice = useSelector((s: RootState) => selectJobsList(s));
  const jobItems = jobsSlice.items; // now this is Job[]
  const jobDetail = useMemo(
    () => jobItems.find((j) => j.id === jobId),
    [jobItems, jobId]
  );

  // Form state
  const [materialCost, setMaterialCost] = useState<string>("");
  const [initialMaterialCost, setInitialMaterialCost] = useState<string>("");
  const [costRows, setCostRows] = useState<CostRow[]>([
    { contractorId: "", amount: "" },
  ]);

  // Load user & init material cost
  useEffect(() => {
    const load = async () => {
      try {
        const json = await AsyncStorage.getItem("userData");
        const data = json ? JSON.parse(json) : null;
        const id = data?.payload?.userid ?? data?.userid ?? null;
        setUserId(id);

        if (jobDetail && jobDetail.material_cost !== undefined) {
          const mc = String(jobDetail.material_cost);
          setMaterialCost(mc);
          setInitialMaterialCost(mc);
        }
      } catch (err) {
        console.error("Failed to load user data:", err);
      } finally {
        setLoadingUser(false);
      }
    };
    load();
  }, [jobDetail]);

  // Fetch contractors & costs
  const contractors = useSelector((s: RootState) => s.contractors.data);
  const loadingContractors = useSelector(
    (s: RootState) => s.contractors.isLoading
  );
  const contractorError = useSelector((s: RootState) => s.contractors.error);
  const costs = useSelector((s: RootState) => selectCostsForJob(s, jobId));

  useEffect(() => {
    if (userId) {
      dispatch(fetchCosts({ userId, jobId }));
      dispatch(fetchContractors());
    }
  }, [dispatch, userId, jobId]);

  // Row handlers
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
  const removeRow = (i: number) =>
    setCostRows((rows) => rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof CostRow, val: string) =>
    setCostRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))
    );

  const hasEmptyRow = costRows.some(
    (r) =>
      (r.contractorId.trim() !== "" || r.amount.trim() !== "") &&
      (!r.contractorId.trim() || !r.amount.trim())
  );
  const materialChanged = materialCost.trim() !== initialMaterialCost.trim();

  // Loading & auth guards
  if (loadingUser || loadingContractors) {
    return (
      <View style={inner.loader}>
        <ActivityIndicator size="large" />
      </View>
    );
  }
  if (!userId) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <Text style={inner.error}>
          You must be logged in to view this screen.
        </Text>
      </View>
    );
  }
  if (contractorError) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <Text style={inner.error}>{contractorError}</Text>
      </View>
    );
  }
  if (!jobDetail) {
    return (
      <View style={styles.screenContainer}>
        <Header />
        <Text style={inner.error}>Job not found.</Text>
      </View>
    );
  }

  // Submit handler
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

      // New cost entries
      for (const row of costRows) {
        if (row.contractorId && row.amount) {
          await dispatch(
            createCost({
              userId: userId!,
              jobId,
              name: "Cost Entry",
              amount: row.amount,
              materialCost: materialChanged ? materialCost : undefined,
              contractorId: row.contractorId,
            })
          ).unwrap();
        }
      }

      // Only material‐cost update
      if (
        costRows.every((r) => !r.contractorId && !r.amount) &&
        materialChanged
      ) {
        await dispatch(
          createCost({
            userId: userId!,
            jobId,
            name: "Material Cost Update",
            amount: "0",
            materialCost,
          })
        ).unwrap();
      }

      Toast.success("Costs and material cost updated successfully!");
      navigation.navigate("JobDetailScreen", {
        id: jobId,
        refresh: Date.now(),
      });
    } catch (e: any) {
      console.error("Error submitting costs:", e);
      Toast.error(`Error: ${e.message || e}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        {/* Material Cost */}
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

        {/* Contractor Cost Rows */}
        {costRows.map((row, idx) => (
          <View key={idx} style={inner.row}>
            <Picker
              selectedValue={row.contractorId}
              style={inner.picker}
              onValueChange={(val) => updateRow(idx, "contractorId", val)}
            >
              <Picker.Item label="Select Contractor" value="" />
              {contractors.map((c) => (
                <Picker.Item key={c.id} label={c.name} value={c.id} />
              ))}
            </Picker>
            <TextInput
              style={[styles.input, { flex: 0.7 }]}
              placeholder="Amount"
              keyboardType="numeric"
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

        {/* Controls */}
        <TouchableOpacity style={inner.addMore} onPress={addRow}>
          <Text style={inner.addMoreText}>+ Add More</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[
            styles.primaryButton,
            (hasEmptyRow || isSubmitting) && { opacity: 0.5 },
          ]}
          onPress={handleSubmit}
          disabled={hasEmptyRow || isSubmitting}
        >
          <Text style={styles.buttonText}>
            {isSubmitting ? "Saving..." : "Save"}
          </Text>
        </TouchableOpacity>
      </View>
    </View>
  );
};

const inner = StyleSheet.create({
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  row: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  picker: { flex: 1, height: 50 },
  addMore: { alignSelf: "flex-end", marginVertical: 8 },
  addMoreText: { color: color.primary, fontWeight: "bold" },
  error: { color: color.red, textAlign: "center", marginTop: 20 },
});

export default AddCostsScreen;
