"use client";

import { forwardRef, useImperativeHandle, useRef, useState } from "react";

export type SignaturePadHandle = {
  clear: () => void;
  // null when nothing has been drawn yet — callers should refuse to
  // submit an empty signature rather than send a blank image.
  toDataUrl: () => string | null;
};

// A plain HTML canvas, not a library — this is the one signature capture
// screen in the app (handed straight to the Site Manager/foreman to draw
// on, in person, then handed back), so a small hand-rolled pointer-events
// drawer covers it without pulling in a dependency for one component.
// Pointer events (not separate mouse/touch handlers) cover finger, mouse,
// and stylus input identically on a phone or tablet.
export const SignaturePad = forwardRef<SignaturePadHandle, { className?: string }>(function SignaturePad(
  { className },
  ref
) {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const isDrawingRef = useRef(false);
  const hasDrawnRef = useRef(false);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  function getContext() {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    return canvas.getContext("2d");
  }

  // The canvas's drawing surface (width/height attributes) is sized once
  // the element actually has layout dimensions, then scaled for device
  // pixel ratio so the drawn line stays crisp on a high-DPI phone screen
  // instead of looking soft/blurry.
  function ensureCanvasSize() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    const targetWidth = Math.round(rect.width * dpr);
    const targetHeight = Math.round(rect.height * dpr);
    if (canvas.width !== targetWidth || canvas.height !== targetHeight) {
      canvas.width = targetWidth;
      canvas.height = targetHeight;
      const ctx = canvas.getContext("2d");
      if (ctx) {
        ctx.scale(dpr, dpr);
        ctx.lineWidth = 2.5;
        ctx.lineCap = "round";
        ctx.lineJoin = "round";
        ctx.strokeStyle = "#0d141b";
      }
    }
  }

  function pointFromEvent(event: React.PointerEvent<HTMLCanvasElement>) {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  }

  function handlePointerDown(event: React.PointerEvent<HTMLCanvasElement>) {
    event.preventDefault();
    ensureCanvasSize();
    canvasRef.current?.setPointerCapture(event.pointerId);
    isDrawingRef.current = true;
    lastPointRef.current = pointFromEvent(event);
  }

  function handlePointerMove(event: React.PointerEvent<HTMLCanvasElement>) {
    if (!isDrawingRef.current) return;
    event.preventDefault();
    const ctx = getContext();
    const from = lastPointRef.current;
    const to = pointFromEvent(event);
    if (ctx && from) {
      ctx.beginPath();
      ctx.moveTo(from.x, from.y);
      ctx.lineTo(to.x, to.y);
      ctx.stroke();
    }
    lastPointRef.current = to;
    if (!hasDrawnRef.current) {
      hasDrawnRef.current = true;
      setHasDrawn(true);
    }
  }

  function handlePointerUp(event: React.PointerEvent<HTMLCanvasElement>) {
    isDrawingRef.current = false;
    lastPointRef.current = null;
    canvasRef.current?.releasePointerCapture(event.pointerId);
  }

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      const ctx = getContext();
      if (canvas && ctx) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
      }
      hasDrawnRef.current = false;
      setHasDrawn(false);
    },
    toDataUrl() {
      if (!hasDrawnRef.current) return null;
      return canvasRef.current?.toDataURL("image/png") ?? null;
    }
  }));

  return (
    <div className={className}>
      <canvas
        ref={canvasRef}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        className="w-full h-40 rounded-lg border border-[#e7edf3] dark:border-slate-700 bg-white touch-none"
      />
      {!hasDrawn && (
        <p className="text-xs text-[#4c739a] dark:text-slate-400 mt-1">Sign above with your finger or a stylus.</p>
      )}
    </div>
  );
});
