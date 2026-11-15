import React, { useEffect, useMemo, useState } from "react";
import { statMod, profOf } from "./helpers.js";
import { Toggle } from "./ui.jsx";
import { rollDiceExpr, resolveVariables } from "./dice.js";
import CustomSelect from "./CustomSelect.jsx";

/* Модалка настройки оружия (?modal=weapon) */

const ABILITIES = [
  ["str", "Сила"], ["dex", "Ловкость"], ["con", "Телосложение"],
  ["int", "Интеллект"], ["wis", "Мудрость"], ["cha", "Харизма"],
];

const DMG_TYPES = ["", "дробящий", "рубящий", "колющий", "огнём", "холодом", "молнией", "некротической",
  "излучением", "силовой", "психическим", "ядом", "кислотой", "звуком"];

/* разбор "1d6 дробящий", "2d6+[str]", "2d6 + 2 дробящий" → {dice:"1d6", type:"дробящий", min:1, max:6, avg:4} */
export function parseDmg(text, char = null) {
  let s = String(text || "").trim();
  if (char) {
    try {
      s = resolveVariables(s, char);
    } catch {}
  }
  const m = s.match(/^([-+]?\d*[dкк]\d+)\s*(.*)$/i);
  if (!m) return { dice: "", type: "", min: 0, max: 0, avg: 0, ok: false, hasMod: false, mod: 0 };
  const dice = m[1];
  let rest = (m[2] || "").trim();
  const dm = dice.match(/(\d*)[dкк](\d+)/i);
  const n = +(dm[1] || 1);
  const faces = +dm[2];
  const min = n;
  const max = n * faces;
  const avg = Math.round((min + max) / 2);

  // Явный модификатор в строке урона (например «1d6+2», «2d6 + 2 дробящий», «1d6-1 колющий»)
  let hasMod = false;
  let mod = 0;
  const modM = rest.match(/^([+-])\s*(\d+)\s*(.*)$/);
  let type = rest;
  if (modM) {
    hasMod = true;
    mod = (modM[1] === "-" ? -1 : 1) * (+modM[2]);
    type = (modM[3] || "").trim();
  } else {
    const endModM = rest.match(/^(.*?)\s*([+-])\s*(\d+)\s*$/);
    if (endModM && endModM[1] !== "") {
      hasMod = true;
      mod = (endModM[2] === "-" ? -1 : 1) * (+endModM[3]);
      type = (endModM[1] || "").trim();
    }
  }
  return { dice, type, min, max, avg, ok: true, hasMod, mod };
}

/* разбор строки доп. урона: "+ 2", "2", "+ 1d4", "+ 2 + 1d4", "+ [prof]" и т.д. */
export function parseExtraDmg(str, char = null) {
  if (!str) return { num: 0, hasNum: false, dice: "", raw: "" };
  let s = String(str).trim();
  if (char) {
    try {
      s = resolveVariables(s, char);
    } catch {}
  }
  const diceMatches = [];
  const withoutDice = s.replace(/(\d*)[dкк](\d+)/gi, (m) => {
    diceMatches.push(m);
    return "";
  });
  let num = 0;
  let hasNum = false;
  const numRegex = /([+-]?\s*\d+)/g;
  let m;
  while ((m = numRegex.exec(withoutDice)) !== null) {
    const val = parseInt(m[1].replace(/\s+/g, ""), 10);
    if (!isNaN(val)) {
      num += val;
      hasNum = true;
    }
  }
  const dice = diceMatches.join("+");
  return { num, hasNum, dice, raw: s };
}

/* полный урон: кости + модификатор характеристики + доп. урон */
export function damageInfo(text, abilMod = 0, extraDamage = "", char = null) {
  const d = parseDmg(text, char);
  if (!d.ok) {
    return {
      ...d,
      total: 0,
      abil: 0,
      baseMod: 0,
      extraNum: 0,
      extraDice: "",
      totalMod: 0,
      displayMod: "",
    };
  }

  // Модификатор характеристики (если модификатор не был явно записан в самой строке костей)
  const abil = d.hasMod ? 0 : abilMod;
  const baseMod = d.hasMod ? d.mod : abilMod;

  // Дополнительный урон
  const extra = parseExtraDmg(extraDamage, char);
  const extraNum = extra.num || 0;
  const extraDice = extra.dice || "";

  // Итоговый модификатор к урону
  const totalMod = baseMod + extraNum;

  // Расчет костей доп. урона для мин/макс/среднего
  let extraDiceMin = 0;
  let extraDiceMax = 0;
  let extraDiceAvg = 0;
  if (extraDice) {
    const diceGroups = extraDice.split("+").filter(Boolean);
    for (const dg of diceGroups) {
      const dm = dg.match(/(\d*)[dкк](\d+)/i);
      if (dm) {
        const n = +(dm[1] || 1);
        const faces = +dm[2];
        extraDiceMin += n;
        extraDiceMax += n * faces;
        extraDiceAvg += Math.round((n + n * faces) / 2);
      }
    }
  }

  const min = d.min + totalMod + extraDiceMin;
  const max = d.max + totalMod + extraDiceMax;
  const avg = Math.round(d.avg + totalMod + extraDiceAvg);
  const total = d.avg + totalMod + extraDiceAvg;

  // Форматирование для бейджа
  let displayMod = "";
  if (totalMod !== 0) {
    displayMod = totalMod > 0 ? `+${totalMod}` : `${totalMod}`;
  }
  if (extraDice) {
    displayMod = displayMod ? `${displayMod}+${extraDice}` : `+${extraDice}`;
  }

  return {
    ...d,
    abil,
    baseMod,
    extraNum,
    extraDice,
    totalMod,
    displayMod,
    min,
    max,
    avg,
    total,
  };
}

