// ==========================================
// Движок формул, переменных и бросков костей
// ==========================================

export const d20 = () => 1 + Math.floor(Math.random() * 20);
export const mod = (score) => Math.floor((+score - 10) / 2);
export const signed = (n) => (n >= 0 ? "+" + n : "−" + Math.abs(n));
export const parseNum = (s) => (typeof s === "string" ? parseInt(s.replace(/[^-+\d]/g, "")) || 0 : +s || 0);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

/**
 * Извлекает название броска и тип урона из формулы:
 * - После '#': '1d100cs<=25 # Слишком медленный жест' -> { title: "Слишком медленный жест" }
 * - В скобках в конце: '1d20+5 (Атака)' -> { title: "Атака" }
 * - Текст перед формулой: 'Вдохновение барда 1d6' -> { title: "Вдохновение барда" }
 * - Вид урона после кости: '1к6 колющий' -> { title: "колющий", sub: "колющий" }
 */
export function extractFormulaTitle(raw) {
  let s = (raw || "").trim();
  let title = "";
  let sub = "";

  // 1. После '#'
  const hashIdx = s.indexOf("#");
  if (hashIdx >= 0) {
    title = s.slice(hashIdx + 1).trim();
    s = s.slice(0, hashIdx).trim();
  }

  // 2. В скобках в конце: '1d20+5 (Атака)'
  const parenMatch = s.match(/\s+\(([^()]+)\)\s*$/);
  if (parenMatch) {
    const inside = parenMatch[1].trim();
    if (/[a-zA-Zа-яА-ЯёЁ]/.test(inside) && !/\d+[dDкК]\d+/.test(inside)) {
      if (!title) title = inside;
      s = s.slice(0, parenMatch.index).trim();
    }
  }

  // 3. Слова перед формулой: 'Вдохновение барда 1d6'
  const leadMatch = s.match(/^([a-zA-Zа-яА-ЯёЁ\s]+?)\s+(?=\d|[dDкК]|if\(|floor\(|ceil\(|round\(|max\(|min\(|abs\(|sqrt\(|\[)/);
  if (leadMatch) {
    if (!title) title = leadMatch[1].trim();
    s = s.slice(leadMatch[0].length).trim();
  }

  // 4. Текст/вид урона в конце: '1к6 колющий'
  const trailMatch = s.match(/\s+([a-zA-Zа-яА-ЯёЁ\s]+)$/);
  if (trailMatch && !/^(and|or|not|kh|kl|dh|dl)$/i.test(trailMatch[1].trim())) {
    sub = trailMatch[1].trim();
    if (!title) title = sub;
    s = s.slice(0, trailMatch.index).trim();
  }

  return { formula: s, title: title || "Бросок", sub };
}

function safeEval(expr) {
  try {
    return Function('"use strict"; return (' + expr + ');')();
  } catch {
    return null;
  }
}

/**
 * Подставляет значения характеристик персонажа в переменные:
 * [STR], [DEX], [CON], [INT], [WIS], [CHA] — модификаторы
 * [PROF] — бонус мастерства
 * [HALF_PROF] — половина бонуса мастерства (вниз)
 * [LVL] — уровень персонажа
 * Регистр не важен ([str] = [STR]).
 * Поддерживаются вложенные квадратные скобки: [[STR]+1]
 */
export function resolveVariables(str, char = null) {
  if (!str) return "";
  const activeChar = char || (typeof window !== "undefined" ? window.__activeChar : null);
  const d = activeChar?.data || activeChar || {};
  const stats = d.stats || {};

  const getMod = (stat) => {
    const sc = stats[stat]?.score ?? 10;
    return Math.floor((Number(sc) - 10) / 2);
  };

  const lvl = Number(d.info?.level?.value ?? 1) || 1;
  const prof = Math.floor((lvl - 1) / 4) + 2;
  const halfProf = Math.floor(prof / 2);

  const vars = {
    str: getMod("str"),
    dex: getMod("dex"),
    con: getMod("con"),
    int: getMod("int"),
    wis: getMod("wis"),
    cha: getMod("cha"),
    prof: prof,
    half_prof: halfProf,
    lvl: lvl
  };

  let prev = "";
  let cur = str;
  let iterations = 0;
  while (cur !== prev && iterations < 5) {
    prev = cur;
    iterations++;
    cur = cur.replace(/\[([^\[\]]+)\]/g, (match, inner) => {
      const trimmed = inner.trim().toLowerCase();
      if (trimmed in vars) {
        return String(vars[trimmed]);
      }
      try {
        if (/^[\d\s+\-*\/.]+$/.test(inner)) {
          const val = safeEval(inner);
          return val != null ? String(val) : match;
        }
      } catch {}
      return match;
    });
  }

  return cur;
}

/**
 * Вычисляет логические условия if(condition, thenExpr, elseExpr)
 */
export function evaluateIfConditions(expr) {
  let s = expr;
  let iterations = 0;

  while (s.includes("if(") && iterations < 10) {
    iterations++;
    let found = false;
    const ifIdx = s.lastIndexOf("if(");
    if (ifIdx >= 0) {
      let depth = 1;
      let closeIdx = -1;
      let comma1 = -1;
      let comma2 = -1;
      for (let i = ifIdx + 3; i < s.length; i++) {
        if (s[i] === "(") depth++;
        else if (s[i] === ")") {
          depth--;
          if (depth === 0) {
            closeIdx = i;
            break;
          }
        } else if (s[i] === "," && depth === 1) {
          if (comma1 === -1) comma1 = i;
          else if (comma2 === -1) comma2 = i;
        }
      }

      if (closeIdx > ifIdx && comma1 !== -1 && comma2 !== -1) {
        const condStr = s.slice(ifIdx + 3, comma1).trim();
        const thenStr = s.slice(comma1 + 1, comma2).trim();
        const elseStr = s.slice(comma2 + 1, closeIdx).trim();

        const condResult = evaluateCondition(condStr);
        const replacement = condResult ? thenStr : elseStr;
        s = s.slice(0, ifIdx) + replacement + s.slice(closeIdx + 1);
        found = true;
      }
    }
    if (!found) break;
  }
  return s;
}

function evaluateCondition(cond) {
  let c = cond.trim()
    .replace(/\band\b/gi, "&&")
    .replace(/\bor\b/gi, "||")
    .replace(/\bnot\b/gi, "!")
    .replace(/<>/g, "!=")
    .replace(/(?<![<>=!])=(?!=)/g, "==");

  try {
    if (/^[\d\s+\-*\/%().<>=!&|]+$/.test(c)) {
      return Boolean(safeEval(c));
    }
  } catch (e) {
    console.warn("Condition eval error:", cond, e);
  }
  return false;
}

export function rollSingleDie(faces) {
  if (faces === "f" || faces === "F") {
    return Math.floor(Math.random() * 3) - 1; // Fate die: -1, 0, +1
  }
  const f = faces === "%" ? 100 : Number(faces) || 20;
  return 1 + Math.floor(Math.random() * f);
}

/**
 * Бросок группы костей с модификаторами (kh, kl, dh, dl, !, min, max, r, ro)
 */
export function rollDiceGroup(count, faces, modifierStr = "") {
  const n = Math.max(0, Math.min(Number(count) || 1, 100));
  if (n === 0) return { total: 0, rolls: [], text: "0" };

  let rolls = [];
  const maxF = faces === "%" ? 100 : faces === "f" || faces === "F" ? 1 : Number(faces) || 20;

  for (let i = 0; i < n; i++) {
    let val = rollSingleDie(faces);

    // minN
    const minM = modifierStr.match(/min(\d+)/i);
    if (minM) val = Math.max(val, Number(minM[1]));

    // maxN
    const maxM = modifierStr.match(/max(\d+)/i);
    if (maxM) val = Math.min(val, Number(maxM[1]));

    // ro (перебросить 1 раз) / r (перебрасывать)
    const roM = modifierStr.match(/ro(=|<=|<|>=|>)?(\d+)/i);
    if (roM) {
      const op = roM[1] || "=";
      const target = Number(roM[2]);
      const matches = op === "=" ? val === target :
                      op === "<=" ? val <= target :
                      op === "<" ? val < target :
                      op === ">=" ? val >= target : val > target;
      if (matches) val = rollSingleDie(faces);
    } else {
      const rM = modifierStr.match(/r(=|<=|<|>=|>)?(\d+)/i);
      if (rM) {
        const op = rM[1] || "=";
        const target = Number(rM[2]);
        let safety = 0;
        while (safety++ < 20) {
          const matches = op === "=" ? val === target :
                          op === "<=" ? val <= target :
                          op === "<" ? val < target :
                          op === ">=" ? val >= target : val > target;
          if (matches) val = rollSingleDie(faces);
          else break;
        }
      }
    }

    rolls.push({ val, kept: true, dropped: false, faces: maxF });

    // ! взрыв кости на максимуме или пороге
    if (modifierStr.includes("!")) {
      const expM = modifierStr.match(/!>=(\d+)/);
      const thresh = expM ? Number(expM[1]) : maxF;
      let curVal = val;
      let expCount = 0;
      while (curVal >= thresh && expCount++ < 20) {
        const extra = rollSingleDie(faces);
        rolls.push({ val: extra, kept: true, dropped: false, exploded: true, faces: maxF });
        curVal = extra;
      }
    }
  }

  // khN / klN: оставить старшие/младшие
  // dhN / dlN: отбросить старшие/младшие
  const khM = modifierStr.match(/kh(\d*)/i);
  const klM = modifierStr.match(/kl(\d*)/i);
  const dhM = modifierStr.match(/dh(\d*)/i);
  const dlM = modifierStr.match(/dl(\d*)/i);

  if (khM || klM || dhM || dlM) {
    let sorted = rolls.map((r, idx) => ({ ...r, origIdx: idx })).sort((a, b) => b.val - a.val);

    if (khM) {
      const keep = Math.min(Number(khM[1] || 1), rolls.length);
      const keptIndices = new Set(sorted.slice(0, keep).map(x => x.origIdx));
      rolls.forEach((r, idx) => { if (!keptIndices.has(idx)) { r.kept = false; r.dropped = true; } });
    } else if (klM) {
      const keep = Math.min(Number(klM[1] || 1), rolls.length);
      const keptIndices = new Set(sorted.slice(-keep).map(x => x.origIdx));
      rolls.forEach((r, idx) => { if (!keptIndices.has(idx)) { r.kept = false; r.dropped = true; } });
    } else if (dhM) {
      const drop = Math.min(Number(dhM[1] || 1), rolls.length);
      const droppedIndices = new Set(sorted.slice(0, drop).map(x => x.origIdx));
      rolls.forEach((r, idx) => { if (droppedIndices.has(idx)) { r.kept = false; r.dropped = true; } });
    } else if (dlM) {
      const drop = Math.min(Number(dlM[1] || 1), rolls.length);
      const droppedIndices = new Set(sorted.slice(-drop).map(x => x.origIdx));
      rolls.forEach((r, idx) => { if (droppedIndices.has(idx)) { r.kept = false; r.dropped = true; } });
    }
  }

  const total = rolls.filter(r => r.kept).reduce((sum, r) => sum + r.val, 0);
  const partsText = rolls.map(r => r.dropped ? `~~${r.val}~~` : String(r.val)).join("+");

  return {
    total,
    rolls,
    text: partsText
  };
}

/**
 * Основной вычислитель формулы броска D&D 5e:
 * Разбирает переменные [STR], условия if(), математику и кости,
 * возвращает структурированный результат со всеми подробностями.
 */
export function evaluateFormula(rawExpr, char = null) {
  const { formula: cleanExpr, title, sub } = extractFormulaTitle(rawExpr);
  const withVars = resolveVariables(cleanExpr, char);
  const afterIf = evaluateIfConditions(withVars);

  let expr = afterIf
    .replace(/[−–]/g, "-")
    .replace(/[×]/g, "*")
    .replace(/[÷]/g, "/")
    .replace(/([0-9\)])[кК]/g, "$1d")
    .replace(/(^|[^a-zA-Z0-9_])[кК]([0-9%fF])/g, "$11d$2");

  const diceRegex = /(\b\d*)d(\d+|%|[fF])([a-zA-Z0-9!>=<]+)?/g;
  let allRolls = [];
  let breakdownExpr = expr;
  let mathExpr = expr;

  let match;
  let diceTokens = [];
  while ((match = diceRegex.exec(expr)) !== null) {
    diceTokens.push({
      full: match[0],
      count: match[1] || "1",
      faces: match[2],
      mods: match[3] || "",
      index: match.index
    });
  }

  for (let i = diceTokens.length - 1; i >= 0; i--) {
    const t = diceTokens[i];
    const res = rollDiceGroup(t.count, t.faces, t.mods);
    allRolls.push(...res.rolls);

    const replacementVal = String(res.total);
    const replacementBreakdown = `${t.full} (${res.text})`;

    mathExpr = mathExpr.slice(0, t.index) + replacementVal + mathExpr.slice(t.index + t.full.length);
    breakdownExpr = breakdownExpr.slice(0, t.index) + replacementBreakdown + breakdownExpr.slice(t.index + t.full.length);
  }

  let safeMath = mathExpr
    .replace(/\bfloor\b/g, "Math.floor")
    .replace(/\bceil\b/g, "Math.ceil")
    .replace(/\bround\b/g, "Math.round")
    .replace(/\bmin\b/g, "Math.min")
    .replace(/\bmax\b/g, "Math.max")
    .replace(/\babs\b/g, "Math.abs")
    .replace(/\bsqrt\b/g, "Math.sqrt")
    .replace(/\bpow\b/g, "Math.pow")
    .replace(/\^/g, "**");

  let total = 0;
  try {
    if (/^[\d\s+\-*\/%().Matha-z,]+$/.test(safeMath)) {
      const val = safeEval(safeMath);
      total = Math.floor(Number(val != null ? val : 0));
    }
  } catch (e) {
    console.error("Math eval error for:", safeMath, e);
  }

  let crit = false;
  let fail = false;
  const d20Rolls = allRolls.filter(r => r.faces === 20 && r.kept);
  if (d20Rolls.length === 1) {
    if (d20Rolls[0].val === 20) crit = true;
    if (d20Rolls[0].val === 1) fail = true;
  }

  const csMatch = cleanExpr.match(/cs(=|<=|<|>=|>)?(\d+)/i);
  if (csMatch) {
    const op = csMatch[1] || "=";
    const tgt = Number(csMatch[2]);
    crit = allRolls.some(r => r.kept && (op === "=" ? r.val === tgt : op === "<=" ? r.val <= tgt : r.val >= tgt));
  }
  const cfMatch = cleanExpr.match(/cf(=|<=|<|>=|>)?(\d+)/i);
  if (cfMatch) {
    const op = cfMatch[1] || "=";
    const tgt = Number(cfMatch[2]);
    fail = allRolls.some(r => r.kept && (op === "=" ? r.val === tgt : op === "<=" ? r.val <= tgt : r.val >= tgt));
  }

  return {
    total,
    title,
    sub,
    formula: cleanExpr,
    resolvedExpr: withVars,
    details: breakdownExpr,
    rolls: allRolls,
    crit,
    fail
  };
}

/**
 * Подсказка с предпросмотром формулы для всплывающей подсказки
 */
export function previewFormula(rawExpr, char = null) {
  const { formula, title } = extractFormulaTitle(rawExpr);
  const resolved = resolveVariables(formula, char);
  const prefix = title && title !== "Бросок" ? `${title}: ` : "";
  if (resolved !== formula) {
    return `${prefix}${formula} → ${resolved} (нажмите для броска)`;
  }
  return `${prefix}${formula} (нажмите для броска)`;
}

/**
 * Совместимость с legacy-вызовами rollDiceExpr
 */
export function rollDiceExpr(expr) {
  const res = evaluateFormula(expr);
  if (!res) return null;
  const raw = res.rolls.map(r => r.val);
  return {
    raw: raw.length ? raw : [res.total],
    total: res.total,
    rolls: res.rolls,
    crit: res.crit,
    fail: res.fail,
    details: res.details
  };
}

/**
 * Вычисляет значение числового поля персонажа, поддерживающего формулы
 * (КД, скорость, максимум хитов, максимум ресурса, инициатива и др.)
 */
export function evalStat(val, char = null, def = 0) {
  if (val == null || val === "") return { total: def, isFormula: false, raw: val, resolved: String(def) };
  if (typeof val === "number") return { total: isNaN(val) ? def : val, isFormula: false, raw: val, resolved: String(val) };
  const s = String(val).trim();
  if (/^-?\d+(\.\d+)?$/.test(s)) {
    return { total: Number(s), isFormula: false, raw: s, resolved: s };
  }
  const activeChar = char || (typeof window !== "undefined" ? window.__activeChar : null);
  const res = evaluateFormula(s, activeChar);
  if (!res) return { total: def, isFormula: true, raw: s, resolved: s };
  return {
    total: res.total,
    isFormula: true,
    raw: s,
    resolved: res.resolvedExpr || s,
    details: res.details || ""
  };
}
