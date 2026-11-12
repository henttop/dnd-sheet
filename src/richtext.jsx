import React from "react";
// Рендер tiptap-документа и конвертация doc ↔ plain text

export function renderDoc(doc) {
  if (!doc || !doc.content) return null;
  return <>{doc.content.map((n, i) => <Node key={i} n={n} />)}</>;
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

function Node({ n }) {
  const kids = n.content || [];
  switch (n.type) {
    case "paragraph": return <p>{kids.map((k, i) => k.type === "text" ? <Inline key={i} t={k} /> : <Node key={i} n={k} />)}</p>;
    case "heading": { const Tag = ({ 1: "h2", 2: "h3", 3: "h4" })[n.attrs?.level] || "h4"; return <Tag>{kids.map((k, i) => <Inline key={i} t={k} />)}</Tag>; }
    case "bulletList": return <ul>{kids.map((k, i) => <Node key={i} n={k} />)}</ul>;
    case "orderedList": return <ol>{kids.map((k, i) => <Node key={i} n={k} />)}</ol>;
    case "listItem": return <li>{kids.map((k, i) => <Node key={i} n={k} />)}</li>;
    case "taskList": return <ul>{kids.map((k, i) => <li key={i}>{k.attrs?.checked ? "☑" : "☐"} <Node n={k} /></li>)}</ul>;
    case "blockquote": return <blockquote>{kids.map((k, i) => <Node key={i} n={k} />)}</blockquote>;
    case "divider": return <hr className="divider" />;
    case "spoiler": {
      const sum = kids.filter(x => x.type === "spoilerSummary").map(x => (x.content || []).map(k => k.type === "text" ? inlineText(k) : null));
      const body = kids.filter(x => x.type === "spoilerContent").map((k, i) => <Node key={i} n={k} />);
      return <details><summary>{sum || "Спойлер"}</summary>{body}</details>;
    }
    case "text": return <Inline t={n} />;
    case "roller": { const e = n.attrs?.expr || n.attrs?.formula || ""; return <button className="roller-btn" onClick={() => window.__rollExpr?.(e, n)}>🎲 {e}</button>; }
    case "formula": return <code>{n.attrs?.formula || n.attrs?.expr || ""}</code>;
    case "resource": { const a = n.attrs || {}; return <span className="chip-sm">{a.name || "ресурс"} {a.current != null ? `${a.current}/${a.max || ""}` : ""}</span>; }
    default: {
      const out = [];
      JSON.stringify(n, (k, v) => { if (k === "text" && typeof v === "string") out.push(v); return v; });
      return out.length ? <p>{out.join(" ")}</p> : null;
    }
  }
}

function Inline({ t }) {
  if (t.type === "text") return inlineText(t);
  return <Node n={t} />;
}

// ---------- Конвертация plain text ↔ doc ----------
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
      case "spoiler": lines.push(prefix + "[спойлер] " + (n.content || []).filter(x => x.type === "spoilerSummary").map(flatText).join("")); break;
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
  (text || "").split(/\r?\n/).forEach(line => {
    const t = line.trim();
    if (!t) return;
    if (t === "——") { content.push({ type: "divider" }); return; }
    if (/^(- |• |— )/.test(t)) {
      const last = content[content.length - 1];
      const item = { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: t.replace(/^(- |• |— )/, "") }] }] };
      if (last && last.type === "bulletList") last.content.push(item);
      else content.push({ type: "bulletList", content: [item] });
      return;
    }
    const m = t.match(/^(\d+)[.)]\s+(.*)$/);
    if (m) {
      const last = content[content.length - 1];
      const item = { type: "listItem", content: [{ type: "paragraph", content: [{ type: "text", text: m[2] }] }] };
      if (last && last.type === "orderedList") last.content.push(item);
      else content.push({ type: "orderedList", content: [item] });
      return;
    }
    content.push({ type: "paragraph", content: [{ type: "text", text: t }] });
  });
  if (!content.length) content.push({ type: "paragraph", content: [] });
  return { type: "doc", content };
}
