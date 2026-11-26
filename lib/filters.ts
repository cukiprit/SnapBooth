export type FilterEffect =
  | "none"
  | "mirror"
  | "pixelate"
  | "duotone"
  | "crt"
  | "vhs"
  | "halftone"
  | "thermal";

export interface CameraFilter {
  id: string;
  name: string;
  category: "BASIC" | "RETRO" | "FILM" | "FX";
  effect: FilterEffect;
  cssFilter: (intensity: number) => string;
}

export const CAMERA_FILTERS: CameraFilter[] = [
  // --- BASIC ---
  {
    id: "normal",
    name: "RAW CAM",
    category: "BASIC",
    effect: "none",
    cssFilter: () => "none",
  },
  {
    id: "soft-glow",
    name: "DREAMY",
    category: "BASIC",
    effect: "none",
    cssFilter: (i) =>
      `brightness(${100 + i * 0.12}%) contrast(${100 - i * 0.1}%) saturate(${100 + i * 0.2}%) blur(${(i / 100) * 1.2}px)`,
  },
  {
    id: "vivid-pop",
    name: "ARCADE POP",
    category: "BASIC",
    effect: "none",
    cssFilter: (i) =>
      `saturate(${100 + i * 0.9}%) contrast(${100 + i * 0.25}%) brightness(103%)`,
  },

  // --- FILM ---
  {
    id: "kodak-gold",
    name: "SUNSET 400",
    category: "FILM",
    effect: "none",
    cssFilter: (i) =>
      `sepia(${i * 0.35}%) saturate(${100 + i * 0.4}%) contrast(${100 + i * 0.15}%) hue-rotate(-${i * 0.08}deg)`,
  },
  {
    id: "fujifilm-cool",
    name: "TOKYO NIGHT",
    category: "FILM",
    effect: "none",
    cssFilter: (i) =>
      `contrast(${100 + i * 0.2}%) saturate(${100 + i * 0.15}%) hue-rotate(${i * 0.18}deg) brightness(98%)`,
  },
  {
    id: "noir-bw",
    name: "NOIR B&W",
    category: "FILM",
    effect: "none",
    cssFilter: (i) =>
      `grayscale(${i}%) contrast(${100 + i * 0.45}%) brightness(${100 - i * 0.05}%)`,
  },
  {
    id: "vintage-sepia",
    name: "1995 SEPIA",
    category: "FILM",
    effect: "none",
    cssFilter: (i) =>
      `sepia(${i * 0.85}%) contrast(${100 + i * 0.1}%) brightness(${100 - i * 0.05}%)`,
  },
  {
    id: "faded-polaroid",
    name: "FADED PRINT",
    category: "FILM",
    effect: "none",
    cssFilter: (i) =>
      `contrast(${100 - i * 0.22}%) brightness(${100 + i * 0.15}%) sepia(${i * 0.25}%) saturate(${100 - i * 0.2}%)`,
  },

  // --- RETRO ---
  {
    id: "gameboy-dmg",
    name: "GAMEBOY",
    category: "RETRO",
    effect: "none",
    cssFilter: (i) =>
      `grayscale(100%) sepia(${i}%) hue-rotate(48deg) saturate(${200 + i * 2}%) contrast(${110 + i * 0.3}%)`,
  },
  {
    id: "crt-scan",
    name: "CRT MONITOR",
    category: "RETRO",
    effect: "crt",
    cssFilter: (i) =>
      `contrast(${105 + i * 0.25}%) saturate(${110 + i * 0.3}%) brightness(102%)`,
  },
  {
    id: "vhs-glitch",
    name: "VHS TAPE",
    category: "RETRO",
    effect: "vhs",
    cssFilter: (i) =>
      `contrast(${100 + i * 0.2}%) saturate(${100 + i * 0.25}%) sepia(${i * 0.15}%)`,
  },
  {
    id: "pixel-8bit",
    name: "8-BIT PIXEL",
    category: "RETRO",
    effect: "pixelate",
    cssFilter: () => "contrast(115%) saturate(120%)",
  },

  // --- FX ---
  {
    id: "cyber-duotone",
    name: "CYBER DUO",
    category: "FX",
    effect: "duotone",
    cssFilter: () => "contrast(120%)",
  },
  {
    id: "thermal-cam",
    name: "THERMAL",
    category: "FX",
    effect: "thermal",
    cssFilter: () => "contrast(115%)",
  },
  {
    id: "comic-halftone",
    name: "MANGA DOTS",
    category: "FX",
    effect: "halftone",
    cssFilter: (i) => `grayscale(${Math.min(100, i)}%) contrast(140%)`,
  },
  {
    id: "twin-mirror",
    name: "SYMMETRY",
    category: "FX",
    effect: "mirror",
    cssFilter: () => "none",
  },
];
