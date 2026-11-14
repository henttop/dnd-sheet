// Хранилище истории бросков (Roll History)

const STORAGE_KEY = "dnd_roll_history_v1";
const MAX_HISTORY = 100;

let memoryHistory = null;

export function getRollHistory() {
  if (memoryHistory !== null) return memoryHistory;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    memoryHistory = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(memoryHistory)) memoryHistory = [];
  } catch {
    memoryHistory = [];
  }
  return memoryHistory;
}

export function saveRollHistory(list) {
  memoryHistory = list;
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(list));
  } catch (e) {
    console.error("Failed to save roll history:", e);
  }
  window.dispatchEvent(new CustomEvent("dnd:roll_history_updated", { detail: list }));
}

export function addRollHistory(rawEntry) {
  const list = [...getRollHistory()];
  const id = rawEntry.id || (Date.now() + "_" + Math.random().toString(36).slice(2, 7));
  const now = new Date();
  const time = rawEntry.time || now.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" });

  const entry = {
    ...rawEntry,
    id,
    time,
    timestamp: rawEntry.timestamp || now.getTime()
  };

  list.unshift(entry);
  if (list.length > MAX_HISTORY) {
    list.length = MAX_HISTORY;
  }
  saveRollHistory(list);
  return entry;
}

export function clearRollHistory() {
  saveRollHistory([]);
}

export function subscribeRollHistory(cb) {
  const handler = (e) => cb(e.detail || getRollHistory());
  window.addEventListener("dnd:roll_history_updated", handler);
  return () => window.removeEventListener("dnd:roll_history_updated", handler);
}
