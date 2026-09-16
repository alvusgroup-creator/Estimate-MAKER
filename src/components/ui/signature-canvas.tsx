"use client";

import { useRef, type RefObject } from "react";

/** Fixed internal resolution; the element scales with CSS and pointer positions are mapped back. */
export const SIG_W = 600;
export const SIG_H = 200;

/**
 * Bare drawing surface for a handwritten signature (finger, stylus or mouse).
 * The parent owns the canvas ref, so it can call `toDataURL()` / `clearSignature()` itself.
 */
export function SignatureCanvas({ canvasRef, dirty, onDirty, placeholder = "Sign here with your finger or mouse" }: {
  canvasRef: RefObject<HTMLCanvasElement | null>;
  dirty: boolean;
  onDirty: () => void;
  placeholder?: string;
}) {
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  const ctx = () => {
    const g = canvasRef.current!.getContext("2d")!;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 3;
    g.strokeStyle = "#111";
    return g;
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * SIG_W, y: ((e.clientY - r.top) / r.height) * SIG_H };
  };

  const down = (e: React.PointerEvent<HTMLCanvasElement>) => {
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawing.current || !last.current) return;
    const p = pos(e);
    const g = ctx();
    g.beginPath();
    g.moveTo(last.current.x, last.current.y);
    g.lineTo(p.x, p.y);
    g.stroke();
    last.current = p;
    if (!dirty) onDirty();
  };
  const up = () => { drawing.current = false; last.current = null; };

  return (
    <div className="relative rounded-lg border-2 border-dashed border-neutral-300 bg-white overflow-hidden touch-none">
      <canvas
        ref={canvasRef}
        width={SIG_W}
        height={SIG_H}
        className="w-full h-auto block cursor-crosshair"
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerLeave={up}
        onPointerCancel={up}
      />
      <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-neutral-300" />
      {!dirty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-neutral-400">{placeholder}</p>}
    </div>
  );
}

export function clearSignature(canvas: HTMLCanvasElement | null) {
  canvas?.getContext("2d")!.clearRect(0, 0, SIG_W, SIG_H);
}
