import React, { useEffect, useState, useRef, useMemo } from "react";
import { characters, save } from "./store.js";
import { SPELL_BY_ID, SPELL_BY_SLUG } from "./store.js";
import { Editable, Popover, ProfPopover, DieIcon, CreateModal, useAnchorPos, Toggle } from "./ui.jsx";
import SpellsTab from "./Spells.jsx";
import WeaponModal, { weaponBonus, damageInfo } from "./WeaponModal.jsx";
import { AvatarMenu, SettingsDrawer, PortraitDrawer } from "./panels.jsx";
import { getUi, setUi } from "./uistore.js";
import { Avatar } from "./List.jsx";
import { renderDoc, docToText, textToDoc, docToEditorHtml, editorToDoc, resourceBlockHtml, GUARD_HTML } from "./richtext.jsx";
import TextMenu from "./TextMenu.jsx";
import InsertBar from "./InsertBar.jsx";
import ResourceModal from "./ResourceModal.jsx";
import HealthModal from "./HealthModal.jsx";
import CoinsModal, { CoinBadge } from "./CoinsModal.jsx";
import { getRollHistory, subscribeRollHistory } from "./rollHistory.js";
import { HistoryIcon } from "./RollHistoryModal.jsx";
import {
  SKILLS, STAT_NAMES, XP, CONDITIONS_RU, SIZES, TABS,
  hp, profOf, coinsTotal, statMod, skillProf, skillCustom, skillBonus,
  saveProf, saveBonus, passive, docOf, setDoc, levelOf,
} from "./helpers.js";
import { signed, parseNum, esc, evalStat } from "./dice.js";
import { FormulaInput, SuggestDropdown, getVariableList, filterVariables } from "./FormulaSuggest.jsx";

export default function Sheet({ idx, back, fresh, onFreshDone }) {
  const c = characters[idx];
  const [tab, setTab] = useState("attacks");
  const [ver, setVer] = useState(0);
  const [ui, setUiState] = useState(getUi());
  const [showSettings, setShowSettings] = useState(false);
  const [showPortrait, setShowPortrait] = useState(false);
  const [historyCount, setHistoryCount] = useState(() => getRollHistory().length);
  const rerender = () => { save(); setVer(x => x + 1); };
  const patchUi = (p) => setUiState(setUi(p));

  useEffect(() => {
    return subscribeRollHistory(list => setHistoryCount(list.length));
  }, []);

  useEffect(() => {
    window.__activeChar = c;
    return () => { if (window.__activeChar === c) window.__activeChar = null; };
  }, [c]);

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
        <button
          type="button"
          className="top-history-btn"
          onClick={() => window.__openRollHistory?.()}
          title="История бросков"
        >
          <HistoryIcon size={16} />
          <span>История бросков</span>
          {historyCount > 0 && <span className="top-history-badge">{historyCount > 99 ? "99+" : historyCount}</span>}
        </button>
        <button
          type="button"
          className="top-history-btn"
          onClick={() => window.__openThemeModal?.()}
          title="Настройки оформления и эффектов"
        >
          <span>🎨</span>
          <span>Тема</span>
        </button>
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
            {tab === "persona" && <TextTab c={c} onSave={rerender} blocks={[["Внешний вид", "appearance"], ["Предыстория", "background"], ["Узы", "bonds"], ["Слабости", "flaws"], ["Союзники и организации", "allies"]]} />}
            {tab === "goals" && <TextTab c={c} onSave={rerender} blocks={[["Цели и задания", "quests"]]} />}
            {tab === "notes" && <TextTab c={c} onSave={rerender} blocks={[["Заметки", "notes-1"]]} />}
            {tab === "spells" && <SpellsTab c={c} onSave={rerender} ui={ui} />}
          </div>
        </div>
      </div>
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
        {(() => {
          const speedInfo = evalStat(v.speed?.value ?? 30, c, 30);
          return (
            <div className="vital" title={speedInfo.isFormula ? `Скорость: ${speedInfo.raw} → ${speedInfo.resolved} = ${speedInfo.total}` : "скорость"}>
              <div>
                <div className="v-main">
                  <Editable
                    value={v.speed?.value ?? 30}
                    displayValue={speedInfo.total}
                    onSave={x => { v.speed = { value: x }; onSave(); }}
                    width={56}
                  />
                </div>
                <div className="v-sub">скорость{speedInfo.isFormula ? " ƒ" : ""}</div>
              </div>
            </div>
          );
        })()}
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
  const pos = useAnchorPos(open, ref, { dx: -70, dy: 8, width: 220 });
  const v = c.data.vitality ||= {};
  const rawAc = v.ac?.value ?? 10;
  const acInfo = evalStat(rawAc, c, 10);
  const base = acInfo.total;
  const shield = !!v.shield?.value;
  const total = base + (shield ? 2 : 0);
  const [draft, setDraft] = useState(String(rawAc));

  useEffect(() => {
    setDraft(String(rawAc));
  }, [rawAc]);

  const toggleShield = (e) => {
    e.stopPropagation();
    v.shield = { value: !shield };
    onSave();
  };

  const commit = (val) => {
    const trimmed = String(val ?? "").trim();
    v.ac = { value: trimmed };
    onSave();
  };

  return (
    <div style={{ position: "relative" }}>
      <div className="vital" ref={ref} onClick={() => setOpen(!open)}
        title={acInfo.isFormula ? `КД: ${acInfo.raw} → ${acInfo.resolved} = ${base}${shield ? ` (+2 щит = ${total})` : ""}` : "КД и щит"}>
        <svg className={"icon ac-shield" + (shield ? " on" : "")} viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.6" onClick={toggleShield} style={{ cursor: "pointer" }}>
          <path d="M12 2l9 5v6c0 5-4 8-9 9-5-1-9-4-9-9V7l9-5z" />
          {shield ? <path d="M9.5 12l2 2 3.5-3.5" stroke="var(--cyan)" /> : <text x="12" y="15" textAnchor="middle" fontSize="7" stroke="none" fill="currentColor">?</text>}
        </svg>
        <div>
          <div className="v-main">
            {shield ? (
              <>
                <span className="ac-old">{base}</span>
                <span className="ac-new">{total}</span>
              </>
            ) : base}
          </div>
          <div className="v-sub">КД{acInfo.isFormula ? " ƒ" : ""}</div>
        </div>
      </div>
      {open && pos ? (
        <Popover onClose={() => setOpen(false)} style={{ left: pos.left, top: pos.top, minWidth: 220 }}>
          <div className="pop-title">КД и щит</div>
          <label className="pop-field">КД (без щита)
            <FormulaInput
              value={draft}
              char={c}
              placeholder="10 или [dex] + [con] + 10"
              onChange={setDraft}
              onKeyDown={e => {
                if (e.key === "Enter") {
                  commit(draft);
                  setOpen(false);
                }
              }}
              onBlur={() => commit(draft)}
            />
          </label>
          {acInfo.isFormula ? (
            <div className="f-hint" style={{ marginTop: 4, marginBottom: 6, color: "var(--purple2)" }}>
              ƒ {acInfo.raw} → <b>{acInfo.resolved}</b> = <b>{base}</b>
            </div>
          ) : null}
          <Toggle checked={!!v.shield?.value} label="Щит (+2 КД)"
            onChange={val => { v.shield = { value: val }; onSave(); }} />
          {shield ? (
            <div className="f-hint" style={{ marginTop: 6 }}>
              Итоговое КД: <b>{base}</b> + 2 = <b>{total}</b>
            </div>
          ) : null}
        </Popover>
      ) : null}
    </div>
  );
}

