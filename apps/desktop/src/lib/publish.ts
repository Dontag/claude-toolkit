// Publish layer: Share-to-Galaxy toggle + Sync switch.
// Shared items live in the user's default cloud toolkit ("main"); every push
// appends an item_version and moves current_version_id. Sync=ON auto-pushes
// local saves/watcher edits; Sync=OFF marks the fruit "local ahead" until the
// user presses Push. Sync flags persist in the Tauri store.
import { load, type Store } from "@tauri-apps/plugin-store";
import { create } from "zustand";
import type { ToolkitItem } from "@claude-toolkit/core";
import { supabase } from "./supabase";
import { useSession } from "../stores/session";
import { broadcastActivity } from "./presence";

export interface SharedMeta {
  cloudItemId: string;
  syncOn: boolean;
  localAhead: boolean;
}

interface PublishState {
  /** local item id → cloud metadata (present = shared to the Galaxy) */
  shared: Map<string, SharedMeta>;
  busy: Set<string>;
}

export const usePublish = create<PublishState>(() => ({
  shared: new Map(),
  busy: new Set(),
}));

let store: Store | null = null;
async function syncFlagStore(): Promise<Store | null> {
  try {
    store ??= await load("publish.json", { autoSave: true, defaults: {} });
    return store;
  } catch {
    return null; // browser dev without Tauri
  }
}

async function sha256(text: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(text));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

function setBusy(id: string, on: boolean) {
  usePublish.setState((s) => {
    const busy = new Set(s.busy);
    if (on) busy.add(id);
    else busy.delete(id);
    return { busy };
  });
}

function setMeta(localId: string, meta: SharedMeta | null) {
  usePublish.setState((s) => {
    const shared = new Map(s.shared);
    if (meta) shared.set(localId, meta);
    else shared.delete(localId);
    return { shared };
  });
}

async function myToolkitId(): Promise<string | null> {
  if (!supabase) return null;
  const uid = useSession.getState().session?.user.id;
  if (!uid) return null;
  const { data } = await supabase.from("toolkits").select("id").eq("owner_id", uid).eq("slug", "main").single();
  return (data?.id as string | undefined) ?? null;
}

/** On sign-in: find which of my local items are already shared. */
export async function hydrateSharedState(localItems: ToolkitItem[]): Promise<void> {
  if (!supabase) return;
  const toolkitId = await myToolkitId();
  if (!toolkitId) return;
  const { data } = await supabase
    .from("toolkit_items")
    .select("id, path")
    .eq("toolkit_id", toolkitId)
    .is("deleted_at", null);
  if (!data) return;
  const byPath = new Map(data.map((r) => [r.path as string, r.id as string]));
  const flags = await syncFlagStore();
  const shared = new Map<string, SharedMeta>();
  for (const item of localItems) {
    const cloudItemId = byPath.get(item.path);
    if (!cloudItemId) continue;
    const syncOn = ((await flags?.get<boolean>(`sync:${item.id}`)) ?? true) as boolean;
    shared.set(item.id, { cloudItemId, syncOn, localAhead: false });
  }
  usePublish.setState({ shared });
}

/** Share toggle ON: create/revive the cloud item and push the current content. */
export async function shareItem(item: ToolkitItem, content: string): Promise<boolean> {
  if (!supabase || !navigator.onLine) return false;
  const uid = useSession.getState().session?.user.id;
  const toolkitId = await myToolkitId();
  if (!uid || !toolkitId) return false;
  setBusy(item.id, true);
  try {
    const { data: row, error } = await supabase
      .from("toolkit_items")
      .upsert(
        {
          toolkit_id: toolkitId,
          kind: item.kind,
          name: item.name,
          path: item.path,
          description: item.description,
          frontmatter: item.frontmatter,
          visibility: "public",
          deleted_at: null,
        },
        { onConflict: "toolkit_id,path" },
      )
      .select("id")
      .single();
    if (error || !row) return false;
    setMeta(item.id, { cloudItemId: row.id as string, syncOn: true, localAhead: false });
    await pushVersion(item, content);
    void broadcastActivity("publish");
    return true;
  } finally {
    setBusy(item.id, false);
  }
}

/** Share toggle OFF: soft-delete in the cloud (versions stay for history). */
export async function unshareItem(item: ToolkitItem): Promise<boolean> {
  if (!supabase) return false;
  const meta = usePublish.getState().shared.get(item.id);
  if (!meta) return true;
  setBusy(item.id, true);
  try {
    const { error } = await supabase
      .from("toolkit_items")
      .update({ deleted_at: new Date().toISOString(), visibility: "private" })
      .eq("id", meta.cloudItemId);
    if (error) return false;
    setMeta(item.id, null);
    return true;
  } finally {
    setBusy(item.id, false);
  }
}

/** Append a new version and move the current pointer. */
export async function pushVersion(item: ToolkitItem, content: string): Promise<boolean> {
  if (!supabase) return false;
  const uid = useSession.getState().session?.user.id;
  const meta = usePublish.getState().shared.get(item.id);
  if (!uid || !meta) return false;
  if (!navigator.onLine) {
    // keep the "local ahead" flag so the user can Push when back online
    setMeta(item.id, { ...meta, localAhead: true });
    return false;
  }
  setBusy(item.id, true);
  try {
    const hash = await sha256(content);
    // read-max-then-insert can race a concurrent push on unique(item_id, version);
    // on that collision, re-read the max and retry once
    let ver: { id: string } | null = null;
    for (let attempt = 0; attempt < 2 && !ver; attempt++) {
      const { data: last } = await supabase
        .from("item_versions")
        .select("version, content_hash")
        .eq("item_id", meta.cloudItemId)
        .order("version", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (last?.content_hash === hash) {
        setMeta(item.id, { ...meta, localAhead: false });
        return true; // nothing new
      }
      const nextVersion = ((last?.version as number | undefined) ?? 0) + 1;
      const { data, error } = await supabase
        .from("item_versions")
        .insert({
          item_id: meta.cloudItemId,
          version: nextVersion,
          content,
          content_hash: hash,
          author_id: uid,
        })
        .select("id")
        .single();
      if (data) ver = data as { id: string };
      else if (error?.code !== "23505") return false; // real failure; 23505 = duplicate version, retry
    }
    if (!ver) return false;
    await supabase
      .from("toolkit_items")
      .update({
        current_version_id: ver.id as string,
        name: item.name,
        description: item.description,
        frontmatter: item.frontmatter,
        updated_at: new Date().toISOString(),
      })
      .eq("id", meta.cloudItemId);
    setMeta(item.id, { ...meta, localAhead: false });
    void broadcastActivity("push");
    return true;
  } finally {
    setBusy(item.id, false);
  }
}

export async function setSync(localId: string, syncOn: boolean): Promise<void> {
  const meta = usePublish.getState().shared.get(localId);
  if (meta) setMeta(localId, { ...meta, syncOn });
  const flags = await syncFlagStore();
  await flags?.set(`sync:${localId}`, syncOn);
}

/** Called after local edits: auto-push (sync on) or mark local-ahead (sync off). */
export async function onLocalItemChanged(item: ToolkitItem, content: string): Promise<void> {
  const meta = usePublish.getState().shared.get(item.id);
  if (!meta) return;
  if (meta.syncOn) await pushVersion(item, content);
  else setMeta(item.id, { ...meta, localAhead: true });
}
