import { create } from "zustand";
import { nanoid } from "nanoid";
import type { PinItem, ItemType, ItemSource, FilterKey } from "../types";
import * as db from "../services/db";

/** 正在处理的 addItem 任务，按 lockKey 去重，保证并发幂等 */
const _addPending = new Map<string, Promise<PinItem>>();

interface AddDraft {
  type: ItemType;
  content: string;
  filePath?: string;
  thumbnail?: string;
  width?: number;
  height?: number;
  source?: ItemSource;
}

interface ItemStore {
  items: PinItem[];
  loaded: boolean;
  search: string;
  filter: FilterKey;
  activeTag: string | null;

  load: () => Promise<void>;
  addItem: (draft: AddDraft) => Promise<PinItem>;
  removeItem: (id: string) => Promise<void>;
  updateItem: (id: string, patch: Partial<PinItem>) => Promise<void>;
  togglePin: (id: string) => Promise<void>;
  incUseCount: (id: string) => Promise<void>;
  setMissing: (id: string, missing: boolean) => void;
  /** 修剪自动下载项：未Pin + 按时间最旧开始删，直到数量 <= max */
  trimDownloads: (max: number) => Promise<void>;

  setSearch: (v: string) => void;
  setFilter: (f: FilterKey) => void;
  setActiveTag: (t: string | null) => void;
}

export const useItemStore = create<ItemStore>((set, get) => ({
  items: [],
  loaded: false,
  search: "",
  filter: "all",
  activeTag: null,

  async load() {
    const items = await db.listItems();
    set({ items, loaded: true });
  },

  async addItem(draft) {
    // 并发锁 key：按类型+唯一标识
    const lockKey =
      draft.type === "file" || draft.type === "image"
        ? `${draft.type}:${draft.filePath ?? ""}`
        : `text:${draft.content}`;

    // 若同一 key 正在处理中，等它完成并返回同一结果（幂等）
    const pending = _addPending.get(lockKey);
    if (pending) return pending;

    const task = (async (): Promise<PinItem> => {
      // 先用内存 state 做同步判重（避免 DB 异步间隙）
      const mem = get().items.find((i) => {
        if (i.type !== draft.type) return false;
        if (draft.type === "text") return i.content === draft.content;
        return !!draft.filePath && i.filePath === draft.filePath;
      });
      if (mem) {
        await get().incUseCount(mem.id);
        return mem;
      }

      // 再查一次 DB（防御：万一内存还没回填）
      if ((draft.type === "file" || draft.type === "image") && draft.filePath) {
        const exist = await db.findFileItem(draft.filePath);
        if (exist) {
          await get().incUseCount(exist.id);
          return exist;
        }
      }
      if (draft.type === "text") {
        const exist = await db.findTextItem(draft.content);
        if (exist) {
          await get().incUseCount(exist.id);
          return exist;
        }
      }

      const now = Date.now();
      const item: PinItem = {
        id: nanoid(),
        type: draft.type,
        source: draft.source ?? "manual",
        content: draft.content,
        filePath: draft.filePath,
        thumbnail: draft.thumbnail,
        width: draft.width,
        height: draft.height,
        tags: [],
        isPinned: false,
        createdAt: now,
        updatedAt: now,
        useCount: 0,
      };
      await db.insertItem(item);
      set((s) => ({ items: [item, ...s.items] }));
      return item;
    })();

    _addPending.set(lockKey, task);
    try {
      return await task;
    } finally {
      _addPending.delete(lockKey);
    }
  },

  async removeItem(id) {
    await db.deleteItem(id);
    set((s) => ({ items: s.items.filter((i) => i.id !== id) }));
  },

  async updateItem(id, patch) {
    const current = get().items.find((i) => i.id === id);
    if (!current) return;
    const next: PinItem = { ...current, ...patch, updatedAt: Date.now() };
    await db.updateItem(next);
    set((s) => ({ items: s.items.map((i) => (i.id === id ? next : i)) }));
  },

  async togglePin(id) {
    const it = get().items.find((i) => i.id === id);
    if (!it) return;
    await get().updateItem(id, { isPinned: !it.isPinned });
  },

  async incUseCount(id) {
    const it = get().items.find((i) => i.id === id);
    if (!it) return;
    await get().updateItem(id, {
      useCount: it.useCount + 1,
      updatedAt: Date.now(),
    });
  },

  setMissing(id, missing) {
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, isMissing: missing } : i,
      ),
    }));
  },

  async trimDownloads(max) {
    const downloads = get()
      .items.filter((i) => i.source === "download" && !i.isPinned)
      .sort((a, b) => a.createdAt - b.createdAt); // 旧在前
    const excess = downloads.length - max;
    if (excess <= 0) return;
    const toDelete = downloads.slice(0, excess);
    for (const it of toDelete) {
      await db.deleteItem(it.id);
    }
    const ids = new Set(toDelete.map((i) => i.id));
    set((s) => ({ items: s.items.filter((i) => !ids.has(i.id)) }));
  },

  setSearch: (v) => set({ search: v }),
  setFilter: (f) => set({ filter: f }),
  setActiveTag: (t) => set({ activeTag: t }),
}));

/** 派生选择器：过滤后的列表 */
export function useFilteredItems(): PinItem[] {
  const { items, search, filter, activeTag } = useItemStore();
  const kw = search.trim().toLowerCase();
  return items.filter((it) => {
    if (filter === "download") {
      if (it.source !== "download") return false;
    } else if (filter !== "all") {
      if (it.type !== filter) return false;
    }
    if (activeTag && !it.tags.includes(activeTag)) return false;
    if (kw) {
      const hay = `${it.content} ${it.filePath ?? ""} ${it.tags.join(
        " ",
      )}`.toLowerCase();
      if (!hay.includes(kw)) return false;
    }
    return true;
  });
}

/** 所有出现过的 tag 列表 */
export function useAllTags(): string[] {
  const items = useItemStore((s) => s.items);
  const set = new Set<string>();
  items.forEach((i) => i.tags.forEach((t) => set.add(t)));
  return Array.from(set).sort();
}

/** 下载项数量（用于 Tab 徽标） */
export function useDownloadCount(): number {
  return useItemStore((s) => s.items.filter((i) => i.source === "download").length);
}
