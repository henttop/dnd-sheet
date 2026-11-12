import React, { useEffect, useRef, useState } from "react";

/* Обрезка портрета под квадрат — как react-cropper на longstoryshort.app:
   квадратную рамку можно двигать и менять размер, есть зум и превью результата. */

const BOX = 320;        // размер области кроппера
const OUT = 512;        // сторона результата

export default function ImageCropper({ src, onApply, onClose }) {
  const [img, setImg] = useState(null);
  const [nat, setNat] = useState({ w: 0, h: 0 });
  const [zoom, setZoom] = useState(1);
  const [crop, setCrop] = useState(null);   // {x, y, size} в натуральных пикселях
  const drag = useRef(null);
  const wrapRef = useRef(null);

  useEffect(() => {
    const im = new Image();
    im.onload = () => { setImg(im); setNat({ w: im.naturalWidth, h: im.naturalHeight }); };
    im.src = src;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [src]);

  // масштаб картинки: вписать в область и умножить на зум
  const fit = nat.w ? Math.min(BOX / nat.w, BOX / nat.h) : 1;
  const scale = fit * zoom;
  const dispW = nat.w * scale;
  const dispH = nat.h * scale;
  const ox = (BOX - dispW) / 2;
  const oy = (BOX - dispH) / 2;

  // стартовый квадрат — максимальный по центру
  const init = useRef(false);
  useEffect(() => {
    if (!nat.w || init.current) return;
    init.current = true;
    const s = Math.min(nat.w, nat.h);
    setCrop({ x: (nat.w - s) / 2, y: (nat.h - s) / 2, size: s });
  }, [nat.w, nat.h]);

  const clampCrop = (c) => {
    const size = Math.max(24, Math.min(c.size, Math.min(nat.w, nat.h)));
    return {
      size,
      x: Math.max(0, Math.min(nat.w - size, c.x)),
      y: Math.max(0, Math.min(nat.h - size, c.y)),
    };
  };

  const onDown = (e, mode) => {
    e.stopPropagation();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { mode, x: e.clientX, y: e.clientY, crop: { ...crop } };
  };
  const onMove = (e) => {
    if (!drag.current || !crop) return;
    const dx = (e.clientX - drag.current.x) / scale;
    const dy = (e.clientY - drag.current.y) / scale;
    const c = drag.current.crop;
    if (drag.current.mode === "move") {
      setCrop(clampCrop({ ...c, x: c.x + dx, y: c.y + dy }));
    } else {
      // тяга за угол — меняем размер, сохраняя противоположный угол
      const size = c.size + dx + dy;
      setCrop(clampCrop({ ...c, size, x: c.x - (size - c.size) / 2, y: c.y - (size - c.size) / 2 }));
    }
  };
  const onUp = () => { drag.current = null; };

  const apply = () => {
    if (!img || !crop) return;
    const canvas = document.createElement("canvas");
    canvas.width = OUT; canvas.height = OUT;
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "#000"; ctx.fillRect(0, 0, OUT, OUT);
    try {
      ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, OUT, OUT);
      onApply(canvas.toDataURL("image/jpeg", 0.9), { ...crop, natW: nat.w, natH: nat.h });
    } catch (e) {
      // картинка с чужого домена — сохраняем только выбранную область
      onApply(null, { ...crop, natW: nat.w, natH: nat.h });
    }
  };

  const boxStyle = crop ? {
    left: ox + crop.x * scale,
    top: oy + crop.y * scale,
    width: crop.size * scale,
    height: crop.size * scale,
  } : {};

  return (
    <div className="modal-back" onMouseDown={onClose}>
      <div className="modal crop-modal" onMouseDown={e => e.stopPropagation()}>
        <h3 className="modal-title">СМЕНИТЬ ПОРТРЕТ</h3>
        <div className="crop-actions">
          <button className="f-btn danger" onClick={onClose}>Отмена</button>
          <button className="f-btn success" onClick={apply} disabled={!crop}>Сохранить</button>
        </div>

        <div className="crop-main">
          <div className="crop-stage">
            <div className="crop-window" ref={wrapRef}>
              {img ? (
                <img src={src} alt="" style={{
                  position: "absolute", left: ox, top: oy, width: dispW, height: dispH, maxWidth: "none", pointerEvents: "none",
                }} />
              ) : <div className="crop-loading">Загрузка…</div>}
              {crop ? (
                <>
                  <div className="crop-shade" style={boxStyle} />
                  <div className="crop-box" style={boxStyle}
                    onPointerDown={e => onDown(e, "move")}
                    onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
                    <span className="crop-handle" onPointerDown={e => onDown(e, "resize")}
                      onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp} />
                  </div>
                </>
              ) : null}
            </div>

            <div className="crop-side">
              <div className="f-label">ЗУМ</div>
              <input type="range" min="1" max="4" step="0.05" value={zoom}
                onChange={e => setZoom(+e.target.value)} />
              <div className="f-hint">
                Квадрат можно тянуть мышкой за рамку и менять размер за уголок.
                <br />Исходник: {nat.w}×{nat.h} px
                <br />Итог: {OUT}×{OUT} px
              </div>
              {crop ? (
                <div className="crop-preview">
                  <div className="crop-preview-box">
                    {img ? (
                      <img src={src} alt="" style={{
                        position: "absolute",
                        width: nat.w * (140 / crop.size),
                        left: -crop.x * (140 / crop.size),
                        top: -crop.y * (140 / crop.size),
                        maxWidth: "none",
                      }} />
                    ) : null}
                  </div>
                  <span className="f-hint">Превью</span>
                </div>
              ) : null}
              <button className="f-btn" style={{ marginTop: 8 }} onClick={() => {
                const s = Math.min(nat.w, nat.h);
                setCrop({ x: (nat.w - s) / 2, y: (nat.h - s) / 2, size: s });
                setZoom(1);
              }}>Сбросить</button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
