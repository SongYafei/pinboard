import { useCallback, useEffect, useRef } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { useSettingsStore } from "../store/useSettingsStore";

type Edge = "left" | "right" | "top";

interface WorkArea {
  x: number;
  y: number;
  width: number;
  height: number;
  scale: number;
}

interface CursorPos {
  x: number;
  y: number;
}

/** 吸附后在屏内露出的逻辑像素宽度（配合 EdgeHandle.css 里的 22px） */
const PEEK = 22;
/** 滑出/吸附动画时长 */
const ANIM_MS = 220;
/** 轮询时的边缘触发带宽度（物理像素），peek 22 + 两侧 ~9 的缓冲 */
const PEEK_BAND = 40;
/** 额外容差，超出 peek 带一点点也算"靠近" */
const TRIGGER_PAD_PX = 12;
/** 轮询间隔（ms） */
const POLL_MS = 100;
/** 自动吸附触发距离阈值（物理像素）：窗口距最近边缘 ≤ 此值才允许失焦自动吸附；
 *  距离更远视为"用户主动放在屏中央"，不打扰。手动按钮触发不受此限制。 */
const AUTO_SNAP_DIST_THRESHOLD = 100;

interface Options {
  /** 是否暂停自动吸附（设置面板打开 / 拖入中 / 有 toast 等） */
  pausedRef: React.MutableRefObject<boolean>;
  /** paused 的 state 镜像，仅用于触发 useEffect */
  paused: boolean;
}

export interface AutoHideHandle {
  /** 主动收起到最近边缘（不受距离阈值限制，不受 enabled 开关限制） */
  snapNow: () => Promise<void>;
}

