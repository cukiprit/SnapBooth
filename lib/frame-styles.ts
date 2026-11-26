export type FrameStyleId =
  | "brutal-solid"
  | "film-strip"
  | "checkerboard"
  | "arcade-bezel";

export interface FrameStyle {
  id: FrameStyleId;
  label: string;
  description: string;
}

export const FRAME_STYLES: FrameStyle[] = [
  { id: "brutal-solid", label: "CLASSIC", description: "Bold brutalist border" },
  { id: "film-strip", label: "35MM FILM", description: "Cinema sprocket holes" },
  { id: "checkerboard", label: "CHECKER", description: "Y2K pixel checkerboard" },
  { id: "arcade-bezel", label: "ARCADE", description: "Retro CRT cabinet bezel" },
];
