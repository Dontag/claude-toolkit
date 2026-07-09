// GalaxyScene — the shared universe as a spiral dust galaxy.
//   • backdrop: a rotating spiral dust disc (warm core → cyan arms, ref image 1)
//   • each user = a solar system placed along a spiral arm: a glowing star with
//     a corona, planets on tilted orbits, and a dust halo around each planet
//   • each planet = a published item (color by kind); the swirling dust around
//     it is the "matter" of that skill/hook/agent/command
//   • nebula billboards + comets give the magenta sci-fi mood (ref image 2)
// Public API is unchanged (mount/setItems/setActivity/cometPulse/dispose).
import * as THREE from "three";
import type { GalaxyItem } from "../lib/galaxy";
import { userColor } from "../lib/presence";
import { GalaxyBackground } from "./galaxy";
import { CAT_COLOR } from "./scene";

interface Planet {
  mesh: THREE.Mesh;
  rim: THREE.Sprite;
  dust: THREE.Points;
  orbit: number;
  angle: number;
  speed: number;
  tilt: number;
  item: GalaxyItem;
  born: number; // performance.now() when it first appeared, 0 once grown in
}

interface System {
  ownerId: string;
  group: THREE.Group;
  star: THREE.Sprite;
  corona: THREE.Sprite;
  planets: Planet[];
  spin: number;
  born: number;
}

export interface GalaxySceneCallbacks {
  onItemSelected?: (item: GalaxyItem | null) => void;
  onHover?: (item: GalaxyItem | null) => void;
  /** screen coords of the hovered planet each frame (null when nothing hovered) */
  onReticle?: (p: { x: number; y: number } | null) => void;
}

function radialTexture(inner: number, mid: number): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, `rgba(255,255,255,${inner})`);
  g.addColorStop(0.3, `rgba(255,255,255,${mid})`);
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

const gauss = () => (Math.random() + Math.random() + Math.random() - 1.5) / 1.5;

/**
 * Procedural planet surface (ref image 2): a dark globe lit on one limb with
 * glowing nebula veins/filaments in a hot version of the kind color. Seeded so
 * each item's planet is stable across renders. Returns {map, emissive} — the
 * emissive canvas holds only the glowing veins so they self-illuminate.
 */
