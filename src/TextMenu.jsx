import React, { useEffect, useRef, useState } from "react";

/* Контекстное меню редактора текстового блока (ПКМ) — как на longstoryshort.app */
export default function TextMenu({ x, y, onClose, onFormat, onInsert, resources = [] }) {
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) onClose(); };
    const key = (e) => { if (e.key === "Escape") onClose(); };
    const t = setTimeout(() => document.addEventListener("mousedown", close), 0);
    document.addEventListener("keydown", key);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", close); document.removeEventListener("keydown", key); };
  }, [onClose]);

  const items = [
    { group: "Формат", entries: [
      { label: "Жирный", mark: "**", title: "Ctrl+B" },
      { label: "Курсив", mark: "*", title: "Ctrl+I" },
      { label: "Подчёркнутый", mark: "__" },
      { label: "Зачёркнутый", mark: "~~" },
      { label: "Код", mark: "`" },
    ] },
    { group: "Вставка", entries: [
      { label: "🎲 Бросок кубиков", action: "roll" },
      { label: "❓ Спойлер", action: "spoiler" },
      { label: "📦 Ресурс", action: "resource", sub: true },
      { label: "— Разделитель", action: "divider" },
      { label: "• Список", action: "list" },
    ] },
  ];

  const left = Math.min(x, window.innerWidth - 240);
  const top = Math.min(y, window.innerHeight - 320);

  return (
    <div className="ctx-menu" ref={ref} style={{ left, top }}>
      {items.map(g => (
        <div key={g.group} className="ctx-group">
          <div className="ctx-group-title">{g.group}</div>
          {g.entries.map(e => (
            <button key={e.label} className="ctx-item" title={e.title || ""}
              onClick={() => {
                if (e.mark) onFormat(e.mark);
                else if (e.action === "roll") onInsert("roll");
                else if (e.action === "spoiler") onInsert("spoiler");
                else if (e.action === "resource") onInsert("resource");
                else if (e.action === "divider") onInsert("divider");
                else if (e.action === "list") onInsert("list");
                onClose();
              }}>
              {e.label}
              {e.sub && resources.length ? <span className="ctx-sub">{resources.length}</span> : null}
            </button>
          ))}
        </div>
      ))}
      {resources.length ? (
        <div className="ctx-group ctx-res">
          <div className="ctx-group-title">Ресурсы персонажа</div>
          {resources.slice(0, 8).map(r => (
            <button key={r.id} className="ctx-item" onClick={() => { onInsert("resource", r); onClose(); }}>
              {r.name} <span className="ctx-sub">{r.current}/{r.max}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
