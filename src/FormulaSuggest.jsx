import React, { useState, useRef, useEffect, useMemo } from "react";

/**
 * Возвращает список всех доступных переменных характеристик персонажа
 * с их текущими модификаторами / значениями
 */
export function getVariableList(char) {
  const d = char?.data || char || {};
  const stats = d.stats || {};
  const getMod = (st) => Math.floor((Number(stats[st]?.score ?? 10) - 10) / 2);
  const getScore = (st) => Number(stats[st]?.score ?? 10);
  const lvl = Number(d.info?.level?.value ?? 1) || 1;
  const prof = Math.floor((lvl - 1) / 4) + 2;
  const halfProf = Math.floor(prof / 2);

  const sign = (n) => (n >= 0 ? "+" + n : String(n));

  const list = [
    { code: "STR", name: "Модификатор Силы", value: sign(getMod("str")), score: getScore("str"), ru: "сила" },
    { code: "DEX", name: "Модификатор Ловкости", value: sign(getMod("dex")), score: getScore("dex"), ru: "ловкость" },
    { code: "CON", name: "Модификатор Телосложения", value: sign(getMod("con")), score: getScore("con"), ru: "телосложение" },
    { code: "INT", name: "Модификатор Интеллекта", value: sign(getMod("int")), score: getScore("int"), ru: "интеллект" },
    { code: "WIS", name: "Модификатор Мудрости", value: sign(getMod("wis")), score: getScore("wis"), ru: "мудрость" },
    { code: "CHA", name: "Модификатор Харизмы", value: sign(getMod("cha")), score: getScore("cha"), ru: "харизма" },
    { code: "PROF", name: "Бонус мастерства", value: sign(prof), ru: "мастерство" },
    { code: "HALF_PROF", name: "Половина бонуса мастерства (вниз)", value: sign(halfProf), ru: "половина" },
    { code: "LVL", name: "Уровень персонажа", value: String(lvl), ru: "уровень" },
  ];

  // Ресурсы персонажа (если есть)
  const resources = Object.values(d.resources || {});
  for (const r of resources) {
    if (r.name && !list.some(x => x.code === r.name)) {
      list.push({
        code: r.name,
        name: `Ресурс «${r.name}»`,
        value: `${r.current ?? 0}/${r.max ?? 0}`,
        ru: r.name.toLowerCase()
      });
    }
  }

  return list;
}

/**
 * Фильтрация переменных по введенному пользователем тексту после '['
 * Поддерживает как латиницу (STR, DEX), так и русский ввод (сила, ловк, мастерство, ур)
 */
export function filterVariables(list, query = "") {
  const q = (query || "").trim().toLowerCase();
  if (!q) return list;
  return list.filter(item => {
    return (
      item.code.toLowerCase().includes(q) ||
      item.name.toLowerCase().includes(q) ||
      (item.ru && item.ru.includes(q))
    );
  });
}

/**
 * Всплывающее меню вариантов для подстановки переменной в формулу
 */
