import { X, Sun, Moon, Monitor } from "lucide-react";
import { useSettingsStore } from "../store/useSettingsStore";
import "./SettingsPanel.css";

interface Props {
  onClose: () => void;
}

export function SettingsPanel({ onClose }: Props) {
  const s = useSettingsStore();

  return (
    <div className="settings">
      <div className="settings__head">
        <span>设置</span>
        <button className="settings__close" onClick={onClose} aria-label="关闭">
          <X size={14} />
        </button>
      </div>

      <div className="settings__body">
        <div className="settings__group">
          <div className="settings__label">外观</div>
          <div className="settings__theme">
            {(
              [
                { v: "system", label: "跟随系统", icon: <Monitor size={14} /> },
                { v: "light", label: "亮色", icon: <Sun size={14} /> },
                { v: "dark", label: "暗色", icon: <Moon size={14} /> },
              ] as const
            ).map((opt) => (
              <button
                key={opt.v}
                className={`settings__theme-btn ${
                  s.themeMode === opt.v ? "is-active" : ""
                }`}
                onClick={() => s.update({ themeMode: opt.v })}
              >
                {opt.icon}
                <span>{opt.label}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="settings__group">
          <div className="settings__row">
            <div className="settings__label-wrap">
              <div className="settings__label">窗口透明度</div>
              <div className="settings__hint">{Math.round(s.opacity * 100)}%</div>
            </div>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.05}
              value={s.opacity}
              onChange={(e) =>
                s.update({ opacity: parseFloat(e.target.value) })
              }
            />
          </div>
        </div>

        <div className="settings__group">
          <ToggleRow
            label="自动吸附边缘"
            hint="窗口失去焦点一段时间后自动滑到屏幕边缘"
            checked={s.autoHideEnabled}
            onChange={(v) => s.update({ autoHideEnabled: v })}
          />
          {s.autoHideEnabled && (
            <div className="settings__row">
              <div className="settings__label-wrap">
                <div className="settings__label">空闲时长</div>
                <div className="settings__hint">{s.autoHideDelay} 秒后吸附</div>
              </div>
              <input
                type="range"
                min={3}
                max={30}
                step={1}
                value={s.autoHideDelay}
                onChange={(e) =>
                  s.update({ autoHideDelay: parseInt(e.target.value) })
                }
              />
            </div>
          )}
        </div>

        <div className="settings__group">
          <ToggleRow
            label="开机自启"
            hint="系统启动时自动运行"
            checked={s.autoStart}
            onChange={(v) => s.update({ autoStart: v })}
          />
          <ToggleRow
            label="剪贴板监听"
            hint="复制内容时询问是否钉住"
            checked={s.clipboardWatch}
            onChange={(v) => s.update({ clipboardWatch: v })}
          />
          <ToggleRow
            label="隐藏失效文件"
            hint="原文件被删除的项不显示"
            checked={s.hideMissing}
            onChange={(v) => s.update({ hideMissing: v })}
          />
        </div>

        <div className="settings__group">
          <ToggleRow
            label="自动捕获下载"
            hint={'新下载完成的文件自动钉入 "下载" 分类'}
            checked={s.downloadWatch}
            onChange={(v) => s.update({ downloadWatch: v })}
          />
          <div className="settings__row">
            <div className="settings__label-wrap">
              <div className="settings__label">下载保留数量</div>
              <div className="settings__hint">
                超出按"未置顶 + 最旧"删除（置顶项不会被删）
              </div>
            </div>
            <input
              type="number"
              className="settings__number"
              min={5}
              max={200}
              step={5}
              value={s.downloadMaxKeep}
              onChange={(e) => {
                const v = Math.max(
                  5,
                  Math.min(200, parseInt(e.target.value) || 20),
                );
                s.update({ downloadMaxKeep: v });
              }}
            />
          </div>
        </div>

        <div className="settings__group">
          <div className="settings__row">
            <div className="settings__label-wrap">
              <div className="settings__label">全局快捷键</div>
              <div className="settings__hint">呼出/隐藏面板</div>
            </div>
            <kbd className="settings__kbd">{s.hotkey.replace("CmdOrCtrl", "Ctrl")}</kbd>
          </div>
        </div>

        <div className="settings__about">
          <div>PinBoard v0.1.0</div>
          <div className="settings__about-sub">
            Windows 置顶钉板 · Tauri + React
          </div>
        </div>
      </div>
    </div>
  );
}

function ToggleRow({
  label,
  hint,
  checked,
  onChange,
}: {
  label: string;
  hint?: string;
  checked: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="settings__row">
      <div className="settings__label-wrap">
        <div className="settings__label">{label}</div>
        {hint && <div className="settings__hint">{hint}</div>}
      </div>
      <label className="toggle">
        <input
          type="checkbox"
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <span className="toggle__track">
          <span className="toggle__thumb" />
        </span>
      </label>
    </div>
  );
}