/* ===== Монеты (?modal=coins) ===== */
function GoldPill({ c, onSave }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <div className="gold-pill" onClick={() => setOpen(true)} title="Калькулятор монет">
        <CoinBadge coinKey="gp" size="sm" /> <span>{coinsTotal(c)}</span>
      </div>
      {open ? <CoinsModal c={c} onSave={onSave} onClose={() => setOpen(false)} /> : null}
    </>
  );
}

/* ===== HP ===== */
function HpBox({ c, onSave }) {
  const [open, setOpen] = useState(false);
  const v = c.data.vitality ||= {};
  const h = hp(c);
  const low = h.cur < h.max * .34;
  return (
    <div style={{ position: "relative" }}>
      <div className={"hp-box" + (low ? " low" : "")} onClick={() => setOpen(true)} title="хиты">
        <HeartIcon /> {h.cur}/{h.max}{h.temp ? <span className="hp-temp">+{h.temp}</span> : ""}
      </div>
      {open ? <HealthModal c={c} onSave={onSave} onClose={() => setOpen(false)} /> : null}
    </div>
  );
}

function HeartIcon() {
  return <svg className="hp-heart" viewBox="0 0 24 24" width="14" height="14" fill="currentColor"><path d="M12 21S4 14.5 4 9.2C4 6.3 6.2 4 9 4c1.6 0 2.7.8 3 1.6C12.3 4.8 13.4 4 15 4c2.8 0 5 2.3 5 5.2C20 14.5 12 21 12 21z" /></svg>;
}

