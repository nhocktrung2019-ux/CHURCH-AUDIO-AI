import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type WebGLSpeaker = {
  id: number; name: string; model: string; x: number; y: number; z: number;
  azimuth: number; coverage: number; verticalCoverage: number;
};
export type WebGLObject = {
  id: number; kind: "altar" | "pulpit" | "column" | "pew" | "chair" | "stage";
  name: string; x: number; y: number; w: number; d: number; h: number; rotation: number;
};
type Props = {
  length: number; width: number; height: number;
  speakers: WebGLSpeaker[]; objects: WebGLObject[];
  selectedSpeaker: number; selectedObject: number;
  onSelectSpeaker: (id: number) => void; onSelectObject: (id: number) => void;
  onMoveSpeaker: (id: number, x: number, y: number) => void;
  onMoveObject: (id: number, x: number, y: number) => void;
};

const speakerColors = [0x46d7ff, 0xffbd59, 0xd98cff, 0x73e0a1, 0xff7777, 0xf2e36b];
const furnitureColors: Record<WebGLObject["kind"], number> = {
  altar: 0xb78c52, pulpit: 0x956b42, column: 0xb9b7af,
  pew: 0x6d4930, chair: 0x805b3a, stage: 0x8a7863,
};

function addBox(
  parent: THREE.Group | THREE.Scene,
  size: [number, number, number],
  position: [number, number, number],
  material: THREE.Material,
  castShadow = true,
): THREE.Mesh {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(...size), material);
  mesh.position.set(...position);
  mesh.castShadow = castShadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function disposeObject(root: THREE.Object3D): void {
  root.traverse((node) => {
    if (node instanceof THREE.Mesh) {
      node.geometry.dispose();
      const material = node.material;
      if (Array.isArray(material)) material.forEach((item) => item.dispose());
      else material.dispose();
    }
  });
}

function createFurnitureGroup(item: WebGLObject): THREE.Group {
  const group = new THREE.Group();
  group.userData = {
    kind: "object",
    id: item.id,
    signature: [item.kind, item.w, item.d, item.h].join("|"),
  };
  group.position.set(item.x, 0, item.y);
  group.rotation.y = -item.rotation * Math.PI / 180;

  const wood = new THREE.MeshStandardMaterial({
    color: furnitureColors[item.kind], roughness: 0.72, metalness: 0.04,
  });
  const trim = new THREE.MeshStandardMaterial({ color: 0xc8a66c, roughness: 0.46 });
  const dark = new THREE.MeshStandardMaterial({ color: 0x292827, roughness: 0.8 });

  if (item.kind === "column") {
    const radius = Math.max(0.12, item.w * 0.36);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius * 1.12, item.h * 0.88, 24), wood);
    shaft.position.y = item.h * 0.5;
    shaft.castShadow = true;
    shaft.receiveShadow = true;
    group.add(shaft);
    const base = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.35, radius * 1.45, item.h * 0.06, 24), trim);
    base.position.y = item.h * 0.045;
    group.add(base);
    const capital = new THREE.Mesh(new THREE.CylinderGeometry(radius * 1.45, radius * 1.15, item.h * 0.07, 24), trim);
    capital.position.y = item.h * 0.91;
    group.add(capital);
  } else if (item.kind === "pew" || item.kind === "chair") {
    const seatY = Math.max(0.38, item.h * 0.78);
    const legHeight = seatY - 0.08;
    const leg = Math.max(0.045, Math.min(item.w, item.d) * 0.12);
    for (const x of [-item.w * 0.42, item.w * 0.42]) {
      for (const z of [-item.d * 0.32, item.d * 0.32]) {
        addBox(group, [leg, legHeight, leg], [x, legHeight / 2, z], dark);
      }
    }
    addBox(group, [item.w, 0.12, item.d], [0, seatY, 0], wood);
    const backHeight = Math.max(0.5, item.h * 1.1);
    addBox(group, [item.w, backHeight, 0.12], [0, seatY + backHeight / 2 - 0.02, -item.d * 0.42], wood);
    addBox(group, [item.w * 0.92, 0.045, item.d * 0.84], [0, seatY + 0.07, 0], trim, false);
    if (item.kind === "pew") {
      addBox(group, [item.w * 0.92, 0.08, item.d * 0.18], [0, seatY + backHeight * 0.83, -item.d * 0.42], trim);
    }
  } else if (item.kind === "altar") {
    addBox(group, [item.w * 0.84, item.h * 0.72, item.d * 0.78], [0, item.h * 0.36, 0], wood);
    addBox(group, [item.w, item.h * 0.12, item.d], [0, item.h * 0.78, 0], trim);
    addBox(group, [item.w * 0.76, 0.07, item.d * 0.7], [0, item.h * 0.87, 0], wood);
  } else if (item.kind === "pulpit") {
    addBox(group, [item.w * 0.72, item.h * 0.72, item.d * 0.72], [0, item.h * 0.36, 0], wood);
    addBox(group, [item.w, 0.12, item.d], [0, item.h * 0.76, 0], trim);
    addBox(group, [item.w * 0.92, 0.08, item.d * 0.7], [0, item.h * 0.9, -item.d * 0.04], wood);
  } else {
    addBox(group, [item.w, item.h, item.d], [0, item.h / 2, 0], wood);
    if (item.kind === "stage") {
      addBox(group, [item.w * 0.96, 0.08, item.d * 0.96], [0, item.h + 0.04, 0], trim);
    }
  }
  return group;
}

