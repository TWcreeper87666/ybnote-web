const TRACK_COLORS = [
  '#4a90e2', '#e24a7a', '#4ae2a8', '#e2c74a',
  '#a24ae2', '#e2884a', '#4adce2', '#7ae24a',
  '#e26b4a', '#4a6be2', '#b8e24a', '#e24ac7'
];

export function getTrackColor(trackId: number): string {
  return TRACK_COLORS[trackId % TRACK_COLORS.length];
}
