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

export async function testDiscordWebhook(preset, charName = "") {
  if (!preset.url || !preset.url.trim()) {
    toast("Ошибка: Укажите URL вебхука Discord", "err");
    return { ok: false, error: "Укажите URL вебхука" };
  }

  const avatar = window.__activeChar?.data?.avatar?.jpeg;
  const avatarUrl = (avatar && (avatar.startsWith("http://") || avatar.startsWith("https://"))) ? avatar : undefined;
  const name = charName || window.__activeChar?.data?.name?.value || "Безымянный персонаж";

  const payload = {
    username: name,
    avatar_url: avatarUrl,
    embeds: [
      {
        title: "🎲 Проверка связи — Вебхук подключен!",
        description: `Интеграция с Discord настроена успешно!\nПресет: **${preset.name || "Discord"}**\nБроски персонажа **${name}** будут отправляться в этот канал.`,
        color: hexToColorInt(preset.color),
        fields: [
          { name: "Персонаж", value: name, inline: true },
          { name: "Тестовый бросок", value: "к20: **20** *(крит!)*", inline: true }
        ],
        footer: { text: "D&D 5e Character Sheet · Тест вебхука" },
        timestamp: new Date().toISOString()
      }
    ]
  };

  try {
    const res = await fetch(preset.url.trim(), {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });

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
  const charName = char?.data?.name?.value || "Безымянный персонаж";
  const charClass = char?.data?.info?.charClass?.value || "";
  const avatar = char?.data?.avatar?.jpeg;
  const avatarUrl = (avatar && (avatar.startsWith("http://") || avatar.startsWith("https://"))) ? avatar : undefined;

  const { title, total, mods, die, crit, fail, kind, sub, isDmg } = roll;

  let embedTitle = `🎲 ${title}`;
  let color = 0x5865F2;
  if (crit) {
    embedTitle = `🔥 КРИТИЧЕСКИЙ УСПЕХ! — ${title}`;
    color = 0x40c057;
  } else if (fail) {
    embedTitle = `💀 КРИТИЧЕСКИЙ ПРОВАЛ! — ${title}`;
    color = 0xfa5252;
  } else if (isDmg || kind === "урон") {
    embedTitle = `⚔️ ${title}`;
  }

  const fields = [];
  if (die != null) {
    fields.push({ name: "Кубик d20", value: `${die}`, inline: true });
  }
  if (sub) {
    fields.push({ name: "Тип урона", value: `${sub}`, inline: true });
  }

  const descParts = [`**Итог: ${total}**`];
  if (mods) {
    descParts.push(`\`${mods}\``);
  }

  for (const p of presets) {
    const embedColor = (crit || fail) ? color : hexToColorInt(p.color);
    const payload = {
      username: charName,
      avatar_url: avatarUrl,
      embeds: [
        {
          title: embedTitle,
          description: descParts.join("\n"),
          color: embedColor,
          fields: fields.length ? fields : undefined,
          footer: {
            text: `D&D 5e · ${charName}${charClass ? ` (${charClass})` : ""}`
          },
          timestamp: new Date().toISOString()
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
  }
}
