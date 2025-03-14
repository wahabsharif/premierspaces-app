import { View, StyleSheet, Text } from "react-native";
import { color, fontSize } from "../../Constants/theme";

interface ProgressBarProps {
  progress: number;
  uploadedCount: number;
  totalCount: number;
}
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  uploadedCount,
  totalCount,
}) => (
  <View style={progressStyles.container}>
    <View style={progressStyles.barContainer}>
      <View style={[progressStyles.bar, { width: `${progress}%` }]} />
    </View>
    <Text style={progressStyles.text}>
      {`${uploadedCount}/${totalCount} (${progress}%)`}
    </Text>
  </View>
);

const progressStyles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: "center",
  },
  barContainer: {
    width: "100%",
    height: 20,
    backgroundColor: "#e0e0e0",
    borderRadius: 10,
    overflow: "hidden",
  },
  bar: {
    height: "100%",
    backgroundColor: color.primary,
  },
  text: {
    marginTop: 5,
    fontSize: fontSize.medium,
    color: color.gray,
  },
});