function planetTextures(kindColor: number, seed: number): { map: THREE.CanvasTexture; emissive: THREE.CanvasTexture } {
  const S = 256;
  let s = seed || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  const base = new THREE.Color(kindColor);
  const hot = base.clone().lerp(new THREE.Color(0xffffff), 0.5);
  const dark = base.clone().multiplyScalar(0.12);

  // ── surface map: dark body + terminator shading + faint mottling ──
  const mc = document.createElement("canvas");
  mc.width = mc.height = S;
  const m = mc.getContext("2d")!;
  m.fillStyle = `rgb(${(dark.r * 255) | 0},${(dark.g * 255) | 0},${(dark.b * 255) | 0})`;
  m.fillRect(0, 0, S, S);
  // lit limb (day side) — a soft gradient across the sphere's u
  const lg = m.createLinearGradient(0, 0, S, 0);
  lg.addColorStop(0, "rgba(255,255,255,0)");
  lg.addColorStop(0.65, `rgba(${(base.r * 255) | 0},${(base.g * 255) | 0},${(base.b * 255) | 0},0.25)`);
  lg.addColorStop(1, `rgba(${(hot.r * 255) | 0},${(hot.g * 255) | 0},${(hot.b * 255) | 0},0.4)`);
  m.fillStyle = lg;
  m.fillRect(0, 0, S, S);
  // mottled cloud bands
  m.globalCompositeOperation = "lighter";
  for (let i = 0; i < 40; i++) {
    const cx = rnd() * S;
    const cy = rnd() * S;
    const r = 8 + rnd() * 40;
    const g = m.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${(base.r * 255) | 0},${(base.g * 255) | 0},${(base.b * 255) | 0},${0.04 + rnd() * 0.06})`);
    g.addColorStop(1, "rgba(0,0,0,0)");
    m.fillStyle = g;
    m.beginPath();
    m.arc(cx, cy, r, 0, Math.PI * 2);
    m.fill();
  }

  // ── emissive map: glowing veins/filaments only (black elsewhere) ──
  const ec = document.createElement("canvas");
  ec.width = ec.height = S;
  const e = ec.getContext("2d")!;
  e.fillStyle = "#000";
  e.fillRect(0, 0, S, S);
  e.globalCompositeOperation = "lighter";
  e.lineCap = "round";
  const veinColor = `rgb(${(hot.r * 255) | 0},${(hot.g * 255) | 0},${(hot.b * 255) | 0})`;
  const branches = 5 + Math.floor(rnd() * 6);
  for (let b = 0; b < branches; b++) {
    let px = rnd() * S;
    let py = rnd() * S;
    let ang = rnd() * Math.PI * 2;
    const segs = 6 + Math.floor(rnd() * 10);
    e.strokeStyle = veinColor;
    e.shadowColor = veinColor;
    for (let k = 0; k < segs; k++) {
      ang += (rnd() - 0.5) * 1.1;
      const len = 6 + rnd() * 20;
      const nx = px + Math.cos(ang) * len;
      const ny = py + Math.sin(ang) * len;
      e.globalAlpha = 0.5 + rnd() * 0.5;
      e.lineWidth = 0.6 + rnd() * 1.6;
      e.shadowBlur = 6 + rnd() * 8;
      e.beginPath();
      e.moveTo(px, py);
      e.lineTo(nx, ny);
      e.stroke();
      px = nx;
      py = ny;
    }
  }
  // a hot glowing core patch, like image 2's red bloom
  e.globalAlpha = 1;
  const cx = S * (0.35 + rnd() * 0.3);
  const cy = S * (0.35 + rnd() * 0.3);
  const cr = 20 + rnd() * 40;
  const cg = e.createRadialGradient(cx, cy, 0, cx, cy, cr);
  cg.addColorStop(0, veinColor);
  cg.addColorStop(0.5, `rgba(${(hot.r * 255) | 0},${(hot.g * 255) | 0},${(hot.b * 255) | 0},0.3)`);
  cg.addColorStop(1, "rgba(0,0,0,0)");
  e.fillStyle = cg;
  e.beginPath();
  e.arc(cx, cy, cr, 0, Math.PI * 2);
  e.fill();

  const map = new THREE.CanvasTexture(mc);
  const emissive = new THREE.CanvasTexture(ec);
  map.minFilter = emissive.minFilter = THREE.LinearFilter;
  return { map, emissive };
}

let seedCounter = 1;

export class GalaxyScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private world = new THREE.Group();
  private background = new GalaxyBackground();
  private disc!: THREE.Points;
  private systems: System[] = [];
  private knownOwners = new Set<string>(); // for grow-in of newly-appeared systems
  private knownItems = new Set<string>(); // …and newly-appeared planets
  private planetTexes: THREE.Texture[] = []; // generated per-planet surface textures
  private glowTex = radialTexture(0.95, 0.4);
  private softTex = radialTexture(0.6, 0.25);
  private container: HTMLElement | null = null;
  private raf = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  private theta = 0.6;
  private phi = 1.1;
  private dist = 34;
  private targetTheta = 0.6;
  private targetPhi = 1.1;
  private targetDist = 34;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-2, -2);
  private hovered: Planet | null = null;
  private cleanups: Array<() => void> = [];

  constructor(private cb: GalaxySceneCallbacks = {}) {}

  mount(el: HTMLElement) {
    this.container = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 600);
    this.scene.fog = new THREE.FogExp2(0x05030f, 0.004);
    this.scene.add(new THREE.AmbientLight(0x8890c8, 0.5));
    this.scene.add(this.background.group);
    this.scene.add(this.world);
    this.buildDisc();
    this.buildNebulae();
    this.bindInput(el);
    this.animate();
  }

  setActivity(level: number) {
    this.background.setActivity(level);
  }
  cometPulse(color?: number) {
    this.background.spawnComet(color);
  }

  /* ── Backdrop: spiral dust galaxy (warm core, cyan arms) ── */
  private buildDisc() {
    const N = 9000;
    const arms = 3;
    const maxR = 120;
    const twist = 3.4;
    const pos = new Float32Array(N * 3);
    const col = new Float32Array(N * 3);
    const core = new THREE.Color(0xffb066);
    const mid = new THREE.Color(0xff7a3c);
    const edge = new THREE.Color(0x39d0e6);
    for (let i = 0; i < N; i++) {
      const r = Math.pow(Math.random(), 0.55) * maxR;
      const arm = Math.floor(Math.random() * arms);
      const angle = (arm / arms) * Math.PI * 2 + (r / maxR) * twist * Math.PI * 2 + gauss() * 0.35;
      const jitter = gauss() * (2 + (r / maxR) * 10);
      pos[i * 3] = Math.cos(angle) * r + jitter;
      pos[i * 3 + 1] = gauss() * (6 * (1 - r / maxR) + 1.2); // thin disc, thicker core
      pos[i * 3 + 2] = Math.sin(angle) * r + jitter;
      const tRad = r / maxR;
      const c = tRad < 0.35 ? core.clone().lerp(mid, tRad / 0.35) : mid.clone().lerp(edge, (tRad - 0.35) / 0.65);
      // brighten the very core
      const b = tRad < 0.12 ? 1.4 : 1;
      col[i * 3] = Math.min(1, c.r * b);
      col[i * 3 + 1] = Math.min(1, c.g * b);
      col[i * 3 + 2] = Math.min(1, c.b * b);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    g.setAttribute("color", new THREE.BufferAttribute(col, 3));
    this.disc = new THREE.Points(
      g,
      new THREE.PointsMaterial({
        size: 0.7,
        map: this.softTex,
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        sizeAttenuation: true,
      }),
    );
    this.disc.position.y = -4;
    this.world.add(this.disc);

    // a warm glow sprite sitting in the galactic core
    const coreGlow = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.glowTex,
        color: 0xffa860,
        transparent: true,
        opacity: 0.5,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    coreGlow.scale.set(48, 48, 1);
    coreGlow.position.y = -3;
    this.world.add(coreGlow);
  }

  private buildNebulae() {
    const tints = [0x7b2ff0, 0xb02897, 0x2f6fe0, 0xff5a3c];
    for (let i = 0; i < 7; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.softTex,
          color: tints[i % tints.length],
          transparent: true,
          opacity: 0.12,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      const a = (i / 7) * Math.PI * 2;
      const r = 45 + (i % 3) * 30;
      s.position.set(Math.cos(a) * r, 8 + gauss() * 20, Math.sin(a) * r);
      const size = 60 + (i % 4) * 30;
      s.scale.set(size, size * 0.7, 1);
      this.world.add(s);
    }
  }

  /* ── Solar systems ── */
  setItems(items: GalaxyItem[]) {
    for (const s of this.systems) {
      this.world.remove(s.group);
      s.group.traverse((o) => {
        const m = o as THREE.Mesh;
        if (m.geometry) m.geometry.dispose();
        if (m.material) (m.material as THREE.Material).dispose();
      });
    }
    // dispose only the per-planet generated textures (shared star/rim textures live on)
    for (const tx of this.planetTexes) tx.dispose();
    this.planetTexes = [];
    this.systems = [];

    const owners = new Map<string, GalaxyItem[]>();
    for (const it of items) {
      if (!owners.has(it.ownerId)) owners.set(it.ownerId, []);
      owners.get(it.ownerId)!.push(it);
    }
    const n = owners.size;
    const now = performance.now();
    let idx = 0;
    for (const [ownerId, ownerItems] of owners) {
      const group = new THREE.Group();
      // place systems along a spiral arm of the galaxy
      const ang = idx * 2.399963 + 0.6;
      const rad = n === 1 ? 0 : 10 + Math.sqrt(idx) * 9;
      group.position.set(Math.cos(ang) * rad, 1.5 + Math.sin(idx * 1.3) * 4, Math.sin(ang) * rad);
      const col = userColor(ownerId);
      // new system → grow in from nothing
      const sysBorn = this.knownOwners.has(ownerId) ? 0 : now;
      if (sysBorn) group.scale.setScalar(0.01);

      // star: bright core sprite + soft corona + light
      const star = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.glowTex, color: col, transparent: true, opacity: 1, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      star.scale.set(3.4, 3.4, 1);
      const corona = new THREE.Sprite(
        new THREE.SpriteMaterial({ map: this.softTex, color: col, transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending, depthWrite: false }),
      );
      corona.scale.set(9, 9, 1);
      group.add(corona, star);
      group.add(new THREE.PointLight(col, 1.4, 26, 2));

      const label = this.makeLabel(`@${ownerItems[0]!.ownerHandle}`, col);
      label.position.set(0, 3.4, 0);
      group.add(label);

      // Group items by kind into orbital lanes: each kind gets one ring, and
      // multiple items of that kind (e.g. several hooks) share the ring, spaced
      // evenly around it. Lanes are ordered skills→agents→hooks→commands so a
      // system's structure reads consistently across users.
      const KIND_ORDER: Array<Planet["item"]["kind"]> = ["skill", "agent", "hook", "command"];
      const planets: Planet[] = [];
      let lane = 0;
      for (const kind of KIND_ORDER) {
        const kindItems = ownerItems.filter((it) => it.kind === kind);
        if (!kindItems.length) continue;
        const orbit = 2.4 + lane * 1.5; // one radius per populated kind
        const tilt = lane * 0.32 - 0.4;
        const roll = (lane % 2) * 0.22;
        const kc = CAT_COLOR[kind];

        // the shared lane ring (drawn once per kind)
        const holder = new THREE.Group();
        holder.rotation.set(tilt, 0, roll);
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(orbit, 0.012, 6, 96),
          new THREE.MeshBasicMaterial({ color: kc, transparent: true, opacity: 0.14, blending: THREE.AdditiveBlending, depthWrite: false }),
        );
        ring.rotation.x = Math.PI / 2;
        holder.add(ring);
        group.add(holder);

        // planets of this kind spaced around the shared lane; size tapers a
        // little as a lane gets crowded so many hooks still fit cleanly
        const size = Math.max(0.22, 0.36 - kindItems.length * 0.012);
        kindItems.forEach((item, j) => {
          const angle = (j / kindItems.length) * Math.PI * 2 + lane * 0.7;
          // stable per-item seed → ~65% of bodies get a detailed nebula-lit
          // surface (ref image 2); the rest stay as clean glowing orbs
          let hseed = 0;
          for (let k = 0; k < item.id.length; k++) hseed = (hseed * 31 + item.id.charCodeAt(k)) >>> 0;
          const detailed = hseed % 100 < 65;
          const mat = new THREE.MeshStandardMaterial({
            color: detailed ? 0xffffff : kc,
            emissive: kc,
            emissiveIntensity: detailed ? 0.9 : 0.5,
            roughness: 0.55,
            metalness: 0.1,
          });
          if (detailed) {
            const tex = planetTextures(kc, hseed || ++seedCounter);
            mat.map = tex.map;
            mat.emissiveMap = tex.emissive;
            this.planetTexes.push(tex.map, tex.emissive);
          }
          const planet = new THREE.Mesh(new THREE.SphereGeometry(size, 24, 18), mat);
          planet.rotation.y = (hseed % 628) / 100;
          planet.userData.item = item;
          const rim = new THREE.Sprite(
            new THREE.SpriteMaterial({ map: this.glowTex, color: kc, transparent: true, opacity: 0.6, blending: THREE.AdditiveBlending, depthWrite: false }),
          );
          rim.scale.set(size * 4.4, size * 4.4, 1);
          planet.add(rim);
          const dust = this.makeDust(kc);
          planet.add(dust);
          holder.add(planet);

          const planetBorn = this.knownItems.has(item.id) ? 0 : now;
          if (planetBorn) planet.scale.setScalar(0.01);
          // slight per-planet speed variance so a crowded lane doesn't look rigid
          planets.push({ mesh: planet, rim, dust, orbit, angle, speed: 0.14 + (j % 4) * 0.04, tilt, item, born: planetBorn });
        });
        lane++;
      }

      this.world.add(group);
      this.systems.push({ ownerId, group, star, corona, planets, spin: 0.03 + (idx % 5) * 0.01, born: sysBorn });
      idx++;
    }
    // remember what exists now so the next update only grows in truly-new things
    this.knownOwners = new Set(owners.keys());
    this.knownItems = new Set(items.map((i) => i.id));
    // the galaxy frames itself as it grows
    this.targetDist = Math.max(20, 16 + Math.sqrt(n) * 8);
  }

  private makeDust(color: number): THREE.Points {
    const N = 120;
    const pos = new Float32Array(N * 3);
    for (let i = 0; i < N; i++) {
      // flattened ring cloud around the planet
      const r = 0.5 + Math.random() * 0.5;
      const a = Math.random() * Math.PI * 2;
      pos[i * 3] = Math.cos(a) * r;
      pos[i * 3 + 1] = gauss() * 0.12;
      pos[i * 3 + 2] = Math.sin(a) * r;
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
    return new THREE.Points(
      g,
      new THREE.PointsMaterial({ color, size: 0.06, map: this.softTex, transparent: true, opacity: 0.85, depthWrite: false, blending: THREE.AdditiveBlending }),
    );
  }

  private makeLabel(text: string, tint: number): THREE.Sprite {
    const c = document.createElement("canvas");
    const x = c.getContext("2d")!;
    const fs = 40;
    x.font = `600 ${fs}px Inter,system-ui,sans-serif`;
    const w = Math.ceil(x.measureText(text).width) + 44;
    c.width = w;
    c.height = fs + 26;
    x.font = `600 ${fs}px Inter,system-ui,sans-serif`;
    const hex = "#" + tint.toString(16).padStart(6, "0");
    x.fillStyle = "rgba(8,10,22,0.82)";
    const r = c.height / 2;
    x.beginPath();
    x.moveTo(r, 0);
    x.lineTo(w - r, 0);
    x.arc(w - r, r, r, -Math.PI / 2, Math.PI / 2);
    x.lineTo(r, c.height);
    x.arc(r, r, r, Math.PI / 2, Math.PI * 1.5);
    x.fill();
    x.strokeStyle = hex;
    x.lineWidth = 2;
    x.stroke();
    x.fillStyle = "#e7e9f4";
    x.textBaseline = "middle";
    x.fillText(text, 22, c.height / 2 + 2);
    const t = new THREE.CanvasTexture(c);
    t.minFilter = THREE.LinearFilter;
    const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false }));
    s.scale.set(w / 82, c.height / 82, 1);
    return s;
  }

  private bindInput(el: HTMLElement) {
    const onDown = (e: PointerEvent) => {
      this.dragging = true;
      this.lastX = this.downX = e.clientX;
      this.lastY = this.downY = e.clientY;
    };
    const onMove = (e: PointerEvent) => {
      if (this.dragging) {
        this.targetTheta += (e.clientX - this.lastX) * 0.006;
        this.targetPhi = Math.min(1.52, Math.max(0.15, this.targetPhi + (e.clientY - this.lastY) * 0.004));
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onUp = () => (this.dragging = false);
    const onWheel = (e: WheelEvent) => {
      this.targetDist = Math.min(160, Math.max(5, this.targetDist + e.deltaY * 0.04));
    };
    const onClick = (e: MouseEvent) => {
      if (Math.abs(e.clientX - this.downX) > 4 || Math.abs(e.clientY - this.downY) > 4) return;
      this.ray.setFromCamera(this.mouse, this.camera);
      const hits = this.ray.intersectObjects(this.systems.flatMap((s) => s.planets.map((p) => p.mesh)), false);
      this.cb.onItemSelected?.(hits.length ? (hits[0]!.object.userData.item as GalaxyItem) : null);
    };
    const onResize = () => {
      if (!this.container) return;
      this.camera.aspect = this.container.clientWidth / this.container.clientHeight;
      this.camera.updateProjectionMatrix();
      this.renderer.setSize(this.container.clientWidth, this.container.clientHeight);
    };
    el.addEventListener("pointerdown", onDown);
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", onUp);
    el.addEventListener("wheel", onWheel, { passive: true });
    el.addEventListener("click", onClick);
    const ro = new ResizeObserver(onResize);
    ro.observe(el);
    this.cleanups.push(() => {
      el.removeEventListener("pointerdown", onDown);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", onUp);
      el.removeEventListener("wheel", onWheel);
      el.removeEventListener("click", onClick);
      ro.disconnect();
    });
  }

  private updateHover() {
    this.ray.setFromCamera(this.mouse, this.camera);
    const hits = this.ray.intersectObjects(this.systems.flatMap((s) => s.planets.map((p) => p.mesh)), false);
    const planet = hits.length ? this.systems.flatMap((s) => s.planets).find((p) => p.mesh === hits[0]!.object) ?? null : null;
    if (planet !== this.hovered) {
      this.hovered = planet;
      if (this.container) this.container.style.cursor = planet ? "pointer" : "grab";
      this.cb.onHover?.(planet?.item ?? null);
      if (!planet) this.cb.onReticle?.(null);
    }
  }

  private animate = () => {
    if (this.disposed) return;
    this.raf = requestAnimationFrame(this.animate);
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const t = this.clock.elapsedTime;
    this.theta += (this.targetTheta - this.theta) * 0.07;
    this.phi += (this.targetPhi - this.phi) * 0.07;
    this.dist += (this.targetDist - this.dist) * 0.07;
    if (!this.dragging) this.targetTheta += 0.015 * dt;
    this.camera.position.set(
      this.dist * Math.sin(this.phi) * Math.cos(this.theta),
      this.dist * Math.cos(this.phi),
      this.dist * Math.sin(this.phi) * Math.sin(this.theta),
    );
    this.camera.lookAt(0, 0, 0);

    this.disc.rotation.y += dt * 0.012;
    const nowMs = performance.now();
    const easeOut = (x: number) => 1 - Math.pow(1 - x, 3);
    for (const s of this.systems) {
      s.group.rotation.y += s.spin * dt;
      s.star.material.opacity = 0.85 + Math.sin(t * 2 + s.group.position.x) * 0.12;
      const coronaScale = 9 + Math.sin(t * 1.5 + s.group.position.z) * 0.5;
      s.corona.scale.set(coronaScale, coronaScale, 1);
      // grow a newly-appeared system in over ~700ms
      if (s.born) {
        const g = Math.min(1, (nowMs - s.born) / 700);
        s.group.scale.setScalar(easeOut(g));
        if (g >= 1) s.born = 0;
      }
      for (const p of s.planets) {
        p.angle += p.speed * dt;
        // planet rides within its tilted orbital-plane holder
        p.mesh.position.set(Math.cos(p.angle) * p.orbit, 0, Math.sin(p.angle) * p.orbit);
        p.mesh.rotation.y += dt * 0.18; // slow self-spin shows the surface detail
        p.dust.rotation.y += dt * 0.6;
        const hot = this.hovered === p;
        let grow = 1;
        if (p.born) {
          const g = Math.min(1, (nowMs - p.born) / 600);
          grow = easeOut(g);
          if (g >= 1) p.born = 0;
        }
        const target = (hot ? 1.5 : 1) * grow;
        p.mesh.scale.lerp(new THREE.Vector3(target, target, target), 0.2);
        (p.rim.material as THREE.SpriteMaterial).opacity = 0.5 + (hot ? 0.4 : 0) + Math.sin(t * 3 + p.angle) * 0.1;
      }
    }
    this.background.step(dt, t);
    this.updateHover();
    // project the hovered planet to screen so the HUD reticle can track it
    if (this.hovered && this.container) {
      const wp = new THREE.Vector3();
      this.hovered.mesh.getWorldPosition(wp);
      wp.project(this.camera);
      const rect = this.container.getBoundingClientRect();
      this.cb.onReticle?.({
        x: rect.left + ((wp.x + 1) / 2) * rect.width,
        y: rect.top + ((1 - wp.y) / 2) * rect.height,
      });
    }
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanups) c();
    this.background.dispose();
    this.glowTex.dispose();
    this.softTex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