function createBeamGeometry(horizontalDeg: number, verticalDeg: number, radius: number): THREE.BufferGeometry {
  const positions: number[] = [];
  const halfH = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(horizontalDeg, 5, 180) / 2);
  const halfV = THREE.MathUtils.degToRad(THREE.MathUtils.clamp(verticalDeg, 5, 160) / 2);
  const steps = 32;
  const point = (h: number, v: number): [number, number, number] => [
    radius * Math.cos(v) * Math.cos(h),
    radius * Math.sin(v),
    radius * Math.cos(v) * Math.sin(h),
  ];
  const origin: [number, number, number] = [0, 0, 0];
  const triangle = (a: number[], b: number[], c: number[]) => positions.push(...a, ...b, ...c);
  for (let i = 0; i < steps; i++) {
    const h0 = -halfH + (i / steps) * halfH * 2;
    const h1 = -halfH + ((i + 1) / steps) * halfH * 2;
    const top0 = point(h0, halfV), top1 = point(h1, halfV);
    const bottom0 = point(h0, -halfV), bottom1 = point(h1, -halfV);
    triangle(origin, top0, top1);
    triangle(origin, bottom1, bottom0);
    triangle(top0, bottom0, bottom1);
    triangle(top0, bottom1, top1);
    if (i === 0) triangle(origin, top0, bottom0);
    if (i === steps - 1) triangle(origin, bottom1, top1);
  }
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.computeVertexNormals();
  return geometry;
}

