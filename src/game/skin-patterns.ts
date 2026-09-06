import { CanvasTexture, SRGBColorSpace } from "three";
import { skinInfo, type SkinId } from "./progression";

/** Tiny painted liveries: no downloaded assets or extra model payload. */
export function skinPattern(id: SkinId) {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const x = c.getContext("2d")!,
    s = skinInfo(id);
  x.fillStyle = s.color;
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = s.accent;
  x.fillStyle = s.accent;
  x.lineWidth = 9;
  if (id === "taxi")
    for (let row = 0; row < 2; row++)
      for (let i = 0; i < 16; i++)
        if ((i + row) % 2 === 0) x.fillRect(i * 16, 180 + row * 16, 16, 16);
  if (id === "hotrod") {
    for (const side of [-1, 1]) {
      const a = 128 + side * 48;
      x.fillRect(a - 9, 0, 18, 256);
      x.beginPath();
      x.moveTo(a - 18, 230);
      x.bezierCurveTo(a - 45, 150, a + 50, 130, a + 12, 42);
      x.bezierCurveTo(a + 65, 110, a + 10, 180, a + 24, 230);
      x.closePath();
      x.fill();
    }
  }
  if (id === "mint") {
    x.fillStyle = "#effff0";
    x.beginPath();
    x.arc(128, 128, 105, 0, Math.PI * 2);
    x.fill();
    x.fillStyle = s.accent;
    for (const side of [-1, 1]) {
      x.beginPath();
      x.ellipse(128 + side * 44, 155, 25, 60, side * 0.7, 0, Math.PI * 2);
      x.fill();
    }
  }
  if (id === "neon") {
    for (const inset of [16, 38, 60])
      x.strokeRect(inset, inset, 256 - inset * 2, 256 - inset * 2);
    for (const [a, b] of [
      [32, 96],
      [224, 156],
      [88, 220],
    ]) {
      x.beginPath();
      x.arc(a, b, 10, 0, Math.PI * 2);
      x.fill();
    }
  }
  if (id === "lunar") {
    x.fillRect(12, 0, 40, 256);
    x.fillRect(204, 0, 40, 256);
    x.strokeStyle = "#556174";
    x.lineWidth = 3;
    for (let i = 0; i < 4; i++) x.strokeRect(64 + i * 32, 174, 22, 52);
    x.fillStyle = "#556174";
    x.beginPath();
    x.arc(128, 80, 42, 0, Math.PI * 2);
    x.fill();
  }
  if (id === "gold") {
    x.lineWidth = 4;
    for (let i = 0; i < 24; i++) {
      const a = (i * Math.PI) / 12;
      x.beginPath();
      x.moveTo(128 + Math.sin(a) * 50, 128 + Math.cos(a) * 50);
      x.lineTo(128 + Math.sin(a) * 124, 128 + Math.cos(a) * 124);
      x.stroke();
    }
    x.beginPath();
    x.arc(128, 128, 105, 0, Math.PI * 2);
    x.stroke();
  }
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 2;
  return t;
}
