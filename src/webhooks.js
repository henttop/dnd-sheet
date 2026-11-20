import { toast } from "./toast.jsx";
import { characters, SPELLS } from "./store.js";
import { getUi } from "./uistore.js";

const STORAGE_KEY = "dnd_roll_presets_v1";

const DEFAULT_PRESETS = [
  {
    id: "preset-1",
    type: "discord",
    name: "ДИСКОРД",
    color: "#5865F2",
    url: "",
    enabled: true
  }
];

export function getRollPresets() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_PRESETS;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length ? parsed : DEFAULT_PRESETS;
  } catch {
    return DEFAULT_PRESETS;
  }
}

export function saveRollPresets(list) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
    window.dispatchEvent(new CustomEvent("dnd:roll_presets_updated", { detail: list }));
  } catch (e) {
    console.error("Failed to save presets:", e);
  }
}

function hexToColorInt(hex) {
  if (!hex) return 0x5865F2;
  const clean = hex.replace("#", "");
  const num = parseInt(clean, 16);
  return isNaN(num) ? 0x5865F2 : num;
}

const SKILLS = new Set([
  "Атлетика", "Акробатика", "Ловкость рук", "Скрытность",
  "Магия", "История", "Анализ", "Природа", "Религия",
  "Уход за животными", "Проницательность", "Медицина",
  "Внимательность", "Выживание", "Обман", "Запугивание",
  "Выступление", "Убеждение",
  "Athletics", "Acrobatics", "Sleight of Hand", "Stealth",
  "Arcana", "History", "Investigation", "Nature", "Religion",
  "Animal Handling", "Insight", "Medicine",
  "Perception", "Survival", "Deception", "Intimidation",
  "Performance", "Persuasion"
]);

export function formatRollTitle(roll) {
  const t = (roll.title || "").trim();

  // Заклинание
  if (roll.spell) {
    return `Заклинание: ${t}`;
  }

  // Атака оружием / заклинанием
  if (t.startsWith("Атака:")) {
    const weaponName = t.replace(/^Атака:\s*/, "").trim();
    return `Бросок атаки: ${weaponName}`;
  }
  if (t === "Атака заклинанием") {
    return "Бросок атаки: Заклинание";
  }

  // Урон
  if (t.startsWith("Урон:")) {
    const weaponName = t.replace(/^Урон:\s*/, "").trim();
    return `Бросок урона: ${weaponName}`;
  }
  if (roll.isDmg) {
    const clean = t.replace(/^(Урон|Бросок урона):\s*/, "").trim();
    return clean ? `Бросок урона: ${clean}` : "Бросок урона";
  }

  // Спасбросок
  if (t.startsWith("Спасбросок")) {
    const stat = t.replace(/^Спасбросок\s*:?\s*/, "").trim();
    return `Спасбросок: ${stat}`;
  }

  // Проверка характеристики
  if (t.startsWith("Проверка ")) {
    const stat = t.replace(/^Проверка\s*:?\s*/, "").trim();
    return `Проверка характеристики: ${stat}`;
  }

  // Инициатива
  if (t === "Инициатива" || t === "Бросок инициативы") {
    return "Бросок инициативы";
  }

  // Навык
  if (SKILLS.has(t)) {
    return `Проверка навыка: ${t}`;
  }

  // Дайсница
  if (t === "Дайсница" || t === "Бросок из дайсницы" || t.startsWith("Дайсница")) {
    return "Бросок из дайсницы";
  }

  // Формула из редактора
  if (roll.isFormula) {
    if (t && t !== "Бросок" && t !== "Формула") {
      return t;
    }
    return roll.formula ? `Бросок: ${roll.formula}` : "Бросок формулы";
  }

  // Кастомный бросок кубиков (например "Бросок 2d6")
  if (t.startsWith("Бросок ")) {
    return `Бросок костей: ${t.replace(/^Бросок\s+/, "")}`;
  }

  return t || "Бросок кубиков";
}

