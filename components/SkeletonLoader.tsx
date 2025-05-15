import { LinearGradient } from "expo-linear-gradient";
import React from "react";
import { StyleSheet, View, ViewStyle } from "react-native";
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withRepeat,
  withTiming,
} from "react-native-reanimated";

interface SkeletonProps {
  style?: ViewStyle;
  children?: React.ReactNode;
}

// Base Skeleton Component with Animation
const SkeletonBase: React.FC<SkeletonProps> = ({ style, children }) => {
  const opacity = useSharedValue(0.3);

  React.useEffect(() => {
    opacity.value = withRepeat(
      withTiming(0.8, { duration: 1000, easing: Easing.ease }),
      -1,
      true
    );
  }, []);

  const animatedStyle = useAnimatedStyle(() => ({
    opacity: opacity.value,
  }));

  return (
    <Animated.View style={[styles.skeleton, style, animatedStyle]}>
      <LinearGradient
        colors={["#f0f0f0", "#e0e0e0", "#f0f0f0"]}
        start={{ x: 0, y: 0 }}
        end={{ x: 1, y: 0 }}
        style={StyleSheet.absoluteFill}
      />
      {children}
    </Animated.View>
  );
};

// Circle Skeleton
export const CircleSkeleton: React.FC<{ size?: number; style?: ViewStyle }> = ({
  size = 48,
  style,
}) => (
  <SkeletonBase
    style={StyleSheet.flatten([
      styles.circle,
      { width: size, height: size },
      style,
    ])}
  />
);

// Line/Text Skeleton
export const LineSkeleton: React.FC<{
  width?: number | string;
  height?: number;
  style?: ViewStyle;
}> = ({ width = "100%", height = 12, style }) => (
  <SkeletonBase
    style={
      StyleSheet.flatten([styles.line, { width, height }, style]) as ViewStyle
    }
  />
);

// Row Skeleton (label + content)
export const RowSkeleton: React.FC<{
  labelWidth?: number | string;
  contentWidth?: number | string;
  height?: number;
  gap?: number;
  style?: ViewStyle;
}> = ({
  labelWidth = "30%",
  contentWidth = "65%",
  height = 16,
  gap = 8,
  style,
}) => (
  <View style={[styles.row, { gap }, style]}>
    <LineSkeleton width={labelWidth} height={height} />
    <LineSkeleton width={contentWidth} height={height} />
  </View>
);

// Card Skeleton
export const CardSkeleton: React.FC<{
  height?: number | string;
  style?: ViewStyle;
  hasHeader?: boolean;
  hasFooter?: boolean;
  contentLines?: number;
}> = ({
  height = 150,
  style,
  hasHeader = true,
  hasFooter = false,
  contentLines = 3,
}) => (
  <SkeletonBase
    style={StyleSheet.flatten([styles.card, { height }, style]) as ViewStyle}
  >
    <View style={styles.cardInner}>
      {hasHeader && (
        <View style={styles.cardHeader}>
          <CircleSkeleton size={32} />
          <View style={styles.cardHeaderText}>
            <LineSkeleton width="60%" height={14} />
            <LineSkeleton width="40%" height={10} style={{ marginTop: 4 }} />
          </View>
        </View>
      )}

      <View style={styles.cardContent}>
        {Array.from({ length: contentLines }).map((_, index) => (
          <LineSkeleton
            key={`content-line-${index}`}
            width={`${Math.max(70, 100 - index * 10)}%`}
            height={12}
            style={{ marginBottom: 8 }}
          />
        ))}
      </View>

      {hasFooter && (
        <View style={styles.cardFooter}>
          <LineSkeleton width="30%" height={12} />
          <LineSkeleton width="20%" height={12} />
        </View>
      )}
    </View>
  </SkeletonBase>
);

// Table Skeleton
export const TableSkeleton: React.FC<{
  rows?: number;
  columns?: number;
  style?: ViewStyle;
  hasHeader?: boolean;
}> = ({ rows = 4, columns = 3, style, hasHeader = true }) => (
  <View style={[styles.table, style]}>
    {hasHeader && (
      <View style={styles.tableRow}>
        {Array.from({ length: columns }).map((_, index) => (
          <SkeletonBase
            key={`header-${index}`}
            style={StyleSheet.flatten([
              styles.tableCell,
              styles.tableHeaderCell,
            ])}
          />
        ))}
      </View>
    )}

    {Array.from({ length: rows }).map((_, rowIndex) => (
      <View key={`row-${rowIndex}`} style={styles.tableRow}>
        {Array.from({ length: columns }).map((_, columnIndex) => (
          <SkeletonBase
            key={`cell-${rowIndex}-${columnIndex}`}
            style={styles.tableCell}
          />
        ))}
      </View>
    ))}
  </View>
);

