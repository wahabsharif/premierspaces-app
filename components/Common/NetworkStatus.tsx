import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { Animated, Text } from "react-native";
import styles from "../../Constants/styles";
import { color } from "../../Constants/theme";

type Props = { offset?: number };

const NetworkStatus: React.FC<Props> = ({ offset = 0 }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const [visible, setVisible] = useState<boolean>(false);
  const opacity = useState(new Animated.Value(0))[0];

  useEffect(() => {
    // Subscribe to network state updates
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);

      if (state.isConnected === false) {
        // Show the banner when disconnected
        setVisible(true);
        Animated.timing(opacity, {
          toValue: 1,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else if (state.isConnected === true && visible) {
        // Hide the banner with animation when reconnected
        Animated.timing(opacity, {
          toValue: 0,
          duration: 300,
          useNativeDriver: true,
        }).start(() => {
          setVisible(false);
        });
      }
    });

    // Initial check
    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      setVisible(state.isConnected === false);
      opacity.setValue(state.isConnected === false ? 1 : 0);
    });

    // Cleanup subscription
    return () => unsubscribe();
  }, [visible, opacity]);

  if (!visible) return null;

  return (
    <Animated.View
      style={[
        {
          top: offset,
          opacity,
          justifyContent: "center",
          alignItems: "center",
          width: "100%",
        },
        isConnected
          ? { backgroundColor: color.green }
          : { backgroundColor: color.red },
      ]}
    >
      <Text style={[styles.extraSmallText, { color: color.white }]}>
        {isConnected ? "Online" : "No Internet Connection"}
      </Text>
    </Animated.View>
  );
};

export default NetworkStatus;
