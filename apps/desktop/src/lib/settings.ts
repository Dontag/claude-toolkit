// App feature flags. Defaults come from the build-time .env booleans; the user
// can override them at runtime via the Config panel (persisted in localStorage).
import { create } from "zustand";

const envBool = (v: unknown, dflt: boolean) =>
  v === undefined || v === "" ? dflt : String(v).toLowerCase() === "true" || v === "1";

const ENV_NOTIF = envBool(import.meta.env.VITE_ENABLE_NOTIFICATIONS, true);
const ENV_EMAIL = envBool(import.meta.env.VITE_ENABLE_EMAIL, false);

function load(key: string, dflt: boolean): boolean {
  try {
    const v = localStorage.getItem(key);
    return v === null ? dflt : v === "true";
  } catch {
    return dflt;
  }
}
function save(key: string, v: boolean) {
  try {
    localStorage.setItem(key, String(v));
  } catch {
    /* ignore */
  }
}

interface SettingsState {
  notifications: boolean; // in-app notification center + toasts for grants/proposals
  email: boolean; // request the backend to send emails (needs the edge function + provider)
  setNotifications: (v: boolean) => void;
  setEmail: (v: boolean) => void;
}

export const useSettings = create<SettingsState>((set) => ({
  notifications: load("ct_notifications", ENV_NOTIF),
  email: load("ct_email", ENV_EMAIL),
  setNotifications: (v) => {
    save("ct_notifications", v);
    set({ notifications: v });
  },
  setEmail: (v) => {
    save("ct_email", v);
    set({ email: v });
  },
}));

export const notificationsEnabled = () => useSettings.getState().notifications;
export const emailEnabled = () => useSettings.getState().email;
