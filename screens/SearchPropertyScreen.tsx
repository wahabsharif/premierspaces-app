import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Modal,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Header } from "../components";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";
import { useAppDispatch, useAppSelector } from "../hooks/reduxHooks";
import {
  checkConnectivity,
  clearFilter,
  fetchAllProperties,
  filterProperties,
  loadCachedProperties,
  setConnectionStatus,
} from "../store/propertySlice";
import { RootStackParamList } from "../types";

type SearchPropertyScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SearchPropertyScreen"
>;

const SearchPropertyScreen: React.FC = () => {
  const [door_num, setdoor_num] = useState("");
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [showNoResultsError, setShowNoResultsError] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigation = useNavigation<SearchPropertyScreenNavigationProp>();

  // Redux state
  const dispatch = useAppDispatch();
  const { filteredProperties, loading, error, isConnected, lastUpdated } =
    useAppSelector((state) => state.property);

  // Check network connectivity and load appropriate data
  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      dispatch(setConnectionStatus(isConnected));

      if (isConnected) {
        dispatch(fetchAllProperties())
          .unwrap()
          .catch((error) => {
            if (error === "Session expired") {
              setShowSessionExpired(true);
            }
          });
      } else {
        // Load cached data when offline
        dispatch(loadCachedProperties());
      }
    });

    // Initial connectivity check and data loading
    dispatch(checkConnectivity()).then((result) => {
      if (result.payload) {
        dispatch(fetchAllProperties())
          .unwrap()
          .catch((error) => {
            if (error === "Session expired") {
              setShowSessionExpired(true);
            }
          });
      } else {
        dispatch(loadCachedProperties());
      }
    });

    return () => {
      unsubscribe();
    };
  }, [dispatch]);

  // Handle search input with debounce
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    // Also clear the error timeout when input changes
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      setShowNoResultsError(false);
    }

    if (door_num.trim() === "") {
      dispatch(clearFilter());
      setShowNoResultsError(false);
      return;
    }

    debounceRef.current = setTimeout(() => {
      dispatch(filterProperties(door_num));
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [door_num, dispatch]);

  // Effect for delayed error message
  useEffect(() => {
    // Clear any existing timeout when loading state or results change
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      setShowNoResultsError(false);
    }

    // Only set timeout if we have a non-empty search, no results, and not loading
    if (door_num.trim() !== "" && filteredProperties.length === 0 && !loading) {
      errorTimeoutRef.current = setTimeout(() => {
        setShowNoResultsError(true);
      }, 500);
    } else {
      setShowNoResultsError(false);
    }

    return () => {
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
      }
    };
  }, [door_num, filteredProperties.length, loading]);

  const handleSelectAndNavigate = async (item: any) => {
    try {
      // First check if item contains all required fields
      if (!item || !item.id || !item.address) {
        // // console.error("Invalid property data:", item);
        return;
      }

      // Ensure we have a complete item object
      const completeItem = {
        id: item.id,
        address: item.address,
        company: item.company || "",
        ...item,
      };

      // Store selected property in AsyncStorage
      await AsyncStorage.setItem(
        "selectedProperty",
        JSON.stringify(completeItem)
      );

      // Also update the timestamp of when this property was last selected
      await AsyncStorage.setItem(
        "lastSelectedPropertyTimestamp",
        new Date().toString()
      );

      // Check if we're in offline mode
      if (!isConnected) {
        // Create a special entry for offline navigation
        await AsyncStorage.setItem(
          "offlineSelectedProperty",
          JSON.stringify({
            ...completeItem,
            selectedOffline: true,
            selectionTime: new Date().toString(),
          })
        );
      }

      // Navigate to the next screen
      navigation.navigate("CategoryScreen", {
        paramKey: completeItem.address,
        fromOfflineMode: !isConnected,
      });
    } catch (error) {
      // // console.error("Error saving property:", error);
    }
  };

  const renderResultItem = ({ item }: { item: any }) => {
    return (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleSelectAndNavigate(item)}
      >
        <Text style={styles.smallText}>{item.address}</Text>
        <Text style={styles.extraSmallText}>{item.company}</Text>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.screenContainer}>
      <Header />
      <View style={styles.container}>
        <View style={styles.headingContainer}>
          <Text style={styles.heading}>Search Properties</Text>
        </View>
        <View style={styles.inputContainer}>
          <Text style={styles.label}>Door No.</Text>
          <TextInput
            style={styles.input}
            placeholder="Enter door number..."
            value={door_num}
            onChangeText={setdoor_num}
          />
        </View>
        {loading && <ActivityIndicator color={color.primary} />}

        {filteredProperties.length > 0 && (
          <View style={styles.list}>
            <Text style={styles.subHeading}>Property List</Text>
            <FlatList
              data={filteredProperties}
              keyExtractor={(item) => item.id.toString()}
              renderItem={renderResultItem}
              contentContainerStyle={{ paddingVertical: 10 }}
            />
          </View>
        )}

        {showNoResultsError && (
          <Text style={styles.errorText}>
            No property found with ({door_num})
          </Text>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showSessionExpired}
        onRequestClose={() => {
          setShowSessionExpired(false);
          navigation.navigate("LoginScreen");
        }}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>
              Session expired! Please log in again.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={() => {
                setShowSessionExpired(false);
                navigation.navigate("LoginScreen");
              }}
            >
              <Text style={styles.modalButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SearchPropertyScreen;
