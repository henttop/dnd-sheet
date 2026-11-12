import React, { useState, useRef } from "react";
import { characters, save } from "./store.js";
import { SPELL_BY_ID, SPELL_BY_SLUG } from "./store.js";
import { RollHost, Editable, Popover, ProfPopover, DieIcon, CreateModal, useAnchorPos } from "./ui.jsx";
import SpellsTab from "./Spells.jsx";
import WeaponModal, { weaponBonus, damageInfo } from "./WeaponModal.jsx";
import { AvatarMenu, SettingsDrawer, PortraitDrawer } from "./panels.jsx";
import { getUi, setUi } from "./uistore.js";
import { Avatar } from "./List.jsx";
import { renderDoc, docToText, textToDoc, wrapSelection, insertAtCursor, docToSegments, segmentsToDoc } from "./richtext.jsx";
import TextMenu from "./TextMenu.jsx";
import InsertBar from "./InsertBar.jsx";
import ResourceModal from "./ResourceModal.jsx";
import {
  SKILLS, STAT_NAMES, XP, CONDITIONS_RU, SIZES, TABS,
  hp, profOf, coinsTotal, statMod, skillProf, skillCustom, skillBonus,
  saveProf, saveBonus, passive, docOf, setDoc, levelOf,
} from "./helpers.js";
import { signed, parseNum } from "./dice.js";

export default function Sheet({ idx, back, fresh, onFreshDone }) {
  const c = characters[idx];
  const [tab, setTab] = useState("attacks");
  const [ver, setVer] = useState(0);
  const [ui, setUiState] = useState(getUi());
  const [showSettings, setShowSettings] = useState(false);
  const [showPortrait, setShowPortrait] = useState(false);
  const rerender = () => { save(); setVer(x => x + 1); };
  const patchUi = (p) => setUiState(setUi(p));

  const tabs = ui.showFeatures === false ? TABS.filter(t => t.id !== "abilities") : TABS;

  return (
    <div className="sheet-wrap">
      {fresh ? <CreateModal onClose={onFreshDone} /> : null}
      {showSettings ? (
        <SettingsDrawer c={c} onSave={rerender} onClose={() => setShowSettings(false)}
          onOpenWizard={() => { setShowSettings(false); onFreshDone?.(); }}
          ui={ui} setUi={patchUi} />
      ) : null}
      {showPortrait ? <PortraitDrawer c={c} onSave={rerender} onClose={() => setShowPortrait(false)} /> : null}
      <div className="topbar">
        <div className="logo">D&D 5E</div>
        <div className="nav"><span onClick={back}>← Мои персонажи</span></div>
        <div className="spacer" />
        <GoldPill c={c} onSave={rerender} />
      </div>
      <CharBar c={c} onSave={rerender} onSettings={() => setShowSettings(true)} onPortrait={() => setShowPortrait(true)} />
      <SubVitals c={c} onSave={rerender} />
      <div className="sheet-cols">
        <div className="stats-grid">
          <div className="stat-col">
            <StatBlock c={c} st="str" onSave={rerender} />
            <StatBlock c={c} st="con" onSave={rerender} />
            <StatBlock c={c} st="int" onSave={rerender} />
            <StatBlock c={c} st="cha" onSave={rerender} />
          </div>
          <div className="stat-col">
            <StatBlock c={c} st="dex" onSave={rerender} />
            <StatBlock c={c} st="wis" onSave={rerender} />
            <PassivePanel c={c} />
            <ProfPanel c={c} onSave={rerender} kind="armor" />
            <ProfPanel c={c} onSave={rerender} kind="weapon" />
            <RtBlock c={c} title="Прочие владения и языки" blockKey="prof" onSave={rerender} compact />
          </div>
        </div>
        <div>
          <div className="tabs">
            {tabs.map(t => (
              <button key={t.id} className={"tab" + (t.id === tab ? " on" : "")} onClick={() => setTab(t.id)}>{t.name}</button>
            ))}
          </div>
          <div className="tabpane">
            {tab === "attacks" && <AttacksTab c={c} onSave={rerender} />}
            {tab === "abilities" && <TextTab c={c} onSave={rerender} blocks={[["Умения и способности", "traits"], ["Черты", "feats"], ["Особенности", "features"]]} />}
            {tab === "gear" && <GearTab c={c} onSave={rerender} />}
            {tab === "persona" && <TextTab c={c} onSave={rerender} blocks={[["Внешний вид", "appearance"], ["Предыстория", "background"], ["Узы", "bonds"], ["Пороки", "flaws"], ["Союзники и организации", "allies"]]} />}
            {tab === "goals" && <TextTab c={c} onSave={rerender} blocks={[["Цели и задания", "quests"]]} />}
            {tab === "notes" && <TextTab c={c} onSave={rerender} blocks={[["Заметки", "notes-1"]]} />}
            {tab === "spells" && <SpellsTab c={c} onSave={rerender} ui={ui} />}
          </div>
        </div>
      </div>
      <RollHost />
    </div>
  );
}

