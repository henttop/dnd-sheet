import React, { useEffect, useRef, useState } from "react";
import { getUi, subscribeUi } from "./uistore.js";

export const CURSOR_COLORS = {
  purple: {
    id: "purple",
    name: "Магический аметист",
    glow0: "rgba(147, 51, 234, 0.32)",
    glow1: "rgba(124, 58, 237, 0.14)",
    glow2: "rgba(168, 85, 247, 0.04)",
    dotRgb: (a) => `rgba(192, 132, 252, ${a})`,
    core: "#c084fc",
    ring: (a) => `rgba(168, 85, 247, ${a})`,
    preview: "#a855f7",
  },
  cyan: {
    id: "cyan",
    name: "Лазурный шторм",
    glow0: "rgba(6, 182, 212, 0.32)",
    glow1: "rgba(59, 130, 246, 0.14)",
    glow2: "rgba(14, 165, 233, 0.04)",
    dotRgb: (a) => `rgba(103, 232, 249, ${a})`,
    core: "#67e8f9",
    ring: (a) => `rgba(56, 189, 248, ${a})`,
    preview: "#06b6d4",
  },
  gold: {
    id: "gold",
    name: "Священный свет",
    glow0: "rgba(234, 179, 8, 0.32)",
    glow1: "rgba(245, 158, 11, 0.14)",
    glow2: "rgba(217, 119, 6, 0.04)",
    dotRgb: (a) => `rgba(253, 224, 71, ${a})`,
    core: "#fde047",
    ring: (a) => `rgba(251, 191, 36, ${a})`,
    preview: "#eab308",
  },
  red: {
    id: "red",
    name: "Пламя дракона",
    glow0: "rgba(239, 68, 68, 0.32)",
    glow1: "rgba(220, 38, 38, 0.14)",
    glow2: "rgba(185, 28, 28, 0.04)",
    dotRgb: (a) => `rgba(252, 165, 165, ${a})`,
    core: "#fca5a5",
    ring: (a) => `rgba(248, 113, 113, ${a})`,
    preview: "#ef4444",
  },
  green: {
    id: "green",
    name: "Изумрудный луч",
    glow0: "rgba(34, 197, 94, 0.32)",
    glow1: "rgba(16, 185, 129, 0.14)",
    glow2: "rgba(5, 150, 105, 0.04)",
    dotRgb: (a) => `rgba(134, 239, 172, ${a})`,
    core: "#86efac",
    ring: (a) => `rgba(74, 222, 128, ${a})`,
    preview: "#22c55e",
  },
};

export default function CursorGlow() {
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);

  const canvasRef = useRef(null);
  const curPos = useRef({ x: -1000, y: -1000 });
  const targetPos = useRef({ x: -1000, y: -1000 });
  const isInside = useRef(false);
  const isRunning = useRef(false);
  const animFrameId = useRef(null);
  const ripplesRef = useRef([]);

  const colorConfig = CURSOR_COLORS[ui.cursorColor] || CURSOR_COLORS.purple;

  useEffect(() => {
    if (ui.cursorGlow === false) return;
    if (window.matchMedia("(pointer: coarse)").matches) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");

    let width = (canvas.width = window.innerWidth);
    let height = (canvas.height = window.innerHeight);

    const onResize = () => {
      if (!canvas) return;
      width = canvas.width = window.innerWidth;
      height = canvas.height = window.innerHeight;
      startLoop();
    };
    window.addEventListener("resize", onResize);

    const radius = 240; // Радиус видимости свечения и точек вокруг курсора
    const gridSize = 24; // Шаг сетки из точек (в пикселях)

    const render = () => {
      ctx.clearRect(0, 0, width, height);

      // Плавное следование за курсором (lerp)
      const dx = targetPos.current.x - curPos.current.x;
      const dy = targetPos.current.y - curPos.current.y;
      curPos.current.x += dx * 0.2;
      curPos.current.y += dy * 0.2;

      const px = curPos.current.x;
      const py = curPos.current.y;

      if (isInside.current && px > -radius && px < width + radius && py > -radius && py < height + radius) {
        // 1. Мягкое радиальное свечение
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, colorConfig.glow0);
        grad.addColorStop(0.35, colorConfig.glow1);
        grad.addColorStop(0.75, colorConfig.glow2);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Интерактивная сетка из точек (dot matrix grid)
        if (ui.cursorDotGrid !== false) {
          const minX = Math.max(0, Math.floor((px - radius) / gridSize) * gridSize);
          const maxX = Math.min(width, Math.ceil((px + radius) / gridSize) * gridSize);
          const minY = Math.max(0, Math.floor((py - radius) / gridSize) * gridSize);
          const maxY = Math.min(height, Math.ceil((py + radius) / gridSize) * gridSize);

          for (let x = minX; x <= maxX; x += gridSize) {
            for (let y = minY; y <= maxY; y += gridSize) {
              const dist = Math.hypot(x - px, y - py);
              if (dist <= radius) {
                const factor = 1 - dist / radius; // 1 у курсора, 0 на границе
                const alpha = Math.pow(factor, 1.5) * 0.9;
                const dotR = 0.8 + factor * 1.8; // размер точки от 0.8px до 2.6px

                ctx.fillStyle = colorConfig.dotRgb(alpha.toFixed(3));
                ctx.beginPath();
                ctx.arc(x, y, dotR, 0, Math.PI * 2);
                ctx.fill();
              }
            }
          }
        }

        // 3. Центральное световое ядро
        ctx.fillStyle = colorConfig.core;
        ctx.shadowColor = colorConfig.core;
        ctx.shadowBlur = 8;
        ctx.beginPath();
        ctx.arc(px, py, 3, 0, Math.PI * 2);
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // 4. Волны при кликах
      const now = Date.now();
      ripplesRef.current = ripplesRef.current.filter((r) => now - r.created < 550);
      for (const r of ripplesRef.current) {
        const progress = (now - r.created) / 550;
        const currentR = progress * 90;
        const alpha = Math.max(0, (1 - progress) * 0.7);

        ctx.strokeStyle = colorConfig.ring(alpha.toFixed(3));
        ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.arc(r.x, r.y, currentR, 0, Math.PI * 2);
        ctx.stroke();
      }

      // Если мышь почти догнала цель и волн нет, цикл приостанавливается до следующего движения (0% CPU)
      const moving = Math.abs(dx) > 0.1 || Math.abs(dy) > 0.1;
      const hasRipples = ripplesRef.current.length > 0;

      if (moving || hasRipples) {
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

    const onMouseDown = (e) => {
      if (ui.cursorRipple === false) return;
      ripplesRef.current.push({ x: e.clientX, y: e.clientY, created: Date.now() });
      startLoop();
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown, { passive: true });

    startLoop();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown);
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
    };
  }, [ui.cursorGlow, ui.cursorDotGrid, ui.cursorRipple, ui.cursorColor]);

  if (ui.cursorGlow === false) return null;

  return (
    <canvas
      ref={canvasRef}
      className="cursor-glow-canvas"
      style={{
        position: "fixed",
        inset: 0,
        width: "100vw",
        height: "100vh",
        pointerEvents: "none",
        zIndex: 9998,
        mixBlendMode: "screen",
      }}
    />
  );
}
