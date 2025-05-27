import NetInfo from "@react-native-community/netinfo";
import axios from "axios";
import * as SQLite from "expo-sqlite";
import { Toast } from "toastify-react-native";
import { BASE_API_URL, CACHE_CONFIG } from "../Constants/env";

// Cache configuration
const CONFIG = {
  DATABASE_NAME: "cacheDB",
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

// Connection management - wait for DB to be ready
let dbReady = false;
dbPromise.then(() => {
  dbReady = true;
  startCleanupTimer();
});

// Prepared SQL statements for better performance and security
const SQL = {
  UPSERT: `INSERT INTO cache_entries (table_key, payload, created_at, updated_at, expires_at) 
           VALUES (?, ?, ?, ?, ?)
           ON CONFLICT(table_key) DO UPDATE SET 
           payload = excluded.payload, 
           updated_at = excluded.updated_at, 
           expires_at = excluded.expires_at;`,
  SELECT_BY_KEY: `SELECT * FROM cache_entries WHERE table_key = ? AND (expires_at > ? OR expires_at = 0);`,
  SELECT_ALL: `SELECT * FROM cache_entries WHERE expires_at > ? OR expires_at = 0;`,
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
  try {
    await db.execAsync("BEGIN TRANSACTION;");
    const result = await callback();
    await db.execAsync("COMMIT;");
    return result;
  } catch (err) {
    await db.execAsync("ROLLBACK;");
    throw err;
  }
}

/**
 * Store or update a cache entry by key using upsert pattern.
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
    const stmt = await db.prepareAsync(SQL.UPSERT);
    try {
      const res = await stmt.executeAsync([key, json, now, now, expiresAt]);
      return res.changes || res.lastInsertRowId;
    } finally {
      await stmt.finalizeAsync();
    }
  } catch (err) {
    Toast.error(
      `[cacheService][setCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
          const stmt = await db.prepareAsync(SQL.UPSERT);
          try {
            const res = await stmt.executeAsync([
              key,
              json,
              now,
              now,
              expiresAt,
            ]);
            totalChanges += res.changes || (res.lastInsertRowId > 0 ? 1 : 0);
          } finally {
            await stmt.finalizeAsync();
          }
        }
      }

      return totalChanges;
    });
  } catch (err) {
    Toast.error(
      `[cacheService][setBatchCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    Toast.error(
      `[cacheService][getCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    Toast.error(
      `[cacheService][getAllCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    Toast.error(
      `[cacheService][getCacheByPrefix] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    Toast.error(
      `[cacheService][deleteCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
          try {
            const res = await stmt.executeAsync([key]);
            totalDeleted += res.changes;
          } finally {
            await stmt.finalizeAsync();
          }
        }
      }

      return totalDeleted;
    });
  } catch (err) {
    Toast.error(
      `[cacheService][deleteBatchCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    Toast.error(
      `[cacheService][deleteCacheByPrefix] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    Toast.error(
      `[cacheService][clearCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
    }
    return deletedCount;
  } catch (err) {
    Toast.error(
      `[cacheService][cleanExpiredCache] ERROR: ${
        err instanceof Error ? err.message : String(err)
      }`
    );
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
        Toast.error(
          `[cacheService] Cleanup timer error: ${
            err instanceof Error ? err.message : String(err)
          }`
        );
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
      Toast.error(
        `[cacheService] Error closing database: ${
          err instanceof Error ? err.message : String(err)
        }`
      );
    });
}

/**
 * Refreshes critical API data after POST operations and updates cache
 * @param userId - The user ID for API requests
 */
export async function refreshCachesAfterPost(userId: string): Promise<void> {
  if (!userId) {
    console.warn(
      "[refreshCachesAfterPost] No userId provided, skipping refresh"
    );
    return;
  }

  const isConnected = await isOnline();
  if (!isConnected) {
    return; // Don't attempt refresh if offline
  }

  try {
    // Define endpoints to refresh - all requests will be made in parallel
    const endpoints = [
      {
        url: `${BASE_API_URL}/getjobs.php?userid=${userId}`,
        cacheKey: `jobsCache_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/costs.php?userid=${userId}`,
        cacheKey: `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`,
        options: { timeout: 10000, expiresIn: 0 }, // Costs cache never expires
      },
      {
        url: `${BASE_API_URL}/get-files.php?userid=${userId}`,
        cacheKey: `filesCache_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/contractors.php?userid=${userId}`,
        cacheKey: `${CACHE_CONFIG.CACHE_KEYS.CONTRACTORS}_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/searchproperty.php?userid=${userId}`,
        cacheKey: `propertiesCache_${userId}`,
        options: { timeout: 10000 },
      },
    ];

    // Track success/failure of each endpoint
    const results = await Promise.allSettled(
      endpoints.map(async ({ url, cacheKey, options }) => {
        try {
          const response = await axios
            .get(url, {
              timeout: options.timeout,
              headers: {
                "Cache-Control": "no-cache",
                Pragma: "no-cache",
              },
            })
            .catch((error) => {
              console.warn(
                `[refreshCachesAfterPost] Failed to fetch from ${url}:`,
                error
              );
              return { data: null };
            });

          if (response.data?.status === 1 && response.data.payload) {
            await setCache(cacheKey, response.data.payload, {
              expiresIn: options.expiresIn,
            });
            return { url, success: true };
          }

          return {
            url,
            success: false,
            reason: "Invalid response structure",
          };
        } catch (err) {
          console.warn(
            `[refreshCachesAfterPost] Error refreshing cache for ${url}:`,
            err
          );
          return {
            url,
            success: false,
            reason: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    // Log summary of refresh operation
    const successful = results.filter(
      (r) => r.status === "fulfilled" && r.value.success
    ).length;

    const failed = results.filter(
      (r) =>
        r.status === "rejected" ||
        (r.status === "fulfilled" && !r.value.success)
    ).length;
  } catch (error) {
    Toast.error(
      `[refreshCachesAfterPost] Failed to refresh caches: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Refreshes ALL application caches after login
 * @param userId - The user ID for API requests
 */
export async function refreshAllCachesAfterLogin(
  userId: string
): Promise<void> {
  const isConnected = await isOnline();
  if (!isConnected) return; // Don't attempt refresh if offline

  try {
    // Define ALL endpoints to refresh after login
    const endpoints = [
      {
        url: `${BASE_API_URL}/getjobs.php?userid=${userId}`,
        cacheKey: `jobsCache_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/costs.php?userid=${userId}`,
        cacheKey: `${CACHE_CONFIG.CACHE_KEYS.COST}_${userId}`,
        options: { timeout: 10000, expiresIn: 0 },
      },
      {
        url: `${BASE_API_URL}/get-files.php?userid=${userId}`,
        cacheKey: `filesCache_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/contractors.php?userid=${userId}`,
        cacheKey: `${CACHE_CONFIG.CACHE_KEYS.CONTRACTORS}_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/jobtypes.php?userid=${userId}`,
        cacheKey: `${CACHE_CONFIG.CACHE_KEYS.JOB_TYPES}_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/fileuploadcats.php?userid=${userId}`,
        cacheKey: `categoryCache_${userId}`,
        options: { timeout: 10000 },
      },
      {
        url: `${BASE_API_URL}/searchproperty.php?userid=${userId}`,
        cacheKey: `propertiesCache_${userId}`,
        options: { timeout: 10000 },
      },
    ];

    // Use Promise.allSettled to handle all requests in parallel and continue even if some fail
    const results = await Promise.allSettled(
      endpoints.map(async ({ url, cacheKey, options }) => {
        try {
          const response = await axios.get(url, {
            timeout: options.timeout,
            headers: {
              "Cache-Control": "no-cache",
              Pragma: "no-cache",
            },
          });

          if (response.data?.status === 1 && response.data.payload) {
            await setCache(cacheKey, response.data.payload, {
              expiresIn: options.expiresIn,
            });
            return { url, success: true };
          }
          return { url, success: false, reason: "Invalid response structure" };
        } catch (err) {
          return {
            url,
            success: false,
            reason: err instanceof Error ? err.message : String(err),
          };
        }
      })
    );

    const failedEndpoints = results
      .filter(
        (result) =>
          result.status === "rejected" ||
          (result.status === "fulfilled" && !result.value.success)
      )
      .map((result) =>
        result.status === "rejected"
          ? { url: "unknown", reason: result.reason }
          : result.value
      );

    if (failedEndpoints.length > 0) {
      console.warn(
        `Failed to refresh ${failedEndpoints.length} endpoints after login:`,
        failedEndpoints
      );
    }
  } catch (error) {
    Toast.error(
      `[refreshAllCachesAfterLogin] Failed to refresh caches: ${
        error instanceof Error ? error.message : String(error)
      }`
    );
  }
}

/**
 * Safely attempts to fetch data from an API endpoint with fallback to cache
 * @param url - API endpoint URL to fetch
 * @param cacheKey - Key to retrieve cached data if API fails
 * @param options - Request options
 * @returns The data from API or cache
 */
export async function fetchWithCacheFallback<T>(
  url: string,
  cacheKey: string,
  options: { timeout?: number } = {}
): Promise<{ data: T | null; fromCache: boolean }> {
  try {
    // Check network first
    const isConnected = await isOnline();
    if (!isConnected) {
      // Get from cache if offline
      const cached = await getCache(cacheKey);
      return {
        data: cached?.payload?.payload || null,
        fromCache: true,
      };
    }

    // Try API request
    const response = await axios.get(url, {
      timeout: options.timeout || 10000,
    });

    // If successful, update cache and return data
    if (response.data && response.data.status === 1) {
      await setCache(cacheKey, response.data.payload);
      return { data: response.data.payload, fromCache: false };
    }

    throw new Error("Invalid API response");
  } catch (error) {
    console.warn(`[fetchWithCacheFallback] API error for ${url}:`, error);

    // Fall back to cache
    try {
      const cached = await getCache(cacheKey);
      if (cached?.payload) {
        return {
          data: cached.payload.payload || null,
          fromCache: true,
        };
      }
    } catch (cacheError) {
      console.error("[fetchWithCacheFallback] Cache access error:", cacheError);
    }

    return { data: null, fromCache: true };
  }
}