/* ================= Шапка ================= */
function CharBar({ c, onSave, onSettings, onPortrait }) {
  const d = c.data, v = d.vitality ||= {};
  const lvl = levelOf(c);
  const xpPrev = XP[Math.min(lvl, 20)], xpNext = XP[Math.min(lvl + 1, 20)];
  const xpVal = parseNum(d.info?.experience?.value);
  const pct = xpNext > xpPrev ? Math.max(0, Math.min(100, (xpVal - xpPrev) / (xpNext - xpPrev) * 100)) : 0;

  return (
    <div className="charbar">
      <AvatarMenu c={c} onSave={onSave} onSettings={onSettings} onPortrait={onPortrait} />
      <div className="cb-main">
        <div className="cb-name"><Editable value={d.name?.value || ""} onSave={x => { d.name.value = x; onSave(); }} width={180} /></div>
        <div className="cb-sub">
          <Editable value={d.info?.race?.value || ""} onSave={x => { d.info.race.value = x; onSave(); }} width={110} />
          {" — "}
          <Editable value={d.info?.charClass?.value || ""} onSave={x => { d.info.charClass.value = x; onSave(); }} width={110} />
          {d.info?.charSubclass?.value ? <>{" · "}
            <Editable value={d.info.charSubclass.value} onSave={x => { d.info.charSubclass.value = x; onSave(); }} width={100} /></> : null}
        </div>
        <div className="lvlbar">
          <LevelChip c={c} lvl={lvl} onSave={onSave} />
          <div className="xp-track">
            <div className="xp-fill" style={{ width: pct + "%" }} />
            <div className="xp-label"><XpEdit c={c} xpVal={xpVal} xpNext={xpNext} onSave={onSave} /></div>
          </div>
          <div className="xp-next">{lvl + 1}</div>
        </div>
      </div>
      <div className="vitals">
        <AcVital c={c} onSave={onSave} />
        <div className="vital"><div><div className="v-main"><Editable value={v.speed?.value ?? 0} onSave={x => { v.speed = { value: +x || 0 }; onSave(); }} width={56} /></div><div className="v-sub">скорость</div></div></div>
        <div className="vital" title="Бонус мастерства (по уровню). Поставь 0 — вернётся автоматический.">
          <div><div className="v-main"><Editable value={signed(profOf(c))} onSave={x => { const n = parseNum(x); d.proficiencyCustom = { value: n > 0 ? n : 0 }; onSave(); }} width={56} /></div><div className="v-sub">владение</div></div>
        </div>
        <HpBox c={c} onSave={onSave} />
      </div>
    </div>
  );
}

function XpEdit({ c, xpVal, xpNext, onSave }) {
  return <>
    <Editable value={xpVal} onSave={x => { c.data.info.experience.value = x; onSave(); }} width={46} />{`/${xpNext}`}
  </>;
}

function LevelChip({ c, lvl, onSave }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pos = useAnchorPos(open, ref, { dx: 0, dy: 8, width: 180 });
  return (
    <span style={{ position: "relative" }}>
      <span className="lvl-chip" ref={ref} onClick={() => setOpen(!open)} title="уровень и опыт">
        <span className="lvl-num">{lvl}</span> УРОВЕНЬ
      </span>
      {open && pos ? (
        <Popover onClose={() => setOpen(false)} style={{ left: pos.left, top: pos.top, minWidth: 180 }}>
          <div className="pop-title">Уровень и опыт</div>
          <label className="pop-field">Уровень
            <input type="number" min="1" max="20" className="edit-in" defaultValue={lvl}
              onKeyDown={e => { if (e.key === "Enter") { c.data.info.level.value = Math.max(1, Math.min(20, +e.target.value || 1)); onSave(); setOpen(false); } }}
              onBlur={e => { c.data.info.level.value = Math.max(1, Math.min(20, +e.target.value || 1)); onSave(); }} />
          </label>
          <label className="pop-field">Опыт
            <input type="number" className="edit-in" defaultValue={c.data.info?.experience?.value || 0}
              onKeyDown={e => { if (e.key === "Enter") { c.data.info.experience.value = e.target.value; onSave(); setOpen(false); } }}
              onBlur={e => { c.data.info.experience.value = e.target.value; onSave(); }} />
          </label>
        </Popover>
      ) : null}
    </span>
  );
}

