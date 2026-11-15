import React, { useEffect, useRef, useState } from "react";
import { getUi, subscribeUi } from "./uistore.js";

export const CURSOR_COLORS = {
  purple: {
    id: "purple",
    name: "Магический аметист",
    glow0: "rgba(124, 58, 237, 0.28)",
    glow1: "rgba(109, 40, 217, 0.12)",
    glow2: "rgba(139, 92, 246, 0.03)",
    dotBase: [109, 40, 217], // глубокий фиолетовый
    dotCenter: [168, 85, 247], // умеренный пурпурный
    core: "#c084fc",
    ring: "rgba(124, 58, 237, 0.35)",
    preview: "#a855f7",
  },
  cyan: {
    id: "cyan",
    name: "Лазурный шторм",
    glow0: "rgba(14, 116, 144, 0.28)",
    glow1: "rgba(8, 145, 178, 0.12)",
    glow2: "rgba(6, 182, 212, 0.03)",
    dotBase: [14, 116, 144], // глубокий циан
    dotCenter: [6, 182, 212],
    core: "#22d3ee",
    ring: "rgba(14, 165, 233, 0.35)",
    preview: "#06b6d4",
  },
  gold: {
    id: "gold",
    name: "Священный свет",
    glow0: "rgba(180, 83, 9, 0.28)",
    glow1: "rgba(217, 119, 6, 0.12)",
    glow2: "rgba(245, 158, 11, 0.03)",
    dotBase: [161, 98, 7], // глубокий янтарный
    dotCenter: [217, 119, 6],
    core: "#fde047",
    ring: "rgba(217, 119, 6, 0.35)",
    preview: "#eab308",
  },
  red: {
    id: "red",
    name: "Пламя дракона",
    glow0: "rgba(185, 28, 28, 0.28)",
    glow1: "rgba(220, 38, 38, 0.12)",
    glow2: "rgba(239, 68, 68, 0.03)",
    dotBase: [153, 27, 27], // глубокий рубиновый
    dotCenter: [220, 38, 38],
    core: "#f87171",
    ring: "rgba(220, 38, 38, 0.35)",
    preview: "#ef4444",
  },
  green: {
    id: "green",
    name: "Изумрудный луч",
    glow0: "rgba(21, 128, 61, 0.28)",
    glow1: "rgba(22, 163, 74, 0.12)",
    glow2: "rgba(34, 197, 94, 0.03)",
    dotBase: [21, 128, 61], // глубокий изумрудный
    dotCenter: [34, 197, 94],
    core: "#4ade80",
    ring: "rgba(34, 197, 94, 0.35)",
    preview: "#22c55e",
  },
};

