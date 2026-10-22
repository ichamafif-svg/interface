"use client";
/**
 * Carte holographique (three.js) : une tour de trois plateaux circulaires au-dessus d'une table.
 *   bas    : plateforme Standard (la fondation)
 *   milieu : produit sous Standard
 *   haut   : hors Standard (le monde extérieur)
 * Monochrome cyan ; seules les alertes prennent une couleur (ambre, rouge).
 */
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";
import { CSS2DObject, CSS2DRenderer } from "three/examples/jsm/renderers/CSS2DRenderer.js";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer.js";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass.js";
import type { State, Topology, TopologyNode } from "@/lib/api/types";

export const HOLO: Record<State, string> = {
  qualifie: "#67e8f9",
  observe: "#93c5fd",
  propose: "#cbd5e1",
  inconnu: "#fbbf24",
  non_couvert: "#f87171",
  non_etaye: "#c4b5fd",
  hors_standard: "#4f7a86",
};
const CYAN = new THREE.Color("#67e8f9");
const RED = new THREE.Color("#f87171");

const TIER: Record<TopologyNode["managed"], { y: number; r: number; label: string }> = {
  standard: { y: 0, r: 150, label: "PLATEFORME STANDARD" },
  product: { y: 95, r: 135, label: "PRODUIT" },
  outside: { y: 190, r: 165, label: "HORS STANDARD" },
};
const COLUMN: Record<TopologyNode["kind"], number> = {
  client: 0, external: 0, entry: 1, identity: 1, sandbox: 1, service: 2, kernel: 2, datastore: 3, secrets: 3, egress: 3, third_party: 4, cdn: 4,
};
const SHAPE: Partial<Record<TopologyNode["kind"], () => THREE.BufferGeometry>> = {
  entry: () => new THREE.OctahedronGeometry(11, 0),
  kernel: () => new THREE.IcosahedronGeometry(12, 0),
  datastore: () => new THREE.CylinderGeometry(8, 8, 14, 10, 1),
  secrets: () => new THREE.BoxGeometry(12, 12, 12),
  sandbox: () => new THREE.BoxGeometry(13, 9, 13),
  egress: () => new THREE.ConeGeometry(9, 16, 6),
  client: () => new THREE.TorusGeometry(7, 2, 6, 14),
};

export type HoloPulse = { edge?: string; node?: string; color: string };
export type HoloApi = { pulse: (p: HoloPulse) => void };

function layout(t: Topology) {
  const pos: Record<string, THREE.Vector3> = {};
  for (const tier of ["standard", "product", "outside"] as const) {
    const list = t.nodes.filter((n) => n.managed === tier).sort((a, b) => (COLUMN[a.kind] ?? 2) - (COLUMN[b.kind] ?? 2));
    list.forEach((n, i) => {
      // Le flux tourne autour de la tour : colonne 0 (clients) à gauche, colonne 4 (tiers) à droite.
      const a = Math.PI * 1.05 - (i / Math.max(1, list.length - 1)) * Math.PI * 1.1 + (tier === "product" ? 0.25 : 0);
      const r = TIER[tier].r * (0.72 + 0.28 * ((i % 2) ? 1 : 0.55));
      pos[n.id] = new THREE.Vector3(Math.cos(a) * r, TIER[tier].y + ((i % 3) - 1) * 6, Math.sin(a) * r * 0.85);
    });
  }
  return pos;
}