/* ===== КД (щит) ===== */
function AcVital({ c, onSave }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pos = useAnchorPos(open, ref, { dx: -70, dy: 8, width: 190 });
  const v = c.data.vitality ||= {};
  const base = v.ac?.value;
  const shield = !!v.shield?.value;
  const total = (base ?? 0) + (shield ? 2 : 0);
  const toggleShield = (e) => {
    e.stopPropagation();
    v.shield = { value: !shield };
    onSave();
  };
  return (
    <div style={{ position: "relative" }}>
      <div className="vital" ref={ref} onClick={() => setOpen(!open)} title="КД и щит">
        <svg className={"icon ac-shield" + (shield ? " on" : "")} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" onClick={toggleShield} style={{ cursor: "pointer" }}>
          <path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7l9-5z" />
          {shield ? <path d="M9.5 12l2 2 3.5-3.5" stroke="var(--cyan)" /> : <text x="12" y="15" textAnchor="middle" fontSize="7" stroke="none" fill="currentColor">?</text>}
        </svg>
        <div>
          <div className="v-main">
            {shield && base != null ? (
              <>
                <span className="ac-old">{base}</span>
                <span className="ac-new">{total}</span>
              </>
            ) : (base ?? "—")}
          </div>
          <div className="v-sub">КД</div>
        </div>
      </div>
      {open && pos ? (
        <Popover onClose={() => setOpen(false)} style={{ left: pos.left, top: pos.top, minWidth: 190 }}>
          <div className="pop-title">КД и щит</div>
          <label className="pop-field">КД (без щита)
            <input type="number" className="edit-in" defaultValue={v.ac?.value ?? 10}
              onKeyDown={e => { if (e.key === "Enter") { v.ac = { value: +e.target.value || 0 }; onSave(); setOpen(false); } }}
              onBlur={e => { v.ac = { value: +e.target.value || 0 }; onSave(); }} />
          </label>
          <label className="prof-opt">
            <input type="checkbox" checked={!!v.shield?.value}
              onChange={e => { v.shield = { value: e.target.checked }; onSave(); }} />
            <span>Щит (+2 КД)</span>
          </label>
          {shield && base != null ? (
            <div className="f-hint" style={{ marginTop: 6 }}>
              Итоговое КД: <b>{base}</b> + 2 = <b>{total}</b>
            </div>
          ) : null}
        </Popover>
      ) : null}
    </div>
  );
}

/* ===== Монеты ===== */
function GoldPill({ c, onSave }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pos = useAnchorPos(open, ref, { dx: -110, dy: 8, width: 230, align: "right" });
  const d = c.data.coins ||= { gp: { value: 0 }, sp: { value: 0 }, cp: { value: 0 }, pp: { value: 0 }, ep: { value: 0 } };
  const NOM = [["pp", "ПМ"], ["gp", "ЗМ"], ["ep", "ЭМ"], ["sp", "СМ"], ["cp", "ММ"]];
  return (
    <div style={{ position: "relative" }}>
      <div className="gold-pill" ref={ref} onClick={() => setOpen(!open)} title="монеты">🪙 {coinsTotal(c)}</div>
      {open && pos ? (
        <Popover onClose={() => { setOpen(false); onSave(); }} style={{ left: pos.left, top: pos.top }}>
          <div className="pop-title">Монеты</div>
          <div className="coins-grid">
            {NOM.map(([k, label]) => (
              <label key={k}>{label}
                <input type="number" className="edit-in" defaultValue={d[k]?.value || 0}
                  onChange={e => { d[k] = { value: +e.target.value || 0 }; onSave(); }} />
              </label>
            ))}
          </div>
          <div style={{ textAlign: "center", marginTop: 6 }}><b>итого: {coinsTotal(c)}</b></div>
        </Popover>
      ) : null}
    </div>
  );
}

