"use client";

import { useLayoutEffect, useRef, useState, type ComponentProps } from "react";
import { EstimateDocument } from "./estimate-document";

/**
 * Renders the document at its natural letter-page width and shrinks it with a CSS transform
 * to fit whatever box it's in — a true thumbnail, never a reflowed/squashed layout.
 */
export function ScaledDocument({ width = 760, className, ...doc }: ComponentProps<typeof EstimateDocument> & { width?: number; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const page = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);
  const [height, setHeight] = useState<number | undefined>(undefined);

  useLayoutEffect(() => {
    const el = box.current, pg = page.current;
    if (!el || !pg) return;
    const update = () => {
      const s = Math.min(1, el.clientWidth / width);
      setScale(s);
      setHeight(pg.offsetHeight * s);
    };
    update();
    const ro = new ResizeObserver(update);
    ro.observe(el);
    ro.observe(pg);
    return () => ro.disconnect();
  }, [width]);

  return (
    <div ref={box} className={className} style={{ height }}>
      <div ref={page} style={{ width, transform: `scale(${scale})`, transformOrigin: "top left" }}>
        <EstimateDocument {...doc} />
      </div>
    </div>
  );
}