export function formatRollDetails(roll) {
  let details = "";

  if (roll.spell) {
    if (roll.rolls && roll.rolls.length) {
      const parts = roll.rolls.map(r => {
        const raw = (r.parts && r.parts.length ? r.parts.join("+") : r.value);
        return r.expr ? `${r.expr} (${raw})` : raw;
      }).join(" + ");
      const modStr = roll.mod ? (roll.mod > 0 ? ` + ${roll.mod}` : ` - ${Math.abs(roll.mod)}`) + (roll.modLabel ? ` (${roll.modLabel})` : "") : "";
      details = parts + modStr + (roll.sub ? ` (${roll.sub})` : "");
    } else if (roll.sub) {
      details = roll.sub;
    } else {
      details = "Заклинание";
    }
  } else if (roll.title === "Дайсница" || roll.title === "Бросок из дайсницы" || roll.fromDiceTower) {
    if (roll.mods) {
      details = roll.mods;
    } else if (roll.rolls && roll.rolls.length) {
      const groups = {};
      for (const r of roll.rolls) {
        groups[r.faces] = groups[r.faces] || [];
        groups[r.faces].push(r.value);
      }
      details = Object.entries(groups).map(([faces, vals]) => {
        return `${vals.length}к${faces} (${vals.join("+")})`;
      }).join(" + ");
    } else {
      details = "Бросок костей";
    }
    if (roll.crit) details += " (Критический успех!)";
    else if (roll.fail) details += " (Критический провал!)";
  } else if (roll.die != null) {
    // к20 бросок
    let base = roll.mods || `${roll.die} на к20`;
    if (roll.crit) {
      details = `${base} (Критический успех!)`;
    } else if (roll.fail) {
      details = `${base} (Критический провал!)`;
    } else {
      details = base;
    }
  } else if (roll.isFormula) {
    let base = roll.mods || roll.resolvedExpr || roll.formula || "Бросок";
    if (roll.sub && !base.includes(roll.sub)) {
      base = `${base} (${roll.sub})`;
    }
    if (roll.crit) {
      details = `${base} (Критический успех!)`;
    } else if (roll.fail) {
      details = `${base} (Критический провал!)`;
    } else {
      details = base;
    }
  } else if (roll.isDmg) {
    let base = roll.mods || "";
    if (roll.sub && !base.includes(roll.sub)) {
      base = base ? `${base} (${roll.sub})` : roll.sub;
    }
    details = base || "Урон";
  } else {
    details = roll.mods || "Бросок";
  }

  return details;
}

export function findSpellForRoll(roll) {
  if (roll.spellData) return roll.spellData;
  if (!roll.spell) return null;
  const t = (roll.title || "").trim().toLowerCase();
  const clean = t.replace(/^заклинание:\s*/i, "").trim();
  const baseName = clean.replace(/\s*\[.*\]$/, "").trim();
  return (SPELLS || []).find(s => {
    const sName = (s.name || "").toLowerCase();
    const sBase = sName.replace(/\s*\[.*\]$/, "").trim();
    return sName === clean || sBase === baseName || s.slug === clean || s.slug === baseName;
  }) || null;
}

export function formatSpellBlock(spell) {
  if (!spell) return "";

  const lines = [];

  // 1. Уровень, школа, ритуал, концентрация
  const lvlStr = spell.level === 0 ? "Заговор" : `${spell.level}-й уровень`;
  const schoolStr = spell.school ? `, ${spell.school}` : "";
  const ritualStr = spell.ritual ? " *(ритуал)*" : "";
  const concStr = spell.conc ? " *(концентрация)*" : "";
  lines.push(`✨ **${lvlStr}${schoolStr}**${ritualStr}${concStr}`);

  // 2. Метаданные (время сотворения, дистанция, длительность, компоненты)
  const meta = [];
  if (spell.time) meta.push(`⏱ **Время:** ${spell.time}`);
  if (spell.range) meta.push(`📏 **Дистанция:** ${spell.range}`);
  if (spell.dur) meta.push(`⏳ **Длительность:** ${spell.dur}`);

  const compMap = { v: "В", s: "С", m: "М" };
  if (spell.comp && spell.comp.length) {
    const compParts = Array.isArray(spell.comp)
      ? spell.comp.map(c => compMap[c] || c).join(", ")
      : (compMap[spell.comp] || spell.comp);
    const matStr = spell.mat ? ` (${spell.mat})` : "";
    meta.push(`🔮 **Компоненты:** ${compParts}${matStr}`);
  }

  if (meta.length) {
    lines.push(meta.join(" · "));
  }

  // 3. Описание заклинания
  if (spell.desc && spell.desc.trim()) {
    let desc = spell.desc.trim();
    // Ограничиваем длину описания, чтобы embed гарантированно уложился в лимит Discord (4096 символов)
    const MAX_DESC = 2200;
    if (desc.length > MAX_DESC) {
      desc = desc.slice(0, MAX_DESC).trim() + "…\n*(описание сокращено)*";
    }
    lines.push(`\n**Описание:**\n${desc}`);
  }

  return lines.join("\n");
}

