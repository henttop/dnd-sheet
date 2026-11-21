import React, { useMemo, useState } from "react";
import { SPELL_BY_ID, SPELL_BY_SLUG } from "./store.js";
import { Popover, Toggle } from "./ui.jsx";
import CustomSelect from "./CustomSelect.jsx";
import { statMod, profOf, levelOf, XP, spellCasting } from "./helpers.js";
import { SpellFilters, emptyFilters, spellMatches, filterSummary } from "./SpellFilters.jsx";
import { rollDiceExpr } from "./dice.js";
import { toast } from "./toast.jsx";

const SCHOOL_RU = {
  abj: "Ограждение", con: "Очарование", div: "Прорицание", enc: "Воплощение",
  evo: "Возбуждение", ill: "Иллюзия", nec: "Некромантия", tra: "Преобразование",
};
const ABIL_RU = { int: "ИНТ", wis: "МУД", cha: "ХАР", str: "СИЛ", dex: "ЛОВ", con: "ТЕЛ" };
const CLASS_RU = {
  artificer: "изобретатель", bard: "бард", barbarian: "варвар", cleric: "жрец", druid: "друид",
  fighter: "воин", monk: "монах", paladin: "паладин", ranger: "следопыт", rogue: "плут",
  sorcerer: "чародей", warlock: "колдун", wizard: "волшебник",
};
const SLOT_LEVELS = [1, 2, 3, 4, 5, 6, 7, 8, 9];

