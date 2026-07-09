// SkillTreeScene — framework-free port of the dashboard's three.js skill tree
// (dashboard/index.html). DOM popups/panel are replaced by callbacks; data
// comes in via setItems/addItem/removeItem instead of window.SKILL_TREE_DATA.
import * as THREE from "three";
import type { ItemKind } from "@claude-toolkit/core";
import { GalaxyBackground } from "./galaxy";

export interface SceneItem {
  id: string;
  name: string;
  kind: ItemKind;
  description: string;
  added: string; // ISO date
}

export interface SceneCallbacks {
  onItemSelected?: (item: SceneItem | null) => void;
  onClusterFocused?: (kind: ItemKind | null) => void;
  onHover?: (item: SceneItem | null) => void;
}

const CATS: ItemKind[] = ["skill", "agent", "hook", "command"];
export const CAT_LABEL: Record<ItemKind, string> = {
  skill: "Skills",
  agent: "Agents",
  hook: "Hooks",
  command: "Commands",
};
export const CAT_COLOR: Record<ItemKind, number> = {
  skill: 0xff6b7a,
  agent: 0xffb057,
  hook: 0xa78bfa,
  command: 0x38d3e8,
};
const FOLIAGE: Record<ItemKind, number> = {
  skill: 0xff8f9e,
  agent: 0xffc38a,
  hook: 0xbfa8ff,
  command: 0x84e6f2,
};

const isNew = (n: SceneItem) => Date.now() - new Date(n.added).getTime() < 7 * 864e5;