/* ===== HP ===== */
function HpBox({ c, onSave }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const pos = useAnchorPos(open, ref, { dx: -60, dy: 8, width: 250, align: "right" });
  const v = c.data.vitality ||= {};
  const h = hp(c);
  const setHp = (val) => { v["hp-current"] = { value: Math.max(0, Math.min(h.max, val)) }; onSave(); };
  const low = h.cur < h.max * .34;
  return (
    <div style={{ position: "relative" }}>
      <div className={"hp-box" + (low ? " low" : "")} ref={ref} onClick={() => setOpen(!open)} title="хиты">
        <HeartIcon /> {h.cur}/{h.max}{h.temp ? <span className="hp-temp">+{h.temp}</span> : ""}
      </div>
      {open && pos ? (
        <Popover onClose={() => setOpen(false)} style={{ left: pos.left, top: pos.top, minWidth: 250 }}>
          <div className="pop-title">Хиты</div>
          <div className="hp-row">
            <button onClick={() => setHp(h.cur - 5)}>−5</button>
            <button onClick={() => setHp(h.cur - 1)}>−1</button>
            <span style={{ alignSelf: "center", fontWeight: 800, minWidth: 64, textAlign: "center" }}>{h.cur}/{h.max}</span>
            <button onClick={() => setHp(h.cur + 1)}>+1</button>
            <button onClick={() => setHp(h.cur + 5)}>+5</button>
          </div>
          <div className="hp-row">
            <label style={{ flex: 1 }} className="pop-field">HP
              <input type="number" className="edit-in" defaultValue={h.cur}
                onKeyDown={e => { if (e.key === "Enter") setHp(+e.target.value); }}
                onBlur={e => setHp(+e.target.value)} />
            </label>
            <label style={{ flex: 1 }} className="pop-field">Макс. HP
              <input type="number" className="edit-in" defaultValue={h.max}
                onKeyDown={e => { if (e.key === "Enter") { v["hp-max"] = { value: Math.max(0, +e.target.value || 0) }; onSave(); } }}
                onBlur={e => { v["hp-max"] = { value: Math.max(0, +e.target.value || 0) }; onSave(); }} />
            </label>
          </div>
          <div className="hp-row">
            <label style={{ flex: 1 }} className="pop-field">Темп. HP
              <input type="number" className="edit-in" defaultValue={h.temp} onBlur={e => { v["hp-temp"] = { value: Math.max(0, +e.target.value || 0) }; onSave(); }} />
            </label>
          </div>
          <div className="rest-row">
            <button title="Короткий отдых: восстановить одну кость хитов (1к10 + модификатор Телосложения)"
              onClick={() => {
                const heal = 1 + Math.floor(Math.random() * 10) + statMod(c, "con");
                setHp(Math.min(h.max, h.cur + Math.max(0, heal)));
              }}>Короткий отдых</button>
            <button title="Длинный отдых: все хиты, сброс темп. HP, −1 истощение"
              onClick={() => {
                v["hp-max"] && (v["hp-current"] = { value: h.max });
                v["hp-temp"] = { value: 0 };
                c.data.exhaustion = Math.max(0, (+c.data.exhaustion || 0) - 1);
                onSave();
              }}>Длинный отдых</button>
          </div>
        </Popover>
      ) : null}
    </div>
  );
}

function HeartIcon() {
  return <svg className="hp-heart" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 21S4 14.5 4 9.2C4 6.3 6.2 4 9 4c1.6 0 2.7.8 3 1.6C12.3 4.8 13.4 4 15 4c2.8 0 5 2.3 5 5.2C20 14.5 12 21 12 21z" /></svg>;
}