/* ================= Вкладка «Заклинания» ================= */
export default function SpellsTab({ c, onSave, ui = {} }) {
  const d = c.data;
  const prepared = (c.spells && c.spells.prepared) || [];
  const book = (c.spells && c.spells.book) || [];
  const slots = d.spells || {};

  const cast = spellCasting(c);
  const abil = cast.abil, abilMod = cast.mod;
  const dc = cast.dc, atk = cast.atk;
  const charLevel = levelOf(c);

  const [filter, setFilter] = useState("all");     // all | 0 | 1 | 2 ... | conc
  const [modal, setModal] = useState(null);         // {id}
  const [prep, setPrep] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [filters, setFilters] = useState(emptyFilters());
  const [showCast, setShowCast] = useState(false);
  const [castLevel, setCastLevel] = useState(null);   // выбранный уровень ячейки

  const spells = useMemo(() => {
    return prepared.map(id => {
      const s = SPELL_BY_ID.get(id);
      if (!s) {
        return { id, slug: null, name: "Заклинание (нет в справочнике)", level: "?", school: "", desc: "" };
      }
      return { ...s, _charSpellId: id };
    }).sort((a, b) => (a.level === "?" ? 99 : a.level) - (b.level === "?" ? 99 : b.level)
      || a.name.localeCompare(b.name, "ru"));
  }, [prepared.join(","), c]);

  const levels = useMemo(() => {
    const set = new Set(spells.filter(s => s.level !== "?").map(s => s.level));
    set.add(0);
    return [...set].sort((a, b) => a - b);
  }, [spells]);

  const shown = spells.filter(s => {
    if (castLevel !== null && s.level !== "?" && s.level > castLevel) return false;
    if (filter === "save") { if (s.mode !== "save") return false; }
    else if (filter === "attack") { if (s.mode !== "attack") return false; }
    else if (filter === "conc") { if (!s.conc) return false; }
    else if (filter === "other") { if (s.level !== "?") return false; }
    else if (filter !== "all" && String(s.level) !== String(filter)) return false;
    return spellMatches(s, filters);
  });

  const groups = [];
  for (const lv of levels) {
    const list = shown.filter(s => s.level === lv);
    if (!list.length) continue;
    groups.push({ lv, list, title: lv === 0 ? "Заговоры" : `${lv}-й уровень` });
  }
  const others = shown.filter(s => s.level === "?");
  if (others.length) groups.push({ lv: "?", list: others, title: "Прочее" });

  const isPrepared = (spell) => {
    if (!spell) return false;
    const matchKeys = [spell.id, spell.slug, spell._charSpellId, ...(spell.aliases || [])]
      .filter(Boolean)
      .map(x => String(x).toLowerCase());
    return prepared.some(p => matchKeys.includes(String(p).toLowerCase()));
  };

  const togglePrepared = (idOrSpell) => {
    const spell = typeof idOrSpell === "object" ? idOrSpell : SPELL_BY_ID.get(idOrSpell);
    const targetId = typeof idOrSpell === "string" ? idOrSpell : (spell?._charSpellId || spell?.id || spell?.slug);
    const matchKeys = [targetId, spell?.id, spell?.slug, spell?._charSpellId, ...(spell?.aliases || [])]
      .filter(Boolean)
      .map(x => String(x).toLowerCase());
    c.spells ||= {};
    c.spells.prepared ||= [];
    const arr = c.spells.prepared;
    const existingIndex = arr.findIndex(x => matchKeys.includes(String(x).toLowerCase()));
    if (existingIndex >= 0) {
      arr.splice(existingIndex, 1);
      if (c.spells.book) {
        const bi = c.spells.book.findIndex(x => matchKeys.includes(String(x).toLowerCase()));
        if (bi >= 0) c.spells.book.splice(bi, 1);
      }
    } else {
      arr.push(targetId);
    }
    onSave();
  };

  const removePrepared = (idOrSpell) => {
    const spell = typeof idOrSpell === "object" ? idOrSpell : SPELL_BY_ID.get(idOrSpell);
    const removeKeys = [
      typeof idOrSpell === "string" ? idOrSpell : null,
      spell?.id, spell?.slug, spell?._charSpellId, ...(spell?.aliases || [])
    ].filter(Boolean).map(x => String(x).toLowerCase());

    c.spells ||= {};
    c.spells.prepared = (c.spells.prepared || []).filter(x => !removeKeys.includes(String(x).toLowerCase()));
    if (c.spells.book) {
      c.spells.book = (c.spells.book || []).filter(x => !removeKeys.includes(String(x).toLowerCase()));
    }
    onSave();
    setModal(null);
  };

  const slotInfo = (lv) => {
    const key = "slots-" + lv;
    const s = slots[key];
    if (!s) return null;
    return { total: s.value || 0, used: s.filled || 0 };
  };

  /* наложение: тратит ячейку выбранного уровня и бросает урон / эффект (с учётом «улучшения») */
  const castSpell = (e, spell, useLevel, up = 0) => {
    if (e && e.stopPropagation) e.stopPropagation();

    // 1. Трата ячейки (если ячейки настроены в чарнике)
    if (spell.level > 0) {
      const key = "slots-" + useLevel;
      const s = (c.data.spells ||= {})[key] || { value: 0, filled: 0 };
      const maxSlots = s.value ?? 0;
      const filledSlots = s.filled ?? 0;

      if (maxSlots > 0 && filledSlots >= maxSlots) {
        toast(`Все ячейки ${useLevel}-го уровня израсходованы!`, "err");
      } else if (maxSlots > 0) {
        s.filled = filledSlots + 1;
        c.data.spells[key] = s;
        onSave();
      }
    }

    // 2. Кубики урона или лечения
    let dmg = spell.dmg && spell.dmg.length ? spell.dmg : null;
    let kind = "урон";
    let rolls = [];
    let total = 0;
    const subParts = [];

    // Точный скейлинг заклинания по уровню ячейки (из таблицы diceByLevel или кастомного правила)
    const scaledFormula = getSpellDiceForLevel(spell, useLevel, charLevel);

    if (scaledFormula) {
      const type = (spell.dmg && spell.dmg.length) ? spell.dmg[0].t : (spell.school || "эффект");
      const isHeal = /восстанавливает|лечен|хит/i.test(spell.desc || "") || /лечение/i.test(type);
      kind = isHeal ? "лечение" : "урон";
      const res = rollDiceExpr(scaledFormula);
      if (res) {
        total = res.total;
        const faces = +(String(scaledFormula).match(/[dкк](\d+)/i)?.[1] || 20);
        const cleanExpr = String(scaledFormula).trim().replace(/d/i, "к");
        rolls.push({ expr: cleanExpr, faces, value: res.total, parts: res.raw });
      }
      subParts.push(type);
    } else {
      // Если в dmg пусто, ищем формулу кубиков в описании (например 1к8 в «Лечение ран», 6к10 в «Стена клинков»)
      if (!dmg || !dmg.length) {
        const descMatch = String(spell.desc || "").match(/(\d+)[dкк](\d+)/i);
        if (descMatch) {
          const isHeal = /восстанавливает|лечен|хит/i.test(spell.desc || "");
          kind = isHeal ? "лечение" : "урон";
          const baseDice = `${descMatch[1]}к${descMatch[2]}`;
          dmg = [{ d: baseDice, t: isHeal ? "лечение" : (spell.school || "эффект") }];
        }
      }

      if (dmg && dmg.length) {
        for (const part of dmg) {
          const expr = upcastDice(part.d, up);
          const res = rollDiceExpr(expr);
          if (!res) continue;
          total += res.total;
          const faces = +(String(expr).match(/[dкк](\d+)/i)?.[1] || 20);
          const cleanExpr = String(expr).trim().replace(/d/i, "к");
          rolls.push({ expr: cleanExpr, faces, value: res.total, parts: res.raw });
        }
        subParts.push(dmg.map(x => x.t).filter(Boolean).join(", "));
      }
    }

    // Прибавление модификатора базовой характеристики (например +ХАР для Барда/Чародея, +МУД для Жреца)
    let appliedMod = 0;
    let appliedModLabel = "";
    if (rolls.length > 0 && spellAddsAbilityMod(spell) && abilMod) {
      appliedMod = abilMod;
      appliedModLabel = ABIL_RU[abil] || "ХАР";
      total += appliedMod;
      subParts.push(appliedMod > 0 ? `+${appliedMod} ${appliedModLabel}` : `${appliedMod} ${appliedModLabel}`);
    }

    // Уровень наложения
    const lvlText = spell.level === 0 ? "заговор" : `ячейка ${useLevel} ур.`;
    subParts.push(lvlText);

    // Спасбросок или бонус атаки
    if (spell.mode === "save") {
      subParts.push(`Сл ${dc}${spell.saveAbility ? " " + (ABIL_RU[spell.saveAbility] || "") : ""}`);
    } else if (spell.mode === "attack") {
      subParts.push(`Атака ${atk >= 0 ? "+" + atk : atk}`);
    }

    // Если кубиков нет — это вспомогательное/защитное заклинание (бафф, утилита)
    if (!rolls.length) {
      kind = "заклинание";
      total = "Сотворено";
      if (spell.time) subParts.push(spell.time);
      if (spell.range) subParts.push(spell.range);
    }

    const sub = subParts.filter(Boolean).join(" · ");

    window.__rollSpell(spell.name, total, sub, rolls, {
      kind,
      spellData: spell,
      mod: appliedMod,
      modLabel: appliedModLabel
    });
  };

  return (
    <>
      <div className="sp-head">
        {ui.showDC === false ? null : (
          <div className="sp-stat" title="Сложность спасброска = 8 + бонус мастерства + модификатор заклинательной характеристики">
            <b>{dc}</b><small>СПАСБРОСОК {ABIL_RU[abil]}</small>
          </div>
        )}
        {ui.showAtk === false ? null : (
          <div className="sp-stat" title="Бонус атаки заклинанием = бонус мастерства + модификатор заклинательной характеристики"
            onClick={() => window.__rollD20("Атака заклинанием", atk)}>
            <b>{atk >= 0 ? "+" + atk : atk}</b><small>АТАКА</small>
          </div>
        )}
        <div className="sp-stat" title="Заклинательная характеристика"><small>ХАРАКТЕРИСТИКА</small><b>{ABIL_RU[abil]}</b></div>
        <div className="sp-head-btns">
          <button className={"sp-btn" + (showCast ? " on" : "")} onClick={() => setShowCast(v => !v)}
            title="настройки заклинаний">⚙ Настройки заклинаний</button>
          <button className="sp-btn" onClick={() => setPrep(true)}>Подготовить заклинания</button>
        </div>
      </div>

      {showCast ? (
        <div className="sp-cast-set">
          <div className="f-label">ЗАКЛИНАТЕЛЬНАЯ ХАРАКТЕРИСТИКА</div>
          <CustomSelect value={abil} onChange={e => {
            const d = c.data;
            d.spellsInfo = d.spellsInfo || {};
            d.spellsInfo.base = d.spellsInfo.base || { name: "base", value: "" };
            d.spellsInfo.base.code = e.target.value;
            onSave();
          }}>
            <option value="int">Интеллект</option>
            <option value="wis">Мудрость</option>
            <option value="cha">Харизма</option>
          </CustomSelect>
          <div className="sp-cast-set-row">
            <label className="pop-field">Сл спасброска
              <input type="number" className="edit-in" defaultValue={cast.saveCustom}
                onKeyDown={e => { if (e.key === "Enter") { c.data.spellsInfo.save.customModifier = +e.target.value || 0; onSave(); } }}
                onBlur={e => { c.data.spellsInfo.save.customModifier = +e.target.value || 0; onSave(); }} />
            </label>
            <label className="pop-field">Бонус атаки
              <input type="number" className="edit-in" defaultValue={cast.modCustom}
                onKeyDown={e => { if (e.key === "Enter") { c.data.spellsInfo.mod.customModifier = +e.target.value || 0; onSave(); } }}
                onBlur={e => { c.data.spellsInfo.mod.customModifier = +e.target.value || 0; onSave(); }} />
            </label>
          </div>
          <div className="f-hint">
            Сл = 8 + {cast.prof} (бонус мастерства) + {cast.mod >= 0 ? "+" + cast.mod : cast.mod} ({ABIL_RU[abil]})
            {cast.saveCustom ? ` + ${cast.saveCustom} (своё)` : ""} = <b>{dc}</b><br />
            Атака = {cast.prof} + {cast.mod >= 0 ? "+" + cast.mod : cast.mod}
            {cast.modCustom ? ` + ${cast.modCustom} (своё)` : ""} = <b>{atk >= 0 ? "+" + atk : atk}</b>
          </div>
          <div className="f-label f-sep">ЯЧЕЙКИ ЗАКЛИНАНИЙ ПО УРОВНЯМ</div>
          <div className="sp-slots-head">
            <span>уровень</span><span>всего</span><span>доступно</span>
          </div>
          <div className="sp-slots-grid">
            {SLOT_LEVELS.map(lv => {
              const s = slots["slots-" + lv] || { value: 0, filled: 0 };
              const total = s.value ?? 0;
              const avail = Math.max(0, total - (s.filled ?? 0));
              const setVal = (patch) => {
                const d = c.data;
                d.spells = d.spells || {};
                const key = "slots-" + lv;
                const cur = d.spells[key] || { value: 0, filled: 0 };
                d.spells[key] = { ...cur, ...patch };
                onSave();
              };
              return (
                <div key={lv} className="sp-slot-cell">
                  <div className="f-label">{lv}-й</div>
                  <input type="number" min="0" className="edit-in" title="всего ячеек этого уровня"
                    value={total}
                    onChange={e => setVal({ value: Math.max(0, +e.target.value || 0) })} />
                  <input type="number" min="0" className="edit-in" title="сколько ячеек доступно сейчас"
                    value={avail}
                    onChange={e => {
                      const want = Math.max(0, +e.target.value || 0);
                      setVal({ filled: Math.max(0, total - want) });
                    }} />
                </div>
              );
            })}
          </div>
          <div className="f-hint">Слева — уровень, по центру сколько ячеек всего, справа сколько
            доступно **сейчас** (можно править вручную; при наложении значение уменьшается на 1).</div>
        </div>
      ) : null}

      <div className="sp-slot-choose">
        <span className="f-label">ЯЧЕЙКА ДЛЯ НАЛОЖЕНИЯ</span>
        <div className="sp-radios">
          <label className={"sp-radio" + (castLevel === null ? " on" : "")}>
            <input type="radio" checked={castLevel === null} onChange={() => setCastLevel(null)} />
            <span>Все</span>
          </label>
          {SLOT_LEVELS.map(lv => {
            const si = slotInfo(lv);
            if (!si && !spells.some(s => s.level === lv)) return null;
            return (
              <label key={lv} className={"sp-radio" + (castLevel === lv ? " on" : "")}
                title={si ? `ячеек ${si.total}, потрачено ${si.used}` : "нет ячеек этого уровня"}>
                <input type="radio" checked={castLevel === lv} onChange={() => setCastLevel(lv)} />
                <span>{lv}</span>
                {si ? <span className="sp-radio-cnt">{si.total - si.used}/{si.total}</span> : null}
              </label>
            );
          })}
        </div>
        {castLevel !== null ? (
          <div className="f-hint">
            Накладываем ячейкой {castLevel}-го уровня: заклинания ниже уровня усиливаются по правилам справочника (точный скейлинг костей урона и эффектов).
          </div>
        ) : null}
      </div>

      <div className="sp-filters">
        <button className={"sp-filter" + (filter === "all" ? " on" : "")} onClick={() => setFilter("all")}>Все</button>
        {levels.map(lv => (
          <button key={lv} className={"sp-filter" + (String(filter) === String(lv) ? " on" : "")}
            onClick={() => setFilter(lv)}>{lv}</button>
        ))}
        <button className={"sp-filter" + (filter === "conc" ? " on" : "")} onClick={() => setFilter(filter === "conc" ? "all" : "conc")}
          title="заклинания с концентрацией">К</button>
        <button className={"sp-filter" + (filter === "save" ? " on" : "")} onClick={() => setFilter(filter === "save" ? "all" : "save")}
          title="заклинания, требующие спасброска">С</button>
        <button className={"sp-filter" + (filter === "attack" ? " on" : "")} onClick={() => setFilter(filter === "attack" ? "all" : "attack")}
          title="заклинания с броском атаки">А</button>
        {spells.some(s => s.level === "?") ? (
          <button className={"sp-filter" + (filter === "other" ? " on" : "")} onClick={() => setFilter("other")}>?</button>
        ) : null}
        <button className={"sp-filter gear" + (showFilters ? " on" : "")} onClick={() => setShowFilters(v => !v)}
          title="фильтры как на dnd.su">☰ фильтры</button>
        {showFilters ? (
          <div className="sp-filters-panel">
            <SpellFilters value={filters} onChange={setFilters} levels={levels} />
          </div>
        ) : null}
      </div>

      {groups.map(g => {
        const sl = slotInfo(g.lv);
        return (
          <div className="sp-group" key={g.lv}>
            <div className="sp-group-head">
              <span className="sp-group-title">{g.title}</span>
              <div className="sp-legend">
                <span title="Время наложения"><ClockIcon /></span>
                <span title="Дистанция"><ScrollIcon /></span>
                <span title="Бросок атаки / спасбросок"><SwordsIcon /></span>
                <span title="Урон"><Die20Icon /></span>
              </div>
              {sl ? (
                <span className="sp-slots" title="Ячейки заклинаний">
                  {sl.used}/{sl.total}
                </span>
              ) : null}
            </div>
            {g.list.map(s => (
              <SpellRow key={s.id || s._charSpellId} spell={s} dc={dc} atk={atk} onOpen={() => setModal(s)}
                castLevel={castLevel} onCast={castSpell} onRemove={removePrepared}
                abilMod={abilMod} abilLabel={ABIL_RU[abil] || "ХАР"} charLevel={charLevel} />
            ))}
          </div>
        );
      })}

      {!spells.length ? <div className="sp-empty">Нет подготовленных заклинаний. Нажмите «Подготовить заклинания».</div> : null}

      {modal ? (
        <SpellModal
          spell={modal}
          dc={dc}
          atk={atk}
          onClose={() => setModal(null)}
          onToggle={() => togglePrepared(modal)}
          onRemove={() => removePrepared(modal)}
          prepared={isPrepared(modal)}
          castLevel={castLevel}
          onCast={castSpell}
          slotInfo={slotInfo}
          abilMod={abilMod}
          abilLabel={ABIL_RU[abil] || "ХАР"}
          charLevel={charLevel}
        />
      ) : null}
      {prep ? <PrepareModal c={c} onSave={onSave} onClose={() => setPrep(false)} /> : null}
    </>
  );
}

