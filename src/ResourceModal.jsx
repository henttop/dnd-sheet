import React, { useEffect, useState } from "react";

/* Модалка ресурса — по образцу longstoryshort.app */
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

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal res-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>

        <div className="res-head">
          <div>
            <div className="res-title">РЕСУРС</div>
            {r.isLongRest || r.isShortRest ? (
              <span className="res-restore-tag">ВОССТАНОВИТЬ</span>
            ) : null}
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
              <input className="f-input" value={typeof max === "string" ? max : (formula || max)} placeholder="10"
                onChange={e => {
                  const v = e.target.value;
                  setMax(v);
                  setFormula(/[^\d\s]/.test(v) ? v : "");
                  commit({ max: /[^\d\s]/.test(v) ? max : (parseInt(v, 10) || 0), formula: /[^\d\s]/.test(v) ? v : "" });
                }} />
            </label>
          </div>
        </div>

        <div className="res-block">
          <div className="res-label">ВОССТАНОВЛЕНИЕ</div>
          <label className="f-check">
            <input type="checkbox" checked={shortRest} onChange={e => { setShortRest(e.target.checked); commit({ isShortRest: e.target.checked }); }} />
            <span>Короткий отдых</span>
          </label>
          <label className="f-check">
            <input type="checkbox" checked={longRest} onChange={e => { setLongRest(e.target.checked); commit({ isLongRest: e.target.checked }); }} />
            <span>Продолжительный отдых</span>
          </label>
        </div>

        <div className="res-block">
          <div className="res-label">ЗАМЕТКИ</div>
          <textarea className="rt-edit" rows={3} value={notes}
            onChange={e => { setNotes(e.target.value); commit({ notes: { value: e.target.value } }); }} />
          <div className="res-label">ЗАМЕТКИ</div>
          <label className="f-check">
            <input type="checkbox" checked={showNotes} onChange={e => { setShowNotes(e.target.checked); commit({ showNotes: e.target.checked }); }} />
            <span>Отображать заметки</span>
          </label>
        </div>

        <div className="res-foot">
          {onDelete ? <button className="f-btn danger" onClick={onDelete}>Удалить</button> : null}
        </div>
      </div>
    </div>
  );
}
