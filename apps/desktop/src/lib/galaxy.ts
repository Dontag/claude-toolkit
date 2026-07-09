// Galaxy data: everyone's public items grouped by owner, kept live over
// Supabase realtime; graft-a-fruit installs a shared item into ~/.claude.
import { create } from "zustand";
import type { ItemKind } from "@claude-toolkit/core";
import { supabase } from "./supabase";
import { broadcastActivity } from "./presence";
import { sourceState } from "../sources/bootstrap";

export interface GalaxyItem {
  id: string;
  kind: ItemKind;
  name: string;
  path: string;
  description: string;
  updatedAt: string;
  currentVersionId: string | null;
  ownerId: string;
  ownerHandle: string;
  ownerAvatar: string | null;
}

interface GalaxyState {
  items: GalaxyItem[];
  loading: boolean;
  error: string | null;
}

export const useGalaxy = create<GalaxyState>(() => ({ items: [], loading: false, error: null }));

interface ItemRow {
  id: string;
  kind: ItemKind;
  name: string;
  path: string;
  description: string;
  updated_at: string;
  current_version_id: string | null;
  toolkits: { owner_id: string; profiles: { handle: string; avatar_url: string | null } };
}

export async function fetchGalaxy(): Promise<void> {
  if (!supabase) return;
  useGalaxy.setState({ loading: true, error: null });
  const { data, error } = await supabase
    .from("toolkit_items")
    .select(
      "id, kind, name, path, description, updated_at, current_version_id, toolkits!inner(owner_id, profiles!inner(handle, avatar_url))",
    )
    .eq("visibility", "public")
    .is("deleted_at", null)
    .order("updated_at", { ascending: false })
    .limit(500);
  if (error) {
    useGalaxy.setState({ loading: false, error: error.message });
    return;
  }
  const items: GalaxyItem[] = ((data ?? []) as unknown as ItemRow[]).map((r) => ({
    id: r.id,
    kind: r.kind,
    name: r.name,
    path: r.path,
    description: r.description,
    updatedAt: r.updated_at,
    currentVersionId: r.current_version_id,
    ownerId: r.toolkits.owner_id,
    ownerHandle: r.toolkits.profiles.handle,
    ownerAvatar: r.toolkits.profiles.avatar_url,
  }));
  useGalaxy.setState({ items, loading: false });
}

let subscribed = false;
export function subscribeGalaxy(): void {
  if (!supabase || subscribed) return;
  subscribed = true;
  supabase
    .channel("galaxy-items")
    .on("postgres_changes", { event: "*", schema: "public", table: "toolkit_items" }, () => void fetchGalaxy())
    .subscribe();
}

export async function fetchItemContent(item: GalaxyItem): Promise<string | null> {
  if (!supabase) return null;
  const query = supabase.from("item_versions").select("content").eq("item_id", item.id);
  const { data } = item.currentVersionId
    ? await query.eq("id", item.currentVersionId).maybeSingle()
    : await query.order("version", { ascending: false }).limit(1).maybeSingle();
  return (data?.content as string | undefined) ?? null;
}

/** Graft a fruit: write the shared item's content into the local ~/.claude tree. */
export async function graftItem(item: GalaxyItem): Promise<"ok" | "no-local" | "no-content" | "error"> {
  const local = sourceState.local;
  if (!local) return "no-local";
  const content = await fetchItemContent(item);
  if (content === null) return "no-content";
  try {
    await local.writeNewFile(item.path, content);
    void broadcastActivity("graft");
    return "ok";
  } catch {
    return "error";
  }
}
