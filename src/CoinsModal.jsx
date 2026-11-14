import React, { useState, useEffect } from "react";
import { coinsTotal } from "./helpers.js";
import { toast } from "./toast.jsx";

export const COINS = [
  { key: "gp", label: "Золото", abbrev: "З", rate: 1, color: "#fab005", bg: "rgba(250,176,5,.15)" },
  { key: "sp", label: "Серебро", abbrev: "С", rate: 0.1, color: "#ced4da", bg: "rgba(206,212,218,.15)" },
  { key: "cp", label: "Медь", abbrev: "М", rate: 0.01, color: "#f08c00", bg: "rgba(240,140,0,.15)" },
  { key: "pp", label: "Платина", abbrev: "П", rate: 10, color: "#74c0fc", bg: "rgba(116,192,252,.15)" },
  { key: "ep", label: "Электрум", abbrev: "Э", rate: 0.5, color: "#b197fc", bg: "rgba(177,151,252,.15)" },
];

export const COIN_MAP = Object.fromEntries(COINS.map(c => [c.key, c]));

export const COIN_VALUES_CP = {
  pp: 1000,
  gp: 100,
  ep: 50,
  sp: 10,
  cp: 1,
};

export const getTotalCP = (coinsData) => {
  return Object.keys(COIN_VALUES_CP).reduce((acc, k) => {
    return acc + (coinsData[k]?.value ?? 0) * COIN_VALUES_CP[k];
  }, 0);
};

export function deductCoins(coinsData, amount, targetCoin) {
  const targetRate = COIN_VALUES_CP[targetCoin] || 100;
  const costCP = amount * targetRate;
  const totalCP = getTotalCP(coinsData);

  if (costCP > totalCP) {
    const totalInTarget = (totalCP / targetRate).toFixed(totalCP % targetRate === 0 ? 0 : 2);
    return {
      success: false,
      error: `Недостаточно средств (нужно: ${amount}, доступно: ${totalInTarget})`,
    };
  }

  const next = {
    pp: coinsData.pp?.value ?? 0,
    gp: coinsData.gp?.value ?? 0,
    ep: coinsData.ep?.value ?? 0,
    sp: coinsData.sp?.value ?? 0,
    cp: coinsData.cp?.value ?? 0,
  };

  let wasExchanged = false;

  // 1. Оплата напрямую из выбранной монеты
  const haveDirect = next[targetCoin] ?? 0;
  const payDirect = Math.min(haveDirect, amount);
  next[targetCoin] -= payDirect;
  let remCP = (amount - payDirect) * targetRate;

  if (remCP > 0) {
    wasExchanged = true;
    // 2. Ищем наименьшую отдельную монету, способную покрыть remCP
    const candidates = ["cp", "sp", "ep", "gp", "pp"].filter(
      k => COIN_VALUES_CP[k] >= remCP && (next[k] ?? 0) > 0
    );

    if (candidates.length > 0) {
      const breakCoin = candidates[0];
      next[breakCoin] -= 1;
      let changeCP = COIN_VALUES_CP[breakCoin] - remCP;
      remCP = 0;

      // Раскладываем сдачу в стандартные монеты (pp, gp, sp, cp)
      for (const k of ["pp", "gp", "sp", "cp"]) {
        const rate = COIN_VALUES_CP[k];
        const count = Math.floor(changeCP / rate);
        if (count > 0) {
          next[k] = (next[k] ?? 0) + count;
          changeCP -= count * rate;
        }
      }
    } else {
      // 3. Собираем сумму из доступных монет от крупных к мелким с разменом последней
      for (const k of ["pp", "gp", "ep", "sp", "cp"]) {
        if (remCP <= 0) break;
        const rate = COIN_VALUES_CP[k];
        while ((next[k] ?? 0) > 0 && remCP > 0) {
          if (rate <= remCP) {
            const take = Math.min(next[k], Math.floor(remCP / rate));
            next[k] -= take;
            remCP -= take * rate;
          } else {
            next[k] -= 1;
            let changeCP = rate - remCP;
            remCP = 0;
            for (const c of ["pp", "gp", "sp", "cp"]) {
              const r = COIN_VALUES_CP[c];
              const count = Math.floor(changeCP / r);
              if (count > 0) {
                next[c] = (next[c] ?? 0) + count;
                changeCP -= count * r;
              }
            }
            break;
          }
        }
      }
    }
  }

  for (const k of ["pp", "gp", "ep", "sp", "cp"]) {
    coinsData[k] = { value: next[k] };
  }

  return { success: true, wasExchanged };
}

