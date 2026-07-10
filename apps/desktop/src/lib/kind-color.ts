// Kind → color, shared by the 3D scenes and the HUD panels.
// Known kinds keep the brand palette. Any new kind (e.g. "plugin") gets a
// color derived by hashing the kind name — deterministic, so the planet a
// later user publishes for that kind matches the very first one, with no
// coordination or storage needed.
export const KNOWN_KIND_COLOR: Record<string, number> = {
  skill: 0xff6b7a,
  agent: 0xffb057,
  hook: 0xa78bfa,
  command: 0x38d3e8,
};

/** Stable hue from a string (same recipe as presence.userColor). */
function hashHue(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0;
  return h % 360;
}

function hslToInt(hue: number, sat: number, light: number): number {
  const f = (n: number) => {
    const k = (n + hue / 30) % 12;
    const c = light - sat * Math.min(light, 1 - light) * Math.max(-1, Math.min(k - 3, 9 - k, 1));
    return Math.round(c * 255);
  };
  return (f(0) << 16) | (f(8) << 8) | f(4);
}

/** Color for any item kind — palette for the four core kinds, a stable
 * hashed hue (70% sat / 65% light, so it glows like the rest) otherwise. */
export function kindColor(kind: string): number {
  return KNOWN_KIND_COLOR[kind] ?? hslToInt(hashHue(kind), 0.7, 0.65);
}

/** Same color as a CSS hex string for HUD labels. */
export function kindColorHex(kind: string): string {
  return `#${kindColor(kind).toString(16).padStart(6, "0")}`;
}

/** Lane order inside a solar system: core kinds first (stable structure
 * across users), then any new kinds alphabetically. */
export function kindLaneOrder(kinds: Iterable<string>): string[] {
  const known = Object.keys(KNOWN_KIND_COLOR);
  return [...new Set(kinds)].sort((a, b) => {
    const ia = known.indexOf(a);
    const ib = known.indexOf(b);
    if (ia !== -1 || ib !== -1) return (ia === -1 ? known.length : ia) - (ib === -1 ? known.length : ib);
    return a.localeCompare(b);
  });
}
