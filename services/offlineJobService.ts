import AsyncStorage from "@react-native-async-storage/async-storage";
import * as SQLite from "expo-sqlite";
import { v4 as uuidv4 } from "uuid";
import { Job } from "../types";
import { createJob as apiCreateJob } from "./createJobService";

// Constants
const PENDING_JOBS_KEY = "PENDING_OFFLINE_JOBS";

/**
 * Saves a job to be synced later when connection is restored
 */
export async function saveOfflineJob(
  userId: string,
  jobData: Job
): Promise<string> {
  try {
    // Generate a temporary offline ID
    const offlineId = `offline_${uuidv4()}`;

    // Add metadata for syncing
    const offlineJob = {
      ...jobData,
      id: offlineId,
      date_created: new Date().toISOString(),
      status: "pending", // Mark as pending
      _syncData: {
        userId,
        createdAt: Date.now(),
        synced: false,
      },
    };

    // Save to SQLite
    const { _syncData, ...jobWithoutSyncData } = offlineJob;
    await apiCreateJob(jobWithoutSyncData);

    // Also save to AsyncStorage for tracking sync status
    const existingJobs = await getPendingJobs();
    await AsyncStorage.setItem(
      PENDING_JOBS_KEY,
      JSON.stringify([...existingJobs, offlineId])
    );

    return offlineId;
  } catch (error) {
    console.error("Error saving offline job:", error);
    throw new Error("Failed to save job offline");
  }
}

/**
 * Gets all pending jobs that need to be synced
 */
export async function getPendingJobs(): Promise<string[]> {
  try {
    const pendingJobs = await AsyncStorage.getItem(PENDING_JOBS_KEY);
    return pendingJobs ? JSON.parse(pendingJobs) : [];
  } catch (error) {
    console.error("Error getting pending jobs:", error);
    return [];
  }
}

/**
 * Marks a job as synced
 */
export async function markJobAsSynced(jobId: string): Promise<void> {
  try {
    // Remove from pending jobs
    const pendingJobs = await getPendingJobs();
    const updatedPendingJobs = pendingJobs.filter((id) => id !== jobId);
    await AsyncStorage.setItem(
      PENDING_JOBS_KEY,
      JSON.stringify(updatedPendingJobs)
    );

    // Update SQLite record (optional - can also delete it)
    const db = await SQLite.openDatabaseAsync("premierDatabase");
    const statement = await db.prepareAsync(
      `UPDATE jobs SET status = 'synced' WHERE id = ?;`
    );
    try {
      await statement.executeAsync([jobId]);
    } finally {
      await statement.finalizeAsync();
    }
  } catch (error) {
    console.error("Error marking job as synced:", error);
  }
}

/**
 * Deletes a job from local storage after successful sync
 */
export async function deleteOfflineJob(jobId: string): Promise<void> {
  try {
    const db = await SQLite.openDatabaseAsync("premierDatabase");
    const statement = await db.prepareAsync(`DELETE FROM jobs WHERE id = ?;`);
    try {
      await statement.executeAsync([jobId]);
    } finally {
      await statement.finalizeAsync();
    }
  } catch (error) {
    console.error("Error deleting offline job:", error);
  }
}

/**
 * Gets a job from SQLite by ID
 */
export async function getOfflineJob(jobId: string): Promise<Job | null> {
  try {
    const db = await SQLite.openDatabaseAsync("premierDatabase");
    const statement = await db.prepareAsync(`SELECT * FROM jobs WHERE id = ?;`);
    try {
      const result = await statement.executeAsync([jobId]);
      const row = await result.getFirstAsync();
      return row as Job | null;
    } finally {
      await statement.finalizeAsync();
    }
  } catch (error) {
    console.error("Error getting offline job:", error);
    return null;
  }
}
