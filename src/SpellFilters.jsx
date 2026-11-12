import React from "react";

/* Фильтры заклинаний — как на dnd.su: уровень, школа, компоненты,
   концентрация, ритуал, время наложения, тип урона */

export const SCHOOLS = [
  "Воплощение", "Ограждение", "Очарование", "Прорицание", "Возбуждение", "Иллюзия", "Некромантия", "Преобразование",
];
export const CAST_TIMES = [
  { id: "action", label: "Действие" },
  { id: "bonus", label: "Бонусное действие" },
  { id: "reaction", label: "Реакция" },
  { id: "minute", label: "1 минута" },
  { id: "hour", label: "1 час" },
  { id: "none", label: "Без времени" },
];
export const DMG_TYPES = [
  "излучением", "огнём", "некротической", "силовой", "рубящим", "дробящим", "колющим",
  "молнией", "холодом", "ядом", "психическим", "кислотой", "звуком",
];

export const CLASSES = [
  ["artificer", "изобретатель"], ["bard", "бард"], ["barbarian", "варвар"], ["cleric", "жрец"],
  ["druid", "друид"], ["fighter", "воин"], ["monk", "монах"], ["paladin", "паладин"],
  ["ranger", "следопыт"], ["rogue", "плут"], ["sorcerer", "чародей"], ["warlock", "колдун"],
  ["wizard", "волшебник"],
];

export const emptyFilters = () => ({
  levels: [], school: "", comps: [], conc: false, ritual: false, castTime: "", dmgType: "", classes: [],
  save: false, attack: false,
});

const COMP_RU = { v: "В", s: "С", m: "М" };

export function castTimeOf(spell) {
  const t = (spell.time || "").toLowerCase();
  if (!t) return "";
  if (t.includes("реакц")) return "reaction";
  if (t.includes("бонусное действие")) return "bonus";
  if (t.includes("1 действие")) return "action";
  if (t.includes("без времени")) return "none";
  if (t.includes("1 минута") || t.includes("минут")) return "minute";
  if (t.includes("1 час") || t.includes("час")) return "hour";
  return "";
}

export function spellMatches(spell, f) {
  if (!f) return true;
  if (f.levels.length && !f.levels.includes(String(spell.level))) return false;
  if (f.classes && f.classes.length) {
    const own = spell.classes || [];
    if (!f.classes.some(c => own.includes(c))) return false;
  }
  if (f.school && spell.school !== f.school) return false;
  if (f.comps.length) {
    const have = spell.comp || [];
    if (!f.comps.every(x => have.includes(x))) return false;
  }
  if (f.conc && !spell.conc) return false;
  if (f.ritual && !spell.ritual) return false;
  if (f.save && spell.mode !== "save") return false;
  if (f.attack && spell.mode !== "attack") return false;
  if (f.castTime && castTimeOf(spell) !== f.castTime) return false;
  if (f.dmgType) {
    const types = (spell.dmg || []).map(d => d.t);
    if (!types.includes(f.dmgType)) return false;
  }
  return true;
}

export function filterSummary(f) {
  const parts = [];
  if (f.levels.length) parts.push(f.levels.length === 1 ? `${f.levels[0]} ур.` : "уровни");
  if (f.classes && f.classes.length) parts.push(f.classes.map(c => (CLASSES.find(x => x[0] === c) || [c, c])[1]).join(", "));
  if (f.school) parts.push(f.school);
  if (f.comps.length) parts.push(f.comps.map(c => COMP_RU[c] || c).join(""));
  if (f.conc) parts.push("конц.");
  if (f.ritual) parts.push("ритуал");
  if (f.castTime) parts.push(CAST_TIMES.find(t => t.id === f.castTime)?.label || "");
  if (f.dmgType) parts.push(f.dmgType);
  return parts.filter(Boolean).join(" · ");
}

export function SpellFilters({ value, onChange, levels, showLevels = true, showClasses = true }) {
  const f = value;
  const set = (patch) => onChange({ ...f, ...patch });
  const toggleClass = (c) => {
    const has = (f.classes || []).includes(c);
    set({ classes: has ? f.classes.filter(x => x !== c) : [...(f.classes || []), c] });
  };
  const toggleLevel = (lv) => {
    const key = String(lv);
    const has = f.levels.includes(key);
    set({ levels: has ? f.levels.filter(x => x !== key) : [...f.levels, key] });
  };
  const toggleComp = (c) => {
    const has = f.comps.includes(c);
    set({ comps: has ? f.comps.filter(x => x !== c) : [...f.comps, c] });
  };
  return (
    <div className="sp-filters-full">
      {showLevels ? (
        <div className="sp-frow">
          <span className="sp-flabel">Уровень</span>
          <div className="sp-fchips">
            {(levels || []).map(lv => (
              <button key={lv} className={"sp-fchip" + (f.levels.includes(String(lv)) ? " on" : "")}
                onClick={() => toggleLevel(lv)}>{lv === 0 ? "заг" : lv}</button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sp-frow">
        <span className="sp-flabel">Школа</span>
        <select className="f-input sp-fsel" value={f.school} onChange={e => set({ school: e.target.value })}>
          <option value="">Любая</option>
          {SCHOOLS.map(s => <option key={s} value={s}>{s}</option>)}
        </select>
      </div>

      {showClasses ? (
        <div className="sp-frow">
          <span className="sp-flabel">Класс</span>
          <div className="sp-fchips">
            {CLASSES.map(([id, label]) => (
              <button key={id} className={"sp-fchip" + ((f.classes || []).includes(id) ? " on" : "")}
                onClick={() => toggleClass(id)}>{label}</button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="sp-frow">
        <span className="sp-flabel">Компоненты</span>
        <div className="sp-fchips">
          {[["v", "В"], ["s", "С"], ["m", "М"]].map(([id, label]) => (
            <button key={id} className={"sp-fchip" + (f.comps.includes(id) ? " on" : "")}
              onClick={() => toggleComp(id)}>{label}</button>
          ))}
        </div>
      </div>

      <div className="sp-frow">
        <span className="sp-flabel">Особые</span>
        <div className="sp-fchips">
          <button className={"sp-fchip" + (f.conc ? " on" : "")} onClick={() => set({ conc: !f.conc })}>Концентрация</button>
          <button className={"sp-fchip" + (f.ritual ? " on" : "")} onClick={() => set({ ritual: !f.ritual })}>Ритуал</button>
          <button className={"sp-fchip" + (f.save ? " on" : "")} onClick={() => set({ save: !f.save })}
            title="заклинания, требующие спасброска">Требуют спасброска</button>
          <button className={"sp-fchip" + (f.attack ? " on" : "")} onClick={() => set({ attack: !f.attack })}
            title="заклинания с броском атаки">Атака заклинанием</button>
        </div>
      </div>

      <div className="sp-frow">
        <span className="sp-flabel">Время наложения</span>
        <select className="f-input sp-fsel" value={f.castTime} onChange={e => set({ castTime: e.target.value })}>
          <option value="">Любое</option>
          {CAST_TIMES.map(t => <option key={t.id} value={t.id}>{t.label}</option>)}
        </select>
      </div>

      <div className="sp-frow">
        <span className="sp-flabel">Тип урона</span>
        <select className="f-input sp-fsel" value={f.dmgType} onChange={e => set({ dmgType: e.target.value })}>
          <option value="">Любой</option>
          {DMG_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
        </select>
      </div>

      <div className="sp-frow">
        <button className="sp-fclear" onClick={() => onChange(emptyFilters())}>Сбросить фильтры</button>
      </div>
    </div>
  );
}
