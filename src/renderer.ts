import * as THREE from "three";
import { centralBodyRadius, normalize } from "./physics";
import type { SimObject, SimulationState, Vector2 } from "./types";

type ScreenPoint = {
  x: number;
  y: number;
};

export class Renderer {
  private readonly renderer: THREE.WebGLRenderer;
  private readonly scene = new THREE.Scene();
  private readonly camera = new THREE.PerspectiveCamera(44, 1, 1, 5000);
  private readonly raycaster = new THREE.Raycaster();
  private readonly pointer = new THREE.Vector2();
  private readonly surfaceGroup = new THREE.Group();
  private readonly dynamicGroup = new THREE.Group();
  private readonly surfaceMaterial = new THREE.MeshStandardMaterial({
    color: 0x273239,
    roughness: 0.84,
    metalness: 0.03,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.72
  });
  private readonly wireMaterial = new THREE.LineBasicMaterial({
    color: 0x5bd6d0,
    transparent: true,
    opacity: 0.33
  });

  private width = 1;
  private height = 1;
  private surfaceMesh: THREE.Mesh<THREE.PlaneGeometry, THREE.MeshStandardMaterial>;
  private surfaceWire: THREE.LineSegments | null = null;
  private lastSurfaceKey = "";
  private readonly surfaceSize = 960;
  private readonly surfaceSegments = 78;
  private readonly cameraTarget = new THREE.Vector3(0, -40, 0);
  private cameraAzimuth = 0;
  private cameraElevation = 0.54;
  private cameraDistance = 750;

