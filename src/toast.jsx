import React, { useEffect, useState } from "react";

/* Внутренние уведомления (вместо системных alert) */

let items = [];
const subs = new Set();

export function toast(text, type = "info", ttl = 4000) {
  const id = Date.now() + Math.random();
  items = [...items, { id, text, type }];
  subs.forEach(f => f(items));
  setTimeout(() => dismissToast(id), ttl);
}

export function dismissToast(id) {
  items = items.filter(i => i.id !== id);
  subs.forEach(f => f(items));
}

export function Toaster() {
  const [list, setList] = useState(items);
  useEffect(() => {
    subs.add(setList);
    return () => { subs.delete(setList); };
  }, []);
  if (!list.length) return null;
  return (
    <div className="toast-wrap">
      {list.map(t => (
        <div key={t.id} className={"toast toast-" + t.type}>
          <span>{t.text}</span>
          <button className="toast-x" onClick={() => dismissToast(t.id)}>×</button>
        </div>
      ))}
    </div>
  );
}
