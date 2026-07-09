// GalaxyScene — the shared universe. Every user is a star system: a glowing
// star in their signature color with published items orbiting as fruit-planets
// colored by kind. Reuses GalaxyBackground for sky + comets; presence raises
// the sky's energy and activity events streak comets in the actor's color.
import * as THREE from "three";
import type { GalaxyItem } from "../lib/galaxy";
import { userColor } from "../lib/presence";
import { GalaxyBackground } from "./galaxy";
import { CAT_COLOR } from "./scene";

interface System {
  ownerId: string;
  group: THREE.Group;
  planets: THREE.Mesh[];
  star: THREE.Sprite;
  spin: number;
}

export interface GalaxySceneCallbacks {
  onItemSelected?: (item: GalaxyItem | null) => void;
}

function glowTexture(): THREE.CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 128;
  const x = c.getContext("2d")!;
  const g = x.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0, "rgba(255,255,255,0.95)");
  g.addColorStop(0.3, "rgba(255,255,255,0.4)");
  g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g;
  x.fillRect(0, 0, 128, 128);
  const t = new THREE.CanvasTexture(c);
  t.minFilter = THREE.LinearFilter;
  return t;
}

export class GalaxyScene {
  private renderer!: THREE.WebGLRenderer;
  private scene = new THREE.Scene();
  private camera!: THREE.PerspectiveCamera;
  private world = new THREE.Group();
  private background = new GalaxyBackground();
  private systems: System[] = [];
  private tex = glowTexture();
  private container: HTMLElement | null = null;
  private raf = 0;
  private disposed = false;
  private clock = new THREE.Clock();

  private theta = 0.6;
  private phi = 1.15;
  private dist = 30;
  private targetTheta = 0.6;
  private targetPhi = 1.15;
  private targetDist = 30;
  private dragging = false;
  private lastX = 0;
  private lastY = 0;
  private downX = 0;
  private downY = 0;
  private ray = new THREE.Raycaster();
  private mouse = new THREE.Vector2(-2, -2);
  private hovered: THREE.Object3D | null = null;
  private hoverLabel: THREE.Sprite | null = null;
  private cleanups: Array<() => void> = [];

  constructor(private cb: GalaxySceneCallbacks = {}) {}

  mount(el: HTMLElement) {
    this.container = el;
    this.renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
    this.renderer.setSize(el.clientWidth, el.clientHeight);
    el.appendChild(this.renderer.domElement);
    this.camera = new THREE.PerspectiveCamera(50, el.clientWidth / el.clientHeight, 0.1, 400);
    this.scene.add(new THREE.AmbientLight(0x8890c8, 0.6));
    this.scene.add(this.background.group);
    this.scene.add(this.world);
    this.bindInput(el);
    this.animate();
  }

  setActivity(level: number) {
    this.background.setActivity(level);
  }

  cometPulse(color?: number) {
    this.background.spawnComet(color);
  }

