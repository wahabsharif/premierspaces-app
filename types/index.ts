export type RootStackParamList = {
  Home: undefined;
  LoginScreen: undefined;
  SettingScreen: undefined;
  AppLockSettingScreen: undefined;
  CategoryScreen: { paramKey: string; fromOfflineMode?: boolean };
  SearchPropertyScreen: undefined;
  UploadScreen: { jobId: string };
  PropertyListScreen: { door_num?: string; results?: any } | undefined;
  ChangeAppPinScreen: undefined;
  OpenNewJobScreen: undefined;
  FilesScreen: undefined;
  MediaPreviewScreen: { jobId: string; fileCategory: string };
  JobsScreen: undefined;
  JobDetailScreen: { id: string };
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
export interface Job {
  id: string;
  job_num: string;
  date_created: string;
  property_id: string;
  tenant_id: string;
  assignto_user_id: string;
  job_type: string;
  ll_informed: string;
  task1: string;
  task1_status: string;
  task1_cost: string;
  task2: string;
  task2_status: string;
  task2_cost: string;
  task3: string;
  task3_status: string;
  task3_cost: string;
  task4: string;
  task4_status: string;
  task4_cost: string;
  task5: string;
  task5_status: string;
  task5_cost: string;
  task6: string;
  task6_status: string;
  task6_cost: string;
  task7: string;
  task7_status: string;
  task7_cost: string;
  task8: string;
  task8_status: string;
  task8_cost: string;
  task9: string;
  task9_status: string;
  task9_cost: string;
  task10: string;
  task10_status: string;
  task10_cost: string;
  invoice_no: string;
  material_cost: string;
  contractor_other: string;
  smart_care_amount: string;
  date_job_closed: string;
  status: string;
  importance: string;
  image_file_count: string;
  doc_file_count: string;
  video_file_count: string;
}

export interface TasksState {
  [key: string]: string;
}

export interface ProgressBarProps {
  progress: number;
  uploadedCount: number;
  totalCount: number;
}

export interface UploadScreenProps {
  route: any;
  navigation: any;
}

export interface ChangeAppPinScreenProps {
  navigation: any;
}

export interface FileItem {
  id: string;
  file_name: string;
  path: string;
  date_created: string;
  stream_url: string;
  property_id: string;
  job_id: string;
  user_name: string;
  job_num: string;
  main_category: string;
  sub_category: string;
}

export interface FileTypeCount {
  type: string;
  count: number;
  icon: string;
}

export interface GroupedFiles {
  path: string;
  formattedPath: string;
  files: FileItem[];
  fileTypeCounts: FileTypeCount[];
}
