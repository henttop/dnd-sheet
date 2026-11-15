import React, { useEffect, useRef, useState } from "react";
import { getUi, subscribeUi } from "./uistore.js";

export const CURSOR_COLORS = {
  purple: {
    id: "purple",
    name: "Магический аметист",
    glow0: "rgba(147, 51, 234, 0.35)",
    glow1: "rgba(124, 58, 237, 0.16)",
    glow2: "rgba(168, 85, 247, 0.04)",
    dotBase: [216, 180, 254], // #d8b4fe
    dotCenter: [255, 255, 255],
    core: "#e9d5ff",
    ring: "#c084fc",
    preview: "#a855f7",
  },
  cyan: {
    id: "cyan",
    name: "Лазурный шторм",
    glow0: "rgba(6, 182, 212, 0.35)",
    glow1: "rgba(59, 130, 246, 0.16)",
    glow2: "rgba(14, 165, 233, 0.04)",
    dotBase: [165, 243, 252],
    dotCenter: [255, 255, 255],
    core: "#cffafe",
    ring: "#67e8f9",
    preview: "#06b6d4",
  },
  gold: {
    id: "gold",
    name: "Священный свет",
    glow0: "rgba(234, 179, 8, 0.35)",
    glow1: "rgba(245, 158, 11, 0.16)",
    glow2: "rgba(217, 119, 6, 0.04)",
    dotBase: [254, 240, 138],
    dotCenter: [255, 255, 255],
    core: "#fef08a",
    ring: "#fde047",
    preview: "#eab308",
  },
  red: {
    id: "red",
    name: "Пламя дракона",
    glow0: "rgba(239, 68, 68, 0.35)",
    glow1: "rgba(220, 38, 38, 0.16)",
    glow2: "rgba(185, 28, 28, 0.04)",
    dotBase: [254, 202, 202],
    dotCenter: [255, 255, 255],
    core: "#fee2e2",
    ring: "#f87171",
    preview: "#ef4444",
  },
  green: {
    id: "green",
    name: "Изумрудный луч",
    glow0: "rgba(34, 197, 94, 0.35)",
    glow1: "rgba(16, 185, 129, 0.16)",
    glow2: "rgba(5, 150, 105, 0.04)",
    dotBase: [187, 247, 208],
    dotCenter: [255, 255, 255],
    core: "#dcfce7",
    ring: "#4ade80",
    preview: "#22c55e",
  },
};

