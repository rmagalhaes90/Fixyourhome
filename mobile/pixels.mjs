import { signalsFromPixels } from "../app/lib/plan.mjs";

const SIZE = 48;

function bytesFromBase64(input) {
  const clean = String(input).replace(/^data:image\/\w+;base64,/, "").replace(/\s/g, "");
  const alphabet = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  const pad = clean.endsWith("==") ? 2 : clean.endsWith("=") ? 1 : 0;
  const length = Math.max(0, Math.floor((clean.length * 3) / 4) - pad);
  const out = new Uint8Array(length);
  let cursor = 0;
  for (let index = 0; index < clean.length; index += 4) {
    const a = alphabet.indexOf(clean[index]);
    const b = alphabet.indexOf(clean[index + 1]);
    const c = alphabet.indexOf(clean[index + 2]);
    const d = alphabet.indexOf(clean[index + 3]);
    const value = ((a < 0 ? 0 : a) << 18) | ((b < 0 ? 0 : b) << 12) | ((c < 0 ? 0 : c) << 6) | (d < 0 ? 0 : d);
    if (cursor < length) out[cursor++] = (value >> 16) & 255;
    if (cursor < length) out[cursor++] = (value >> 8) & 255;
    if (cursor < length) out[cursor++] = value & 255;
  }
  return out;
}

export function signalsFromRgba(data, width, height) {
  const square = new Uint8Array(SIZE * SIZE * 4);
  const safeWidth = Math.max(1, width);
  const safeHeight = Math.max(1, height);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const sourceX = Math.min(safeWidth - 1, Math.floor(((x + 0.5) * safeWidth) / SIZE));
      const sourceY = Math.min(safeHeight - 1, Math.floor(((y + 0.5) * safeHeight) / SIZE));
      const from = (sourceY * safeWidth + sourceX) * 4;
      const to = (y * SIZE + x) * 4;
      square[to] = data[from] ?? 0;
      square[to + 1] = data[from + 1] ?? 0;
      square[to + 2] = data[from + 2] ?? 0;
      square[to + 3] = 255;
    }
  }
  return signalsFromPixels(square, SIZE);
}

export function signalsFromJpegBase64(base64) {
  const jpeg = require("jpeg-js");
  const decode = jpeg.decode || jpeg.default?.decode;
  const decoded = decode(bytesFromBase64(base64), { useTArray: true, formatAsRGBA: true });
  return signalsFromRgba(decoded.data, decoded.width, decoded.height);
}
