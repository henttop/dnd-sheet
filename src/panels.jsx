import React, { useEffect, useMemo, useRef, useState } from "react";
import { save } from "./store.js";
import { levelOf, profOf, PROF_BY_LEVEL, XP } from "./helpers.js";
import ImageCropper from "./ImageCropper.jsx";
import { Toggle } from "./ui.jsx";
import { getRollPresets, saveRollPresets, testDiscordWebhook } from "./webhooks.js";
import { toast } from "./toast.jsx";

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
  const crop = c.data.avatar?.crop;
  if (!url) {
    return (
      <div className={cls + " ava-empty"}>
        <svg viewBox="0 0 24 24" width="26" height="26" fill="currentColor"><path d="M12 12a4 4 0 100-8 4 4 0 000 8zm0 2c-4 0-8 2-8 5v3h16v-3c0-3-4-5-8-5z" /></svg>
      </div>
    );
  }
  // обрезанный по квадрату портрет: храним выбранную область и показываем её
  if (crop && crop.natW) {
    const s = crop.w / crop.natW;
    return (
      <div className={cls + " portrait-crop"}>
        <img src={url} alt="" style={{
          position: "absolute", width: crop.natW * s, height: crop.natH * s,
          left: -crop.x * s, top: -crop.y * s, maxWidth: "none",
        }} />
      </div>
    );
  }
  return <img className={cls} src={url} alt="" onError={e => { e.target.style.display = "none"; }} />;
}

