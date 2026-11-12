import React from "react";
// Рендер tiptap-документа и конвертация doc ↔ plain text.
// Поддерживаются маркеры:
//   **жирный**  *курсив*  __подчёркнутый__  ~~зачёркнутый~~  `код`
//   ||Заголовок спойлера||скрытый текст||      — спойлер
//   {{Название ресурса}}                        — ресурс персонажа
//   [[1d6]]                                    — бросок кубиков
//   ——                                          — разделитель
//   "- " в начале строки                       — маркированный список

export function renderDoc(doc, ctx = {}) {
  if (!doc || !doc.content) return null;
  return <>{doc.content.map((n, i) => <Node key={i} n={n} ctx={ctx} />)}</>;
}

function inlineText(n) {
  let s = n.text;
  const marks = n.marks || [];
  const link = marks.find(m => m.type === "link");
  if (marks.some(m => m.type === "bold")) s = <b>{s}</b>;
  if (marks.some(m => m.type === "italic")) s = <i>{s}</i>;
  if (marks.some(m => m.type === "underline")) s = <u>{s}</u>;
  if (marks.some(m => m.type === "strike")) s = <s>{s}</s>;
  if (marks.some(m => m.type === "code")) s = <code>{s}</code>;
  if (link) s = <a href={link.attrs?.href || "#"} target="_blank" rel="noreferrer">{s}</a>;
  return s;
}

function Node({ n, ctx = {} }) {
  const kids = n.content || [];
  switch (n.type) {
    case "paragraph": return <p>{kids.map((k, i) => k.type === "text" ? <Inline key={i} t={k} ctx={ctx} /> : <Node key={i} n={k} ctx={ctx} />)}</p>;
    case "heading": { const Tag = ({ 1: "h2", 2: "h3", 3: "h4" })[n.attrs?.level] || "h4"; return <Tag>{kids.map((k, i) => <Inline key={i} t={k} ctx={ctx} />)}</Tag>; }
    case "bulletList": return <ul>{kids.map((k, i) => <Node key={i} n={k} ctx={ctx} />)}</ul>;
    case "orderedList": return <ol>{kids.map((k, i) => <Node key={i} n={k} ctx={ctx} />)}</ol>;
    case "listItem": return <li>{kids.map((k, i) => <Node key={i} n={k} ctx={ctx} />)}</li>;
    case "taskList": return <ul>{kids.map((k, i) => <li key={i}>{k.attrs?.checked ? "☑" : "☐"} <Node n={k} ctx={ctx} /></li>)}</ul>;
    case "blockquote": return <blockquote>{kids.map((k, i) => <Node key={i} n={k} ctx={ctx} />)}</blockquote>;
    case "divider": return <hr className="divider" />;
    case "spoiler": {
      const sum = kids.filter(x => x.type === "spoilerSummary").map(x => (x.content || []).map(k => k.type === "text" ? inlineText(k) : null));
      const body = kids.filter(x => x.type === "spoilerContent").map((k, i) => <Node key={i} n={k} ctx={ctx} />);
      return (
        <details className="spoiler">
          <summary><span className="spoiler-chev">›</span>{sum.length ? sum : "Спойлер"}</summary>
          <div className="spoiler-body">{body}</div>
        </details>
      );
    }
    case "text": return <Inline t={n} ctx={ctx} />;
    case "roller": {
      const e = n.attrs?.expr || n.attrs?.formula || "";
      return <button className="roller-btn" onClick={() => window.__rollExpr?.(e, n)}>🎲 {e}</button>;
    }
    case "formula": return <code>{n.attrs?.formula || n.attrs?.expr || ""}</code>;
    case "resource": {
      const a = n.attrs || {};
      const live = a.id && ctx.resources ? ctx.resources[a.id] : null;
      const name = live ? live.name : (a.name || "ресурс");
      const cur = live ? (live.current ?? 0) : (a.current ?? 0);
      const mx = live ? (live.max ?? 0) : (a.max ?? 0);
      const step = (d) => {
        if (!a.id || !ctx.onResource) return;
        ctx.onResource(a.id, { current: Math.max(0, (cur ?? 0) + d) });
      };
      return (
        <span className="res-chip" title={name}>
          <span className="res-chip-name">{name}</span>
          <button className="res-btn" onClick={e => { e.stopPropagation(); step(-1); }}>−</button>
          <span className="res-chip-val">{cur}</span>
          <button className="res-btn" onClick={e => { e.stopPropagation(); step(1); }}>+</button>
        </span>
      );
    }
    default: {
      const out = [];
      JSON.stringify(n, (k, v) => { if (k === "text" && typeof v === "string") out.push(v); return v; });
      return out.length ? <p>{out.join(" ")}</p> : null;
    }
  }
}