function createSpeakerGroup(speaker: WebGLSpeaker, index: number, roomLength: number, roomWidth: number): THREE.Group {
  const group = new THREE.Group();
  const isColumn = /CBT|MA12|column/i.test(speaker.model);
  const isSub = /sub|subwoofer|SRX/i.test(speaker.model);
  const width = isSub ? 0.62 : isColumn ? 0.28 : 0.42;
  const height = isSub ? 0.48 : isColumn ? 1.12 : 0.68;
  const depth = isSub ? 0.58 : isColumn ? 0.24 : 0.32;
  const tint = new THREE.Color(speakerColors[index % speakerColors.length]);
  group.userData = {
    kind: "speaker",
    id: speaker.id,
    // Keep the creation signature identical to the reconciliation signature below.
    // Including room dimensions rebuilds the beam when the room is resized; index
    // keeps the speaker tint correct if the speaker list is reordered.
    signature: [speaker.model, speaker.coverage, speaker.verticalCoverage, roomLength, roomWidth, index].join("|"),
  };
  group.position.set(speaker.x, speaker.z, speaker.y);

  const cabinet = new THREE.MeshStandardMaterial({
    color: tint, emissive: tint, emissiveIntensity: 0.09, metalness: 0.22, roughness: 0.55,
  });
  const grille = new THREE.MeshStandardMaterial({ color: 0x18232a, metalness: 0.12, roughness: 0.9 });
  addBox(group, [width, height, depth], [0, 0, 0], cabinet);
  addBox(group, [width * 0.78, height * 0.8, 0.025], [0, 0, depth * 0.51], grille, false);
  for (const y of [-height * 0.26, 0, height * 0.26]) {
    const driver = new THREE.Mesh(
      new THREE.CircleGeometry(Math.min(width, height) * 0.13, 16),
      new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.72 }),
    );
    driver.position.set(0, y, depth * 0.53);
    group.add(driver);
  }

  const radius = Math.max(3, Math.hypot(roomLength, roomWidth) * 0.65);
  const beam = new THREE.Mesh(
    createBeamGeometry(speaker.coverage, speaker.verticalCoverage, radius),
    new THREE.MeshBasicMaterial({
      color: tint, transparent: true, opacity: 0.075,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  beam.userData.noDrag = true;
  group.add(beam);
  const halfAngle = THREE.MathUtils.degToRad(Math.max(5, Math.min(180, speaker.coverage)) / 2);
  const shape = new THREE.Shape();
  shape.moveTo(0, 0);
  const steps = 40;
  for (let i = 0; i <= steps; i++) {
    const angle = -halfAngle + (i / steps) * halfAngle * 2;
    shape.lineTo(radius * Math.cos(angle), radius * Math.sin(angle));
  }
  shape.closePath();
  const sector = new THREE.Mesh(
    new THREE.ShapeGeometry(shape),
    new THREE.MeshBasicMaterial({
      color: tint, transparent: true, opacity: 0.18,
      side: THREE.DoubleSide, depthWrite: false,
    }),
  );
  sector.rotation.set(-Math.PI / 2, 0, 0);
  sector.position.y = -speaker.z - 0.025;
  sector.userData.noDrag = true;
  group.add(sector);

  const halo = new THREE.Mesh(
    new THREE.TorusGeometry(0.42, 0.025, 6, 40),
    new THREE.MeshBasicMaterial({ color: tint, transparent: true, opacity: 0.9 }),
  );
  halo.rotation.x = Math.PI / 2;
  halo.position.y = -speaker.z + 0.03;
  halo.userData.noDrag = true;
  group.add(halo);
  return group;
}

function addChurchArchitecture(scene: THREE.Scene, length: number, width: number, height: number): void {
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x8b9695, roughness: 0.88, transparent: true, opacity: 0.23, side: THREE.DoubleSide,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x8b785d, roughness: 0.65 });
  const glassColors = [0x3a91b0, 0x8f5d98, 0xd6a44e, 0x4d8d82, 0xb55e55];

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    new THREE.MeshStandardMaterial({ color: 0x4b382a, roughness: 0.88 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(length / 2, -0.02, width / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  const wallThickness = 0.18;
  addBox(scene, [length, height, wallThickness], [length / 2, height / 2, 0], wallMaterial, false);
  addBox(scene, [wallThickness, height, width], [0, height / 2, width / 2], wallMaterial, false);
  addBox(scene, [wallThickness, height, width], [length, height / 2, width / 2], wallMaterial, false);
  addBox(scene, [length, 0.18, width], [length / 2, height, width / 2], wallMaterial, false);

  const floorGrid = new THREE.GridHelper(Math.max(length, width), Math.max(16, Math.round(Math.max(length, width) * 2)), 0x9b876d, 0x695947);
  floorGrid.position.set(length / 2, 0.005, width / 2);
  (floorGrid.material as THREE.Material).transparent = true;
  (floorGrid.material as THREE.Material).opacity = 0.16;
  scene.add(floorGrid);

  // Stained-glass window bays on both long side walls.
  for (const x of [0.11, length - 0.11]) {
    for (const z of [width * 0.2, width * 0.5, width * 0.8]) {
      addBox(scene, [0.08, height * 0.36, width * 0.11], [x, height * 0.57, z], trimMaterial);
      for (let pane = 0; pane < 5; pane++) {
        const paneMaterial = new THREE.MeshBasicMaterial({
          color: glassColors[pane], transparent: true, opacity: 0.74, side: THREE.DoubleSide,
        });
        addBox(scene, [0.035, height * 0.29, width * 0.016], [
          x + (x < length / 2 ? 0.055 : -0.055),
          height * 0.57,
          z + (pane - 2) * width * 0.018,
        ], paneMaterial, false);
      }
    }
  }

  // Repeating stone arches make the nave read as a church rather than a plain box.
  const archMaterial = new THREE.MeshStandardMaterial({ color: 0x9b8b73, roughness: 0.64 });
  const archCount = Math.max(3, Math.floor(length / 5));
  for (let i = 1; i <= archCount; i++) {
    const x = (length * i) / (archCount + 1);
    const points: THREE.Vector3[] = [];
    for (let j = 0; j <= 24; j++) {
      const t = j / 24;
      const z = width * t;
      const y = height * (0.73 + 0.2 * Math.sin(Math.PI * t));
      points.push(new THREE.Vector3(x, y, z));
    }
    const curve = new THREE.CatmullRomCurve3(points);
    const arch = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, 0.105, 8, false), archMaterial);
    arch.castShadow = true;
    scene.add(arch);
  }

  // A simple cross and sanctuary light define the altar end of the room.
  const crossMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9bd80, metalness: 0.34, roughness: 0.35, emissive: 0x6a4d20, emissiveIntensity: 0.14,
  });
  const crossX = length - 0.34;
  addBox(scene, [0.14, height * 0.31, 0.22], [crossX, height * 0.58, width / 2], crossMaterial);
  addBox(scene, [0.14, 0.22, width * 0.16], [crossX, height * 0.63, width / 2], crossMaterial);

  for (let i = 1; i <= 4; i++) {
    const x = length * i / 5;
    const light = new THREE.PointLight(0xffd9a3, 0.55, Math.max(length, width) * 0.55, 2);
    light.position.set(x, height * 0.68, width / 2);
    scene.add(light);
    const fitting = new THREE.Mesh(
      new THREE.SphereGeometry(0.12, 12, 8),
      new THREE.MeshStandardMaterial({ color: 0xd7c5a2, emissive: 0x8b6b3e, emissiveIntensity: 0.3 }),
    );
    fitting.position.copy(light.position);
    scene.add(fitting);
  }
}

