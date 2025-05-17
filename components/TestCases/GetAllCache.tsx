import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  StyleSheet,
  SafeAreaView,
  ActivityIndicator,
  TouchableOpacity,
} from "react-native";
import { getAllCache, CacheEntry } from "../../services/cacheService";

const GetAllCache: React.FC = () => {
  const [entries, setEntries] = useState<CacheEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<number | null>(null);

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
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <FlatList
        data={entries}
        keyExtractor={(item) => item.id.toString()}
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