  /** Rebuild star systems from the latest galaxy snapshot. */
  setItems(items: GalaxyItem[]) {
    for (const s of this.systems) this.world.remove(s.group);
    this.systems = [];
    const owners = new Map<string, GalaxyItem[]>();
    for (const it of items) {
      if (!owners.has(it.ownerId)) owners.set(it.ownerId, []);
      owners.get(it.ownerId)!.push(it);
    }
    const n = owners.size;
    let idx = 0;
    for (const [ownerId, ownerItems] of owners) {
      const group = new THREE.Group();
      // spiral placement: each system on a widening ring around the center
      const ang = idx * 2.399963;
      const rad = n === 1 ? 0 : 8 + idx * 4.5;
      group.position.set(Math.cos(ang) * rad, Math.sin(idx * 1.7) * 3, Math.sin(ang) * rad);
      const col = userColor(ownerId);

      const star = new THREE.Sprite(
        new THREE.SpriteMaterial({
          map: this.tex,
          color: col,
          transparent: true,
          opacity: 0.95,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      star.scale.set(3.2, 3.2, 1);
      group.add(star);
      const light = new THREE.PointLight(col, 1.2, 18, 2);
      group.add(light);

      const label = this.makeLabel(`@${ownerItems[0]!.ownerHandle}`, "#e7e9f4", "rgba(13,16,30,0.9)");
      label.position.set(0, 2.6, 0);
      group.add(label);

      const planets: THREE.Mesh[] = [];
      ownerItems.forEach((item, i) => {
        const orbit = 2.2 + (i % 4) * 0.9;
        const a = (i / ownerItems.length) * Math.PI * 2 + i * 0.7;
        const mesh = new THREE.Mesh(
          new THREE.SphereGeometry(0.32, 18, 14),
          new THREE.MeshStandardMaterial({
            color: CAT_COLOR[item.kind],
            emissive: CAT_COLOR[item.kind],
            emissiveIntensity: 0.55,
            roughness: 0.35,
          }),
        );
        mesh.position.set(Math.cos(a) * orbit, Math.sin(i * 2.1) * 0.7, Math.sin(a) * orbit);
        mesh.userData.item = item;
        // faint orbit ring
        const ring = new THREE.Mesh(
          new THREE.TorusGeometry(orbit, 0.012, 6, 64),
          new THREE.MeshBasicMaterial({ color: col, transparent: true, opacity: 0.12 }),
        );
        ring.rotation.x = Math.PI / 2;
        group.add(ring, mesh);
        planets.push(mesh);
      });

      this.world.add(group);
      this.systems.push({ ownerId, group, planets, star, spin: 0.05 + (idx % 5) * 0.015 });
      idx++;
    }
    // frame the whole galaxy
    this.targetDist = Math.max(18, 14 + n * 4);
  }

  private makeLabel(text: string, fg: string, bg: string): THREE.Sprite {
    const c = document.createElement("canvas");
    const x = c.getContext("2d")!;
    const fs = 40;
    x.font = `600 ${fs}px Inter,system-ui,sans-serif`;
    const w = Math.ceil(x.measureText(text).width) + 40;
    c.width = w;
    c.height = fs + 26;
    x.font = `600 ${fs}px Inter,system-ui,sans-serif`;
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
    s.scale.set(w / 90, c.height / 90, 1);
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
        this.targetPhi = Math.min(1.5, Math.max(0.3, this.targetPhi + (e.clientY - this.lastY) * 0.004));
        this.lastX = e.clientX;
        this.lastY = e.clientY;
      }
      const rect = el.getBoundingClientRect();
      this.mouse.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      this.mouse.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;
    };
    const onUp = () => (this.dragging = false);
    const onWheel = (e: WheelEvent) => {
      this.targetDist = Math.min(120, Math.max(6, this.targetDist + e.deltaY * 0.03));
    };
    const onClick = (e: MouseEvent) => {
      if (Math.abs(e.clientX - this.downX) > 4 || Math.abs(e.clientY - this.downY) > 4) return;
      this.ray.setFromCamera(this.mouse, this.camera);
      const hits = this.ray.intersectObjects(
        this.systems.flatMap((s) => s.planets),
        false,
      );
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
    const hits = this.ray.intersectObjects(
      this.systems.flatMap((s) => s.planets),
      false,
    );
    const hit = hits.length ? hits[0]!.object : null;
    if (hit !== this.hovered) {
      this.hovered = hit;
      if (this.container) this.container.style.cursor = hit ? "pointer" : "grab";
      if (this.hoverLabel) {
        this.hoverLabel.parent?.remove(this.hoverLabel);
        this.hoverLabel.material.map?.dispose();
        this.hoverLabel.material.dispose();
        this.hoverLabel = null;
      }
      if (hit) {
        const item = hit.userData.item as GalaxyItem;
        this.hoverLabel = this.makeLabel(item.name, "#e7e9f4", "rgba(13,16,30,0.92)");
        this.hoverLabel.position.copy((hit as THREE.Mesh).position).add(new THREE.Vector3(0, 0.7, 0));
        hit.parent?.add(this.hoverLabel);
      }
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
    if (!this.dragging) this.targetTheta += 0.02 * dt;
    this.camera.position.set(
      this.dist * Math.sin(this.phi) * Math.cos(this.theta),
      this.dist * Math.cos(this.phi),
      this.dist * Math.sin(this.phi) * Math.sin(this.theta),
    );
    this.camera.lookAt(0, 0, 0);

    for (const s of this.systems) {
      s.group.rotation.y += s.spin * dt;
      s.star.material.opacity = 0.85 + Math.sin(t * 2 + s.group.position.x) * 0.1;
    }
    this.background.step(dt, t);
    this.updateHover();
    this.renderer.render(this.scene, this.camera);
  };

  dispose() {
    this.disposed = true;
    cancelAnimationFrame(this.raf);
    for (const c of this.cleanups) c();
    this.background.dispose();
    this.tex.dispose();
    this.renderer.dispose();
    this.renderer.domElement.remove();
  }
}