function rand(seed: number) {
  let s = seed;
  return () => {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

interface Fruit {
  mesh: THREE.Mesh;
  node: SceneItem;
  halo: THREE.Sprite;
  phase: number;
  bornAt: number; // for grow-in animation (0 = pre-existing)
}

interface FallingFruit {
  mesh: THREE.Mesh;
  v: THREE.Vector3;
  av: THREE.Vector3;
  bounces: number;
  life: number;
}

export class SkillTreeScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private world = new THREE.Group();
  private container: HTMLElement | null = null;
  private raf = 0;
  private disposed = false;

  private items = new Map<string, SceneItem>();
  private fruits: Fruit[] = [];
  private fruitGroup = new THREE.Group();
  private falling: FallingFruit[] = [];
  private trunkCurve!: THREE.CatmullRomCurve3;
  private trunkMat!: THREE.MeshStandardMaterial;
  private canopy = new THREE.Group(); // branches + foliage + labels + hit spheres, rebuilt on change
  private clusterHit = new Map<ItemKind, THREE.Mesh[]>();
  private clusterLabels = new Map<ItemKind, THREE.Sprite>();
  /** Adaptive: each category holds sub-clusters of ≤SUB_CAP fruits; overflow grows a new branch. */
  private cluster!: Record<ItemKind, { center: THREE.Vector3; R: number; subs: Array<{ center: THREE.Vector3; R: number; count: number }> }>;
  private static readonly SUB_CAP = 10;
  private flies!: THREE.Points;
  private fliesBaseY!: Float32Array;
  private glowTex!: THREE.CanvasTexture;
  private galaxy!: GalaxyBackground;

  // camera state
  private theta = 0.8;
  private phi = 1.22;
  private dist = 17;
  private targetTheta = 0.8;
  private targetPhi = 1.22;
  private targetDist = 17;
  private lookCur = new THREE.Vector3(0, 4.4, 0);
  private lookTarget = new THREE.Vector3(0, 4.4, 0);
  private focusedCat: ItemKind | null = null;
  private freeNav = false;

  /** Center-lock off → drag pans, idle auto-spin stops (free navigation). */
  setFreeNavigation(on: boolean) {
    this.freeNav = on;
    if (!on) this.resetView();
  }

  // input state
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;
  private lastInteract = performance.now();
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-2, -2);
  private hovered: THREE.Object3D | null = null;
  private hoverLabel: THREE.Sprite | null = null;
  private flash: Fruit | null = null;
  private flashT = 0;
  private clock = new THREE.Clock();
  private cleanups: Array<() => void> = [];

  constructor(private cb: SceneCallbacks = {}) {}

  mount(el: HTMLElement) {
    this.container = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(this.renderer.domElement);

    this.scene.fog = new THREE.FogExp2(0x070a16, 0.016);
    this.camera = new THREE.PerspectiveCamera(46, el.clientWidth / el.clientHeight, 0.1, 300);
    this.scene.add(this.world);

    this.scene.add(new THREE.AmbientLight(0x6672b8, 0.35));
    const key = new THREE.DirectionalLight(0x9db4ff, 0.35);
    key.position.set(6, 14, 8);
    this.scene.add(key);
    const fill = new THREE.DirectionalLight(0x8f83ff, 0.2);
    fill.position.set(-8, 6, -6);
    this.scene.add(fill);

    this.galaxy = new GalaxyBackground();
    this.scene.add(this.galaxy.group);

    this.buildStatics();
    this.world.add(this.fruitGroup);
    this.world.add(this.canopy);
    this.rebuild();
    this.bindInput(el);
    this.animate();
  }

  /* ── Static geometry: mound, water, trunk, roots, fireflies ── */
  private static MOUND = { r: 6, sy: 0.5, cy: -3.0 };
  private groundY(x: number, z: number): number {
    const { r, sy, cy } = SkillTreeScene.MOUND;
    const d2 = x * x + z * z;
    const r2 = r * r;
    if (d2 >= r2) return -0.45;
    return Math.max(-0.45, cy + sy * Math.sqrt(r2 - d2));
  }

  private buildStatics() {
    const { r, sy, cy } = SkillTreeScene.MOUND;
    const moundMat = new THREE.MeshStandardMaterial({ color: 0x151b32, roughness: 1, metalness: 0 });
    const mound = new THREE.Mesh(new THREE.SphereGeometry(r, 48, 32), moundMat);
    mound.scale.set(1, sy, 1);
    mound.position.y = cy;
    this.world.add(mound);

    const water = new THREE.Mesh(
      new THREE.CircleGeometry(40, 64),
      new THREE.MeshBasicMaterial({ color: 0x0a0e1e, transparent: true, opacity: 0.9 }),
    );
    water.rotation.x = -Math.PI / 2;
    water.position.y = -0.45;
    this.world.add(water);

    const glowDisc = new THREE.Mesh(
      new THREE.CircleGeometry(7, 48),
      new THREE.MeshBasicMaterial({
        color: 0x2b3670,
        transparent: true,
        opacity: 0.35,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    glowDisc.rotation.x = -Math.PI / 2;
    glowDisc.position.y = -0.42;
    this.world.add(glowDisc);

    // fireflies
    const N = 110;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 22;
      pos[i * 3 + 1] = Math.random() * 10 + 0.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 22;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    this.flies = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        color: 0x9fdcff,
        size: 0.07,
        transparent: true,
        opacity: 0.7,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.fliesBaseY = pos.slice();
    this.world.add(this.flies);

    // trunk
    this.trunkMat = new THREE.MeshStandardMaterial({ color: 0x3a416b, roughness: 0.85, metalness: 0 });
    this.trunkCurve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(0, -0.1, 0),
      new THREE.Vector3(0.45, 1.0, 0.15),
      new THREE.Vector3(-0.35, 2.1, -0.2),
      new THREE.Vector3(0.35, 3.2, 0.25),
      new THREE.Vector3(-0.1, 4.3, -0.1),
      new THREE.Vector3(0.1, 5.2, 0.05),
    ]);
    (
      [
        [0, 0.45, 0.42],
        [0.33, 0.66, 0.3],
        [0.66, 1.0, 0.18],
      ] as const
    ).forEach(([a, b, radius]) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= 10; i++) pts.push(this.trunkCurve.getPoint(a + ((b - a) * i) / 10));
      this.world.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, radius, 9), this.trunkMat));
    });
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2 + 0.3;
      const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
      const rc = new THREE.QuadraticBezierCurve3(
        new THREE.Vector3(0, 0.5, 0),
        dir.clone().multiplyScalar(0.55).setY(0.15),
        dir
          .clone()
          .multiplyScalar(1.1 + Math.sin(i * 3.7) * 0.25)
          .setY(-0.35),
      );
      this.world.add(new THREE.Mesh(new THREE.TubeGeometry(rc, 8, 0.14 - (i % 2) * 0.04, 7), this.trunkMat));
    }

    // fruit glow sprite texture
    const c = document.createElement("canvas");
    c.width = c.height = 128;
    const x = c.getContext("2d")!;
    const grad = x.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, "rgba(255,255,255,0.9)");
    grad.addColorStop(0.35, "rgba(255,255,255,0.35)");
    grad.addColorStop(1, "rgba(255,255,255,0)");
    x.fillStyle = grad;
    x.fillRect(0, 0, 128, 128);
    this.glowTex = new THREE.CanvasTexture(c);
    this.glowTex.minFilter = THREE.LinearFilter;
  }

  /* ── Data API ── */
  setItems(items: SceneItem[]) {
    this.items = new Map(items.map((i) => [i.id, i]));
    this.rebuild();
  }

  addItem(item: SceneItem) {
    this.items.set(item.id, item);
    this.rebuild(item.id);
  }

  /** Diff against the current items: removed fruits fall, new ones grow in. */
  syncItems(next: SceneItem[]) {
    const nextMap = new Map(next.map((i) => [i.id, i]));
    for (const id of [...this.items.keys()]) if (!nextMap.has(id)) this.removeItem(id);
    for (const i of next) {
      if (!this.items.has(i.id)) this.addItem(i);
      else this.updateItem(i);
    }
  }

  updateItem(item: SceneItem) {
    this.items.set(item.id, item);
    const f = this.fruits.find((f) => f.node.id === item.id);
    if (f) f.node = item;
  }

  /** Remove with apple-fall physics, then rebuild the canopy sizes. */
  removeItem(id: string) {
    const item = this.items.get(id);
    if (!item) return;
    this.items.delete(id);
    const f = this.fruits.find((f) => f.node.id === id);
    if (f) {
      this.fruitGroup.remove(f.mesh);
      this.world.add(f.mesh);
      this.fruits.splice(this.fruits.indexOf(f), 1);
      this.falling.push({
        mesh: f.mesh,
        v: new THREE.Vector3((Math.random() - 0.5) * 0.8, 0, (Math.random() - 0.5) * 0.8),
        av: new THREE.Vector3(Math.random() * 4 - 2, Math.random() * 4 - 2, Math.random() * 4 - 2),
        bounces: 0,
        life: 0,
      });
    }
    // rebuild canopy after the fall starts so cluster sizes shrink
    this.rebuildCanopy();
    this.layoutFruits();
  }

  focusItem(id: string) {
    const f = this.fruits.find((f) => f.node.id === id);
    if (!f) return;
    this.focusCluster(f.node.kind);
    this.flash = f;
    this.flashT = performance.now();
    this.cb.onItemSelected?.(f.node);
  }

  focusCluster(kind: ItemKind) {
    this.focusedCat = kind;
    const c = this.cluster[kind];
    this.lookTarget.copy(c.center);
    this.targetDist = c.R * 3.2;
    this.targetPhi = 1.25;
    this.cb.onClusterFocused?.(kind);
  }

  resetView() {
    this.focusedCat = null;
    this.lookTarget.set(0, 4.4, 0);
    this.targetDist = 17;
    this.targetPhi = 1.22;
    this.cb.onClusterFocused?.(null);
  }

  /** Activity pulse: fire a comet now (realtime community events). */
  cometPulse(color?: number) {
    this.galaxy.spawnComet(color);
  }

  /** Presence-driven sky energy: more users online → livelier sky. */
  setActivity(level: number) {
    this.galaxy.setActivity(level);
  }

  /* ── Rebuild: canopy (branches/foliage/labels) + fruits ── */
  private catCount(c: ItemKind) {
    let n = 0;
    for (const it of this.items.values()) if (it.kind === c) n++;
    return n;
  }

  private computeClusters() {
    const CAP = SkillTreeScene.SUB_CAP;
    const BASE: Record<ItemKind, THREE.Vector3> = {
      skill: new THREE.Vector3(2.6, 6.4, 0.6),
      agent: new THREE.Vector3(-2.4, 6.0, 1.4),
      hook: new THREE.Vector3(-1.2, 7.4, -2.0),
      command: new THREE.Vector3(1.4, 5.2, -2.2),
    };
    const GOLDEN = 2.399963229728653;
    this.cluster = {} as typeof this.cluster;
    CATS.forEach((cat, ci) => {
      const count = this.catCount(cat);
      const nSubs = Math.max(1, Math.ceil(count / CAP));
      const subs: Array<{ center: THREE.Vector3; R: number; count: number }> = [];
      const base = BASE[cat];
      // outward direction so overflow branches grow away from the trunk
      const out = base.clone().setY(0).normalize();
      for (let s = 0; s < nSubs; s++) {
        const subCount = Math.max(1, Math.min(CAP, count - s * CAP));
        const R = Math.min(2.2, Math.max(1.0, 0.8 + 0.45 * Math.sqrt(subCount)));
        if (s === 0) {
          subs.push({ center: base.clone(), R, count: subCount });
        } else {
          // deterministic golden-angle ring around the parent, biased outward
          const ang = s * GOLDEN + ci * 1.7;
          const ring = new THREE.Vector3(Math.cos(ang), 0, Math.sin(ang));
          const dir = ring.multiplyScalar(0.8).add(out.clone().multiplyScalar(0.7)).normalize();
          const prev = subs[0]!;
          const center = prev.center
            .clone()
            .add(dir.multiplyScalar(prev.R + R * 0.85))
            .add(new THREE.Vector3(0, (s % 2 === 0 ? -0.5 : 0.7) + 0.2 * (s % 3), 0));
          subs.push({ center, R, count: subCount });
        }
      }
      // bounding radius over all subs → camera focus frames the whole family
      const c0 = subs[0]!.center;
      let bound = subs[0]!.R;
      for (const sub of subs) bound = Math.max(bound, c0.distanceTo(sub.center) + sub.R);
      this.cluster[cat] = { center: c0, R: bound, subs };
    });
  }

  private disposeGroup(group: THREE.Group) {
    while (group.children.length) {
      const m = group.children[0]!;
      m.traverse((o) => {
        const mesh = o as THREE.Mesh;
        if (mesh.geometry) mesh.geometry.dispose();
        const mat = mesh.material as THREE.Material & { map?: THREE.Texture };
        if (mat) {
          if (mat.map && mat.map !== this.glowTex) mat.map.dispose();
          mat.dispose();
        }
      });
      group.remove(m);
    }
  }

  private rebuildCanopy() {
    this.computeClusters();
    this.disposeGroup(this.canopy);
    this.clusterHit.clear();
    this.clusterLabels.clear();

    CATS.forEach((cat, ci) => {
      const { subs, R: boundR, center: mainCenter } = this.cluster[cat];
      const hits: THREE.Mesh[] = [];

      subs.forEach((sub, si) => {
        const { center, R, count } = sub;
        // sub 0 branches from the trunk; overflow sub-branches fork off the parent cluster
        const start = si === 0 ? this.trunkCurve.getPoint(0.55 + ci * 0.13) : subs[0]!.center.clone();
        const mid = start.clone().lerp(center, 0.5).add(new THREE.Vector3(0, si === 0 ? 0.6 : 0.35, 0));
        const bc = new THREE.QuadraticBezierCurve3(start, mid, center.clone().sub(new THREE.Vector3(0, R * 0.4, 0)));
        const branchR = Math.min(0.22, 0.08 + 0.015 * count) * (si === 0 ? 1 : 0.8);
        this.canopy.add(new THREE.Mesh(new THREE.TubeGeometry(bc, 16, branchR, 8), this.trunkMat));
        const rndT = rand(500 + ci * 31 + si * 17);
        for (let k = 0; k < (si === 0 ? 3 : 2); k++) {
          const p0 = bc.getPoint(0.35 + rndT() * 0.4);
          const tip = center
            .clone()
            .add(new THREE.Vector3((rndT() - 0.5) * R * 1.6, (rndT() - 0.3) * R, (rndT() - 0.5) * R * 1.6));
          const tc = new THREE.QuadraticBezierCurve3(p0, p0.clone().lerp(tip, 0.5).add(new THREE.Vector3(0, 0.25, 0)), tip);
          this.canopy.add(new THREE.Mesh(new THREE.TubeGeometry(tc, 8, 0.05, 6), this.trunkMat));
        }

        const rnd = rand(1000 + ci * 77 + si * 29);
        const blobs: Array<{ c: THREE.Vector3; r: number }> = [];
        const nb = 4 + Math.floor(rnd() * 2);
        for (let b = 0; b < nb; b++) {
          blobs.push({
            c: center.clone().add(new THREE.Vector3((rnd() - 0.5) * R * 1.4, (rnd() - 0.4) * R * 0.9, (rnd() - 0.5) * R * 1.4)),
            r: R * (0.45 + rnd() * 0.4),
          });
        }
        (
          [
            [1, 0.075, 0.35],
            [0.6, 0.055, 0.5],
            [0.35, 0.11, 0.18],
          ] as const
        ).forEach(([, size, op], li) => {
          const N = Math.round(280 + 420 * R);
          const pos = new Float32Array(N * 3);
          for (let i = 0; i < N; i++) {
            const b = blobs[Math.floor(rnd() * blobs.length)]!;
            const u = rnd() * 2 - 1;
            const th = rnd() * Math.PI * 2;
            const rr = b.r * Math.cbrt(rnd());
            const sq = Math.sqrt(1 - u * u);
            pos[i * 3] = b.c.x + rr * sq * Math.cos(th);
            pos[i * 3 + 1] = b.c.y + rr * u * 0.75;
            pos[i * 3 + 2] = b.c.z + rr * sq * Math.sin(th);
          }
          const g = new THREE.BufferGeometry();
          g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
          const base = new THREE.Color(FOLIAGE[cat]);
          const col = li === 1 ? base.clone().lerp(new THREE.Color(0xffffff), 0.45) : base;
          const m = new THREE.PointsMaterial({
            color: col,
            size,
            transparent: true,
            opacity: op,
            depthWrite: false,
            blending: THREE.AdditiveBlending,
          });
          const p = new THREE.Points(g, m);
          this.canopy.add(p);
        });

        const hit = new THREE.Mesh(new THREE.SphereGeometry(R * 1.05, 8, 6), new THREE.MeshBasicMaterial({ visible: false }));
        hit.position.copy(center);
        hit.userData.cat = cat;
        this.canopy.add(hit);
        hits.push(hit);

        const gl = new THREE.PointLight(FOLIAGE[cat], si === 0 ? 0.9 : 0.6, 7, 2);
        gl.position.copy(center);
        this.canopy.add(gl);
      });

      this.clusterHit.set(cat, hits);

      const lbl = this.makeLabel(
        subs.length > 1 ? `${CAT_LABEL[cat]} ×${subs.length}` : CAT_LABEL[cat],
        "#e7e9f4",
        "rgba(13,16,30,0.85)",
      );
      lbl.position.copy(mainCenter).add(new THREE.Vector3(0, boundR * 0.6 + 0.6, 0));
      lbl.material.opacity = 0.95;
      this.canopy.add(lbl);
      this.clusterLabels.set(cat, lbl);
    });
  }

  private layoutFruits(growId?: string) {
    this.disposeGroup(this.fruitGroup);
    this.fruits = [];
    const golden = Math.PI * (3 - Math.sqrt(5));
    const CAP = SkillTreeScene.SUB_CAP;
    CATS.forEach((cat) => {
      const items = [...this.items.values()].filter((n) => n.kind === cat);
      const { subs } = this.cluster[cat];
      items.forEach((node, gi) => {
        // sequential chunks of CAP → item #11 opens the second branch, and so on
        const sub = subs[Math.min(Math.floor(gi / CAP), subs.length - 1)]!;
        const { center, R } = sub;
        const i = gi % CAP;
        const t = (i + 0.5) / sub.count;
        const y = (1 - 2 * t) * 0.7;
        const rad = Math.sqrt(1 - y * y) * R * 0.85;
        const th = golden * i;
        const fp = center.clone().add(new THREE.Vector3(Math.cos(th) * rad, y * R * 0.8, Math.sin(th) * rad));
        const col = CAT_COLOR[cat];
        const mat = new THREE.MeshStandardMaterial({
          color: col,
          roughness: 0.3,
          metalness: 0.05,
          emissive: col,
          emissiveIntensity: isNew(node) ? 0.7 : 0.45,
          transparent: true,
        });
        const mesh = new THREE.Mesh(new THREE.SphereGeometry(0.26, 20, 16), mat);
        mesh.scale.y = 0.88;
        const stem = new THREE.Mesh(
          new THREE.CylinderGeometry(0.018, 0.03, 0.13, 6),
          new THREE.MeshStandardMaterial({ color: 0x5a4636, roughness: 0.9, transparent: true }),
        );
        stem.position.y = 0.3;
        stem.rotation.z = 0.15;
        mesh.add(stem);
        const leaf = new THREE.Mesh(
          new THREE.SphereGeometry(0.055, 8, 6),
          new THREE.MeshStandardMaterial({
            color: 0x5fae7d,
            emissive: 0x2f8f5d,
            emissiveIntensity: 0.5,
            roughness: 0.8,
            transparent: true,
          }),
        );
        leaf.scale.set(1.6, 0.45, 0.8);
        leaf.position.set(0.09, 0.33, 0);
        mesh.add(leaf);
        const halo = new THREE.Sprite(
          new THREE.SpriteMaterial({
            map: this.glowTex,
            color: col,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
          }),
        );
        halo.scale.set(1.1, 1.1, 1);
        mesh.add(halo);
        mesh.position.copy(fp);
        mesh.userData.node = node;
        this.fruitGroup.add(mesh);
        this.fruits.push({ mesh, node, halo, phase: Math.random() * Math.PI * 2, bornAt: node.id === growId ? performance.now() : 0 });
      });
    });
  }

  private rebuild(growId?: string) {
    this.rebuildCanopy();
    this.layoutFruits(growId);
  }

  /* ── Labels ── */
  private makeLabel(text: string, fg: string, bg: string, fontSize = 42): THREE.Sprite {
    const c = document.createElement("canvas");
    const x = c.getContext("2d")!;
    x.font = `600 ${fontSize}px Inter,system-ui,sans-serif`;
    const w = Math.ceil(x.measureText(text).width) + 40;
    c.width = w;
    c.height = fontSize + 28;
    x.font = `600 ${fontSize}px Inter,system-ui,sans-serif`;
    x.fillStyle = bg;
    const r = c.height / 2;
    x.beginPath();
    x.moveTo(r, 0);
    x.lineTo(w - r, 0);
    x.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2);
    x.lineTo(r, c.height);
    x.arc(r, r, r, Math.PI / 2, Math.PI * 1.5);
    x.fill();
    x.fillStyle = fg;
    x.textBaseline = "middle";
    x.fillText(text, 20, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.scale.set(w / 120, c.height / 120, 1);
    return s;
  }

  /* ── Input ── */
  private bindInput(el: HTMLElement) {
    const ptrs = new Map<number, [number, number]>();
    let pinchDist = 0;
    const ROT = 0.006;

    let panning = false;
    const onDown = (e: PointerEvent) => {
      ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      panning = this.freeNav && (e.button === 2 || e.shiftKey);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        pinchDist = Math.hypot(a![0] - b![0], a![1] - b![1]);
        this.dragging = false;
      } else this.dragging = !panning;
      this.lastX = this.downX = e.clientX;
      this.lastY = this.downY = e.clientY;
      this.lastInteract = performance.now();
    };
    const onMove = (e: PointerEvent) => {
      if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, [e.clientX, e.clientY]);
      if (ptrs.size === 2) {
        const [a, b] = [...ptrs.values()];
        const d = Math.hypot(a![0] - b![0], a![1] - b![1]);
        if (pinchDist > 0 && d > 0) this.targetDist = Math.min(38, Math.max(3.2, this.targetDist * (pinchDist / d)));
        pinchDist = d;
        this.lastInteract = performance.now();
      } else if (panning) {
        // free-nav: pan the look target across the view plane
        const dx = (e.clientX - this.lastX) * this.dist * 0.0016;
        const dy = (e.clientY - this.lastY) * this.dist * 0.0016;
        const right = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 0);
        const up = new THREE.Vector3().setFromMatrixColumn(this.camera.matrix, 1);
        this.lookTarget.addScaledVector(right, -dx).addScaledVector(up, dy);
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastInteract = performance.now();
      } else if (this.dragging) {
        this.targetTheta += (e.clientX - this.lastX) * ROT;
        this.targetPhi = Math.min(1.5, Math.max(0.35, this.targetPhi + (e.clientY - this.lastY) * 0.004));
        this.lastX = e.clientX;
        this.lastY = e.clientY;
        this.lastInteract = performance.now();
      }
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onUp = (e: PointerEvent) => {
      ptrs.delete(e.pointerId);
      if (ptrs.size < 2) pinchDist = 0;
      if (!ptrs.size) {
        this.dragging = false;
        panning = false;
      }
    };
    const onContext = (e: Event) => this.freeNav && e.preventDefault();
    const onWheel = (e: WheelEvent) => {
      this.targetDist = Math.min(38, Math.max(3.2, this.targetDist + e.deltaY * 0.012));
      this.lastInteract = performance.now();
    };
    const onClick = (e: MouseEvent) => {
      if (Math.abs(e.clientX - this.downX) > 4 || Math.abs(e.clientY - this.downY) > 4) return;
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
      this.ray.setFromCamera(this.mouse, this.camera);
      const fhits = this.ray.intersectObjects(this.fruitGroup.children, true);
      if (fhits.length) {
        let obj: THREE.Object3D | null = fhits[0]!.object;
        while (obj && !obj.userData.node) obj = obj.parent;
        if (obj) {
          this.cb.onItemSelected?.(obj.userData.node as SceneItem);
          return;
        }
      }
      const chits = this.ray.intersectObjects([...this.clusterHit.values()].flat());
      if (chits.length) {
        this.cb.onItemSelected?.(null);
        this.focusCluster(chits[0]!.object.userData.cat as ItemKind);
        return;
      }
      this.cb.onItemSelected?.(null);
    };
    const onDblClick = () => this.resetView();
    const onResize = () => {
      if (!this.container) return;
      const w = this.container.clientWidth;
      const h = this.container.clientHeight;
      this.camera.aspect = w / h;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(w, h);
    };

    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    window.addEventListener("pointercancel", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("click", onClick);
    el.addEventListener("dblclick", onDblClick);
    el.addEventListener("contextmenu", onContext);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    this.cleanups.push(() => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      window.removeEventListener("pointercancel", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
      el.removeEventListener("contextmenu", onContext);
      el.removeEventListener("dblclick", onDblClick);
      ro.disconnect();
    });
  }

  /* ── Physics + hover + animate ── */
  private stepPhysics(dt: number) {
    for (let i = this.falling.length - 1; i >= 0; i--) {
      const o = this.falling[i]!;
      o.life += dt;
      o.v.y -= 14 * dt;
      o.mesh.position.addScaledVector(o.v, dt);
      o.mesh.rotation.x += o.av.x * dt;
      o.mesh.rotation.y += o.av.y * dt;
      o.mesh.rotation.z += o.av.z * dt;
      const gy = this.groundY(o.mesh.position.x, o.mesh.position.z) + 0.24;
      if (o.mesh.position.y < gy && o.v.y < 0) {
        o.mesh.position.y = gy;
        o.v.y *= -0.48;
        o.v.x *= 0.75;
        o.v.z *= 0.75;
        o.av.multiplyScalar(0.6);
        o.bounces++;
      }
      const mat = o.mesh.material as THREE.MeshStandardMaterial;
      if (o.bounces >= 2 || o.life > 3) {
        const fade = mat.opacity - dt * 1.8;
        o.mesh.traverse((m) => {
          const mm = (m as THREE.Mesh).material as THREE.Material | undefined;
          if (mm) mm.opacity = Math.max(0, fade);
        });
        o.mesh.scale.multiplyScalar(1 - dt * 0.6);
        if (mat.opacity <= 0) {
          this.world.remove(o.mesh);
          o.mesh.geometry.dispose();
          mat.dispose();
          this.falling.splice(i, 1);
        }
      }
    }
  }

  private updateHover() {
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.fruitGroup.children, true);
    let hit: THREE.Object3D | null = hits.length ? hits[0]!.object : null;
    while (hit && !hit.userData.node) hit = hit.parent;
    if (hit !== this.hovered) {
      this.hovered = hit;
      if (this.container) this.container.style.cursor = hit ? "pointer" : "grab";
      if (this.hoverLabel) {
        this.world.remove(this.hoverLabel);
        this.hoverLabel.material.map?.dispose();
        this.hoverLabel.material.dispose();
        this.hoverLabel = null;
      }
      if (hit) {
        const node = hit.userData.node as SceneItem;
        this.hoverLabel = this.makeLabel(node.name, "#e7e9f4", "rgba(13,16,30,0.9)");
        this.hoverLabel.position.copy((hit as THREE.Mesh).position).add(new THREE.Vector3(0, 0.5, 0));
        this.world.add(this.hoverLabel);
        this.cb.onHover?.(node);
      } else {
        this.cb.onHover?.(null);
      }
    }
  }

  private applyCamera() {
    this.theta += (this.targetTheta - this.theta) * 0.07;
    this.phi += (this.targetPhi - this.phi) * 0.07;
    this.dist += (this.targetDist - this.dist) * 0.07;
    this.lookCur.lerp(this.lookTarget, 0.07);
    this.camera.position.set(
      this.lookCur.x + this.dist * Math.sin(this.phi) * Math.cos(this.theta),
      this.lookCur.y + this.dist * Math.cos(this.phi),
      this.lookCur.z + this.dist * Math.sin(this.phi) * Math.sin(this.theta),
    );
    this.camera.lookAt(this.lookCur);
  }

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    if (!this.dragging && !this.freeNav && performance.now() - this.lastInteract > 3500 && !this.focusedCat)
      this.targetTheta += 0.1 * dt;
    this.applyCamera();

    const now = performance.now();
    for (const f of this.fruits) {
      f.mesh.position.y += Math.sin(t * 1.3 + f.phase) * 0.0009;
      const flash = this.flash === f && now - this.flashT < 2500;
      // grow-in: newborn fruits scale from 0 over 700ms with a soft overshoot
      let grow = 1;
      if (f.bornAt) {
        const g = Math.min(1, (now - f.bornAt) / 700);
        grow = g < 1 ? 1 - Math.pow(1 - g, 3) * 1.0 + Math.sin(g * Math.PI) * 0.15 : 1;
        if (g >= 1) f.bornAt = 0;
      }
      const s = (this.hovered === f.mesh ? 1.35 : flash ? 1.7 : 1) * grow;
      f.mesh.scale.lerp(new THREE.Vector3(s, s * 0.88, s), 0.18);
      f.halo.material.opacity = 0.45 + 0.15 * Math.sin(t * 2 + f.phase) + (this.hovered === f.mesh || flash ? 0.3 : 0);
      (f.mesh.material as THREE.MeshStandardMaterial).emissiveIntensity =
        (isNew(f.node) ? 0.65 : 0.4) + 0.15 * Math.sin(t * 3 + f.phase);
    }
    for (const cat of CATS) {
      const lbl = this.clusterLabels.get(cat);
      if (!lbl) continue;
      const want = this.focusedCat && this.focusedCat !== cat ? 0.15 : 0.95;
      lbl.material.opacity += (want - lbl.material.opacity) * 0.08;
    }
    const fa = this.flies.geometry.attributes.position as THREE.BufferAttribute;
    for (let i = 0; i < fa.count; i++) fa.setY(i, this.fliesBaseY[i * 3 + 1]! + Math.sin(t * 0.7 + i) * 0.35);
    fa.needsUpdate = true;

    this.galaxy.step(dt, t);
    this.stepPhysics(dt);
    this.updateHover();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanups) c();
    this.galaxy.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
