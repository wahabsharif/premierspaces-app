// components/GetAllCache.tsx

import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
} from "react-native";
import { getAllCache, CacheEntry } from "../../services/cacheService";

const GetAllCache: React.FC = () => {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchEntries = async () => {
      try {
        const allEntries = await getAllCache();
        setEntries(allEntries);
      } catch (err) {
        console.error("[GetAllCache] Error fetching entries:", err);
        setError("Failed to load cache entries");
      } finally {
        setLoading(false);
      }
    };

    fetchEntries();
  }, []);

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        renderItem={({ item }) => (
          <View style={styles.item}>
            <Text style={styles.keyText}>{item.table_key}</Text>
            <Text style={styles.dataText}>{JSON.stringify(item.payload)}</Text>
            <Text style={styles.timestampText}>Created: {item.created_at}</Text>
            <Text style={styles.timestampText}>Updated: {item.updated_at}</Text>
          </View>
        )}
        ListEmptyComponent={
          <Text style={styles.emptyText}>No cache entries found.</Text>
        }
      />
    </SafeAreaView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    padding: 16,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  item: {
    marginBottom: 12,
    padding: 12,
    backgroundColor: "#f9f9f9",
    borderRadius: 8,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 4,
    elevation: 2,
  },
  keyText: {
    fontWeight: "bold",
    marginBottom: 4,
  },
  dataText: {
    marginBottom: 4,
  },
  timestampText: {
    fontSize: 12,
    color: "#666",
  },
  emptyText: {
    textAlign: "center",
    marginTop: 20,
    color: "#444",
  },
  errorText: {
    color: "red",
  },
});

export default GetAllCache;
