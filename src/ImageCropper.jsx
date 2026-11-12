import React, { useEffect, useRef, useState } from "react";

/* Обрезка изображения под квадрат: перетаскиваем картинку и крутим зум */
const SIZE = 300;          // сторона окна обрезки
const OUT = 480;           // сторона результата

export default function ImageCropper({ src, onApply, onClose }) {
  const wrapRef = useRef(null);
  const imgRef = useRef(null);
  const [img, setImg] = useState(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const drag = useRef(null);

  useEffect(() => {
    const im = new Image();
    im.onload = () => { setImg(im); setNat({ w: im.naturalWidth, h: im.naturalHeight }); };
    im.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  const base = nat.w ? Math.max(SIZE / nat.w, SIZE / nat.h) : 1;
  const scale = base * zoom;
  const dispW = nat.w * scale;
  const dispH = nat.h * scale;

  const clamp = (o) => ({
    x: Math.min(0, Math.max(SIZE - dispW, o.x)),
    y: Math.min(0, Math.max(SIZE - dispH, o.y)),
  });

  // при первой загрузке центрируем картинку
  const ready = useRef(false);
  useEffect(() => {
    if (!nat.w || ready.current) return;
    ready.current = true;
    setOff(clamp({ x: (SIZE - dispW) / 2, y: (SIZE - dispH) / 2 }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [nat.w, nat.h, zoom]);

  const onDown = (e) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { x: e.clientX, y: e.clientY, ox: off.x, oy: off.y };
  };
  const onMove = (e) => {
    if (!drag.current) return;
    setOff(clamp({
      x: drag.current.ox + (e.clientX - drag.current.x),
      y: drag.current.oy + (e.clientY - drag.current.y),
    }));
  };
  const onUp = () => { drag.current = null; };

  const apply = () => {
    if (!img || !nat.w) return;
    const c = document.createElement("canvas");
    c.width = OUT; c.height = OUT;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, OUT, OUT);
    const sx = (0 - off.x) / scale;
    const sy = (0 - off.y) / scale;
    const sw = SIZE / scale;
    const sh = SIZE / scale;
    ctx.drawImage(img, sx, sy, sw, sh, 0, 0, OUT, OUT);
    onApply(c.toDataURL("image/jpeg", 0.9));
  };

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal crop-modal" onMouseDown={e => e.stopPropagation()}>
        <button className="modal-x" onClick={onClose}>×</button>
        <h3 className="modal-title">ОБРЕЗАТЬ ПОРТРЕТ</h3>
        <p className="modal-text" style={{ marginBottom: 10 }}>
          Квадратная рамка — это итоговый портрет. Тащите картинку мышкой и подкручивайте зум.
        </p>

        <div className="crop-stage">
          <div className="crop-window"
            ref={wrapRef}
            onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
            {img ? (
              <img ref={imgRef} src={src} alt=""
                style={{
                  position: "absolute", left: off.x, top: off.y,
                  width: dispW, height: dispH, maxWidth: "none", pointerEvents: "none",
                }} />
            ) : <div className="crop-loading">Загрузка…</div>}
            <div className="crop-frame" />
          </div>
          <div className="crop-side">
            <div className="f-label">ЗУМ</div>
            <input type="range" min="1" max="4" step="0.05" value={zoom}
              onChange={e => {
                const z = +e.target.value;
                setZoom(z);
                setOff(o => {
                  const s2 = base * z;
                  const dw = nat.w * s2, dh = nat.h * s2;
                  return {
                    x: Math.min(0, Math.max(SIZE - dw, o.x)),
                    y: Math.min(0, Math.max(SIZE - dh, o.y)),
                  };
                });
              }} />
            <div className="f-hint">
              Исходник: {nat.w}×{nat.h} px
              <br />Результат: {OUT}×{OUT} px (квадрат)
            </div>
            <button className="f-btn" style={{ marginTop: 10 }} onClick={() => {
              const z = 1;
              setZoom(z);
              const dw = nat.w * base, dh = nat.h * base;
              setOff({ x: (SIZE - dw) / 2, y: (SIZE - dh) / 2 });
            }}>Сбросить</button>
          </div>
        </div>

        <div className="f-btns" style={{ marginTop: 12 }}>
          <button className="f-btn" onClick={onClose}>Отмена</button>
          <button className="f-btn primary" onClick={apply} disabled={!img}>Обрезать и применить</button>
        </div>
      </div>
    </div>
  );
}
