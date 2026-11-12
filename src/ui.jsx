import React, { useEffect, useRef, useState } from "react";
import { rollDiceExpr, d20, signed } from "./dice.js";
import { getUi, subscribeUi } from "./uistore.js";

/* ================= Всплывающий результат броска (как в LSS: слева внизу) ================= */
export function RollHost() {
  const [state, setState] = useState(null);
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);
  useEffect(() => {
    window.__roll = (title, total, mods, opts = {}) => {
      setState({ title, total, mods, ...opts });
      clearTimeout(window.__rollT);
      window.__rollT = setTimeout(() => setState(null), 5000);
    };
    // бросок к20: total = кубик + бонус
    window.__rollD20 = (title, bonus, mods = "") => {
      const d = d20();
      const parts = [`${d} на к20`];
      if (bonus > 0) parts.push(`+${bonus}`);
      else if (bonus < 0) parts.push(`−${-bonus}`);
      if (mods) parts.push(mods);
      window.__roll(title, d + bonus, parts.join(" + "), { die: d, crit: d === 20, fail: d === 1 });
    };
    window.__rollExpr = (title, expr) => {
      const res = rollDiceExpr(expr);
      if (res) window.__roll(title, res.total, res.raw.join(" + "), { isDmg: true });
    };
    // бросок урона заклинания (как карточка в журнале кубиков у LSS)
    window.__rollSpell = (name, total, dmgType, rolls) => {
      setState({ title: name, total, kind: "урон", sub: dmgType, rolls: rolls || [], spell: true });
      clearTimeout(window.__rollT);
      window.__rollT = setTimeout(() => setState(null), 5000);
    };
  }, []);
  if (!state) return null;
  const mood = ui.critColors === false ? "" : (state.crit ? " crit" : state.fail ? " fail" : "");
  // карточка броска заклинания (журнал кубиков)
  if (state.spell) {
    return (
      <div className="roll-pop spell-pop">
        <button className="rp-close" onClick={() => setState(null)}>×</button>
        <div className="rp-title">{state.title}</div>
        <div className="rp-sub">{state.kind}{state.sub ? " · " + state.sub : ""}</div>
        <div className="rp-body">
          <div className="rp-glyphs">
            {(state.rolls || []).map((r, i) => (
              <span className="rp-glyph" key={i}>
                <DieIcon size={26} />
                <span className="rp-glyph-n">{r.value}</span>
              </span>
            ))}
          </div>
          <div className="rp-total">{state.total}</div>
        </div>
      </div>
    );
  }
  return (
    <div className={"roll-pop" + mood}>
      <button className="rp-close" onClick={() => setState(null)}>×</button>
      <div className="rp-title">{state.title}</div>
      <div className="rp-body">
        <div className={"rp-die" + mood}>
          {state.isDmg ? <span className="rp-dmg-icon">🎲</span> : <><DieIcon size={34} />{state.die != null ? <span className="rp-die-n">{state.die}</span> : null}</>}
        </div>
        <div className={"rp-total" + mood}>{state.total}</div>
      </div>
      {state.mods && ui.rollDetails !== false ? <div className="rp-details">{state.mods}</div> : null}
    </div>
  );
}

/* ================= Иконка d20 ================= */
export function DieIcon({ size = 26 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.2">
      <path d="M13 24.9L3.03 18.3M13 24.9l9.97-6.6M13 24.9v-6.37M3.03 18.3l9.97-.03M3.03 18.3l3.79-9.3M3.03 18.3V8.02M3.03 8.02L13 1.3M3.03 8.02l3.79.97M13 1.3l9.97 6.72M13 1.3l6.17 7.69M13 1.3L6.82 8.99M22.97 8.02v10.29M22.97 8.02l-3.8.97M22.97 18.3l-9.97.03M22.97 18.3l-3.8-9.31M6.82 8.99h12.35M6.82 8.99L13 18.53M19.17 8.99L13 18.53" />
    </svg>
  );
}

/* ================= Дайсница (плавающий пул кубиков) ================= */
export function DiceTower() {
  const [open, setOpen] = useState(false);
  const [pool, setPool] = useState([]); // массив граней: [20,6,6]
  const roll = () => {
    if (!pool.length) return;
    const parts = pool.map(f => { const r = 1 + Math.floor(Math.random() * f); return { f, r }; });
    const total = parts.reduce((s, p) => s + p.r, 0);
    window.__roll("Дайсница", total, parts.map(p => `к${p.f}: ${p.r}`).join(" + "), { die: pool.length });
  };
  const DICE = [2, 4, 6, 8, 10, 12, 20, 100];
  return (
    <div className="dicetower">
      {open ? (
        <div className="tower-panel">
          <button className="tower-x" onClick={() => setOpen(false)}>×</button>
          <div className="tower-dice">
            {DICE.map(f => (
              <button key={f} className="tower-die" title={"d" + f} onClick={() => setPool(p => [...p, f])}>
                <DieShape faces={f} />
                {pool.filter(x => x === f).length ? <span className="tower-badge">{pool.filter(x => x === f).length}</span> : null}
              </button>
            ))}
          </div>
          <div className="tower-row">
            <button className="tower-btn" title="убрать последний" onClick={() => setPool(p => p.slice(0, -1))}>−</button>
            <span className="tower-count">{pool.length}</span>
            <button className="tower-btn" title="очистить" onClick={() => setPool([])}>×</button>
            <button className="tower-roll" title="бросить" onClick={roll}><DieIcon size={18} /></button>
          </div>
        </div>
      ) : null}
      <button className={"tower-fab" + (open ? " open" : "")} onClick={() => setOpen(!open)} title="Дайсница">
        <DieIcon size={26} />
      </button>
    </div>
  );
}