export function useAutoHide({ pausedRef, paused }: Options): AutoHideHandle {
  const enabled = useSettingsStore((s) => s.autoHideEnabled);
  const delaySec = useSettingsStore((s) => s.autoHideDelay);
  const settingsLoaded = useSettingsStore((s) => s.loaded);

  console.log(
    "[autoHide] render enabled=%s delay=%s loaded=%s paused=%s",
    enabled,
    delaySec,
    settingsLoaded,
    paused,
  );

  /** 当前状态：idle（展开）/ hidden（吸附） */
  const stateRef = useRef<"idle" | "hidden">("idle");
  /** 是否正在执行动画 */
  const animatingRef = useRef(false);
  /** scheduleHide 定时器 id */
  const timerRef = useRef<number | null>(null);
  /** 吸附态下的轮询 id */
  const pollRef = useRef<number | null>(null);
  /** 吸附到哪个边 */
  const edgeRef = useRef<Edge>("right");
  /** 吸附前窗口位置，用于 show() 还原 */
  const savedPosRef = useRef<{ x: number; y: number } | null>(null);
  /** 鼠标是否在文档内（DOM 范围） */
  const mouseInsideRef = useRef(false);
  /** 是否已经做过首次 effect 初始化（HMR 重置保护） */
  const initedRef = useRef(false);

  // 用 ref 锁定 win，避免每次 render getCurrentWindow() 返回新实例
  // 导致依赖它的 useEffect / useCallback 不必要地重跑
  const winRef = useRef(getCurrentWindow());
  const win = winRef.current;

  // ===== 窗口位置 / 工作区 helper =====
  const getPosSize = useCallback(async () => {
    // 用 Win32 API 读真实位置，因为 Tauri 的 outerPosition 在 move_window_raw 后不同步
    const rect = await invoke<{ x: number; y: number; w: number; h: number }>(
      "get_window_rect_raw",
    );
    const scale = await win.scaleFactor();
    return {
      x: rect.x,
      y: rect.y,
      w: rect.w,
      h: rect.h,
      scale,
    };
  }, [win]);

  const getWorkArea = useCallback(async (): Promise<WorkArea> => {
    return await invoke<WorkArea>("get_monitor_work_area");
  }, []);

  // ===== 判断该吸附到哪个边 =====
  const calcEdge = useCallback(
    (x: number, y: number, w: number, _h: number, wa: WorkArea): Edge => {
      const distLeft = x - wa.x;
      const distRight = wa.x + wa.width - (x + w);
      const distTop = y - wa.y;
      const m = Math.min(distLeft, distRight, distTop);
      if (m === distTop) return "top";
      if (m === distLeft) return "left";
      return "right";
    },
    [],
  );

  // ===== 动画 =====
  const animateTo = useCallback(
    async (targetX: number, targetY: number) => {
      if (animatingRef.current) return;
      animatingRef.current = true;
      try {
        // 起点用真实位置（不用 Tauri 的 outerPosition）
        const startRect = await invoke<{ x: number; y: number }>(
          "get_window_rect_raw",
        );
        const sx = startRect.x;
        const sy = startRect.y;
        const start = performance.now();
        const frame = () =>
          new Promise<void>((res) => {
            const loop = (t: number) => {
              const p = Math.min(1, (t - start) / ANIM_MS);
              // easeOutCubic
              const e = 1 - Math.pow(1 - p, 3);
              const cx = Math.round(sx + (targetX - sx) * e);
              const cy = Math.round(sy + (targetY - sy) * e);
              // 用 Win32 MoveWindow 绕过 Tauri setPosition 对屏外坐标的限制
              invoke("move_window_raw", { x: cx, y: cy })
                .catch(() => {})
                .finally(() => {
                  if (p >= 1) res();
                  else requestAnimationFrame(loop);
                });
            };
            requestAnimationFrame(loop);
          });
        await frame();
      } finally {
        animatingRef.current = false;
      }
    },
    [],
  );

  // 先声明 stopPolling（被 show 和 hide 使用）
  const stopPolling = useCallback(() => {
    if (pollRef.current !== null) {
      window.clearInterval(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  // ===== 显示（从吸附状态还原） =====
  const show = useCallback(async () => {
    if (stateRef.current !== "hidden" || animatingRef.current) return;
    console.log("[autoHide] show() start");
    stopPolling();
    stateRef.current = "idle";
    // 移除吸附指示
    document.body.removeAttribute("data-snap-edge");
    // 先 setFocus：让 Tauri/浏览器的 focus 状态立刻变为 true，
    // 这样即便动画期间有 effect 重跑，focus 读到 true 不会错误地 scheduleHide
    await win.setFocus().catch(() => {});
    const saved = savedPosRef.current;
    if (saved) {
      await animateTo(saved.x, saved.y);
    }
    console.log("[autoHide] show() done");
  }, [animateTo, stopPolling, win]);

  // ===== 吸附态下轮询鼠标位置，靠近 peek 条就还原 =====
  const startPolling = useCallback(() => {
    stopPolling();
    console.log("[autoHide] startPolling");
    let tickCount = 0;
    pollRef.current = window.setInterval(async () => {
      if (stateRef.current !== "hidden") return;
      tickCount++;
      try {
        const { x: cx, y: cy } = await invoke<CursorPos>("get_cursor_pos");
        const { x, y, w, h } = await getPosSize();
        const edge = edgeRef.current;

        const visLeft = x;
        const visTop = y;
        const visRight = x + w;
        const visBottom = y + h;

        // 触发带：围绕 peek 本身一条较宽的带，避免误触整个窗口高度/宽度
        let near = false;
        if (edge === "right") {
          // 右吸附：peek 在窗口最左侧（visLeft ~ visLeft+peek），在屏内
          near =
            cx >= visLeft - TRIGGER_PAD_PX &&
            cx <= visLeft + PEEK_BAND &&
            cy >= visTop &&
            cy <= visBottom;
        } else if (edge === "left") {
          // 左吸附：peek 在窗口最右侧（visRight-peek ~ visRight），在屏内
          near =
            cx >= visRight - PEEK_BAND &&
            cx <= visRight + TRIGGER_PAD_PX &&
            cy >= visTop &&
            cy <= visBottom;
        } else {
          // 顶部吸附：peek 在窗口最底部（visBottom-peek ~ visBottom），在屏内
          near =
            cy >= visBottom - PEEK_BAND &&
            cy <= visBottom + TRIGGER_PAD_PX &&
            cx >= visLeft &&
            cx <= visRight;
        }

        // 每 10 个 tick（~1s）或命中时打日志
        if (tickCount % 10 === 0 || near) {
          console.log(
            `[autoHide] poll tick=${tickCount} edge=${edge} cursor=(${cx},${cy}) win=(${x},${y},${w},${h}) near=${near}`,
          );
        }

        if (near) {
          console.log("[autoHide] near=true -> show()");
          show();
        }
      } catch (e) {
        console.warn("[autoHide] poll err:", e);
      }
    }, POLL_MS);
  }, [getPosSize, show, stopPolling]);

  // ===== 吸附 =====
  // force=true 表示用户主动触发（如标题栏收起按钮），跳过距离阈值判断
  const hide = useCallback(async (force: boolean = false) => {
    if (stateRef.current !== "idle" || animatingRef.current) {
      console.log(
        "[autoHide] hide aborted: state=" +
          stateRef.current +
          " animating=" +
          animatingRef.current,
      );
      return;
    }
    if (!force && pausedRef.current) {
      console.log("[autoHide] hide aborted: paused");
      return;
    }

    try {
      const { x, y, w, h, scale } = await getPosSize();
      console.log("[autoHide] pos size:", x, y, w, h, "scale=", scale);
      const wa = await getWorkArea();
      console.log("[autoHide] work area:", wa);
      const edge = calcEdge(x, y, w, h, wa);
      console.log("[autoHide] chosen edge:", edge);

      // 距离阈值检查：自动触发时，若窗口距最近边缘太远，放弃吸附（避免打扰）
      if (!force) {
        const distLeft = x - wa.x;
        const distRight = wa.x + wa.width - (x + w);
        const distTop = y - wa.y;
        const minDist = Math.min(distLeft, distRight, distTop);
        if (minDist > AUTO_SNAP_DIST_THRESHOLD) {
          console.log(
            `[autoHide] hide aborted: too far from edge (minDist=${minDist} > ${AUTO_SNAP_DIST_THRESHOLD})`,
          );
          return;
        }
      }

      edgeRef.current = edge;
      savedPosRef.current = { x, y };

      const peekPx = Math.round(PEEK * scale);
      let tx = x;
      let ty = y;
      if (edge === "left") tx = wa.x - w + peekPx;
      else if (edge === "right") tx = wa.x + wa.width - peekPx;
      else if (edge === "top") ty = wa.y - h + peekPx;

      console.log("[autoHide] animating from", x, y, "to", tx, ty);

      stateRef.current = "hidden";
      // 把吸附方向写到 body data 属性上，供 CSS 控制指示条显示
      document.body.setAttribute("data-snap-edge", edge);
      await animateTo(tx, ty);
      // 验证窗口实际位置
      const actual = await invoke<{ x: number; y: number }>(
        "get_window_rect_raw",
      );
      console.log(
        "[autoHide] animation done. actual pos:",
        actual.x,
        actual.y,
        "expected:",
        tx,
        ty,
      );
      startPolling();
    } catch (e) {
      console.error("[autoHide] hide() failed:", e);
      stateRef.current = "idle";
    }
  }, [
    animateTo,
    calcEdge,
    getPosSize,
    getWorkArea,
    pausedRef,
    startPolling,
  ]);

  // ===== 定时器 helper =====
  const clearTimer = useCallback(() => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  }, []);

  const scheduleHide = useCallback(() => {
    clearTimer();
    if (!enabled) {
      console.log("[autoHide] skip: disabled");
      return;
    }
    if (stateRef.current !== "idle") {
      console.log("[autoHide] skip: state=" + stateRef.current);
      return;
    }
    if (animatingRef.current) {
      console.log("[autoHide] skip: animating");
      return;
    }
    if (pausedRef.current) {
      console.log("[autoHide] skip: paused");
      return;
    }
    if (mouseInsideRef.current) {
      console.log("[autoHide] skip: mouse inside");
      return;
    }
    console.log(`[autoHide] scheduled in ${delaySec}s`);
    timerRef.current = window.setTimeout(() => {
      console.log("[autoHide] timeout -> hide()");
      hide();
    }, delaySec * 1000);
  }, [clearTimer, delaySec, enabled, hide, pausedRef]);

  // ===== 焦点监听（Tauri onFocusChanged + window focus/blur + 定时 fallback） =====
  useEffect(() => {
    if (!settingsLoaded) return;

    let unlistenTauri: (() => void) | undefined;
    let cancelled = false;
    let lastFocused = true;

    const handleFocusChange = (focused: boolean) => {
      if (focused === lastFocused) return;
      lastFocused = focused;
      console.log("[autoHide] focus changed:", focused);
      if (focused) {
        clearTimer();
        if (stateRef.current === "hidden") show();
      } else {
        scheduleHide();
      }
    };

    // 1. Tauri 原生 focus 事件
    (async () => {
      try {
        const fn = await win.onFocusChanged(({ payload: focused }) => {
          handleFocusChange(focused);
        });
        if (cancelled) fn();
        else unlistenTauri = fn;
      } catch (e) {
        console.warn("[autoHide] onFocusChanged failed:", e);
      }
    })();

    // 2. 浏览器侧 window focus/blur，双保险
    const onWinFocus = () => handleFocusChange(true);
    const onWinBlur = () => handleFocusChange(false);
    window.addEventListener("focus", onWinFocus);
    window.addEventListener("blur", onWinBlur);

    // 3. 定时 fallback：每 800ms 比对一次，防止前两种都丢事件
    const pollId = window.setInterval(async () => {
      try {
        const focused = await win.isFocused();
        if (focused !== lastFocused) {
          handleFocusChange(focused);
        }
      } catch {
        // ignore
      }
    }, 800);

    // 初始化：只在真正的首次挂载做状态机重置（HMR 兜底），
    // 后续 effect 重跑不能再清 stateRef，否则会打断正在进行中的 show()/hide()
    (async () => {
      try {
        if (!initedRef.current) {
          initedRef.current = true;
          stateRef.current = "idle";
          animatingRef.current = false;
          savedPosRef.current = null;
          console.log("[autoHide] first-mount reset");
        }

        const focused = await win.isFocused();
        lastFocused = focused;
        console.log("[autoHide] initial focused=" + focused);
        if (!focused && stateRef.current === "idle") scheduleHide();
      } catch {
        // ignore
      }
    })();

    return () => {
      cancelled = true;
      unlistenTauri?.();
      window.removeEventListener("focus", onWinFocus);
      window.removeEventListener("blur", onWinBlur);
      window.clearInterval(pollId);
      clearTimer();
      stopPolling();
    };
  }, [clearTimer, scheduleHide, settingsLoaded, show, stopPolling, win]);

  // ===== enabled 被关掉：清 timer + 若在吸附则还原 =====
  useEffect(() => {
    if (!enabled) {
      clearTimer();
      if (stateRef.current === "hidden") {
        show();
      }
    }
  }, [enabled, clearTimer, show]);

  // ===== 鼠标进出文档：mouseenter 时清 timer；mouseleave 时若失焦则 scheduleHide =====
  useEffect(() => {
    if (!settingsLoaded || !enabled) return;

    const onEnter = () => {
      mouseInsideRef.current = true;
      clearTimer();
    };
    const onLeave = async () => {
      mouseInsideRef.current = false;
      // 鼠标离开文档 + 窗口未聚焦 → 调度 hide
      const focused = await win.isFocused();
      if (!focused) scheduleHide();
    };
    const onKeydown = () => {
      // 键盘交互视为活跃，取消调度
      clearTimer();
    };

    document.addEventListener("mouseenter", onEnter);
    document.addEventListener("mouseleave", onLeave);
    window.addEventListener("keydown", onKeydown);

    return () => {
      document.removeEventListener("mouseenter", onEnter);
      document.removeEventListener("mouseleave", onLeave);
      window.removeEventListener("keydown", onKeydown);
    };
  }, [clearTimer, enabled, scheduleHide, settingsLoaded, win]);

  // ===== enabled / delaySec / paused 变化：重算一下是否需要 scheduleHide =====
  useEffect(() => {
    if (!settingsLoaded || !enabled) return;
    if (paused) {
      clearTimer();
      return;
    }
    (async () => {
      const focused = await win.isFocused();
      if (!focused && !mouseInsideRef.current && stateRef.current === "idle") {
        scheduleHide();
      }
    })();
  }, [delaySec, enabled, paused, scheduleHide, clearTimer, settingsLoaded, win]);

  // ===== 暴露给外部的 API =====
  // 主动收起（不受距离阈值/enabled/paused 限制）
  const snapNow = useCallback(async () => {
    clearTimer();
    await hide(true);
  }, [clearTimer, hide]);

  return { snapNow };
}
