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
  cursorDotSpacing: 28, // расстояние между точками сетки в пикселях (16 - 56)
  cursorRadius: 240,   // радиус круга подсветки в пикселях (120 - 450)
  cursorColor: "purple", // цвет подсветки (purple, cyan, gold, red, green)
  cursorRipple: true,  // эффект расходящейся волны при клике
  cursorCenterDot: false, // световая точка на острие курсора (по умолчанию выключена)
  pillHover: true,             // эффекты при наведении (on hover) на плашки и карточки
  pillHoverLift: true,         // тактильный подъём плашек при наведении
  pillSpotlight: true,         // интерактивный спотлайт и эффекты на всех плашках
  pillSpotlightIntensity: 70,  // интенсивность/яркость спотлайта на плашках (20 - 100%)
  pillSpotlightRadius: 130,    // радиус светового пятна на плашках в пикселях (70 - 220)
};

try {
  const saved = JSON.parse(localStorage.getItem("dnd-sheet-ui") || "null");
  if (saved) {
    state = { ...state, ...saved };
    if (saved.cursorCenterDot === undefined) {
      state.cursorCenterDot = false;
    }
  }
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