/* ================= Панель «Настройки» ================= */
export function SettingsDrawer({ c, onSave, onClose, onOpenWizard, ui, setUi }) {
  const [subView, setSubView] = useState(null); // null | "rolls" | "spells" | "class" | "srd"
  const d = c.data;
  const v = d.vitality ||= {};
  const info = d.info ||= {};
  const lvl = levelOf(c);

  const initBonus = v.initiative?.value ? +v.initiative.value : 0;
  const speedBonus = v.speed?.custom ? +v.speed.custom : 0;

  if (subView === "rolls") {
    return (
      <Drawer title="Настройки бросков" onClose={onClose} onBack={() => setSubView(null)}>
        <RollsSettingsContent c={c} ui={ui} setUi={setUi} />
      </Drawer>
    );
  }

  if (subView === "spells") {
    return (
      <Drawer title="Настройки заклинаний" onClose={onClose} onBack={() => setSubView(null)}>
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
          <Check label="Показывать сложность спасброска" checked={ui.showDC !== false}
            onChange={v => setUi({ showDC: v })} />
          <Check label="Показывать бонус атаки заклинанием" checked={ui.showAtk !== false}
            onChange={v => setUi({ showAtk: v })} />
        </div>
      </Drawer>
    );
  }

  if (subView === "class") {
    return (
      <Drawer title="Настройки класса" onClose={onClose} onBack={() => setSubView(null)}>
        <Check label="Показывать вкладку «Способности» и «Черты»" checked={ui.showFeatures !== false}
          onChange={v => setUi({ showFeatures: v })} />
      </Drawer>
    );
  }

  if (subView === "srd") {
    return (
      <Drawer title="База знаний" onClose={onClose} onBack={() => setSubView(null)}>
        <Check label="Использовать справочник SRD 5.2 (иначе 5.1)" checked={ui.srd52 !== false}
          onChange={v => setUi({ srd52: v })} />
      </Drawer>
    );
  }

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

      <div className="f-tiles4">
        <Tile label="КЛАСС ЗАЩИТЫ" value={v.ac?.value ?? "—"}
          onChange={x => { v.ac = { value: +x || 0 }; onSave(); }} />
        <Tile label="ИНИЦИАТИВА" value={signedMod(statModOf(c, "dex") + initBonus)} chip={initBonus}
          onChip={x => { v.initiative = { value: x }; onSave(); }}
          onChange={x => { v.initiative = { value: x }; onSave(); }} />
        <Tile label="СКОРОСТЬ" value={v.speed?.value ?? 0} chip={speedBonus}
          onChip={x => { v.speed = { value: (v.speed?.value ?? 30), custom: x }; onSave(); }}
          onChange={x => { v.speed = { value: +x || 0 }; onSave(); }} />
        <div>
          <div className="f-label">РЕДАКЦИЯ ПРАВИЛ</div>
          <div className="seg">
            {["2014", "2024"].map(ed => (
              <button key={ed} className={"seg-btn" + ((c.sheetEdition || "2024") === ed ? " on" : "")}
                onClick={() => { c.edition = ed; c.sheetEdition = ed; onSave(); }}>{ed}</button>
            ))}
          </div>
        </div>
      </div>

      <div style={{ marginBottom: 16 }}>
        <div className="f-label">ПЕРЕВОД</div>
        <select className="f-input" value={ui.lang || "srd"} onChange={e => setUi({ lang: e.target.value })}>
          <option value="srd">Dungeons &amp; Dragons 5e (SRD)</option>
          <option value="ru">ДнД 5e (русский)</option>
        </select>
      </div>

      <div className="settings-nav-list">
        <button className="settings-nav-btn" onClick={onOpenWizard}>
          <span>Конструктор персонажа</span>
          <span className="chev">›</span>
        </button>
        <button className="settings-nav-btn" onClick={() => setSubView("rolls")}>
          <span>Настройки бросков</span>
          <span className="chev">›</span>
        </button>
        <button className="settings-nav-btn" onClick={() => setSubView("spells")}>
          <span>Настройки заклинаний</span>
          <span className="chev">›</span>
        </button>
        <button className="settings-nav-btn" onClick={() => setSubView("class")}>
          <span>Настройки класса</span>
          <span className="chev">›</span>
        </button>
        <button className="settings-nav-btn" onClick={() => setSubView("srd")}>
          <span>База знаний</span>
          <span className="chev">›</span>
        </button>
      </div>

      <div className="f-label f-sep">БОНУС МАСТЕРСТВА</div>
      <div className="f-hint">
        Уровень {lvl} → <b>{PROF_BY_LEVEL(lvl)}</b> (по правилам: 1–4 → +2, 5–8 → +3, 9–12 → +4, 13–16 → +5, 17–20 → +6).
        {profOf(c) !== PROF_BY_LEVEL(lvl) ? " Сейчас переопределён вручную." : ""}
      </div>
      <div className="f-row2" style={{ marginTop: 8 }}>
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

      <button className="support-btn" onClick={() => window.open("https://longstoryshort.app", "_blank")}>
        <span>⭐</span>
        <span>Поддержите нас</span>
      </button>
    </Drawer>
  );
}