/* ================= Строка заклинания ================= */
function SpellRow({ spell, dc, atk, onOpen, castLevel, onCast, onRemove, abilMod, abilLabel, charLevel = 1 }) {
  const s = spell;

  if (s.level === "?") {
    return (
      <div className="sp-row sp-row-unknown" onClick={onOpen}>
        <div className="sp-row-main">
          <div className="sp-row-name" style={{ color: "var(--red)" }}>
            {s.name}
            <span className="sp-badge err" title={`ID: ${s.id}`}>нет в базе</span>
          </div>
          <div className="sp-row-sub" style={{ fontFamily: "Consolas, monospace", fontSize: "11px", opacity: 0.75 }}>
            ID: {s.id}
          </div>
        </div>
        <div className="sp-row-info">
          <span className="sp-info">—</span>
          <span className="sp-info">—</span>
          <span className="sp-info">—</span>
          <span className="sp-info">—</span>
        </div>
        <button
          className="sp-remove-btn"
          title="Удалить из подготовленных"
          onClick={(e) => {
            e.stopPropagation();
            onRemove(s.id);
          }}
        >
          ✕
        </button>
      </div>
    );
  }

  const dmg = s.dmg && s.dmg.length ? s.dmg : null;
  const useLevel = castLevel !== null && castLevel >= s.level ? castLevel : s.level;
  // заговоры ячейками не усиливаются (только особые умения классов)
  const up = s.level > 0 ? useLevel - s.level : 0;
  const scaled = getSpellDiceForLevel(s, useLevel, charLevel);
  const baseDmg = scaled || (dmg ? dmg.map(x => upcastDice(x.d, up)).join(" + ") : null);
  const addsMod = spellAddsAbilityMod(s) && abilMod;
  const modSuffix = addsMod ? (abilMod > 0 ? ` + ${abilMod}` : ` - ${Math.abs(abilMod)}`) : "";
  const dmgText = baseDmg ? `${baseDmg}${modSuffix}` : "—";

  const info = [];
  info.push(s.shortTime || "—");
  info.push(s.range || "—");
  info.push(
    s.mode === "save"
      ? <span className="sp-save" title={`Спасбросок ${s.saveAbility ? ABIL_RU[s.saveAbility] : ""} · сложность ${dc}`}>
          Сл {dc}{s.saveAbility ? " " + ABIL_RU[s.saveAbility] : ""}
        </span>
      : s.mode === "attack"
        ? <span className="sp-atk" title={`Бонус атаки ${atk}`}>Лоб {atk}</span>
        : "—"
  );
  info.push(dmgText);

  return (
    <div className="sp-row" onClick={onOpen}>
      <div className="sp-row-main">
        <div className="sp-row-name">
          {s.name}
          {s.ritual ? <span className="sp-badge" title="Ритуал">Р</span> : null}
          {s.conc ? <span className="sp-badge" title="Концентрация">К</span> : null}
          {up > 0 ? <span className="sp-badge up" title={`Наложено ячейкой ${useLevel} уровня`}>+{up}</span> : null}
        </div>
        <div className="sp-row-sub">{s.level === 0 ? "Заговор" : s.level === "?" ? "—" : `${s.level}-й уровень`}</div>
      </div>
      <div className="sp-row-info">
        {info.map((v, i) => <span key={i} className="sp-info">{v}</span>)}
      </div>
      <button className="sp-cast" title="наложить" onClick={e => onCast(e, s, useLevel, up)}>
        <CastIcon />
      </button>
    </div>
  );
}

