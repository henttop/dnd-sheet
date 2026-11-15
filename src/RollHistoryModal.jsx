import React, { useEffect, useMemo, useState } from "react";
import { getRollHistory, clearRollHistory, subscribeRollHistory } from "./rollHistory.js";
import { toast } from "./toast.jsx";

export function HistoryIcon({ size = 20, className = "" }) {
  return (
    <svg className={className} width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M12 8v4l3 3" />
      <path d="M3.05 11a9 9 0 1 1 .5 4m-.5 5v-5h5" />
    </svg>
  );
}

export function TrashIcon({ size = 16 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" />
      <line x1="10" y1="11" x2="10" y2="17" />
      <line x1="14" y1="11" x2="14" y2="17" />
    </svg>
  );
}

export function RerollIcon({ size = 15 }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.19" />
    </svg>
  );
}

export default function RollHistoryDrawer({ onClose }) {
  const [history, setHistory] = useState(getRollHistory());
  const [filter, setFilter] = useState("all"); // "all" | "atk" | "dmg" | "check" | "spell"
  const [search, setSearch] = useState("");

  useEffect(() => {
    return subscribeRollHistory(setHistory);
  }, []);

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [onClose]);

  const handleClear = () => {
    if (!history.length) return;
    if (window.confirm("Очистить всю историю бросков?")) {
      clearRollHistory();
      toast("История бросков очищена", "ok");
    }
  };

  const handleReroll = (entry) => {
    if (entry.spell && entry.spellData) {
      // Перезапуск заклинания через __rollSpell
      window.__rollSpell?.(entry.title, entry.total, entry.sub, entry.rolls, {
        kind: entry.kind,
        spellData: entry.spellData
      });
      toast(`Повторен бросок заклинания «${entry.title}»`, "ok");
    } else if (entry.isDmg && entry.expr) {
      // Повтор броска урона
      window.__rollExpr?.(entry.title, entry.expr, entry.mod || 0, entry.modLabel || "", {
        sub: entry.sub
      });
      toast(`Повторен бросок урона «${entry.title}»`, "ok");
    } else if (entry.die != null) {
      // Повтор d20 броска
      const bonus = entry.bonus != null ? entry.bonus : (entry.total - entry.die);
      window.__rollD20?.(entry.title, bonus, entry.extraMods || "");
      toast(`Повторен бросок «${entry.title}»`, "ok");
    } else if (entry.expr) {
      window.__rollExpr?.(entry.title, entry.expr);
      toast(`Повторен бросок «${entry.title}»`, "ok");
    } else {
      window.__roll?.(entry.title, entry.total, entry.mods, { ...entry, id: undefined, time: undefined });
      toast(`Повторен бросок «${entry.title}»`, "ok");
    }
  };

  const filteredHistory = useMemo(() => {
    return history.filter(item => {
      // Поиск по тексту
      if (search.trim()) {
        const q = search.toLowerCase();
        const matchTitle = (item.title || "").toLowerCase().includes(q);
        const matchMods = (item.mods || "").toLowerCase().includes(q);
        const matchChar = (item.charName || "").toLowerCase().includes(q);
        if (!matchTitle && !matchMods && !matchChar) return false;
      }

      // Фильтр категорий
      if (filter === "all") return true;
      if (filter === "atk") {
        return (item.title || "").startsWith("Атака:") || (item.title || "").includes("атак");
      }
      if (filter === "dmg") {
        return item.isDmg || (item.title || "").startsWith("Урон:") || item.kind === "урон";
      }
      if (filter === "check") {
        return item.die != null && !item.isDmg && !(item.title || "").includes("атак");
      }
      if (filter === "spell") {
        return item.spell || item.kind === "заклинание" || (item.title || "").startsWith("Заклинание:");
      }
      return true;
    });
  }, [history, filter, search]);

  const counts = useMemo(() => {
    let atk = 0, dmg = 0, check = 0, spell = 0;
    for (const it of history) {
      const t = it.title || "";
      if (t.startsWith("Атака:") || t.includes("атак")) atk++;
      else if (it.isDmg || t.startsWith("Урон:") || it.kind === "урон") dmg++;
      else if (it.spell || it.kind === "заклинание" || t.startsWith("Заклинание:")) spell++;
      else if (it.die != null) check++;
    }
    return { all: history.length, atk, dmg, check, spell };
  }, [history]);

  return (
    <div className="drawer-back history-drawer-back" onMouseDown={onClose}>
      <div className="drawer history-drawer" onMouseDown={e => e.stopPropagation()}>
        {/* Заголовок */}
        <div className="drawer-head history-head">
          <div className="history-head-title">
            <HistoryIcon size={22} className="history-head-icon" />
            <h3>История бросков</h3>
            <span className="history-counter-pill">{history.length}</span>
          </div>
          <div className="history-head-actions">
            {history.length > 0 && (
              <button className="history-clear-btn" onClick={handleClear} title="Очистить историю">
                <TrashIcon size={15} />
                <span>Очистить</span>
              </button>
            )}
            <button className="drawer-x" onClick={onClose} title="Закрыть">×</button>
          </div>
        </div>

        {/* Фильтры и поиск */}
        <div className="history-toolbar">
          <div className="history-filters">
            <button className={"hf-btn" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>
              Все <span>{counts.all}</span>
            </button>
            <button className={"hf-btn" + (filter === "atk" ? " on" : "")} onClick={() => setFilter("atk")}>
              Атаки <span>{counts.atk}</span>
            </button>
            <button className={"hf-btn" + (filter === "dmg" ? " on" : "")} onClick={() => setFilter("dmg")}>
              Урон <span>{counts.dmg}</span>
            </button>
            <button className={"hf-btn" + (filter === "check" ? " on" : "")} onClick={() => setFilter("check")}>
              Проверки <span>{counts.check}</span>
            </button>
            <button className={"hf-btn" + (filter === "spell" ? " on" : "")} onClick={() => setFilter("spell")}>
              Заклинания <span>{counts.spell}</span>
            </button>
          </div>

          <div className="history-search-wrap">
            <input
              type="text"
              className="history-search-input"
              placeholder="Поиск по названию или броску..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
            {search && (
              <button className="history-search-clear" onClick={() => setSearch("")}>×</button>
            )}
          </div>
        </div>

        {/* Список бросков */}
        <div className="history-body">
          {filteredHistory.length === 0 ? (
            <div className="history-empty">
              <div className="history-empty-icon">🎲</div>
              <div className="history-empty-title">
                {history.length === 0 ? "История бросков пуста" : "Ничего не найдено"}
              </div>
              <div className="history-empty-sub">
                {history.length === 0
                  ? "Бросайте кубики атак, урона, характеристик, навыков или заклинаний — они будут сохраняться здесь."
                  : "Попробуйте изменить поисковый запрос или выбрать другую вкладку."}
              </div>
            </div>
          ) : (
            <div className="history-list">
              {filteredHistory.map(entry => (
                <RollHistoryCard key={entry.id} entry={entry} onReroll={() => handleReroll(entry)} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function RollHistoryCard({ entry, onReroll }) {
  const isCrit = !!entry.crit;
  const isFail = !!entry.fail;
  const moodCls = isCrit ? " crit" : isFail ? " fail" : "";

  // Отображение формулы броска и деталей
  let detailsText = entry.mods || "";
  if (entry.spell && entry.rolls && entry.rolls.length) {
    const diceLine = entry.rolls.map(r => {
      const raw = r.parts && r.parts.length ? r.parts.join("+") : r.value;
      return r.expr ? `${r.expr} (${raw})` : raw;
    }).join(" + ");
    detailsText = diceLine + (entry.sub ? ` · ${entry.sub}` : "");
  }

  return (
    <div className={"history-card" + moodCls}>
      <div className="hc-main">
        <div className="hc-top">
          <div className="hc-title" title={entry.title}>{entry.title}</div>
          <div className="hc-time">{entry.time}</div>
        </div>

        <div className="hc-details">
          {detailsText ? <span className="hc-formula">{detailsText}</span> : null}
          {isCrit && <span className="hc-badge crit">Критический успех!</span>}
          {isFail && <span className="hc-badge fail">Критический провал!</span>}
          {entry.charName && <span className="hc-char">[{entry.charName}]</span>}
        </div>
      </div>

      <div className="hc-right">
        <div className={"hc-total" + moodCls}>{entry.total}</div>
        <button className="hc-reroll-btn" onClick={onReroll} title="Бросить снова">
          <RerollIcon size={14} />
          <span>Повторить</span>
        </button>
      </div>
    </div>
  );
}
