import React from "react";

/* Вертикальные кнопки вставки в редакторе */
export default function InsertBar({ onFormat, onInsert }) {
  const btns = [
    { label: "Жирный", title: "Жирный текст", act: () => onFormat("**") },
    { label: "Курсив", title: "Курсив", act: () => onFormat("*") },
    { label: "Спойлер", title: "Вставить спойлер", act: () => onInsert("spoiler") },
    { label: "Ресурс", title: "Вставить ресурс", act: () => onInsert("resource") },
    { label: "Бросок", title: "Вставить бросок кубиков", act: () => onInsert("roll") },
    { label: "Разделитель", title: "Разделитель", act: () => onInsert("divider") },
  ];
  return (
    <div className="insert-bar">
      {btns.map(b => (
        <button key={b.label} className="insert-btn" title={b.title} onClick={b.act}>
          <span>{b.label}</span>
        </button>
      ))}
    </div>
  );
}