/* ================= Вторая строка ================= */
function SubVitals({ c, onSave }) {
  const d = c.data, v = d.vitality ||= {};
  const initCustom = evalStat(v.initiative?.value, c, 0);
  const initBonus = statMod(c, "dex") + initCustom.total;
  const [initDraft, setInitDraft] = useState(String(v.initiative?.value ?? ""));

  useEffect(() => {
    setInitDraft(String(v.initiative?.value ?? ""));
  }, [v.initiative?.value]);

  const conds = d.conditions ||= [];
  const [condOpen, setCondOpen] = useState(false);
  const [initOpen, setInitOpen] = useState(false);
  const initRef = useRef(null);
  const condRef = useRef(null);
  const initPos = useAnchorPos(initOpen, initRef, { dx: 0, dy: 8, width: 220 });
  const condPos = useAnchorPos(condOpen, condRef, { dx: 0, dy: 8, width: 240 });
  return (
    <div className="subvitals">
      <div style={{ position: "relative" }}>
        <div className="subvital" ref={initRef} title={initCustom.isFormula ? `Инициатива: [dex] (${signed(statMod(c, "dex"))}) + ${initCustom.raw} (${initCustom.total}) = ${signed(initBonus)}` : "клик — бросок; правый клик — правка"}
          onClick={e => window.__rollD20("Инициатива", initBonus, "")}
          onContextMenu={e => { e.preventDefault(); setInitOpen(true); }}>
          <div className="sv-v">{signed(initBonus)}</div><div className="sv-l">Инициатива{initCustom.isFormula ? " ƒ" : ""}</div>
        </div>
        {initOpen && initPos ? (
          <Popover onClose={() => { setInitOpen(false); onSave(); }} style={{ left: initPos.left, top: initPos.top, minWidth: 220 }}>
            <div className="pop-title">Бонус инициативы</div>
            <FormulaInput
              autoFocus
              value={initDraft}
              char={c}
              placeholder="0 или [WIS]"
              onChange={setInitDraft}
              onKeyDown={e => { if (e.key === "Enter") { v.initiative = { value: initDraft.trim() }; onSave(); setInitOpen(false); } }}
              onBlur={() => { v.initiative = { value: initDraft.trim() }; onSave(); }}
            />
            {initCustom.isFormula ? (
              <div className="f-hint" style={{ marginTop: 4, color: "var(--purple2)" }}>
                ƒ {initCustom.raw} → <b>{initCustom.resolved}</b> = <b>{initCustom.total}</b>
              </div>
            ) : null}
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
              <Toggle key={k} checked={conds.includes(k)} label={label}
                onChange={val => {
                  if (val) conds.push(k);
                  else c.data.conditions = conds.filter(x => x !== k);
                  onSave();
                }} />
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
  const [rolling, setRolling] = useState(false);
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
  const handleRoll = (e) => {
    e.stopPropagation();
    setRolling(false);
    requestAnimationFrame(() => {
      setRolling(true);
      setTimeout(() => setRolling(false), 450);
    });
    window.__rollD20(name, b, custom != null ? "кастом" : "");
  };
  return (
    <div className={"skill-row" + (p === 1 ? " p1" : p === 2 ? " p2" : "")}>
      <span className="dot" title="владение (клик)" onClick={e => { e.stopPropagation(); setAnchor(e.currentTarget); }} />
      <span className="s-name" onClick={e => setAnchor(e.currentTarget)}>{name}</span>
      <button className={"roll-btn" + (rolling ? " is-rolling" : "")} onClick={handleRoll}>{signed(b)}</button>
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
        <div
          className="passive"
          data-tooltip="Пассивное восприятие (Мудрость)"
          title="Пассивное восприятие (Мудрость)"
        >
          <span className="pi"><EyeIcon /></span>{passive(c, "perception")}
        </div>
        <div
          className="passive"
          data-tooltip="Пассивный анализ (Интеллект)"
          title="Пассивный анализ (Интеллект)"
        >
          <span className="pi"><BrainIcon /></span>{passive(c, "investigation")}
        </div>
        <div
          className="passive"
          data-tooltip="Пассивная проницательность (Мудрость)"
          title="Пассивная проницательность (Мудрость)"
        >
          <span className="pi"><BulbIcon /></span>{passive(c, "insight")}
        </div>
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
                        if (info.ok) window.__rollExpr(`Урон: ${w.name?.value || "оружие"}`, info.dice, info.abil, STAT_NAMES[w.ability || "str"], { sub: info.type });
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

const RT_HINT = "ПКМ — меню: спойлер, ресурс, бросок · Ctrl+D — формула ([[1d20 + [STR]]]) · **жирный**, *курсив*, ||спойлер||, {{ресурс}}";

/* ---------- Защитные пустые строки вокруг спойлера ---------- */
const isGuard = (el) => !!(el && el.nodeType === 1 && el.classList.contains("ed-guard"));

/* ближайший блок (абзац) вокруг узла */
function blockOf(node, root) {
  let n = node;
  while (n && n !== root) {
    if (n.nodeType === 1) {
      const t = n.tagName.toLowerCase();
      if (t === "p" || t === "div" || t === "li") return n;
    }
    n = n.parentNode;
  }
  return root;
}

/* соседний блочный элемент */
function siblingBlock(el, dir) {
  let n = dir < 0 ? el.previousSibling : el.nextSibling;
  while (n) {
    if (n.nodeType === 1) return n;
    if (n.nodeType === 3 && n.textContent.trim()) return null;
    n = dir < 0 ? n.previousSibling : n.nextSibling;
  }
  return null;
}

function caretAtStart(range, block) {
  try {
    const r = range.cloneRange();
    r.selectNodeContents(block);
    r.setEnd(range.startContainer, range.startOffset);
    return r.toString().length === 0;
  } catch { return false; }
}

function caretAtEnd(range, block) {
  try {
    const r = range.cloneRange();
    r.selectNodeContents(block);
    r.setStart(range.endContainer, range.endOffset);
    return r.toString().length === 0;
  } catch { return false; }
}

/* создать пустую защитную строку */
function makeGuard() {
  const g = document.createElement("p");
  g.className = "ed-guard";
  g.dataset.guard = "1";
  g.appendChild(document.createElement("br"));
  return g;
}

function TextTab({ c, onSave, blocks }) {
  return blocks.map(([title, key]) => <RtBlock key={key} c={c} title={title} blockKey={key} onSave={onSave} />);
}

function RtBlock({ c, title, blockKey, onSave, compact }) {
  const [edit, setEdit] = useState(false);
  const [menu, setMenu] = useState(null);
  const [resModal, setResModal] = useState(null);
  const [diePick, setDiePick] = useState(null);   // {el, x, y, formula} — выбор кубика / формулы
  const [formulasActive, setFormulasActive] = useState(true);
  const [richSuggest, setRichSuggest] = useState(null);
  const allVars = useMemo(() => getVariableList(c), [c]);
  const richRef = useRef(null);
  const doc = docOf(c, blockKey);
  const resources = Object.values(c.data.resources || {});

  const checkRichSuggest = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      setRichSuggest(null);
      return;
    }
    const range = sel.getRangeAt(0);
    const node = range.startContainer;
    if (node.nodeType !== 3) {
      setRichSuggest(null);
      return;
    }
    const textBefore = node.textContent.slice(0, range.startOffset);
    const lastOpen = textBefore.lastIndexOf("[");
    if (lastOpen >= 0) {
      const textAfterOpen = textBefore.slice(lastOpen + 1);
      if (!textAfterOpen.includes("]") && !/[\r\n]/.test(textAfterOpen)) {
        const query = textAfterOpen;
        const matches = filterVariables(allVars, query);
        if (matches.length > 0) {
          const rect = range.getBoundingClientRect();
          setRichSuggest(prev => ({
            query,
            node,
            startOffset: lastOpen,
            endOffset: range.startOffset,
            matches,
            activeIndex: prev ? Math.min(prev.activeIndex, matches.length - 1) : 0,
            x: rect.left,
            y: rect.bottom + 6
          }));
          return;
        }
      }
    }
    setRichSuggest(null);
  };

  const applyRichSuggest = (item) => {
    if (!richSuggest) return;
    const { node, startOffset, endOffset } = richSuggest;
    const text = node.textContent;
    let after = text.slice(endOffset);
    if (after.startsWith("]")) after = after.slice(1);
    const inserted = `[${item.code}]`;
    const newText = text.slice(0, startOffset) + inserted + after;
    node.textContent = newText;
    setRichSuggest(null);

    const sel = window.getSelection();
    const newRange = document.createRange();
    newRange.setStart(node, startOffset + inserted.length);
    newRange.collapse(true);
    sel.removeAllRanges();
    sel.addRange(newRange);
  };

  // один общий текстовый слой со встроенными спойлерами
  useEffect(() => {
    if (!edit || !richRef.current) return;
    if (richRef.current.dataset.filled === "1") return;
    richRef.current.innerHTML = docToEditorHtml(doc, {
      resources: c.data.resources || {},
      deactivateFormulas: !formulasActive
    });
    richRef.current.dataset.filled = "1";
  }, [edit, doc, formulasActive]);

  const toggleFormulasActive = () => {
    const next = !formulasActive;
    setFormulasActive(next);
    if (richRef.current) {
      const currentDoc = editorToDoc(richRef.current);
      richRef.current.innerHTML = docToEditorHtml(currentDoc, {
        resources: c.data.resources || {},
        deactivateFormulas: !next
      });
      repairGuards();
    }
  };

  /* перед и после каждого спойлера должна быть пустая защитная строка,
     иначе поле «ломается» — восстанавливаем структуру */
  const repairGuards = () => {
    const root = richRef.current;
    if (!root) return;
    for (const sp of Array.from(root.querySelectorAll(".ed-sp"))) {
      if (sp.parentNode !== root) continue;
      const prev = sp.previousElementSibling;
      if (!isGuard(prev)) root.insertBefore(makeGuard(), sp);
      const next = sp.nextElementSibling;
      if (!isGuard(next)) root.insertBefore(makeGuard(), sp.nextSibling);
    }
  };

  /* если в защитную строку ввели текст — она перестаёт быть защитной
     и становится обычной строкой; спойлеру добавляется свежая пустая защита */
  const onEditorInput = () => {
    const root = richRef.current;
    if (!root) return;
    for (const g of Array.from(root.querySelectorAll(".ed-guard"))) {
      const txt = (g.textContent || "").replace(/[\u200b\s]/g, "");
      if (!txt) continue;
      g.classList.remove("ed-guard");
      g.removeAttribute("data-guard");
      g.classList.add("ed-p");
    }
    repairGuards();
    checkRichSuggest();
  };

  /* защитные строки удалять нельзя — блокируем удаление */
  const onBeforeInput = (e) => {
    const it = e.inputType || "";
    if (!it.startsWith("delete")) return;
    const root = richRef.current;
    const sel = window.getSelection();
    if (!root || !sel || !sel.rangeCount) return;
    const range = sel.getRangeAt(0);

    // выделено всё поле — разрешаем очистить
    try {
      const all = range.cloneRange();
      all.selectNodeContents(root);
      if (range.startContainer === all.startContainer && range.startOffset === all.startOffset
        && range.endContainer === all.endContainer && range.endOffset === all.endOffset) return;
    } catch { /* игнорируем */ }

    // выделение пересекает защитную строку (кроме выделения внутри неё)
    for (const g of Array.from(root.querySelectorAll(".ed-guard"))) {
      if (!range.intersectsNode || !range.intersectsNode(g)) continue;
      const inside = g.contains(range.startContainer) && g.contains(range.endContainer);
      if (!inside) { e.preventDefault(); return; }
    }

    if (!range.collapsed) return;
    const block = blockOf(range.startContainer, root);
    if (!block || block === root) return;

    const prev = siblingBlock(block, -1);
    const next = siblingBlock(block, 1);
    const empty = (b) => isGuard(b) && !(b.textContent || "").replace(/[\u200b\s]/g, "");

    // каретка в начале абзаца: нельзя слить абзац с пустой защитной строкой
    if (caretAtStart(range, block) && (empty(block) || empty(prev))) { e.preventDefault(); return; }
    // каретка в конце абзаца: нельзя затереть пустую защитную строку впереди
    if (caretAtEnd(range, block) && (empty(block) || empty(next))) { e.preventDefault(); return; }
  };

  useEffect(() => {
    const root = richRef.current;
    if (!edit || !root) return;
    const h1 = (e) => onBeforeInput(e);
    const h2 = () => onEditorInput();
    root.addEventListener("beforeinput", h1);
    root.addEventListener("input", h2);
    return () => {
      root.removeEventListener("beforeinput", h1);
      root.removeEventListener("input", h2);
    };
  }, [edit]);

  const startEdit = () => setEdit(true);
  const closeEdit = () => {
    if (richRef.current) richRef.current.dataset.filled = "";
    setEdit(false);
  };
  const save = () => {
    const el = richRef.current;
    if (!el) return;
    const d = editorToDoc(el);
    // название ресурса, отредактированное прямо в тексте, → в данные персонажа
    const rs = c.data.resources || {};
    const walk = (node) => {
      for (const n of node.content || []) {
        if (n.type === "resource" && n.attrs?.id) {
          const r = rs[n.attrs.id];
          const nm = (n.attrs.name || "").trim();
          if (r && nm && nm !== r.name) r.name = nm;
        }
        walk(n);
      }
    };
    walk(d);
    setDoc(c, blockKey, d);
    onSave();
    closeEdit();
  };

  // команды работают с текущим выделением внутри contenteditable
  // вставка идёт в текстовое поле: возвращаем туда фокус и каретку
  const withCaret = (fn) => {
    const root = richRef.current;
    const sel = window.getSelection();
    let range = null;
    if (sel && sel.rangeCount && root && root.contains(sel.anchorNode)) range = sel.getRangeAt(0).cloneRange();
    if (root) root.focus();
    if (range && sel) { sel.removeAllRanges(); sel.addRange(range); }
    fn();
  };

  const exec = (cmd, val = null) => {
    richRef.current?.focus();
    document.execCommand(cmd, false, val);
  };

  const insertSpoiler = () => withCaret(() => {
    const html = GUARD_HTML
      + '<div class="ed-sp" data-sp="1" contenteditable="false">'
      + '<div class="ed-sp-head">'
      + '<button type="button" class="ed-sp-chev" contenteditable="false">›</button>'
      + '<span class="ed-sp-title" contenteditable="true">Спойлер</span>'
      + '<button type="button" class="ed-sp-unwrap" contenteditable="false">×</button>'
      + '</div><div class="ed-sp-body" contenteditable="true"><p>содержимое спойлера</p></div></div>'
      + GUARD_HTML;
    document.execCommand("insertHTML", false, html);
  });

  const insertResource = (res) => withCaret(() => {
    let r = res;
    let created = false;
    if (!r) {
      // новый ресурс персонажа — сразу открываем его настройки
      const id = "resource-" + Date.now();
      r = { id, name: "настроить", current: 0, max: 0, formula: "", isShortRest: false, isLongRest: false, notes: { value: "" } };
      c.data.resources = c.data.resources || {};
      c.data.resources[id] = r;
      created = true;
    }
    const html = resourceBlockHtml(r.id, r.name, r.current || 0, r.max || 0);
    document.execCommand("insertHTML", false, html);
    if (created) { onSave(); setResModal({ id: r.id }); }
  });

  const toggleRollFormula = () => {
    const sel = window.getSelection();
    if (!sel || !sel.rangeCount) {
      withCaret(() => {
        document.execCommand("insertHTML", false, '<span class="ed-roller" contenteditable="false">🎲 1d20 + [STR]</span>');
      });
      return;
    }
    const range = sel.getRangeAt(0);
    const root = richRef.current;
    if (!root || !root.contains(range.commonAncestorContainer)) {
      withCaret(() => {
        document.execCommand("insertHTML", false, '<span class="ed-roller" contenteditable="false">🎲 1d20 + [STR]</span>');
      });
      return;
    }

    // Проверяем, находится ли курсор внутри .ed-roller
    let roller = null;
    let node = range.commonAncestorContainer;
    while (node && node !== root) {
      if (node.nodeType === 1 && node.classList.contains("ed-roller")) {
        roller = node;
        break;
      }
      node = node.parentNode;
    }

    if (roller) {
      // Разворачиваем формулу в текст
      const raw = roller.textContent.replace(/^🎲\s*/, "");
      const textNode = document.createTextNode(raw);
      roller.parentNode.replaceChild(textNode, roller);
      const newRange = document.createRange();
      newRange.selectNodeContents(textNode);
      sel.removeAllRanges();
      sel.addRange(newRange);
      return;
    }

    // Если выделен текст — оборачиваем в формулу
    const selectedText = sel.toString().trim();
    if (selectedText) {
      let cleanText = selectedText;
      if (cleanText.startsWith("[[") && cleanText.endsWith("]]")) {
        cleanText = cleanText.slice(2, -2).trim();
      }
      const html = `<span class="ed-roller" contenteditable="false">🎲 ${esc(cleanText)}</span>`;
      document.execCommand("insertHTML", false, html);
    } else {
      const html = `<span class="ed-roller" contenteditable="false">🎲 1d20 + [STR]</span>`;
      document.execCommand("insertHTML", false, html);
    }
  };

  const insertRoll = () => withCaret(toggleRollFormula);

  const onEditorKeyDown = (e) => {
    if (richSuggest && richSuggest.matches.length > 0) {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setRichSuggest(s => ({ ...s, activeIndex: (s.activeIndex + 1) % s.matches.length }));
        return;
      }
      if (e.key === "ArrowUp") {
        e.preventDefault();
        setRichSuggest(s => ({ ...s, activeIndex: (s.activeIndex - 1 + s.matches.length) % s.matches.length }));
        return;
      }
      if (e.key === "Enter" || e.key === "Tab") {
        e.preventDefault();
        applyRichSuggest(richSuggest.matches[richSuggest.activeIndex]);
        return;
      }
      if (e.key === "Escape") {
        e.preventDefault();
        setRichSuggest(null);
        return;
      }
    }
    if ((e.ctrlKey || e.metaKey) && (e.key === "d" || e.key === "D" || e.key === "в" || e.key === "В")) {
      e.preventDefault();
      toggleRollFormula();
      return;
    }
  };

  const insertDivider = () => {
    richRef.current?.focus();
    document.execCommand("insertHTML", false, '<hr class="ed-divider"><p><br></p>');
  };

  const onFormat = (mark) => {
    const map = { "**": "bold", "*": "italic", "__": "underline", "~~": "strikeWithSelection", "`": "code" };
    const cmd = map[mark];
    if (!cmd) return;
    withCaret(() => {
      if (cmd === "strikeWithSelection") { document.execCommand("strikeThrough"); return; }
      document.execCommand(cmd, false, null);
    });
  };

  const onInsert = (kind, res) => {
    if (kind === "spoiler") { insertSpoiler(); return; }
    if (kind === "resource") { insertResource(res); return; }
    if (kind === "roll") { insertRoll(); return; }
    if (kind === "divider") { insertDivider(); return; }
    if (kind === "list") { exec("insertUnorderedList"); return; }
  };

  // клики по элементам спойлера внутри contenteditable
  const onRichClick = (e) => {
    const el = e.target;
    const root = richRef.current;
    if (!root) return;
    const roller = el.closest?.(".ed-roller");
    if (roller) {
      e.preventDefault();
      const r = roller.getBoundingClientRect();
      const formula = roller.textContent.replace(/^🎲\s*/, "");
      setDiePick({ el: roller, x: r.left, y: r.bottom, formula });
      return;
    }
    const resPlus = el.closest?.(".ed-sp-res [data-type=increment]");
    const resMinus = el.closest?.(".ed-sp-res [data-type=decrement]");
    if (resPlus || resMinus) {
      e.preventDefault();
      const block = (resPlus || resMinus).closest(".ed-sp-res");
      const id = block?.dataset.res;
      const rs = c.data.resources || {};
      if (id && rs[id]) {
        const d = resPlus ? 1 : -1;
        const mx = rs[id].max ?? 0;
        let next = Math.max(0, (rs[id].current ?? 0) + d);
        if (mx > 0) next = Math.min(next, mx);
        onResourceChange(id, { current: next });
      }
      return;
    }
    const resBlock = el.closest?.(".ed-sp-res");
    if (resBlock) {
      const rid = resBlock.dataset.res;
      if (el.closest?.(".ed-sp-unwrap")) {
        e.preventDefault();
        resBlock.remove();
        return;
      }
      if (el.closest?.(".ed-sp-trash")) {
        e.preventDefault();
        resBlock.remove();
        if (rid && c.data.resources) { delete c.data.resources[rid]; onSave(); }
        return;
      }
      if (el.closest?.(".res-chip__gear")) {
        e.preventDefault();
        if (rid) setResModal({ id: rid });
        return;
      }
      if (el.closest?.(".res-chip__name")) return;   // каретка в названии — можно править текст
      if (el.closest?.(".res-chip__btn")) return;   // кнопки счётчика обработаны выше
      return;
    }
    const resChip = el.closest?.(".ed-res-row") || el.closest?.(".ed-res");
    if (resChip && resChip.dataset.res) {
      e.preventDefault();
      setResModal({ id: resChip.dataset.res });
      return;
    }
    const chev = el.closest?.(".ed-sp-chev");
    if (chev) {
      e.preventDefault();
      const sp = chev.closest(".ed-sp");
      const body = sp?.querySelector(".ed-sp-body");
      if (body) {
        const hidden = body.style.display === "none";
        body.style.display = hidden ? "" : "none";
        sp.classList.toggle("open", hidden);
      }
      return;
    }
    const unwrap = el.closest?.(".ed-sp-unwrap");
    if (unwrap) {
      e.preventDefault();
      const sp = unwrap.closest(".ed-sp");
      const body = sp?.querySelector(".ed-sp-body");
      if (!sp || !body) return;
      // снимаем обёртку — текст остаётся
      const frag = document.createDocumentFragment();
      Array.from(body.children).forEach(ch => frag.appendChild(ch));
      const g1 = sp.previousElementSibling, g2 = sp.nextElementSibling;
      sp.replaceWith(frag);
      // спойлера больше нет — убираем и защитные строки
      if (isGuard(g1)) g1.remove();
      if (isGuard(g2)) g2.remove();
      return;
    }
    const trash = el.closest?.(".ed-sp-trash");
    if (trash) {
      e.preventDefault();
      const sp = trash.closest(".ed-sp");
      if (!sp) return;
      const g1 = sp.previousElementSibling, g2 = sp.nextElementSibling;
      sp.remove();
      if (isGuard(g1)) g1.remove();
      if (isGuard(g2)) g2.remove();
    }
  };

  const onResourceChange = (id, patch) => {
    const rs = c.data.resources || {};
    if (!rs[id]) return;
    rs[id] = { ...rs[id], ...patch };
    onSave();
    // обновляем блок прямо в редакторе, чтобы название/счётчик не расходились
    const root = richRef.current;
    if (root) {
      const block = root.querySelector('[data-res="' + id + '"]');
      if (block) {
        const titleEl = block.querySelector(".res-chip__name");
        if (titleEl && rs[id].name != null) titleEl.textContent = rs[id].name;
        const valEl = block.querySelector(".res-chip__val");
        if (valEl) {
          const mx = rs[id].resolvedMax ?? rs[id].max ?? 0;
          const cv = rs[id].current ?? 0;
          valEl.textContent = mx > 0 ? `${cv}/${mx}` : String(cv);
        }
      }
    }
  };

  /* спойлер в листе (без режима правки): × — оставить только текст, 🗑 — удалить блок */
  const changeDoc = (next) => {
    setDoc(c, blockKey, next);
    onSave();
  };

  const spoilerUnwrap = (node) => {
    const content = (doc?.content || []).slice();
    const i = content.indexOf(node);
    if (i < 0) return;
    const body = (node.content || []).find(x => x.type === "spoilerContent");
    const paras = body?.content || [];
    content.splice(i, 1, ...paras);
    changeDoc({ type: "doc", content });
  };

  const spoilerTrash = (node) => {
    const content = (doc?.content || []).slice();
    const i = content.indexOf(node);
    if (i < 0) return;
    content.splice(i, 1);
    changeDoc({ type: "doc", content });
  };

  const resCtx = {
    char: c,
    resources: c.data.resources || {},
    onResource: onResourceChange,
    onResourceOpen: (id) => setResModal({ id }),
    onSpoilerUnwrap: spoilerUnwrap,
    onSpoilerTrash: spoilerTrash,
  };

  useEffect(() => {
    if (!diePick) return;
    const close = (e) => {
      if (!e.target.closest(".die-pick") && !e.target.closest(".ed-roller")) {
        setDiePick(null);
      }
    };
    const key = (e) => { if (e.key === "Escape") setDiePick(null); };
    window.addEventListener("mousedown", close);
    window.addEventListener("keydown", key);
    return () => {
      window.removeEventListener("mousedown", close);
      window.removeEventListener("keydown", key);
    };
  }, [diePick]);

  return (
    <div className="panel">
      <h4 style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <span>{title.toUpperCase()}</span>
        <button className="edit-toggle" onClick={() => { if (edit) closeEdit(); else startEdit(); }}>{edit ? "отмена" : "правка"}</button>
      </h4>
      {edit ? (
        <>
          <div className="rt-editor-blocks">
            <div
              ref={richRef}
              className="rt-rich"
              contentEditable
              suppressContentEditableWarning
              onInput={onEditorInput}
              onKeyUp={checkRichSuggest}
              onClick={onRichClick}
              onKeyDown={onEditorKeyDown}
              onContextMenu={e => { e.preventDefault(); setMenu({ x: e.clientX, y: e.clientY }); }}
            />
            <InsertBar onFormat={onFormat} onInsert={onInsert} />
          </div>
          {richSuggest ? (
            <SuggestDropdown
              items={richSuggest.matches}
              activeIndex={richSuggest.activeIndex}
              onSelect={applyRichSuggest}
              position={{ left: richSuggest.x, top: richSuggest.y }}
            />
          ) : null}
          <div style={{ display: "flex", gap: 10, marginTop: 6, alignItems: "center", flexWrap: "wrap" }}>
            <button className="save-btn" onClick={save}>Сохранить</button>
            <label className="ed-toggle-formulas" title="Деактивировать формулы для редактирования как [[текст]]">
              <input type="checkbox" checked={formulasActive} onChange={toggleFormulasActive} />
              Формулы активны (Ctrl+D)
            </label>
            <span className="hint">{RT_HINT}</span>
          </div>
          {menu ? (
            <TextMenu x={menu.x} y={menu.y} resources={resources}
              onClose={() => setMenu(null)} onFormat={onFormat} onInsert={onInsert} />
          ) : null}
          {diePick ? (
            <div className="die-pick" style={{ left: diePick.x, top: diePick.y }}
              onMouseDown={e => e.stopPropagation()}>
              <div className="die-pick-title">ФОРМУЛА БРОСКА</div>
              <div className="die-pick-row">
                {[4, 6, 8, 10, 12, 20, 100].map(f => (
                  <button key={f} className="die-pick-btn"
                    onClick={() => {
                      const cur = diePick.formula || "";
                      const next = cur ? cur + ` + 1d${f}` : `1d${f}`;
                      diePick.el.textContent = "🎲 " + next;
                      setDiePick(d => ({ ...d, formula: next }));
                    }}>+d{f}</button>
                ))}
              </div>
              <div style={{ marginTop: 6 }}>
                <FormulaInput
                  className="die-pick-input"
                  value={diePick.formula ?? ""}
                  char={c}
                  placeholder="1d20 + [STR] (Атака)"
                  onChange={v => {
                    setDiePick(d => ({ ...d, formula: v }));
                    diePick.el.textContent = "🎲 " + (v || "1d20");
                  }}
                  onKeyDown={e => {
                    if (e.key === "Enter") setDiePick(null);
                  }}
                  autoFocus
                />
              </div>
              <div className="die-pick-actions" style={{ marginTop: 6, display: "flex", gap: 6, justifyContent: "space-between" }}>
                <button
                  type="button"
                  className="die-pick-act-btn"
                  title="Превратить в обычный текст [[текст]]"
                  onClick={() => {
                    const raw = diePick.formula || diePick.el.textContent.replace(/^🎲\s*/, "");
                    const textNode = document.createTextNode(`[[${raw}]]`);
                    diePick.el.parentNode.replaceChild(textNode, diePick.el);
                    setDiePick(null);
                  }}
                >Текст</button>
                <button
                  type="button"
                  className="die-pick-act-btn die-pick-act-del"
                  title="Удалить формулу"
                  onClick={() => {
                    diePick.el.parentNode.removeChild(diePick.el);
                    setDiePick(null);
                  }}
                >Удалить</button>
                <button
                  type="button"
                  className="die-pick-act-btn die-pick-act-ok"
                  onClick={() => setDiePick(null)}
                >Готово</button>
              </div>
            </div>
          ) : null}
        </>
      ) : (
        <div className="rt" title="правь кнопкой «правка» сверху">
          {renderDoc(doc, resCtx) || <span className="hint">— (нажми «правка», чтобы вписать)</span>}
        </div>
      )}
      {resModal && c.data.resources[resModal.id] ? (
        <ResourceModal
          resource={c.data.resources[resModal.id]}
          onChange={(nr) => onResourceChange(resModal.id, nr)}
          onDelete={() => { delete c.data.resources[resModal.id]; setResModal(null); onSave(); }}
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
