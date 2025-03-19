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

export interface PropertyData {
  address: string;
  company: string;
  id: string;
}

export interface JobType {
  id: number;
  job_type: string;
}

export interface TasksState {
  [key: string]: string;
}
