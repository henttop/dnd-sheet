/* Настройки интерфейса (локальные, не попадают в экспорт LSS) */
let state = {
  rollDetails: true,   // подробности броска (кубик, модификаторы)
  critColors: true,    // выделять крит/провал цветом
  showDC: true,        // сложность спасброска в заклинаниях
  showAtk: true,       // бонус атаки заклинанием
  showFeatures: true,  // вкладка «Способности»
  srd52: true,         // справочник заклинаний SRD 5.2 вместо 5.1
  lang: "srd",
};

try {
  const saved = JSON.parse(localStorage.getItem("dnd-sheet-ui") || "null");
  if (saved) state = { ...state, ...saved };
} catch (e) { /* игнорируем */ }

const subs = new Set();

export const getUi = () => state;

export function setUi(patch) {
  state = { ...state, ...patch };
  try { localStorage.setItem("dnd-sheet-ui", JSON.stringify(state)); } catch (e) { /* игнорируем */ }
  subs.forEach(fn => fn(state));
  return state;
}

export function subscribeUi(fn) {
  subs.add(fn);
  return () => subs.delete(fn);
}
