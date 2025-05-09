import * as SQLite from "expo-sqlite";
import NetInfo from "@react-native-community/netinfo";

// Cache configuration
const CONFIG = {
  DATABASE_NAME: "appCache.db",
  DEFAULT_EXPIRY: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
  MAX_BATCH_SIZE: 50, // Maximum number of operations in a batch
  CLEANUP_INTERVAL: 30 * 60 * 1000, // 30 minutes in milliseconds
};

/**
 * Initialize the cache database with the required table structure
 */
async function initializeDatabase() {
  const db = await SQLite.openDatabaseAsync(CONFIG.DATABASE_NAME);

  // Use WAL journal mode for better performance with concurrent operations
  await db.execAsync(`PRAGMA journal_mode = WAL;`);

  // Create the cache_entries table if it doesn't exist with expiry column
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS cache_entries (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      table_key TEXT UNIQUE NOT NULL,
      payload TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      expires_at INTEGER NOT NULL
    );
    
    CREATE INDEX IF NOT EXISTS idx_cache_key ON cache_entries(table_key);
    CREATE INDEX IF NOT EXISTS idx_expires_at ON cache_entries(expires_at);
  `);

  return db;
}

// Singleton database connection promise
const dbPromise = initializeDatabase();

// Track transaction status to prevent nested transactions
let isInTransaction = false;

// Connection management - wait for DB to be ready
let dbReady = false;
dbPromise.then(() => {
  dbReady = true;
  console.log("[cacheService] Database initialized successfully");
  // Start cleanup timer
  startCleanupTimer();
});

// Prepared SQL statements for better performance and security
const SQL = {
  INSERT: `INSERT INTO cache_entries (table_key, payload, created_at, updated_at, expires_at) VALUES (?, ?, ?, ?, ?);`,
  SELECT_BY_KEY: `SELECT * FROM cache_entries WHERE table_key = ? AND (expires_at > ? OR expires_at = 0);`,
  SELECT_ALL: `SELECT * FROM cache_entries WHERE expires_at > ? OR expires_at = 0;`,
  UPDATE: `UPDATE cache_entries SET payload = ?, updated_at = ?, expires_at = ? WHERE table_key = ?;`,
  DELETE_BY_KEY: `DELETE FROM cache_entries WHERE table_key = ?;`,
  CLEAR: `DELETE FROM cache_entries;`,
  DELETE_EXPIRED: `DELETE FROM cache_entries WHERE expires_at > 0 AND expires_at < ?;`,
  SELECT_BY_PREFIX: `SELECT * FROM cache_entries WHERE table_key LIKE ? AND (expires_at > ? OR expires_at = 0);`,
};

export interface CacheEntry {
  id: number;
  table_key: string;
  payload: any;
  created_at: number;
  updated_at: number;
  expires_at: number;
}

export interface CacheOptions {
  /** Time in milliseconds until the cache entry expires (0 = never) */
  expiresIn?: number;
}

/**
 * Helper to check if the device is currently online
 */
export const isOnline = async (): Promise<boolean> => {
  const state = await NetInfo.fetch();
  return !!state.isConnected;
};

/**
 * Helper function to manage transactions safely
 * @param db - Database connection
 * @param callback - Function to execute within the transaction
 * @returns The result of the callback function
 */
async function withTransaction<T>(
  db: SQLite.SQLiteDatabase,
  callback: () => Promise<T>
): Promise<T> {
  // If already in a transaction, just execute the callback
  if (isInTransaction) {
    return await callback();
  }

  try {
    isInTransaction = true;
    await db.execAsync("BEGIN TRANSACTION;");
    const result = await callback();
    await db.execAsync("COMMIT;");
    return result;
  } catch (err) {
    await db.execAsync("ROLLBACK;");
    throw err;
  } finally {
    isInTransaction = false;
  }
}

/**
 * Store or update a cache entry by key.
 *
 * @param key - The unique key for the cache entry
 * @param value - The data to store
 * @param options - Cache options including expiry time
 * @returns The id of the inserted row or number of rows affected
 */
export async function setCache(
  key: string,
  value: any,
  options: CacheOptions = {}
): Promise<number> {
  const db = await dbPromise;
  const now = Date.now();
  const expiresIn = options.expiresIn ?? CONFIG.DEFAULT_EXPIRY;
  const expiresAt = expiresIn === 0 ? 0 : now + expiresIn;
  const json = JSON.stringify({ payload: value }); // Ensure consistent structure

  try {
    return await withTransaction(db, async () => {
      // Check if entry already exists
      const selectStmt = await db.prepareAsync(SQL.SELECT_BY_KEY);
      const result = await selectStmt.executeAsync([key, now]);
      const row = await result.getFirstAsync();
      await selectStmt.finalizeAsync();

      let changes = 0;

      if (row) {
        // Update existing entry
        const updateStmt = await db.prepareAsync(SQL.UPDATE);
        try {
          const res = await updateStmt.executeAsync([
            json,
            now,
            expiresAt,
            key,
          ]);
          changes = res.changes;
        } finally {
          await updateStmt.finalizeAsync();
        }
      } else {
        // Insert new entry
        const insertStmt = await db.prepareAsync(SQL.INSERT);
        try {
          const res = await insertStmt.executeAsync([
            key,
            json,
            now,
            now,
            expiresAt,
          ]);
          changes = res.lastInsertRowId;
        } finally {
          await insertStmt.finalizeAsync();
        }
      }

      return changes;
    });
  } catch (err) {
    console.error("[cacheService][setCache] ERROR:", err);
    throw err;
  }
}

/**
 * Store multiple cache entries at once in a single transaction.
 *
 * @param entries - Array of key-value pairs to store
 * @param options - Cache options including expiry time
 * @returns Number of affected rows
 */
export async function setBatchCache(
  entries: Array<{ key: string; value: any }>,
  options: CacheOptions = {}
): Promise<number> {
  if (!entries.length) return 0;

  const db = await dbPromise;
  const now = Date.now();
  const expiresIn = options.expiresIn ?? CONFIG.DEFAULT_EXPIRY;
  const expiresAt = expiresIn === 0 ? 0 : now + expiresIn;

  try {
    return await withTransaction(db, async () => {
      let totalChanges = 0;

      // Process entries in batches to avoid large transactions
      for (let i = 0; i < entries.length; i += CONFIG.MAX_BATCH_SIZE) {
        const batch = entries.slice(i, i + CONFIG.MAX_BATCH_SIZE);

        for (const { key, value } of batch) {
          const json = JSON.stringify({ payload: value });

          // Check if entry exists
          const selectStmt = await db.prepareAsync(SQL.SELECT_BY_KEY);
          const result = await selectStmt.executeAsync([key, now]);
          const row = await result.getFirstAsync();
          await selectStmt.finalizeAsync();

          if (row) {
            // Update
            const updateStmt = await db.prepareAsync(SQL.UPDATE);
            try {
              const res = await updateStmt.executeAsync([
                json,
                now,
                expiresAt,
                key,
              ]);
              totalChanges += res.changes;
            } finally {
              await updateStmt.finalizeAsync();
            }
          } else {
            // Insert
            const insertStmt = await db.prepareAsync(SQL.INSERT);
            try {
              const res = await insertStmt.executeAsync([
                key,
                json,
                now,
                now,
                expiresAt,
              ]);
              totalChanges += res.lastInsertRowId > 0 ? 1 : 0;
            } finally {
              await insertStmt.finalizeAsync();
            }
          }
        }
      }

      return totalChanges;
    });
  } catch (err) {
    console.error("[cacheService][setBatchCache] ERROR:", err);
    throw err;
  }
}

/**
 * Retrieve a cache entry by key.
 *
 * @param key - The unique key for the cache entry
 * @returns The cache entry object or null if not found
 */
export async function getCache(
  key: string
): Promise<Omit<CacheEntry, "id"> | null> {
  const db = await dbPromise;
  const now = Date.now();

  try {
    const stmt = await db.prepareAsync(SQL.SELECT_BY_KEY);
    const result = await stmt.executeAsync([key, now]);
    const row = (await result.getFirstAsync()) as
      | {
          table_key?: string;
          payload?: string;
          created_at?: number;
          updated_at?: number;
          expires_at?: number;
        }
      | undefined;
    await stmt.finalizeAsync();

    if (!row || !row.table_key) {
      return null;
    }

    return {
      table_key: row.table_key,
      payload: JSON.parse(row.payload ?? "null"),
      created_at: row.created_at ?? 0,
      updated_at: row.updated_at ?? 0,
      expires_at: row.expires_at ?? 0,
    };
  } catch (err) {
    console.error("[cacheService][getCache] ERROR:", err);
    throw err;
  }
}

/**
 * Get all non-expired cache entries.
 *
 * @returns Array of all valid cache entries
 */
export async function getAllCache(): Promise<CacheEntry[]> {
  const db = await dbPromise;
  const now = Date.now();

  try {
    const stmt = await db.prepareAsync(SQL.SELECT_ALL);
    const result = await stmt.executeAsync([now]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();

    return rows.map((row: any) => ({
      id: row.id,
      table_key: row.table_key,
      payload: JSON.parse(row.payload),
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at,
    }));
  } catch (err) {
    console.error("[cacheService][getAllCache] ERROR:", err);
    throw err;
  }
}

/**
 * Get all cache entries with keys that match a prefix.
 * Useful for retrieving all entries related to a specific feature or user.
 *
 * @param prefix - The prefix to match cache keys against
 * @returns Array of matching cache entries
 */
export async function getCacheByPrefix(prefix: string): Promise<CacheEntry[]> {
  const db = await dbPromise;
  const now = Date.now();

  try {
    const stmt = await db.prepareAsync(SQL.SELECT_BY_PREFIX);
    const result = await stmt.executeAsync([`${prefix}%`, now]);
    const rows = await result.getAllAsync();
    await stmt.finalizeAsync();

    return rows.map((row: any) => ({
      id: row.id,
      table_key: row.table_key,
      payload: JSON.parse(row.payload),
      created_at: row.created_at,
      updated_at: row.updated_at,
      expires_at: row.expires_at,
    }));
  } catch (err) {
    console.error("[cacheService][getCacheByPrefix] ERROR:", err);
    throw err;
  }
}

/**
 * Delete a cache entry by key.
 *
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
 * Delete multiple cache entries at once.
 *
 * @param keys - Array of keys to delete
 * @returns Number of rows affected
 */
export async function deleteBatchCache(keys: string[]): Promise<number> {
  if (!keys.length) return 0;

  const db = await dbPromise;

  try {
    return await withTransaction(db, async () => {
      let totalDeleted = 0;

      // Process in batches
      for (let i = 0; i < keys.length; i += CONFIG.MAX_BATCH_SIZE) {
        const batch = keys.slice(i, i + CONFIG.MAX_BATCH_SIZE);

        for (const key of batch) {
          const stmt = await db.prepareAsync(SQL.DELETE_BY_KEY);
          const res = await stmt.executeAsync([key]);
          await stmt.finalizeAsync();
          totalDeleted += res.changes;
        }
      }

      return totalDeleted;
    });
  } catch (err) {
    console.error("[cacheService][deleteBatchCache] ERROR:", err);
    throw err;
  }
}

/**
 * Delete cache entries by prefix.
 *
 * @param prefix - The prefix to match cache keys against
 * @returns Number of rows affected
 */
export async function deleteCacheByPrefix(prefix: string): Promise<number> {
  try {
    // First get all keys matching the prefix
    const entries = await getCacheByPrefix(prefix);
    const keys = entries.map((entry) => entry.table_key);

    // Then delete them all in a batch
    return await deleteBatchCache(keys);
  } catch (err) {
    console.error("[cacheService][deleteCacheByPrefix] ERROR:", err);
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

/**
 * Remove expired cache entries.
 * @returns Number of deleted entries
 */
export async function cleanExpiredCache(): Promise<number> {
  const db = await dbPromise;
  const now = Date.now();

  try {
    const stmt = await db.prepareAsync(SQL.DELETE_EXPIRED);
    const res = await stmt.executeAsync([now]);
    await stmt.finalizeAsync();

    const deletedCount = res.changes;
    if (deletedCount > 0) {
      console.log(
        `[cacheService] Cleaned up ${deletedCount} expired cache entries`
      );
    }
    return deletedCount;
  } catch (err) {
    console.error("[cacheService][cleanExpiredCache] ERROR:", err);
    throw err;
  }
}

// Set up automatic cleanup timer
let cleanupTimer: NodeJS.Timeout | null = null;

function startCleanupTimer() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
  }

  cleanupTimer = setInterval(async () => {
    if (dbReady) {
      try {
        await cleanExpiredCache();
      } catch (err) {
        console.error("[cacheService] Cleanup timer error:", err);
      }
    }
  }, CONFIG.CLEANUP_INTERVAL);
}

// Lifecycle management
export function shutdown() {
  if (cleanupTimer) {
    clearInterval(cleanupTimer);
    cleanupTimer = null;
  }

  // Close database connection when app is shutting down
  dbPromise
    .then((db) => {
      db.closeAsync();
      dbReady = false;
    })
    .catch((err) => {
      console.error("[cacheService] Error closing database:", err);
    });
}
