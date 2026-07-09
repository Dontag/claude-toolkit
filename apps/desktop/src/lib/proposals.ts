// Phase 4 propose-and-approve: a grantee's edit becomes a pending proposal the
// owner must approve. Approval replaces the item's current version AND, if the
// owner has that item locally, rewrites the local file so the tree updates.
import { create } from "zustand";
import { supabase } from "./supabase";
import { useSession } from "../stores/session";
import { sourceState } from "../sources/bootstrap";
import { usePublish } from "./publish";

export interface Proposal {
  id: string;
  itemId: string;
  proposerId: string;
  content: string;
  status: "pending" | "approved" | "rejected" | "superseded";
  createdAt: string;
  proposerHandle?: string;
  itemName?: string;
  itemPath?: string;
}

interface ProposalState {
  pendingForMe: Proposal[]; // proposals awaiting my approval (I'm the owner)
}
export const useProposals = create<ProposalState>(() => ({ pendingForMe: [] }));

/** Grantee (or owner) submits an edit as a proposal. Empty content is rejected. */
export async function proposeChange(cloudItemId: string, content: string): Promise<"ok" | "empty" | "error"> {
  if (!supabase) return "error";
  if (!content.trim()) return "empty";
  const { error } = await supabase.rpc("propose_item_change", { p_item: cloudItemId, p_content: content });
  return error ? "error" : "ok";
}

/** Owner approves → new current version; also rewrite the local file if present. */
export async function approveProposal(p: Proposal): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("approve_proposal", { p_proposal: p.id });
  if (error) return false;
  // if this shared item maps to a local file, replace it so the tree updates
  const local = sourceState.local;
  if (local && p.itemPath) {
    const localItem = [...usePublish.getState().shared.entries()].find(([, m]) => m.cloudItemId === p.itemId);
    if (localItem) {
      try {
        // write by path; the watcher will reconcile the tree
        await local.writeNewFile(p.itemPath, p.content);
      } catch {
        /* file may have moved; cloud is still updated */
      }
    }
  }
  await refreshProposals();
  return true;
}

export async function rejectProposal(id: string): Promise<boolean> {
  if (!supabase) return false;
  const { error } = await supabase.rpc("reject_proposal", { p_proposal: id });
  if (!error) await refreshProposals();
  return !error;
}

/** Load proposals pending my approval (items I own). */
export async function refreshProposals(): Promise<void> {
  if (!supabase) return;
  const uid = useSession.getState().session?.user.id;
  if (!uid) return;
  const { data } = await supabase
    .from("item_proposals")
    .select(
      "id, item_id, proposer_id, content, status, created_at, profiles!item_proposals_proposer_id_fkey(handle), toolkit_items!inner(name, path, toolkits!inner(owner_id))",
    )
    .eq("status", "pending")
    .order("created_at", { ascending: false });
  const mine = ((data ?? []) as Array<Record<string, unknown>>)
    .filter((r) => {
      const ti = r.toolkit_items as { toolkits: { owner_id: string } };
      return ti?.toolkits?.owner_id === uid;
    })
    .map((r): Proposal => {
      const ti = r.toolkit_items as { name: string; path: string };
      return {
        id: r.id as string,
        itemId: r.item_id as string,
        proposerId: r.proposer_id as string,
        content: r.content as string,
        status: r.status as Proposal["status"],
        createdAt: r.created_at as string,
        proposerHandle: (r.profiles as { handle?: string } | null)?.handle,
        itemName: ti?.name,
        itemPath: ti?.path,
      };
    });
  useProposals.setState({ pendingForMe: mine });
}

let subscribed = false;
export function subscribeProposals(): void {
  if (!supabase || subscribed) return;
  subscribed = true;
  supabase
    .channel("proposals")
    .on("postgres_changes", { event: "*", schema: "public", table: "item_proposals" }, () => void refreshProposals())
    .subscribe();
}