function Inline({ t, ctx = {} }) {
  if (t.type === "text") return inlineText(t);
  return <Node n={t} ctx={ctx} />;
}

/* ---------- Разбор инлайновых маркеров в текст ---------- */
const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*\n]+\*|\{\{[^}]+\}\}|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/g;

function parseInline(text) {
  const out = [];
  const push = (t, marks = []) => { if (t) out.push({ type: "text", text: t, marks }); };
  let last = 0, m;
  INLINE_RE.lastIndex = 0;
  while ((m = INLINE_RE.exec(text))) {
    push(text.slice(last, m.index));
    const tok = m[0];
    const mark = (type) => [{ type }];
    if (tok.startsWith("**")) push(tok.slice(2, -2), mark("bold"));
    else if (tok.startsWith("__")) push(tok.slice(2, -2), mark("underline"));
    else if (tok.startsWith("~~")) push(tok.slice(2, -2), mark("strike"));
    else if (tok.startsWith("`")) push(tok.slice(1, -1), mark("code"));
    else if (tok.startsWith("{{")) {
      const raw = tok.slice(2, -2).trim();
      const sep = raw.indexOf("::");
      const id = sep >= 0 ? raw.slice(0, sep) : "";
      const name = sep >= 0 ? raw.slice(sep + 2) : raw;
      out.push({ type: "resource", attrs: { id, name } });
    }
    else if (tok.startsWith("[[")) {
      out.push({ type: "roller", attrs: { expr: tok.slice(2, -2) } });
    }
    else if (tok.startsWith("[")) {
      const mm = tok.match(/^\[([^\]]+)\]\(([^)]+)\)$/);
      if (mm) push(mm[1], [{ type: "link", attrs: { href: mm[2] } }]);
      else push(tok);
    }
    else if (tok.startsWith("*")) push(tok.slice(1, -1), mark("italic"));
    else push(tok);
    last = m.index + tok.length;
  }
  push(text.slice(last));
  return out;
}

/* ---------- Конвертация plain text ↔ doc ---------- */
export function docToText(doc) {
  if (!doc || !doc.content) return "";
  const lines = [];
  const walk = (n, prefix = "") => {
    switch (n.type) {
      case "paragraph": lines.push(prefix + flatText(n)); break;
      case "heading": lines.push(prefix + flatText(n)); break;
      case "bulletList": case "taskList": (n.content || []).forEach(li => walk(li, prefix + "- ")); break;
      case "orderedList": (n.content || []).forEach((li, i) => walk(li, prefix + `${i + 1}. `)); break;
      case "listItem": (n.content || []).forEach(k => walk(k, prefix)); break;
      case "divider": lines.push(prefix + "——"); break;
      case "spoiler": {
        const sum = (n.content || []).filter(x => x.type === "spoilerSummary").map(flatText).join("");
        const body = (n.content || []).filter(x => x.type === "spoilerContent").map(flatText).join(" ");
        lines.push(prefix + `||${sum}||${body}||`);
        break;
      }
      case "roller": lines.push(prefix + `[[${n.attrs?.expr || n.attrs?.formula || ""}]]`); break;
      case "resource": lines.push(prefix + `{{${n.attrs?.id || ""}${n.attrs?.id ? "::" : ""}${n.attrs?.name || ""}}`); break;
      case "text": if (n.text) lines.push(prefix + n.text); break;
      default: { const t = flatText(n); if (t) lines.push(prefix + t); }
    }
  };
  doc.content.forEach(n => walk(n));
  return lines.join("\n");
}

