import React, { useState, useRef } from "react";
import ReactCrop, { centerCrop, makeAspectCrop } from "react-image-crop";
import "react-image-crop/dist/ReactCrop.css";

const OUT_SIZE = 512; // Размер выходного квадратного аватара

export default function ImageCropper({ src, onApply, onClose }) {
  const [crop, setCrop] = useState();
  const [completedCrop, setCompletedCrop] = useState();
  const imgRef = useRef(null);

  const onImageLoad = (e) => {
    const { width, height } = e.currentTarget;
    const initialCrop = centerCrop(
      makeAspectCrop(
        {
          unit: "%",
          width: 75,
        },
        1,
        width,
        height
      ),
      width,
      height
    );
    setCrop(initialCrop);
    setCompletedCrop(initialCrop);
  };

  const apply = () => {
    const image = imgRef.current;
    if (!image || !completedCrop || !completedCrop.width || !completedCrop.height) {
      onClose();
      return;
    }

    const scaleX = image.naturalWidth / image.width;
    const scaleY = image.naturalHeight / image.height;

    const pixelX = Math.round(completedCrop.x * scaleX);
    const pixelY = Math.round(completedCrop.y * scaleY);
    const pixelW = Math.round(completedCrop.width * scaleX);
    const pixelH = Math.round(completedCrop.height * scaleY);

    const canvas = document.createElement("canvas");
    canvas.width = OUT_SIZE;
    canvas.height = OUT_SIZE;
    const ctx = canvas.getContext("2d");

    ctx.imageSmoothingQuality = "high";
    try {
      ctx.drawImage(
        image,
        pixelX,
        pixelY,
        pixelW,
        pixelH,
        0,
        0,
        OUT_SIZE,
        OUT_SIZE
      );
      const dataUrl = canvas.toDataURL("image/jpeg", 0.92);
      onApply(dataUrl, {
        x: pixelX,
        y: pixelY,
        size: pixelW,
        natW: image.naturalWidth,
        natH: image.naturalHeight,
      });
    } catch (e) {
      // В случае CORS-ограничения для сторонней картинки
      onApply(null, {
        x: pixelX,
        y: pixelY,
        size: pixelW,
        natW: image.naturalWidth,
        natH: image.naturalHeight,
      });
    }
  };

  return (
    <div className="crop-modal-overlay" onMouseDown={onClose}>
      <div className="crop-modal-content" onMouseDown={(e) => e.stopPropagation()}>
        <h3 className="crop-modal-title">Сменить портрет</h3>
        <button
          className="crop-modal-close"
          type="button"
          onClick={onClose}
          aria-label="Закрыть"
        >
          ×
        </button>

        <div className="crop-modal-actions">
          <button type="button" className="crop-btn-cancel" onClick={onClose}>
            Отмена
          </button>
          <button
            type="button"
            className="crop-btn-save"
            onClick={apply}
            disabled={!completedCrop?.width}
          >
            Сохранить
          </button>
        </div>

        <div className="crop-stage-container">
          <ReactCrop
            crop={crop}
            onChange={(c) => setCrop(c)}
            onComplete={(c) => setCompletedCrop(c)}
            aspect={1}
            minWidth={40}
            minHeight={40}
            keepSelection
          >
            <img
              ref={imgRef}
              src={src}
              alt="Кроп портрета"
              onLoad={onImageLoad}
              className="avatar__crop"
            />
          </ReactCrop>
        </div>
      </div>
    </div>
  );
}