  constructor(private readonly canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false
    });
    this.renderer.setClearColor(0x101317, 1);
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;

    this.surfaceMesh = new THREE.Mesh(this.createSurfaceGeometry(null), this.surfaceMaterial);
    this.surfaceGroup.add(this.surfaceMesh);
    this.scene.add(this.surfaceGroup);
    this.scene.add(this.dynamicGroup);

    this.setupScene();
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.width = Math.max(320, rect.width);
    this.height = Math.max(320, rect.height);

    this.renderer.setPixelRatio(Math.min(2, ratio));
    this.renderer.setSize(this.width, this.height, false);
    this.camera.aspect = this.width / this.height;
    this.camera.updateProjectionMatrix();
    this.updateCameraPosition();
  }

  rotateCamera(deltaX: number, deltaY: number): void {
    this.cameraAzimuth -= deltaX * 0.008;
    this.cameraElevation = THREE.MathUtils.clamp(this.cameraElevation + deltaY * 0.005, -1.55, 1.55);
    this.updateCameraPosition();
  }

  zoomCamera(deltaY: number): void {
    this.cameraDistance = THREE.MathUtils.clamp(this.cameraDistance + deltaY * 0.55, 430, 1250);
    this.updateCameraPosition();
  }

  resetCamera(): void {
    this.cameraAzimuth = 0;
    this.cameraElevation = 0.54;
    this.cameraDistance = 750;
    this.updateCameraPosition();
  }

  screenToWorld(point: ScreenPoint, state: SimulationState): Vector2 {
    this.updateSurface(state);
    this.pointer.set((point.x / this.width) * 2 - 1, -(point.y / this.height) * 2 + 1);
    this.raycaster.setFromCamera(this.pointer, this.camera);

    const hit = this.raycaster.intersectObject(this.surfaceMesh, false)[0];
    if (hit) {
      return { x: hit.point.x, y: hit.point.z };
    }

    const fallbackPlane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    const fallbackPoint = new THREE.Vector3();
    this.raycaster.ray.intersectPlane(fallbackPlane, fallbackPoint);
    return { x: fallbackPoint.x, y: fallbackPoint.z };
  }

  worldToScreen(position: Vector2, state: SimulationState): ScreenPoint {
    const point = this.worldToThree(position, state).project(this.camera);
    return {
      x: ((point.x + 1) / 2) * this.width,
      y: ((-point.y + 1) / 2) * this.height
    };
  }

  surfaceHeight(position: Vector2, state: SimulationState): number {
    const { centralMass, softening, visualWarp } = state.params;
    if (centralMass <= 0 || visualWarp <= 0) return 0;

    const r = Math.sqrt(position.x * position.x + position.y * position.y + softening * softening);
    const z = (-70 * visualWarp * centralMass) / r;
    return Math.max(z, -250);
  }

  render(state: SimulationState): void {
    this.updateSurface(state);
    this.drawDynamicScene(state);
    this.renderer.render(this.scene, this.camera);
  }

  private setupScene(): void {
    this.scene.fog = new THREE.Fog(0x101317, 760, 1800);

    const ambient = new THREE.AmbientLight(0xc8f6ff, 1.2);
    const key = new THREE.DirectionalLight(0xfff0c0, 2.8);
    key.position.set(-260, 460, 320);
    const fill = new THREE.PointLight(0xf58d56, 70_000, 900);
    fill.position.set(0, -90, 0);

    this.scene.add(ambient, key, fill);

    this.updateCameraPosition();
  }

  private updateCameraPosition(): void {
    const horizontalDistance = Math.cos(this.cameraElevation) * this.cameraDistance;
    this.camera.position.set(
      Math.sin(this.cameraAzimuth) * horizontalDistance,
      Math.sin(this.cameraElevation) * this.cameraDistance,
      Math.cos(this.cameraAzimuth) * horizontalDistance
    );
    this.camera.lookAt(this.cameraTarget);
  }

  private updateSurface(state: SimulationState): void {
    const params = state.params;
    const surfaceKey = [
      params.centralMass.toFixed(2),
      params.visualWarp.toFixed(2),
      params.softening.toFixed(2),
      this.width,
      this.height
    ].join(":");

    if (surfaceKey === this.lastSurfaceKey) return;
    this.lastSurfaceKey = surfaceKey;

    const nextGeometry = this.createSurfaceGeometry(state);
    this.surfaceMesh.geometry.dispose();
    this.surfaceMesh.geometry = nextGeometry;

    if (this.surfaceWire) {
      this.surfaceWire.geometry.dispose();
      this.surfaceGroup.remove(this.surfaceWire);
    }

    const wireGeometry = new THREE.WireframeGeometry(nextGeometry);
    this.surfaceWire = new THREE.LineSegments(wireGeometry, this.wireMaterial);
    this.surfaceGroup.add(this.surfaceWire);
  }

  private createSurfaceGeometry(state: SimulationState | null): THREE.PlaneGeometry {
    const geometry = new THREE.PlaneGeometry(this.surfaceSize, this.surfaceSize, this.surfaceSegments, this.surfaceSegments);
    const positions = geometry.attributes.position;

    for (let i = 0; i < positions.count; i++) {
      const x = positions.getX(i);
      const z = positions.getY(i);
      const y = state ? this.surfaceHeight({ x, y: z }, state) : 0;
      positions.setXYZ(i, x, y, z);
    }

    positions.needsUpdate = true;
    geometry.computeVertexNormals();
    return geometry;
  }

  private drawDynamicScene(state: SimulationState): void {
    this.clearGroup(this.dynamicGroup);
    this.addFunnelGuides(state);
    this.addCentralMass(state);
    this.addTrails(state);
    this.addObjects(state);
    this.addDragPreview(state);
  }

  private clearGroup(group: THREE.Group): void {
    for (const child of [...group.children]) {
      child.traverse((object: THREE.Object3D) => {
        const disposable = object as {
          geometry?: THREE.BufferGeometry;
          material?: THREE.Material | THREE.Material[];
        };

        disposable.geometry?.dispose();
        if (Array.isArray(disposable.material)) {
          disposable.material.forEach((material) => this.disposeMaterial(material));
        } else if (disposable.material) {
          this.disposeMaterial(disposable.material);
        }
      });
      group.remove(child);
    }
  }

  private disposeMaterial(material: THREE.Material): void {
    const maybeTextured = material as THREE.Material & { map?: THREE.Texture };
    maybeTextured.map?.dispose();
    material.dispose();
  }

  private addFunnelGuides(state: SimulationState): void {
    if (state.params.centralMass <= 0) return;

    const ringMaterial = new THREE.LineBasicMaterial({
      color: 0xffdc88,
      transparent: true,
      opacity: 0.28
    });

    [52, 78, 112, 156, 212, 282, 366].forEach((radius, index) => {
      const points: THREE.Vector3[] = [];
      for (let i = 0; i <= 160; i++) {
        const angle = (i / 160) * Math.PI * 2;
        points.push(this.worldToThree({ x: Math.cos(angle) * radius, y: Math.sin(angle) * radius }, state));
      }

      const line = new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), ringMaterial.clone());
      const material = line.material as THREE.LineBasicMaterial;
      material.opacity = Math.max(0.08, 0.24 - index * 0.02);
      this.dynamicGroup.add(line);
    });

    const spokeMaterial = new THREE.LineBasicMaterial({
      color: 0x9fefff,
      transparent: true,
      opacity: 0.16
    });

    for (let angle = 0; angle < Math.PI * 2; angle += Math.PI / 12) {
      const points: THREE.Vector3[] = [];
      for (let r = 42; r <= 420; r += 20) {
        points.push(this.worldToThree({ x: Math.cos(angle) * r, y: Math.sin(angle) * r }, state));
      }
      this.dynamicGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), spokeMaterial));
    }
  }

  private addCentralMass(state: SimulationState): void {
    const radius = Math.max(8, centralBodyRadius(state.params));
    const surfaceY = this.surfaceHeight({ x: 0, y: 0 }, state);
    const geometry = new THREE.SphereGeometry(radius, 48, 32);
    const material = new THREE.MeshStandardMaterial({
      color: 0xf2a15d,
      emissive: 0x7a261c,
      emissiveIntensity: 0.22,
      roughness: 0.45
    });
    const sphere = new THREE.Mesh(geometry, material);
    sphere.position.set(0, surfaceY + radius, 0);
    this.dynamicGroup.add(sphere);

    const glowGeometry = new THREE.SphereGeometry(radius * 1.65, 36, 24);
    const glowMaterial = new THREE.MeshBasicMaterial({
      color: 0xffa85c,
      transparent: true,
      opacity: 0.12,
      depthWrite: false
    });
    const glow = new THREE.Mesh(glowGeometry, glowMaterial);
    glow.position.copy(sphere.position);
    this.dynamicGroup.add(glow);

  }

  private addTrails(state: SimulationState): void {
    for (const object of state.objects) {
      if (object.trail.length < 2) continue;

      const color = object.type === "light" ? 0xffdf66 : 0x6bdfff;
      const material = new THREE.LineBasicMaterial({
        color,
        transparent: true,
        opacity: object.type === "light" ? 0.78 : 0.68
      });
      const points = object.trail.map((point) => this.worldToThree(point, state, 5));
      this.dynamicGroup.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(points), material));
    }
  }

  private addObjects(state: SimulationState): void {
    for (const object of state.objects) {
      const position = this.worldToThree(object.position, state, 8);
      const radius = object.type === "light" ? 5 : 7;
      const color = object.type === "light" ? 0xffdf66 : object.active ? 0x6bdfff : 0x9aa3a8;
      const geometry = new THREE.SphereGeometry(radius, 20, 12);
      const material = new THREE.MeshStandardMaterial({
        color,
        emissive: color,
        emissiveIntensity: object.active ? 0.16 : 0.02,
        roughness: 0.5
      });
      const mesh = new THREE.Mesh(geometry, material);
      mesh.position.copy(position);
      this.dynamicGroup.add(mesh);

      if (state.showVectors && object.active) {
        this.addVelocityArrow(object, state);
      }
    }
  }

  private addVelocityArrow(object: SimObject, state: SimulationState): void {
    const direction2 = normalize(object.velocity);
    const start = this.worldToThree(object.position, state, 14);
    const endWorld = {
      x: object.position.x + direction2.x * 48,
      y: object.position.y + direction2.y * 48
    };
    const end = this.worldToThree(endWorld, state, 14);
    const direction3 = end.clone().sub(start).normalize();
    const color = object.type === "light" ? 0xffdf66 : 0x6bdfff;
    this.dynamicGroup.add(new THREE.ArrowHelper(direction3, start, start.distanceTo(end), color, 14, 8));
  }

  private addDragPreview(state: SimulationState): void {
    if (!state.drag?.active) return;

    const start = this.worldToThree(state.drag.start, state, 16);
    const end = this.worldToThree(state.drag.current, state, 16);
    const direction = end.clone().sub(start);
    if (direction.length() < 1) return;

    const color = state.selectedType === "light" ? 0xffdf66 : 0x6bdfff;
    this.dynamicGroup.add(new THREE.ArrowHelper(direction.clone().normalize(), start, direction.length(), color, 18, 10));
  }

  private worldToThree(position: Vector2, state: SimulationState, lift = 0): THREE.Vector3 {
    return new THREE.Vector3(position.x, this.surfaceHeight(position, state) + lift, position.y);
  }

}
