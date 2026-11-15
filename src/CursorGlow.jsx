import React, { useEffect, useRef, useState } from "react";
import { getUi, subscribeUi } from "./uistore.js";

export const CURSOR_COLORS = {
  purple: {
    id: "purple",
    name: "Магический аметист",
    glow: "radial-gradient(circle, rgba(147, 51, 234, 0.24) 0%, rgba(99, 102, 241, 0.14) 35%, rgba(168, 85, 247, 0.05) 60%, transparent 75%)",
    core: "rgba(192, 132, 252, 0.7)",
    ring: "rgba(168, 85, 247, 0.5)",
    preview: "#a855f7",
  },
  cyan: {
    id: "cyan",
    name: "Лазурный шторм",
    glow: "radial-gradient(circle, rgba(6, 182, 212, 0.24) 0%, rgba(59, 130, 246, 0.14) 35%, rgba(14, 165, 233, 0.05) 60%, transparent 75%)",
    core: "rgba(103, 232, 249, 0.7)",
    ring: "rgba(56, 189, 248, 0.5)",
    preview: "#06b6d4",
  },
  gold: {
    id: "gold",
    name: "Священный свет",
    glow: "radial-gradient(circle, rgba(234, 179, 8, 0.24) 0%, rgba(245, 158, 11, 0.14) 35%, rgba(217, 119, 6, 0.05) 60%, transparent 75%)",
    core: "rgba(253, 224, 71, 0.7)",
    ring: "rgba(251, 191, 36, 0.5)",
    preview: "#eab308",
  },
  red: {
    id: "red",
    name: "Пламя дракона",
    glow: "radial-gradient(circle, rgba(239, 68, 68, 0.24) 0%, rgba(220, 38, 38, 0.14) 35%, rgba(185, 28, 28, 0.05) 60%, transparent 75%)",
    core: "rgba(252, 165, 165, 0.7)",
    ring: "rgba(248, 113, 113, 0.5)",
    preview: "#ef4444",
  },
  green: {
    id: "green",
    name: "Изумрудный луч",
    glow: "radial-gradient(circle, rgba(34, 197, 94, 0.24) 0%, rgba(16, 185, 129, 0.14) 35%, rgba(5, 150, 105, 0.05) 60%, transparent 75%)",
    core: "rgba(134, 239, 172, 0.7)",
    ring: "rgba(74, 222, 128, 0.5)",
    preview: "#22c55e",
  },
};

export default function CursorGlow() {
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);

  const glowRef = useRef(null);
  const coreRef = useRef(null);
  const [ripples, setRipples] = useState([]);
  const [visible, setVisible] = useState(false);

  const curPos = useRef({ x: -500, y: -500 });
  const targetPos = useRef({ x: -500, y: -500 });
  const animFrameId = useRef(null);
  const isRunning = useRef(false);

  const colorConfig = CURSOR_COLORS[ui.cursorColor] || CURSOR_COLORS.purple;

  useEffect(() => {
    // Проверка сенсорного экрана: на тач-устройствах подсветка курсора не нужна
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const loop = () => {
      const dx = targetPos.current.x - curPos.current.x;
      const dy = targetPos.current.y - curPos.current.y;

      // Плавное следование за курсором (lerp)
      curPos.current.x += dx * 0.18;
      curPos.current.y += dy * 0.18;

      const px = curPos.current.x;
      const py = curPos.current.y;

      if (glowRef.current) {
        glowRef.current.style.transform = `translate3d(${px - 225}px, ${py - 225}px, 0)`;
      }
      if (coreRef.current) {
        coreRef.current.style.transform = `translate3d(${px - 5}px, ${py - 5}px, 0)`;
      }

      // Если почти догнал и мышь не двигается, можно остановить цикл до следующего mousemove
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        animFrameId.current = requestAnimationFrame(loop);
      } else {
        isRunning.current = false;
      }
    };

    const startLoop = () => {
      if (!isRunning.current) {
        isRunning.current = true;
        animFrameId.current = requestAnimationFrame(loop);
      }
    };

    const onMouseMove = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      if (!visible) setVisible(true);
      startLoop();
    };

    const onMouseEnter = () => setVisible(true);
    const onMouseLeave = () => setVisible(false);

    const onMouseDown = (e) => {
      if (ui.cursorRipple === false) return;
      const ripId = Date.now() + Math.random();
      setRipples((prev) => [...prev.slice(-4), { id: ripId, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripId));
      }, 600);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown, { passive: true });

    return () => {
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [visible, ui.cursorRipple]);

  if (ui.cursorGlow === false) return null;

  return (
    <div className="cursor-glow-container" style={{ opacity: visible ? 1 : 0 }}>
      {/* Большое мягкое рассеянное свечение */}
      <div
        ref={glowRef}
        className="cursor-glow-ambient"
        style={{
          background: colorConfig.glow,
        }}
      />

      {/* Маленькое ядро-искорка в точке курсора */}
      <div
        ref={coreRef}
        className="cursor-glow-core"
        style={{
          background: colorConfig.core,
          boxShadow: `0 0 10px 2px ${colorConfig.core}`,
        }}
      />

      {/* Магические волны при клике */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="cursor-glow-ripple"
          style={{
            left: r.x - 20,
            top: r.y - 20,
            borderColor: colorConfig.ring,
          }}
        />
      ))}
    </div>
  );
}
