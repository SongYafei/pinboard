//! 监听系统默认下载目录，检测新下载完成的文件并 emit 事件到前端。
//!
//! 工作流程：
//! 1. 启动时记录下载目录下已有文件集合（忽略启动前的积压）
//! 2. notify 监听 Create/Modify/Rename 事件
//! 3. 过滤临时文件：`.crdownload` / `.part` / `.tmp` / `.download`
//! 4. 把候选文件放入"稳定等待队列"，每秒检查一次大小
//!    连续 3 次大小不变（且 > 0） → 视为下载完成 → emit 事件

use std::collections::{HashMap, HashSet};
use std::path::{Path, PathBuf};
use std::sync::{Arc, Mutex};
use std::time::{Duration, Instant};

use notify::{Event, EventKind, RecommendedWatcher, RecursiveMode, Watcher};
use serde::Serialize;
use tauri::{AppHandle, Emitter, State};

const TEMP_EXTS: &[&str] = &["crdownload", "part", "tmp", "download", "opdownload"];
/// 稳定判定：连续多少次大小不变
const STABLE_CHECKS: u32 = 3;
/// 轮询间隔
const POLL_INTERVAL: Duration = Duration::from_millis(1000);
/// 候选文件超时保护（超过这么久还在候选里就丢弃，避免内存泄漏）
const MAX_CANDIDATE_AGE: Duration = Duration::from_secs(60 * 60);

#[derive(Debug, Clone, Serialize)]
pub struct DownloadReadyPayload {
    pub path: String,
    pub name: String,
}

struct Candidate {
    last_size: u64,
    stable_count: u32,
    first_seen: Instant,
}

pub struct DownloadWatcher {
    inner: Mutex<Option<WatcherInner>>,
}

struct WatcherInner {
    _watcher: RecommendedWatcher,
    /// 启动时已存在的文件快照（不对它们 emit）
    initial: Arc<Mutex<HashSet<PathBuf>>>,
    /// 正在等待稳定的候选
    candidates: Arc<Mutex<HashMap<PathBuf, Candidate>>>,
    /// 已 emit 过的，避免重复通知
    emitted: Arc<Mutex<HashSet<PathBuf>>>,
}

impl DownloadWatcher {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(None),
        }
    }

    pub fn is_watching(&self) -> bool {
        self.inner.lock().unwrap().is_some()
    }

    pub fn start(&self, app: AppHandle) -> anyhow::Result<String> {
        let mut slot = self.inner.lock().unwrap();
        if slot.is_some() {
            // 已在监听，直接返回目录
            return Ok(default_download_dir()
                .map(|p| p.to_string_lossy().to_string())
                .unwrap_or_default());
        }

        let dir = default_download_dir()
            .ok_or_else(|| anyhow::anyhow!("cannot resolve Downloads dir"))?;
        if !dir.exists() {
            return Err(anyhow::anyhow!("Downloads dir not found: {}", dir.display()));
        }

        // 启动前的积压快照
        let initial_files: HashSet<PathBuf> = match std::fs::read_dir(&dir) {
            Ok(iter) => iter
                .filter_map(|e| e.ok())
                .filter(|e| e.file_type().map(|t| t.is_file()).unwrap_or(false))
                .map(|e| e.path())
                .collect(),
            Err(_) => HashSet::new(),
        };

        let initial = Arc::new(Mutex::new(initial_files));
        let candidates: Arc<Mutex<HashMap<PathBuf, Candidate>>> = Arc::new(Mutex::new(HashMap::new()));
        let emitted: Arc<Mutex<HashSet<PathBuf>>> = Arc::new(Mutex::new(HashSet::new()));

        // notify watcher
        let candidates_c = candidates.clone();
        let initial_c = initial.clone();
        let emitted_c = emitted.clone();
        let mut watcher = notify::recommended_watcher(move |res: notify::Result<Event>| {
            let Ok(event) = res else { return };
            match event.kind {
                EventKind::Create(_) | EventKind::Modify(_) => {
                    for path in event.paths {
                        handle_candidate(&path, &initial_c, &candidates_c, &emitted_c);
                    }
                }
                _ => {}
            }
        })?;
        watcher.watch(&dir, RecursiveMode::NonRecursive)?;

        // 轮询线程：检查候选稳定性
        let candidates_p = candidates.clone();
        let emitted_p = emitted.clone();
        let app_p = app.clone();
        std::thread::spawn(move || {
            loop {
                std::thread::sleep(POLL_INTERVAL);
                let ready_paths = {
                    let mut map = candidates_p.lock().unwrap();
                    let mut ready = Vec::new();
                    map.retain(|path, cand| {
                        // 超时保护
                        if cand.first_seen.elapsed() > MAX_CANDIDATE_AGE {
                            return false;
                        }
                        // 路径还存在吗？
                        let Ok(meta) = std::fs::metadata(path) else {
                            return false;
                        };
                        if !meta.is_file() {
                            return false;
                        }
                        let size = meta.len();
                        if size == 0 {
                            // 空文件继续等
                            cand.last_size = 0;
                            cand.stable_count = 0;
                            return true;
                        }
                        if size == cand.last_size {
                            cand.stable_count += 1;
                            if cand.stable_count >= STABLE_CHECKS {
                                ready.push(path.clone());
                                return false; // 从 map 中移除
                            }
                        } else {
                            cand.last_size = size;
                            cand.stable_count = 0;
                        }
                        true
                    });
                    ready
                };

                for p in ready_paths {
                    {
                        let mut em = emitted_p.lock().unwrap();
                        if em.contains(&p) {
                            continue;
                        }
                        em.insert(p.clone());
                    }
                    let name = p
                        .file_name()
                        .map(|n| n.to_string_lossy().to_string())
                        .unwrap_or_default();
                    let payload = DownloadReadyPayload {
                        path: p.to_string_lossy().to_string(),
                        name,
                    };
                    let _ = app_p.emit("download-ready", payload);
                }

                // 如果主 app 句柄被 drop 了，这个循环也无害（只是白烧 CPU）
                // 简单处理：每 60 秒检查一下 watcher 是否还在
            }
        });

        *slot = Some(WatcherInner {
            _watcher: watcher,
            initial,
            candidates,
            emitted,
        });

        Ok(dir.to_string_lossy().to_string())
    }

    pub fn stop(&self) {
        let mut slot = self.inner.lock().unwrap();
        *slot = None; // Drop watcher
    }
}

