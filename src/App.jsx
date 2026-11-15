import React, { useState, useEffect } from "react";
import List from "./List.jsx";
import Sheet from "./Sheet.jsx";
import { DiceTower, RollHost } from "./ui.jsx";
import { Toaster } from "./toast.jsx";
import { setSpellIndex } from "./helpers.js";
import { SPELL_BY_ID, SPELL_BY_SLUG } from "./store.js";
import { getUi, subscribeUi } from "./uistore.js";
import CursorGlow, { CURSOR_COLORS } from "./CursorGlow.jsx";
import ThemeModal from "./ThemeModal.jsx";

setSpellIndex(new Map([...SPELL_BY_ID, ...SPELL_BY_SLUG]));

export default function App() {
  const [idx, setIdx] = useState(null);
  const [fresh, setFresh] = useState(false);
  const [ui, setUiState] = useState(getUi());
  const [showTheme, setShowTheme] = useState(false);

  useEffect(() => subscribeUi(setUiState), []);

  useEffect(() => {
    if (ui.darkerBg !== false) {
      document.body.classList.add("darker-bg");
    } else {
      document.body.classList.remove("darker-bg");
    }
  }, [ui.darkerBg]);

  useEffect(() => {
    const colorId = ui.cursorColor || "purple";
    const cfg = CURSOR_COLORS[colorId] || CURSOR_COLORS.purple;
    const root = document.documentElement;
    root.dataset.theme = colorId;
    document.body.dataset.theme = colorId;

    root.style.setProperty("--theme-accent", cfg.accent);
    root.style.setProperty("--theme-accent2", cfg.accent2);
    root.style.setProperty("--theme-accent-dark", cfg.accentDark);
    root.style.setProperty("--theme-btn", cfg.btn);
    root.style.setProperty("--theme-btn2", cfg.btn2);
    root.style.setProperty("--theme-glow", cfg.glow);
    root.style.setProperty("--theme-glow-sm", cfg.glowSm);
    root.style.setProperty("--theme-glow-lg", cfg.glowLg);
    root.style.setProperty("--theme-spotlight-1", cfg.spotlight1);
    root.style.setProperty("--theme-spotlight-2", cfg.spotlight2);
    root.style.setProperty("--theme-soft-bg", cfg.softBg);
    root.style.setProperty("--theme-soft-bg2", cfg.softBg2);
    root.style.setProperty("--theme-soft-border", cfg.softBorder);
    root.style.setProperty("--theme-soft-border2", cfg.softBorder2);
    root.style.setProperty("--purple", cfg.accent);
    root.style.setProperty("--purple2", cfg.accent2);
    root.style.setProperty("--accent", cfg.btn);
    root.style.setProperty("--accent2", cfg.btn2);
  }, [ui.cursorColor]);

  useEffect(() => {
    window.__openThemeModal = () => setShowTheme(true);
    return () => {
      window.__openThemeModal = null;
    };
  }, []);

  return (
    <>
      <CursorGlow />
      <div className="app-main">
        {idx != null
          ? <Sheet idx={idx} fresh={fresh} onFreshDone={() => setFresh(false)} back={() => { setIdx(null); setFresh(false); }} />
          : <List open={(i, isNew) => { setIdx(i); setFresh(!!isNew); }} />}
      </div>
      <DiceTower />
      <RollHost />
      <Toaster />
      {showTheme ? <ThemeModal onClose={() => setShowTheme(false)} /> : null}
    </>
  );
}
