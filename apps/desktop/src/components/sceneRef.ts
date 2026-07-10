import type { SkillTreeScene } from "../scene/scene";

/** Imperative handle to the Personal-tree scene, in its own tiny module so the
 * header/search can drive the scene WITHOUT statically importing TreeView —
 * that lets TreeView (and the whole three.js tree) lazy-load, so web/mobile
 * (Galaxy-only) never pays for the tree it doesn't show. Type-only import
 * above is erased, so this file pulls in no runtime code. */
export const sceneRef: { current: SkillTreeScene | null } = { current: null };