export function getCharAvatarUrl(char) {
  if (!char) return "";
  const d = char.data || char;
  const av = d.avatar;
  if (!av) return "";
  if (typeof av === "string") return av;
  return av.jpeg || av.webp || av.png || av.url || "";
}

function dataUrlToBlob(dataUrl) {
  try {
    const arr = dataUrl.split(",");
    const mimeMatch = arr[0].match(/:(.*?);/);
    const mime = mimeMatch ? mimeMatch[1] : "image/jpeg";
    const bstr = atob(arr[1]);
    let n = bstr.length;
    const u8arr = new Uint8Array(n);
    while (n--) {
      u8arr[n] = bstr.charCodeAt(n);
    }
    return new Blob([u8arr], { type: mime });
  } catch (e) {
    console.warn("Failed to convert dataUrl to blob:", e);
    return null;
  }
}

/**
 * Отправка через скрытую HTML-форму во фрейм.
 * Это 100% надёжный обход CORS, блокировщиков (uBlock/Privacy Badger) и ограничений file:// в Firefox/Waterfox,
 * так как стандартная отправка формы (POST) не подпадает под проверки fetch / CORS.
 */
function submitViaHiddenForm(url, payload, blob = null) {
  return new Promise((resolve) => {
    try {
      const iframeName = "dnd_discord_webhook_frame";
      let iframe = document.getElementById(iframeName);
      if (!iframe) {
        iframe = document.createElement("iframe");
        iframe.id = iframeName;
        iframe.name = iframeName;
        iframe.style.display = "none";
        iframe.style.position = "fixed";
        iframe.style.top = "-9999px";
        iframe.style.left = "-9999px";
        iframe.setAttribute("aria-hidden", "true");
        document.body.appendChild(iframe);
      }

      const form = document.createElement("form");
      form.method = "POST";
      form.action = url;
      form.target = iframeName;
      form.enctype = "multipart/form-data";
      form.style.display = "none";
      form.style.position = "fixed";
      form.style.top = "-9999px";
      form.style.left = "-9999px";

      const jsonInput = document.createElement("input");
      jsonInput.type = "hidden";
      jsonInput.name = "payload_json";
      jsonInput.value = JSON.stringify(payload);
      form.appendChild(jsonInput);

      if (blob && typeof DataTransfer !== "undefined") {
        try {
          const fileInput = document.createElement("input");
          fileInput.type = "file";
          fileInput.name = "files[0]";
          fileInput.style.display = "none";
          const file = new File([blob], "avatar.jpg", { type: blob.type || "image/jpeg" });
          const dt = new DataTransfer();
          dt.items.add(file);
          fileInput.files = dt.files;
          form.appendChild(fileInput);
        } catch (e) {
          console.warn("Could not attach file to hidden form:", e);
        }
      }

      document.body.appendChild(form);

      // Удаляем форму с задержкой 5 сек, чтобы не прерывать отправку POST-запроса браузером
      setTimeout(() => {
        try {
          if (form.parentNode) form.parentNode.removeChild(form);
        } catch {}
      }, 5000);

      form.submit();
      resolve({ ok: true, viaForm: true });
    } catch (err) {
      console.warn("Hidden form submit error:", err);
      resolve({ ok: false, error: err.message || "Ошибка отправки формы" });
    }
  });
}

/**
 * Универсальная отправка запроса в Discord Webhook.
 * Поддерживает:
 * - Все браузеры (Firefox, Waterfox, Chrome, Safari, Edge)
 * - Работу через встроенный Vite прокси на localhost (обход любых блокировок uBlock/Privacy Badger)
 * - Работу из автономного файла (file:///)
 * - Прямую отправку с вложениями (multipart/form-data) и JSON
 * - Резервную отправку через невидимую HTML-форму
 */
