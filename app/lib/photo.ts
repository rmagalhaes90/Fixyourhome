import { buildPlan, signalsFromPixels } from "./plan.mjs";

type Mode = "quick" | "normal" | "deep";

const SIZE = 48;

export async function signalsFromDataUrl(dataUrl: string) {
  const image = new Image();
  image.decoding = "async";
  image.src = dataUrl;
  await image.decode();
  const canvas = document.createElement("canvas");
  canvas.width = SIZE;
  canvas.height = SIZE;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) throw new Error("Não foi possível ler a foto.");
  context.drawImage(image, 0, 0, SIZE, SIZE);
  const { data } = context.getImageData(0, 0, SIZE, SIZE);
  return signalsFromPixels(data, SIZE);
}

export async function analyzePhoto(dataUrl: string, mode: Mode) {
  const signals = await signalsFromDataUrl(dataUrl);
  return buildPlan(signals, mode);
}