/* ================= Вторая строка ================= */
function SubVitals({ c, onSave }) {
  const d = c.data, v = d.vitality ||= {};
  const initCustom = v.initiative?.value ? parseNum(v.initiative.value) : 0;
  const initBonus = statMod(c, "dex") + initCustom;
  const conds = d.conditions ||= [];
  const [condOpen, setCondOpen] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const initRef = useRef(null);
  const condRef = useRef(null);
  const initPos = useAnchorPos(initOpen, initRef, { dx: 0, dy: 8, width: 200 });
  const condPos = useAnchorPos(condOpen, condRef, { dx: 0, dy: 8, width: 240 });
  return (
    <div className="subvitals">
      <div style={{ position: "relative" }}>
        <div className="subvital" ref={initRef} title="клик — бросок; правый клик — правка"
          onClick={e => window.__rollD20("Инициатива", initBonus, "")}
          onContextMenu={e => { e.preventDefault(); setInitOpen(true); }}>
          <div className="sv-v">{signed(initBonus)}</div><div className="sv-l">Инициатива</div>
        </div>
        {initOpen && initPos ? (
          <Popover onClose={() => { setInitOpen(false); onSave(); }} style={{ left: initPos.left, top: initPos.top }}>
            <div className="pop-title">Бонус инициативы</div>
            <input type="number" className="edit-in" autoFocus defaultValue={initCustom}
              onKeyDown={e => { if (e.key === "Enter") { v.initiative = { value: +e.target.value || 0 }; onSave(); setInitOpen(false); } }}
              onBlur={e => { v.initiative = { value: +e.target.value || 0 }; onSave(); }} />
          </Popover>
        ) : null}
      </div>
      <div className={"subvital" + (d.inspiration ? " insp" : " dim")} title="вдохновение (клик — переключить)"
        onClick={() => { d.inspiration = !d.inspiration; onSave(); }}>
        <div className="sv-v"><SparkIcon /></div><div className="sv-l">Вдохновение</div>
      </div>
      <div className="subvital" title="истощение: клик +1, правый клик — сброс"
        onClick={() => { d.exhaustion = ((+d.exhaustion || 0) + 1) % 7; onSave(); }}
        onContextMenu={e => { e.preventDefault(); d.exhaustion = 0; onSave(); }}>
        <div className="sv-v">{+d.exhaustion || 0}</div><div className="sv-l">Истощение</div>
      </div>
      <div className="cond-box" ref={condRef} style={{ position: "relative" }} onClick={() => setCondOpen(!condOpen)}>
        {conds.length ? conds.map(k => <span className="chip" key={k}>{CONDITIONS_RU[k] || k}</span>) : "— Эффекты и состояния"}
        {condOpen && condPos ? (
          <Popover onClose={() => { setCondOpen(false); onSave(); }} style={{ left: condPos.left, top: condPos.top, maxHeight: 320, overflow: "auto", minWidth: 230 }}>
            <div className="pop-title">Состояния</div>
            {Object.entries(CONDITIONS_RU).map(([k, label]) => (
              <label key={k} className="prof-opt">
                <input type="checkbox" checked={conds.includes(k)}
                  onChange={e => {
                    if (e.target.checked) conds.push(k);
                    else c.data.conditions = conds.filter(x => x !== k);
                    onSave();
                  }} />
                <span>{label}</span>
              </label>
            ))}
          </Popover>
        ) : null}
      </div>
    </div>
  );
}

function SparkIcon() {
  return <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" strokeWidth="1.6"><path d="M12 3l1.8 5.2L19 10l-5.2 1.8L12 17l-1.8-5.2L5 10l5.2-1.8zM19 16l.9 2.6L22.5 19l-2.6.9L19 22.5l-.9-2.6L15.5 19l2.6-.9z" /></svg>;
}

/* ================= Характеристики ================= */
function StatBlock({ c, st, onSave }) {
  const d = c.data;
  const score = d.stats?.[st]?.score ?? 10;
  const m = statMod(c, st);
  return (
    <div className="stat">
      <div className="stat-head">
        <h3>{STAT_NAMES[st]}</h3>
        <span className="score"><Editable value={score} onSave={x => { d.stats[st].score = Math.max(1, +x || 10); onSave(); }} width={64} /></span>
      </div>
      <div className="stat-roll">
        <button className="roll-btn" onClick={() => window.__rollD20(`Проверка ${STAT_NAMES[st]}`, m)}>
          Проверка <b>{signed(m)}</b>
        </button>
        <SaveBtn c={c} st={st} onSave={onSave} />
      </div>
      <div className="skill-list">
        {SKILLS.filter(s => s[2] === st).map(([id, name, base]) => (
          <SkillRow key={id} c={c} id={id} name={name} base={base} onSave={onSave} />
        ))}
      </div>
    </div>
  );
}

function SaveBtn({ c, st, onSave }) {
  const [anchor, setAnchor] = useState(null);
  const b = saveBonus(c, st);
  return (
    <span style={{ position: "relative" }}>
      <button className="roll-btn" onClick={e => window.__rollD20(`Спасбросок ${STAT_NAMES[st]}`, b, "")}>
        <span className="dot-mini" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }}>◉</span>
        Спасбросок <b>{signed(b)}</b>
      </button>
      {anchor ? (
        <ProfPopover anchor={anchor} value={saveProf(c, st)}
          onChange={v => {
            const s = (c.data.saves ||= {});
            s[st] = { isProf: v === 1 };
            onSave(); setAnchor(null);
          }}
          onClose={() => setAnchor(null)}
          title={`Спасбросок: ${STAT_NAMES[st]}`} />
      ) : null}
    </span>
  );
}

