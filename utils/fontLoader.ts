import {
  AntDesign,
  Entypo,
  Feather,
  FontAwesome,
  FontAwesome5,
  Ionicons,
  MaterialCommunityIcons,
  MaterialIcons,
  Octicons,
} from "@expo/vector-icons";
import * as Font from "expo-font";

// Load the icon fonts used in the app
export const loadFonts = async () => {
  await Font.loadAsync({
    // Load common icon fonts
    ...FontAwesome.font,
    ...FontAwesome5.font,
    ...MaterialIcons.font,
    ...Ionicons.font,
    ...MaterialCommunityIcons.font,
    ...Octicons.font,
    ...Entypo.font,
    ...Feather.font,
    ...AntDesign.font,
  });
};
