import { useEffect, useRef, useState } from "react";
import * as THREE from "three";
import { OrbitControls } from "three/examples/jsm/controls/OrbitControls.js";

export type WebGLSpeaker = {
  id: number; name: string; model: string; x: number; y: number; z: number;
  azimuth: number; coverage: number;
};
export type WebGLMeasurementPosition = { id: string; label: string; zoneId: string; xM: number; yM: number; zM: number };
export type WebGLSplPoint = {
  id: string; label: string; xM: number; yM: number; zM: number;
  splDb: number; targetSplDb: number | null; sampleCount: number;
};
export type WebGLObject = {
  id: number; kind: "altar" | "pulpit" | "column" | "pew" | "chair" | "stage";
  name: string; x: number; y: number; w: number; d: number; h: number; rotation: number;
};
type Props = {
  length: number; width: number; height: number;
  speakers: WebGLSpeaker[]; objects: WebGLObject[]; measurementPositions: WebGLMeasurementPosition[]; splPoints: WebGLSplPoint[];
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

function createSpeakerGroup(speaker: WebGLSpeaker, index: number): THREE.Group {
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
    signature: [speaker.model, speaker.coverage].join("|"),
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

  const radius = Math.max(speaker.coverage > 120 ? 5 : 3, Math.max(18, width * 1.7));
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

function createSurface(
  vertices: [number, number, number][],
  material: THREE.Material,
): THREE.Mesh {
  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(vertices.flat(), 3));
  geometry.setIndex([0, 1, 2, 0, 2, 3]);
  geometry.computeVertexNormals();
  const mesh = new THREE.Mesh(geometry, material);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

function addBeam(
  scene: THREE.Scene,
  start: THREE.Vector3,
  end: THREE.Vector3,
  radius: number,
  material: THREE.Material,
): void {
  const direction = new THREE.Vector3().subVectors(end, start);
  const beam = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, direction.length(), 8),
    material,
  );
  beam.position.copy(start).add(end).multiplyScalar(0.5);
  beam.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), direction.normalize());
  beam.castShadow = true;
  scene.add(beam);
}

