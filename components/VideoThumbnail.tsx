import React, { useState, useEffect } from "react";
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";
import * as VideoThumbnails from "expo-video-thumbnails";
import { fontSize } from "../Constants/theme";

interface VideoThumbnailProps {
  uri: string;
  onPress: () => void;
  active: boolean;
  cache: Map<string, string>;
}

const VideoThumbnail: React.FC<VideoThumbnailProps> = ({
  uri,
  onPress,
  active,
  cache,
}) => {
  const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (active) {
      generateThumbnail();
    }
  }, [active, uri]);

  const generateThumbnail = async () => {
    setLoading(true);
    setError(null);

    try {
      // Check if thumbnail is already cached
      if (cache.has(uri)) {
        setThumbnailUri(cache.get(uri)!);
        setLoading(false);
        return;
      }

      // Generate thumbnail at 1 second into the video
      const { uri: thumbUri } = await VideoThumbnails.getThumbnailAsync(uri, {
        time: 1000, // Time in milliseconds (1 second)
      });

      // Store the thumbnail URI in the cache
      cache.set(uri, thumbUri);
      setThumbnailUri(thumbUri);
    } catch (err) {
      console.error("Failed to generate thumbnail:", err);
      setError("Failed to load thumbnail");
    } finally {
      setLoading(false);
    }
  };

  // Loading state
  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color="#fff" />
      </View>
    );
  }

  // Error or no thumbnail state
  if (error || !thumbnailUri) {
    return (
      <View style={styles.errorContainer}>
        <Text style={styles.errorText}>
          {error || "No thumbnail available"}
        </Text>
        <Text style={styles.videoText}>Video</Text>
      </View>
    );
  }

  // Success state: display the thumbnail
  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View style={styles.filmStripLeft}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`left-${i}`} style={styles.filmHole} />
        ))}
      </View>
      <Image source={{ uri: thumbnailUri }} style={styles.image} />
      <View style={styles.filmStripRight}>
        {Array.from({ length: 5 }).map((_, i) => (
          <View key={`right-${i}`} style={styles.filmHole} />
        ))}
      </View>
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  container: {
    width: "100%",
    height: "100%",
    backgroundColor: "#222",
    justifyContent: "center",
    alignItems: "center",
    overflow: "hidden",
    position: "relative",
    flexDirection: "row",
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    flex: 1,
    height: "100%",
  },
  filmStripLeft: {
    width: 10,
    height: "100%",
    backgroundColor: "#000",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  filmStripRight: {
    width: 10,
    height: "100%",
    backgroundColor: "#000",
    justifyContent: "space-evenly",
    alignItems: "center",
  },
  filmHole: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: "#333",
  },
  errorContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#aa3333",
    justifyContent: "center",
    alignItems: "center",
  },
  errorText: {
    color: "#fff",
    fontSize: 14,
    marginBottom: 8,
  },
  videoText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "bold",
  },
});

export default VideoThumbnail;
