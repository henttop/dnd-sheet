import React, { useEffect, useRef, useState } from "react";
import { rollDiceExpr, d20, signed, evaluateFormula } from "./dice.js";
import { getUi, subscribeUi } from "./uistore.js";
import { sendRollToWebhooks, getCharAvatarUrl } from "./webhooks.js";
import { addRollHistory, getRollHistory, subscribeRollHistory } from "./rollHistory.js";
import RollHistoryDrawer, { HistoryIcon } from "./RollHistoryModal.jsx";
import { characters } from "./store.js";

/* ================= Всплывающие результаты броска (стопка слева внизу) ================= */
export function RollHost() {
  const [list, setList] = useState([]);
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);

  // новый попап не заменяет старый, а кладётся в стопку; старые уходят по таймеру
  const push = (entry) => {
    const id = Date.now() + Math.random();
    setList(l => [...l, { ...entry, id }].slice(-8));
    setTimeout(() => setList(l => l.filter(x => x.id !== id)), 5000);
  };

  useEffect(() => {
    const onDocClick = (e) => {
      const btn = e.target.closest(".roll-btn, .atk-val, .sp-cast, .roller-btn, .wpn-atk, .sp-stat");
      if (btn) {
        btn.classList.remove("is-rolling");
        void btn.offsetWidth;
        btn.classList.add("is-rolling");
        setTimeout(() => btn.classList.remove("is-rolling"), 500);
      }
    };
    document.addEventListener("click", onDocClick, true);

    window.__roll = (title, total, mods, opts = {}) => {
      const char = window.__activeChar || (typeof characters !== "undefined" && characters.length ? characters[0] : null);
      const charName = char?.data?.name?.value || "Безымянный персонаж";
      const charAvatar = getCharAvatarUrl(char);
      const entry = { title, total, mods, charName, charAvatar, ...opts };
      push(entry);
      sendRollToWebhooks(entry);
      addRollHistory(entry);
    };
    // бросок к20: total = кубик + бонус
    window.__rollD20 = (title, bonus, mods = "") => {
      const d = d20();
      const parts = [`${d} на к20`];
      if (bonus > 0) parts.push(`+${bonus}`);
      else if (bonus < 0) parts.push(`−${-bonus}`);
      if (mods) parts.push(mods);
      window.__roll(title, d + bonus, parts.join(" + "), {
        die: d,
        bonus,
        extraMods: mods,
        crit: d === 20,
        fail: d === 1
      });
    };
    window.__rollExpr = (title, expr, mod, modLabel, extraOpts = {}) => {
      const res = rollDiceExpr(expr);
      if (res) {
        const extra = mod || 0;
        const faces = +(String(expr).match(/[dкк](\d+)/i)?.[1] || 20);
        const cleanExpr = String(expr).trim().replace(/d/i, "к");
        const diceBreakdown = res.raw.join("+");

        // Явно указываем кость урона: например "1к8 (5)" или "2к6 (4+3)"
        const formulaPart = `${cleanExpr} (${diceBreakdown})`;
        let modPart = "";
        if (extra > 0) {
          modPart = ` + ${extra}${modLabel ? " (" + modLabel + ")" : ""}`;
        } else if (extra < 0) {
          modPart = ` − ${Math.abs(extra)}${modLabel ? " (" + modLabel + ")" : ""}`;
        }
        const subPart = extraOpts.sub ? ` ${extraOpts.sub}` : "";
        const mods = `${formulaPart}${modPart}${subPart}`.trim();

        window.__roll(title, res.total + extra, mods, {
          isDmg: true,
          modLabel,
          faces,
          expr: cleanExpr,
          diceRaw: res.raw,
          mod: extra,
          ...extraOpts
        });
      }
    };
    // вычисление и бросок произвольной формулы D&D 5e (переменные, if, kh/kl, crits)
    window.__rollFormula = (rawExpr, extraOpts = {}) => {
      const char = window.__activeChar || (typeof characters !== "undefined" && characters.length ? characters[0] : null);
      const res = evaluateFormula(rawExpr, char);
      if (!res) return;
      const title = res.title || "Бросок";
      const mods = res.details || res.resolvedExpr || rawExpr;
      window.__roll(title, res.total, mods, {
        isFormula: true,
        formula: res.formula,
        resolvedExpr: res.resolvedExpr,
        crit: res.crit,
        fail: res.fail,
        rolls: (res.rolls || []).map(r => ({ value: r.val, faces: r.faces, kept: r.kept, dropped: r.dropped })),
        sub: res.sub,
        ...extraOpts
      });
    };

    // бросок урона заклинания (карточка в журнале кубиков)
    window.__rollSpell = (name, total, dmgType, rolls, extraOpts = {}) => {
      const char = window.__activeChar;
      const charName = char?.data?.name?.value || "Безымянный персонаж";
      const charAvatar = getCharAvatarUrl(char);
      const entry = {
        title: name,
        total,
        kind: extraOpts.kind || "урон",
        sub: dmgType,
        rolls: rolls || [],
        spell: true,
        charName,
        charAvatar,
        ...extraOpts
      };
      push(entry);
      sendRollToWebhooks(entry);
      addRollHistory(entry);
    };

    return () => {
      document.removeEventListener("click", onDocClick, true);
    };
  }, []);

  if (!list.length) return null;
  return (
    <div className="roll-stack">
      {list.map((st, i) => (
        <RollCard key={st.id} st={st} ui={ui} old={i < list.length - 1}
          onClose={() => setList(l => l.filter(x => x.id !== st.id))} />
      ))}
    </div>
  );
}