function addChurchArchitecture(scene: THREE.Scene, length: number, width: number, height: number): void {
  const wallMaterial = new THREE.MeshStandardMaterial({
    color: 0x9a9b91, roughness: 0.9, transparent: true, opacity: 0.2, side: THREE.DoubleSide,
  });
  const trimMaterial = new THREE.MeshStandardMaterial({ color: 0x8b785d, roughness: 0.65 });
  const glassColors = [0x3a91b0, 0x8f5d98, 0xd6a44e, 0x4d8d82, 0xb55e55];
  const woodMaterial = new THREE.MeshStandardMaterial({ color: 0x493426, roughness: 0.78 });
  const roofMaterial = new THREE.MeshStandardMaterial({
    color: 0x514b43, roughness: 0.82, metalness: 0.04,
    transparent: true, opacity: 0.38, side: THREE.DoubleSide,
  });

  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(length, width),
    new THREE.MeshStandardMaterial({ color: 0x554333, roughness: 0.86 }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(length / 2, -0.02, width / 2);
  floor.receiveShadow = true;
  scene.add(floor);

  // A central carpeted aisle gives the nave a recognizable church layout.
  const aisleWidth = Math.max(1.1, Math.min(2.2, width * 0.1));
  addBox(scene, [length * 0.82, 0.018, aisleWidth], [length * 0.47, 0.006, width / 2], woodMaterial, false);

  const wallThickness = 0.18;
  addBox(scene, [length, height, wallThickness], [length / 2, height / 2, 0], wallMaterial, false);
  addBox(scene, [wallThickness, height, width], [0, height / 2, width / 2], wallMaterial, false);
  addBox(scene, [wallThickness, height, width], [length, height / 2, width / 2], wallMaterial, false);

  const floorGrid = new THREE.GridHelper(Math.max(length, width), Math.max(16, Math.round(Math.max(length, width) * 2)), 0x9b876d, 0x695947);
  floorGrid.position.set(length / 2, 0.005, width / 2);
  (floorGrid.material as THREE.Material).transparent = true;
  (floorGrid.material as THREE.Material).opacity = 0.12;
  scene.add(floorGrid);

  // Stained-glass window bays and mullions on both long nave walls.
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
      addBox(scene, [0.045, height * 0.31, 0.055], [x, height * 0.57, z], trimMaterial, false);
    }
  }

  // Nave roof: two pitched planes, gable end walls, ridge and exposed rafters.
  // Keeping the roof translucent preserves visibility of the acoustic layout below.
  const ridgeY = height + Math.max(1.25, Math.min(3.2, width * 0.13));
  const midZ = width / 2;
  scene.add(createSurface([
    [0, height, 0], [length, height, 0], [length, ridgeY, midZ], [0, ridgeY, midZ],
  ], roofMaterial));
  scene.add(createSurface([
    [0, ridgeY, midZ], [length, ridgeY, midZ], [length, height, width], [0, height, width],
  ], roofMaterial));
  // Close each gable with a dedicated triangle (the surface helper expects a quad).
  const makeGable = (x: number) => {
    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute("position", new THREE.Float32BufferAttribute([
      x, height, 0, x, height, width, x, ridgeY, midZ,
    ], 3));
    geometry.setIndex([0, 1, 2]);
    geometry.computeVertexNormals();
    const gable = new THREE.Mesh(geometry, wallMaterial);
    gable.receiveShadow = true;
    scene.add(gable);
  };
  makeGable(0.08);
  makeGable(length - 0.08);

  const timber = new THREE.MeshStandardMaterial({ color: 0x6e5942, roughness: 0.78 });
  addBox(scene, [length, 0.16, 0.18], [length / 2, ridgeY - 0.08, midZ], timber);
  addBox(scene, [length, 0.13, 0.16], [length / 2, height - 0.04, 0.08], timber);
  addBox(scene, [length, 0.13, 0.16], [length / 2, height - 0.04, width - 0.08], timber);
  const rafterCount = Math.max(4, Math.floor(length / 3.5));
  for (let i = 0; i <= rafterCount; i++) {
    const x = (length * i) / rafterCount;
    addBeam(scene, new THREE.Vector3(x, height, 0.12), new THREE.Vector3(x, ridgeY, midZ), 0.075, timber);
    addBeam(scene, new THREE.Vector3(x, height, width - 0.12), new THREE.Vector3(x, ridgeY, midZ), 0.075, timber);
  }

  // Repeating stone arches frame the nave and visually separate the side aisles.
  const archMaterial = new THREE.MeshStandardMaterial({ color: 0xa99a82, roughness: 0.64 });
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

  // Entrance portal and paired columns establish the front elevation.
  const portal = new THREE.MeshStandardMaterial({ color: 0x30251e, roughness: 0.82 });
  addBox(scene, [0.12, height * 0.58, width * 0.2], [0.13, height * 0.29, midZ], portal, false);
  const entryColumnMaterial = new THREE.MeshStandardMaterial({ color: 0xb5a58d, roughness: 0.7 });
  for (const z of [midZ - width * 0.17, midZ + width * 0.17]) {
    const pillar = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.24, height * 0.68, 20), entryColumnMaterial);
    pillar.position.set(0.42, height * 0.34, z);
    pillar.castShadow = true;
    scene.add(pillar);
    addBox(scene, [0.58, 0.14, 0.58], [0.42, height * 0.68, z], trimMaterial);
  }

  // A stronger transverse arch marks the sanctuary transition near the altar.
  const chancelPoints: THREE.Vector3[] = [];
  for (let j = 0; j <= 32; j++) {
    const t = j / 32;
    chancelPoints.push(new THREE.Vector3(
      length * 0.86,
      height * (0.62 + 0.3 * Math.sin(Math.PI * t)),
      width * t,
    ));
  }
  const chancel = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(chancelPoints), 48, 0.18, 10, false),
    new THREE.MeshStandardMaterial({ color: 0xc0a77b, roughness: 0.5 }),
  );
  chancel.castShadow = true;
  scene.add(chancel);

  // A simple cross and sanctuary light define the altar end of the room.
  const crossMaterial = new THREE.MeshStandardMaterial({
    color: 0xd9bd80, metalness: 0.34, roughness: 0.35, emissive: 0x6a4d20, emissiveIntensity: 0.14,
  });
  const crossX = length - 0.34;
  addBox(scene, [0.14, height * 0.31, 0.22], [crossX, height * 0.58, midZ], crossMaterial);
  addBox(scene, [0.14, 0.22, width * 0.16], [crossX, height * 0.63, midZ], crossMaterial);

  for (let i = 1; i <= 4; i++) {
    const x = length * i / 5;
    const light = new THREE.PointLight(0xffd9a3, 0.55, Math.max(length, width) * 0.55, 2);
    light.position.set(x, height * 0.68, midZ);
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
    drag: { kind: "speaker" | "object"; id: number; group: THREE.Group } | null;
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
      drag: null as { kind: "speaker" | "object"; id: number; group: THREE.Group } | null,
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
      state.drag = { kind, id, group };
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
      if (renderer.domElement.hasPointerCapture(event.pointerId)) {
        renderer.domElement.releasePointerCapture(event.pointerId);
      }
    };

    renderer.domElement.addEventListener("pointerdown", pointerDown);
    renderer.domElement.addEventListener("pointermove", pointerMove);
    renderer.domElement.addEventListener("pointerup", pointerUp);
    renderer.domElement.addEventListener("pointercancel", pointerUp);

    let frameId = 0;
    const render = () => {
      frameId = requestAnimationFrame(render);
      controls.update();
      renderer.render(scene, camera);
    };
    frameId = requestAnimationFrame(render);

    return () => {
      cancelAnimationFrame(frameId);
      observer?.disconnect();
      window.removeEventListener("resize", resize);
      renderer.domElement.removeEventListener("pointerdown", pointerDown);
      renderer.domElement.removeEventListener("pointermove", pointerMove);
      renderer.domElement.removeEventListener("pointerup", pointerUp);
      renderer.domElement.removeEventListener("pointercancel", pointerUp);
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
      const signature = [speaker.model, speaker.coverage].join("|");
      if (group && group.userData.signature !== signature) {
        state.scene.remove(group);
        disposeObject(group);
        state.groups.delete(key);
        group = undefined;
      }
      if (!group) {
        group = createSpeakerGroup(speaker, index);
        state.scene.add(group);
        state.groups.set(key, group);
      }
      if (!state.drag || state.drag.id !== speaker.id || state.drag.kind !== "speaker") {
        group.position.set(speaker.x, speaker.z, speaker.y);
      }
      group.rotation.y = -THREE.MathUtils.degToRad(speaker.azimuth);
      group.scale.setScalar(speaker.id === props.selectedSpeaker ? 1.08 : 1);
    });


    props.measurementPositions.forEach((point) => {
      const key = "p:" + point.id;
      liveKeys.add(key);
      let group = state.groups.get(key);
      if (!group) {
        group = new THREE.Group();
        const marker = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), new THREE.MeshBasicMaterial({ color: 0x56e0d0 }));
        marker.userData.noDrag = true;
        const halo = new THREE.Mesh(new THREE.TorusGeometry(0.28, 0.025, 6, 32), new THREE.MeshBasicMaterial({ color: 0xa7fff2, transparent: true, opacity: 0.9 }));
        halo.rotation.x = Math.PI / 2;
        halo.userData.noDrag = true;
        group.add(marker, halo);
        state.scene.add(group);
        state.groups.set(key, group);
      }
      group.position.set(point.xM, point.zM, point.yM);
    });


    props.splPoints.forEach((point) => {
      const key = "m:" + point.id;
      liveKeys.add(key);
      let group = state.groups.get(key);
      const delta = point.targetSplDb === null ? null : point.splDb - point.targetSplDb;
      const color = delta === null ? 0x56d7e8 : delta < -6 ? 0xe06b62 : delta > 6 ? 0xe5ad52 : 0x63d7a0;
      const signature = [color, point.sampleCount].join("|");
      if (group && group.userData.signature !== signature) {
        state.scene.remove(group);
        disposeObject(group);
        state.groups.delete(key);
        group = undefined;
      }
      if (!group) {
        group = new THREE.Group();
        group.userData.signature = signature;
        const marker = new THREE.Mesh(
          new THREE.SphereGeometry(0.22, 20, 14),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.96 }),
        );
        marker.userData.noDrag = true;
        const halo = new THREE.Mesh(
          new THREE.TorusGeometry(0.38, 0.035, 8, 36),
          new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.82 }),
        );
        halo.rotation.x = Math.PI / 2;
        halo.userData.noDrag = true;
        group.add(marker, halo);
        state.scene.add(group);
        state.groups.set(key, group);
      }
      group.position.set(point.xM, point.zM + 0.08, point.yM);
    });

    for (const [key, group] of state.groups) {
      if (!liveKeys.has(key)) {
        state.scene.remove(group);
        disposeObject(group);
        state.groups.delete(key);
      }
    }
  }, [props.speakers, props.objects, props.measurementPositions, props.splPoints, props.selectedSpeaker, props.selectedObject]);

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
