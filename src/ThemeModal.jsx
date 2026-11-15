import React, { useEffect, useState } from "react";
import { getUi, setUi, subscribeUi } from "./uistore.js";
import { CURSOR_COLORS } from "./CursorGlow.jsx";
import { Toggle } from "./ui.jsx";

export function ThemeSettingsContent({ ui, setUi }) {
  return (
    <div className="theme-settings-content">
      <div className="theme-section">
        <div className="theme-item-row">
          <div className="theme-item-info">
            <div className="theme-item-title">Глубокий тёмный фон</div>
            <div className="theme-item-desc">
              Сверхтёмная обсидиановая палитра для ночной игры, снижения усталости глаз и максимального контраста.
            </div>
          </div>
          <Toggle
            checked={ui.darkerBg !== false}
            onChange={(v) => setUi({ darkerBg: v })}
          />
        </div>
      </div>

      <div className="theme-section">
        <div className="theme-item-row">
          <div className="theme-item-info">
            <div className="theme-item-title">Подсветка за курсором</div>
            <div className="theme-item-desc">
              Мягкое магическое свечение с плавным шлейфом, следующее за указателем мыши.
            </div>
          </div>
          <Toggle
            checked={ui.cursorGlow !== false}
            onChange={(v) => setUi({ cursorGlow: v })}
          />
        </div>

        {ui.cursorGlow !== false && (
          <div className="theme-suboptions">
            <div className="theme-color-label">Цвет магического свечения:</div>
            <div className="theme-color-grid">
              {Object.values(CURSOR_COLORS).map((c) => {
                const isActive = (ui.cursorColor || "purple") === c.id;
                return (
                  <button
                    key={c.id}
                    type="button"
                    className={"theme-color-btn" + (isActive ? " is-active" : "")}
                    onClick={() => setUi({ cursorColor: c.id })}
                  >
                    <span
                      className="theme-color-dot"
                      style={{ background: c.preview, boxShadow: `0 0 8px ${c.preview}` }}
                    />
                    <span>{c.name}</span>
                  </button>
                );
              })}
            </div>

            <div className="theme-item-row" style={{ marginTop: 14, flexDirection: "column", alignItems: "stretch", gap: 8 }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <div className="theme-item-title" style={{ fontSize: 13 }}>Размер круга подсветки</div>
                <div className="theme-slider-val">{ui.cursorRadius || 240} px</div>
              </div>
              <div className="theme-item-desc">
                Регулирует радиус области, в которой подсвечиваются точки и фон вокруг курсора.
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                <input
                  type="range"
                  min="120"
                  max="460"
                  step="10"
                  value={ui.cursorRadius || 240}
                  onChange={(e) => setUi({ cursorRadius: Number(e.target.value) })}
                  className="theme-range-slider"
                />
              </div>
              <div className="theme-presets-row">
                {[
                  { label: "160 px", val: 160 },
                  { label: "240 px", val: 240 },
                  { label: "320 px", val: 320 },
                  { label: "420 px", val: 420 },
                ].map((p) => (
                  <button
                    key={p.val}
                    type="button"
                    className={"theme-preset-btn" + ((ui.cursorRadius || 240) === p.val ? " is-active" : "")}
                    onClick={() => setUi({ cursorRadius: p.val })}
                  >
                    {p.label}
                  </button>
                ))}
              </div>
            </div>

            <div className="theme-item-row" style={{ marginTop: 14 }}>
              <div className="theme-item-info">
                <div className="theme-item-title" style={{ fontSize: 13 }}>Сетка из точек (Dot Matrix)</div>
                <div className="theme-item-desc">
                  Подсвечивает координатную точечную сетку вокруг курсора при его движении.
                </div>
              </div>
              <Toggle
                checked={ui.cursorDotGrid !== false}
                onChange={(v) => setUi({ cursorDotGrid: v })}
              />
            </div>

            {ui.cursorDotGrid !== false && (
              <div className="theme-item-row" style={{ marginTop: 8, flexDirection: "column", alignItems: "stretch", gap: 8, paddingLeft: 12, borderLeft: "2px solid rgba(139, 92, 246, 0.35)" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <div className="theme-item-title" style={{ fontSize: 12.5 }}>Расстояние между точками</div>
                  <div className="theme-slider-val">{ui.cursorDotSpacing || 28} px</div>
                </div>
                <div className="theme-item-desc">
                  Регулирует плотность сетки (расстояние между соседними точками на фоне).
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 12, marginTop: 4 }}>
                  <input
                    type="range"
                    min="16"
                    max="56"
                    step="2"
                    value={ui.cursorDotSpacing || 28}
                    onChange={(e) => setUi({ cursorDotSpacing: Number(e.target.value) })}
                    className="theme-range-slider"
                  />
                </div>
                <div className="theme-presets-row">
                  {[
                    { label: "18 px", val: 18 },
                    { label: "28 px", val: 28 },
                    { label: "38 px", val: 38 },
                    { label: "48 px", val: 48 },
                  ].map((p) => (
                    <button
                      key={p.val}
                      type="button"
                      className={"theme-preset-btn" + ((ui.cursorDotSpacing || 28) === p.val ? " is-active" : "")}
                      onClick={() => setUi({ cursorDotSpacing: p.val })}
                    >
                      {p.label}
                    </button>
                  ))}
                </div>
              </div>
            )}

            <div className="theme-item-row" style={{ marginTop: 14 }}>
              <div className="theme-item-info">
                <div className="theme-item-title" style={{ fontSize: 13 }}>Волна при клике</div>
                <div className="theme-item-desc">
                  Пульсирующая магическая волна при каждом нажатии мыши.
                </div>
              </div>
              <Toggle
                checked={ui.cursorRipple !== false}
                onChange={(v) => setUi({ cursorRipple: v })}
              />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export default function ThemeModal({ onClose }) {
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal theme-modal" onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-head">
          <h3 className="modal-title" style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <span>🎨</span>
            <span>ОФОРМЛЕНИЕ И ЭФФЕКТЫ</span>
          </h3>
          <button type="button" className="modal-x" onClick={onClose} title="Закрыть">×</button>
        </div>

        <div className="modal-body">
          <ThemeSettingsContent ui={ui} setUi={setUi} />
        </div>

        <div className="modal-actions" style={{ justifyContent: "flex-end", marginTop: 16 }}>
          <button type="button" className="btn-done" onClick={onClose}>
            Готово
          </button>
        </div>
      </div>
    </div>
  );
}
