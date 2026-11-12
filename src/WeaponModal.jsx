import React, { useEffect, useMemo, useState } from "react";
import { statMod, profOf } from "./helpers.js";
import { rollDiceExpr } from "./dice.js";

/* Модалка настройки оружия — по образцу longstoryshort.app (?modal=weapon) */

const ABILITIES = [
  ["str", "Сила"], ["dex", "Ловкость"], ["con", "Телосложение"],
  ["int", "Интеллект"], ["wis", "Мудрость"], ["cha", "Харизма"],
];

const DMG_TYPES = ["", "дробящий", "рубящий", "колющий", "огнём", "холодом", "молнией", "некротической",
  "излучением", "силовой", "психическим", "ядом", "кислотой", "звуком"];

/* разбор "1d6 дробящий" → {dice:"1d6", type:"дробящий", min:1, max:6, avg:4} */
export function parseDmg(text) {
  const s = String(text || "").trim();
  const m = s.match(/^([-+]?\d*[dкк]\d+)\s*(.*)$/i);
  if (!m) return { dice: "", type: "", min: 0, max: 0, avg: 0, ok: false };
  const dice = m[1];
  const type = (m[2] || "").trim();
  const dm = dice.match(/(\d*)[dкк](\d+)/i);
  const n = +(dm[1] || 1);
  const faces = +dm[2];
  const min = n;
  const max = n * faces;
  const avg = Math.round((min + max) / 2);
  return { dice, type, min, max, avg, ok: true };
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

  const dmg = useMemo(() => parseDmg(weapon.dmg?.value), [weapon.dmg?.value]);
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
    const p = parseDmg(text);
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
    setExtraDmg(v => (v ? v + " + 1" : " + 1"));
    patch({ extraDamage: extraDmg ? extraDmg + " + 1" : " + 1" });
  };

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal wpn-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>

        <div className="wpn-head">
          <div className="wpn-head-text">
            <div className="wpn-title">{(weapon.name?.value || "БЕЗ НАЗВАНИЯ").toUpperCase()}</div>
            {weapon.dmg?.value ? <div className="wpn-dmg">{weapon.dmg.value}</div> : null}
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
          <select className="f-input" value={ability} onChange={e => patch({ ability: e.target.value })}>
            {ABILITIES.map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
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
          {extraDmg ? (
            <div className="wpn-bonus-row">
              <span>Доп. урон</span>
              <input className="edit-in" style={{ width: 120 }} value={extraDmg}
                onChange={e => { setExtraDmg(e.target.value); patch({ extraDamage: e.target.value }); }} />
            </div>
          ) : null}
        </div>

        <div className="wpn-block">
          <div className="wpn-block-head"><span>ЗАМЕТКИ</span></div>
          <textarea className="rt-edit" rows={4} value={notes} placeholder="Заметки к оружию"
            onChange={e => { setNotes(e.target.value); patch({ notes: { value: e.target.value } }); }} />
          <div className="wpn-sub-label">ЗАМЕТКИ</div>
          <label className="f-check">
            <input type="checkbox" checked={showNotes} onChange={e => { setShowNotes(e.target.checked); patch({ showNotes: e.target.checked }); }} />
            <span>Отображать заметки</span>
          </label>
        </div>

        <div className="wpn-foot">
          <button className="f-btn danger" onClick={onDelete}>Удалить</button>
        </div>
      </div>
    </div>
  );
}
