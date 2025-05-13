import * as SQLite from "expo-sqlite";
import "react-native-get-random-values";
import { v4 as uuidv4 } from "uuid";
import { Costs } from "../types";

interface CostRow {
  id: string;
  job_id: string;
  contractor_id: string | null;
  amount: number;
  material_cost: number | null;
  created_at: number;
}

// === DB init ===
const initializeDatabase = async () => {
  const db = await SQLite.openDatabaseAsync("costsDB");
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS costs (
      id TEXT PRIMARY KEY, 
      job_id TEXT NOT NULL,
      contractor_id TEXT,
      amount REAL NOT NULL DEFAULT 0,
      material_cost REAL,
      created_at INTEGER DEFAULT (strftime('%s', 'now'))
    );
  `);
  return db;
};
const dbPromise = initializeDatabase();

const COLUMNS = [
  "id",
  "job_id",
  "contractor_id",
  "amount",
  "material_cost",
  "created_at",
];

const SQL = {
  INSERT: `INSERT INTO costs (${COLUMNS.join(", ")}) VALUES (${COLUMNS.map(
    () => "?"
  ).join(", ")})`,
  SELECT_BY_ID: `SELECT * FROM costs WHERE id = ?`,
  SELECT_ALL: `SELECT * FROM costs`,
  UPDATE: `UPDATE costs SET ${COLUMNS.filter((c) => c !== "id")
    .map((c) => `${c} = ?`)
    .join(", ")} WHERE id = ?`,
  DELETE: `DELETE FROM costs WHERE id = ?`,
};

// === Helpers ===
const safeString = (v: any): string | null =>
  v == null || v === "" ? null : String(v);
const safeNumber = (v: any): number | null => {
  if (v == null || v === "") return null;
  const n = typeof v === "string" ? parseFloat(v) : Number(v);
  return isNaN(n) ? null : n;
};

// === CRUD ===

export async function createLocalCost(cost: Costs): Promise<Costs> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.INSERT);
  try {
    const id = uuidv4();
    const now = Math.floor(Date.now() / 1000);

    const params: (string | number | null)[] = [
      id,
      safeString(cost.job_id) ?? "", // NOT NULL
      safeString(cost.contractor_id), // nullable
      safeNumber(cost.amount) ?? 0, // default 0
      safeNumber(cost.material_cost), // nullable
      now,
    ];

    await stmt.executeAsync(params);
    await stmt.finalizeAsync();

    return {
      id,
      job_id: cost.job_id ?? "",
      contractor_id: cost.contractor_id ?? null,
      amount:
        typeof cost.amount === "number"
          ? cost.amount
          : safeNumber(cost.amount) ?? 0,
      material_cost: safeNumber(cost.material_cost),
    };
  } finally {
    // ensure finalization on error
    try {
      await stmt.finalizeAsync();
    } catch {}
  }
}

export async function getCostById(id: string): Promise<Costs | null> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.SELECT_BY_ID);
  try {
    const result = await stmt.executeAsync([id]);
    // === Cast the row to CostRow ===
    const row = (await result.getFirstAsync()) as CostRow | undefined;
    if (!row) return null;

    return {
      id: row.id,
      job_id: row.job_id,
      contractor_id: row.contractor_id,
      amount: row.amount,
      material_cost: row.material_cost,
    };
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function getAllCosts(): Promise<Costs[]> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.SELECT_ALL);
  try {
    const result = await stmt.executeAsync([]);
    // === Cast each row to CostRow ===
    const rows = (await result.getAllAsync()) as CostRow[];
    return rows.map((row) => ({
      id: row.id,
      job_id: row.job_id,
      contractor_id: row.contractor_id,
      amount: row.amount,
      material_cost: row.material_cost,
    }));
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function updateCost(cost: Costs): Promise<number> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.UPDATE);
  try {
    const now = Math.floor(Date.now() / 1000);
    const params: (string | number | null)[] = [
      safeString(cost.job_id) ?? "",
      safeString(cost.contractor_id),
      safeNumber(cost.amount) ?? 0,
      safeNumber(cost.material_cost),
      now,
      safeString(cost.id) ?? "", // <-- can’t be undefined
    ];
    const result = await stmt.executeAsync(params);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}

export async function deleteCost(id: string): Promise<number> {
  const db = await dbPromise;
  const stmt = await db.prepareAsync(SQL.DELETE);
  try {
    const result = await stmt.executeAsync([id]);
    return result.changes;
  } finally {
    await stmt.finalizeAsync();
  }
}
