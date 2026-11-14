import React, { useState } from "react";
// Рендер tiptap-документа и конвертация doc ↔ plain text.
// Поддерживаются маркеры:
//   **жирный**  *курсив*  __подчёркнутый__  ~~зачёркнутый~~  `код`
//   ||Заголовок спойлера||скрытый текст||      — спойлер
//   {{Название ресурса}}                        — ресурс персонажа
//   [[1d6]]                                    — бросок кубиков
//   ——                                          — разделитель
//   "- " в начале строки                       — маркированный список

/* Защитная пустая строка: ставится перед и после каждого спойлера.
   Без неё поле редактора «ломается»: некуда поставить каретку,
   спойлер сливается с соседним текстом, а пустые строки удалить нельзя. */
export const GUARD_HTML = `<p class="ed-guard" data-guard="1"><br></p>`;

/* Блок ресурса — «таблетка» во всю строку (не как у спойлера: без полосы слева, без шеврона).
   В редакторе только × (убрать из текста) — удаление ресурса есть в его настройках. */
export function resourceBlockHtml(id, name, current, max) {
  const val = max > 0 ? current + "/" + max : current;
  return `<span class="res-chip ed-sp-res" data-sp="1" data-res="${escHtml(id || "")}" contenteditable="false">`
    + `<span class="res-chip__icon">📦</span>`
    + `<span class="res-chip__name" contenteditable="true">${escHtml(name || "ресурс")}</span>`
    + `<span class="res-chip__count">`
    + `<button type="button" class="res-chip__btn" data-type="decrement" contenteditable="false">−</button>`
    + `<span class="res-chip__val">${escHtml(String(val))}</span>`
    + `<button type="button" class="res-chip__btn" data-type="increment" contenteditable="false">+</button>`
    + `</span>`
    + `<button type="button" class="ed-sp-unwrap" contenteditable="false" title="убрать ресурс из текста">×</button>`
    + `</span>`;
}

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
      return <Spoiler summary={sum.length ? sum : "Спойлер"}
        onUnwrap={ctx.onSpoilerUnwrap ? () => ctx.onSpoilerUnwrap(n) : null}
        onTrash={ctx.onSpoilerTrash ? () => ctx.onSpoilerTrash(n) : null}
      >{body}</Spoiler>;
    }
    case "text": return <Inline t={n} ctx={ctx} />;
    case "roller": {
      const e = n.attrs?.expr || n.attrs?.formula || "";
      return <button className="roller-btn" title="бросить"
        onClick={() => window.__rollExpr?.(`Бросок ${e}`, e)}>🎲 {e}</button>;
    }
    case "formula": return <code>{n.attrs?.formula || n.attrs?.expr || ""}</code>;
    case "resource": {
      const a = n.attrs || {};
      const live = a.id && ctx.resources ? ctx.resources[a.id] : null;
      const name = live ? (live.name || "ресурс") : (a.name || "ресурс");
      const cur = live ? (live.current ?? 0) : (a.current ?? 0);
      const mx = live ? (live.resolvedMax ?? live.max ?? 0) : (a.max ?? 0);
      const val = mx > 0 ? `${cur}/${mx}` : cur;
      const step = (d) => {
        if (!a.id || !ctx.onResource) return;
        let next = (cur ?? 0) + d;
        if (mx > 0) next = Math.min(next, mx);
        next = Math.max(0, next);
        ctx.onResource(a.id, { current: next });
      };
      // вне режима правки ресурс не открывается на настройки, но счётчик ± работает
      if (!ctx.editable) {
        return (
          <span className="res-chip res-chip_static" data-id={a.id}>
            <span className="res-chip__icon">📦</span>
            <span className="res-chip__name">{name}</span>
            <span className="res-chip__count">
              <button type="button" className="res-chip__btn" data-type="decrement"
                title="уменьшить" onClick={e => { e.stopPropagation(); step(-1); }}>−</button>
              <span className="res-chip__val">{val}</span>
              <button type="button" className="res-chip__btn" data-type="increment"
                title="увеличить" onClick={e => { e.stopPropagation(); step(1); }}>+</button>
            </span>
          </span>
        );
      }
      return (
        <span className="res-chip editable" data-id={a.id}
          role="button" tabIndex={0} title="настроить ресурс"
          onClick={(e) => { e.stopPropagation(); if (a.id && ctx.onResourceOpen) ctx.onResourceOpen(a.id); }}>
          <span className="res-chip__icon">📦</span>
          <span className="res-chip__name">{name}</span>
          <span className="res-chip__count">
            <button type="button" className="res-chip__btn" data-type="decrement"
              onClick={e => { e.stopPropagation(); step(-1); }}>−</button>
            <span className="res-chip__val">{val}</span>
            <button type="button" className="res-chip__btn" data-type="increment"
              onClick={e => { e.stopPropagation(); step(1); }}>+</button>
          </span>
          <button type="button" className="ed-sp-unwrap" title="убрать ресурс из текста">×</button>
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

/* Спойлер: тот же блок, что в редакторе (шеврон + тёмная плашка + тело).
   В режиме правки добавляются кнопки редактирования. */
function Spoiler({ summary, children, editable, onUnwrap, onTrash }) {
  const [open, setOpen] = useState(false);
  const toggle = (e) => { e.stopPropagation(); setOpen(o => !o); };
  return (
    <div className={"ed-sp" + (open ? " open" : "")}>
      <div className="ed-sp-head">
        <button type="button" className="ed-sp-chev" aria-expanded={open}
          aria-label={open ? "Свернуть" : "Развернуть"} onClick={toggle}>›</button>
        <span className="ed-sp-title" onClick={toggle}>{summary}</span>
        {onUnwrap ? (
          <button type="button" className="ed-sp-unwrap" title="убрать спойлер (текст останется)"
            onClick={(e) => { e.stopPropagation(); onUnwrap(); }}>×</button>
        ) : null}
        {onTrash ? (
          <button type="button" className="ed-sp-trash" title="удалить блок с текстом"
            onClick={(e) => { e.stopPropagation(); onTrash(); }}>🗑</button>
        ) : null}
      </div>
      {open ? <div className="ed-sp-body">{children}</div> : null}
    </div>
  );
}

/* ---------- Разбор инлайновых маркеров в текст ---------- */
const INLINE_RE = /(\*\*[^*]+\*\*|__[^_]+__|~~[^~]+~~|`[^`]+`|\*[^*\n]+\*|\{\{[^}]+\}\}?|\[\[[^\]]+\]\]|\[[^\]]+\]\([^)]+\))/g;

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
      const raw = tok.slice(2, -1).replace(/\}$/, "").trim();
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

/* ---------- Разбор документа на редактируемые сегменты ---------- */
export function docToSegments(doc) {
  const segs = [];
  for (const node of doc?.content || []) {
    if (node.type === "spoiler") {
      const sum = ((node.content || []).find(x => x.type === "spoilerSummary")?.content || [])
        .map(t => t.text || "").join("");
      const body = ((node.content || []).find(x => x.type === "spoilerContent")?.content || [])
        .map(p => inlineToText(p.content || [])).join("\n");
      segs.push({ type: "spoiler", summary: sum, body });
    } else if (node.type === "divider") {
      segs.push({ type: "text", text: "——" });
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const lines = [];
      const walk = (n, prefix) => {
        if (n.type === "listItem") {
          const t = inlineToText(n.content?.[0]?.content || []);
          lines.push(prefix + t);
          (n.content || []).slice(1).forEach(k => walk(k, prefix + "  "));
        }
      };
      (node.content || []).forEach((li, i) => walk(li, node.type === "orderedList" ? `${i + 1}. ` : "- "));
      segs.push({ type: "text", text: lines.join("\n") });
    } else {
      segs.push({ type: "text", text: inlineToText(node.content || []) });
    }
  }
  return segs.length ? segs : [{ type: "text", text: "" }];
}

export function segmentsToDoc(segs) {
  const content = [];
  for (const seg of segs) {
    if (seg.type === "spoiler") {
      content.push({
        type: "spoiler",
        content: [
          { type: "spoilerSummary", content: [{ type: "text", text: seg.summary || "" }] },
          { type: "spoilerContent", content: [{ type: "paragraph", content: parseInline(seg.body || "") }] },
        ],
      });
      continue;
    }
    const t = (seg.text || "").trim();
    if (!t) continue;
    if (t === "——") { content.push({ type: "divider" }); continue; }
    content.push(...textToDoc(seg.text).content);
  }
  if (!content.length) content.push({ type: "paragraph", content: [] });
  return { type: "doc", content };
}

/* ---------- Сериализация inline-узлов в текст ---------- */
function inlineToText(children) {
  return (children || []).map(ch => {
    if (ch.type === "text") {
      let t = ch.text ?? "";
      const marks = ch.marks || [];
      const link = marks.find(m => m.type === "link");
      if (marks.some(m => m.type === "bold")) t = `**${t}**`;
      if (marks.some(m => m.type === "italic")) t = `*${t}*`;
      if (marks.some(m => m.type === "underline")) t = `__${t}__`;
      if (marks.some(m => m.type === "strike")) t = `~~${t}~~`;
      if (marks.some(m => m.type === "code")) t = `\`${t}\``;
      if (link) t = `[${t}](${link.attrs?.href || ""})`;
      return t;
    }
    if (ch.type === "resource") {
      const a = ch.attrs || {};
      return resourceBlockHtml(a.id, a.name, a.current ?? 0, a.max ?? 0);
    }
    if (ch.type === "roller") return `[[${ch.attrs?.expr || ch.attrs?.formula || ""}]]`;
    if (ch.type === "formula") return `\`${ch.attrs?.formula || ch.attrs?.expr || ""}\``;
    return flatText(ch);
  }).join("");
}

