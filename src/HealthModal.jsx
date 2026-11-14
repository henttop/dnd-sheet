import React, { useState } from "react";
import { hp, statMod } from "./helpers.js";
import { rollDiceExpr } from "./dice.js";
import { toast } from "./toast.jsx";

/* Модалка здоровья — по образцу longstoryshort.app (?modal=health):
   калькулятор хитов слева, цифровая клавиатура, действия
   ВРЕМЕННЫЕ / ЛЕЧЕНИЕ / УРОН и кнопка настроек. */

const HeartPulseIcon = () => (
  <svg className="calc-health__pulse" width="30" height="16" viewBox="0 0 20 11" fill="#66A8A9" aria-hidden="true">
    <path d="M12.89 0.52C12.55-.17 11.44-.17 11.1.52L8 6.91 6.89 4.64C6.72 4.29 6.38 4.07 6 4.07H0v2.06h5.38l1.72 3.55c.18.35.52.56.9.56s.72-.21.89-.56L12 3.29l1.11 2.27c.17.35.51.57.89.57H20V4.07h-5.38L12.89.52Z" />
  </svg>
);

const PotionIcon = () => (
  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9.5 2h5v1.6h-1v3.2l4.3 8.4A3 3 0 0 1 15 19.5H9a3 3 0 0 1-2.8-4.3l4.3-8.4V3.6H9.5V2Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6.9 14.6h10.2l.9 1.9a2 2 0 0 1-1.8 3H7.8a2 2 0 0 1-1.8-3l.9-1.9Z" fill="#e64747" fillOpacity=".85" />
  </svg>
);

const FlaskIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden="true">
    <path d="M9 2h6v2h-1.2v4.4l4.6 9.1A2.6 2.6 0 0 1 16.1 21H7.9a2.6 2.6 0 0 1-2.3-3.5l4.6-9.1V4H9V2Z"
      stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round" />
    <path d="M6.6 14.5h10.8l.9 1.8a1.8 1.8 0 0 1-1.6 2.6H7.3a1.8 1.8 0 0 1-1.6-2.6l.9-1.8Z" fill="#e64747" fillOpacity=".85" />
  </svg>
);

