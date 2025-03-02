// apiData.ts

// Request Wrapper Interface
export interface RequestWrapper<T> {
  userid: number;
  payload: T;
}

// Payload Objects

export interface UserLoginPayload {
  initials: string;
  pin: string;
}

export interface PropertySearchPayload {
  door_num: string; // Alpha-numeric
}

// Response Wrapper Interface
export interface ResponseWrapper<T> {
  status: number; // 1 = success, 0 = error
  payload: T;
}

// Error Response
export interface ErrorResponse {
  message: string;
}

// User Login Success Response
export interface UserLoginResponse {
  userid: number;
  name: string;
  role: "p" | "m" | "a" | "b"; // principal, manager, accounts, builder
}

// Property Object
export interface Property {
  id: number;
  address: string;
}

// Properties List Response
export interface PropertiesListResponse {
  properties: Property[];
}

// Job Object
export interface Job {
  id: number;
  job_num: string;
  date_created: string;
  task1: string;
  task1_status: number;
  task2: string;
  task2_status: number;
  task3: string;
  task3_status: number;
  task4: string;
  task4_status: number;
  task5: string;
  task5_status: number;
  task6: string;
  task6_status: number;
  task7: string;
  task7_status: number;
  task8: string;
  task8_status: number;
  task9: string;
  task9_status: number;
  task10: string;
  task10_status: number;
}

// Jobs List Response
export interface JobsListResponse {
  jobs: Job[];
}

// File Upload Category Object
export interface FileUploadCategory {
  id: number;
  category: string;
  sub_categories: FileUploadCategory[];
}

// Image File Upload Categories Response
export interface ImageFileUploadCategoriesResponse {
  main_categories: FileUploadCategory[];
}