export default function ChurchSceneWebGL(props: Props) {
  const host = useRef<HTMLDivElement>(null);
  const latest = useRef(props);
  const api = useRef<{
    scene: THREE.Scene;
    camera: THREE.PerspectiveCamera;
    renderer: THREE.WebGLRenderer;
    controls: OrbitControls;
    groups: Map<string, THREE.Group>;
    raycaster: THREE.Raycaster;
    pointer: THREE.Vector2;
    drag: { kind: "speaker" | "object"; id: number; group: THREE.Group; originX: number; originZ: number } | null;
    floorPlane: THREE.Plane;
  } | null>(null);
  const [webglError, setWebglError] = useState(false);
  latest.current = props;

  useEffect(() => {
    const element = host.current;
    if (!element) return;
    let renderer: THREE.WebGLRenderer;
    try {
      renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: "high-performance" });
    } catch {
      setWebglError(true);
      return;
    }

    setWebglError(false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.5));
    renderer.setSize(element.clientWidth, element.clientHeight);
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x111923);
    scene.fog = new THREE.Fog(0x111923, Math.max(props.length, props.width) * 2.6, Math.max(props.length, props.width) * 6);

    const camera = new THREE.PerspectiveCamera(48, element.clientWidth / Math.max(1, element.clientHeight), 0.1, 250);
    camera.position.set(props.length * 0.5, props.height * 1.42, props.width * 1.72);
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.target.set(props.length * 0.5, props.height * 0.32, props.width * 0.5);
    controls.enableDamping = true;
    controls.dampingFactor = 0.075;
    controls.maxPolarAngle = Math.PI * 0.49;
    controls.minDistance = 3;
    controls.maxDistance = Math.max(props.length, props.width) * 4;

    scene.add(new THREE.HemisphereLight(0xd9eaff, 0x40342b, 1.75));
    const ambient = new THREE.AmbientLight(0xffffff, 0.38);
    scene.add(ambient);
    const daylight = new THREE.DirectionalLight(0xffe4c1, 2.2);
    daylight.position.set(-props.length * 0.4, props.height * 2.5, props.width * 1.7);
    daylight.castShadow = true;
    daylight.shadow.mapSize.set(1024, 1024);
    daylight.shadow.camera.left = -props.length;
    daylight.shadow.camera.right = props.length;
    daylight.shadow.camera.top = props.width * 2;
    daylight.shadow.camera.bottom = -props.width * 2;
    scene.add(daylight);

    addChurchArchitecture(scene, props.length, props.width, props.height);

    const groups = new Map<string, THREE.Group>();
    const state = {
      scene,
      camera,
      renderer,
      controls,
      groups,
      raycaster: new THREE.Raycaster(),
      pointer: new THREE.Vector2(),
      drag: null as { kind: "speaker" | "object"; id: number; group: THREE.Group; originX: number; originZ: number } | null,
      floorPlane: new THREE.Plane(new THREE.Vector3(0, 1, 0), 0),
    };
    api.current = state;

    const resize = () => {
      const widthNow = Math.max(1, element.clientWidth);
      const heightNow = Math.max(1, element.clientHeight);
      camera.aspect = widthNow / heightNow;
      camera.updateProjectionMatrix();
      renderer.setSize(widthNow, heightNow);
    };
    const observer = typeof ResizeObserver !== "undefined" ? new ResizeObserver(resize) : null;
    observer?.observe(element);
    window.addEventListener("resize", resize);

    const pointerDown = (event: PointerEvent) => {
      const rect = renderer.domElement.getBoundingClientRect();
      state.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      state.raycaster.setFromCamera(state.pointer, camera);
      const hit = state.raycaster.intersectObjects([...groups.values()], true).find((candidate) => {
        if (candidate.object.userData.noDrag) return false;
        let root: THREE.Object3D | null = candidate.object;
        while (root && !root.userData.kind) root = root.parent;
        return root !== null;
      });
      if (!hit) return;
      let node: THREE.Object3D | null = hit.object;
      while (node && !node.userData.kind) node = node.parent;
      if (!node) return;
      const kind = node.userData.kind as "speaker" | "object";
      const id = node.userData.id as number;
      const group = groups.get((kind === "speaker" ? "s:" : "o:") + id);
      if (!group) return;
      state.drag = {
        kind, id, group,
        originX: group.position.x,
        originZ: group.position.z,
      };
      controls.enabled = false;
      renderer.domElement.setPointerCapture(event.pointerId);
      if (kind === "speaker") latest.current.onSelectSpeaker(id);
      else latest.current.onSelectObject(id);
      event.preventDefault();
    };

    const pointerMove = (event: PointerEvent) => {
      if (!state.drag) return;
      const rect = renderer.domElement.getBoundingClientRect();
      state.pointer.set((event.clientX - rect.left) / rect.width * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
      state.raycaster.setFromCamera(state.pointer, camera);
      const point = new THREE.Vector3();
      if (state.raycaster.ray.intersectPlane(state.floorPlane, point)) {
        state.drag.group.position.x = THREE.MathUtils.clamp(point.x, 0, props.length);
        state.drag.group.position.z = THREE.MathUtils.clamp(point.z, 0, props.width);
      }
    };

    const releasePointer = (event: PointerEvent) => {
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    const pointerUp = (event: PointerEvent) => {
      if (!state.drag) return;
      const dragged = state.drag;
      if (dragged.kind === "speaker") {
        latest.current.onMoveSpeaker(dragged.id, dragged.group.position.x, dragged.group.position.z);
      } else {
        latest.current.onMoveObject(dragged.id, dragged.group.position.x, dragged.group.position.z);
      }
      state.drag = null;
      controls.enabled = true;
      releasePointer(event);
    };

    // A cancelled touch/gesture must not commit a partially dragged object.
    const pointerCancel = (event: PointerEvent) => {
      if (!state.drag) return;
      state.drag.group.position.set(state.drag.originX, state.drag.group.position.y, state.drag.originZ);
      state.drag = null;
      controls.enabled = true;
      releasePointer(event);
    };

    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerCancel);

    let frameId = 0;
    let lastFrameTime = 0;
    let contextLost = false;
    const handleContextLost = (event: Event) => {
      event.preventDefault();
      contextLost = true;
      cancelAnimationFrame(frameId);
      frameId = 0;
      setWebglError(true);
    };
    const handleContextRestored = () => {
      // Rebuild the renderer/scene from the latest React props after context recovery.
      setWebglError(false);
      setWebglError(true);
    };
    renderer.domElement.addEventListener("webglcontextlost", handleContextLost, false);
    renderer.domElement.addEventListener("webglcontextrestored", handleContextRestored, false);
    const render = (time: number) => {
      if (document.hidden || contextLost) return;
      frameId = requestAnimationFrame(render);
      if (time - lastFrameTime < 1000 / 30) return;
      lastFrameTime = time;
      controls.update();
      renderer.render(scene, camera);
    };
    const handleVisibility = () => {
      if (document.hidden) {
        cancelAnimationFrame(frameId);
        frameId = 0;
      } else if (!frameId) {
        lastFrameTime = 0;
        frameId = requestAnimationFrame(render);
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", handleVisibility);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerCancel);
      renderer.domElement.removeEventListener("webglcontextlost", handleContextLost);
      renderer.domElement.removeEventListener("webglcontextrestored", handleContextRestored);
      controls.dispose();
      for (const group of groups.values()) disposeObject(group);
      groups.clear();
      disposeObject(scene);
      renderer.dispose();
      renderer.domElement.remove();
      api.current = null;
    };
  }, [props.length, props.width, props.height]);

  useEffect(() => {
    const state = api.current;
    if (!state) return;
    const liveKeys = new Set<string>();

    props.objects.forEach((item) => {
      const key = "o:" + item.id;
      liveKeys.add(key);
      let group = state.groups.get(key);
      const signature = [item.kind, item.w, item.d, item.h].join("|");
      if (group && group.userData.signature !== signature) {
        state.scene.remove(group);
        disposeObject(group);
        state.groups.delete(key);
        group = undefined;
      }
      if (!group) {
        group = createFurnitureGroup(item);
        state.scene.add(group);
        state.groups.set(key, group);
      }
      if (!state.drag || state.drag.id !== item.id || state.drag.kind !== "object") {
        group.position.set(item.x, 0, item.y);
        group.rotation.y = -item.rotation * Math.PI / 180;
      }
      group.scale.setScalar(item.id === props.selectedObject ? 1.035 : 1);
    });

    props.speakers.forEach((speaker, index) => {
      const key = "s:" + speaker.id;
      liveKeys.add(key);
      let group = state.groups.get(key);
      const signature = [speaker.model, speaker.coverage, speaker.verticalCoverage, props.length, props.width, index].join("|");
      if (group && group.userData.signature !== signature) {
        state.scene.remove(group);
        disposeObject(group);
        state.groups.delete(key);
        group = undefined;
      }
      if (!group) {
        group = createSpeakerGroup(speaker, index, props.length, props.width);
        state.scene.add(group);
        state.groups.set(key, group);
      }
      if (!state.drag || state.drag.id !== speaker.id || state.drag.kind !== "speaker") {
        group.position.set(speaker.x, speaker.z, speaker.y);
      }
      group.rotation.y = -THREE.MathUtils.degToRad(speaker.azimuth);
      group.scale.setScalar(speaker.id === props.selectedSpeaker ? 1.08 : 1);
    });

    for (const [key, group] of state.groups) {
      if (!liveKeys.has(key)) {
        state.scene.remove(group);
        disposeObject(group);
        state.groups.delete(key);
      }
    }
  }, [props.speakers, props.objects, props.selectedSpeaker, props.selectedObject]);

  return (
    <div
      className="church-webgl"
      ref={host}
      role="application"
      aria-label="Mô hình nhà thờ 3D. Kéo nền để xoay, cuộn để thu phóng; kéo loa hoặc nội thất để di chuyển."
    >
      <div className="webgl-hint">CHURCH 3D · KÉO NỀN ĐỂ XOAY · CUỘN ĐỂ ZOOM · KÉO LOA / NỘI THẤT ĐỂ DI CHUYỂN</div>
      {webglError && (
        <div className="webgl-error">
          Thiết bị chưa khởi tạo được WebGL. Hãy dùng chế độ Mặt bằng 2D hoặc bật tăng tốc đồ họa trong WebView.
        </div>
      )}
    </div>
  );
}
