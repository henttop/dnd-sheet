import React, { useEffect, useState } from "react";
import { Toggle } from "./ui.jsx";
import { evalStat } from "./dice.js";

/* Модалка ресурса (?modal=resource) */

export default function ResourceModal({ resource, onChange, onDelete, onClose }) {
  const r = resource || {};
  const [name, setName] = useState(r.name || "");
  const [current, setCurrent] = useState(r.current ?? 0);
  const [max, setMax] = useState(r.max ?? 0);
  const [formula, setFormula] = useState(r.formula || "");
  const [shortRest, setShortRest] = useState(!!r.isShortRest);
  const [longRest, setLongRest] = useState(!!r.isLongRest);
  const [notes, setNotes] = useState(r.notes?.value || "");
  const [showNotes, setShowNotes] = useState(!!r.showNotes);

  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const commit = (patch) => onChange({
    ...r,
    id: r.id || "resource-" + Date.now(),
    name, current, max, formula,
    isShortRest: shortRest, isLongRest: longRest,
    notes: { value: notes },
    showNotes,
    ...patch,
  });

  const restorable = shortRest || longRest;

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal res-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>

        <div className="res-modal-head">
          <div>
            <h3 className="modal-title">РЕСУРС</h3>
            {restorable ? <span className="res-restore-tag">ВОССТАНОВИТЬ</span> : null}
          </div>
          <div className="res-circle">
            <span className="res-circle-v">{current}</span>
            <span className="res-circle-l">ТЕКУЩЕЕ</span>
          </div>
        </div>

        <div className="res-block">
          <div className="res-label">НАЗВАНИЕ</div>
          <input className="f-input" value={name} placeholder="например: Ярость"
            onChange={e => { setName(e.target.value); commit({ name: e.target.value }); }} />
        </div>

        <div className="res-block">
          <div className="res-label">ЗНАЧЕНИЯ</div>
          <div className="res-values">
            <label className="pop-field">ТЕКУЩЕЕ
              <input type="number" className="edit-in" value={current}
                onChange={e => { const v = +e.target.value || 0; setCurrent(v); commit({ current: v }); }} />
            </label>
            <label className="pop-field">МАКСИМУМ
              <input className="f-input" value={max ?? ""} placeholder="0"
                onChange={e => { const v = e.target.value; setMax(v); commit({ max: v }); }} />
            </label>
            <label className="pop-field res-formula" title="формула, например 10 или [PROF]*2">ƒ
              <input className="f-input" value={formula} placeholder="формула"
                onChange={e => { setFormula(e.target.value); commit({ formula: e.target.value }); }} />
            </label>
          </div>
          {formula ? (() => {
            const fi = evalStat(formula, typeof window !== "undefined" ? window.__activeChar : null, 0);
            return fi.isFormula ? (
              <div className="f-hint" style={{ marginTop: 6, color: "var(--purple2)" }}>
                ƒ {fi.raw} → <b>{fi.resolved}</b> = <b>{fi.total}</b>
              </div>
            ) : null;
          })() : null}
        </div>

        <div className="res-block">
          <div className="res-label">ВОССТАНОВЛЕНИЕ</div>
          <Toggle checked={shortRest} label="Короткий отдых"
            onChange={v => { setShortRest(v); commit({ isShortRest: v }); }} />
          <Toggle checked={longRest} label="Продолжительный отдых"
            onChange={v => { setLongRest(v); commit({ isLongRest: v }); }} />
        </div>

        <div className="res-block">
          <div className="res-label">ЗАМЕТКИ</div>
          <textarea className="rt-edit" rows={3} value={notes} placeholder="Заметки к ресурсу"
            onChange={e => { setNotes(e.target.value); commit({ notes: { value: e.target.value } }); }} />
          <div className="res-label">ЗАМЕТКИ</div>
          <Toggle checked={showNotes} label="Отображать заметки"
            onChange={v => { setShowNotes(v); commit({ showNotes: v }); }} />
        </div>

        <div className="res-foot">
          {onDelete ? <button className="f-btn danger" onClick={onDelete}>Удалить</button> : null}
        </div>
      </div>
    </div>
  );
}