export default function CursorGlow() {
  const [ui, setUiState] = useState(getUi());
  useEffect(() => subscribeUi(setUiState), []);

  const uiRef = useRef(ui);
  uiRef.current = ui;

  const canvasRef = useRef(null);
  const curPos = useRef({ x: -1000, y: -1000 });
  const targetPos = useRef({ x: -1000, y: -1000 });
  const isInside = useRef(true);
  const isRunning = useRef(false);
  const animFrameId = useRef(null);

  // DOM-волны при кликах
  const [ripples, setRipples] = useState([]);

  const colorConfig = CURSOR_COLORS[ui.cursorColor] || CURSOR_COLORS.purple;

  const startLoopRef = useRef(null);

  useEffect(() => {
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

    const render = () => {
      ctx.clearRect(0, 0, cssW, cssH);

      const currentUi = uiRef.current;
      if (currentUi.cursorGlow === false) {
        isRunning.current = false;
        return;
      }

      const activeColors = CURSOR_COLORS[currentUi.cursorColor] || CURSOR_COLORS.purple;
      const radius = Math.max(100, Math.min(500, Number(currentUi.cursorRadius) || 240));

      const dx = targetPos.current.x - curPos.current.x;
      const dy = targetPos.current.y - curPos.current.y;
      curPos.current.x += dx * 0.22;
      curPos.current.y += dy * 0.22;

      const px = curPos.current.x;
      const py = curPos.current.y;

      if (isInside.current && px > -radius && px < cssW + radius && py > -radius && py < cssH + radius) {
        // 1. Мягкое радиальное фоновое свечение
        const grad = ctx.createRadialGradient(px, py, 0, px, py, radius);
        grad.addColorStop(0, activeColors.glow0);
        grad.addColorStop(0.4, activeColors.glow1);
        grad.addColorStop(0.8, activeColors.glow2);
        grad.addColorStop(1, "rgba(0, 0, 0, 0)");

        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(px, py, radius, 0, Math.PI * 2);
        ctx.fill();

        // 2. Интерактивная точечная сетка (Dot Matrix Grid) с регулируемым шагом и затемнёнными точками
        if (currentUi.cursorDotGrid !== false) {
          const gridSize = Math.max(14, Math.min(60, Number(currentUi.cursorDotSpacing) || 28));
          const minX = Math.max(0, Math.floor((px - radius) / gridSize) * gridSize);
          const maxX = Math.min(cssW, Math.ceil((px + radius) / gridSize) * gridSize);
          const minY = Math.max(0, Math.floor((py - radius) / gridSize) * gridSize);
          const maxY = Math.min(cssH, Math.ceil((py + radius) / gridSize) * gridSize);

          for (let x = minX; x <= maxX; x += gridSize) {
            for (let y = minY; y <= maxY; y += gridSize) {
              const dist = Math.hypot(x - px, y - py);
              if (dist <= radius) {
                const factor = 1 - dist / radius; // 1 у курсора, 0 на границе
                // Тёмные, деликатные фоновые точки (не слепят глаза и не отвлекают от чтения листа)
                const alpha = 0.14 + Math.pow(factor, 1.4) * 0.46; // макс ~0.60
                const dotR = 1.0 + factor * 1.1 + Math.pow(factor, 2.2) * 1.2; // аккуратный радиус 1.0 - 3.3px

                const [r, g, b] = factor > 0.65 ? activeColors.dotCenter : activeColors.dotBase;
                ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${alpha.toFixed(3)})`;

                if (factor > 0.45) {
                  ctx.shadowBlur = (factor - 0.4) * 5;
                  ctx.shadowColor = activeColors.ring;
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

        // 3. Центральное световое ядро (опциональная точка на острие курсора)
        if (currentUi.cursorCenterDot) {
          ctx.fillStyle = activeColors.core;
          ctx.shadowColor = activeColors.core;
          ctx.shadowBlur = 12;
          ctx.beginPath();
          ctx.arc(px, py, 4, 0, Math.PI * 2);
          ctx.fill();
          ctx.shadowBlur = 0;
        }
      }

      // Цикл засыпает при полной неподвижности мыши (0% CPU в простое)
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

    startLoopRef.current = startLoop;

    const onMouseMove = (e) => {
      targetPos.current = { x: e.clientX, y: e.clientY };
      isInside.current = true;
      startLoop();

      // Динамический эффект светового пятна (spotlight) при вождении курсора по плашкам и карточкам
      if (uiRef.current.pillHover !== false && uiRef.current.pillSpotlight !== false) {
        const pill = e.target.closest?.(
          ".skill-row, .stat-roll .roll-btn, .passive, .subvital, .char-card, .charbar, .cond-box, .hp-box, .tab, .vital, .lvl-chip, .gold-pill, .panel, .att-table tbody tr, .sp-item, .feat-item, .inv-row, .wpn-card, .pill-hover"
        );
        if (pill) {
          const rect = pill.getBoundingClientRect();
          pill.style.setProperty("--mx", `${(e.clientX - rect.left).toFixed(1)}px`);
          pill.style.setProperty("--my", `${(e.clientY - rect.top).toFixed(1)}px`);
        }
      }
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
      if (uiRef.current.cursorRipple === false) return;
      const ripId = Date.now() + Math.random();
      setRipples((prev) => [...prev.slice(-4), { id: ripId, x: e.clientX, y: e.clientY }]);
      setTimeout(() => {
        setRipples((prev) => prev.filter((r) => r.id !== ripId));
      }, 650);
    };

    window.addEventListener("mousemove", onMouseMove, { passive: true });
    window.addEventListener("pointermove", onMouseMove, { passive: true });
    document.addEventListener("mouseenter", onMouseEnter);
    document.addEventListener("mouseleave", onMouseLeave);
    window.addEventListener("mousedown", onMouseDown, { capture: true, passive: true });
    window.addEventListener("pointerdown", onMouseDown, { capture: true, passive: true });

    startLoop();

    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("mousemove", onMouseMove);
      window.removeEventListener("pointermove", onMouseMove);
      document.removeEventListener("mouseenter", onMouseEnter);
      document.removeEventListener("mouseleave", onMouseLeave);
      window.removeEventListener("mousedown", onMouseDown, { capture: true });
      window.removeEventListener("pointerdown", onMouseDown, { capture: true });
      if (animFrameId.current) cancelAnimationFrame(animFrameId.current);
      isRunning.current = false;
    };
  }, []); // Слушатели событий монтируются один раз!

  // При любом изменении настроек в модалке мгновенно синхронизируем стили и запускаем перерисовку
  useEffect(() => {
    const root = document.documentElement;
    const body = document.body;

    root.style.setProperty("--pill-spotlight-size", `${ui.pillSpotlightRadius || 130}px`);
    const alpha = (ui.pillHover === false || ui.pillSpotlight === false) ? 0 : ((ui.pillSpotlightIntensity || 70) / 100);
    root.style.setProperty("--pill-spotlight-alpha", alpha.toFixed(2));
    root.style.setProperty("--pill-lift-x", (ui.pillHover === false || ui.pillHoverLift === false) ? "0px" : "4px");
    root.style.setProperty("--pill-lift-y", (ui.pillHover === false || ui.pillHoverLift === false) ? "0px" : "-2px");

    if (ui.pillHover === false) {
      body.classList.add("no-pill-hover");
    } else {
      body.classList.remove("no-pill-hover");
    }

    if (ui.pillHover === false || ui.pillSpotlight === false) {
      body.classList.add("no-pill-spotlight");
    } else {
      body.classList.remove("no-pill-spotlight");
    }

    if (ui.pillHover === false || ui.pillHoverLift === false) {
      body.classList.add("no-pill-lift");
    } else {
      body.classList.remove("no-pill-lift");
    }

    if (ui.cursorGlow === false) {
      if (canvasRef.current) {
        const ctx = canvasRef.current.getContext("2d");
        ctx?.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
      }
    } else {
      startLoopRef.current?.();
    }
  }, [
    ui.cursorGlow,
    ui.cursorDotGrid,
    ui.cursorDotSpacing,
    ui.cursorRadius,
    ui.cursorColor,
    ui.cursorCenterDot,
    ui.pillHover,
    ui.pillSpotlight,
    ui.pillSpotlightIntensity,
    ui.pillSpotlightRadius,
    ui.pillHoverLift,
  ]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className="cursor-glow-canvas"
        style={{
          position: "fixed",
          inset: 0,
          pointerEvents: "none",
          zIndex: 1,
          display: ui.cursorGlow === false ? "none" : "block",
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
            boxShadow: `0 0 16px 2px ${colorConfig.ring}`,
          }}
        />
      ))}
    </>
  );
}
