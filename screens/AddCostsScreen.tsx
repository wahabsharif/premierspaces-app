import React, { useEffect, useState, useMemo } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from "react-native";
import FontAwesome5 from "@expo/vector-icons/FontAwesome5";
import { Picker } from "@react-native-picker/picker";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useDispatch, useSelector } from "react-redux";
import { Header } from "../components";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";
import { AppDispatch, RootState } from "../store";
import { fetchContractors } from "../store/contractorSlice";
import { fetchCosts, createCost, selectCostsForJob } from "../store/costsSlice";

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

  // Local state for authentication
  const [userId, setUserId] = useState<string | null>(null);
  const [loadingUser, setLoadingUser] = useState(true);

  useEffect(() => {
    AsyncStorage.getItem("userData")
      .then((json) => {
        const data = json ? JSON.parse(json) : null;
        const id = data?.payload?.userid ?? data?.userid ?? null;
        setUserId(id);
      })
      .catch((err) => console.error("Failed to load user data:", err))
      .finally(() => setLoadingUser(false));
  }, []);

  // Fetch contractors
  const contractors = useSelector((s: RootState) => s.contractors.data);
  const loadingContractors = useSelector(
    (s: RootState) => s.contractors.isLoading
  );
  const contractorError = useSelector((s: RootState) => s.contractors.error);

  // Fetch existing costs
  const costs = useSelector((state: RootState) =>
    selectCostsForJob(state, jobId)
  );

  useEffect(() => {
    if (userId) {
      dispatch(fetchCosts({ userId, jobId }));
      dispatch(fetchContractors());
    }
  }, [dispatch, userId, jobId]);

  // Local form state
  const [materialCost, setMaterialCost] = useState("");
  const [costRows, setCostRows] = useState<CostRow[]>([
    { contractorId: "", amount: "" },
  ]);

  const addRow = () =>
    setCostRows((rows) => [...rows, { contractorId: "", amount: "" }]);
  const removeRow = (i: number) =>
    setCostRows((rows) => rows.filter((_, idx) => idx !== i));
  const updateRow = (i: number, field: keyof CostRow, val: string) =>
    setCostRows((rows) =>
      rows.map((r, idx) => (idx === i ? { ...r, [field]: val } : r))
    );

  // Handle loading states
  if (loadingUser || loadingContractors)
    return (
      <View style={inner.loader}>
        <ActivityIndicator size="large" />
      </View>
    );

  if (!userId)
    return (
      <View style={styles.screenContainer}>
        <Header />
        <Text style={inner.error}>
          You must be logged in to view this screen.
        </Text>
      </View>
    );

  if (contractorError)
    return (
      <View style={styles.screenContainer}>
        <Header />
        <Text style={inner.error}>{contractorError}</Text>
      </View>
    );

  const handleSubmit = async () => {
    try {
      for (const [i, row] of costRows.entries()) {
        if (!row.contractorId || !row.amount) {
          Alert.alert(
            "Error",
            `Row ${i + 1}: contractor and amount are required.`
          );
          return;
        }

        await dispatch(
          createCost({
            userId: userId!,
            jobId,
            name: "Cost Entry",
            amount: row.amount,
            materialCost: materialCost || undefined,
            contractorId: row.contractorId,
          })
        ).unwrap();
      }

      Alert.alert("Success", "Costs added successfully", [
        { text: "OK", onPress: () => navigation.goBack() },
      ]);
    } catch (e: any) {
      Alert.alert("Error", e.toString());
    }
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
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

        <TouchableOpacity style={inner.addMore} onPress={addRow}>
          <Text style={inner.addMoreText}>+ Add More</Text>
        </TouchableOpacity>
        <TouchableOpacity style={styles.primaryButton} onPress={handleSubmit}>
          <Text style={styles.buttonText}>Save</Text>
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