export default function CursorGlow() {
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);

  const canvasRef = useRef(null);
  const curPos = useRef({ x: -1000, y: -1000 });
  const targetPos = useRef({ x: -1000, y: -1000 });
  const isInside = useRef(true);
  const isRunning = useRef(false);
  const animFrameId = useRef(null);

  // DOM-волны при кликах (гарантированная яркость и анимация)
  const [ripples, setRipples] = useState([]);

  const colorConfig = CURSOR_COLORS[ui.cursorColor] || CURSOR_COLORS.purple;

  useEffect(() => {
    if (ui.cursorGlow === false) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let dpr = window.devicePixelRatio || 1;
    let cssW = window.innerWidth;
    let cssH = window.innerHeight;

    const setupCanvas = () => {
      dpr = window.devicePixelRatio || 1;
      cssW = window.innerWidth;
      cssH = window.innerHeight;
      canvas.width = Math.floor(cssW * dpr);
      canvas.height = Math.floor(cssH * dpr);
      canvas.style.width = cssW + "px";
      canvas.style.height = cssH + "px";
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };

    setupCanvas();

    const onResize = () => {
      setupCanvas();
      startLoop();
    };
    window.addEventListener("resize", onResize);

    const radius = Math.max(100, Math.min(500, Number(ui.cursorRadius) || 240));
    const gridSize = 24; // Шаг сетки (пиксели)

    const render = () => {
      ctx.clearRect(0, 0, cssW, cssH);

      const dx = targetPos.current.x - curPos.current.x;
      const dy = targetPos.current.y - curPos.current.y;
      curPos.current.x += dx * 0.22;
      curPos.current.y += dy * 0.22;

      const px = curPos.current.x;
      const py = curPos.current.y;

      if (isInside.current && px > -radius && px < cssW + radius && py > -radius && py < cssH + radius) {
        // 1. Мягкое радиальное фоновое свечение
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, colorConfig.glow0);
        grad.addColorStop(0.4, colorConfig.glow1);
        grad.addColorStop(0.8, colorConfig.glow2);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Интерактивная точечная сетка (Dot Matrix Grid)
        if (ui.cursorDotGrid !== false) {
          const minX = Math.max(0, Math.floor((px - radius) / gridSize) * gridSize);
          const maxX = Math.min(cssW, Math.ceil((px + radius) / gridSize) * gridSize);
          const minY = Math.max(0, Math.floor((py - radius) / gridSize) * gridSize);
          const maxY = Math.min(cssH, Math.ceil((py + radius) / gridSize) * gridSize);

          for (let x = minX; x <= maxX; x += gridSize) {
            for (let y = minY; y <= maxY; y += gridSize) {
              const dist = Math.hypot(x - px, y - py);
              if (dist <= radius) {
                const factor = 1 - dist / radius; // 1 у курсора, 0 на границе
                // Высокая контрастность: альфа от 0.28 на краю до 1.0 в центре
                const alpha = 0.28 + Math.pow(factor, 1.2) * 0.72;
                // Точки заметно увеличиваются: от 1.4px на краю до ~5.5px около курсора
                const dotR = 1.4 + factor * 1.8 + Math.pow(factor, 2.4) * 2.3;

                const [r, g, b] = factor > 0.65 ? colorConfig.dotCenter : colorConfig.dotBase;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;

                if (factor > 0.35) {
                  ctx.shadowBlur = (factor - 0.25) * 12;
                  ctx.shadowColor = colorConfig.ring;
                } else {
                  ctx.shadowBlur = 0;
                }

                ctx.beginPath();
                ctx.arc(x, y, dotR, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
          ctx.shadowBlur = 0;
        }

        // 3. Центральное световое ядро
        ctx.fillStyle = colorConfig.core;
        ctx.shadowColor = colorConfig.core;
        ctx.shadowBlur = 12;
        ctx.beginPath();
        ctx.arc(px, py, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Цикл засыпает при неподвижности (0% нагрузки на CPU)
      if (Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1) {
        animFrameId.current = requestAnimationFrame(render);
      } else {
        isRunning.current = false;
      }
    };

    const startLoop = () => {
      if (!isRunning.current) {
        isRunning.current = true;
        animFrameId.current = requestAnimationFrame(render);
      }
    };

    const onMouseMove = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      isInside.current = true;
      startLoop();
    };

    const onMouseEnter = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      isInside.current = true;
      startLoop();
    };

    const onMouseLeave = () => {
      isInside.current = false;
      startLoop();
    };

    // Слушатель кликов с capture: true — перехватывает клики везде (даже при stopPropagation)
    const onMouseDown = (e) => {
      if (ui.cursorRipple === false) return;
      const ripId = Date.now() + Math.random();
      setRipples((prev) => [...prev.slice(-4), { id: ripId, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripId));
      }, 650);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown, { capture: true, passive: true });
    window.addEventListener("pointerdown", onMouseDown, { capture: true, passive: true });

    startLoop();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown, { capture: true });
      window.removeEventListener("pointerdown", onMouseDown, { capture: true });
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [ui.cursorGlow, ui.cursorDotGrid, ui.cursorRadius, ui.cursorRipple, ui.cursorColor]);

  if (ui.cursorGlow === false) return null;

  return (
    <>
      <canvas
        ref={canvasRef}
        className="cursor-glow-canvas"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 9998,
        }}
      />

      {/* Магические волны при клике (DOM-анимация с высоким контрастом) */}
      {ripples.map((r) => (
        <div
          key={r.id}
          className="cursor-glow-ripple"
          style={{
            left: r.x - 20,
            top: r.y - 20,
            borderColor: colorConfig.ring,
            boxShadow: `0 0 16px 2px ${colorConfig.ring}`,
          }}
        />
      ))}
    </>
  );
}
