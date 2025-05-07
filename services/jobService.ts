import * as SQLite from "expo-sqlite";
import { Job } from "../types";

// Database initialization function
const initializeDatabase = async () => {
  console.log("[DB] Opening premierDatabase…");
  const db = await SQLite.openDatabaseAsync("premierDatabase");
  console.log("[DB] Initialized with handle:", db);

  // Initialize table
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS jobs (
      id TEXT PRIMARY KEY NOT NULL,
      job_num TEXT,
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
      status TEXT,
      importance TEXT,
      image_file_count TEXT,
      doc_file_count TEXT,
      video_file_count TEXT
    );
  `);
  console.log("[DB] jobs table ready");

  return db;
};

// Initialize database promise
const dbPromise = initializeDatabase();

// Column definitions
const COLUMNS = [
  "id",
  "job_num",
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

// SQL statements using placeholders
const SQL = {
  INSERT: `INSERT INTO jobs (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(
    () => "?"
  ).join(", ")});`,
  SELECT_BY_ID: `SELECT * FROM jobs WHERE id = ?;`,
  SELECT_ALL: `SELECT * FROM jobs;`,
  UPDATE: `UPDATE jobs SET ${COLUMNS.filter((col) => col !== "id")
    .map((col) => `${col} = ?`)
    .join(", ")} WHERE id = ?;`,
  DELETE: `DELETE FROM jobs WHERE id = ?;`,
};

/**
 * Create a new job
 */
export async function createJob(job: Job): Promise<string> {
  const db = await dbPromise;
  console.log("[createJob] Inserting job:", job);
  const statement = await db.prepareAsync(SQL.INSERT);
  try {
    const params = COLUMNS.map((col) => (job as any)[col]);
    console.log("[createJob] SQL params:", params);
    const result = await statement.executeAsync(params);
    console.log("[createJob] Result:", result);
    return result.lastInsertRowId?.toString() ?? "";
  } catch (err) {
    console.error("[createJob] ERROR:", err);
    throw err;
  } finally {
    await statement.finalizeAsync();
    console.log("[createJob] Statement finalized");
  }
}

/**
 * Get a job by ID
 */
export async function getJobById(id: string): Promise<Job | null> {
  console.log("[getJobById] Fetching job id=", id);

  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.SELECT_BY_ID);
  try {
    const result = await statement.executeAsync([id]);
    const row = await result.getFirstAsync();
    console.log("[getJobById] Row:", row);

    return row as Job | null;
  } finally {
    await statement.finalizeAsync();
  }
}

/**
 * Get all jobs
 * Updated to properly handle SQLite query results
 */
export async function getAllJobs(): Promise<Job[]> {
  console.log("[getAllJobs] Fetching all jobs");
  const db = await dbPromise;

  try {
    const statement = await db.prepareAsync(SQL.SELECT_ALL);
    const result = await statement.executeAsync([]);

    // Get all rows from the result
    const rows = await result.getAllAsync();
    console.log(`[getAllJobs] Found ${rows.length} jobs`);

    return rows as Job[];
  } catch (error) {
    console.error("[getAllJobs] Error:", error);
    throw error;
  }
}

/**
 * Update an existing job
 */
export async function updateJob(job: Job): Promise<number> {
  console.log("[updateJob] Updating job:", job.id);

  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.UPDATE);
  try {
    const params = COLUMNS.filter((col) => col !== "id").map(
      (col) => (job as any)[col]
    );
    params.push(job.id);
    const result = await statement.executeAsync(params);
    console.log("[updateJob] Changes:", result.changes);

    return result.changes;
  } finally {
    await statement.finalizeAsync();
  }
}

/**
 * Delete a job by ID
 */
export async function deleteJob(id: string): Promise<number> {
  console.log("[deleteJob] Deleting job id=", id);

  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.DELETE);
  try {
    const result = await statement.executeAsync([id]);
    console.log("[deleteJob] Rows deleted:", result.changes);

    return result.changes;
  } finally {
    await statement.finalizeAsync();
  }
}
