import NetInfo from "@react-native-community/netinfo";
import React, { useEffect, useState } from "react";
import { Animated, StatusBar, Text } from "react-native";
import styles from "../Constants/styles";
import { color } from "../Constants/theme";

type Props = { offset?: number };

const NetworkStatus: React.FC<Props> = ({ offset = 0 }) => {
  const [isConnected, setIsConnected] = useState<boolean | null>(true);
  const translateY = useState(new Animated.Value(-50))[0];

  useEffect(() => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      setIsConnected(state.isConnected);

      if (state.isConnected === false) {
        Animated.timing(translateY, {
          toValue: offset,
          duration: 300,
          useNativeDriver: true,
        }).start();
      } else {
        Animated.timing(translateY, {
          toValue: -50,
          duration: 300,
          useNativeDriver: true,
        }).start();
      }
    });

    NetInfo.fetch().then((state) => {
      setIsConnected(state.isConnected);
      translateY.setValue(state.isConnected === false ? offset : -50);
    });

    return () => unsubscribe();
  }, [offset, translateY]);

  return (
    <>
      <StatusBar
        translucent
        backgroundColor="transparent"
        barStyle={isConnected ? "dark-content" : "light-content"}
      />
      <Animated.View
        style={{
          transform: [{ translateY }],
          position: "absolute",
          left: 0,
          right: 0,
          justifyContent: "center",
          alignItems: "center",
          height: 25,
          backgroundColor: isConnected ? color.green : color.red,
          zIndex: 999,
        }}
      >
        <Text
          style={[
            styles.extraSmallText,
            { color: color.white, fontWeight: "bold" },
          ]}
        >
          {isConnected ? "Online" : "No Internet Connection"}
        </Text>
      </Animated.View>
    </>
  );
};

export default NetworkStatus;
