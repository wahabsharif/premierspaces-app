import { StyleSheet, Text, View } from "react-native";
import { color, fontSize } from "../../Constants/theme";
import { ProgressBarProps } from "../../types";
export const ProgressBar: React.FC<ProgressBarProps> = ({
  progress,
  uploadedCount,
  totalCount,
}) => (
  <View style={progressStyles.container}>
    <View style={progressStyles.barContainer}>
      <View style={[progressStyles.bar, { width: `${progress}%` }]} />
    </View>
    <View style={progressStyles.textContainer}>
      <Text
        style={progressStyles.text}
      >{`${uploadedCount}/${totalCount}`}</Text>
      <Text style={progressStyles.text}>{`(${progress}%)`}</Text>
    </View>
  </View>
);

const progressStyles = StyleSheet.create({
  container: {
    marginVertical: 10,
    alignItems: "center",
    width: "100%",
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
  textContainer: {
    flexDirection: "row",
    justifyContent: "space-between",
    width: "100%",
    marginTop: 5,
    paddingHorizontal: 10,
  },
  text: {
    fontSize: fontSize.large,
    fontWeight: "600",
    color: color.gray,
  },
});
