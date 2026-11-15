import React, { useState, useEffect } from "react";
import List from "./List.jsx";
import Sheet from "./Sheet.jsx";
import { DiceTower, RollHost } from "./ui.jsx";
import { Toaster } from "./toast.jsx";
import { setSpellIndex } from "./helpers.js";
import { SPELL_BY_ID, SPELL_BY_SLUG } from "./store.js";
import { getUi, subscribeUi } from "./uistore.js";
import CursorGlow from "./CursorGlow.jsx";
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
    window.__openThemeModal = () => setShowTheme(true);
    return () => {
      window.__openThemeModal = null;
    };
  }, []);

  return (
    <>
      {idx != null
        ? <Sheet idx={idx} fresh={fresh} onFreshDone={() => setFresh(false)} back={() => { setIdx(null); setFresh(false); }} />
        : <List open={(i, isNew) => { setIdx(i); setFresh(!!isNew); }} />}
      <DiceTower />
      <RollHost />
      <Toaster />
      <CursorGlow />
      {showTheme ? <ThemeModal onClose={() => setShowTheme(false)} /> : null}
    </>
  );
}
