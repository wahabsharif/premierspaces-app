import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { Counts } from "../types";
import { Toast } from "toastify-react-native";

interface CountRow {
  id: string;
  property_id: string | null;
  common_id: string | null;
  image_file_count: number | null;
  doc_file_count: number | null;
  video_file_count: number | null;
  created_at: number;
}

const initializeDatabase = async () => {
  const db = await SQLite.openDatabaseAsync("fileCountDB");
  await db.execAsync(`
PRAGMA journal_mode = WAL;
CREATE TABLE IF NOT EXISTS file_counts (
  id TEXT PRIMARY KEY,
  property_id TEXT,
  common_id TEXT,
  image_file_count INTEGER,
  doc_file_count INTEGER,
  video_file_count INTEGER,
  created_at INTEGER DEFAULT (strftime('%s', 'now'))
);
  `);
  return db;
};
const dbPromise = initializeDatabase();

const COLUMNS = [
  "id",
  "property_id",
  "common_id",
  "image_file_count",
  "doc_file_count",
  "video_file_count",
  "created_at",
];

const SQL = {
  INSERT: `INSERT INTO file_counts (${COLUMNS.join(
    ", "
  )}) VALUES (${COLUMNS.map(() => "?").join(", ")})`,
  SELECT_BY_ID: `SELECT * FROM file_counts WHERE id = ?`,
  SELECT_ALL: `SELECT * FROM file_counts`,
  UPDATE: `UPDATE file_counts SET ${COLUMNS.filter((c) => c !== "id")
    .map((c) => `${c} = ?`)
    .join(", ")} WHERE id = ?`,
  DELETE: `DELETE FROM file_counts WHERE id = ?`,
};

const safeString = (v: any): string | null =>
  v == null || v === "" ? null : String(v);
const safeNumber = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? parseInt(v) : Number(v);
  return isNaN(n) ? null : n;
};

export async function createFileCount(count: Counts): Promise<Counts> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.INSERT);
  try {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);
    const params: (string | number | null)[] = [
      id,
      safeString(count.property_id),
      safeString(count.common_id),
      safeNumber(count.image_file_count),
      safeNumber(count.doc_file_count),
      safeNumber(count.video_file_count),
      now,
    ];
    await stmt.executeAsync(params);
    await stmt.finalizeAsync();
    return {
      id,
      property_id: count.property_id,
      common_id: count.common_id,
      image_file_count: count.image_file_count,
      doc_file_count: count.doc_file_count,
      video_file_count: count.video_file_count,
    };
  } finally {
    try {
      await stmt.finalizeAsync();
    } catch {}
  }
}

export async function getAllFileCounts(): Promise<Counts[]> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.SELECT_ALL);
  try {
    const result = await stmt.executeAsync([]);
    const rows = (await result.getAllAsync()) as CountRow[];
    return rows.map((row) => ({
      id: row.id,
      property_id: row.property_id,
      common_id: row.common_id,
      image_file_count: row.image_file_count,
      doc_file_count: row.doc_file_count,
      video_file_count: row.video_file_count,
    }));
  } finally {
    await stmt.finalizeAsync();
  }
}

/**
 * A unified function to get counts based on different ID combinations
 * @param options Object containing optional id, property_id, and/or common_id
 * @returns Promise<Counts[]> Array of matching count records
 */
export async function getFileCountByIds(options: {
  id?: string;
  property_id?: string;
  common_id?: string;
}): Promise<Counts[]> {
  const db = await dbPromise;
  let query = "SELECT * FROM file_counts WHERE 1=1";
  const params: string[] = [];

  // Build query dynamically based on provided parameters
  if (options.id) {
    query += " AND id = ?";
    params.push(options.id);
  }

  if (options.property_id) {
    query += " AND property_id = ?";
    params.push(options.property_id);
  }

  if (options.common_id) {
    query += " AND common_id = ?";
    params.push(options.common_id);
  }

  try {
    const stmt = await db.prepareAsync(query);
    const result = await stmt.executeAsync(params);
    const rows = (await result.getAllAsync()) as CountRow[];

    return rows.map((row) => ({
      id: row.id,
      property_id: row.property_id,
      common_id: row.common_id,
      image_file_count: row.image_file_count,
      doc_file_count: row.doc_file_count,
      video_file_count: row.video_file_count,
    }));
  } catch (error) {
    Toast.error(
      `Error in getCountByIds: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
    return [];
  }
}

export async function updateFileCount(count: Counts): Promise<number> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.UPDATE);
  try {
    const now = Math.floor(Date.now() / 1000);
    const params: (string | number | null)[] = [
      safeString(count.property_id),
      safeString(count.common_id),
      safeNumber(count.image_file_count),
      safeNumber(count.doc_file_count),
      safeNumber(count.video_file_count),
      now,
      safeString(count.id) ?? "", // <-- can't be undefined
    ];
    const result = await stmt.executeAsync(params);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function deleteFileCount(id: string): Promise<number> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.DELETE);
  try {
    const result = await stmt.executeAsync([id]);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}