export function weaponBonus(c, w) {
  const abil = w.ability || "str";
  let b = statMod(c, abil);
  if (w.isProf) b += profOf(c);
  b += parseInt(w.modBonus?.value, 10) || 0;
  b += parseInt(String(w.mod?.value || "").replace(/[^\d+-]/g, ""), 10) || 0;
  return b;
}

export default function WeaponModal({ c, weapon, onChange, onDelete, onClose }) {
  const [name, setName] = useState(weapon.name?.value || "");
  const [notes, setNotes] = useState(weapon.notes?.value || "");
  const [showNotes, setShowNotes] = useState(!!weapon.showNotes);
  const [extraDmg, setExtraDmg] = useState(weapon.extraDamage || "");

  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const dmg = useMemo(() => damageInfo(weapon.dmg?.value, statMod(c, weapon.ability || "str"), extraDmg, c),
    [weapon.dmg?.value, weapon.ability, extraDmg, c]);
  const ability = weapon.ability || "str";
  const isProf = !!weapon.isProf;
  const bonus = weaponBonus(c, weapon);
  const prof = profOf(c);

  const patch = (p) => onChange({ ...weapon, ...p });

  const setDmg = (dice, type) => {
    const v = [dice, type].filter(Boolean).join(" ");
    patch({ dmg: { value: v } });
  };
  // полная строка урона в поле «УРОН», вид урона — отдельное поле
  const setDmgFull = (text) => {
    const p = parseDmg(text, c);
    patch({ dmg: { value: p.ok ? [p.dice, p.type].filter(Boolean).join(" ") : text } });
  };
  const setDmgType = (type) => {
    patch({ dmg: { value: [dmg.dice, type].filter(Boolean).join(" ") } });
  };

  const addAtkBonus = () => {
    const cur = parseInt(weapon.modBonus?.value, 10) || 0;
    patch({ modBonus: { value: cur + 1 } });
  };
  const addDmgBonus = () => {
    const next = extraDmg ? extraDmg + " + 1" : " + 1";
    setExtraDmg(next);
    patch({ extraDamage: next });
  };

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal wpn-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>

        <div className="wpn-head">
          <div className="wpn-head-text">
            <div className="wpn-title">{(weapon.name?.value || "БЕЗ НАЗВАНИЯ").toUpperCase()}</div>
            {weapon.dmg?.value ? (
              <div
                className="wpn-dmg"
                title="нажмите, чтобы совершить бросок урона"
                style={{ cursor: "pointer" }}
                onClick={() => {
                  if (dmg.ok) {
                    const parts = [];
                    const abilName = ABILITIES.find(a => a[0] === ability)?.[1] || ability;
                    const baseMod = dmg.abil || dmg.mod || 0;
                    if (baseMod) parts.push(abilName);
                    if (dmg.extraNum) parts.push("Доп. урон");
                    const modLabel = parts.join(" + ");
                    const diceExpr = dmg.extraDice ? `${dmg.dice}+${dmg.extraDice}` : dmg.dice;
                    window.__rollExpr(`Урон: ${weapon.name?.value || "оружие"}`, diceExpr, dmg.totalMod, modLabel, { sub: dmg.type });
                  }
                }}
              >
                {weapon.dmg.value}
                {dmg.displayMod ? ` ${dmg.displayMod}` : ""}
              </div>
            ) : null}
            {dmg.ok ? <div className="wpn-range">Урон: {dmg.min}–{dmg.max} (→{dmg.avg})</div> : null}
          </div>
          <button className="wpn-atk" title="бросок атаки"
            onClick={() => window.__rollD20(`Атака: ${weapon.name?.value || "оружие"}`, bonus, "")}>
            <span className="wpn-atk-v">{bonus >= 0 ? "+" + bonus : bonus}</span>
            <span className="wpn-atk-l">АТАКА</span>
          </button>
        </div>

        <div className="wpn-block">
          <div className="wpn-block-head"><span>НАЗВАНИЕ</span></div>
          <input className="f-input" value={name} placeholder="Например: Меч"
            onChange={e => { setName(e.target.value); patch({ name: { value: e.target.value } }); }} />
        </div>

        <div className="wpn-block">
          <div className="wpn-block-head">
            <span>АТАКА</span>
            <button className="wpn-add" onClick={addAtkBonus}>+ Бонус</button>
          </div>
          <div className="wpn-radios">
            <label className={"wpn-radio" + (!isProf ? " on" : "")}>
              <input type="radio" checked={!isProf} onChange={() => patch({ isProf: false })} />
              <span>Нет</span>
            </label>
            <label className={"wpn-radio" + (isProf ? " on" : "")}>
              <input type="radio" checked={isProf} onChange={() => patch({ isProf: true })} />
              <span>Владение {prof >= 0 ? "+" + prof : prof}</span>
            </label>
          </div>
          <div className="wpn-sub-label">ХАРАКТЕРИСТИКА</div>
          <CustomSelect value={ability} onChange={e => patch({ ability: e.target.value })}>
            {ABILITIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </CustomSelect>
          {weapon.modBonus?.value ? (
            <div className="wpn-bonus-row">
              <span>Свой бонус атаки</span>
              <input type="number" className="edit-in" style={{ width: 80 }}
                value={weapon.modBonus.value}
                onChange={e => patch({ modBonus: { value: +e.target.value || 0 } })} />
            </div>
          ) : null}
        </div>

        <div className="wpn-block">
          <div className="wpn-block-head">
            <span>УРОН</span>
            <button className="wpn-add" onClick={addDmgBonus}>+ Бонус</button>
          </div>
          <div className="wpn-dmg-grid">
            <div>
              <div className="wpn-sub-label">УРОН</div>
              <div className={"wpn-dmg-input" + (dmg.ok ? "" : " err")}>
                <span className="wpn-dice" title="кубики">🎲</span>
                <input className="edit-in" value={weapon.dmg?.value || ""} placeholder="1d6 дробящий"
                  onChange={e => setDmgFull(e.target.value)} />
                {!dmg.ok ? <span className="wpn-err-badge">err</span> : null}
              </div>
            </div>
            <div>
              <div className="wpn-sub-label">ВИД УРОНА</div>
              <input className="f-input" value={dmg.type} placeholder="дробящий"
                onChange={e => setDmgType(e.target.value)} />
            </div>
          </div>
          {extraDmg !== undefined && extraDmg !== null && extraDmg !== "" ? (
            <div className="wpn-bonus-row">
              <span>Доп. урон</span>
              <input className="edit-in" style={{ width: 120 }} value={extraDmg} placeholder="+ 1"
                onChange={e => { setExtraDmg(e.target.value); patch({ extraDamage: e.target.value }); }} />
              <button
                type="button"
                className="row-del"
                title="Удалить доп. урон"
                style={{ width: 22, height: 22, padding: 0, lineHeight: 1, fontSize: 13, cursor: "pointer" }}
                onClick={() => { setExtraDmg(""); patch({ extraDamage: "" }); }}
              >×</button>
            </div>
          ) : null}
          <div className="f-hint" style={{ marginTop: 8 }}>
            {dmg.ok
              ? `Урон: ${dmg.min}–${dmg.max} (→${dmg.avg})` +
                ((dmg.abil || dmg.mod) ? ` = кости + ${dmg.abil || dmg.mod} (${ABILITIES.find(a => a[0] === ability)?.[1] || ability})` : "") +
                (dmg.extraNum ? ` + ${dmg.extraNum} (доп. урон)` : "") +
                (dmg.extraDice ? ` + ${dmg.extraDice}` : "")
              : "Укажите кости урона, например 1d6"}
          </div>
        </div>

        <div className="wpn-block">
          <div className="wpn-block-head"><span>ЗАМЕТКИ</span></div>
          <textarea className="rt-edit" rows={4} value={notes} placeholder="Заметки к оружию"
            onChange={e => { setNotes(e.target.value); patch({ notes: { value: e.target.value } }); }} />
          <div className="wpn-sub-label">ЗАМЕТКИ</div>
          <Toggle checked={showNotes} label="Отображать заметки"
            onChange={v => { setShowNotes(v); patch({ showNotes: v }); }} />
        </div>

        <div className="wpn-foot">
          <button className="f-btn danger" onClick={onDelete}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
