// Galaxy tab — Phase 2 teaser. The real thing: every user's published items
// as star systems, realtime presence, graft-a-fruit installs, change windows.
export function GalaxyTab() {
  return (
    <div className="relative flex h-full items-center justify-center overflow-hidden">
      {/* CSS starfield teaser (the live Galaxy gets the full three.js treatment) */}
      <div className="stars-css absolute inset-0 opacity-70" />
      <div className="relative z-10 max-w-md rounded-2xl border border-border bg-glass p-8 text-center backdrop-blur-xl">
        <div className="text-5xl">🌌</div>
        <h2 className="mt-3 text-xl font-bold">The Galaxy is forming</h2>
        <p className="mt-2 text-sm leading-relaxed text-muted">
          Soon: every user's published skills, agents, hooks and commands orbiting as star systems.
          Share yours from Personal Space with one toggle, sync changes with one switch, and graft
          other people's fruits onto your tree. Comets streak the sky as the community works.
        </p>
        <div className="mt-4 inline-block rounded-full border border-border px-3 py-1 text-[11px] font-semibold uppercase tracking-wider text-brand2">
          Coming in v0.2
        </div>
      </div>
    </div>
  );
}
