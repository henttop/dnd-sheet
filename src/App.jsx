import React, { useState } from "react";
import List from "./List.jsx";
import Sheet from "./Sheet.jsx";
import { DiceTower } from "./ui.jsx";
import { Toaster } from "./toast.jsx";
import { setSpellIndex } from "./helpers.js";
import { SPELL_BY_ID, SPELL_BY_SLUG } from "./store.js";

setSpellIndex(new Map([...SPELL_BY_ID, ...SPELL_BY_SLUG]));

export default function App() {
  const [idx, setIdx] = useState(null);
  const [fresh, setFresh] = useState(false);
  return (
    <>
      {idx != null
        ? <Sheet idx={idx} fresh={fresh} onFreshDone={() => setFresh(false)} back={() => { setIdx(null); setFresh(false); }} />
        : <List open={(i, isNew) => { setIdx(i); setFresh(!!isNew); }} />}
      <DiceTower />
      <Toaster />
    </>
  );
}
