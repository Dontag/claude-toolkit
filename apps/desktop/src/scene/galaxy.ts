// GalaxyBackground — dynamic space sky behind the skill tree.
// Ambient mode: seeded star shells + nebula billboards + comets/asteroids that
// streak by at random intervals so the sky always feels alive but never busy.
// Phase 2 hooks: setActivity(level) raises spawn rate with online users, and
// spawnComet(color) fires one immediately for a realtime activity event.
import * as THREE from "three";

interface Comet {
  head: THREE.Sprite;
  trail: THREE.Line;
  trailPositions: Float32Array;
  pos: THREE.Vector3;
  vel: THREE.Vector3;
  life: number;
  maxLife: number;
  kind: "comet" | "asteroid";
  rock?: THREE.Mesh;
}

const COMET_COLORS = [0x8f83ff, 0x7ce7f5, 0xffb057, 0xff6b7a, 0xa78bfa, 0xffffff];
const TRAIL_LEN = 24;

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, "rgba(255,255,255,1)");
  g.addColorStop(0.3, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 64, 64);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

/** Wispy volumetric nebula cloud (transparent bg) built from layered blobs. */
function nebulaTexture(seed: number): THREE.CanvasTexture {
  const S = 256;
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const x = c.getContext("2d")!;
  let s = seed || 1;
  const rnd = () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646;
  x.globalCompositeOperation = "lighter";
  // magenta / violet / blue-purple palette (ref image 1)
  const tints = [
    [150, 40, 200],
    [200, 50, 170],
    [110, 40, 210],
    [90, 30, 160],
    [210, 90, 230],
  ];
  for (let i = 0; i < 60; i++) {
    const cx = rnd() * S;
    const cy = rnd() * S;
    const r = 20 + rnd() * 90;
    const [rr, gg, bb] = tints[Math.floor(rnd() * tints.length)]!;
    const a = 0.05 + rnd() * 0.12;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(${rr},${gg},${bb},${a})`);
    g.addColorStop(1, `rgba(${rr},${gg},${bb},0)`);
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  // a few bright filaments / hot spots
  for (let i = 0; i < 8; i++) {
    const cx = rnd() * S;
    const cy = rnd() * S;
    const r = 4 + rnd() * 14;
    const g = x.createRadialGradient(cx, cy, 0, cx, cy, r);
    g.addColorStop(0, `rgba(255,220,255,${0.15 + rnd() * 0.2})`);
    g.addColorStop(1, "rgba(255,220,255,0)");
    x.fillStyle = g;
    x.beginPath();
    x.arc(cx, cy, r, 0, Math.PI * 2);
    x.fill();
  }
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

export class GalaxyBackground {
  group = new THREE.Group();
  private comets: Comet[] = [];
  private nextSpawn = 0;
  private activity = 0; // 0 = ambient; grows with online users (Phase 2)
  private tex = glowTexture();
  private nebulaTexes = [nebulaTexture(101), nebulaTexture(202), nebulaTexture(303), nebulaTexture(404)];
  private nebulae: THREE.Sprite[] = [];
  private starLayers: THREE.Points[] = [];
  private reducedMotion = matchMedia("(prefers-reduced-motion: reduce)").matches;

  constructor() {
    // three star shells at different radii for parallax depth
    const shells: Array<[number, number, number, number]> = [
      // [count, radius, size, opacity]
      [900, 120, 0.55, 0.8],
      [700, 90, 0.4, 0.55],
      [350, 70, 0.3, 0.4],
    ];
    for (const [count, radius, size, opacity] of shells) {
      const pos = new Float32Array(count * 3);
      const col = new Float32Array(count * 3);
      for (let i = 0; i < count; i++) {
        // uniform sphere shell, biased above the horizon so the water stays dark
        const u = Math.random() * 2 - 1;
        const th = Math.random() * Math.PI * 2;
        const sq = Math.sqrt(1 - u * u);
        pos[i * 3] = radius * sq * Math.cos(th);
        pos[i * 3 + 1] = Math.abs(radius * u) * 0.9 - 6;
        pos[i * 3 + 2] = radius * sq * Math.sin(th);
        const c = new THREE.Color(
          Math.random() < 0.78 ? 0xffffff : COMET_COLORS[Math.floor(Math.random() * COMET_COLORS.length)]!,
        );
        col[i * 3] = c.r;
        col[i * 3 + 1] = c.g;
        col[i * 3 + 2] = c.b;
      }
      const g = new THREE.BufferGeometry();
      g.setAttribute("position", new THREE.BufferAttribute(pos, 3));
      g.setAttribute("color", new THREE.BufferAttribute(col, 3));
      const p = new THREE.Points(
        g,
        new THREE.PointsMaterial({
          size,
          vertexColors: true,
          transparent: true,
          opacity,
          sizeAttenuation: true,
          depthWrite: false,
        }),
      );
      this.group.add(p);
      this.starLayers.push(p);
    }

    // volumetric purple nebula: large overlapping cloud billboards filling the
    // sky (ref image 1). Additive so overlaps build up bright wisps.
    const nebulaTints = [0xa64bff, 0xd94bd0, 0x7a3cf0, 0xff5ad0, 0x6a3ce0];
    for (let i = 0; i < 11; i++) {
      const s = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.nebulaTexes[i % this.nebulaTexes.length],
          color: nebulaTints[i % nebulaTints.length],
          transparent: true,
          opacity: 0.28 + Math.random() * 0.16,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
          rotation: Math.random() * Math.PI * 2,
        }),
      );
      const a = (i / 11) * Math.PI * 2 + Math.random();
      const r = 70 + Math.random() * 50;
      s.position.set(Math.cos(a) * r, 6 + Math.sin(i * 1.9) * 42, Math.sin(a) * r);
      const size = 90 + Math.random() * 90;
      s.scale.set(size, size * (0.6 + Math.random() * 0.4), 1);
      this.group.add(s);
      this.nebulae.push(s);
    }

    this.scheduleNext(true);
  }

  /** Phase 2: presence-driven dynamicity. 0 = alone, each online user adds energy. */
  setActivity(level: number) {
    this.activity = Math.max(0, level);
  }

  private scheduleNext(first = false) {
    // ambient: a comet every 45–180s; activity shortens the window (capped)
    const factor = 1 / (1 + Math.min(this.activity, 12) * 0.5);
    const min = first ? 4 : 45 * factor;
    const max = first ? 10 : 180 * factor;
    this.nextSpawn = performance.now() + (min + Math.random() * (max - min)) * 1000;
  }

  spawnComet(color?: number, kind: "comet" | "asteroid" = Math.random() < 0.82 ? "comet" : "asteroid") {
    if (this.reducedMotion || this.comets.length >= 6) return;
    const col = color ?? COMET_COLORS[Math.floor(Math.random() * COMET_COLORS.length)]!;
    // start high on one side, streak across the sky dome
    const side = Math.random() < 0.5 ? -1 : 1;
    const pos = new THREE.Vector3(side * (55 + Math.random() * 20), 24 + Math.random() * 22, -40 + Math.random() * 80);
    const target = new THREE.Vector3(-side * (45 + Math.random() * 25), 6 + Math.random() * 16, -40 + Math.random() * 80);
    const speed = kind === "comet" ? 18 + Math.random() * 14 : 5 + Math.random() * 4;
    const vel = target.clone().sub(pos).normalize().multiplyScalar(speed);

    const head = new THREE.Sprite(
      new THREE.SpriteMaterial({
        map: this.tex,
        color: col,
        transparent: true,
        opacity: kind === "comet" ? 0.95 : 0.0,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    const hs = kind === "comet" ? 1.6 + Math.random() : 0.6;
    head.scale.set(hs, hs, 1);
    head.position.copy(pos);
    this.group.add(head);

    const trailPositions = new Float32Array(TRAIL_LEN * 3);
    for (let i = 0; i < TRAIL_LEN; i++) {
      trailPositions[i * 3] = pos.x;
      trailPositions[i * 3 + 1] = pos.y;
      trailPositions[i * 3 + 2] = pos.z;
    }
    const tg = new THREE.BufferGeometry();
    tg.setAttribute("position", new THREE.BufferAttribute(trailPositions, 3));
    const trail = new THREE.Line(
      tg,
      new THREE.LineBasicMaterial({
        color: col,
        transparent: true,
        opacity: kind === "comet" ? 0.55 : 0.2,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
      }),
    );
    this.group.add(trail);

    let rock: THREE.Mesh | undefined;
    if (kind === "asteroid") {
      rock = new THREE.Mesh(
        new THREE.DodecahedronGeometry(0.5, 0),
        new THREE.MeshStandardMaterial({ color: 0x6b7291, roughness: 0.95, emissive: 0x23273f, emissiveIntensity: 0.5 }),
      );
      rock.position.copy(pos);
      this.group.add(rock);
    }

    const maxLife = pos.distanceTo(target) / speed;
    this.comets.push({ head, trail, trailPositions, pos, vel, life: 0, maxLife, kind, rock });
  }

  step(dt: number, t: number) {
    // slow sky rotation + gentle star twinkle
    this.group.rotation.y += dt * 0.004;
    for (let i = 0; i < this.starLayers.length; i++) {
      const m = this.starLayers[i]!.material as THREE.PointsMaterial;
      const base = [0.8, 0.55, 0.4][i]!;
      m.opacity = base + Math.sin(t * (0.4 + i * 0.23)) * 0.08;
    }
    // nebula clouds slowly breathe + drift for a living volumetric feel
    for (let i = 0; i < this.nebulae.length; i++) {
      const m = this.nebulae[i]!.material as THREE.SpriteMaterial;
      m.rotation += dt * 0.01 * (i % 2 ? 1 : -1);
      m.opacity = 0.3 + Math.sin(t * 0.18 + i) * 0.08;
    }

    if (!this.reducedMotion && performance.now() >= this.nextSpawn) {
      this.spawnComet();
      this.scheduleNext();
    }

    for (let i = this.comets.length - 1; i >= 0; i--) {
      const c = this.comets[i]!;
      c.life += dt;
      c.pos.addScaledVector(c.vel, dt);
      c.head.position.copy(c.pos);
      if (c.rock) {
        c.rock.position.copy(c.pos);
        c.rock.rotation.x += dt * 1.4;
        c.rock.rotation.y += dt * 0.9;
      }
      // shift trail
      const p = c.trailPositions;
      for (let j = TRAIL_LEN - 1; j > 0; j--) {
        p[j * 3] = p[(j - 1) * 3]!;
        p[j * 3 + 1] = p[(j - 1) * 3 + 1]!;
        p[j * 3 + 2] = p[(j - 1) * 3 + 2]!;
      }
      p[0] = c.pos.x;
      p[1] = c.pos.y;
      p[2] = c.pos.z;
      (c.trail.geometry.attributes.position as THREE.BufferAttribute).needsUpdate = true;

      const fade = Math.min(1, Math.min(c.life / 0.5, (c.maxLife - c.life) / 0.8));
      (c.head.material as THREE.SpriteMaterial).opacity = (c.kind === "comet" ? 0.95 : 0) * Math.max(0, fade);
      (c.trail.material as THREE.LineBasicMaterial).opacity = (c.kind === "comet" ? 0.55 : 0.2) * Math.max(0, fade);

      if (c.life >= c.maxLife) {
        this.group.remove(c.head, c.trail);
        if (c.rock) {
          this.group.remove(c.rock);
          c.rock.geometry.dispose();
          (c.rock.material as THREE.Material).dispose();
        }
        c.head.material.dispose();
        c.trail.geometry.dispose();
        (c.trail.material as THREE.Material).dispose();
        this.comets.splice(i, 1);
      }
    }
  }

  dispose() {
    this.group.traverse((o) => {
      const m = o as THREE.Mesh;
      if (m.geometry) m.geometry.dispose();
      if (m.material) (m.material as THREE.Material).dispose();
    });
    this.tex.dispose();
    for (const nt of this.nebulaTexes) nt.dispose();
  }
}