function flatText(n) {
  const out = [];
  JSON.stringify(n, (k, v) => { if (k === "text" && typeof v === "string") out.push(v); return v; });
  return out.join("");
}

export function textToDoc(text) {
  const content = [];
  const src = text || "";

  // спойлеры могут занимать несколько строк — вырезаем их целиком
  const parts = [];
  const re = /\|\|([^|]+)\|\|([\s\S]*?)\|\|/g;
  let last = 0, m;
  while ((m = re.exec(src))) {
    if (m.index > last) parts.push({ type: "text", text: src.slice(last, m.index) });
    parts.push({ type: "spoiler", summary: m[1], body: m[2] });
    last = m.index + m[0].length;
  }
  if (last < src.length) parts.push({ type: "text", text: src.slice(last) });

  const pushLine = (line) => {
    const t = line.trim();
    if (!t) return;
    if (t === "——") { content.push({ type: "divider" }); return; }
    if (/^(- |• |— )/.test(t)) {
      const lastEl = content[content.length - 1];
      const item = { type: "listItem", content: [{ type: "paragraph", content: parseInline(t.replace(/^(- |• |— )/, "")) }] };
      if (lastEl && lastEl.type === "bulletList") lastEl.content.push(item);
      else content.push({ type: "bulletList", content: [item] });
      return;
    }
    const mm = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (mm) {
      const lastEl = content[content.length - 1];
      const item = { type: "listItem", content: [{ type: "paragraph", content: parseInline(mm[2]) }] };
      if (lastEl && lastEl.type === "orderedList") lastEl.content.push(item);
      else content.push({ type: "orderedList", content: [item] });
      return;
    }
    content.push({ type: "paragraph", content: parseInline(t) });
  };

  for (const part of parts) {
    if (part.type === "spoiler") {
      content.push({
        type: "spoiler",
        content: [
          { type: "spoilerSummary", content: [{ type: "text", text: part.summary }] },
          { type: "spoilerContent", content: [{ type: "paragraph", content: parseInline(part.body.trim()) }] },
        ],
      });
      continue;
    }
    part.text.split(/\r?\n/).forEach(pushLine);
  }

  if (!content.length) content.push({ type: "paragraph", content: [] });
  return { type: "doc", content };
}

/* ---------- Работа с выделением в текстовом поле ---------- */
export function wrapSelection(ta, before, after = before, fallback = "") {
  const text = ta.value ?? "";
  const live = { start: ta.selectionStart ?? 0, end: ta.selectionEnd ?? 0 };
  const saved = ta.__sel && ta.__sel.end > ta.__sel.start ? ta.__sel : null;
  const range = live.end > live.start ? live : (saved || live);
  const start = range.start;
  const end = range.end;
  const sel = text.slice(start, end) || fallback;
  const next = text.slice(0, start) + before + sel + after + text.slice(end);
  const pos = start + before.length + sel.length + after.length;
  ta.__sel = { start, end };
  return { next, sel, start, end, pos };
}

export function insertAtCursor(ta, insert) {
  const text = ta.value ?? "";
  const live = { start: ta.selectionStart ?? 0, end: ta.selectionEnd ?? 0 };
  const saved = ta.__sel && ta.__sel.end > ta.__sel.start ? ta.__sel : null;
  const range = live.end > live.start ? live : (saved || live);
  const start = range.start;
  const end = range.end;
  const next = text.slice(0, start) + insert + text.slice(end);
  ta.__sel = { start, end };
  return { next, pos: start + insert.length };
}