export async function sendDiscordPayload(webhookUrl, payload, blob = null) {
  let url = (webhookUrl || "").trim();
  if (!url) {
    return { ok: false, error: "Укажите URL вебхука" };
  }

  // Заменяем устаревший discordapp.com на discord.com, чтобы не ловить 301 CORS-редиректы
  if (url.includes("discordapp.com/api/webhooks/")) {
    url = url.replace("discordapp.com/api/webhooks/", "discord.com/api/webhooks/");
  }

  // Проверка на обрезанный токен Discord
  const discordMatch = url.match(/discord(?:app)?\.com\/api\/webhooks\/(\d+)\/([^/?#]+)/i);
  if (discordMatch && discordMatch[2].length < 40) {
    return {
      ok: false,
      error: `URL вебхука скопирован не полностью! Токен в конце ссылки должен быть ~68 символов (у вас ${discordMatch[2].length}). Скопируйте ссылку в Discord заново кнопкой «Копировать URL вебхука».`
    };
  }

  // 1. Проверяем, запущен ли локальный сервер (например Vite на localhost:5173).
  // На локальном сервере используем встроенный прокси Vite, который работает на Node.js.
  const isLocalHost = typeof window !== "undefined" && window.location &&
    (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1" || window.location.hostname === "0.0.0.0") &&
    window.location.port;

  if (isLocalHost) {
    try {
      const formData = new FormData();
      formData.append("payload_json", JSON.stringify(payload));
      if (blob) {
        formData.append("files[0]", blob, "avatar.jpg");
      }
      const proxyUrl = `/api/webhook-proxy?target=${encodeURIComponent(url)}`;
      const res = await fetch(proxyUrl, {
        method: "POST",
        body: formData
      });

      if (res.ok || res.status === 204) {
        return { ok: true, status: res.status, viaProxy: true };
      }

      const errText = await res.text().catch(() => "");
      console.warn("Local webhook proxy returned error:", res.status, errText);
    } catch (proxyErr) {
      console.warn("Local proxy fetch error, falling back to direct send:", proxyErr);
    }
  }

  const isFileProto = typeof window !== "undefined" && window.location && window.location.protocol === "file:";

  // 2. Если файл открыт локально как file:///, в Firefox/Waterfox fetch() блокируется
  // политикой безопасности ("CORS request not HTTP"). В этом случае сразу используем форму.
  if (isFileProto) {
    try {
      return await submitViaHiddenForm(url, payload, blob);
    } catch (e) {
      console.warn("Hidden form failed on file://, falling back to fetch:", e);
    }
  }

  // 3. Отправка напрямую с аватаром через FormData (multipart/form-data):
  // Discord Webhook API официально поддерживает CORS для multipart/form-data.
  // Это загружает файл аватара на серверы Discord и отображает его в embed (icon_url и thumbnail).
  if (blob) {
    try {
      const formData = new FormData();
      formData.append("payload_json", JSON.stringify(payload));
      formData.append("files[0]", blob, "avatar.jpg");

      const res = await fetch(url, {
        method: "POST",
        body: formData
      });

      if (res.ok || res.status === 204) {
        return { ok: true, status: res.status, withAvatar: true };
      }

      const errText = await res.text().catch(() => "");
      let friendlyError = `HTTP ${res.status}`;
      try {
        const errObj = JSON.parse(errText);
        if (errObj.code === 50027 || errObj.message?.includes("Invalid Webhook Token")) {
          friendlyError = "Неверный токен вебхука! Ссылка скопирована не до конца (токен обрезан). Скопируйте ссылку в Discord заново.";
        } else if (errObj.code === 10015 || errObj.message?.includes("Unknown Webhook")) {
          friendlyError = "Вебхук не найден в Discord! Возможно, он был удалён на сервере Discord. Создайте вебхук заново.";
        } else if (errObj.code === 429 || res.status === 429) {
          friendlyError = "Слишком много запросов в Discord (Rate limit). Подождите пару секунд.";
        } else if (errObj.message) {
          friendlyError = `Discord: ${errObj.message} (код ${errObj.code || res.status})`;
        }
      } catch {
        if (errText) friendlyError = errText;
      }

      if (res.status === 401 || res.status === 404) {
        return { ok: false, error: friendlyError, status: res.status };
      }
    } catch (blobErr) {
      console.warn("Direct FormData fetch with avatar failed, trying JSON fallback...", blobErr);
    }
  }

  // 4. Резервный прямой CORS-запрос application/json (без вложения):
  // Если у персонажа нет аватара или браузер заблокировал multipart/form-data.
  // Удаляем attachment:// схемы, чтобы Discord не вернул 400 Bad Request на несуществующий файл.
  const jsonPayload = { ...payload };
  if (jsonPayload.embeds) {
    jsonPayload.embeds = jsonPayload.embeds.map(e => {
      const copy = { ...e };
      if (copy.thumbnail && copy.thumbnail.url && copy.thumbnail.url.startsWith("attachment:")) {
        delete copy.thumbnail;
      }
      if (copy.author && copy.author.icon_url && copy.author.icon_url.startsWith("attachment:")) {
        const aCopy = { ...copy.author };
        delete aCopy.icon_url;
        copy.author = aCopy;
      }
      return copy;
    });
  }

  try {
    const jsonRes = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(jsonPayload)
    });

    if (jsonRes.ok || jsonRes.status === 204) {
      return { ok: true, status: jsonRes.status };
    }

    const errText = await jsonRes.text().catch(() => "");
    let friendlyError = `HTTP ${jsonRes.status}`;
    try {
      const errObj = JSON.parse(errText);
      if (errObj.code === 50027 || errObj.message?.includes("Invalid Webhook Token")) {
        friendlyError = "Неверный токен вебхука! Ссылка скопирована не до конца (токен обрезан). Скопируйте ссылку в Discord заново.";
      } else if (errObj.code === 10015 || errObj.message?.includes("Unknown Webhook")) {
        friendlyError = "Вебхук не найден в Discord! Возможно, он был удалён на сервере Discord. Создайте вебхук заново.";
      } else if (errObj.code === 50006) {
        friendlyError = "Пустое сообщение броска.";
      } else if (errObj.code === 429 || jsonRes.status === 429) {
        friendlyError = "Слишком много запросов в Discord (Rate limit). Подождите пару секунд.";
      } else if (errObj.message) {
        friendlyError = `Discord: ${errObj.message} (код ${errObj.code || jsonRes.status})`;
      }
    } catch {
      if (errText) friendlyError = errText;
    }

    return { ok: false, error: friendlyError, status: jsonRes.status };
  } catch (corsErr) {
    console.warn("Direct JSON CORS fetch to Discord failed, trying hidden form fallback...", corsErr);
  }

  // 5. Резервный fallback: отправка через скрытую HTML-форму во фрейм
  try {
    const formRes = await submitViaHiddenForm(url, payload, blob);
    if (formRes && formRes.ok) {
      return formRes;
    }
  } catch (formErr) {
    console.warn("Hidden form fallback error:", formErr);
  }

  return {
    ok: false,
    error: "Браузер заблокировал сетевой запрос к Discord (uBlock Origin, Privacy Badger или Защита от отслеживания). Нажмите на значок расширения вверху и отключите блокировку для этого сайта."
  };
}

export async function testDiscordWebhook(preset, charOrName = null) {
  if (!preset.url || !preset.url.trim()) {
    toast("Ошибка: Укажите URL вебхука Discord", "err");
    return { ok: false, error: "Укажите URL вебхука" };
  }

  const char = (charOrName && typeof charOrName === "object")
    ? charOrName
    : (window.__activeChar || (typeof characters !== "undefined" && characters.length ? characters[0] : null));
  const name = (charOrName && typeof charOrName === "string")
    ? charOrName
    : (char?.data?.name?.value || "Безымянный персонаж");
  const avatarUrl = getCharAvatarUrl(char);
  const isHttp = (url) => url && /^https?:\/\//i.test(url);
  const isData = (url) => url && /^data:/i.test(url);

  let blob = null;
  if (isData(avatarUrl)) {
    blob = dataUrlToBlob(avatarUrl);
  }

  const embed = {
    author: {
      name: name,
      icon_url: isHttp(avatarUrl) ? avatarUrl : (blob ? "attachment://avatar.jpg" : undefined)
    },
    title: "Проверка систем",
    description: "Всё работает в штатном режиме 👍",
    color: hexToColorInt(preset.color)
  };

  if (isHttp(avatarUrl)) {
    embed.thumbnail = { url: avatarUrl };
  } else if (blob) {
    embed.thumbnail = { url: "attachment://avatar.jpg" };
  }

  const payload = {
    username: name,
    embeds: [embed]
  };
  if (isHttp(avatarUrl)) {
    payload.avatar_url = avatarUrl;
  }

  try {
    const res = await sendDiscordPayload(preset.url.trim(), payload, blob);
    if (res.ok) {
      toast("Тестовое сообщение с аватаркой успешно отправлено в Discord!", "ok");
      return { ok: true };
    } else {
      toast(`Ошибка: ${res.error || "Нет связи с сервером"}`, "err", 6000);
      return res;
    }
  } catch (e) {
    toast(`Ошибка: ${e.message || "Нет связи с сервером"}`, "err", 6000);
    return { ok: false, error: e.message };
  }
}

export async function sendRollToWebhooks(roll) {
  const allPresets = getRollPresets();
  const configuredPresets = allPresets.filter(p => p.url && p.url.trim());
  const presets = configuredPresets.filter(p => p.enabled && p.type === "discord");

  if (!presets.length) {
    if (configuredPresets.length) {
      console.warn("Бросок не отправлен: вебхук Discord выключен в настройках.");
    }
    return;
  }

  const char = window.__activeChar || (typeof characters !== "undefined" && characters.length ? characters[0] : null);
  const charName = roll.charName || char?.data?.name?.value || "Безымянный персонаж";
  const avatarUrl = roll.charAvatar || getCharAvatarUrl(char);

  const rollTitle = formatRollTitle(roll);
  const details = formatRollDetails(roll);

  let resultLine = typeof roll.total === "number" || !isNaN(Number(roll.total))
    ? `Итог: **${roll.total}**`
    : `✨ **${roll.total}**`;
  if (roll.crit) {
    resultLine = `Итог: **${roll.total}** 🔥`;
  } else if (roll.fail) {
    resultLine = `Итог: **${roll.total}** 💀`;
  }

  let description = details ? `${details}\n${resultLine}` : resultLine;

  if (roll.spell) {
    const ui = typeof getUi === "function" ? getUi() : {};
    if (ui.sendSpellDesc !== false) {
      const spell = findSpellForRoll(roll);
      if (spell) {
        const spellBlock = formatSpellBlock(spell);
        if (spellBlock) {
          description = `${description}\n\n${spellBlock}`;
        }
      }
    }
  }
  const isHttp = (url) => url && /^https?:\/\//i.test(url);
  const isData = (url) => url && /^data:/i.test(url);

  let blob = null;
  if (isData(avatarUrl)) {
    blob = dataUrlToBlob(avatarUrl);
  }

  for (const p of presets) {
    const embedColor = (roll.crit ? 0x40c057 : roll.fail ? 0xfa5252 : hexToColorInt(p.color));
    const embed = {
      author: {
        name: charName,
        icon_url: isHttp(avatarUrl) ? avatarUrl : (blob ? "attachment://avatar.jpg" : undefined)
      },
      title: rollTitle,
      description: description,
      color: embedColor
    };

    if (isHttp(avatarUrl)) {
      embed.thumbnail = { url: avatarUrl };
    } else if (blob) {
      embed.thumbnail = { url: "attachment://avatar.jpg" };
    }

    const payload = {
      username: charName,
      embeds: [embed]
    };
    if (isHttp(avatarUrl)) {
      payload.avatar_url = avatarUrl;
    }

    sendDiscordPayload(p.url.trim(), payload, blob).then(res => {
      if (!res.ok) {
        console.warn("Discord webhook roll delivery failed:", res.error);
        toast(`Вебхук: ${res.error || "ошибка отправки"}`, "err");
      }
    }).catch(err => {
      console.warn("Failed to send roll to Discord preset:", p.name, err);
      toast(`Вебхук: ${err.message || "ошибка сети"}`, "err");
    });
  }
}
