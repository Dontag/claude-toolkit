// Auto-update: check GitHub Releases' latest.json on launch; download,
// install and relaunch on user confirmation (via the toast → native dialog).
import { check } from "@tauri-apps/plugin-updater";
import { relaunch } from "@tauri-apps/plugin-process";
import { ask } from "@tauri-apps/plugin-dialog";

export async function checkForUpdates(): Promise<void> {
  try {
    const update = await check();
    if (!update) return;
    const yes = await ask(
      `Claude Galaxy ${update.version} is available (you have ${update.currentVersion}).\n\nInstall and restart now?`,
      { title: "Update available", kind: "info", okLabel: "Update", cancelLabel: "Later" },
    );
    if (!yes) return;
    await update.downloadAndInstall();
    await relaunch();
  } catch {
    // offline / dev mode / no releases yet — silently skip
  }
}