/* ================= Подраздел: Настройки бросков (Вебхуки Discord / LSS / TG) ================= */
export function RollsSettingsContent({ c, ui, setUi }) {
  const [presets, setPresets] = useState(() => getRollPresets());
  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [testingId, setTestingId] = useState(null);

  const [formState, setFormState] = useState({
    type: "discord",
    name: "",
    color: "#EBEBEC",
    url: "",
    lssId: "",
    tgChatId: ""
  });

  const handleOpenAdd = () => {
    setEditingId(null);
    setFormState({
      type: "discord",
      name: "",
      color: "#EBEBEC",
      url: "",
      lssId: "",
      tgChatId: ""
    });
    setShowForm(true);
  };

  const handleEdit = (p) => {
    setEditingId(p.id);
    setFormState({
      type: p.type || "discord",
      name: p.name || "",
      color: p.color || "#EBEBEC",
      url: p.url || "",
      lssId: p.lssId || "",
      tgChatId: p.tgChatId || ""
    });
    setShowForm(true);
  };

  const handleCancelForm = () => {
    setShowForm(false);
    setEditingId(null);
  };

  const handleSaveForm = () => {
    const type = formState.type;
    const name = formState.name.trim() || (type === "discord" ? "Discord" : type.toUpperCase());
    const color = formState.color || "#EBEBEC";

    if (type === "discord" && !formState.url.trim()) {
      toast("Ошибка: Укажите URL вебхука Discord", "err");
      return;
    }

    let nextPresets;
    if (editingId) {
      nextPresets = presets.map(p => {
        if (p.id === editingId) {
          return {
            ...p,
            type,
            name,
            color,
            url: formState.url.trim(),
            lssId: formState.lssId?.trim(),
            tgChatId: formState.tgChatId?.trim()
          };
        }
        return p;
      });
    } else {
      const newPreset = {
        id: "preset-" + Date.now(),
        type,
        name,
        color,
        url: formState.url.trim(),
        lssId: formState.lssId?.trim(),
        tgChatId: formState.tgChatId?.trim(),
        enabled: true
      };
      nextPresets = [...presets, newPreset];
    }

    saveRollPresets(nextPresets);
    setPresets(nextPresets);
    setShowForm(false);
    setEditingId(null);
    toast(editingId ? "Пресет сохранён" : "Пресет создан", "ok");
  };

  const handleDelete = (id) => {
    const next = presets.filter(p => p.id !== id);
    saveRollPresets(next);
    setPresets(next);
    if (editingId === id) {
      setShowForm(false);
      setEditingId(null);
    }
    toast("Пресет удалён", "ok");
  };

  const handleToggle = (id) => {
    const next = presets.map(p => p.id === id ? { ...p, enabled: !p.enabled } : p);
    saveRollPresets(next);
    setPresets(next);
  };

  const handleCopy = (text) => {
    if (!text) return;
    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).then(() => {
        toast("Ссылка скопирована!", "ok");
      }).catch(() => {
        toast("Не удалось скопировать", "err");
      });
    } else {
      toast("Ссылка скопирована!", "ok");
    }
  };

  const handleTest = async (preset) => {
    if (testingId) return;
    setTestingId(preset.id);
    try {
      await testDiscordWebhook(preset, c?.data?.name?.value);
    } finally {
      setTestingId(null);
    }
  };

  const generateRandomLssId = () => {
    const id = Math.random().toString(36).substring(2, 8).toUpperCase();
    setFormState(s => ({ ...s, lssId: id }));
  };

  return (
    <div className="rolls-settings-view">
      {/* Предупреждение об устаревшем механизме */}
      <div className="rolls-warn">
        <div className="rolls-warn-title">Этот механизм устарел</div>
        <div className="rolls-warn-text">
          У нас появились Комнаты, которые кроме всего прочего упрощают отправку бросков в мессенджеры. Переходите в Комнаты, так как текущий механизм бросков скоро будет отключен.{" "}
          <a href="https://longstoryshort.app" target="_blank" rel="noreferrer">Подробнее.</a>
        </div>
      </div>

      {/* Заголовок пресетов */}
      <div className="presets-head">
        <div className="presets-head-title">
          <span>Пресеты</span>
          <button className="preset-add-btn" onClick={handleOpenAdd} title="Добавить пресет">
            +
          </button>
        </div>
        <a className="presets-kb-link" href="https://longstoryshort.app" target="_blank" rel="noreferrer">
          📖 База знаний
        </a>
      </div>

      {/* Форма создания/редактирования */}
      {showForm && (
        <div className="preset-form">
          <div className="f-label">ТИП ПРЕСЕТА</div>
          <select
            className="f-input"
            value={formState.type}
            onChange={e => setFormState(s => ({ ...s, type: e.target.value }))}
            style={{ marginBottom: 12 }}
          >
            <option value="discord">Discord</option>
            <option value="lss">LSS</option>
            <option value="telegram">Telegram</option>
          </select>

          <div className="f-label">НАЗВАНИЕ ПРЕСЕТА</div>
          <input
            className="f-input"
            value={formState.name}
            placeholder={formState.type === "discord" ? "Например, Стол 1" : "Название"}
            onChange={e => setFormState(s => ({ ...s, name: e.target.value }))}
            style={{ marginBottom: 12 }}
          />

          {formState.type === "discord" && (
            <>
              <div className="f-label">ЦВЕТ СООБЩЕНИЙ</div>
              <div className="preset-color-row" style={{ marginBottom: 12 }}>
                <label className="preset-color-swatch-wrap" style={{ backgroundColor: formState.color }}>
                  <input
                    type="color"
                    className="preset-color-native"
                    value={formState.color.startsWith("#") ? formState.color : "#EBEBEC"}
                    onChange={e => setFormState(s => ({ ...s, color: e.target.value.toUpperCase() }))}
                  />
                </label>
                <input
                  className="f-input"
                  value={formState.color}
                  onChange={e => setFormState(s => ({ ...s, color: e.target.value }))}
                  style={{ width: 110, textTransform: "uppercase" }}
                />
              </div>

              <div className="f-label">URL ВЕБХУКА</div>
              <input
                className="f-input"
                placeholder="https://discord.com/api/webhooks/..."
                value={formState.url}
                onChange={e => setFormState(s => ({ ...s, url: e.target.value }))}
                style={{ marginBottom: 14 }}
              />
            </>
          )}

          {formState.type === "lss" && (
            <>
              <div className="f-label">ID СВЯЗИ</div>
              <div className="f-inline" style={{ marginBottom: 4 }}>
                <input
                  className="f-input"
                  value={formState.lssId}
                  placeholder="ID комнаты"
                  onChange={e => setFormState(s => ({ ...s, lssId: e.target.value }))}
                />
                <button className="preset-icon-btn" onClick={generateRandomLssId} title="Сгенерировать случайный ID">
                  <RefreshIcon />
                </button>
              </div>
              <div className="f-hint" style={{ marginBottom: 14 }}>
                ID должен быть одинаковым у всех участников
              </div>
            </>
          )}

          {formState.type === "telegram" && (
            <>
              <div className="f-label">ID ЧАТА</div>
              <input
                className="f-input"
                placeholder="Например, -100123456789"
                value={formState.tgChatId}
                onChange={e => setFormState(s => ({ ...s, tgChatId: e.target.value }))}
                style={{ marginBottom: 14 }}
              />
            </>
          )}

          <div className="preset-form-btns">
            <button className="f-btn primary" onClick={handleSaveForm}>
              {editingId ? "Сохранить" : "Создать"}
            </button>
            <button className="f-btn" onClick={handleCancelForm}>
              Отмена
            </button>
          </div>
        </div>
      )}

      {/* Список пресетов */}
      {presets.length === 0 ? (
        <div className="presets-empty">
          Нет добавленных пресетов. Нажмите «+», чтобы создать пресет вебхука.
        </div>
      ) : (
        <div className="presets-grid">
          {presets.map(p => {
            const rawValue = p.type === "discord" ? p.url : p.type === "lss" ? p.lssId : p.tgChatId;
            let displayVal = rawValue || "—";
            if (displayVal.length > 24) {
              displayVal = displayVal.slice(0, 24) + "...";
            }
            return (
              <div key={p.id} className={"preset-card" + (p.enabled ? " enabled" : "")}>
                <div className="preset-card-top">
                  <div className="preset-badges">
                    <span className="preset-type-badge">{(p.type || "discord").toUpperCase()}</span>
                    <span
                      className="preset-name-badge"
                      style={{ backgroundColor: p.color || "#5865F2" }}
                      title={p.name}
                    >
                      {p.name || (p.type || "discord").toUpperCase()}
                    </span>
                  </div>
                  <input
                    type="checkbox"
                    className="preset-cb"
                    checked={!!p.enabled}
                    onChange={() => handleToggle(p.id)}
                    title={p.enabled ? "Включено (броски отправляются)" : "Выключено"}
                  />
                </div>

                <div className="preset-card-mid">
                  <span className="preset-card-val" title={rawValue || ""}>
                    {displayVal}
                  </span>
                  {rawValue ? (
                    <button
                      className="preset-icon-btn small"
                      onClick={() => handleCopy(rawValue)}
                      title="Скопировать"
                    >
                      <CopyIcon />
                    </button>
                  ) : null}
                </div>

                <div className="preset-card-bot">
                  <button
                    className="preset-icon-btn"
                    onClick={() => handleEdit(p)}
                    title="Редактировать"
                  >
                    <EditIcon />
                  </button>
                  <button
                    className="preset-test-btn"
                    onClick={() => handleTest(p)}
                    disabled={testingId === p.id}
                  >
                    {testingId === p.id ? "..." : "Проверить"}
                  </button>
                  <button
                    className="preset-icon-btn del"
                    onClick={() => handleDelete(p.id)}
                    title="Удалить"
                  >
                    <TrashIcon />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Опции отображения бросков */}
      <div className="f-sep2" />
      <div className="f-label" style={{ marginBottom: 8 }}>ОТОБРАЖЕНИЕ БРОСКОВ В ИНТЕРФЕЙСЕ</div>
      <Check
        label="Показывать подробности броска (кубик и модификаторы)"
        checked={ui.rollDetails !== false}
        onChange={v => setUi({ rollDetails: v })}
      />
      <Check
        label="Выделять критический успех и провал цветом"
        checked={ui.critColors !== false}
        onChange={v => setUi({ critColors: v })}
      />
    </div>
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
    r.onload = () => setCropSrc({ src: r.result, remote: null });
    r.readAsDataURL(f);
  };

  // картинка по ссылке: пробуем забрать её (нужен CORS), иначе обрезаем «на глаз» и храним область
  const fromUrl = async (link) => {
    setErr("");
    const u = (link || "").trim();
    if (!u) return;
    try {
      const res = await fetch(u, { mode: "cors" });
      if (!res.ok) throw new Error("HTTP " + res.status);
      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setCropSrc({ src: objUrl, remote: u });
    } catch (e) {
      // сервер не даёт обработать картинку — всё равно покажем обрезку, сохраним только область
      setCropSrc({ src: u, remote: u });
    }
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
      <div className="pt-url-row">
        <input className="f-input" placeholder="https://…" defaultValue={url.startsWith("http") ? url : ""}
          onKeyDown={e => { if (e.key === "Enter") fromUrl(e.target.value); }} />
        <button className="f-btn primary" onClick={() => {
          const inp = document.querySelector(".pt-url-row input");
          fromUrl(inp.value);
        }}>Загрузить</button>
      </div>
      <div className="f-hint">Вставьте прямую ссылку на картинку и нажмите Enter — она тоже откроется на обрезку</div>

      {cropSrc ? (
        <ImageCropper
          src={cropSrc.src}
          onClose={() => setCropSrc(null)}
          onApply={(dataUrl, rect) => {
            if (dataUrl) {
              c.data.avatar = { jpeg: dataUrl };
            } else {
              // пиксели недоступны (чужой домен) — сохраняем ссылку и выбранную область
              c.data.avatar = { ...(c.data.avatar || {}), jpeg: cropSrc.remote, crop: rect };
            }
            onSave();
            setCropSrc(null);
            onClose();
          }}
        />
      ) : null}
    </Drawer>
  );
}

/* ================= Мелкие элементы ================= */
function Drawer({ title, onClose, onBack, children }) {
  useEffect(() => {
    const key = (e) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", key);
    return () => document.removeEventListener("keydown", key);
  }, [onClose]);
  return (
    <div className="drawer-back" onMouseDown={onClose}>
      <div className="drawer" onMouseDown={e => e.stopPropagation()}>
        <div className="drawer-head">
          <div className="drawer-head-left">
            {onBack ? (
              <button className="drawer-back-btn" onClick={onBack} title="Назад">
                ‹
              </button>
            ) : null}
            <h3>{title}</h3>
          </div>
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
    <Toggle checked={!!checked} label={label} onChange={onChange} />
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
const CopyIcon = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="9" width="13" height="13" rx="2" ry="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>;
const EditIcon = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 20h9M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z" /></svg>;
const TrashIcon = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></svg>;
const RefreshIcon = () => <svg viewBox="0 0 24 24" width="13" height="13" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="23 4 23 10 17 10" /><path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10" /></svg>;