function SkillRow({ c, id, name, base, onSave }) {
  const d = c.data;
  const [anchor, setAnchor] = useState(null);
  const p = skillProf(c, id);
  const custom = skillCustom(c, id);
  const b = skillBonus(c, id);
  const spaceKey = id.replace(/-/g, " ");
  // редактируем по существующему ключу (в экспорте встречаются и дефисы, и пробелы)
  const ensure = () => {
    if (!d.skills) d.skills = {};
    if (d.skills[id]) return d.skills[id];
    if (d.skills[spaceKey]) { const r = d.skills[spaceKey]; delete d.skills[spaceKey]; d.skills[id] = r; return r; }
    d.skills[id] = { baseStat: base, name: id };
    return d.skills[id];
  };
  return (
    <div className={"skill-row" + (p === 1 ? " p1" : p === 2 ? " p2" : "")}>
      <span className="dot" title="владение (клик)" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }} />
      <span className="s-name" onClick={e => setAnchor(e.currentTarget)}>{name}</span>
      <button className="roll-btn" onClick={e => window.__rollD20(name, b, custom != null ? "кастом" : "")}>{signed(b)}</button>
      {anchor ? (
        <ProfPopover anchor={anchor} value={p} withCustom customValue={custom} title={name}
          onChange={v => { ensure().isProf = v; onSave(); }}
          onCustom={v => { const r = ensure(); if (v == null) delete r.customModifier; else r.customModifier = v; onSave(); }}
          onClose={() => setAnchor(null)} />
      ) : null}
    </div>
  );
}

/* ================= Панели левой колонки ================= */
function PassivePanel({ c }) {
  return (
    <div className="panel">
      <h4><PassiveIcon /> ПАССИВНЫЕ ЧУВСТВА</h4>
      <div className="passive-row">
        <div className="passive"><span className="pi"><EyeIcon /></span>{passive(c, "perception")}</div>
        <div className="passive"><span className="pi"><BrainIcon /></span>{passive(c, "investigation")}</div>
        <div className="passive"><span className="pi"><BulbIcon /></span>{passive(c, "insight")}</div>
      </div>
    </div>
  );
}

function ProfPanel({ c, onSave, kind }) {
  const d = c.data;
  const prof = d.prof ||= {};
  const isArmor = kind === "armor";
  const items = isArmor
    ? [["armor-light", "Лёгкие"], ["armor-medium", "Средние"], ["armor-heavy", "Тяжёлые"], ["shield", "Щит"]]
    : [["weapon-simple", "Простое"], ["weapon-martial", "Воинское"], ["weapon-other", "Другое"]];
  return (
    <div className="panel">
      <h4>{isArmor ? <ArmorIcon /> : <SwordIcon />} {isArmor ? "ВЛАДЕНИЕ ДОСПЕХАМИ" : "ВЛАДЕНИЕ ОРУЖИЕМ"}</h4>
      <div className="chips">
        {items.map(([k, n]) => (
          <span key={k} className={"chip-sm" + (prof[k]?.value ? " on" : "")} style={{ cursor: "pointer" }}
            onClick={() => { prof[k] = { value: !prof[k]?.value }; onSave(); }}>{n}</span>
        ))}
      </div>
    </div>
  );
}

const EyeIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6z" /><circle cx="12" cy="12" r="2.5" /></svg>;
const BrainIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 3a3 3 0 00-3 3v1a3 3 0 00-2 5 3 3 0 002 5v1a3 3 0 003 3h2V3H9zM15 3a3 3 0 013 3v1a3 3 0 012 5 3 3 0 01-2 5v1a3 3 0 01-3 3h-2V3h2z" /></svg>;
const BulbIcon = () => <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.8"><path d="M9 18h6M10 21h4M12 3a6 6 0 00-4 10.5c.6.6 1 1.5 1 2.5h6c0-1 .4-1.9 1-2.5A6 6 0 0012 3z" /></svg>;
const PassiveIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 3" /></svg>;
const ArmorIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2l8 3v6c0 5-3.5 8.5-8 10-4.5-1.5-8-5-8-10V5l8-3z" /></svg>;
const SwordIcon = () => <svg viewBox="0 0 24 24" width="12" height="12" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4l12 12M4 4v4M4 4h4M20 20l-4-4M20 20v-4M20 20h-4M14 4l6 6M4 14l6 6" /></svg>;

