import * as SQLite from "expo-sqlite";

/**
 * Initialize the cache database with the required table structure
 */
async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync("appCache.db");

  // Use WAL journal mode for better performance with concurrent operations
  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  // Create the cache_entries table if it doesn't exist
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_key TEXT UNIQUE NOT NULL,
      payload TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);

  return db;
}

// Singleton database connection promise
const dbPromise = initializeDatabase();

// Prepared SQL statements for better performance and security
const SQL = {
  INSERT: `INSERT INTO cache_entries (table_key, payload, created_at, updated_at) VALUES (?, ?, ?, ?);`,
  SELECT_BY_KEY: `SELECT * FROM cache_entries WHERE table_key = ?;`,
  SELECT_ALL: `SELECT * FROM cache_entries;`,
  UPDATE: `UPDATE cache_entries SET payload = ?, updated_at = ? WHERE table_key = ?;`,
  DELETE_BY_KEY: `DELETE FROM cache_entries WHERE table_key = ?;`,
  CLEAR: `DELETE FROM cache_entries;`,
};

export interface CacheEntry {
  id: number;
  table_key: string;
  payload: any;
  created_at: string;
  updated_at: string;
}

/**
 * Store or update a cache entry by key.
 * @param key - The unique key for the cache entry
 * @param value - The data to store (will be JSON stringified)
 * @returns The id of the inserted row or number of rows affected
 */
export async function setCache(key: string, value: any): Promise<number> {
  const db = await dbPromise;
  const now = new Date().toISOString();
  const json = JSON.stringify({ payload: value }); // Ensure consistent structure

  try {
    // Check if entry already exists
    const selectStmt = await db.prepareAsync(SQL.SELECT_BY_KEY);
    const result = await selectStmt.executeAsync([key]);
    const row = await result.getFirstAsync();
    await selectStmt.finalizeAsync();

    if (row) {
      // Update existing entry
      const updateStmt = await db.prepareAsync(SQL.UPDATE);
      try {
        const res = await updateStmt.executeAsync([json, now, key]);
        return res.changes;
      } finally {
        await updateStmt.finalizeAsync();
      }
    } else {
      // Insert new entry
      const insertStmt = await db.prepareAsync(SQL.INSERT);
      try {
        const res = await insertStmt.executeAsync([key, json, now, now]);
        return res.lastInsertRowId;
      } finally {
        await insertStmt.finalizeAsync();
      }
    }
  } catch (err) {
    console.error("[cacheService][setCache] ERROR:", err);
    throw err;
  }
}

/**
 * Retrieve a cache entry by key.
 * @param key - The unique key for the cache entry
 * @returns The cache entry object or null if not found
 */
export async function getCache(
  key: string
): Promise<Omit<CacheEntry, "id"> | null> {
  const db = await dbPromise;

  try {
    const stmt = await db.prepareAsync(SQL.SELECT_BY_KEY);
    const result = await stmt.executeAsync([key]);
    const row = (await result.getFirstAsync()) as
      | {
          table_key?: string;
          payload?: string;
          created_at?: string;
          updated_at?: string;
        }
      | undefined;
    await stmt.finalizeAsync();

    if (!row || !row.table_key) {
      console.warn("[cacheService][getCache] No entry found for key:", key);
      return null;
    }

    return {
      table_key: row.table_key,
      payload: JSON.parse(row.payload ?? "null"),
      created_at: row.created_at ?? "",
      updated_at: row.updated_at ?? "",
    };
  } catch (err) {
    console.error("[cacheService][getCache] ERROR:", err);
    throw err;
  }
}

/**
 * Get all cache entries.
 * @returns Array of all cache entries
 */
export async function getAllCache(): Promise<CacheEntry[]> {
  const db = await dbPromise;

  try {
    const stmt = await db.prepareAsync(SQL.SELECT_ALL);
    const result = await stmt.executeAsync([]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();

    return rows.map((row: any) => ({
      id: row.id,
      table_key: row.table_key,
      payload: JSON.parse(row.payload),
      created_at: row.created_at,
      updated_at: row.updated_at,
    }));
  } catch (err) {
    console.error("[cacheService][getAllCache] ERROR:", err);
    throw err;
  }
}

/**
 * Delete a cache entry by key.
 * @param key - The unique key for the cache entry to delete
 * @returns Number of rows affected
 */
export async function deleteCache(key: string): Promise<number> {
  const db = await dbPromise;

  try {
    const stmt = await db.prepareAsync(SQL.DELETE_BY_KEY);
    const res = await stmt.executeAsync([key]);
    await stmt.finalizeAsync();
    return res.changes;
  } catch (err) {
    console.error("[cacheService][deleteCache] ERROR:", err);
    throw err;
  }
}

/**
 * Clear all cache entries.
 */
export async function clearCache(): Promise<void> {
  const db = await dbPromise;

  try {
    await db.execAsync(SQL.CLEAR);
  } catch (err) {
    console.error("[cacheService][clearCache] ERROR:", err);
    throw err;
  }
}
