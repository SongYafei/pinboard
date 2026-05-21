import { create } from "zustand";
import { DEFAULT_SETTINGS, type AppSettings } from "../types";
import * as db from "../services/db";

const KEY = "app_settings";

interface SettingsStore extends AppSettings {
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<AppSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsStore>((set, get) => ({
  ...DEFAULT_SETTINGS,
  loaded: false,

  async load() {
    try {
      const raw = await db.getSetting(KEY);
      if (raw) {
        const saved = JSON.parse(raw) as Partial<AppSettings>;
        // 迁移：旧默认快捷键 → 新默认快捷键
        const OLD_DEFAULT = "CmdOrCtrl+Shift+V";
        const needMigrate = saved.hotkey === OLD_DEFAULT;
        if (needMigrate) {
          saved.hotkey = DEFAULT_SETTINGS.hotkey;
        }
        set({ ...DEFAULT_SETTINGS, ...saved, loaded: true });
        // 如果 hotkey 被迁移了，把新值写回持久化
        if (needMigrate) {
          const { loaded: _l, load: _ld, update: _u, ...rest } = get();
          void _l; void _ld; void _u;
          await db.setSetting(KEY, JSON.stringify(rest));
          console.log("[settings] migrated hotkey ->", DEFAULT_SETTINGS.hotkey);
        }
        return;
      }
    } catch (e) {
      console.warn("load settings failed:", e);
    }
    set({ loaded: true });
  },

  async update(patch) {
    const next = { ...get(), ...patch };
    set(patch);
    const { loaded: _l, load: _ld, update: _u, ...rest } = next;
    void _l; void _ld; void _u;
    await db.setSetting(KEY, JSON.stringify(rest));
  },
}));
