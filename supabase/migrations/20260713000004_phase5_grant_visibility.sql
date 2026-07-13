-- Phase 5: make live write-locks visible to everyone.
--
-- Until now access_grants was readable only by the grantee, the granting owner,
-- and admins ("see grants involving me"). That meant a third user browsing the
-- Galaxy had no way to tell an item was already being edited — they'd request a
-- window and the owner's grant would just fail with "already under a grant".
--
-- This policy is ADDITIVE (RLS SELECT policies are OR'd): it exposes ONLY the
-- currently LIVE grants (not revoked, not expired). Historical/expired grant
-- rows stay private. A live grant reveals who holds the lock (grantee_id) and
-- until when (expires_at) — exactly what a viewer needs to see "🔒 @user is
-- editing — 27:14 left".
create policy "anyone sees live grants" on public.access_grants
  for select using (revoked_at is null and now() < expires_at);