function RollCard({ st, ui, onClose, old }) {
  const mood = ui.critColors === false ? "" : (st.crit ? " crit" : st.fail ? " fail" : "");
  const allDice = (st.rolls || []).flatMap(r => (r.parts && r.parts.length ? r.parts : [r.value]));
  const cls = "roll-pop" + mood + (old ? " old" : "");

  // бросок формулы из текстового редактора
  if (st.isFormula) {
    return (
      <div className={cls + " formula-pop"}>
        <button className="rp-close" onClick={onClose}>×</button>
        <div className="rp-title">{st.title}</div>
        {st.sub ? <div className="rp-sub">{st.sub}</div> : null}
        <div className="rp-body">
          {st.rolls && st.rolls.length > 0 ? (
            <div className="rp-glyphs">
              {st.rolls.slice(0, 8).map((r, i) => (
                <span className={"rp-glyph" + (r.dropped ? " is-dropped" : "")} key={i} title={r.dropped ? "Сброшен" : ""}>
                  <DieShape faces={r.faces || 20} size={26} />
                  <span className="rp-glyph-n">{r.value}</span>
                </span>
              ))}
              {st.rolls.length > 8 ? <span className="rp-glyph-more">+{st.rolls.length - 8}</span> : null}
            </div>
          ) : null}
          <div className={"rp-total" + mood + (typeof st.total === "string" && isNaN(Number(st.total)) ? " text-total" : "")}>{st.total}</div>
        </div>
        {st.mods ? <div className="rp-roll-line">{st.mods}</div> : null}
      </div>
    );
  }

  // карточка броска заклинания (журнал кубиков)
  if (st.spell) {
    const diceLine = (st.rolls || []).map(r => {
      const raw = r.parts && r.parts.length ? r.parts.join("+") : r.value;
      return r.expr ? `${r.expr} (${raw})` : raw;
    }).join(" + ");
    return (
      <div className={cls + " spell-pop"}>
        <button className="rp-close" onClick={onClose}>×</button>
        <div className="rp-title">{st.title}</div>
        <div className="rp-sub">{st.kind}{st.sub ? " · " + st.sub : ""}</div>
        <div className="rp-body">
          <div className="rp-glyphs">
            {(st.rolls || []).map((r, i) => (
              <span className="rp-glyph" key={i}>
                <DieShape faces={r.faces || 20} size={26} />
                <span className="rp-glyph-n">{r.value}</span>
              </span>
            ))}
          </div>
          <div className={"rp-total" + mood + (typeof st.total === "string" && isNaN(Number(st.total)) ? " text-total" : "")}>{st.total}</div>
        </div>
        {diceLine ? <div className="rp-roll-line">{diceLine}</div> : null}
      </div>
    );
  }

  // бросок нескольких кубиков (дайсница) — показываем каждый своим кубиком
  if (st.rolls && st.rolls.length) {
    return (
      <div className={cls}>
        <button className="rp-close" onClick={onClose}>×</button>
        <div className="rp-title">{st.title}</div>
        <div className="rp-body">
          <div className="rp-glyphs">
            {st.rolls.map((r, i) => (
              <span className="rp-glyph" key={i}>
                <DieShape faces={r.faces || 20} size={26} />
                <span className="rp-glyph-n">{r.value}</span>
              </span>
            ))}
          </div>
          <div className={"rp-total" + mood + (typeof st.total === "string" && isNaN(Number(st.total)) ? " text-total" : "")}>{st.total}</div>
        </div>
        {allDice.length > 1 ? <div className="rp-roll-line">{allDice.join("+")}</div> : null}
      </div>
    );
  }

  return (
    <div className={cls}>
      <button className="rp-close" onClick={onClose}>×</button>
      <div className="rp-title">{st.title}</div>
      <div className="rp-body">
        <div className={"rp-die" + mood}>
          {st.faces ? (
            <span className="rp-glyph" style={{ position: "relative", display: "inline-flex", alignItems: "center", justifyContent: "center" }}>
              <DieShape faces={st.faces} size={34} />
              {st.diceRaw && st.diceRaw.length === 1 ? (
                <span className="rp-die-n">{st.diceRaw[0]}</span>
              ) : null}
            </span>
          ) : <><DieIcon size={34} />{st.die != null ? <span className="rp-die-n">{st.die}</span> : null}</>}
        </div>
        <div className={"rp-total" + mood}>{st.total}</div>
      </div>
      {st.mods && ui.rollDetails !== false ? <div className="rp-details">{st.mods}</div> : null}
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
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyList, setHistoryList] = useState(getRollHistory());
  const [pool, setPool] = useState([]); // массив граней: [20,6,6]

  useEffect(() => {
    return subscribeRollHistory(setHistoryList);
  }, []);

  useEffect(() => {
    window.__openRollHistory = () => setHistoryOpen(true);
    return () => {
      delete window.__openRollHistory;
    };
  }, []);

  const roll = () => {
    if (!pool.length) return;
    const rolls = pool.map(f => { const r = 1 + Math.floor(Math.random() * f); return { faces: f, value: r }; });
    const total = rolls.reduce((s, p) => s + p.value, 0);

    // Группируем кости по граням для красивого отображения (например "1к20 (17) + 2к6 (4+5)")
    const groups = {};
    for (const r of rolls) {
      groups[r.faces] = groups[r.faces] || [];
      groups[r.faces].push(r.value);
    }
    const mods = Object.entries(groups).map(([faces, vals]) => {
      const expr = `${vals.length}к${faces}`;
      return `${expr} (${vals.join("+")})`;
    }).join(" + ");

    // Проверяем d20 на крит или провал
    const d20Rolls = rolls.filter(r => r.faces === 20);
    const crit = d20Rolls.some(r => r.value === 20);
    const fail = !crit && d20Rolls.some(r => r.value === 1);

    window.__roll("Бросок из дайсницы", total, mods, { rolls, crit, fail, fromDiceTower: true });
  };
  const DICE = [2, 4, 6, 8, 10, 12, 20, 100];
  const historyCount = historyList.length;

  return (
    <>
      <div className="dicetower">
        {open ? (
          <div className="tower-panel">
            <button className="tower-x" onClick={() => setOpen(false)}>×</button>
            <div className="tower-dice">
              {DICE.map(f => (
                <button key={f} className="tower-die" title={`d${f} — ${f} граней`} onClick={() => setPool(p => [...p, f])}>
                  <DieShape faces={f} />
                  <span className="tower-faces">{f}</span>
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
            <div className="tower-foot">
              <button className="tower-history-btn" onClick={() => { setOpen(false); setHistoryOpen(true); }} title="Открыть историю бросков">
                <HistoryIcon size={14} />
                <span>История бросков</span>
              </button>
            </div>
          </div>
        ) : null}

        <div className="dice-fabs-wrap">
          <button
            className="history-fab"
            onClick={() => setHistoryOpen(true)}
            title="История бросков"
          >
            <HistoryIcon size={22} />
            {historyCount > 0 && (
              <span className="history-fab-badge">
                {historyCount > 99 ? "99+" : historyCount}
              </span>
            )}
          </button>
          <button className={"tower-fab" + (open ? " open" : "")} onClick={() => setOpen(!open)} title="Дайсница">
            <DieIcon size={26} />
          </button>
        </div>
      </div>

      {historyOpen && <RollHistoryDrawer onClose={() => setHistoryOpen(false)} />}
    </>
  );
}

function DieShape({ faces, size = 24 }) {
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
  return <svg width={size} height={size} viewBox="0 0 26 26" fill="none" stroke="currentColor" strokeWidth="1.4">{icons[faces] || icons[20]}</svg>;
}

/* ================= Инлайн-редактирование значения ================= */
export function Editable({ value, displayValue, onSave, className = "", title = "изменить", width, type = "text" }) {
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
  const rendered = displayValue != null ? displayValue : value;
  return (
    <span className={"editable " + className} title={title}
      onClick={e => { e.stopPropagation(); setDraft(value == null ? "" : String(value)); setEditing(true); }}>
      {rendered}
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

/* ===== Переключатель-кнопка (вместо чекбоксов) ===== */
export function Toggle({ checked, onChange, label, title }) {
  return (
    <button type="button" title={title || label}
      className={"tg" + (checked ? " on" : "")}
      aria-pressed={!!checked}
      onClick={e => { e.stopPropagation(); onChange(!checked); }}>
      <span className="tg-box">{checked ? "✓" : ""}</span>
      <span className="tg-label">{label}</span>
    </button>
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

/* Позиция поповера относительно элемента-триггера (экра��ные координаты) */
export function useAnchorPos(open, ref, opts = {}) {
  const { dx = 0, dy = 8, width = 200, align = "left" } = opts;
  const [pos, setPos] = useState(null);
  useEffect(() => {
    if (!open) { setPos(null); return; }
    const update = () => {
      const el = ref.current;
      if (!el) return;
      const r = el.getBoundingClientRect();
      let left = align === "right" ? r.right - width : align === "center" ? r.left + r.width / 2 - width / 2 : r.left;
      left += dx;
      const top = r.bottom + dy;
      // не даём вылезти за экран
      left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
      setPos({ left, top });
    };
    update();
    window.addEventListener("resize", update);
    window.addEventListener("scroll", update, true);
    return () => { window.removeEventListener("resize", update); window.removeEventListener("scroll", update, true); };
  }, [open, dx, dy, width, align]);
  return pos;
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
