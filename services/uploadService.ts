import * as FileSystem from "expo-file-system";
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
  content_path: string | null; // Store file path instead of binary content
  uri: string | null; // Original file URI
}

interface UploadRow extends Omit<UploadSegment, "content"> {}

const UPLOAD_DIRECTORY = `${FileSystem.documentDirectory}offline_uploads/`;

// Ensure upload directory exists
const ensureDirectoryExists = async () => {
  const dirInfo = await FileSystem.getInfoAsync(UPLOAD_DIRECTORY);
  if (!dirInfo.exists) {
    await FileSystem.makeDirectoryAsync(UPLOAD_DIRECTORY, {
      intermediates: true,
    });
  }
};

const initializeDatabase = async () => {
  await ensureDirectoryExists();

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
      content_path TEXT,
      uri TEXT
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
  "content_path",
  "uri",
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

// Write binary content to a file
const saveBinaryContent = async (
  content: Uint8Array | null,
  id: string,
  fileName: string | null
): Promise<string | null> => {
  if (!content) return null;

  const fileExtension = fileName ? fileName.split(".").pop() || "" : "";
  const filePath = `${UPLOAD_DIRECTORY}${id}-${Date.now()}.${fileExtension}`;

  try {
    await FileSystem.writeAsStringAsync(
      filePath,
      arrayBufferToBase64(content),
      {
        encoding: FileSystem.EncodingType.Base64,
      }
    );
    return filePath;
  } catch (error) {
    console.error("Error saving file content:", error);
    return null;
  }
};

// Convert ArrayBuffer to Base64 string
function arrayBufferToBase64(buffer: Uint8Array): string {
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const len = bytes.byteLength;

  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }

  return btoa(binary);
}

// Save file from URI to local storage
const saveFileFromUri = async (
  uri: string,
  id: string,
  fileName: string | null
): Promise<string | null> => {
  try {
    const fileExtension = fileName ? fileName.split(".").pop() || "" : "";
    const destinationPath = `${UPLOAD_DIRECTORY}${id}-${Date.now()}.${fileExtension}`;

    await FileSystem.copyAsync({
      from: uri,
      to: destinationPath,
    });

    return destinationPath;
  } catch (error) {
    console.error("Error copying file:", error);
    return null;
  }
};

export async function createLocalUpload(
  segment: Omit<UploadSegment, "id" | "content_path"> & {
    content?: Uint8Array | null;
    uri: string;
  }
): Promise<UploadSegment> {
  const db = await dbPromise;
  const id = uuidv4();

  // Save file content or copy from URI
  let contentPath = null;
  if (segment.content) {
    contentPath = await saveBinaryContent(
      segment.content,
      id,
      segment.file_name
    );
  } else if (segment.uri) {
    contentPath = await saveFileFromUri(segment.uri, id, segment.file_name);
  }

  const stmt = await db.prepareAsync(SQL.INSERT);
  try {
    const params: (string | number | null)[] = [
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
      contentPath,
      safeString(segment.uri),
    ];
    await stmt.executeAsync(params);
    return {
      id,
      ...segment,
      content_path: contentPath,
    };
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
    const params: (string | number | null)[] = [
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
      safeString(segment.content_path),
      safeString(segment.uri),
      safeString(segment.id) ?? "",
    ];
    const result = await stmt.executeAsync(params);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function deleteUpload(id: string): Promise<number> {
  // First get the upload to delete associated file
  const upload = await getUploadById(id);

  // Delete associated file if it exists
  if (upload && upload.content_path) {
    try {
      const fileInfo = await FileSystem.getInfoAsync(upload.content_path);
      if (fileInfo.exists) {
        await FileSystem.deleteAsync(upload.content_path);
      }
    } catch (error) {
      console.error("Error deleting file:", error);
    }
  }

  // Delete database entry
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.DELETE);
  try {
    const result = await stmt.executeAsync([id]);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}

// Function to read file content when needed
export async function getFileContent(
  contentPath: string
): Promise<Uint8Array | null> {
  try {
    const base64Content = await FileSystem.readAsStringAsync(contentPath, {
      encoding: FileSystem.EncodingType.Base64,
    });
    return base64ToUint8Array(base64Content);
  } catch (error) {
    console.error("Error reading file content:", error);
    return null;
  }
}

// Convert Base64 to Uint8Array
function base64ToUint8Array(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);

  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }

  return bytes;
}