/* ---------- Конвертация plain text ↔ doc ---------- */
export function docToText(doc) {
  if (!doc || !doc.content) return "";
  const lines = [];
  const walk = (n, prefix = "") => {
    switch (n.type) {
      case "paragraph": lines.push(prefix + inlineToText(n.content)); break;
      case "heading": lines.push(prefix + inlineToText(n.content)); break;
      case "bulletList": case "taskList": (n.content || []).forEach(li => walk(li, prefix + "- ")); break;
      case "orderedList": (n.content || []).forEach((li, i) => walk(li, prefix + `${i + 1}. `)); break;
      case "listItem": (n.content || []).forEach(k => walk(k, prefix)); break;
      case "divider": lines.push(prefix + "——"); break;
      case "spoiler": {
        const sum = (n.content || []).filter(x => x.type === "spoilerSummary").map(flatText).join("");
        const body = (n.content || []).filter(x => x.type === "spoilerContent")
          .map(x => (x.content || []).map(p => inlineToText(p.content || [p])).join("\n")).join("\n");
        lines.push(prefix + `||${sum}||${body}||`);
        break;
      }
      case "roller": lines.push(prefix + `[[${n.attrs?.expr || n.attrs?.formula || ""}]]`); break;
      case "resource": lines.push(prefix + `{{${n.attrs?.id || ""}${n.attrs?.id ? "::" : ""}${n.attrs?.name || ""}}}`); break;
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

/* ---------- Работа с contenteditable-редактором ---------- */
const escHtml = (s) => String(s ?? "")
  .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function inlineToHtml(nodes, ctx = {}) {
  return (nodes || []).map(ch => {
    if (ch.type === "text") {
      let t = escHtml(ch.text);
      const marks = ch.marks || [];
      if (marks.some(m => m.type === "bold")) t = `<b>${t}</b>`;
      if (marks.some(m => m.type === "italic")) t = `<i>${t}</i>`;
      if (marks.some(m => m.type === "underline")) t = `<u>${t}</u>`;
      if (marks.some(m => m.type === "strike")) t = `<s>${t}</s>`;
      if (marks.some(m => m.type === "code")) t = `<code>${t}</code>`;
      const link = marks.find(m => m.type === "link");
      if (link) t = `<a href="${escHtml(link.attrs?.href || "#")}">${t}</a>`;
      return t;
    }
    if (ch.type === "resource") {
      const a = ch.attrs || {};
      const live = a.id && ctx.resources ? ctx.resources[a.id] : null;
      const nm = live ? (live.name || "ресурс") : (a.name || "ресурс");
      const cv = live ? (live.current ?? 0) : (a.current ?? 0);
      const mx = live ? (live.resolvedMax ?? live.max ?? 0) : (a.max ?? 0);
      return resourceBlockHtml(a.id, nm, cv, mx);
    }
    if (ch.type === "roller") {
      const e = ch.attrs?.expr || ch.attrs?.formula || "";
      return `<span class="ed-roller" contenteditable="false">🎲 ${escHtml(e)}</span>`;
    }
    return "";
  }).join("");
}

/* разбор HTML-узлов в inline-узлы документа */
function htmlToInline(node) {
  const out = [];
  const walk = (n, marks) => {
    if (!n) return;
    if (n.nodeType === 3) {
      const t = n.textContent;
      if (t) out.push({ type: "text", text: t, marks });
      return;
    }
    if (n.nodeType !== 1) return;
    const tag = n.tagName.toLowerCase();
    if (tag === "br") { out.push({ type: "text", text: "\n", marks }); return; }
    if (n.classList?.contains("ed-sp-res")) {
      const t = n.querySelector?.(".res-chip__name");
      out.push({ type: "resource", attrs: { id: n.dataset.res || "", name: (t?.textContent || "").trim() } });
      return;
    }
    if (n.classList?.contains("ed-res") || n.classList?.contains("ed-res-row")) {
      out.push({ type: "resource", attrs: { id: n.dataset.res || "", name: n.textContent.replace(/^📦\s*/, "") } });
      return;
    }
    if (n.classList?.contains("ed-roller")) {
      out.push({ type: "roller", attrs: { expr: n.textContent.replace(/^🎲\s*/, "") } });
      return;
    }
    let m = marks;
    if (tag === "b" || tag === "strong") m = [...m, { type: "bold" }];
    else if (tag === "i" || tag === "em") m = [...m, { type: "italic" }];
    else if (tag === "u") m = [...m, { type: "underline" }];
    else if (tag === "s" || tag === "strike") m = [...m, { type: "strike" }];
    else if (tag === "code") m = [...m, { type: "code" }];
    else if (tag === "a") m = [...m, { type: "link", attrs: { href: n.getAttribute("href") || "#" } }];
    for (const c of n.childNodes) walk(c, m);
  };
  if (node.nodeType === 3 || node.nodeType === 1) walk(node, []);
  return out;
}

/* содержимое контейнера → массив абзацев (голый текст тоже считаем абзацем) */
function collectParagraphs(container) {
  const out = [];
  let buf = [];
  const flush = () => { if (buf.length) { out.push({ type: "paragraph", content: buf }); buf = []; } };
  if (!container) return out;
  for (const node of Array.from(container.childNodes)) {
    if (node.nodeType === 3) {
      if (node.textContent.trim()) buf.push({ type: "text", text: node.textContent, marks: [] });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();
    if (node.classList?.contains("ed-guard")) continue;
    if (tag === "p" || tag === "div") {
      flush();
      out.push({ type: "paragraph", content: htmlToInline(node) });
      continue;
    }
    if (tag === "br") { buf.push({ type: "text", text: "\n", marks: [] }); continue; }
    buf.push(...htmlToInline(node));
  }
  flush();
  return out;
}

/* документ → HTML для редактора (спойлеры встроены в общий текстовый слой) */
export function docToEditorHtml(doc, ctx = {}) {
  const parts = [];
  for (const node of doc?.content || []) {
    if (node.type === "spoiler") {
      const sum = ((node.content || []).find(x => x.type === "spoilerSummary")?.content || [])
        .map(t => inlineToHtml([t], ctx)).join("");
      const body = ((node.content || []).find(x => x.type === "spoilerContent")?.content || [])
        .map(p => `<p>${inlineToHtml(p.content, ctx)}</p>`).join("") || "<p><br></p>";
      parts.push(
        GUARD_HTML +
        `<div class="ed-sp" data-sp="1" contenteditable="false">` +
        `<div class="ed-sp-head">` +
        `<button type="button" class="ed-sp-chev" contenteditable="false" title="развернуть/свернуть">›</button>` +
        `<span class="ed-sp-title" contenteditable="true">${sum || "Спойлер"}</span>` +
        `<button type="button" class="ed-sp-unwrap" contenteditable="false" title="убрать спойлер (текст останется)">×</button>` +
        `<button type="button" class="ed-sp-trash" contenteditable="false" title="удалить блок с текстом">🗑</button>` +
        `</div><div class="ed-sp-body" contenteditable="true">${body}</div></div>` +
        GUARD_HTML
      );
    } else if (node.type === "resource") {
      const a = node.attrs || {};
      const live = a.id && ctx.resources ? ctx.resources[a.id] : null;
      const nm = live ? (live.name || "ресурс") : (a.name || "ресурс");
      const cv = live ? (live.current ?? 0) : (a.current ?? 0);
      const mx = live ? (live.resolvedMax ?? live.max ?? 0) : (a.max ?? 0);
      parts.push(resourceBlockHtml(a.id, nm, cv, mx));
    } else if (node.type === "divider") {
      parts.push(`<hr class="ed-divider">`);
    } else if (node.type === "bulletList" || node.type === "orderedList") {
      const tag = node.type === "orderedList" ? "ol" : "ul";
      const items = (node.content || []).map(li =>
        `<li>${inlineToHtml(li.content?.[0]?.content || [], ctx)}</li>`).join("");
      parts.push(`<${tag} class="ed-list">${items}</${tag}>`);
    } else {
      parts.push(`<p class="ed-p">${inlineToHtml(node.content, ctx)}</p>`);
    }
  }
  return parts.join("") || `<p class="ed-p"><br></p>`;
}

/* содержимое редактора → документ */
export function editorToDoc(root) {
  const content = [];
  let buf = [];
  const flush = () => { if (buf.length) { content.push({ type: "paragraph", content: buf }); buf = []; } };

  for (const node of Array.from(root.childNodes)) {
    // голый текст в корне — тоже абзац
    if (node.nodeType === 3) {
      if (node.textContent.trim()) buf.push({ type: "text", text: node.textContent, marks: [] });
      continue;
    }
    if (node.nodeType !== 1) continue;
    const tag = node.tagName.toLowerCase();

    // защитная пустая строка — в документ не попадает (непустая — обычный абзац)
    if (node.classList?.contains("ed-guard")) {
      const txt = (node.textContent || "").replace(/[\u200b\s]/g, "");
      if (!txt) { flush(); continue; }
    }

    if (node.classList?.contains("ed-sp-res")) {
      flush();
      const t = node.querySelector(".res-chip__name");
      content.push({ type: "resource", attrs: { id: node.dataset.res || "", name: (t?.textContent || "").trim() } });
      continue;
    }
    if (node.classList?.contains("ed-sp")) {
      flush();
      const title = node.querySelector(".ed-sp-title");
      const bodyEl = node.querySelector(".ed-sp-body");
      const bodyContent = collectParagraphs(bodyEl);
      content.push({
        type: "spoiler",
        content: [
          { type: "spoilerSummary", content: [{ type: "text", text: (title?.textContent || "").trim() }] },
          { type: "spoilerContent", content: bodyContent.length ? bodyContent : [{ type: "paragraph", content: [] }] },
        ],
      });
      continue;
    }
    if (node.classList?.contains("ed-res-row")) {
      flush();
      content.push({ type: "resource", attrs: { id: node.dataset.res || "", textName: "" } });
      continue;
    }
    if (tag === "hr") { flush(); content.push({ type: "divider" }); continue; }
    if (tag === "ul" || tag === "ol") {
      flush();
      const items = Array.from(node.children)
        .map(li => ({ type: "listItem", content: [{ type: "paragraph", content: htmlToInline(li) }] }))
        .filter(li => li.content[0].content.length);
      if (items.length) content.push({ type: tag === "ol" ? "orderedList" : "bulletList", content: items });
      continue;
    }
    if (tag === "p" || tag === "div") {
      flush();
      content.push({ type: "paragraph", content: htmlToInline(node) });
      continue;
    }
    // прочие inline-элементы — в текущий абзац
    buf.push(...htmlToInline(node));
  }
  flush();
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
