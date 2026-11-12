// Броски и формулы

export function rollDiceExpr(expr) {
  let left = (expr || "").toLowerCase().replace(/к/g, "d").replace(/[−–]/g, "-").replace(/\s+/g, "");
  if (!left) return null;
  let total = 0; const raw = []; let ok = false;
  const re = /([+-]?\d*)d(\d+)|([+-]?\d+)(?!d)/g; let m;
  while ((m = re.exec(left))) {
    if (m[2]) {
      const n = Math.min(parseInt(m[1] || "1", 10) || 1, 50), faces = +m[2];
      for (let i = 0; i < n; i++) { const r = 1 + Math.floor(Math.random() * faces); raw.push(r); total += r; }
      ok = true;
    } else { total += parseInt(m[3], 10); ok = true; }
  }
  return ok ? { raw, total } : null;
}

export const d20 = () => 1 + Math.floor(Math.random() * 20);
export const mod = (score) => Math.floor((+score - 10) / 2);
export const signed = (n) => (n >= 0 ? "+" + n : "−" + Math.abs(n));
export const parseNum = (s) => (typeof s === "string" ? parseInt(s.replace(/[^-+\d]/g, "")) || 0 : +s || 0);
export const esc = (s) => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
