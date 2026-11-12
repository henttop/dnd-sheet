import React, { useEffect, useState } from "react";

/* Модалка «Настроить оружие» — как на longstoryshort.app (?modal=weapon) */
export default function WeaponModal({ weapon, onChange, onDelete, onClose }) {
  const [name, setName] = useState(weapon.name?.value || "");
  const [mod, setMod] = useState(weapon.mod?.value ?? "");
  const [dmg, setDmg] = useState(weapon.dmg?.value || "");

  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);

  const commit = (patch) => {
    onChange({
      ...weapon,
      name: { value: patch.name ?? name },
      mod: { value: patch.mod ?? mod },
      dmg: { value: patch.dmg ?? dmg },
    });
  };

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>
        <h3 className="modal-title">НАСТРОИТЬ ОРУЖИЕ</h3>

        <div className="f-label">НАЗВАНИЕ</div>
        <input className="f-input" autoFocus value={name} placeholder="Например: Меч"
          onChange={e => { setName(e.target.value); commit({ name: e.target.value }); }} />

        <div className="sp-cast-set-row" style={{ marginTop: 12 }}>
          <label className="pop-field">БОНУС АТАКИ
            <input className="edit-in" value={mod} placeholder="+0"
              onChange={e => { setMod(e.target.value); commit({ mod: e.target.value }); }} />
          </label>
          <label className="pop-field">УРОН / ВИД
            <input className="edit-in" value={dmg} placeholder="1d6 дробящий"
              onChange={e => { setDmg(e.target.value); commit({ dmg: e.target.value }); }} />
          </label>
        </div>

        <div className="f-hint" style={{ marginTop: 8 }}>
          Бонус атаки: 1к20 {mod || "+0"} · Урон: {dmg || "—"}
        </div>

        <div className="f-btns" style={{ marginTop: 14 }}>
          {onDelete ? <button className="f-btn danger" onClick={onDelete}>Удалить</button> : null}
          <button className="f-btn primary" onClick={onClose}>Готово</button>
        </div>
      </div>
    </div>
  );
}