export function CoinBadge({ coinKey, size = "normal" }) {
  const c = COIN_MAP[coinKey] || COIN_MAP.gp;
  const isSm = size === "sm";
  return (
    <span
      className={`coin-badge coin-badge_${coinKey} ${isSm ? "coin-badge_sm" : ""}`}
      style={{
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        width: isSm ? 16 : 20,
        height: isSm ? 16 : 20,
        borderRadius: "50%",
        border: `1.5px solid ${c.color}`,
        color: c.color,
        background: c.bg,
        fontSize: isSm ? "9px" : "11px",
        fontWeight: 800,
        lineHeight: 1,
        flexShrink: 0,
        userSelect: "none",
      }}
      title={c.label}
    >
      {c.abbrev}
    </span>
  );
}

export default function CoinsModal({ c, onSave, onClose }) {
  const [activeCoin, setActiveCoin] = useState("gp");
  const [digits, setDigits] = useState("");

  const d = c.data.coins ||= {
    gp: { value: 0 },
    sp: { value: 0 },
    cp: { value: 0 },
    pp: { value: 0 },
    ep: { value: 0 },
  };

  // Keyboard handler for numbers, backspace, and escape
  useEffect(() => {
    const handler = (e) => {
      if (e.key >= "0" && e.key <= "9") {
        e.preventDefault();
        setDigits(prev => (prev + e.key).slice(0, 7));
      } else if (e.key === "Backspace") {
        e.preventDefault();
        setDigits(prev => prev.slice(0, -1));
      } else if (e.key === "Escape") {
        e.preventDefault();
        onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [onClose]);

  const addDigit = (n) => setDigits(prev => (prev + n).slice(0, 7));
  const backspace = () => setDigits(prev => prev.slice(0, -1));

  const num = parseInt(digits || "0", 10);
  const activeObj = COIN_MAP[activeCoin] || COIN_MAP.gp;
  const totalGold = coinsTotal(c);

  const applyAdd = () => {
    if (!num) return;
    const cur = d[activeCoin]?.value ?? 0;
    d[activeCoin] = { value: cur + num };
    setDigits("");
    onSave();
    toast(`Взято: +${num} ${activeObj.label.toLowerCase()}`, "good");
  };

  const applySub = () => {
    if (!num) return;
    const res = deductCoins(d, num, activeCoin);
    if (!res.success) {
      toast(res.error, "bad");
      return;
    }
    setDigits("");
    onSave();
    if (res.wasExchanged) {
      toast(`Отдано: −${num} ${activeObj.label.toLowerCase()} (с авторазменом)`, "bad");
    } else {
      toast(`Отдано: −${num} ${activeObj.label.toLowerCase()}`, "bad");
    }
  };

  // 4 other denominations to show in the side conversion buttons
  const otherCoins = COINS.filter(coin => coin.key !== activeCoin);

  const formatEquiv = (targetCoin) => {
    if (!num) return "=0";
    const inGold = num * activeObj.rate;
    const val = inGold / targetCoin.rate;
    if (val >= 100000) return `=${Math.round(val / 1000)}k`;
    if (val >= 10000 && val % 1000 === 0) return `=${val / 1000}k`;
    if (Number.isInteger(val)) return `=${val}`;
    return `=${+val.toFixed(2)}`;
  };

  return (
    <div className="hp-modal-back" onMouseDown={onClose}>
      <div className="hp-modal calc-coins-modal" onMouseDown={e => e.stopPropagation()}>
        <button
          className="modal__close hp-modal__close"
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="calc-coins">
          {/* 1. Header / Total Wealth */}
          <div className="calc-coins__total-wrap">
            Всего в золоте: <span className="calc-coins__total"><span className="calc-coins__total-gold">{totalGold}</span></span>
          </div>

          {/* 2. Coin Balances Display Bar */}
          <div className="calc-coins__account">
            <div className="calc-coins__account-group">
              {["gp", "sp", "cp"].map(k => (
                <button
                  key={k}
                  type="button"
                  className={"calc-coins__account-btn " + (activeCoin === k ? "is-active" : "")}
                  onClick={() => setActiveCoin(k)}
                >
                  <CoinBadge coinKey={k} />
                  <span className="calc-coins__account-total">{d[k]?.value ?? 0}</span>
                </button>
              ))}
            </div>
            <div className="calc-coins__account-group">
              {["pp", "ep"].map(k => (
                <button
                  key={k}
                  type="button"
                  className={"calc-coins__account-btn " + (activeCoin === k ? "is-active" : "")}
                  onClick={() => setActiveCoin(k)}
                >
                  <CoinBadge coinKey={k} />
                  <span className="calc-coins__account-total">{d[k]?.value ?? 0}</span>
                </button>
              ))}
            </div>
          </div>

          {/* 3. Input & Currency Selector Row */}
          <div className="calc-coins__control">
            <div className="calc-coins__input-wrap">
              <label className="calc-coins__select-wrap">
                <CoinBadge coinKey={activeCoin} />
                <span className="calc-coins__select-arrow">▾</span>
                <select
                  className="calc-coins__select"
                  value={activeCoin}
                  onChange={e => setActiveCoin(e.target.value)}
                >
                  {COINS.map(c => (
                    <option key={c.key} value={c.key}>{c.label}</option>
                  ))}
                </select>
              </label>
              <input
                className="calc-coins__input"
                type="text"
                readOnly
                value={digits}
                placeholder=""
              />
            </div>
            <button
              className="calc-button calc-button_sm calc-coins__btn-back"
              type="button"
              title="Стереть символ"
              onClick={backspace}
            >
              ⌫
            </button>
          </div>

          {/* 4. Calculator Numpad & Side Conversion Grid */}
          <div className="calculator calc-coins__calculator">
            {/* Row 1: 7, 8, 9 | Side button 1 */}
            <div className="calculator__row">
              <div className="calculator__main">
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("7")}>7</button>
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("8")}>8</button>
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("9")}>9</button>
              </div>
              <div className="calculator__sub">
                <button
                  type="button"
                  className="calc-button calc-button_sm calc-coins__side-btn"
                  title={`Переключить на ${otherCoins[0].label}`}
                  onClick={() => setActiveCoin(otherCoins[0].key)}
                >
                  <span className="coin-equal">{formatEquiv(otherCoins[0])}</span>
                  <CoinBadge coinKey={otherCoins[0].key} size="sm" />
                </button>
              </div>
            </div>

            {/* Row 2: 4, 5, 6 | Side button 2 */}
            <div className="calculator__row">
              <div className="calculator__main">
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("4")}>4</button>
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("5")}>5</button>
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("6")}>6</button>
              </div>
              <div className="calculator__sub">
                <button
                  type="button"
                  className="calc-button calc-button_sm calc-coins__side-btn"
                  title={`Переключить на ${otherCoins[1].label}`}
                  onClick={() => setActiveCoin(otherCoins[1].key)}
                >
                  <span className="coin-equal">{formatEquiv(otherCoins[1])}</span>
                  <CoinBadge coinKey={otherCoins[1].key} size="sm" />
                </button>
              </div>
            </div>

            {/* Row 3: 1, 2, 3 | Side button 3 */}
            <div className="calculator__row">
              <div className="calculator__main">
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("1")}>1</button>
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("2")}>2</button>
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("3")}>3</button>
              </div>
              <div className="calculator__sub">
                <button
                  type="button"
                  className="calc-button calc-button_sm calc-coins__side-btn"
                  title={`Переключить на ${otherCoins[2].label}`}
                  onClick={() => setActiveCoin(otherCoins[2].key)}
                >
                  <span className="coin-equal">{formatEquiv(otherCoins[2])}</span>
                  <CoinBadge coinKey={otherCoins[2].key} size="sm" />
                </button>
              </div>
            </div>

            {/* Row 4: 0, ОТДАТЬ, ВЗЯТЬ | Side button 4 */}
            <div className="calculator__row">
              <div className="calculator__main">
                <button type="button" className="calc-button calc-button_lg" onClick={() => addDigit("0")}>0</button>
                <button
                  type="button"
                  className="calc-button calc-button_lg calc-go-btn calc-coins__btn-minus"
                  onClick={applySub}
                >
                  ОТДАТЬ
                </button>
                <button
                  type="button"
                  className="calc-button calc-button_lg calc-go-btn calc-coins__btn-plus"
                  onClick={applyAdd}
                >
                  ВЗЯТЬ
                </button>
              </div>
              <div className="calculator__sub">
                <button
                  type="button"
                  className="calc-button calc-button_sm calc-coins__side-btn"
                  title={`Переключить на ${otherCoins[3].label}`}
                  onClick={() => setActiveCoin(otherCoins[3].key)}
                >
                  <span className="coin-equal">{formatEquiv(otherCoins[3])}</span>
                  <CoinBadge coinKey={otherCoins[3].key} size="sm" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
