import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { useNavigation } from "@react-navigation/native";
import { NativeStackNavigationProp } from "@react-navigation/native-stack";
import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  ListRenderItemInfo,
  Modal,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { Toast } from "toastify-react-native";
import { Header } from "../components";
import SkeletonLoader from "../components/SkeletonLoader";
import styles from "../Constants/styles";
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
import GetAllCache from "../components/GetAllCache";

// Define property type for better type safety
interface Property {
  id: string;
  address: string;
  company: string;
  [key: string]: any;
}

type SearchPropertyScreenNavigationProp = NativeStackNavigationProp<
  RootStackParamList,
  "SearchPropertyScreen"
>;

const DEBOUNCE_DELAY = 300; // Reduced from 500ms for better responsiveness

const SearchPropertyScreen: React.FC = () => {
  const [doorNum, setDoorNum] = useState("");
  const [showSessionExpired, setShowSessionExpired] = useState(false);
  const [showNoResultsError, setShowNoResultsError] = useState(false);
  const debounceRef = useRef<NodeJS.Timeout | null>(null);
  const errorTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const navigation = useNavigation<SearchPropertyScreenNavigationProp>();

  // Redux state
  const dispatch = useAppDispatch();
  const { filteredProperties, loading, isConnected } = useAppSelector(
    (state) => state.property
  );

  // Initialize app data with useCallback for better performance
  const initializeAppData = useCallback(async () => {
    try {
      const connectivityResult = await dispatch(checkConnectivity()).unwrap();

      if (connectivityResult) {
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
    } catch (error) {
      Toast.error(
        `Failed to initialize app data: ${
          error instanceof Error ? error.message : String(error)
        }`
      );
    }
  }, [dispatch]);

  // Check network connectivity and load appropriate data
  useEffect(() => {
    // Initial data loading
    initializeAppData();

    // Setup network listener
    const unsubscribe = NetInfo.addEventListener((state) => {
      const isConnected = state.isConnected ?? false;
      dispatch(setConnectionStatus(isConnected));

      // Only fetch new data if connection was restored (previously disconnected)
      if (isConnected) {
        dispatch(fetchAllProperties())
          .unwrap()
          .catch((error) => {
            if (error === "Session expired") {
              setShowSessionExpired(true);
            }
          });
      }
    });

    return () => {
      unsubscribe();
      // Clear any lingering timeouts
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [dispatch, initializeAppData]);

  // Handle search input with debounce - memoized function
  const handleSearch = useCallback(
    (text: string) => {
      setDoorNum(text);

      // Clear any existing timeouts
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (errorTimeoutRef.current) {
        clearTimeout(errorTimeoutRef.current);
        setShowNoResultsError(false);
      }

      if (text.trim() === "") {
        dispatch(clearFilter());
        return;
      }

      debounceRef.current = setTimeout(() => {
        dispatch(filterProperties(text));
      }, DEBOUNCE_DELAY);
    },
    [dispatch]
  );

  // Effect for delayed error message
  useEffect(() => {
    // Clear any existing timeout
    if (errorTimeoutRef.current) {
      clearTimeout(errorTimeoutRef.current);
      setShowNoResultsError(false);
    }

    // Set error timeout only when needed
    if (doorNum.trim() !== "" && filteredProperties.length === 0 && !loading) {
      errorTimeoutRef.current = setTimeout(() => {
        setShowNoResultsError(true);
      }, DEBOUNCE_DELAY);
    }

    return () => {
      if (errorTimeoutRef.current) clearTimeout(errorTimeoutRef.current);
    };
  }, [doorNum, filteredProperties.length, loading]);

  const handleSelectAndNavigate = useCallback(
    async (item: Property) => {
      try {
        // Skip if missing required fields
        if (!item?.id || !item?.address) return;

        // Create a complete property object
        const completeItem = {
          ...item,
        };

        // Store both items in parallel for better performance
        await Promise.all([
          AsyncStorage.setItem(
            "selectedProperty",
            JSON.stringify(completeItem)
          ),
          AsyncStorage.setItem(
            "lastSelectedPropertyTimestamp",
            new Date().toString()
          ),
        ]);

        // Handle offline mode
        if (!isConnected) {
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
        Toast.error(
          `Error selecting property: ${
            error instanceof Error ? error.message : String(error)
          }`
        );
      }
    },
    [navigation, isConnected]
  );

  // Memoized render function to prevent recreating on each render
  const renderResultItem = useCallback(
    ({ item }: ListRenderItemInfo<Property>) => (
      <TouchableOpacity
        style={styles.resultItem}
        onPress={() => handleSelectAndNavigate(item)}
      >
        <Text style={styles.smallText}>{item.address}</Text>
        <Text style={styles.extraSmallText}>{item.company}</Text>
      </TouchableOpacity>
    ),
    [handleSelectAndNavigate]
  );

  // Memorize FlatList keyExtractor for better performance
  const keyExtractor = useCallback((item: Property) => item.id.toString(), []);

  // Memoize the skeleton loader to prevent recreating on each render
  const skeletonLoader = useMemo(
    () => (
      <View style={skeletonStyles.loaderContainer}>
        <SkeletonLoader.ContentBlock
          hasHeading={true}
          lines={1}
          style={skeletonStyles.searchHeading}
        />
        <View style={skeletonStyles.resultsContainer}>
          {Array.from({ length: 5 }).map((_, index) => (
            <SkeletonLoader.ListItem
              key={`skeleton-item-${index}`}
              hasAvatar={false}
              lines={2}
              style={skeletonStyles.listItem}
            />
          ))}
        </View>
      </View>
    ),
    []
  );

  // Handle modal close
  const handleModalClose = useCallback(() => {
    setShowSessionExpired(false);
    navigation.navigate("LoginScreen");
  }, [navigation]);

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
            value={doorNum}
            onChangeText={handleSearch}
          />
        </View>

        {loading && skeletonLoader}

        {filteredProperties.length > 0 && !loading && (
          <View style={styles.list}>
            <Text style={styles.subHeading}>Property List</Text>
            <FlatList
              data={filteredProperties}
              keyExtractor={keyExtractor}
              renderItem={renderResultItem}
              contentContainerStyle={{ paddingVertical: 10 }}
              removeClippedSubviews={true}
            />
          </View>
        )}

        {showNoResultsError && (
          <Text style={styles.errorText}>
            No property found with ({doorNum})
          </Text>
        )}
      </View>

      <Modal
        animationType="fade"
        transparent={true}
        visible={showSessionExpired}
        onRequestClose={handleModalClose}
      >
        <View style={styles.modalContainer}>
          <View style={styles.modalView}>
            <Text style={styles.modalText}>
              Session expired! Please log in again.
            </Text>
            <TouchableOpacity
              style={styles.modalButton}
              onPress={handleModalClose}
            >
              <Text style={styles.modalButtonText}>Login</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
      <GetAllCache />
    </View>
  );
};

// Additional styles for skeleton loaders
const skeletonStyles = StyleSheet.create({
  loaderContainer: {
    width: "100%",
    marginTop: 10,
    marginBottom: 10,
  },
  searchHeading: {
    marginBottom: 12,
  },
  resultsContainer: {
    width: "100%",
    marginTop: 8,
  },
  listItem: {
    marginBottom: 12,
    borderRadius: 8,
    backgroundColor: "#f8f8f8",
    padding: 8,
  },
});

export default SearchPropertyScreen;
