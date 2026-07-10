// Manual download links — a stop-gap until the GitHub-release pipeline is live.
// Drop the direct installer URLs here (e.g. OneDrive "Copy link" → make sure it
// ends in `&download=1` so it downloads instead of opening the OneDrive viewer).
// The download page and the landing hero button prefer a real GitHub release
// asset when one exists, and fall back to these.
//
//   OneDrive tip: share the file → Copy link → append `&download=1`.
//   Google Drive tip: use https://drive.google.com/uc?export=download&id=<FILE_ID>
export interface ManualDownloads {
  version: string | null; // shown next to the button, e.g. "0.1.0"
  windows: string | null; // .msi or setup .exe
  mac: string | null; // .dmg
  linux: string | null; // .AppImage or .deb
}

export const MANUAL_DOWNLOADS: ManualDownloads = {
  version: "0.1.0",
  // Google Drive portable Windows build (uc?export=download forces a download)
  windows: "https://drive.google.com/uc?export=download&id=1DAzRaZPW2WF89pNFxKJYpwui9v3b-ERK",
  mac: null,
  linux: null,
};

import { loadReleases, type ReleaseAsset } from "./data";

/** Best installer URL per OS: a GitHub release asset if present, else the
 * manual link above. Returns nulls until either source is populated. */
export function resolveDownloads() {
  const latest = loadReleases()[0] ?? null;
  const assetUrl = (patterns: RegExp[]): string | null => {
    if (!latest) return null;
    for (const p of patterns) {
      const a = latest.assets.find((x: ReleaseAsset) => p.test(x.name));
      if (a) return a.url;
    }
    return null;
  };
  return {
    version: latest?.version ?? MANUAL_DOWNLOADS.version,
    source: (latest ? "release" : MANUAL_DOWNLOADS.windows || MANUAL_DOWNLOADS.mac || MANUAL_DOWNLOADS.linux ? "manual" : "none") as
      | "release"
      | "manual"
      | "none",
    windows: assetUrl([/\.msi$/i, /setup.*\.exe$/i, /\.exe$/i]) ?? MANUAL_DOWNLOADS.windows,
    mac: assetUrl([/aarch64.*\.dmg$/i, /\.dmg$/i]) ?? MANUAL_DOWNLOADS.mac,
    linux: assetUrl([/\.AppImage$/i, /\.deb$/i]) ?? MANUAL_DOWNLOADS.linux,
  };
}