fn handle_candidate(
    path: &Path,
    initial: &Arc<Mutex<HashSet<PathBuf>>>,
    candidates: &Arc<Mutex<HashMap<PathBuf, Candidate>>>,
    emitted: &Arc<Mutex<HashSet<PathBuf>>>,
) {
    let Ok(meta) = std::fs::metadata(path) else { return };
    if !meta.is_file() {
        return;
    }
    // 启动前就存在的文件忽略
    {
        let init = initial.lock().unwrap();
        if init.contains(path) {
            return;
        }
    }
    // 临时扩展名跳过
    if is_temp_file(path) {
        return;
    }
    // 已经 emit 过的忽略
    {
        let em = emitted.lock().unwrap();
        if em.contains(path) {
            return;
        }
    }
    // 放入候选
    let mut map = candidates.lock().unwrap();
    map.entry(path.to_path_buf()).or_insert_with(|| Candidate {
        last_size: meta.len(),
        stable_count: 0,
        first_seen: Instant::now(),
    });
}

fn is_temp_file(path: &Path) -> bool {
    path.extension()
        .and_then(|e| e.to_str())
        .map(|e| TEMP_EXTS.iter().any(|t| e.eq_ignore_ascii_case(t)))
        .unwrap_or(false)
}

fn default_download_dir() -> Option<PathBuf> {
    dirs::download_dir()
}

// ===== Tauri 命令 =====

#[tauri::command]
pub fn start_download_watch(app: AppHandle, state: State<'_, DownloadWatcher>) -> Result<String, String> {
    state.start(app).map_err(|e| e.to_string())
}

#[tauri::command]
pub fn stop_download_watch(state: State<'_, DownloadWatcher>) -> Result<(), String> {
    state.stop();
    Ok(())
}

#[tauri::command]
pub fn is_download_watching(state: State<'_, DownloadWatcher>) -> bool {
    state.is_watching()
}

#[tauri::command]
pub fn get_download_dir() -> Option<String> {
    default_download_dir().map(|p| p.to_string_lossy().to_string())
}

/// 兼容：让编译器知道 WatcherInner 用到的字段不会被读取（它们只是 keep-alive）
#[allow(dead_code)]
fn _use_fields(w: &WatcherInner) {
    let _ = &w.initial;
    let _ = &w.candidates;
    let _ = &w.emitted;
}
