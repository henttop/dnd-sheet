import { mod, parseNum, signed, evalStat } from "./dice.js";

export const SKILLS = [
  ["acrobatics", "Акробатика", "dex"], ["sleight-of-hand", "Ловкость рук", "dex"], ["stealth", "Скрытность", "dex"],
  ["athletics", "Атлетика", "str"],
  ["arcana", "Магия", "int"], ["history", "История", "int"], ["investigation", "Анализ", "int"], ["nature", "Природа", "int"], ["religion", "Религия", "int"],
  ["insight", "Проницательность", "wis"], ["perception", "Восприятие", "wis"], ["survival", "Выживание", "wis"], ["medicine", "Медицина", "wis"], ["animal-handling", "Уход за животными", "wis"],
  ["deception", "Обман", "cha"], ["intimidation", "Запугивание", "cha"], ["performance", "Выступление", "cha"], ["persuasion", "Убеждение", "cha"],
];
export const STAT_NAMES = { str: "СИЛА", dex: "ЛОВКОСТЬ", con: "ТЕЛОСЛОЖЕНИЕ", int: "ИНТЕЛЛЕКТ", wis: "МУДРОСТЬ", cha: "ХАРИЗМА" };
export const STAT_ORDER = ["str", "dex", "con", "int", "wis", "cha"];
export const XP = [0, 0, 300, 900, 2700, 6500, 14000, 23000, 34000, 48000, 64000, 85000, 100000, 120000, 140000, 165000, 195000, 225000, 265000, 305000, 355000];
export const CONDITIONS_RU = { blinded: "Слепота", charmed: "Очарование", deafened: "Глухота", frightened: "Испуг", grappled: "Схватка", incapacitated: "Недееспособность", invisible: "Невидимость", paralyzed: "Паралич", petrified: "Окаменение", poisoned: "Отравление", prone: "Лежит", restrained: "Опутан", stunned: "Ошеломление", unconscious: "Без сознания" };
export const SIZES = { tiny: "Крошечный", small: "Маленький", medium: "Средний", large: "Большой", huge: "Огромный", gargantuan: "Громадный" };
export const TABS = [
  { id: "attacks", name: "Атаки" }, { id: "abilities", name: "Способности" }, { id: "gear", name: "Снаряжение" },
  { id: "persona", name: "Личность" }, { id: "goals", name: "Цели" }, { id: "notes", name: "Заметки" }, { id: "spells", name: "Заклинания" },
];

export const hp = (c) => {
  const v = c.data.vitality || {};
  const cur = v["hp-current"]?.value ?? 0;
  const max = evalStat(v["hp-max"]?.value, c, 0).total;
  const temp = evalStat(v["hp-temp"]?.value, c, 0).total;
  return { cur, max, temp };
};

export const resolveResourceMax = (r, c) => {
  if (!r) return 0;
  const expr = r.formula || r.max || 0;
  return evalStat(expr, c, 0).total;
};

/* Бонус мастерства зависит от уровня (Player's Handbook):
   1–4 → +2, 5–8 → +3, 9–12 → +4, 13–16 → +5, 17–20 → +6 */
export const PROF_BY_LEVEL = (lvl) =>
  lvl <= 4 ? 2 : lvl <= 8 ? 3 : lvl <= 12 ? 4 : lvl <= 16 ? 5 : 6;

export const levelOf = (c) =>
  Math.max(1, Math.min(20, parseInt(c.data.info?.level?.value, 10) || 1));

/* Бонус мастерства персонажа: свой (proficiencyCustom > 0) иначе по уровню */
export const profOf = (c) => {
  const custom = parseInt(c.data.proficiencyCustom?.value, 10) || 0;
  if (custom > 0) return custom;
  return PROF_BY_LEVEL(levelOf(c));
};

export const raceClass = (c) => {
  const i = c.data.info || {};
  return `${i.race?.value || "?"} — ${i.charClass?.value || "?"} ${i.level?.value || ""}`;
};
export const coinsTotal = (c) => {
  const co = c.data.coins || {}; const g = n => co[n]?.value || 0;
  return +(g("pp") * 10 + g("gp") + g("ep") * .5 + g("sp") * .1 + g("cp") * .01).toFixed(2);
};
export const spellName = (id) => SPELL_INDEX.get(id);
export const statMod = (c, st) => mod(c.data.stats?.[st]?.score ?? 10);

export function skillRaw(c, id) {
  return c.data.skills?.[id] ?? c.data.skills?.[id.replace(/-/g, " ")] ?? null;
}
export function skillProf(c, id) {
  const r = skillRaw(c, id); const p = r?.isProf === true ? 1 : (r?.isProf || 0);
  return Math.min(2, p);
}
export function skillCustom(c, id) {
  const r = skillRaw(c, id);
  return r?.customModifier != null ? r.customModifier : null;
}
export function skillBonus(c, id) {
  const sk = SKILLS.find(s => s[0] === id); if (!sk) return 0;
  const custom = skillCustom(c, id);
  if (custom != null) return custom;
  return statMod(c, sk[2]) + profOf(c) * skillProf(c, id);
}
export function saveProf(c, st) { return c.data.saves?.[st]?.isProf ? 1 : 0; }
export function saveBonus(c, st) { return statMod(c, st) + profOf(c) * saveProf(c, st); }
export function passive(c, id) { return 10 + skillBonus(c, id); }

/* Заклинательная характеристика, Сл спасброска и бонус атаки.
   В схеме персонажа: spellsInfo.base.code — характеристика, spellsInfo.save.customModifier —
   добавка к Сл, spellsInfo.mod.customModifier — добавка к бонусу атаки. */
export function spellCasting(c) {
  const d = c.data;
  const si = (d.spellsInfo ||= {});
  si.base = si.base || { name: 'base', value: '', code: 'int' };
  si.save = si.save || { name: 'save', value: '', customModifier: null };
  si.mod = si.mod || { name: 'mod', value: '', customModifier: null };
  const abil = si.base.code || 'int';
  const m = statMod(c, abil);
  const prof = profOf(c);
  const saveCustom = parseInt(si.save.customModifier, 10) || 0;
  const modCustom = parseInt(si.mod.customModifier, 10) || 0;
  return { abil, mod: m, prof, saveCustom, modCustom, dc: 8 + prof + m + saveCustom, atk: prof + m + modCustom };
}

export function docOf(c, key) { return c.data?.text?.[key]?.value?.data || null; }
export function setDoc(c, key, doc) {
  if (!c.data.text) c.data.text = {};
  if (!c.data.text[key]) c.data.text[key] = { value: {} };
  c.data.text[key].value.data = doc;
}

// Пересобираем индекс заклинаний из store (циклическая зависимость — делаем лениво)
let SPELL_INDEX = new Map();
export function setSpellIndex(map) { SPELL_INDEX = map; }
export { parseNum, signed };