export default function HealthModal({ c, onSave, onClose }) {
  const [digits, setDigits] = useState("");
  const [sign, setSign] = useState(1);
  const [view, setView] = useState("calc");

  const v = c.data.vitality ||= {};
  const h = hp(c);
  const num = Math.abs(parseInt(digits || "0", 10) || 0);

  const setHp = (val) => {
    v["hp-current"] = { value: Math.max(0, Math.min(h.max, val)) };
    onSave();
  };
  const setTemp = (val) => { v["hp-temp"] = { value: Math.max(0, val) }; onSave(); };

  const addDigit = (d) => setDigits(s => (s + d).slice(0, 4));
  const backspace = () => setDigits(s => s.slice(0, -1));

  const applyHeal = () => {
    if (!num) return;
    setHp(h.cur + num);
    setDigits("");
    toast(`Лечение: +${num} хитов`, "good");
  };
  const applyDamage = () => {
    if (!num) return;
    setHp(h.cur - num);
    setDigits("");
    toast(`Урон: −${num} хитов`, "bad");
  };
  const applyTemp = () => {
    if (!num && sign > 0) return;
    if (sign < 0) { setTemp(0); toast("Временные хиты сняты", "info"); }
    else { setTemp(num); toast(`Временные хиты: +${num}`, "info"); }
    setDigits("");
  };

  const healingPotion = () => {
    const r = rollDiceExpr("2d4+2");
    if (!r) return;
    setHp(h.cur + r.total);
    setDigits("");
    toast(`Зелье лечения: ${r.raw.join("+")}+2 = ${r.total}`, "good");
  };

  const shortRest = () => {
    const heal = 1 + Math.floor(Math.random() * 10) + statMod(c, "con");
    setHp(Math.min(h.max, h.cur + Math.max(0, heal)));
    toast(`Короткий отдых: +${Math.max(0, heal)} хитов`, "good");
  };
  const longRest = () => {
    v["hp-max"] && (v["hp-current"] = { value: h.max });
    v["hp-temp"] = { value: 0 };
    c.data.exhaustion = Math.max(0, (+c.data.exhaustion || 0) - 1);
    onSave();
    toast("Длинный отдых: хиты восстановлены", "good");
  };

  const key = (n, cls = "calc-button calc-button_lg") => (
    <button key={n} type="button" className={cls} data-type={n} onClick={() => addDigit(String(n))}>{n}</button>
  );

  const shown = digits === "" ? "" : (sign < 0 ? "−" : "") + digits;

  return (
    <div className="hp-modal-back" onMouseDown={onClose}>
      <div className="hp-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal__close hp-modal__close" type="button" onClick={onClose}>×</button>

        {view === "calc" ? (
          <div className="calc-health">
            <div className="calc-health__info">
              <HeartPulseIcon />
              <span>{h.cur}/{h.max}</span>
              {h.temp ? <span className="calc-health__temp">+{h.temp}</span> : null}
            </div>

            <div className="calculator">
              <div className="calculator__row calculator__row-top">
                <div className="calculator__main">
                  <div className="calc-input__wrapper">
                    <input className="calc-input" type="text" readOnly value={shown} placeholder="0" />
                  </div>
                </div>
                <div className="calculator__sub">
                  <button type="button" className="calc-button calc-button_sm calc-backspace"
                    title="стереть последний символ" onClick={backspace}>⌫</button>
                </div>
              </div>

              <div className="calculator__row">
                <div className="calculator__main">{key(7)}{key(8)}{key(9)}</div>
                <div className="calculator__sub">
                  <button type="button" className="calc-button calc-button_sm calc-go-btn calc-go-btn_go-potion"
                    title="Зелье лечения (2к4+2)" onClick={healingPotion}><PotionIcon /></button>
                </div>
              </div>

              <div className="calculator__row">
                <div className="calculator__main">{key(4)}{key(5)}{key(6)}</div>
                <div className="calculator__sub">
                  <button type="button" className="calc-button calc-button_sm calc-go-btn calc-go-btn_go-potion"
                    title="Зелье лечения (2к4+2)" onClick={healingPotion}><PotionIcon /></button>
                </div>
              </div>

              <div className="calculator__row">
                <div className="calculator__main">{key(1)}{key(2)}{key(3)}</div>
                <div className="calculator__sub">
                  <button type="button" className="calc-button calc-button_sm calc-go-btn calc-go-btn_go-potion"
                    title="Зелье лечения (2к4+2)" onClick={healingPotion}><PotionIcon /></button>
                </div>
              </div>

              <div className="calculator__row">
                <div className="calculator__main">
                  {key(0)}
                  <button type="button" className={"calc-button calc-button_lg calc-go-btn " + (sign > 0 ? "calc-go-btn_go-sign is-active" : "calc-go-btn_go-sign")}
                    title="плюс" onClick={() => setSign(1)}>+</button>
                  <button type="button" className={"calc-button calc-button_lg calc-go-btn " + (sign < 0 ? "calc-go-btn_go-sign is-active" : "calc-go-btn_go-sign")}
                    title="минус" onClick={() => setSign(-1)}>−</button>
                </div>
                <div className="calculator__sub">
                  <button type="button" className="calc-button calc-button_sm calc-go-btn calc-go-btn_go-potion"
                    title="Снять временные хиты" onClick={() => { setTemp(0); toast("Временные хиты сняты", "info"); }}><FlaskIcon /></button>
                </div>
              </div>

              <div className="calculator__row">
                <div className="calculator__main">
                  <button type="button" className="calc-button calc-button_lg calc-go-btn calc-go-btn_go-temp"
                    onClick={applyTemp}>ВРЕМЕННЫЕ</button>
                  <button type="button" className="calc-button calc-button_lg calc-go-btn calc-go-btn_go-heal"
                    onClick={applyHeal}>ЛЕЧЕНИЕ</button>
                  <button type="button" className="calc-button calc-button_lg calc-go-btn calc-go-btn_go-damage"
                    onClick={applyDamage}>УРОН</button>
                </div>
                <div className="calculator__sub">
                  <button type="button" className="calc-button calc-button_sm calc-go-btn calc-health__settings-btn"
                    title="настройки хитов" onClick={() => setView("settings")}>⚙</button>
                </div>
              </div>
            </div>
          </div>
        ) : (
          <div className="hp-modal__settings">
            <h3 className="hp-modal__title">ХИТЫ</h3>
            <div className="hp-set-row">
              <label className="pop-field">Текущие
                <input type="number" className="edit-in" value={h.cur}
                  onChange={e => { v["hp-current"] = { value: Math.max(0, Math.min(h.max, +e.target.value || 0)) }; onSave(); }} />
              </label>
              <label className="pop-field">Максимум
                <input type="number" className="edit-in" value={h.max}
                  onChange={e => { v["hp-max"] = { value: Math.max(0, +e.target.value || 0) }; onSave(); }} />
              </label>
              <label className="pop-field">Временные
                <input type="number" className="edit-in" value={h.temp}
                  onChange={e => { v["hp-temp"] = { value: Math.max(0, +e.target.value || 0) }; onSave(); }} />
              </label>
            </div>
            <div className="rest-row">
              <button title="Короткий отдых: восстановить одну кость хитов (1к10 + модификатор Телосложения)"
                onClick={shortRest}>Короткий отдых</button>
              <button title="Длинный отдых: все хиты, сброс темп. HP, −1 истощение"
                onClick={longRest}>Длинный отдых</button>
            </div>
            <button className="hp-modal__back" onClick={() => setView("calc")}>← Калькулятор</button>
          </div>
        )}
      </div>
    </div>
  );
}
