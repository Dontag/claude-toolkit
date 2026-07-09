// Sci-fi HUD chrome: corner brackets + faint scan grid laid over a scene.
// Purely decorative and pointer-transparent (ref image 2).
export function HudFrame({ accent = "#7ce7f5" }: { accent?: string }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-[5] overflow-hidden">
      <span className="hud-corner absolute left-3 top-3 border-l-2 border-t-2" style={{ borderColor: accent }} />
      <span className="hud-corner absolute right-3 top-3 border-r-2 border-t-2" style={{ borderColor: accent }} />
      <span className="hud-corner absolute bottom-3 left-3 border-b-2 border-l-2" style={{ borderColor: accent }} />
      <span className="hud-corner absolute bottom-3 right-3 border-b-2 border-r-2" style={{ borderColor: accent }} />
    </div>
  );
}
