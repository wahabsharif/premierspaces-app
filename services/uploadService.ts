import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";

export interface UploadSegment {
  id: string;
  total_segments: number | null;
  segment_number: number | null;
  main_category: number | null;
  category_level_1: number | null;
  property_id: number | null;
  job_id: number | null;
  file_name: string | null;
  file_header: string | null;
  file_size: number | null;
  file_type: string | null;
  file_index: number | null;
  content: Uint8Array | null;
}

interface UploadRow extends UploadSegment {}

const initializeDatabase = async () => {
  const db = await SQLite.openDatabaseAsync("uploadsDB");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS upload_segments (
      id TEXT PRIMARY KEY,
      total_segments INTEGER,
      segment_number INTEGER,
      main_category INTEGER,
      category_level_1 INTEGER,
      property_id INTEGER,
      job_id INTEGER,
      file_name TEXT,
      file_header TEXT,
      file_size REAL,
      file_type TEXT,
      file_index INTEGER,
      content BLOB
    );
  `);
  return db;
};

const dbPromise = initializeDatabase();

const COLUMNS = [
  "id",
  "total_segments",
  "segment_number",
  "main_category",
  "category_level_1",
  "property_id",
  "job_id",
  "file_name",
  "file_header",
  "file_size",
  "file_type",
  "file_index",
  "content",
];

const SQL = {
  INSERT: `INSERT INTO upload_segments (${COLUMNS.join(
    ", "
  )}) VALUES (${COLUMNS.map(() => "?").join(", ")})`,
  SELECT_BY_ID: `SELECT * FROM upload_segments WHERE id = ?`,
  SELECT_ALL: `SELECT * FROM upload_segments`,
  UPDATE: `UPDATE upload_segments SET ${COLUMNS.filter((c) => c !== "id")
    .map((c) => `${c} = ?`)
    .join(", ")} WHERE id = ?`,
  DELETE: `DELETE FROM upload_segments WHERE id = ?`,
};

const safeString = (v: any): string | null =>
  v == null || v === "" ? null : String(v);
const safeNumber = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? null : n;
};

export async function createLocalUpload(
  segment: Omit<UploadSegment, "id">
): Promise<UploadSegment> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.INSERT);
  try {
    const id = uuidv4().slice(0, 5);
    const params: (string | number | Uint8Array | null)[] = [
      id,
      safeNumber(segment.total_segments),
      safeNumber(segment.segment_number),
      safeNumber(segment.main_category),
      safeNumber(segment.category_level_1),
      safeNumber(segment.property_id),
      safeNumber(segment.job_id),
      safeString(segment.file_name),
      safeString(segment.file_header),
      safeNumber(segment.file_size),
      safeString(segment.file_type),
      safeNumber(segment.file_index),
      segment.content ?? null,
    ];
    await stmt.executeAsync(params);
    return { id, ...segment };
  } finally {
    try {
      await stmt.finalizeAsync();
    } catch {}
  }
}

export async function getUploadById(id: string): Promise<UploadSegment | null> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.SELECT_BY_ID);
  try {
    const res = await stmt.executeAsync([id]);
    const row = (await res.getFirstAsync()) as UploadRow | undefined;
    if (!row) return null;
    return { ...row };
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function getAllUploads(): Promise<UploadSegment[]> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.SELECT_ALL);
  try {
    const res = await stmt.executeAsync([]);
    const rows = (await res.getAllAsync()) as UploadRow[];
    return rows.map((r) => ({ ...r }));
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function updateUpload(segment: UploadSegment): Promise<number> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.UPDATE);
  try {
    const params: (string | number | Uint8Array | null)[] = [
      safeNumber(segment.total_segments),
      safeNumber(segment.segment_number),
      safeNumber(segment.main_category),
      safeNumber(segment.category_level_1),
      safeNumber(segment.property_id),
      safeNumber(segment.job_id),
      safeString(segment.file_name),
      safeString(segment.file_header),
      safeNumber(segment.file_size),
      safeString(segment.file_type),
      safeNumber(segment.file_index),
      segment.content ?? null,
      safeString(segment.id) ?? "",
    ];
    const result = await stmt.executeAsync(params);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function deleteUpload(id: string): Promise<number> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.DELETE);
  try {
    const result = await stmt.executeAsync([id]);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}