/* +1 кость урона за каждый уровень «улучшения» */
export function upcastDice(dice, up) {
  if (!up || up <= 0) return dice;
  const m = String(dice).match(/^(\d*)([dкк])(\d+)$/i);
  if (!m) return dice;
  return `${(+m[1] || 1) + up}${m[2]}${m[3]}`;
}

/* Точная формула кубиков заклинания для заданного уровня ячейки */
export function getSpellDiceForLevel(spell, level, charLevel = 1) {
  if (!spell) return null;
  if (spell.level === 0) {
    const baseDmg = spell.dmg && spell.dmg.length ? spell.dmg[0].d : null;
    if (!baseDmg) return null;
    // Скейлинг заговоров по уровню персонажа (5-й ур: 2 кости, 11-й ур: 3 кости, 17-й ур: 4 кости)
    const m = String(baseDmg).match(/^(\d*)([dкк])(\d+)$/i);
    if (!m) return baseDmg;
    let mult = 1;
    if (charLevel >= 17) mult = 4;
    else if (charLevel >= 11) mult = 3;
    else if (charLevel >= 5) mult = 2;
    const baseCount = +m[1] || 1;
    return `${baseCount * mult}${m[2]}${m[3]}`;
  }
  const targetLevel = level !== undefined && level !== null ? level : spell.level;
  if (spell.diceByLevel && spell.diceByLevel[targetLevel]) {
    return spell.diceByLevel[targetLevel];
  }
  const dmg = spell.dmg && spell.dmg.length ? spell.dmg[0].d : null;
  if (!dmg) return null;
  const up = spell.level > 0 ? Math.max(0, targetLevel - spell.level) : 0;
  return upcastDice(dmg, up);
}

