export type EffectType = "none" | "mirror" | "pixelate" | "duotone";

export interface CameraFilter {
  id: string;
  name: string;
  category: "color" | "retro" | "distortion";
  cssFilter: (intensity: number) => string;
  effect?: EffectType;
}

export const CAMERA_FILTERS: CameraFilter[] = [
  {
    id: "normal",
    name: "Normal",
    category: "color",
    cssFilter: () => "none",
  },
  {
    id: "bw-noir",
    name: "Noir B&W",
    category: "color",
    cssFilter: (v) => `grayscale(${v}%) contrast(${100 + v * 0.4}%)`,
  },
  {
    id: "vintage-90s",
    name: "90s Film",
    category: "retro",
    cssFilter: (v) =>
      `sepia(${v * 0.65}%) contrast(${100 + v * 0.15}%) brightness(${100 + v * 0.05}%) saturate(${100 - v * 0.2}%)`,
  },
  {
    id: "cyber-pop",
    name: "Cyber Pop",
    category: "color",
    cssFilter: (v) => `hue-rotate(${v * 2.4}deg) saturate(${100 + v * 1.2}%) contrast(115%)`,
  },
  {
    id: "dreamy-glow",
    name: "Soft Glow",
    category: "retro",
    cssFilter: (v) => `brightness(${100 + v * 0.18}%) contrast(${100 - v * 0.15}%) saturate(${100 + v * 0.25}%)`,
  },
  {
    id: "kaleido-mirror",
    name: "Mirror Split",
    category: "distortion",
    cssFilter: () => "contrast(105%)",
    effect: "mirror",
  },
  {
    id: "retro-pixel",
    name: "8-Bit Pixel",
    category: "distortion",
    cssFilter: (v) => `saturate(${100 + v * 0.5}%) contrast(120%)`,
    effect: "pixelate",
  },
  {
    id: "thermal-vision",
    name: "Thermal",
    category: "distortion",
    cssFilter: () => "none",
    effect: "duotone",
  },
];
