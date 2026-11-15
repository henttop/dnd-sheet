import { toast } from "./toast.jsx";

const STORAGE_KEY = "dnd_roll_presets_v1";

const DEFAULT_PRESETS = [
  {
    id: "preset-1",
    type: "discord",
    name: "ДИСКОРД",
    color: "#5865F2",
    url: "",
    enabled: false
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
      details = parts + (roll.sub ? ` (${roll.sub})` : "");
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
 * Это 100% надёжный обход CORS и ограничений file:// в Firefox и других браузерах,
 * так как отправка формы (POST) не подпадает под проверки fetch / CORS.
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

      let settled = false;
      const cleanup = () => {
        try {
          if (form.parentNode) form.parentNode.removeChild(form);
        } catch {}
      };

      const done = (ok = true, error = "") => {
        if (!settled) {
          settled = true;
          cleanup();
          resolve(ok ? { ok: true, viaForm: true } : { ok: false, error });
        }
      };

      const timer = setTimeout(() => done(true), 1200);

      iframe.onload = () => {
        clearTimeout(timer);
        done(true);
      };

      form.submit();
    } catch (err) {
      console.warn("Hidden form submit error:", err);
      resolve({ ok: false, error: err.message || "Ошибка отправки формы" });
    }
  });
}

/**
 * Универсальная отправка запроса в Discord Webhook.
 * Поддерживает:
 * - Все браузеры (Firefox, Chrome, Safari, Edge)
 * - Работу на localhost / HTTP / HTTPS
 * - Работу из автономного файла (file:///)
 * - Обход блокировок CORS и preflight (OPTIONS) за счёт FormData, no-cors и hidden form.
 */
export async function sendDiscordPayload(webhookUrl, payload, blob = null) {
  const url = (webhookUrl || "").trim();
  if (!url) {
    return { ok: false, error: "Укажите URL вебхука" };
  }

  // Discord официально поддерживает multipart/form-data с полем payload_json.
  // Это safelisted Content-Type, поэтому браузер НЕ посылает предварительный запрос OPTIONS.
  const formData = new FormData();
  formData.append("payload_json", JSON.stringify(payload));
  if (blob) {
    formData.append("files[0]", blob, "avatar.jpg");
  }

  const isFileProto = typeof window !== "undefined" && window.location && window.location.protocol === "file:";

  // Если файл открыт локально как file:///, в Firefox fetch() блокируется политикой безопасности ("CORS request not HTTP").
  // В этом случае сразу используем скрытую HTML-форму.
  if (isFileProto) {
    try {
      return await submitViaHiddenForm(url, payload, blob);
    } catch (e) {
      console.warn("Hidden form failed on file://, falling back to fetch:", e);
    }
  }

  // 1. Стандартный запрос fetch с FormData (нет preflight OPTIONS)
  try {
    const res = await fetch(url, {
      method: "POST",
      body: formData
    });

    if (res.ok || res.status === 204) {
      return { ok: true, status: res.status };
    }

    const errText = await res.text().catch(() => "");
    return { ok: false, error: errText || `HTTP ${res.status}`, status: res.status };
  } catch (corsErr) {
    console.warn("Direct CORS fetch to Discord failed (Firefox CORS / ETP), using no-cors / form fallback...", corsErr);

    // 2. Резервный вариант: mode: "no-cors" с FormData (гарантирует доставку в Discord)
    try {
      await fetch(url, {
        method: "POST",
        mode: "no-cors",
        body: formData
      });
      return { ok: true, opaque: true };
    } catch (noCorsErr) {
      console.warn("no-cors fetch failed, falling back to hidden form...", noCorsErr);

      // 3. Резервный вариант: скрытая HTML-форма
      try {
        return await submitViaHiddenForm(url, payload, blob);
      } catch (formErr) {
        console.error("All Discord webhook methods failed:", formErr);
        return { ok: false, error: formErr.message || "Ошибка сети" };
      }
    }
  }
}

export async function testDiscordWebhook(preset, charName = "") {
  if (!preset.url || !preset.url.trim()) {
    toast("Ошибка: Укажите URL вебхука Discord", "err");
    return { ok: false, error: "Укажите URL вебхука" };
  }

  const char = window.__activeChar;
  const name = charName || char?.data?.name?.value || "Безымянный персонаж";
  const avatarUrl = getCharAvatarUrl(char);
  const isHttp = (url) => url && /^https?:\/\//i.test(url);
  const isData = (url) => url && /^data:/i.test(url);

  let blob = null;
  const embed = {
    author: { name: name },
    title: "Проверка систем",
    description: "Всё работает в штатном режиме 👍",
    color: hexToColorInt(preset.color)
  };

  if (isHttp(avatarUrl)) {
    embed.thumbnail = { url: avatarUrl };
  } else if (isData(avatarUrl)) {
    blob = dataUrlToBlob(avatarUrl);
    if (blob) {
      embed.thumbnail = { url: "attachment://avatar.jpg" };
    }
  }

  const payload = { embeds: [embed] };

  try {
    const res = await sendDiscordPayload(preset.url.trim(), payload, blob);
    if (res.ok) {
      toast("Тестовое сообщение успешно отправлено в Discord!", "ok");
      return { ok: true };
    } else {
      toast(`Ошибка: ${res.error || "Нет связи с сервером"}`, "err");
      return res;
    }
  } catch (e) {
    toast(`Ошибка: ${e.message || "Нет связи с сервером"}`, "err");
    return { ok: false, error: e.message };
  }
}

export async function sendRollToWebhooks(roll) {
  const presets = getRollPresets().filter(p => p.enabled && p.type === "discord" && p.url && p.url.trim());
  if (!presets.length) return;

  const char = window.__activeChar;
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

  const description = details ? `${details}\n${resultLine}` : resultLine;
  const isHttp = (url) => url && /^https?:\/\//i.test(url);
  const isData = (url) => url && /^data:/i.test(url);

  let blob = null;
  if (isData(avatarUrl)) {
    blob = dataUrlToBlob(avatarUrl);
  }

  for (const p of presets) {
    const embedColor = (roll.crit ? 0x40c057 : roll.fail ? 0xfa5252 : hexToColorInt(p.color));
    const embed = {
      author: { name: charName },
      title: rollTitle,
      description: description,
      color: embedColor
    };

    if (isHttp(avatarUrl)) {
      embed.thumbnail = { url: avatarUrl };
    } else if (blob) {
      embed.thumbnail = { url: "attachment://avatar.jpg" };
    }

    const payload = { embeds: [embed] };

    sendDiscordPayload(p.url.trim(), payload, blob).catch(err => {
      console.warn("Failed to send roll to Discord preset:", p.name, err);
    });
  }
}
