// types.ts (or in your navigation file)
export type RootStackParamList = {
  Home: undefined;
  LoginScreen: undefined;
  SettingScreen: undefined;
  AppLockSettingScreen: undefined;
  CategoryScreen: { paramKey: string };
  SearchPropertyScreen: undefined;
  PropertyListScreen: { door_num?: string; results?: any } | undefined;
  ChangeAppPinScreen: undefined;
  OpenNewJobScreen: undefined;
  JobsScreen: undefined;
  JobDetail: {
    job: { id: string; title: string; company: string; location: string };
  };
};
