import { useEffect, useRef, useState } from "react";
import Cropper from "react-easy-crop";
import { Button } from "@/components/ui/button";
import { Loader2, ZoomIn } from "lucide-react";

/**
 * Drag-to-position circular logo cropper (like setting a profile picture).
 * Lets the owner pick exactly which part of their image becomes the logo,
 * then exports a clean square PNG to upload.
 */

type Area = { x: number; y: number; width: number; height: number };

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = src;
  });
}

async function cropToBlob(src: string, area: Area): Promise<Blob | null> {
  const img = await loadImage(src);
  const size = 512;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  if (!ctx) return null;
  ctx.drawImage(img, area.x, area.y, area.width, area.height, 0, 0, size, size);
  return new Promise((resolve) => canvas.toBlob((b) => resolve(b), "image/png", 0.92));
}

export function LogoCropper({
  file,
  onCancel,
  onCropped,
}: {
  file: File;
  onCancel: () => void;
  onCropped: (blob: Blob) => void;
}) {
  const [src] = useState(() => URL.createObjectURL(file));
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const areaRef = useRef<Area | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => () => URL.revokeObjectURL(src), [src]);

  const confirm = async () => {
    if (!areaRef.current) return;
    setBusy(true);
    const blob = await cropToBlob(src, areaRef.current);
    setBusy(false);
    if (blob) onCropped(blob);
  };

  return (
    <div className="fixed inset-0 z-[60] grid place-items-center bg-zinc-900/50 p-4 backdrop-blur-sm" onClick={onCancel}>
      <div className="w-full max-w-md overflow-hidden rounded-2xl border border-zinc-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="border-b border-zinc-100 px-5 py-4">
          <h3 className="text-base font-semibold tracking-tight">Position your logo</h3>
          <p className="mt-0.5 text-xs text-zinc-500">Drag to move, pinch or slide to zoom. The circle is what guests will see.</p>
        </div>
        <div className="relative h-72 bg-zinc-900">
          <Cropper
            image={src}
            crop={crop}
            zoom={zoom}
            aspect={1}
            cropShape="round"
            showGrid={false}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={(_area, areaPixels) => { areaRef.current = areaPixels as Area; }}
          />
        </div>
        <div className="flex items-center gap-3 px-5 py-4">
          <ZoomIn className="h-4 w-4 shrink-0 text-zinc-400" />
          <input
            type="range"
            min={1}
            max={3}
            step={0.01}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="h-1.5 w-full cursor-pointer accent-[#c2410c]"
          />
        </div>
        <div className="flex justify-end gap-2 border-t border-zinc-100 px-5 py-4">
          <Button variant="ghost" onClick={onCancel} className="rounded-full">Cancel</Button>
          <Button onClick={confirm} disabled={busy} className="rounded-full bg-gradient-hero text-white hover:opacity-90">
            {busy ? <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" /> : null} Use photo
          </Button>
        </div>
      </div>
    </div>
  );
}