function DieShape({ faces }) {
  const icons = {
    2: <circle cx="13" cy="13" r="9" />,
    4: <path d="M13 3l10 18H3z" />,
    6: <rect x="5" y="5" width="16" height="16" rx="2" />,
    8: <path d="M13 3l9 10-9 10-9-10z" />,
    10: <path d="M13 2l8 5v12l-8 5-8-5V7z" />,
    12: <path d="M13 3l9 6v8l-9 6-9-6V9z" />,
    20: <path d="M13 2l10 7v9l-10 7-10-7V9z" />,
    100: <path d="M13 2l10 7-4 16H7L3 9z" />,
  };
  return <svg width="24" height="24" viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4">{icons[faces]}</svg>;
}

/* ================= Инлайн-редактирование значения ================= */
export function Editable({ value, onSave, className = "", title = "изменить", width, type = "text" }) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const ref = useRef(null);
  useEffect(() => { if (editing && ref.current) { ref.current.focus(); ref.current.select?.(); } }, [editing]);
  if (editing) {
    const commit = () => { setEditing(false); if (draft !== String(value)) onSave(draft); };
    return (
      <input ref={ref} className={"edit-in " + className} style={width ? { width } : null} type={type}
        value={draft}
        onChange={e => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={e => { if (e.key === "Enter") commit(); if (e.key === "Escape") setEditing(false); }} />
    );
  }
  return (
    <span className={"editable " + className} title={title}
      onClick={e => { e.stopPropagation(); setDraft(value == null ? "" : String(value)); setEditing(true); }}>
      {value}
    </span>
  );
}

/* ===== Модалка «Создание персонажа» (как на сайте) ===== */
export function CreateModal({ onClose }) {
  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>
        <div className="modal-ic">
          <svg viewBox="0 0 24 24" width="26" height="26" fill="none" stroke="currentColor" strokeWidth="1.6">
            <path d="M4 20L17 7M17 7l3 3M17 7l-3-3M17 7l-3 3M9 4l1.5 3.5L14 9l-3.5 1.5L9 14l-1.5-3.5L4 9l3.5-1.5zM18 14l1 2.5 2.5 1L19 18.5 18 21l-1-2.5-2.5-1L17 16.5z" />
          </svg>
        </div>
        <h3 className="modal-title">СОЗДАНИЕ ПЕРСОНАЖА</h3>
        <p className="modal-text">
          Позвольте конструктору помочь заполнить лист с нуля — выбрать класс, вид,
          предысторию и определить характеристики.
        </p>
        <button className="modal-btn" onClick={onClose}>ЗАПОЛНИТЬ САМОСТОЯТЕЛЬНО</button>
      </div>
    </div>
  );
}

/* ===== Поповер ===== */
export function Popover({ onClose, children, style }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const t = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", close); };
  }, []);
  return <div className="popover" ref={ref} style={style}>{children}</div>;
}

/* ===== Радио-поповер владения ===== */
export function ProfPopover({ anchor, value, onChange, onClose, withCustom, customValue, onCustom, title }) {
  if (!anchor) return null;
  const r = anchor.getBoundingClientRect();
  const x = Math.min(window.innerWidth - 240, Math.max(8, r.left - 8));
  const y = Math.min(window.innerHeight - 220, r.bottom + 6);
  const opts = [[0, "Нет"], [1, "Владение"], [2, "Экспертиза"]];
  return (
    <Popover onClose={onClose} style={{ left: x, top: y, minWidth: 210 }}>
      {title ? <div className="pop-title">{title}</div> : null}
      {opts.map(([v, label]) => (
        <label key={v} className="prof-opt">
          <input type="radio" checked={Number(value) === v} onChange={() => { onChange(v); onClose(); }} />
          <span>{label}</span>
        </label>
      ))}
      {withCustom ? (
        <div className="prof-custom">
          <div className="mini-label">СВОЁ ЗНАЧЕНИЕ</div>
          <input className="edit-in" type="number" style={{ width: "100%" }} placeholder="—" defaultValue={customValue ?? ""}
            onKeyDown={e => { if (e.key === "Enter") { onCustom(e.target.value === "" ? null : +e.target.value); onClose(); } }}
            onBlur={e => { onCustom(e.target.value === "" ? null : +e.target.value); onClose(); }} />
        </div>
      ) : null}
    </Popover>
  );
}
