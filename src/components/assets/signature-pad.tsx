"use client";
import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { Eraser } from "lucide-react";

/** Pavé de signature tactile/souris. Écrit un PNG (data URL) dans un input caché `name`. */
export function SignaturePad({ name = "signature", onChange }: { name?: string; onChange?: (empty: boolean) => void }) {
  const t = useTranslations("assets");
  const canvas = useRef<HTMLCanvasElement>(null);
  const [value, setValue] = useState("");
  const drawing = useRef(false);
  const last = useRef<{ x: number; y: number } | null>(null);

  useEffect(() => {
    const c = canvas.current!;
    const ratio = window.devicePixelRatio || 1;
    c.width = c.offsetWidth * ratio;
    c.height = c.offsetHeight * ratio;
    const ctx = c.getContext("2d")!;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#111827";
  }, []);

  const pos = (e: React.PointerEvent) => {
    const r = canvas.current!.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };
  const down = (e: React.PointerEvent) => {
    e.preventDefault();
    canvas.current!.setPointerCapture(e.pointerId);
    drawing.current = true;
    last.current = pos(e);
  };
  const move = (e: React.PointerEvent) => {
    if (!drawing.current) return;
    const ctx = canvas.current!.getContext("2d")!;
    const p = pos(e);
    ctx.beginPath();
    ctx.moveTo(last.current!.x, last.current!.y);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    last.current = p;
  };
  const up = () => {
    if (!drawing.current) return;
    drawing.current = false;
    const url = canvas.current!.toDataURL("image/png");
    setValue(url);
    onChange?.(false);
  };
  const clear = () => {
    const c = canvas.current!;
    c.getContext("2d")!.clearRect(0, 0, c.width, c.height);
    setValue("");
    onChange?.(true);
  };

  return (
    <div>
      <div className="relative overflow-hidden rounded-xl border border-border bg-white">
        <canvas
          ref={canvas}
          onPointerDown={down}
          onPointerMove={move}
          onPointerUp={up}
          onPointerLeave={up}
          className="block h-40 w-full cursor-crosshair touch-none"
          aria-label={t("signHere")}
        />
        {!value && <span className="pointer-events-none absolute inset-0 flex items-center justify-center text-xs text-zinc-400">{t("signHere")}</span>}
        <span className="pointer-events-none absolute inset-x-6 bottom-8 border-b border-dashed border-zinc-300" />
        <button type="button" onClick={clear} className="absolute end-2 top-2 inline-flex items-center gap-1 rounded-md bg-zinc-100 px-2 py-1 text-[11px] text-zinc-600 hover:bg-zinc-200">
          <Eraser className="size-3" />
          {t("clear")}
        </button>
      </div>
      <input type="hidden" name={name} value={value} />
    </div>
  );
}
