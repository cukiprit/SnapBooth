export interface GridLayout {
  id: string;
  label: string;
  rows: number;
  cols: number;
  totalShots: number;
}

export const GRID_LAYOUTS: GridLayout[] = [
  { id: "1x1", label: "1×1 Single", rows: 1, cols: 1, totalShots: 1 },
  { id: "1x2", label: "1×2 Duo", rows: 2, cols: 1, totalShots: 2 },
  { id: "2x1", label: "2×1 Wide", rows: 1, cols: 2, totalShots: 2 },
  { id: "2x2", label: "2×2 Grid", rows: 2, cols: 2, totalShots: 4 },
  { id: "1x4", label: "1×4 Strip", rows: 4, cols: 1, totalShots: 4 },
  { id: "2x3", label: "2×3 Collage", rows: 3, cols: 2, totalShots: 6 },
];
