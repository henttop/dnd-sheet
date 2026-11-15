/* Настройки интерфейса (локальные, не попадают в экспорт персонажа) */
let state = {
  rollDetails: true,   // подробности броска (кубик, модификаторы)
  critColors: true,    // выделять крит/провал цветом
  showDC: true,        // сложность спасброска в заклинаниях
  showAtk: true,       // бонус атаки заклинанием
  showFeatures: true,  // вкладка «Способности»
  srd52: true,         // справочник заклинаний SRD 5.2 вместо 5.1
  lang: "srd",
  darkerBg: true,      // сверхтёмный фон (deep dark)
  cursorGlow: true,    // эффект мягкой подсветки за курсором
  cursorDotGrid: true, // сетка из точек вокруг курсора (dot matrix)
  cursorRadius: 240,   // радиус круга подсветки в пикселях (120 - 450)
  cursorColor: "purple", // цвет подсветки (purple, cyan, gold, red, green)
  cursorRipple: true,  // эффект расходящейся волны при клике
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