/* ================= Вкладки ================= */
function AttacksTab({ c, onSave }) {
  const d = c.data;
  if (!d.weaponsList) d.weaponsList = [];
  const ws = d.weaponsList;
  const [editIdx, setEditIdx] = useState(null);

  const addRow = () => {
    ws.push({ id: "weapon-" + Date.now(), name: { value: "" }, mod: { value: "+2" }, dmg: { value: "" } });
    onSave();
  };
  const removeLast = () => {
    if (ws.length > 1) ws.pop();
    onSave();
  };
  const removeRow = (i) => {
    ws.splice(i, 1);
    setEditIdx(null);
    onSave();
  };

  return (
    <>
      <div className="panel">
        <table className="att-table">
          <thead>
            <tr>
              <th>НАЗВАНИЕ</th>
              <th>БОНУС</th>
              <th>УРОН / ВИД</th>
              <th className="att-tools">
                <button className="att-plus" title="добавить атаку" onClick={addRow}>+</button>
                <button className="att-minus" title="убрать последнюю" onClick={removeLast}>−</button>
              </th>
            </tr>
          </thead>
          <tbody>
            {ws.map((w, i) => (
              <tr key={w.id || i}>
                <td className="atk-name">
                  <button className={"atk-name-btn" + (w.name?.value ? "" : " empty")}
                    title="настроить оружие"
                    onClick={() => setEditIdx(i)}>
                    {w.name?.value || "настроить"}
                  </button>
                </td>
                <td>
                  <span className="atk-mod">
                    <button className="atk-val" title="бросок атаки"
                      onClick={() => window.__rollD20(`Атака: ${w.name?.value || "оружие"}`, weaponBonus(c, w), "")}>
                      {fmtMod(weaponBonus(c, w))}
                    </button>
                  </span>
                </td>
                <td>
                  <span className="atk-mod">
                    <button className="atk-val wide" title="бросок урона"
                      onClick={() => {
                        const info = damageInfo(w.dmg?.value, statMod(c, w.ability || "str"));
                        if (info.ok) window.__rollExpr(`Урон: ${w.name?.value || "оружие"}`, info.dice, info.abil, STAT_NAMES[w.ability || "str"]);
                      }}>
                      {w.dmg?.value || "—"}
                      {w.dmg?.value && damageInfo(w.dmg?.value, statMod(c, w.ability || "str")).abil
                        ? <span className="atk-dmg-mod">+{damageInfo(w.dmg?.value, statMod(c, w.ability || "str")).abil}</span> : null}
                    </button>
                  </span>
                </td>
                <td>
                  <button className="row-del" title="удалить" onClick={() => removeRow(i)}>−</button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <RtBlock c={c} title="Атаки и заклинания" blockKey="attacks" onSave={onSave} />
      {editIdx != null && ws[editIdx] ? (
        <WeaponModal
          c={c}
          weapon={ws[editIdx]}
          onChange={(nw) => { ws[editIdx] = nw; onSave(); }}
          onDelete={() => removeRow(editIdx)}
          onClose={() => setEditIdx(null)}
        />
      ) : null}
    </>
  );
}

const fmtMod = (n) => (n >= 0 ? "+" + n : "−" + Math.abs(n));

const RT_HINT = "ПКМ — меню: спойлер, ресурс, бросок · **жирный**, *курсив*, ||спойлер||, {{ресурс}}, [[1d6]]";

function TextTab({ c, onSave, blocks }) {
  return blocks.map(([title, key]) => <RtBlock key={key} c={c} title={title} blockKey={key} onSave={onSave} />);
}

function RtBlock({ c, title, blockKey, onSave, compact }) {
  const [edit, setEdit] = useState(false);
  const [segs, setSegs] = useState([]);
  const [menu, setMenu] = useState(null);
  const [resModal, setResModal] = useState(null);
  const taRef = useRef(null);
  const doc = docOf(c, blockKey);
  const resources = Object.values(c.data.resources || {});

  const startEdit = () => { setSegs(docToSegments(doc)); setEdit(true); };

  const updateSeg = (i, patch) => setSegs(l => l.map((sg, k) => (k === i ? { ...sg, ...patch } : sg)));
  const removeSeg = (i) => setSegs(l => l.filter((_, k) => k !== i));
  const addSpoiler = () => setSegs(l => [...l, { type: "spoiler", summary: "Спойлер", body: "" }]);

  // вставка текста/маркера в активное текстовое поле
  const applyText = (i, next, pos) => {
    setSegs(l => l.map((sg, k) => (k === i ? { ...sg, text: next } : sg)));
    requestAnimationFrame(() => {
      const ta = taRef.current;
      if (!ta) return;
      ta.focus();
      if (pos != null) ta.setSelectionRange(pos, pos);
    });
  };

  const onFormat = (mark) => {
    const ta = taRef.current;
    if (!ta) return;
    const r = wrapSelection(ta, mark, mark);
    applyText(ta.dataset.idx, r.next, r.pos);
  };

  const onInsert = (kind, res) => {
    const ta = taRef.current;
    if (kind === "spoiler") { addSpoiler(); return; }
    if (!ta) return;
    if (kind === "resource") {
      const id = res.id;
      const marker = `{{${id}::${res.name}}}`;
      const r = insertAtCursor(ta, marker);
      applyText(ta.dataset.idx, r.next, r.pos);
      return;
    }
    const ins = kind === "roll" ? "[[1d6]]" : kind === "divider" ? "\n——\n" : "\n- ";
    const r = insertAtCursor(ta, ins);
    applyText(ta.dataset.idx, r.next, r.pos);
  };

  const onResourceChange = (id, patch) => {
    const rs = c.data.resources || {};
    if (!rs[id]) return;
    rs[id] = { ...rs[id], ...patch };
    onSave();
  };

  const resCtx = { resources: c.data.resources || {}, onResource: onResourceChange };

  return (
    <div className="panel">
      <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title.toUpperCase()}</span>
        <button className="edit-toggle" onClick={() => { if (edit) setEdit(false); else startEdit(); }}>{edit ? "отмена" : "правка"}</button>
      </h4>
      {edit ? (
        <>
          <div className="rt-editor-blocks">
            {segs.map((sg, i) => (
              sg.type === "spoiler" ? (
                <div className="ed-spoiler" key={i}>
                  <button type="button" className="ed-spoiler-chev" title="развернуть/свернуть"
                    onClick={() => updateSeg(i, { open: !sg.open })}>
                    <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor">
                      <path d="M10 6L8.59 7.41 13.17 12l-4.58 4.59L10 18l6-6z" />
                    </svg>
                  </button>
                  <input className="ed-spoiler-title" value={sg.summary} placeholder="Заголовок спойлера"
                    onChange={e => updateSeg(i, { summary: e.target.value })} />
                  <button className="ed-spoiler-del" title="удалить спойлер"
                    onClick={() => removeSeg(i)}>×</button>
                  <textarea className="ed-spoiler-body" rows={3} value={sg.body} placeholder="Скрытый текст"
                    onChange={e => updateSeg(i, { body: e.target.value })} />
                </div>
              ) : (
                <textarea
                  key={i}
                  ref={el => { if (el && el === taRef.current) { } }}
                  data-idx={i}
                  className="rt-edit rt-edit-line"
                  rows={Math.max(1, (sg.text || "").split("\n").length)}
                  value={sg.text}
                  onFocus={e => { taRef.current = e.target; }}
                  onChange={e => updateSeg(i, { text: e.target.value })}
                  onContextMenu={e => {
                    e.preventDefault();
                    taRef.current = e.target;
                    setMenu({ x: e.clientX, y: e.clientY });
                  }}
                />
              )
            ))}
            <InsertBar onFormat={onFormat} onInsert={onInsert} />
          </div>
          <div style={{ display: "flex", gap: 8, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="save-btn" onClick={() => { setDoc(c, blockKey, segmentsToDoc(segs)); onSave(); setEdit(false); }}>Сохранить</button>
            <span className="hint">{RT_HINT}</span>
          </div>
          {menu ? (
            <TextMenu x={menu.x} y={menu.y} resources={resources}
              onClose={() => setMenu(null)} onFormat={onFormat} onInsert={onInsert} />
          ) : null}
        </>
      ) : (
        <div className="rt" onClick={startEdit} title="клик — править">
          {renderDoc(doc, resCtx) || <span className="hint">— (клик, чтобы вписать)</span>}
        </div>
      )}
      {resModal && c.data.resources[resModal.id] ? (
        <ResourceModal
          resource={c.data.resources[resModal.id]}
          onChange={(nr) => onResourceChange(resModal.id, nr)}
          onDelete={() => {
            delete c.data.resources[resModal.id];
            setResModal(null);
            onSave();
          }}
          onClose={() => setResModal(null)}
        />
      ) : null}
    </div>
  );
}

function GearTab({ c, onSave }) {
  const d = c.data;
  const str = d.stats?.str?.score ?? 10;
  const size = d.info?.size?.value || "medium";
  return (
    <>
      <div style={{ display: "flex", gap: 16, justifyContent: "center", marginBottom: 12 }}>
        <div><div className="mini-label">ГРУЗОПОДЪЁМНОСТЬ</div>
          <div className="chip-sm" style={{ fontSize: 13 }}>{str * 15} / {str * 30} фнт.</div></div>
        <div><div className="mini-label">РАЗМЕР</div>
          <div className="chip-sm" style={{ fontSize: 13 }}>{SIZES[size] || size}</div></div>
      </div>
      <RtBlock c={c} title="Снаряжение" blockKey="equipment" onSave={onSave} />
      <RtBlock c={c} title="Сокровища" blockKey="treasure" onSave={onSave} />
    </>
  );
}
