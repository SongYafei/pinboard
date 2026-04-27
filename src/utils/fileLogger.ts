import { invoke } from "@tauri-apps/api/core";
import { appDataDir, join } from "@tauri-apps/api/path";

/**
 * DEV 用：把 console 输出镜像到磁盘文件，方便 agent 直接读。
 * 文件位置：%APPDATA%/com.pinboard.app/pinboard-dev.log
 */

let queue: string[] = [];
let flushing = false;
let logPath: string | null = null;
let pathReady: Promise<string> | null = null;

function ensurePath(): Promise<string> {
  if (pathReady) return pathReady;
  pathReady = (async () => {
    const dir = await appDataDir();
    const p = await join(dir, "pinboard-dev.log");
    logPath = p;
    // 启动分界标记
    await invoke("append_log", {
      path: p,
      chunk: `\n\n===== session start ${new Date().toISOString()} =====\n`,
    }).catch(() => {});
    return p;
  })();
  return pathReady;
}

async function flush() {
  if (flushing || queue.length === 0) return;
  flushing = true;
  try {
    const path = await ensurePath();
    const chunk = queue.splice(0, queue.length).join("");
    await invoke("append_log", { path, chunk }).catch(() => {});
  } finally {
    flushing = false;
    if (queue.length > 0) setTimeout(flush, 30);
  }
}

function stringify(a: unknown): string {
  if (typeof a === "string") return a;
  if (a instanceof Error) return `${a.name}: ${a.message}\n${a.stack}`;
  try {
    return JSON.stringify(a);
  } catch {
    return String(a);
  }
}

function push(level: string, args: unknown[]) {
  const ts = new Date().toISOString().split("T")[1].replace("Z", "");
  const msg = args.map(stringify).join(" ");
  queue.push(`[${ts}] [${level}] ${msg}\n`);
  flush();
}

export function installFileLogger(): void {
  const origLog = console.log.bind(console);
  const origWarn = console.warn.bind(console);
  const origError = console.error.bind(console);
  const origDebug = console.debug.bind(console);
  const origInfo = console.info.bind(console);

  console.log = (...args) => {
    origLog(...args);
    push("LOG", args);
  };
  console.info = (...args) => {
    origInfo(...args);
    push("INFO", args);
  };
  console.warn = (...args) => {
    origWarn(...args);
    push("WARN", args);
  };
  console.error = (...args) => {
    origError(...args);
    push("ERR", args);
  };
  console.debug = (...args) => {
    origDebug(...args);
    push("DEBUG", args);
  };

  window.addEventListener("error", (e) => {
    push("GLOBAL_ERR", [e.message, `${e.filename}:${e.lineno}:${e.colno}`, e.error]);
  });
  window.addEventListener("unhandledrejection", (e) => {
    push("UNHANDLED", [e.reason]);
  });
}

export function getLogPath(): string | null {
  return logPath;
}
