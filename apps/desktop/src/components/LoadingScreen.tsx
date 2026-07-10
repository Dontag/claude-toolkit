import { useEffect, useState } from "react";
import LOGO from "../assets/logo.svg";

/** Launch splash — fades out ~500ms after the app reports ready. */
export function LoadingScreen({ done }: { done: boolean }) {
  const [gone, setGone] = useState(false);
  useEffect(() => {
    if (done) {
      const t = setTimeout(() => setGone(true), 650);
      return () => clearTimeout(t);
    }
  }, [done]);
  if (gone) return null;

  return (
    <div
      className={`fixed inset-0 z-[200] flex flex-col items-center justify-center transition-opacity duration-500 ${
        done ? "opacity-0" : "opacity-100"
      }`}
      style={{ background: "radial-gradient(120% 90% at 50% 40%, #141a33 0%, #0b0720 45%, #05030f 100%)" }}
    >
      {/* orbiting rings around the logo */}
      <div className="relative flex h-40 w-40 items-center justify-center">
        <span className="load-ring absolute inset-0 rounded-full border-t-2 border-[#8f83ff]" />
        <span className="load-ring-2 absolute inset-3 rounded-full border-b-2 border-[#7ce7f5]" />
        <span className="load-ring-3 absolute inset-7 rounded-full border-l-2 border-[#d94bd0]" />
        <img src={LOGO} alt="" className="load-pulse h-20 w-20 drop-shadow-[0_0_24px_rgba(143,131,255,0.6)]" />
      </div>
      <div className="mt-8 text-sm font-semibold tracking-wide text-text">Claude Galaxy</div>
      <div className="mt-1 text-[11px] tracking-[0.25em] text-muted uppercase">planting your galaxy…</div>
    </div>
  );
}
