// types.ts (or in your navigation file)
export type RootStackParamList = {
  Home: undefined;
  SettingScreen: undefined;
  AppLockSettingScreen: undefined;
  CategoryScreen: { paramKey: string };
  SearchPropertyScreen: undefined;
  PropertyListScreen: { door_num?: string; results?: any } | undefined;
  ChangeAppPinScreen: undefined;
  LoginScreen: undefined;
};
