/** "3 d 4 h", "5 h 12 min", "12 min": the two biggest units left. */
export function timeLeftParts(ms: number): { d: number; h: number; m: number } {
  const minutes = Math.max(1, Math.ceil(ms / 60_000));
  return {
    d: Math.floor(minutes / 1440),
    h: Math.floor((minutes % 1440) / 60),
    m: minutes % 60,
  };
}