export function SuggestDropdown({ items, activeIndex, onSelect, position, style = {} }) {
  const menuRef = useRef(null);

  useEffect(() => {
    if (!menuRef.current) return;
    const activeEl = menuRef.current.querySelector(".var-suggest-item.is-active");
    if (activeEl) {
      activeEl.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  if (!items || !items.length) return null;

  const isFixed = !!position;
  const posStyle = isFixed
    ? { position: "fixed", left: Math.min(position.left, window.innerWidth - 270), top: position.top }
    : { position: "absolute", left: 0, top: "100%", marginTop: 4 };

  return (
    <div
      ref={menuRef}
      className="var-suggest-menu"
      style={{ ...posStyle, zIndex: 9999, ...style }}
      onMouseDown={e => e.preventDefault()} // предотвращает потерю фокуса поля ввода
    >
      <div className="var-suggest-header">ПЕРЕМЕННЫЕ ХАРАКТЕРИСТИК</div>
      <div className="var-suggest-list">
        {items.map((item, idx) => (
          <div
            key={item.code}
            className={"var-suggest-item" + (idx === activeIndex ? " is-active" : "")}
            onClick={() => onSelect(item)}
          >
            <div className="var-suggest-main">
              <span className="var-suggest-code">[{item.code}]</span>
              <span className="var-suggest-name">{item.name}</span>
            </div>
            <span className="var-suggest-val">{item.value}</span>
          </div>
        ))}
      </div>
      <div className="var-suggest-footer">
        <span>↑↓ навигация</span> · <span>↵ / Tab выбор</span> · <span>Esc</span>
      </div>
    </div>
  );
}

/**
 * Универсальный инпут для формул с автодополнением переменных при вводе '['
 */
export function FormulaInput({
  value,
  onChange,
  onKeyDown,
  onBlur,
  placeholder,
  className = "edit-in",
  char = null,
  autoFocus = false,
  style = {}
}) {
  const [suggest, setSuggest] = useState(null); // { query, start, activeIndex, matches }
  const inputRef = useRef(null);
  const containerRef = useRef(null);
  const activeChar = char || (typeof window !== "undefined" ? window.__activeChar : null);
  const allVars = useMemo(() => getVariableList(activeChar), [activeChar]);

  const checkSuggest = (val, cursorPos) => {
    const textBefore = val.slice(0, cursorPos);
    const lastOpen = textBefore.lastIndexOf("[");
    if (lastOpen >= 0) {
      const textAfterOpen = textBefore.slice(lastOpen + 1);
      // проверяем, что скобка ещё не закрыта и нет переносов строк
      if (!textAfterOpen.includes("]") && !/[\r\n]/.test(textAfterOpen)) {
        const query = textAfterOpen;
        const matches = filterVariables(allVars, query);
        if (matches.length > 0) {
          setSuggest(prev => ({
            query,
            start: lastOpen,
            activeIndex: prev ? Math.min(prev.activeIndex, matches.length - 1) : 0,
            matches
          }));
          return;
        }
      }
    }
    setSuggest(null);
  };

  const handleChange = (e) => {
    const v = e.target.value;
    const pos = e.target.selectionStart;
    onChange(v);
    checkSuggest(v, pos);
  };

  const handleSelect = (item) => {
    if (!suggest || !inputRef.current) return;
    const input = inputRef.current;
    const v = input.value;
    const pos = input.selectionStart;
    const before = v.slice(0, suggest.start);
    let after = v.slice(pos);
    if (after.startsWith("]")) {
      after = after.slice(1);
    }
    const inserted = `[${item.code}]`;
    const nextVal = before + inserted + after;
    const nextPos = before.length + inserted.length;
    onChange(nextVal);
    setSuggest(null);
    setTimeout(() => {
      if (inputRef.current) {
        inputRef.current.focus();
        inputRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (suggest && suggest.matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setSuggest(s => ({ ...s, activeIndex: (s.activeIndex + 1) % s.matches.length }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setSuggest(s => ({ ...s, activeIndex: (s.activeIndex - 1 + s.matches.length) % s.matches.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        handleSelect(suggest.matches[suggest.activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setSuggest(null);
        return;
      }
    }
    if (onKeyDown) onKeyDown(e);
  };

  const handleBlur = (e) => {
    setTimeout(() => setSuggest(null), 180);
    if (onBlur) onBlur(e);
  };

  const handleKeyUp = (e) => {
    if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(e.key)) {
      if (inputRef.current) {
        checkSuggest(inputRef.current.value, inputRef.current.selectionStart);
      }
    }
  };

  return (
    <div ref={containerRef} style={{ position: "relative", width: "100%", ...style }}>
      <input
        ref={inputRef}
        type="text"
        className={className}
        value={value}
        onChange={handleChange}
        onKeyDown={handleKeyDown}
        onKeyUp={handleKeyUp}
        onBlur={handleBlur}
        placeholder={placeholder}
        autoFocus={autoFocus}
      />
      {suggest ? (
        <SuggestDropdown
          items={suggest.matches}
          activeIndex={suggest.activeIndex}
          onSelect={handleSelect}
        />
      ) : null}
    </div>
  );
}
