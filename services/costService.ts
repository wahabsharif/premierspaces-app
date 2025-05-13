// SQLite Service: costService.ts
import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { Costs } from "../types";

const initializeDatabase = async () => {
  const db = await SQLite.openDatabaseAsync("costsDB");

  await db.execAsync(`
  PRAGMA journal_mode = WAL;
  CREATE TABLE IF NOT EXISTS costs (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    job_id TEXT NOT NULL,
    contractor_id TEXT,
    amount REAL,
    material_cost REAL
  );
  CREATE UNIQUE INDEX IF NOT EXISTS idx_job_contractor ON costs (job_id, contractor_id) WHERE contractor_id IS NOT NULL;
`);

  return db;
};

const dbPromise = initializeDatabase();

const COLUMNS = ["job_id", "contractor_id", "amount", "material_cost"];

const SQL = {
  INSERT: `INSERT INTO costs (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(
    () => "?"
  ).join(", ")});`,
  SELECT_BY_ID: `SELECT * FROM costs WHERE id = ?;`,
  SELECT_ALL: `SELECT * FROM costs;`,
  UPDATE: `UPDATE costs SET ${COLUMNS.filter((col) => col !== "id")
    .map((col) => `${col} = ?`)
    .join(", ")} WHERE id = ?;`,
  DELETE: `DELETE FROM costs WHERE id = ?;`,
};

export async function createLocalCost(cost: Costs): Promise<void> {
  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.INSERT);
  try {
    const params: (string | number | null)[] = COLUMNS.map(
      (col) => (cost as any)[col] ?? null
    );
    await statement.executeAsync(params);
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getCostById(id: string): Promise<Costs | null> {
  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.SELECT_BY_ID);
  try {
    const result = await statement.executeAsync([id]);
    const row = await result.getFirstAsync();

    return row as Costs | null;
  } finally {
    await statement.finalizeAsync();
  }
}

export async function getAllCosts(): Promise<Costs[]> {
  const db = await dbPromise;

  try {
    const statement = await db.prepareAsync(SQL.SELECT_ALL);
    const result = await statement.executeAsync([]);

    const rows = await result.getAllAsync();

    return rows as Costs[];
  } catch (error) {
    console.error("[getAllCosts] Error:", error);
    throw error;
  }
}

export async function updateCost(cost: Costs): Promise<number> {
  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.UPDATE);
  try {
    const params = COLUMNS.filter((col) => col !== "id").map(
      (col) => (cost as any)[col]
    );
    params.push(cost.id);
    const result = await statement.executeAsync(params);

    return result.changes;
  } finally {
    await statement.finalizeAsync();
  }
}

export async function deleteCost(id: string): Promise<number> {
  const db = await dbPromise;
  const statement = await db.prepareAsync(SQL.DELETE);
  try {
    const result = await statement.executeAsync([id]);

    return result.changes;
  } finally {
    await statement.finalizeAsync();
  }
}
