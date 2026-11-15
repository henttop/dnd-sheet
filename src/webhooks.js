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

  try {
    let res;
    if (isHttp(avatarUrl)) {
      const payload = {
        avatar_url: avatarUrl,
        embeds: [
          {
            author: { name: name, icon_url: avatarUrl },
            title: "Проверка систем",
            description: "Всё работает в штатном режиме 👍",
            color: hexToColorInt(preset.color)
          }
        ]
      };
      res = await fetch(preset.url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
    } else if (isData(avatarUrl)) {
      const blob = dataUrlToBlob(avatarUrl);
      if (blob) {
        const formData = new FormData();
        const payload = {
          embeds: [
            {
              author: { name: name, icon_url: "attachment://avatar.jpg" },
              title: "Проверка систем",
              description: "Всё работает в штатном режиме 👍",
              color: hexToColorInt(preset.color)
            }
          ]
        };
        formData.append("payload_json", JSON.stringify(payload));
        formData.append("files[0]", blob, "avatar.jpg");
        res = await fetch(preset.url.trim(), { method: "POST", body: formData });
      } else {
        res = await fetch(preset.url.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                author: { name: name },
                title: "Проверка систем",
                description: "Всё работает в штатном режиме 👍",
                color: hexToColorInt(preset.color)
              }
            ]
          })
        });
      }
    } else {
      res = await fetch(preset.url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              author: { name: name },
              title: "Проверка систем",
              description: "Всё работает в штатном режиме 👍",
              color: hexToColorInt(preset.color)
            }
          ]
        })
      });
    }

    if (res.ok || res.status === 204) {
      toast("Тестовое сообщение успешно отправлено в Discord!", "ok");
      return { ok: true };
    } else {
      const errText = await res.text().catch(() => "");
      toast(`Ошибка: Нет связи с сервером (${res.status})`, "err");
      return { ok: false, error: errText || `HTTP ${res.status}` };
    }
  } catch (e) {
    toast("Ошибка: Нет связи с сервером (проверьте URL вебхука)", "err");
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

  for (const p of presets) {
    const embedColor = (roll.crit ? 0x40c057 : roll.fail ? 0xfa5252 : hexToColorInt(p.color));

    if (isHttp(avatarUrl)) {
      const payload = {
        avatar_url: avatarUrl,
        embeds: [
          {
            author: {
              name: charName,
              icon_url: avatarUrl
            },
            title: rollTitle,
            description: description,
            color: embedColor
          }
        ]
      };

      fetch(p.url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }).catch(err => {
        console.warn("Failed to send roll to Discord preset:", p.name, err);
      });
    } else if (isData(avatarUrl)) {
      const blob = dataUrlToBlob(avatarUrl);
      if (blob) {
        const formData = new FormData();
        const payload = {
          embeds: [
            {
              author: {
                name: charName,
                icon_url: "attachment://avatar.jpg"
              },
              title: rollTitle,
              description: description,
              color: embedColor
            }
          ]
        };
        formData.append("payload_json", JSON.stringify(payload));
        formData.append("files[0]", blob, "avatar.jpg");

        fetch(p.url.trim(), {
          method: "POST",
          body: formData
        }).catch(err => {
          console.warn("Failed to send multipart roll to Discord preset:", p.name, err);
        });
      } else {
        fetch(p.url.trim(), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            embeds: [
              {
                author: { name: charName },
                title: rollTitle,
                description: description,
                color: embedColor
              }
            ]
          })
        }).catch(err => {
          console.warn("Failed to send roll to Discord preset:", p.name, err);
        });
      }
    } else {
      fetch(p.url.trim(), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          embeds: [
            {
              author: { name: charName },
              title: rollTitle,
              description: description,
              color: embedColor
            }
          ]
        })
      }).catch(err => {
        console.warn("Failed to send roll to Discord preset:", p.name, err);
      });
    }
  }
}
