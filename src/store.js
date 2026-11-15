import charactersRaw from "../data/characters.js";
import spellsRaw from "../data/spells.js";

export const SPELLS = spellsRaw.map(s => {
  if (!s) return s;
  if (/\[.*\]/.test(s.name || "")) return s;
  const en = (s.nameEn || "").trim();
  if (en) {
    return { ...s, name: `${s.name} [${en}]` };
  }
  return s;
});
export const SPELL_BY_ID = new Map(SPELLS.map(s => [s.id, s]));
export const SPELL_BY_SLUG = new Map(SPELLS.map(s => [s.slug, s]));

const LS_KEY = "dnd-sheet-v1";

export let characters = load();

function unpack(doc) {
  return { ...doc, data: typeof doc.data === "string" ? JSON.parse(doc.data) : doc.data };
}

function load() {
  try {
    const saved = localStorage.getItem(LS_KEY);
    if (saved) return JSON.parse(saved).map(unpack);
  } catch (e) { console.warn("localStorage restore failed", e); }
  return charactersRaw.map(unpack);
}

export function save() {
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(characters.map(c => ({ ...c, data: c.data }))));
  } catch (e) { console.warn("save failed", e); }
}

export function reset() {
  localStorage.removeItem(LS_KEY);
  characters = charactersRaw.map(unpack);
}

/* сигнатура персонажа — чтобы при импорте не плодить дубли */
function charKey(c) {
  const d = c.data || {};
  const i = d.info || {};
  return [d.name?.value || "", i.level?.value || "", i.race?.value || "", i.charClass?.value || ""].join("|");
}

export function importCharacters(input) {
  // принимаем и массив персонажей (экспорт списка), и одного персонажа (экспорт карточки)
  const arr = Array.isArray(input)
    ? input
    : (input && typeof input === "object" ? [input] : []);
  if (!arr.length) throw new Error("В файле нет ни одного персонажа");
  const incoming = arr.map(unpack);
  // как на сайте: персонажи с такими же именем/уровнем/классом заменяются, новые — добавляются
  let added = 0, replaced = 0;
  for (const c of incoming) {
    const key = charKey(c);
    const idx = characters.findIndex(x => charKey(x) === key);
    if (idx >= 0) { characters[idx] = c; replaced++; }
    else { characters.push(c); added++; }
  }
  save();
  return { added, replaced, total: characters.length };
}

export function exportCharacters() {
  return JSON.stringify(
    characters.map(c => ({ ...c, data: JSON.stringify(c.data) })),
    null, 2,
  );
}

/* ============ Создание нового персонажа (шаблон «default») ============ */
const hex = (n = 12) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(Math.random() * 16)]).join("");

const SKILL_IDS = [
  ["acrobatics", "dex"], ["sleight of hand", "dex"], ["stealth", "dex"],
  ["athletics", "str"],
  ["arcana", "int"], ["history", "int"], ["investigation", "int"], ["nature", "int"], ["religion", "int"],
  ["insight", "wis"], ["perception", "wis"], ["survival", "wis"], ["medicine", "wis"], ["animal handling", "wis"],
  ["deception", "cha"], ["intimidation", "cha"], ["performance", "cha"], ["persuasion", "cha"],
];

export function blankCharacter() {
  const stats = {};
  const saves = {};
  for (const st of ["str", "dex", "con", "int", "wis", "cha"]) {
    stats[st] = { name: st, score: 10 };
    saves[st] = { name: st, isProf: false };
  }
  const skills = {};
  for (const [id, base] of SKILL_IDS) skills[id] = { baseStat: base, name: id };

  return {
    tags: [],
    rooms: [],
    disabledBlocks: {
      "info-left": [], "info-right": [], "subinfo-left": [], "subinfo-right": [],
      "notes-left": [], "notes-right": [], _id: hex(24),
    },
    edition: "2024",
    sheetEdition: "2024",
    spells: {
      mode: "cards", prepared: [], book: [], slotless: [],
      edition: "2024", granted: [], pending: [],
    },
    linkAccess: "none",
    data: {
      jsonType: "character",
      template: "default",
      name: { value: "" },
      info: {
        charClass: { name: "charClass", value: "" },
        charSubclass: { name: "charSubclass", value: "" },
        level: { name: "level", value: 1 },
        background: { name: "background", value: "" },
        playerName: { name: "playerName", value: "" },
        race: { name: "race", value: "" },
        alignment: { name: "alignment", value: "" },
        experience: { name: "experience", value: "" },
      },
      subInfo: {
        age: { name: "age", value: "" },
        height: { name: "height", value: "" },
        weight: { name: "weight", value: "" },
        eyes: { name: "eyes", value: "" },
        skin: { name: "skin", value: "" },
        hair: { name: "hair", value: "" },
      },
      spellsInfo: {
        base: { name: "base", value: "" },
        save: { name: "save", value: "" },
        mod: { name: "mod", value: "" },
      },
      spells: {},
      spellsPact: {},
      bonuses: {},
      proficiency: 2,
      stats,
      saves,
      skills,
      vitality: {
        "hp-dice-current": { value: 1 },
        "hp-dice-multi": {},
        darkvision: { value: 0 },
      },
      attunementsList: [{ id: "attunement-" + Date.now(), checked: false, value: "" }],
      weaponsList: [{ id: "weapon-" + Date.now(), name: { value: "" }, dmg: { value: "" } }],
      text: {},
      coins: {},
      resources: {},
      conditions: [],
    },
    jsonType: "character",
    version: 2,
  };
}

export function addCharacter(c) {
  characters.push(c);
  save();
  return characters.length - 1;
}

export function removeCharacter(i) {
  characters.splice(i, 1);
  save();
}

export function duplicateCharacter(i) {
  const copy = JSON.parse(JSON.stringify(characters[i]));
  copy.data.name.value = (copy.data.name.value || "Безымянный персонаж") + " (копия)";
  characters.splice(i + 1, 0, copy);
  save();
  return i + 1;
}
