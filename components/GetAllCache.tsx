import React, { useEffect, useState, useCallback } from "react";
import {
  ActivityIndicator,
  FlatList,
  SafeAreaView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  RefreshControl,
} from "react-native";
import { CacheEntry, getAllCache } from "../services/cacheService";

// Refresh interval in milliseconds (30 seconds)
const REFRESH_INTERVAL = 30000;

const GetAllCache: React.FC = () => {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const [lastRefreshed, setLastRefreshed] = useState<Date>(new Date());

  const fetchEntries = useCallback(async (isManualRefresh = false) => {
    try {
      if (!isManualRefresh) {
        setLoading(true);
      }
      const allEntries = await getAllCache();
      setEntries(allEntries);
      setLastRefreshed(new Date());
      setError(null);
    } catch (err) {
      console.error("[GetAllCache] Error fetching entries:", err);
      setError("Failed to load cache entries");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const onRefresh = useCallback(() => {
    setRefreshing(true);
    fetchEntries(true);
  }, [fetchEntries]);

  useEffect(() => {
    fetchEntries();

    // Set up interval for auto-refresh
    const intervalId = setInterval(() => {
      fetchEntries(true);
    }, REFRESH_INTERVAL);

    // Clean up interval on component unmount
    return () => clearInterval(intervalId);
  }, [fetchEntries]);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator size="large" color="#0000ff" />
      </View>
    );
  }

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorText}>{error}</Text>
        <TouchableOpacity
          style={styles.retryButton}
          onPress={() => fetchEntries()}
        >
          <Text style={styles.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.headerContainer}>
        <Text style={styles.refreshText}>
          Last refreshed: {lastRefreshed.toLocaleTimeString()}
        </Text>
      </View>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        renderItem={({ item }) => {
          // Handle payload data extraction
          const list = Array.isArray(item.payload.payload)
            ? item.payload.payload
            : Array.isArray(item.payload)
            ? item.payload
            : [];
          const count = list.length;
          const isExpanded = expandedId === item.id;

          return (
            <TouchableOpacity onPress={() => toggleExpand(item.id)}>
              <View style={styles.item}>
                <Text style={styles.keyText}>{item.table_key}</Text>
                <Text style={styles.countText}>Count: {count}</Text>

                <View style={styles.timestampContainer}>
                  <Text style={styles.timestampText}>
                    Created: {item.created_at}
                  </Text>
                  <Text style={styles.timestampText}>
                    Updated: {item.updated_at}
                  </Text>
                </View>

                {isExpanded && (
                  <View style={styles.payloadContainer}>
                    <Text style={styles.payloadTitle}>Payload:</Text>
                    <Text style={styles.dataText}>
                      {JSON.stringify(list, null, 2)}
                    </Text>
                  </View>
                )}

                <Text style={styles.expandText}>
                  {isExpanded ? "▲ Collapse" : "▼ Expand"}
                </Text>
              </View>
            </TouchableOpacity>
          );
        }}
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
  headerContainer: {
    paddingVertical: 8,
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: "#eee",
  },
  refreshText: {
    fontSize: 12,
    color: "#666",
    textAlign: "center",
  },
  retryButton: {
    marginTop: 10,
    padding: 10,
    backgroundColor: "#007AFF",
    borderRadius: 4,
  },
  retryText: {
    color: "white",
    textAlign: "center",
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
    fontSize: 16,
    marginBottom: 4,
  },
  countText: {
    fontSize: 14,
    fontWeight: "600",
    marginBottom: 4,
  },
  timestampContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginVertical: 4,
  },
  timestampText: {
    fontSize: 12,
    color: "#666",
  },
  payloadContainer: {
    marginTop: 8,
    paddingTop: 8,
    borderTopWidth: 1,
    borderTopColor: "#eee",
  },
  payloadTitle: {
    fontWeight: "600",
    marginBottom: 4,
  },
  dataText: {
    marginBottom: 4,
    fontFamily: "monospace",
    fontSize: 12,
  },
  expandText: {
    textAlign: "center",
    marginTop: 8,
    fontSize: 12,
    color: "#007AFF",
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
