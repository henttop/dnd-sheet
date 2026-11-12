import React, { useState } from "react";
import { characters, importCharacters, exportCharacters, blankCharacter, addCharacter, removeCharacter, duplicateCharacter } from "./store.js";
import { hp } from "./helpers.js";
import { RollHost } from "./ui.jsx";
import { toast } from "./toast.jsx";

export default function List({ open }) {
  const [menu, setMenu] = useState(false);
  const [drag, setDrag] = useState(false);
  const [cardMenu, setCardMenu] = useState(null);
  const [, force] = useState(0);
  const rerender = () => force(x => x + 1);

  const loadText = (t) => {
    try {
      const r = importCharacters(JSON.parse(t));
      rerender();
      toast(`Загружено: добавлено ${r.added}, обновлено ${r.replaced}. Всего персонажей: ${r.total}`, "ok");
    } catch (err) {
      toast("Не удалось прочитать файл: " + err.message, "err");
    }
  };
  const onDrop = (e) => {
    e.preventDefault(); setDrag(false);
    const f = e.dataTransfer.files[0];
    if (f) f.text().then(loadText);
  };
  const pickFile = () => {
    const inp = document.createElement("input"); inp.type = "file"; inp.accept = ".json";
    inp.onchange = () => inp.files[0] && inp.files[0].text().then(loadText);
    inp.click();
  };
  const doExport = () => {
    const blob = new Blob([exportCharacters()], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob); a.download = "Мои персонажи — D&D.json"; a.click();
  };
  const exportOne = (i) => {
    const c = characters[i];
    const blob = new Blob([JSON.stringify({ ...c, data: JSON.stringify(c.data) }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${c.data.name?.value || "Безымянный персонаж"}.json`; a.click();
  };
  const createNew = () => {
    addCharacter(blankCharacter());
    rerender();
  };

  const [delIdx, setDelIdx] = useState(null);

  return (
    <div className="list-wrap">
      <h1 className="list-title">Мои персонажи <small>({characters.length}/30)</small></h1>
      <div className="list-tools" style={{ position: "relative" }}>
        <button className="btn-json" onClick={(e) => { e.stopPropagation(); setMenu(!menu); }}>.json</button>
        {menu ? (
          <div className="json-menu">
            <button onClick={doExport}>Скачать .json</button>
            <button onClick={pickFile}>Загрузить .json</button>
          </div>
        ) : null}
        <div />
      </div>
      <div className="char-grid">
        {characters.map((c, i) => {
          const h = hp(c); const low = h.cur < h.max * .34;
          return (
            <div className="char-card" key={i} onClick={() => open(i)}>
              <Avatar c={c} />
              <div className="cc-body">
                <div className="cc-name">{c.data.name?.value || "Безымянный персонаж"}</div>
                <div className="cc-sub">{raceClass(c)}</div>
                <div className={"cc-hp" + (low ? " low" : "")}>♥ {h.cur}/{h.max}</div>
              </div>
              <div className="cc-menu" onClick={e => { e.stopPropagation(); setCardMenu(cardMenu === i ? null : i); }}>⋯</div>
              {cardMenu === i ? (
                <div className="cc-pop" onClick={e => e.stopPropagation()}>
                  <button onClick={() => { duplicateCharacter(i); setCardMenu(null); rerender(); }}>Копировать</button>
                  <button onClick={() => { exportOne(i); setCardMenu(null); }}>Скачать .json</button>
                  <button className="ctx-item danger" onClick={() => { setDelIdx(i); setCardMenu(null); }}>Удалить</button>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>
      <button className="new-char" onClick={createNew} title="Создать персонажа">+</button>
      <div className={"dropzone" + (drag ? " drag" : "")}
        onDragOver={e => { e.preventDefault(); setDrag(true); }}
        onDragLeave={() => setDrag(false)}
        onDrop={onDrop}>
        Перетащите сюда файл экспорта .json, чтобы загрузить других персонажей
      </div>

      {delIdx != null && characters[delIdx] ? (
        <div className="modal-back" onMouseDown={() => setDelIdx(null)}>
          <div className="modal del-modal" onMouseDown={e => e.stopPropagation()}>
            <button className="modal-x" onClick={() => setDelIdx(null)}>×</button>
            <h3 className="modal-title">УДАЛИТЬ ПЕРСОНАЖА?</h3>
            <p className="modal-text">
              «{characters[delIdx].data.name?.value || "Безымянный персонаж"}» будет удалён из списка.
              Отменить это будет нельзя.
            </p>
            <div className="f-btns">
              <button className="f-btn" onClick={() => setDelIdx(null)}>Отмена</button>
              <button className="f-btn danger" onClick={() => { removeCharacter(delIdx); setDelIdx(null); rerender(); }}>Удалить</button>
            </div>
          </div>
        </div>
      ) : null}
      <RollHost />
    </div>
  );
}

export function Avatar({ c, cls = "" }) {
  const url = c.data.avatar?.jpeg || c.data.avatar?.png || c.data.avatar?.webp || null;
  if (url) return <img className={cls} src={url} alt="" onError={e => { e.target.style.display = "none"; }} />;
  const letter = (c.data.name?.value || "").trim()[0];
  if (letter) return <div className={"ph " + cls}>{letter}</div>;
  return (
    <div className={"ph ph-empty " + cls}>
      <svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true">
        <path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z" />
      </svg>
    </div>
  );
}

export function raceClass(c) {
  const i = c.data.info || {};
  const race = i.race?.value || "";
  const cls = i.charClass?.value || "";
  if (!race && !cls) return "— —";
  const lvl = i.level?.value ? ` ${i.level.value}` : "";
  return `${race || "—"} — ${cls || "—"}${lvl}`;
}
