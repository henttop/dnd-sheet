import React, { useState, useRef, useEffect, useMemo } from "react";

/**
 * Универсальный стилизованный выпадающий список (CustomSelect)
 * Полностью оформлен в стиле тёмной темы D&D 5e:
 * - Поддерживает нативную сигнатуру onChange: e => setVal(e.target.value)
 * - Поддерживает children в виде нативных <option value="...">Текст</option>
 * - Поддерживает передачу options=[{ value, label }]
 * - Умное позиционирование (открывается вверх, если внизу мало места)
 * - Закрытие по клику вне списка и по клавише Escape
 * - Навигация с клавиатуры (стрелки, Enter, Space)
 */
export default function CustomSelect({
  value,
  onChange,
  options,
  children,
  className = "",
  style = {},
  placeholder = "Выберите…",
  disabled = false,
  id,
  name,
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [openUpward, setOpenUpward] = useState(false);
  const containerRef = useRef(null);
  const listRef = useRef(null);

  // Извлекаем варианты либо из пропа `options`, либо из дочерних <option>
  const parsedOptions = useMemo(() => {
    if (Array.isArray(options) && options.length > 0) {
      return options.map((opt) =>
        typeof opt === "object" && opt !== null
          ? { value: opt.value, label: opt.label !== undefined ? opt.label : String(opt.value), disabled: !!opt.disabled }
          : { value: opt, label: String(opt), disabled: false }
      );
    }
    const items = [];
    React.Children.forEach(children, (child) => {
      if (!child) return;
      if (child.type === "option") {
        items.push({
          value: child.props.value !== undefined ? child.props.value : child.props.children,
          label: child.props.children,
          disabled: !!child.props.disabled,
        });
      }
    });
    return items;
  }, [options, children]);

  // Текущий выбранный элемент
  const selectedOption = parsedOptions.find((o) => String(o.value) === String(value));
  const displayLabel = selectedOption ? selectedOption.label : (placeholder || String(value || ""));

  // Проверка свободного места снизу для открывания вверх
  useEffect(() => {
    if (isOpen && containerRef.current) {
      const rect = containerRef.current.getBoundingClientRect();
      const spaceBelow = window.innerHeight - rect.bottom;
      if (spaceBelow < 220 && rect.top > 220) {
        setOpenUpward(true);
      } else {
        setOpenUpward(false);
      }
    }
  }, [isOpen]);

  // Закрытие при клике снаружи
  useEffect(() => {
    if (!isOpen) return;
    const handleClickOutside = (e) => {
      if (containerRef.current && !containerRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("touchstart", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("touchstart", handleClickOutside);
    };
  }, [isOpen]);

  // Закрытие по Escape и клавиатурная навигация
  const handleKeyDown = (e) => {
    if (disabled) return;
    if (e.key === "Escape") {
      setIsOpen(false);
      return;
    }
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      setIsOpen((prev) => !prev);
      return;
    }
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      if (!isOpen) {
        setIsOpen(true);
        return;
      }
      const currentIndex = parsedOptions.findIndex((o) => String(o.value) === String(value));
      const delta = e.key === "ArrowDown" ? 1 : -1;
      let nextIndex = currentIndex + delta;
      if (nextIndex < 0) nextIndex = parsedOptions.length - 1;
      if (nextIndex >= parsedOptions.length) nextIndex = 0;
      const nextOpt = parsedOptions[nextIndex];
      if (nextOpt && !nextOpt.disabled) {
        selectValue(nextOpt.value);
      }
    }
  };

  const selectValue = (val) => {
    setIsOpen(false);
    if (onChange) {
      onChange({
        target: {
          value: val,
          name: name || id || "",
        },
      });
    }
  };

  return (
    <div
      ref={containerRef}
      className={`custom-select-wrap ${className}`}
      style={{ position: "relative", display: "inline-block", ...style }}
      onKeyDown={handleKeyDown}
    >
      <button
        type="button"
        id={id}
        name={name}
        className={`custom-select-trigger ${isOpen ? "is-open" : ""}`}
        disabled={disabled}
        onClick={() => !disabled && setIsOpen((prev) => !prev)}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="custom-select-label">{displayLabel}</span>
        <svg
          className={`custom-select-arrow ${isOpen ? "open" : ""}`}
          width="12"
          height="12"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <polyline points="6 9 12 15 18 9" />
        </svg>
      </button>

      {isOpen && (
        <div
          ref={listRef}
          className={`custom-select-dropdown ${openUpward ? "open-up" : "open-down"}`}
          role="listbox"
        >
          {parsedOptions.length === 0 ? (
            <div className="custom-select-empty">Нет вариантов</div>
          ) : (
            parsedOptions.map((opt) => {
              const isSelected = String(opt.value) === String(value);
              return (
                <div
                  key={String(opt.value)}
                  className={`custom-select-option ${isSelected ? "selected" : ""} ${opt.disabled ? "disabled" : ""}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => {
                    if (!opt.disabled) selectValue(opt.value);
                  }}
                >
                  <span className="custom-select-opt-text">{opt.label}</span>
                  {isSelected && (
                    <svg
                      className="custom-select-check"
                      width="14"
                      height="14"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <polyline points="20 6 9 17 4 12" />
                    </svg>
                  )}
                </div>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