export function HoloMap({
  topology,
  focus,
  broken,
  selected,
  onSelect,
  onHover,
  apiRef,
}: {
  topology: Topology;
  focus: { nodes: Set<string>; edges: Set<string> } | null;
  broken: boolean;
  selected: string | null;
  onSelect: (id: string | null) => void;
  onHover: (id: string | null) => void;
  apiRef: React.MutableRefObject<HoloApi | null>;
}) {
  const host = useRef<HTMLDivElement>(null);
  const live = useRef({ focus, broken, selected });
  live.current = { focus, broken, selected };
  const cb = useRef({ onSelect, onHover });
  cb.current = { onSelect, onHover };

  useEffect(() => {
    const el = host.current!;
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    const W = () => el.clientWidth;
    const H = () => (el.clientWidth < 640 ? 460 : 620);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.setSize(W(), H());
    renderer.setClearColor(0x02060a, 1);
    el.appendChild(renderer.domElement);
    renderer.domElement.style.display = "block";

    const labels = new CSS2DRenderer();
    labels.setSize(W(), H());
    Object.assign(labels.domElement.style, { position: "absolute", inset: "0", pointerEvents: "none" });
    el.appendChild(labels.domElement);

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x02060a, 0.0016);
    const camera = new THREE.PerspectiveCamera(42, W() / H(), 1, 3000);
    camera.position.set(0, 330, 600);

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(0, 70, 0);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.autoRotate = !reduce;
    controls.autoRotateSpeed = 0.45;
    controls.minDistance = 260;
    controls.maxDistance = 820;
    controls.maxPolarAngle = Math.PI * 0.52;
    controls.enablePan = false;

    const composer = new EffectComposer(renderer);
    composer.addPass(new RenderPass(scene, camera));
    const bloom = new UnrealBloomPass(new THREE.Vector2(W(), H()), 0.75, 0.45, 0.2);
    composer.addPass(bloom);
    composer.addPass(new OutputPass());

    const line = (color: THREE.Color | string, opacity: number) =>
      new THREE.LineBasicMaterial({ color, transparent: true, opacity, blending: THREE.AdditiveBlending, depthWrite: false });

    /* ---------- Table et plateaux ---------- */
    const deco = new THREE.Group();
    scene.add(deco);
    const ring = (r: number, y: number, opacity: number, segments = 128, arc = Math.PI * 2, start = 0) => {
      const pts: THREE.Vector3[] = [];
      for (let i = 0; i <= segments; i++) {
        const a = start + (i / segments) * arc;
        pts.push(new THREE.Vector3(Math.cos(a) * r, y, Math.sin(a) * r));
      }
      return new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts), line(CYAN, opacity));
    };
    // Table : anneaux concentriques, graduations, grille polaire.
    const table = new THREE.Group();
    table.position.y = -40;
    for (const [r, o] of [[60, 0.25], [120, 0.18], [190, 0.35], [215, 0.12], [240, 0.22]] as const) table.add(ring(r, 0, o));
    const ticks: THREE.Vector3[] = [];
    for (let i = 0; i < 120; i++) {
      const a = (i / 120) * Math.PI * 2, l = i % 10 === 0 ? 14 : 6;
      ticks.push(new THREE.Vector3(Math.cos(a) * 240, 0, Math.sin(a) * 240), new THREE.Vector3(Math.cos(a) * (240 - l), 0, Math.sin(a) * (240 - l)));
    }
    table.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(ticks), line(CYAN, 0.35)));
    const spokes: THREE.Vector3[] = [];
    for (let i = 0; i < 24; i++) {
      const a = (i / 24) * Math.PI * 2;
      spokes.push(new THREE.Vector3(Math.cos(a) * 60, 0, Math.sin(a) * 60), new THREE.Vector3(Math.cos(a) * 190, 0, Math.sin(a) * 190));
    }
    table.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spokes), line(CYAN, 0.06)));
    deco.add(table);
    // Arcs qui tournent en sens contraires
    const spinA = new THREE.Group(), spinB = new THREE.Group();
    for (let k = 0; k < 3; k++) spinA.add(ring(205, -40, 0.55, 40, Math.PI * 0.42, k * (Math.PI * 2 / 3)));
    for (let k = 0; k < 5; k++) spinB.add(ring(228, -40, 0.4, 20, Math.PI * 0.16, k * (Math.PI * 2 / 5)));
    deco.add(spinA, spinB);
    // Balayage radar
    const sweepGeo = new THREE.CircleGeometry(190, 48, 0, Math.PI / 7);
    const sweep = new THREE.Mesh(sweepGeo, new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: 0.07, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
    sweep.rotation.x = -Math.PI / 2;
    sweep.position.y = -39;
    deco.add(sweep);
    // Plateaux des trois niveaux + colonne centrale
    for (const key of ["standard", "product", "outside"] as const) {
      const t = TIER[key];
      const disc = new THREE.Mesh(new THREE.CircleGeometry(t.r + 25, 64), new THREE.MeshBasicMaterial({ color: CYAN, transparent: true, opacity: key === "outside" ? 0.015 : 0.03, side: THREE.DoubleSide, depthWrite: false }));
      disc.rotation.x = -Math.PI / 2;
      disc.position.y = t.y - 14;
      deco.add(disc, ring(t.r + 25, t.y - 14, key === "outside" ? 0.18 : 0.3, 96));
      const tag = document.createElement("div");
      tag.className = "holo-tier";
      tag.textContent = t.label;
      const o = new CSS2DObject(tag);
      o.position.set(-(t.r + 30), t.y - 14, 0);
      deco.add(o);
    }
    const spine: THREE.Vector3[] = [];
    for (let y = -40; y < 200; y += 8) spine.push(new THREE.Vector3(0, y, 0), new THREE.Vector3(0, y + 4, 0));
    deco.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(spine), line(CYAN, 0.25)));

    /* ---------- Nœuds ---------- */
    const pos = layout(topology);
    type NodeObj = { n: TopologyNode; group: THREE.Group; wire: THREE.LineSegments; core: THREE.Mesh; halo: THREE.Mesh; label: HTMLDivElement; drop: THREE.Line; base: THREE.Vector3 };
    const nodes: Record<string, NodeObj> = {};
    const pickables: THREE.Object3D[] = [];
    const haloTex = (() => {
      const c = document.createElement("canvas");
      c.width = c.height = 64;
      const g = c.getContext("2d")!;
      const grd = g.createRadialGradient(32, 32, 0, 32, 32, 32);
      grd.addColorStop(0, "rgba(255,255,255,1)");
      grd.addColorStop(0.25, "rgba(255,255,255,.35)");
      grd.addColorStop(1, "rgba(255,255,255,0)");
      g.fillStyle = grd;
      g.fillRect(0, 0, 64, 64);
      return new THREE.CanvasTexture(c);
    })();

    for (const n of topology.nodes) {
      const color = new THREE.Color(HOLO[n.state]);
      const geo = (SHAPE[n.kind] ?? (() => new THREE.IcosahedronGeometry(9, 1)))();
      const group = new THREE.Group();
      const wire = new THREE.LineSegments(new THREE.EdgesGeometry(geo), line(color, 0.95));
      const core = new THREE.Mesh(geo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false }));
      const halo = new THREE.Mesh(new THREE.PlaneGeometry(30, 30), new THREE.MeshBasicMaterial({ map: haloTex, color, transparent: true, opacity: 0.2, blending: THREE.AdditiveBlending, depthWrite: false }));
      group.add(core, wire, halo);
      group.position.copy(pos[n.id]);
      core.userData.id = n.id;
      pickables.push(core);
      // Fil de projection vers le plateau
      const drop = new THREE.Line(
        new THREE.BufferGeometry().setFromPoints([pos[n.id].clone(), new THREE.Vector3(pos[n.id].x, TIER[n.managed].y - 14, pos[n.id].z)]),
        new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.35, dashSize: 2, gapSize: 3 }),
      );
      drop.computeLineDistances();
      scene.add(group, drop);
      const div = document.createElement("div");
      div.className = `holo-label${n.state === "non_couvert" ? " bad" : n.state === "inconnu" ? " warn" : ""}`;
      div.innerHTML = `<span>${n.label.replace(/</g, "&lt;")}</span><small>${(n.stateLabel ?? n.state).replace(/_/g, " ")}</small>`;
      const lab = new CSS2DObject(div);
      lab.position.set(0, 18, 0);
      group.add(lab);
      nodes[n.id] = { n, group, wire, core, halo, label: div, drop, base: pos[n.id].clone() };
    }

    /* ---------- Chemins ---------- */
    type EdgeObj = { id: string; curve: THREE.QuadraticBezierCurve3; line: THREE.Line; packets: THREE.Mesh[]; color: THREE.Color; kind: string };
    const edges: Record<string, EdgeObj> = {};
    const packetGeo = new THREE.SphereGeometry(1.6, 8, 8);
    for (const e of topology.edges) {
      const a = pos[e.from], b = pos[e.to];
      const mid = a.clone().add(b).multiplyScalar(0.5);
      mid.y += 18 + a.distanceTo(b) * 0.12;
      const curve = new THREE.QuadraticBezierCurve3(a.clone(), mid, b.clone());
      const color = new THREE.Color(e.kind === "bypass" ? "#f87171" : HOLO[e.state]);
      const geo = new THREE.BufferGeometry().setFromPoints(curve.getPoints(40));
      const mat = e.kind === "control" || e.kind === "bypass"
        ? new THREE.LineDashedMaterial({ color, transparent: true, opacity: 0.55, dashSize: e.kind === "bypass" ? 6 : 2, gapSize: 4, blending: THREE.AdditiveBlending, depthWrite: false })
        : line(color, 0.45);
      const l = new THREE.Line(geo, mat);
      l.computeLineDistances();
      scene.add(l);
      const packets: THREE.Mesh[] = [];
      if (e.kind !== "control") {
        for (let k = 0; k < 3; k++) {
          const m = new THREE.Mesh(packetGeo, new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, blending: THREE.AdditiveBlending, depthWrite: false }));
          m.userData.offset = k / 3 + (e.id.length % 5) / 10;
          scene.add(m);
          packets.push(m);
        }
      }
      edges[e.id] = { id: e.id, curve, line: l, packets, color, kind: e.kind };
    }

    /* ---------- Impulsions (événements réels) ---------- */
    type Fx = { t0: number; mesh: THREE.Object3D; kind: "comet" | "shock"; curve?: THREE.QuadraticBezierCurve3 };
    const fx: Fx[] = [];
    apiRef.current = {
      pulse: (p) => {
        const color = new THREE.Color(p.color);
        const now = performance.now();
        if (p.edge && edges[p.edge]) {
          const comet = new THREE.Group();
          for (let k = 0; k < 7; k++) {
            const m = new THREE.Mesh(new THREE.SphereGeometry(3.4 - k * 0.4, 10, 10), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1 - k / 7, blending: THREE.AdditiveBlending, depthWrite: false }));
            comet.add(m);
          }
          scene.add(comet);
          fx.push({ t0: now, mesh: comet, kind: "comet", curve: edges[p.edge].curve });
        }
        const target = p.node ?? (p.edge ? topology.edges.find((x) => x.id === p.edge)?.to : undefined);
        if (target && nodes[target]) {
          const shock = new THREE.Mesh(new THREE.RingGeometry(10, 11.5, 48), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.9, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, depthWrite: false }));
          shock.position.copy(nodes[target].group.position);
          shock.rotation.x = -Math.PI / 2;
          shock.userData.delay = p.edge ? 1100 : 0;
          scene.add(shock);
          fx.push({ t0: now, mesh: shock, kind: "shock" });
        }
      },
    };

    /* ---------- Interaction ---------- */
    const ray = new THREE.Raycaster();
    const mouse = new THREE.Vector2();
    let downAt: { x: number; y: number } | null = null;
    const pick = (ev: PointerEvent) => {
      const r = renderer.domElement.getBoundingClientRect();
      mouse.set(((ev.clientX - r.left) / r.width) * 2 - 1, -((ev.clientY - r.top) / r.height) * 2 + 1);
      ray.setFromCamera(mouse, camera);
      const hit = ray.intersectObjects(pickables, false)[0];
      return (hit?.object.userData.id as string | undefined) ?? null;
    };
    let hovered: string | null = null;
    const onMove = (ev: PointerEvent) => {
      const id = pick(ev);
      if (id !== hovered) {
        hovered = id;
        cb.current.onHover(id);
        renderer.domElement.style.cursor = id ? "pointer" : "grab";
      }
    };
    const onDown = (ev: PointerEvent) => { downAt = { x: ev.clientX, y: ev.clientY }; controls.autoRotate = false; };
    const onUp = (ev: PointerEvent) => {
      if (downAt && Math.hypot(ev.clientX - downAt.x, ev.clientY - downAt.y) < 5) cb.current.onSelect(pick(ev));
      downAt = null;
      if (!reduce) setTimeout(() => (controls.autoRotate = true), 5000);
    };
    renderer.domElement.addEventListener("pointermove", onMove);
    renderer.domElement.addEventListener("pointerdown", onDown);
    renderer.domElement.addEventListener("pointerup", onUp);

    const onResize = () => {
      camera.aspect = W() / H();
      camera.updateProjectionMatrix();
      renderer.setSize(W(), H());
      labels.setSize(W(), H());
      composer.setSize(W(), H());
    };
    const ro = new ResizeObserver(onResize);
    ro.observe(el);

    /* ---------- Boucle ---------- */
    let raf = 0;
    const clock = new THREE.Clock();
    const tick = () => {
      const t = clock.getElapsedTime();
      const now = performance.now();
      const { focus: f, broken: br, selected: sel } = live.current;
      const flash = 0.55 + 0.45 * Math.sin(t * 7);

      spinA.rotation.y = t * 0.18;
      spinB.rotation.y = -t * 0.11;
      sweep.rotation.z = -t * 0.9;

      for (const o of Object.values(nodes)) {
        const on = !f || f.nodes.has(o.n.id);
        const red = br && on && !!f;
        const color = red ? RED : new THREE.Color(HOLO[o.n.state]);
        if (!reduce) o.group.position.y = o.base.y + Math.sin(t * 1.2 + o.base.x) * 2.2;
        o.group.rotation.y = t * 0.6 + o.base.z;
        (o.wire.material as THREE.LineBasicMaterial).color.copy(color);
        (o.wire.material as THREE.LineBasicMaterial).opacity = on ? (red ? flash : 0.95) : 0.08;
        (o.core.material as THREE.MeshBasicMaterial).color.copy(color);
        (o.core.material as THREE.MeshBasicMaterial).opacity = on ? 0.14 : 0.02;
        (o.halo.material as THREE.MeshBasicMaterial).color.copy(color);
        (o.halo.material as THREE.MeshBasicMaterial).opacity = on ? (o.n.id === sel ? 0.6 : red ? 0.45 * flash : 0.18) : 0.03;
        o.halo.quaternion.copy(camera.quaternion);
        (o.drop.material as THREE.LineDashedMaterial).opacity = on ? 0.35 : 0.04;
        o.label.style.opacity = on ? "1" : "0.18";
        o.label.classList.toggle("sel", o.n.id === sel);
      }
      for (const e of Object.values(edges)) {
        const on = !f || f.edges.has(e.id);
        const red = br && on && !!f;
        const m = e.line.material as THREE.LineBasicMaterial;
        m.color.copy(red ? RED : e.color);
        m.opacity = on ? (red ? flash : f ? 0.85 : 0.45) : 0.04;
        e.packets.forEach((p) => {
          const u = (t * (e.kind === "request" ? 0.22 : 0.14) + (p.userData.offset as number)) % 1;
          p.position.copy(e.curve.getPoint(u));
          const pm = p.material as THREE.MeshBasicMaterial;
          pm.color.copy(red ? RED : e.color);
          pm.opacity = on ? Math.sin(Math.PI * u) * 0.95 : 0.03;
        });
      }
      for (let i = fx.length - 1; i >= 0; i--) {
        const x = fx[i];
        if (x.kind === "comet" && x.curve) {
          const u = (now - x.t0) / 1100;
          if (u >= 1) { scene.remove(x.mesh); fx.splice(i, 1); continue; }
          x.mesh.children.forEach((c, k) => c.position.copy(x.curve!.getPoint(Math.max(0, u - k * 0.025))));
        } else {
          const u = (now - x.t0 - (x.mesh.userData.delay as number)) / 1300;
          if (u >= 1) { scene.remove(x.mesh); fx.splice(i, 1); continue; }
          x.mesh.visible = u > 0;
          const s = 1 + Math.max(0, u) * 3.2;
          x.mesh.scale.set(s, s, s);
          ((x.mesh as THREE.Mesh).material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - Math.max(0, u));
        }
      }

      controls.update();
      composer.render();
      labels.render(scene, camera);
      raf = requestAnimationFrame(tick);
    };
    tick();

    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      apiRef.current = null;
      controls.dispose();
      renderer.domElement.removeEventListener("pointermove", onMove);
      renderer.domElement.removeEventListener("pointerdown", onDown);
      renderer.domElement.removeEventListener("pointerup", onUp);
      scene.traverse((o) => {
        const m = o as THREE.Mesh;
        m.geometry?.dispose?.();
        const mat = m.material as THREE.Material | THREE.Material[] | undefined;
        if (Array.isArray(mat)) mat.forEach((x) => x.dispose());
        else mat?.dispose?.();
      });
      haloTex.dispose();
      composer.dispose();
      renderer.dispose();
      el.innerHTML = "";
    };
  }, [topology, apiRef]);

  return <div ref={host} style={{ position: "relative", width: "100%", touchAction: "none" }} />;
}
