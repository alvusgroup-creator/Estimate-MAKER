"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { Check, Eraser, PenLine, Type } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/card";
import { removeSignature, saveSignature } from "@/lib/settings/actions";
import { cn } from "@/lib/utils";

const W = 600;
const H = 200;
const TYPED_FONTS = [
  { id: "caveat", label: "Caveat", css: "'Caveat', cursive" },
  { id: "dancing", label: "Dancing Script", css: "'Dancing Script', cursive" },
  { id: "homemade", label: "Homemade Apple", css: "'Homemade Apple', cursive" },
];

export function SignaturePad({ current, currentName, ownerName }: { current: string | null; currentName: string | null; ownerName: string }) {
  const [mode, setMode] = useState<"draw" | "type">("draw");
  const [name, setName] = useState(currentName ?? "");
  const [typed, setTyped] = useState(currentName ?? ownerName);
  const [font, setFont] = useState(TYPED_FONTS[0]);
  const [dirty, setDirty] = useState(false);
  const [saved, setSaved] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [pending, start] = useTransition();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  // Load handwriting fonts once (only in the browser, only on this screen)
  useEffect(() => {
    const id = "sig-fonts";
    if (document.getElementById(id)) return;
    const link = document.createElement("link");
    link.id = id;
    link.rel = "stylesheet";
    link.href = "https://fonts.googleapis.com/css2?family=Caveat:wght@600&family=Dancing+Script:wght@600&family=Homemade+Apple&display=swap";
    document.head.appendChild(link);
  }, []);

  const ctx = () => {
    const c = canvasRef.current!;
    const g = c.getContext("2d")!;
    g.lineCap = "round";
    g.lineJoin = "round";
    g.lineWidth = 3;
    g.strokeStyle = "#111";
    return g;
  };

  const pos = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - r.left) / r.width) * W, y: ((e.clientY - r.top) / r.height) * H };
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
    setDirty(true);
  };
  const up = () => { drawing.current = false; last.current = null; };

  const clear = () => {
    const c = canvasRef.current;
    if (c) c.getContext("2d")!.clearRect(0, 0, W, H);
    setDirty(false);
  };

  /** Rasterize typed text so the document only ever deals with an image. */
  const typedToDataUrl = async () => {
    await document.fonts.load(`600 72px ${font.css}`);
    const c = document.createElement("canvas");
    c.width = W; c.height = H;
    const g = c.getContext("2d")!;
    g.fillStyle = "#111";
    g.textBaseline = "middle";
    let size = 84;
    do { g.font = `600 ${size}px ${font.css}`; size -= 4; } while (g.measureText(typed).width > W - 40 && size > 24);
    g.fillText(typed, 20, H / 2);
    return c.toDataURL("image/png");
  };

  const save = () =>
    start(async () => {
      setErr(null); setSaved(false);
      const dataUrl = mode === "draw" ? canvasRef.current!.toDataURL("image/png") : await typedToDataUrl();
      if (mode === "draw" && !dirty) return setErr("Draw your signature first");
      if (mode === "type" && !typed.trim()) return setErr("Type your name first");
      const r = await saveSignature(dataUrl, name.trim() || (mode === "type" ? typed.trim() : ownerName));
      if (!r.ok) return setErr(r.error);
      setSaved(true);
    });

  return (
    <Card>
      <CardHeader>
        <CardTitle>Your signature</CardTitle>
        <span className="text-xs text-muted">Stamped on every estimate as &ldquo;Prepared by&rdquo;</span>
      </CardHeader>
      <CardBody className="space-y-4">
        {current && (
          <div className="flex items-center gap-4 rounded-lg border border-border bg-white p-3">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={current} alt="Current signature" className="h-14 w-auto max-w-[240px] object-contain" />
            <div className="text-sm">
              <p className="font-medium">{currentName}</p>
              <p className="text-xs text-muted">Current signature</p>
            </div>
            <button type="button" className="ml-auto text-xs text-danger" onClick={() => start(async () => { await removeSignature(); })}>Remove</button>
          </div>
        )}

        <div className="flex gap-1 rounded-lg bg-black/5 p-1 w-fit">
          <button type="button" onClick={() => setMode("draw")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-sm", mode === "draw" ? "bg-surface shadow-sm font-medium" : "text-muted")}><PenLine className="h-4 w-4" /> Draw</button>
          <button type="button" onClick={() => setMode("type")} className={cn("inline-flex items-center gap-1.5 rounded-md px-3 h-8 text-sm", mode === "type" ? "bg-surface shadow-sm font-medium" : "text-muted")}><Type className="h-4 w-4" /> Type</button>
        </div>

        {mode === "draw" ? (
          <div className="space-y-2">
            <div className="relative rounded-lg border-2 border-dashed border-border bg-white overflow-hidden touch-none">
              <canvas
                ref={canvasRef}
                width={W}
                height={H}
                className="w-full h-auto block cursor-crosshair"
                onPointerDown={down}
                onPointerMove={move}
                onPointerUp={up}
                onPointerLeave={up}
                onPointerCancel={up}
              />
              <div className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-neutral-300" />
              {!dirty && <p className="pointer-events-none absolute inset-0 grid place-items-center text-sm text-muted/60">Sign here with your finger or mouse</p>}
            </div>
            <Button type="button" variant="ghost" size="sm" onClick={clear}><Eraser className="h-4 w-4" /> Clear</Button>
          </div>
        ) : (
          <div className="space-y-3">
            <Input value={typed} onChange={(e) => setTyped(e.target.value)} placeholder="Your name" className="text-base" />
            <div className="grid grid-cols-3 gap-2">
              {TYPED_FONTS.map((f) => (
                <button key={f.id} type="button" onClick={() => setFont(f)} className={cn("rounded-lg border-2 bg-white px-2 py-3 text-center truncate text-[26px] leading-none", font.id === f.id ? "border-accent" : "border-border")} style={{ fontFamily: f.css }}>
                  {typed || "Signature"}
                </button>
              ))}
            </div>
          </div>
        )}

        <div>
          <label className="block text-xs font-medium text-muted mb-1">Name shown under the signature</label>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder={ownerName} />
        </div>

        <div className="flex items-center gap-3">
          <Button type="button" onClick={save} disabled={pending}>{pending ? "Saving…" : "Save signature"}</Button>
          {saved && <span className="text-sm text-success inline-flex items-center gap-1"><Check className="h-4 w-4" /> Saved</span>}
          {err && <span className="text-sm text-danger">{err}</span>}
        </div>
      </CardBody>
    </Card>
  );
}
