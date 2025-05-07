// components/Common/VideoThumbnail.tsx
import React, { useState, useEffect } from "react";
import {
  View,
  Image,
  ActivityIndicator,
  StyleSheet,
  Text,
  TouchableOpacity,
} from "react-native";

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
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Instead of trying to generate thumbnails, we'll just use a placeholder
  // This avoids all file system and native module dependencies

  useEffect(() => {
    // Simulate a quick loading state for better UX
    if (active) {
      setLoading(true);
      const timer = setTimeout(() => {
        setLoading(false);
      }, 300);

      return () => clearTimeout(timer);
    }
  }, [active]);

  // Fallback display for videos
  const renderVideoPlaceholder = () => (
    <View style={styles.fallbackContainer}>
      <View style={styles.playIcon}>
        <Text style={styles.playText}>▶︎</Text>
      </View>
      <Text style={styles.videoText}>Video</Text>
    </View>
  );

  if (loading) {
    return (
      <View style={styles.placeholder}>
        <ActivityIndicator size="small" color="#fff" />
        <Text style={styles.loadingText}>Loading...</Text>
      </View>
    );
  }

  return (
    <TouchableOpacity
      style={styles.container}
      onPress={onPress}
      activeOpacity={0.7}
    >
      {error ? (
        <View style={styles.errorContainer}>
          <Text style={styles.errorText}>{error}</Text>
          <Text style={styles.videoText}>Video</Text>
        </View>
      ) : (
        renderVideoPlaceholder()
      )}
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
  },
  placeholder: {
    width: "100%",
    height: "100%",
    backgroundColor: "#333",
    justifyContent: "center",
    alignItems: "center",
  },
  fallbackContainer: {
    width: "100%",
    height: "100%",
    backgroundColor: "#0077B6",
    justifyContent: "center",
    alignItems: "center",
  },
  image: {
    width: "100%",
    height: "100%",
  },
  playIcon: {
    position: "absolute",
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  playText: {
    color: "#fff",
    fontSize: 18,
    marginLeft: 3,
  },
  videoText: {
    color: "#fff",
    fontSize: 14,
    marginTop: 8,
    fontWeight: "bold",
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
    fontSize: 24,
    marginBottom: 8,
  },
  loadingText: {
    color: "#fff",
    fontSize: 12,
    marginTop: 8,
  },
});

export default VideoThumbnail;
