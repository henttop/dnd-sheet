import React, { useEffect, useMemo, useRef, useState } from "react";
import { save } from "./store.js";
import { levelOf, profOf, PROF_BY_LEVEL, XP } from "./helpers.js";
import ImageCropper from "./ImageCropper.jsx";

/* ================= Меню под аватаром (как на сайте) ================= */
export function AvatarMenu({ c, onSave, onSettings, onPortrait }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  useEffect(() => {
    const close = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
    const t = setTimeout(() => document.addEventListener("mousedown", close), 0);
    return () => { clearTimeout(t); document.removeEventListener("mousedown", close); };
  }, []);

  const items = [
    { icon: <GearIcon />, label: "Настройки", onClick: () => { setOpen(false); onSettings(); } },
    { icon: <UserIcon />, label: "Сменить портрет", onClick: () => { setOpen(false); onPortrait(); } },
    { icon: <ShareIcon />, label: "Поделиться", disabled: true },
    { icon: <RoomIcon />, label: "Комната", disabled: true },
    { icon: <DocIcon />, label: "Классический лист", disabled: true },
    { icon: <WandIcon />, label: "Гримур", disabled: true },
  ];

  return (
    <div className="ava-wrap" ref={ref}>
      <div className="ava-btn" onClick={() => setOpen(o => !o)} title="Меню персонажа">
        <AvatarImg c={c} />
      </div>
      {open ? (
        <div className="ava-menu">
          {items.map(it => (
            <button key={it.label} className={"ava-item" + (it.disabled ? " dis" : "")}
              onClick={it.onClick} disabled={!!it.disabled}>
              {it.icon}<span>{it.label}</span>
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AvatarImg({ c, cls = "ava-img" }) {
  const url = c.data.avatar?.jpeg || c.data.avatar?.webp || c.data.avatar?.png || null;
  if (url) return <img className={cls} src={url} alt="" onError={e => { e.target.style.display = "none"; }} />;
  return (
    <div className={cls + " ava-empty"}>
      <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z" /></svg>
    </div>
  );
}

/* ================= Панель «Настройки» ================= */
export function SettingsDrawer({ c, onSave, onClose, onOpenWizard, ui, setUi }) {
  const d = c.data;
  const v = d.vitality ||= {};
  const info = d.info ||= {};
  const lvl = levelOf(c);

  const set = (obj) => { Object.assign(obj, {}); };

  const initBonus = v.initiative?.value ? +v.initiative.value : 0;
  const speedBonus = v.speed?.custom ? +v.speed.custom : 0;

  return (
    <Drawer title="Настройки" onClose={onClose}>
      <div className="f-row2">
        <Field label="ИМЯ" value={d.name?.value || ""} onChange={x => { d.name.value = x; onSave(); }} />
        <Field label="РАСА" value={info.race?.value || ""} onChange={x => { info.race.value = x; onSave(); }} />
      </div>
      <div className="f-row2">
        <Field label="КЛАСС" value={info.charClass?.value || ""} onChange={x => { info.charClass.value = x; onSave(); }} />
        <Field label="ПОДКЛАСС" value={info.charSubclass?.value || ""} onChange={x => { info.charSubclass.value = x; onSave(); }} />
      </div>

      <div className="f-tiles">
        <Tile label="КЛАСС ЗАЩИТЫ" value={v.ac?.value ?? "—"}
          onChange={x => { v.ac = { value: +x || 0 }; onSave(); }} />
        <Tile label="ИНИЦИАТИВА" value={signedMod(statModOf(c, "dex") + initBonus)} chip={initBonus}
          onChip={x => { v.initiative = { value: x }; onSave(); }}
          onChange={x => { v.initiative = { value: x }; onSave(); }} />
        <Tile label="СКОРОСТЬ" value={v.speed?.value ?? 0} chip={speedBonus}
          onChip={x => { v.speed = { value: (v.speed?.value ?? 30), custom: x }; onSave(); }}
          onChange={x => { v.speed = { value: +x || 0 }; onSave(); }} />
      </div>

      <div className="f-row2">
        <div>
          <div className="f-label">РЕДАКЦИЯ ПРАВИЛ</div>
          <div className="seg">
            {["2014", "2024"].map(ed => (
              <button key={ed} className={"seg-btn" + ((c.sheetEdition || "2024") === ed ? " on" : "")}
                onClick={() => { c.edition = ed; c.sheetEdition = ed; onSave(); }}>{ed}</button>
            ))}
          </div>
        </div>
        <div>
          <div className="f-label">ПЕРЕВОД</div>
          <select className="f-input" value={ui.lang || "srd"} onChange={e => setUi({ lang: e.target.value })}>
            <option value="srd">Dungeons &amp; Dragons 5e (SRD)</option>
            <option value="ru">ДнД 5e (русский)</option>
          </select>
        </div>
      </div>

      <div className="f-label f-sep">БОНУС МАСТЕРСТВА</div>
      <div className="f-hint">
        Уровень {lvl} → <b>{PROF_BY_LEVEL(lvl)}</b> (по правилам: 1–4 → +2, 5–8 → +3, 9–12 → +4, 13–16 → +5, 17–20 → +6).
        {profOf(c) !== PROF_BY_LEVEL(lvl) ? " Сейчас переопределён вручную." : ""}
      </div>
      <div className="f-row2">
        <Field label="СВОЙ БОНУС (0 = авто)" type="number"
          value={c.data.proficiencyCustom?.value || 0}
          onChange={x => { c.data.proficiencyCustom = { value: +x || 0 }; onSave(); }} />
        <div>
          <div className="f-label">УРОВЕНЬ И ОПЫТ</div>
          <div className="f-inline">
            <input className="f-input" type="number" min="1" max="20" value={lvl}
              onChange={e => { info.level.value = Math.max(1, Math.min(20, +e.target.value || 1)); onSave(); }} />
            <span className="f-hint">XP {info.experience?.value || 0} / {XP[Math.min(lvl + 1, 20)]}</span>
          </div>
        </div>
      </div>

      <Section title="Конструктор персонажа" defaultOpen={false}>
        <button className="f-btn" onClick={onOpenWizard}>Открыть мастер создания персонажа</button>
      </Section>
      <Section title="Настройки бросков" defaultOpen={false}>
        <Check label="Показывать подробности броска (кубик и модификаторы)" checked={ui.rollDetails !== false}
          onChange={v => setUi({ rollDetails: v })} />
        <Check label="Выделять критический успех и провал цветом" checked={ui.critColors !== false}
          onChange={v => setUi({ critColors: v })} />
      </Section>
      <Section title="Настройки заклинаний" defaultOpen={false}>
        <Check label="Показывать сложность спасброска" checked={ui.showDC !== false}
          onChange={v => setUi({ showDC: v })} />
        <Check label="Показывать бонус атаки заклинанием" checked={ui.showAtk !== false}
          onChange={v => setUi({ showAtk: v })} />
      </Section>
      <Section title="Настройки класса" defaultOpen={false}>
        <Check label="Показывать вкладку «Способности» и «Черты»" checked={ui.showFeatures !== false}
          onChange={v => setUi({ showFeatures: v })} />
      </Section>
      <Section title="База знаний" defaultOpen={false}>
        <Check label="Использовать справочник SRD 5.2 (иначе 5.1)" checked={ui.srd52 !== false}
          onChange={v => setUi({ srd52: v })} />
      </Section>
    </Drawer>
  );
}

/* ================= Панель «Сменить портрет» ================= */
export function PortraitDrawer({ c, onSave, onClose }) {
  const [err, setErr] = useState("");
  const [cropSrc, setCropSrc] = useState(null);
  const fileRef = useRef(null);
  const url = c.data.avatar?.jpeg || "";

  const upload = (f) => {
    setErr("");
    if (!f) return;
    if (f.size > 3 * 1024 * 1024) { setErr("Файл больше 3 МБ"); return; }
    if (!/^image\/(jpeg|png|webp)$/.test(f.type)) { setErr("Нужен jpg (или png/webp)"); return; }
    const r = new FileReader();
    // открываем обрезку под квадрат
    r.onload = () => setCropSrc(r.result);
    r.readAsDataURL(f);
  };

  return (
    <Drawer title="Сменить портрет" onClose={onClose}>
      <div className="pt-preview">
        {url ? <img src={url} alt="портрет" /> : <div className="pt-empty">Нет портрета</div>}
      </div>
      <div className="f-hint center">Максимальный вес файла: 3 МБ<br />Форматы: jpg</div>
      {err ? <div className="f-err">{err}</div> : null}
      <div className="f-btns">
        <button className="f-btn danger" disabled={!url}
          onClick={() => { delete c.data.avatar; onSave(); onClose(); }}>Удалить</button>
        <button className="f-btn primary" onClick={() => fileRef.current?.click()}>Загрузить изображение</button>
      </div>
      <input ref={fileRef} type="file" accept="image/jpeg,image/png,image/webp" style={{ display: "none" }}
        onChange={e => { upload(e.target.files[0]); e.target.value = ""; }} />
      <div className="f-sep2" />
      <div className="f-label">ССЫЛКА НА ИЗОБРАЖЕНИЕ</div>
      <input className="f-input" placeholder="https://…" defaultValue={url.startsWith("http") ? url : ""}
        onKeyDown={e => {
          if (e.key === "Enter" && e.target.value) { c.data.avatar = { jpeg: e.target.value }; onSave(); onClose(); }
        }} />
      <div className="f-hint">Вставьте прямую ссылку на картинку и нажмите Enter</div>

      {cropSrc ? (
        <ImageCropper
          src={cropSrc}
          onClose={() => setCropSrc(null)}
          onApply={dataUrl => { c.data.avatar = { jpeg: dataUrl }; onSave(); setCropSrc(null); onClose(); }}
        />
      ) : null}
    </Drawer>
  );
}

/* ================= Мелкие элементы ================= */
function Drawer({ title, onClose, children }) {
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="drawer-back" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawer-head">
          <h3>{title}</h3>
          <button className="drawer-x" onClick={onClose}>×</button>
        </div>
        <div className="drawer-body">{children}</div>
      </div>
    </div>
  );
}

function Field({ label, value, onChange, type = "text" }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <div>
      <div className="f-label">{label}</div>
      <input className="f-input" type={type} value={v}
        onChange={e => { setV(e.target.value); onChange(e.target.value); }} />
    </div>
  );
}

function Tile({ label, value, chip, onChip, onChange }) {
  const [v, setV] = useState(value ?? "");
  useEffect(() => { setV(value ?? ""); }, [value]);
  return (
    <div className="tile">
      <div className="f-label">{label}</div>
      <div className="tile-row">
        <input className="f-input" value={v} onChange={e => { setV(e.target.value); onChange(e.target.value); }} />
        {chip != null && chip !== 0 ? (
          <button className="tile-chip" title="свой бонус" onClick={() => onChip(0)}>+{chip}</button>
        ) : null}
      </div>
    </div>
  );
}

function Check({ label, checked, onChange }) {
  return (
    <label className="f-check">
      <input type="checkbox" checked={!!checked} onChange={e => onChange(e.target.checked)} />
      <span>{label}</span>
    </label>
  );
}

function Section({ title, children, defaultOpen = false }) {
  const [open, setOpen] = useState(defaultOpen);
  return (
    <div className="f-section">
      <button className="f-section-head" onClick={() => setOpen(o => !o)}>
        <span>{title}</span><span className={"chev" + (open ? " open" : "")}>›</span>
      </button>
      {open ? <div className="f-section-body">{children}</div> : null}
    </div>
  );
}

const signedMod = (n) => (n >= 0 ? "+" + n : "−" + Math.abs(n));
const statModOf = (c, st) => {
  const score = c.data.stats?.[st]?.score ?? 10;
  return Math.floor((score - 10) / 2);
};

/* иконки меню */
const GearIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="12" r="3.2" /><path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3M5.2 5.2l2.1 2.1M16.7 16.7l2.1 2.1M18.8 5.2l-2.1 2.1M7.3 16.7l-2.1 2.1" /></svg>;
const UserIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20c1.5-3.8 4-5.5 7.5-5.5s6 1.7 7.5 5.5" /></svg>;
const ShareIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M14 4l6 4-6 4M20 8H10a5 5 0 00-5 5v6" /></svg>;
const RoomIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20V8l8-4 8 4v12H4zM9 20v-6h6v6" /></svg>;
const DocIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M6 3h8l4 4v14H6zM14 3v4h4" /></svg>;
const WandIcon = () => <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M4 20L17 7M17 7l3 3M17 7l-3-3M17 7l-3 3M9 4l1.5 3.5L14 9l-3.5 1.5L9 14l-1.5-3.5L4 9l3.5-1.5z" /></svg>;
