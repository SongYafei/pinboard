import Database from "@tauri-apps/plugin-sql";
import type { PinItem, ItemType, ItemSource } from "../types";

let _db: Database | null = null;

async function getDb(): Promise<Database> {
  if (_db) return _db;
  _db = await Database.load("sqlite:pinboard.db");
  await init(_db);
  return _db;
}

async function init(db: Database): Promise<void> {
  await db.execute(`
    CREATE TABLE IF NOT EXISTS items (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      content TEXT NOT NULL,
      file_path TEXT,
      thumbnail TEXT,
      width INTEGER,
      height INTEGER,
      tags TEXT NOT NULL DEFAULT '[]',
      is_pinned INTEGER NOT NULL DEFAULT 0,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      use_count INTEGER NOT NULL DEFAULT 0,
      source TEXT NOT NULL DEFAULT 'manual'
    );
  `);
  await db.execute(
    `CREATE INDEX IF NOT EXISTS idx_items_pinned ON items(is_pinned DESC, updated_at DESC);`,
  );
  await db.execute(`
    CREATE TABLE IF NOT EXISTS settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );
  `);

  // 迁移：给老库加 source 列
  try {
    const cols = await db.select<{ name: string }[]>(`PRAGMA table_info(items)`);
    if (!cols.some((c) => c.name === "source")) {
      await db.execute(
        `ALTER TABLE items ADD COLUMN source TEXT NOT NULL DEFAULT 'manual'`,
      );
    }
  } catch (e) {
    console.warn("schema migration failed:", e);
  }
}

interface DbRow {
  id: string;
  type: ItemType;
  content: string;
  file_path: string | null;
  thumbnail: string | null;
  width: number | null;
  height: number | null;
  tags: string;
  is_pinned: number;
  created_at: number;
  updated_at: number;
  use_count: number;
  source: ItemSource | null;
}

function rowToItem(row: DbRow): PinItem {
  return {
    id: row.id,
    type: row.type,
    source: (row.source ?? "manual") as ItemSource,
    content: row.content,
    filePath: row.file_path ?? undefined,
    thumbnail: row.thumbnail ?? undefined,
    width: row.width ?? undefined,
    height: row.height ?? undefined,
    tags: JSON.parse(row.tags || "[]"),
    isPinned: !!row.is_pinned,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
    useCount: row.use_count,
  };
}

export async function listItems(): Promise<PinItem[]> {
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    "SELECT * FROM items ORDER BY is_pinned DESC, updated_at DESC",
  );
  return rows.map(rowToItem);
}

export async function insertItem(item: PinItem): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO items (id, type, content, file_path, thumbnail, width, height, tags, is_pinned, created_at, updated_at, use_count, source)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)`,
    [
      item.id,
      item.type,
      item.content,
      item.filePath ?? null,
      item.thumbnail ?? null,
      item.width ?? null,
      item.height ?? null,
      JSON.stringify(item.tags),
      item.isPinned ? 1 : 0,
      item.createdAt,
      item.updatedAt,
      item.useCount,
      item.source,
    ],
  );
}

export async function updateItem(item: PinItem): Promise<void> {
  const db = await getDb();
  await db.execute(
    `UPDATE items SET content=$2, file_path=$3, thumbnail=$4, width=$5, height=$6,
       tags=$7, is_pinned=$8, updated_at=$9, use_count=$10, source=$11 WHERE id=$1`,
    [
      item.id,
      item.content,
      item.filePath ?? null,
      item.thumbnail ?? null,
      item.width ?? null,
      item.height ?? null,
      JSON.stringify(item.tags),
      item.isPinned ? 1 : 0,
      item.updatedAt,
      item.useCount,
      item.source,
    ],
  );
}

export async function deleteItem(id: string): Promise<void> {
  const db = await getDb();
  await db.execute("DELETE FROM items WHERE id=$1", [id]);
}

export async function findFileItem(path: string): Promise<PinItem | null> {
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    "SELECT * FROM items WHERE file_path=$1 LIMIT 1",
    [path],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function findTextItem(content: string): Promise<PinItem | null> {
  const db = await getDb();
  const rows = await db.select<DbRow[]>(
    "SELECT * FROM items WHERE type='text' AND content=$1 LIMIT 1",
    [content],
  );
  return rows[0] ? rowToItem(rows[0]) : null;
}

export async function getSetting(key: string): Promise<string | null> {
  const db = await getDb();
  const rows = await db.select<{ value: string }[]>(
    "SELECT value FROM settings WHERE key=$1",
    [key],
  );
  return rows[0]?.value ?? null;
}

export async function setSetting(key: string, value: string): Promise<void> {
  const db = await getDb();
  await db.execute(
    `INSERT INTO settings(key, value) VALUES($1, $2)
     ON CONFLICT(key) DO UPDATE SET value=excluded.value`,
    [key, value],
  );
}
