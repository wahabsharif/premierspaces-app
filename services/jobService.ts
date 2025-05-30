import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { Job } from "../types";
import { Toast } from "toastify-react-native";

const initializeDatabase = async () => {
  const db = await SQLite.openDatabaseAsync("jobsDB");

  // Initialize table with default status of '1'
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      job_num TEXT,
      common_id TEXT,
      date_created TEXT,
      property_id TEXT,
      tenant_id TEXT,
      assignto_user_id TEXT,
      job_type TEXT,
      ll_informed TEXT,
      task1 TEXT,    task1_status TEXT,    task1_cost TEXT,
      task2 TEXT,    task2_status TEXT,    task2_cost TEXT,
      task3 TEXT,    task3_status TEXT,    task3_cost TEXT,
      task4 TEXT,    task4_status TEXT,    task4_cost TEXT,
      task5 TEXT,    task5_status TEXT,    task5_cost TEXT,
      task6 TEXT,    task6_status TEXT,    task6_cost TEXT,
      task7 TEXT,    task7_status TEXT,    task7_cost TEXT,
      task8 TEXT,    task8_status TEXT,    task8_cost TEXT,
      task9 TEXT,    task9_status TEXT,    task9_cost TEXT,
      task10 TEXT,   task10_status TEXT,   task10_cost TEXT,
      invoice_no TEXT,
      material_cost TEXT,
      contractor_other TEXT,
      smart_care_amount TEXT,
      date_job_closed TEXT,
      status TEXT DEFAULT '1',
      importance TEXT,
      image_file_count TEXT,
      doc_file_count TEXT,
      video_file_count TEXT
    );
  `);

  return db;
};

const dbPromise = initializeDatabase();

const COLUMNS = [
  "id",
  "job_num",
  "common_id",
  "date_created",
  "property_id",
  "tenant_id",
  "assignto_user_id",
  "job_type",
  "ll_informed",
  "task1",
  "task1_status",
  "task1_cost",
  "task2",
  "task2_status",
  "task2_cost",
  "task3",
  "task3_status",
  "task3_cost",
  "task4",
  "task4_status",
  "task4_cost",
  "task5",
  "task5_status",
  "task5_cost",
  "task6",
  "task6_status",
  "task6_cost",
  "task7",
  "task7_status",
  "task7_cost",
  "task8",
  "task8_status",
  "task8_cost",
  "task9",
  "task9_status",
  "task9_cost",
  "task10",
  "task10_status",
  "task10_cost",
  "invoice_no",
  "material_cost",
  "contractor_other",
  "smart_care_amount",
  "date_job_closed",
  "status",
  "importance",
  "image_file_count",
  "doc_file_count",
  "video_file_count",
];

const SQL = {
  INSERT: `INSERT INTO jobs (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(
    () => "?"
  ).join(", ")});`,
  SELECT_BY_ID: `SELECT * FROM jobs WHERE id = ?;`,
  SELECT_ALL: `SELECT * FROM jobs;`,
  UPDATE: `UPDATE jobs SET ${COLUMNS.filter((col) => col !== "id")
    .map((col) => `${col} = ?`)
    .join(", ")} WHERE id = ?;`,
  UPDATE_BY_COMMON_ID: `UPDATE jobs SET ${COLUMNS.filter((col) => col !== "id")
    .map((col) => `${col} = ?`)
    .join(", ")} WHERE common_id = ?;`,
  DELETE: `DELETE FROM jobs WHERE id = ?;`,
};

export async function createJob(job: Job): Promise<string> {
  const db = await dbPromise;

  // Assign a new UUID if missing
  if (!job.id || job.id.trim() === "") {
    job.id = uuidv4();
  }

  // Set creation date if missing
  if (!job.date_created) {
    job.date_created = new Date().toISOString();
  }

  // Ensure offline job has status = '1' by default
  if (!job.status) {
    job.status = "1";
  }

  const statement = await db.prepareAsync(SQL.INSERT);
  try {
    const params = COLUMNS.map((col) => {
      const value = (job as any)[col];
      return value !== undefined ? value : null;
    });

    const result = await statement.executeAsync(params);
    return job.id;
  } catch (err) {
    Toast.error(
      `[createJob] ERROR: ${err instanceof Error ? err.message : String(err)}`
    );
    throw err;
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getJobById(id: string): Promise<Job | null> {
  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.SELECT_BY_ID);
  try {
    const result = await statement.executeAsync([id]);
    const row = await result.getFirstAsync();

    return row as Job | null;
  } finally {
    await statement.finalizeAsync();
  }
}

// Track jobs that are currently being processed
const jobsBeingProcessed = new Set<string>();

export async function getAllJobs(): Promise<Job[]> {
  const db = await dbPromise;

  try {
    const statement = await db.prepareAsync(SQL.SELECT_ALL);
    const result = await statement.executeAsync([]);

    const rows = await result.getAllAsync();
    return rows as Job[];
  } catch (error) {
    Toast.error(
      `[getAllJobs] Error: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    // Return empty array instead of throwing to prevent crashes
    return [];
  }
}

export async function updateJob(job: Job): Promise<number> {
  const db = await dbPromise;

  // Determine if we're updating by id or common_id
  const updateById = job.id && job.id.trim() !== "";
  const updateByCommonId = job.common_id && job.common_id.trim() !== "";

  if (!updateById && !updateByCommonId) {
    throw new Error("Either id or common_id must be provided for update");
  }

  const sql = updateById ? SQL.UPDATE : SQL.UPDATE_BY_COMMON_ID;
  const statement = await db.prepareAsync(sql);

  try {
    const params = COLUMNS.filter((col) => col !== "id").map(
      (col) => (job as any)[col]
    );

    // Push the identifier (either id or common_id) as the last parameter
    params.push(updateById ? job.id : job.common_id);

    const result = await statement.executeAsync(params);
    return result.changes;
  } finally {
    await statement.finalizeAsync();
  }
}

export async function deleteJob(id: string): Promise<number> {
  // Prevent race conditions by checking if this job is already being processed
  if (jobsBeingProcessed.has(id)) {
    return 0;
  }

  jobsBeingProcessed.add(id);
  let statement;

  try {
    const db = await dbPromise;
    statement = await db.prepareAsync(SQL.DELETE);

    const result = await statement.executeAsync([id]);

    return result.changes;
  } finally {
    // Remove from tracking set when done
    jobsBeingProcessed.delete(id);
    if (statement) {
      await statement.finalizeAsync();
    }
  }
}

// Add this function to check if there are any pending jobs
export async function hasPendingJobs(): Promise<boolean> {
  const jobs = await getAllJobs();
  return jobs.length > 0;
}
