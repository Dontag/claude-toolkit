import { useEffect, useRef } from "react";
import type { ToolkitItem } from "@claude-toolkit/core";
import { SkillTreeScene, type SceneItem } from "../scene/scene";
import { useInventory } from "../stores/inventory";
import { useUi } from "../stores/ui";

const toSceneItem = (i: ToolkitItem): SceneItem => ({
  id: i.id,
  name: i.name,
  kind: i.kind,
  description: i.description,
  added: i.added,
});

/** Imperative bridge so header search etc. can drive the scene. */
export const sceneRef: { current: SkillTreeScene | null } = { current: null };

export function TreeView() {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const scene = new SkillTreeScene({
      onItemSelected: (item) => useUi.getState().select(item?.id ?? null),
    });
    scene.mount(el);
    sceneRef.current = scene;
    scene.setItems([...useInventory.getState().items.values()].map(toSceneItem));
    scene.setFreeNavigation(useUi.getState().freeNav);
    const unsub = useInventory.subscribe((state, prev) => {
      if (state.items === prev.items) return;
      scene.syncItems([...state.items.values()].map(toSceneItem));
    });
    const unsubNav = useUi.subscribe((s, p) => {
      if (s.freeNav !== p.freeNav) scene.setFreeNavigation(s.freeNav);
    });
    return () => {
      unsub();
      unsubNav();
      sceneRef.current = null;
      scene.dispose();
    };
  }, []);

  return <div ref={ref} className="absolute inset-0 cursor-grab" />;
}