/* Проверяет, прибавляется ли модификатор базовой характеристики к эффекту заклинания */
export function spellAddsAbilityMod(spell) {
  if (!spell) return false;
  if (spell.addMod !== undefined) return !!spell.addMod;
  const desc = spell.desc || "";
  return /\+\s*(?:ваш\s+)?модификатор\s+(?:вашей\s+)?базовой\s+характеристики/i.test(desc)
    || (/модификатор\s+(?:вашей\s+)?базовой\s+характеристики/i.test(desc) && /восстанавливает|хит/i.test(desc));
}

/* ================= Карточка заклинания ================= */
function SpellModal({ spell, dc, atk, onClose, onToggle, onRemove, prepared, castLevel, onCast, slotInfo, abilMod, abilLabel, charLevel = 1 }) {
  const s = spell;
  if (!s) return null;

  const [modalLevel, setModalLevel] = useState(() => {
    if (castLevel !== null && castLevel >= s.level) return castLevel;
    return s.level > 0 ? s.level : 0;
  });

  if (s.level === "?") {
    return (
      <div className="modal-back" onMouseDown={onClose}>
        <div className="modal sp-modal" onMouseDown={e => e.stopPropagation()}>
          <button className="modal-x" onClick={onClose}>×</button>
          <h3 className="modal-title sp-modal-title" style={{ color: "var(--red)" }}>
            Заклинание отсутствует в справочнике
          </h3>
          <div className="sp-modal-sub" style={{ fontFamily: "Consolas, monospace", fontSize: "11px", opacity: 0.8 }}>
            ID в файле персонажа: {s.id}
          </div>
          <div className="sp-desc" style={{ marginTop: 14 }}>
            <p style={{ color: "var(--text)" }}>
              Это заклинание было сохранено в массиве персонажа при экспорте из внешнего источника (например, из Long Story Short или редакции D&D 2024), но его описания и параметров нет в локальном автономном справочнике SRD 5e.
            </p>
            <p className="hint">
              Вы можете удалить эту пустую запись из листа персонажа в один клик, чтобы очистить секцию «Прочее», либо заменить её на заклинание через кнопку «Подготовить заклинания».
            </p>
          </div>
          <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
            <button
              className="modal-btn"
              style={{ background: "rgba(250,82,82,.15)", borderColor: "var(--red)", color: "var(--red)", fontWeight: 800 }}
              onClick={() => {
                onRemove(s.id);
                onClose();
              }}
            >
              🗑 Удалить из листа персонажа
            </button>
            <button className="modal-btn" onClick={onClose}>
              Закрыть
            </button>
          </div>
        </div>
      </div>
    );
  }

  const effectiveLevel = s.level > 0 ? modalLevel : 0;
  const up = s.level > 0 ? Math.max(0, effectiveLevel - s.level) : 0;
  const currentDice = getSpellDiceForLevel(s, effectiveLevel, charLevel);

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal sp-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>
        <h3 className="modal-title sp-modal-title">{s.name}</h3>
        <div className="sp-modal-sub">
          {s.level === 0 ? "Заговор" : s.level === "?" ? "" : `${s.level}-й уровень`}
          {s.school ? `, ${s.school}` : ""}
        </div>
        <div className="sp-props">
          {s.time ? <div><span>Время сотворения:</span> {s.time}</div> : null}
          {s.range ? <div><span>Дистанция:</span> {s.range}</div> : null}
          {s.comp && s.comp.length ? <div><span>Компоненты:</span> {s.comp.map(compName).join(", ")}</div> : null}
          {s.mat ? <div><span>Материальный компонент:</span> {s.mat}</div> : null}
          {s.dur ? <div><span>Длительность:</span> {s.dur}</div> : null}
          {s.mode === "save" ? (
            <div><span>Спасбросок:</span> {s.saveAbility ? ABIL_RU[s.saveAbility] : "—"} · <span>Сложность:</span> <b>{dc}</b></div>
          ) : null}
          {s.mode === "attack" ? <div><span>Бонус атаки:</span> {atk >= 0 ? "+" + atk : atk}</div> : null}
          {currentDice ? (
            <div>
              <span>{/восстанавливает|лечен|хит/i.test(s.desc || "") || /хиты|лечение/i.test(s.dmg?.[0]?.t || "") ? "Эффект / Лечение:" : "Урон:"}</span>{" "}
              <b style={{ color: "var(--accent, #6366f1)" }}>
                {currentDice}
                {spellAddsAbilityMod(s) && abilMod ? (abilMod > 0 ? ` + ${abilMod}` : ` - ${Math.abs(abilMod)}`) : ""}
              </b>
              {spellAddsAbilityMod(s) && abilMod ? (
                <span style={{ opacity: 0.85, fontSize: 12, marginLeft: 4 }}>({abilLabel || "ХАР"})</span>
              ) : null}
              {s.dmg && s.dmg[0] && s.dmg[0].t ? ` (${s.dmg[0].t})` : ""}
              {up > 0 ? <span className="sp-badge up" style={{ marginLeft: 6 }}>ячейка {effectiveLevel}-го ур.</span> : null}
            </div>
          ) : s.dmg && s.dmg.length ? (
            <div>
              <span>Урон:</span> {s.dmg.map(x => `${upcastDice(x.d, up)} ${x.t || ""}`).join(" + ")}
              {spellAddsAbilityMod(s) && abilMod ? (abilMod > 0 ? ` + ${abilMod}` : ` - ${Math.abs(abilMod)}`) : ""}
              {spellAddsAbilityMod(s) && abilMod ? <span style={{ opacity: 0.85, fontSize: 12, marginLeft: 4 }}>({abilLabel || "ХАР"})</span> : null}
            </div>
          ) : null}
        </div>

        {s.level > 0 ? (
          <div style={{ marginTop: 14, marginBottom: 8, padding: "8px 12px", background: "var(--card-sub, rgba(255,255,255,0.03))", borderRadius: 8, border: "1px solid var(--border)" }}>
            <div style={{ fontSize: 12, fontWeight: 700, marginBottom: 6, color: "var(--muted)" }}>
              Уровень ячейки для сотворения:
            </div>
            <div style={{ display: "flex", gap: 6, flexWrap: "wrap", alignItems: "center" }}>
              {SLOT_LEVELS.filter(lv => lv >= s.level).map(lv => {
                const si = slotInfo ? slotInfo(lv) : null;
                const isSelected = effectiveLevel === lv;
                return (
                  <button
                    key={lv}
                    type="button"
                    className={"sp-radio" + (isSelected ? " on" : "")}
                    style={{
                      cursor: "pointer",
                      padding: "4px 8px",
                      borderRadius: 6,
                      border: isSelected ? "1px solid var(--accent, #6366f1)" : "1px solid var(--border)",
                      background: isSelected ? "var(--accent-glow, rgba(99,102,241,0.2))" : "transparent",
                      color: isSelected ? "var(--accent, #6366f1)" : "var(--text)",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 4,
                      fontSize: 12
                    }}
                    onClick={() => setModalLevel(lv)}
                    title={si ? `Ячеек: ${si.total - si.used}/${si.total}` : "Ячейка " + lv + " уровня"}
                  >
                    <b>{lv} ур.</b>
                    {si ? <span style={{ opacity: 0.7, fontSize: 10 }}>({si.total - si.used})</span> : null}
                  </button>
                );
              })}
            </div>
          </div>
        ) : null}

        {s.conc ? <div className="sp-modal-note">Концентрация</div> : null}
        {s.ritual ? <div className="sp-modal-note">Ритуал</div> : null}
        <div className="sp-desc">{s.desc ? s.desc.split("\n").map((p, i) => <p key={i}>{p}</p>) : <p className="hint">Нет описания</p>}</div>
        {s.classes && s.classes.length ? (
          <div className="sp-modal-note">
            Доступно классам: {s.classes.map(x => CLASS_RU[x] || x).join(", ")}
          </div>
        ) : null}
        <div style={{ display: "flex", gap: 10, marginTop: 16 }}>
          <button className="modal-btn" onClick={() => { onToggle(); onClose(); }}>
            {prepared ? "Убрать из подготовленных" : "Подготовить"}
          </button>
          {onCast ? (
            <button className="modal-btn primary" onClick={(e) => { onCast(e, s, effectiveLevel, up); onClose(); }}>
              Наложить {effectiveLevel > 0 ? `(${effectiveLevel}-й ур.)` : ""}
            </button>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ================= Подготовка заклинаний ================= */
function PrepareModal({ c, onSave, onClose }) {
  const [q, setQ] = useState("");
  const [lv, setLv] = useState("all");
  const [prepList, setPrepList] = useState(() => [...((c.spells && c.spells.prepared) || [])]);
  const book = (c.spells && c.spells.book) || [];

  const cls = (c.data.info && c.data.info.charClass && c.data.info.charClass.value) || "";
  const clsKey = Object.keys(CLASS_RU).find(k => CLASS_RU[k] === cls.toLowerCase())
    || Object.keys(CLASS_RU).find(k => cls.toLowerCase().includes(CLASS_RU[k]));
  // по умолчанию — класс персонажа, но можно выбрать любые
  const [filters, setFilters] = useState(() => ({ ...emptyFilters(), classes: clsKey ? [clsKey] : [] }));

  const pool = useMemo(() => {
    const all = [...SPELL_BY_ID.values(), ...SPELL_BY_SLUG.values()];
    const uniq = new Map();
    for (const s of all) if (s.id) uniq.set(s.id, s);
    return [...uniq.values()];
  }, []);

  // Неизвестные ID, которые сохранены в персонаже, но отсутствуют в справочнике
  const unknownIds = useMemo(() => {
    return prepList.filter(id => !SPELL_BY_ID.has(id));
  }, [prepList]);

  const clearAllUnknown = () => {
    c.spells ||= {};
    c.spells.prepared = (c.spells.prepared || []).filter(id => SPELL_BY_ID.has(id));
    if (c.spells.book) {
      c.spells.book = (c.spells.book || []).filter(id => SPELL_BY_ID.has(id));
    }
    setPrepList([...c.spells.prepared]);
    onSave();
  };

  const list = pool.filter(s => {
    if (lv !== "all" && String(s.level) !== lv) return false;
    if (q && !s.name.toLowerCase().includes(q.toLowerCase())) return false;
    return spellMatches(s, filters);
  }).sort((a, b) => a.level - b.level || a.name.localeCompare(b.name, "ru"));

  const toggle = (id) => {
    c.spells ||= {};
    c.spells.prepared ||= [];
    const arr = c.spells.prepared;
    const spell = SPELL_BY_ID.get(id);
    const matchKeys = [id, spell?.id, spell?.slug, ...(spell?.aliases || [])]
      .filter(Boolean)
      .map(x => String(x).toLowerCase());
    const existingIndex = arr.findIndex(x => matchKeys.includes(String(x).toLowerCase()));
    if (existingIndex >= 0) {
      arr.splice(existingIndex, 1);
      if (c.spells.book) {
        const bi = c.spells.book.findIndex(x => matchKeys.includes(String(x).toLowerCase()));
        if (bi >= 0) c.spells.book.splice(bi, 1);
      }
    } else {
      arr.push(id);
    }
    setPrepList([...arr]);
    onSave();
  };

  const levels = [...new Set(pool.map(s => s.level))].sort((a, b) => a - b);

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal sp-prep" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>
        <h3 className="modal-title">Подготовить заклинания</h3>
        {unknownIds.length > 0 && (
          <div className="sp-prep-unknown-banner">
            <span>В листе есть неизвестные заклинания ({unknownIds.length})</span>
            <button type="button" className="sp-prep-clean-btn" onClick={clearAllUnknown}>
              🗑 Очистить из листа
            </button>
          </div>
        )}
        <div className="sp-prep-tools">
          <input className="f-input" placeholder="Поиск…" value={q} onChange={e => setQ(e.target.value)} />
          <CustomSelect value={lv} onChange={e => setLv(e.target.value)}>
            <option value="all">Все уровни</option>
            {levels.map(l => <option key={l} value={l}>{l === 0 ? "Заговоры" : l + "-й уровень"}</option>)}
          </CustomSelect>
          <CustomSelect value={(filters.classes || []).length === 1 ? filters.classes[0] : ""}
            onChange={e => setFilters({ ...filters, classes: e.target.value ? [e.target.value] : [] })}>
            <option value="">{filters.classes && filters.classes.length > 1 ? `Выбрано: ${filters.classes.length}` : "Все классы"}</option>
            {Object.entries(CLASS_RU).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </CustomSelect>
        </div>
        <SpellFilters value={filters} onChange={setFilters} levels={levels} showLevels={false} />
        <div className="sp-prep-list">
          {unknownIds.map(id => (
            <div
              key={id}
              className="sp-prep-item on"
              style={{ borderLeft: "3px solid var(--red)" }}
              onClick={() => toggle(id)}
              title="Нажмите, чтобы снять подготовку и удалить из листа"
            >
              <div className="sp-prep-left">
                <span className="sp-prep-cb checked" style={{ background: "var(--red)", borderColor: "var(--red)" }}>
                  <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                  </svg>
                </span>
                <span className="sp-prep-name" style={{ color: "var(--red)" }}>
                  Заклинание (нет в справочнике) [{id.slice(0, 8)}…]
                </span>
              </div>
              <div className="sp-prep-right">
                <span className="sp-prep-badge" style={{ background: "var(--red)", color: "#fff" }}>?</span>
              </div>
            </div>
          ))}
          {list.map(s => {
            const matchKeys = [s.id, s.slug, ...(s.aliases || [])].filter(Boolean).map(x => String(x).toLowerCase());
            const isPrep = prepList.some(p => matchKeys.includes(String(p).toLowerCase()));
            return (
              <div
                key={s.id}
                className={"sp-prep-item" + (isPrep ? " on" : "")}
                onClick={() => toggle(s.id)}
              >
                <div className="sp-prep-left">
                  <span className={"sp-prep-cb" + (isPrep ? " checked" : "")}>
                    {isPrep ? (
                      <svg viewBox="0 0 16 16" width="11" height="11" fill="none" stroke="#fff" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                        <polyline points="3.5 8.5 6.5 11.5 12.5 4.5" />
                      </svg>
                    ) : null}
                  </span>
                  <span className="sp-prep-name">{s.name}</span>
                </div>
                <div className="sp-prep-right">
                  {s.conc ? (
                    <span className="sp-prep-badge conc" title="Концентрация">к</span>
                  ) : s.ritual ? (
                    <span className="sp-prep-badge rit" title="Ритуал">р</span>
                  ) : null}
                  <span className="sp-prep-lv">{s.level === 0 ? "заг" : s.level}</span>
                </div>
              </div>
            );
          })}
          {!list.length ? <div className="hint">Ничего не найдено</div> : null}
        </div>
        <div className="sp-prep-foot">
          Подготовлено: {prepList.length} · В книге: {book.length}
        </div>
        <button className="modal-btn primary" onClick={onClose}>Готово</button>
      </div>
    </div>
  );
}

const compName = (c) => ({ v: "вербальный", s: "соматический", m: "материальный" }[c] || c);

/* ================= Иконки ================= */
const ClockIcon = () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M5 2h10M5 18h10M6 2c0 3 3 3 4 8 1-5 4-5 4-8M6 18c0-3 3-3 4-8 1 5 4 5 4 8" /></svg>;
const ScrollIcon = () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3"><rect x="3" y="4" width="14" height="12" rx="1.5" /><path d="M6 8h8M6 11h8M6 14h5" /></svg>;
const SwordsIcon = () => <svg viewBox="0 0 20 20" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.3"><path d="M3 3l10 10M13 3L3 13M3 3v3M3 3h3M17 17l-3-3M17 17v-3M17 17h-3" /></svg>;
const Die20Icon = () => <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.1"><path d="M12 23L3 16.5M12 23l9-6.5M12 23v-6.4M3 16.5l9-.1M3 16.5v-8.7M3 7.8L12 1.3M3 7.8l3.8.9M12 1.3l9 6.5M12 1.3l6.1 7.4M21 7.8v8.7M21 7.8l-3.8.9M21 16.5l-9-.1M21 16.5l-2.9-7.8M6.8 8.7h12.3M6.8 8.7L12 16.6M19.1 8.7L12 16.6" /></svg>;
const CastIcon = () => <svg viewBox="0 0 48 48" width="26" height="26" fill="currentColor"><path d="m19.2 36.4-4.75-10.45L4 21.2l10.45-4.75L19.2 6l4.75 10.45L34.4 21.2l-10.45 4.75ZM36.4 42l-2.35-5.25-5.25-2.35 5.25-2.4 2.35-5.2 2.4 5.2 5.2 2.4-5.2 2.35Z" /></svg>;
