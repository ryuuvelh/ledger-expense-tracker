export const COLOR_PALETTE = [
  "#00d4aa",
  "#3b82f6",
  "#f59e0b",
  "#f43f5e",
  "#a78bfa",
  "#06b6d4",
  "#eab308",
  "#ec4899",
  "#16a34a",
  "#fb923c",
  "#6366f1",
  "#14b8a6",
  "#ef4444",
  "#8b5cf6",
  "#0ea5e9",
  "#84cc16",
] as const;

export function colorFromIndex(index: number): string {
  return COLOR_PALETTE[index % COLOR_PALETTE.length];
}