// List Item Skeleton
export const ListItemSkeleton: React.FC<{
  hasAvatar?: boolean;
  lines?: number;
  style?: ViewStyle;
}> = ({ hasAvatar = true, lines = 2, style }) => (
  <View style={[styles.listItem, style]}>
    {hasAvatar && <CircleSkeleton size={40} />}
    <View style={styles.listItemContent}>
      {Array.from({ length: lines }).map((_, index) => (
        <LineSkeleton
          key={`line-${index}`}
          width={`${index === 0 ? 70 : 90}%`}
          height={index === 0 ? 14 : 12}
          style={{ marginBottom: 6 }}
        />
      ))}
    </View>
  </View>
);

// Content Block Skeleton
export const ContentBlockSkeleton: React.FC<{
  lines?: number;
  style?: ViewStyle;
  hasHeading?: boolean;
}> = ({ lines = 6, style, hasHeading = true }) => (
  <View style={[styles.contentBlock, style]}>
    {hasHeading && (
      <LineSkeleton width="70%" height={20} style={{ marginBottom: 16 }} />
    )}

    {Array.from({ length: lines }).map((_, index) => (
      <LineSkeleton
        key={`paragraph-${index}`}
        width={`${85 + Math.random() * 15}%`}
        height={12}
        style={{ marginBottom: 8 }}
      />
    ))}
  </View>
);

// Form Skeleton
export const FormSkeleton: React.FC<{
  fields?: number;
  style?: ViewStyle;
}> = ({ fields = 4, style }) => (
  <View style={[styles.form, style]}>
    {Array.from({ length: fields }).map((_, index) => (
      <View key={`field-${index}`} style={styles.formField}>
        <LineSkeleton width="40%" height={14} style={{ marginBottom: 6 }} />
        <SkeletonBase style={styles.formInput} />
      </View>
    ))}
    <SkeletonBase style={styles.formButton} />
  </View>
);

// Grid Skeleton
export const GridSkeleton: React.FC<{
  columns?: number;
  items?: number;
  itemHeight?: number;
  style?: ViewStyle;
}> = ({ columns = 2, items = 6, itemHeight = 100, style }) => (
  <View style={[styles.grid, style]}>
    {Array.from({ length: items }).map((_, index) => (
      <SkeletonBase
        key={`grid-item-${index}`}
        style={
          StyleSheet.flatten([
            styles.gridItem,
            {
              height: itemHeight,
              width: `${100 / columns - 4}%`,
            },
          ]) as ViewStyle
        }
      />
    ))}
  </View>
);

// Avatar with details skeleton
export const ProfileSkeleton: React.FC<{
  style?: ViewStyle;
}> = ({ style }) => (
  <View style={[styles.profile, style]}>
    <CircleSkeleton size={80} />
    <View style={styles.profileInfo}>
      <LineSkeleton width="70%" height={18} style={{ marginBottom: 8 }} />
      <LineSkeleton width="90%" height={14} style={{ marginBottom: 8 }} />
      <LineSkeleton width="50%" height={14} />
    </View>
  </View>
);

// Main export component that combines all skeleton types
const SkeletonLoader = {
  Circle: CircleSkeleton,
  Line: LineSkeleton,
  Row: RowSkeleton,
  Card: CardSkeleton,
  Table: TableSkeleton,
  ListItem: ListItemSkeleton,
  ContentBlock: ContentBlockSkeleton,
  Form: FormSkeleton,
  Grid: GridSkeleton,
  Profile: ProfileSkeleton,
};

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: "#e0e0e0",
    borderRadius: 4,
    overflow: "hidden",
  },
  circle: {
    borderRadius: 100,
  },
  line: {
    height: 12,
    borderRadius: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    width: "100%",
    marginVertical: 4,
  },
  card: {
    borderRadius: 8,
    width: "100%",
    padding: 12,
  },
  cardInner: {
    flex: 1,
    justifyContent: "space-between",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
  },
  cardHeaderText: {
    marginLeft: 12,
    flex: 1,
  },
  cardContent: {
    flex: 1,
    justifyContent: "center",
    paddingVertical: 12,
  },
  cardFooter: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  table: {
    width: "100%",
    borderRadius: 8,
    overflow: "hidden",
  },
  tableRow: {
    flexDirection: "row",
    width: "100%",
  },
  tableCell: {
    flex: 1,
    height: 40,
    borderWidth: 1,
    borderColor: "#f5f5f5",
  },
  tableHeaderCell: {
    height: 50,
  },
  listItem: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 12,
    width: "100%",
  },
  listItemContent: {
    flex: 1,
    marginLeft: 12,
  },
  contentBlock: {
    width: "100%",
    paddingVertical: 12,
  },
  form: {
    width: "100%",
  },
  formField: {
    marginBottom: 16,
  },
  formInput: {
    height: 40,
    width: "100%",
    borderRadius: 4,
  },
  formButton: {
    height: 48,
    width: "100%",
    borderRadius: 8,
    marginTop: 16,
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    width: "100%",
  },
  gridItem: {
    borderRadius: 8,
    marginBottom: 16,
  },
  profile: {
    alignItems: "center",
    padding: 16,
  },
  profileInfo: {
    alignItems: "center",
    marginTop: 16,
    width: "100%",
  },
});

export default SkeletonLoader;
