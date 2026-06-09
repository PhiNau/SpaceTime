import { accelerationForMass, normalize, scale } from "./physics";
import type { SimObject, SimulationState, Vector2 } from "./types";

type ScreenPoint = {
  x: number;
  y: number;
};

export class Renderer {
  private readonly ctx: CanvasRenderingContext2D;
  private width = 1;
  private height = 1;
  private scale = 1;
  private origin: ScreenPoint = { x: 0, y: 0 };

  constructor(private readonly canvas: HTMLCanvasElement) {
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Canvas 2D wird vom Browser nicht unterstützt.");
    }
    this.ctx = context;
    this.resize();
  }

  resize(): void {
    const rect = this.canvas.getBoundingClientRect();
    const ratio = window.devicePixelRatio || 1;
    this.width = Math.max(320, rect.width);
    this.height = Math.max(320, rect.height);
    this.canvas.width = Math.floor(this.width * ratio);
    this.canvas.height = Math.floor(this.height * ratio);
    this.ctx.setTransform(ratio, 0, 0, ratio, 0, 0);

    this.scale = Math.min(this.width / 920, this.height / 680);
    this.origin = {
      x: this.width * 0.5,
      y: this.height * 0.43
    };
  }

  screenToWorld(point: ScreenPoint): Vector2 {
    return {
      x: (point.x - this.origin.x) / this.scale,
      y: (point.y - this.origin.y) / (this.scale * 0.58)
    };
  }

  worldToScreen(position: Vector2, state: SimulationState): ScreenPoint {
    const z = this.surfaceHeight(position, state);
    return this.projectSurfacePoint(position.x, position.y, z);
  }

  surfaceHeight(position: Vector2, state: SimulationState): number {
    const { centralMass, softening, visualWarp } = state.params;
    if (centralMass <= 0) return 0;

    const r = Math.sqrt(position.x * position.x + position.y * position.y + softening * softening);
    const z = (-70 * visualWarp * centralMass) / r;
    return Math.max(z, -230);
  }

  projectSurfacePoint(x: number, y: number, z: number): ScreenPoint {
    return {
      x: this.origin.x + x * this.scale,
      y: this.origin.y + y * this.scale * 0.58 - z * this.scale * 0.95
    };
  }

  render(state: SimulationState): void {
    this.clear();
    this.drawGrid(state);
    this.drawTrails(state);
    this.drawCentralMass(state);
    this.drawObjects(state);
    this.drawDragPreview(state);
    this.drawLegend(state);
  }

  private clear(): void {
    const gradient = this.ctx.createLinearGradient(0, 0, 0, this.height);
    gradient.addColorStop(0, "#101317");
    gradient.addColorStop(0.62, "#161b1d");
    gradient.addColorStop(1, "#20201d");
    this.ctx.fillStyle = gradient;
    this.ctx.fillRect(0, 0, this.width, this.height);
  }

  private drawGrid(state: SimulationState): void {
    const extentX = Math.max(520, this.width / this.scale / 2 + 120);
    const extentY = Math.max(420, this.height / (this.scale * 0.58) / 2 + 100);
    const spacing = 50;
    const step = 14;

    this.ctx.save();
    this.ctx.lineWidth = 1.05;

    for (let x = -extentX; x <= extentX; x += spacing) {
      const points = Array.from({ length: Math.ceil((2 * extentY) / step) + 1 }, (_, index) => ({
        x,
        y: -extentY + index * step
      }));
      this.drawProjectedLine(points, state, "rgba(91, 214, 208, 0.30)");
    }

    for (let y = -extentY; y <= extentY; y += spacing) {
      const points = Array.from({ length: Math.ceil((2 * extentX) / step) + 1 }, (_, index) => ({
        x: -extentX + index * step,
        y
      }));
      this.drawProjectedLine(points, state, "rgba(245, 185, 92, 0.23)");
    }

    this.ctx.restore();
  }

  private drawProjectedLine(points: Vector2[], state: SimulationState, color: string): void {
    this.ctx.beginPath();
    points.forEach((point, index) => {
      const screen = this.worldToScreen(point, state);
      if (index === 0) this.ctx.moveTo(screen.x, screen.y);
      else this.ctx.lineTo(screen.x, screen.y);
    });
    this.ctx.strokeStyle = color;
    this.ctx.stroke();
  }

  private drawTrails(state: SimulationState): void {
    for (const object of state.objects) {
      if (object.trail.length < 2) continue;

      const baseColor = object.type === "light" ? "255, 219, 105" : "105, 218, 255";
      for (let i = 1; i < object.trail.length; i++) {
        const previous = this.worldToScreen(object.trail[i - 1], state);
        const current = this.worldToScreen(object.trail[i], state);
        const age = i / object.trail.length;

        this.ctx.beginPath();
        this.ctx.moveTo(previous.x, previous.y);
        this.ctx.lineTo(current.x, current.y);
        this.ctx.strokeStyle = `rgba(${baseColor}, ${0.08 + age * 0.58})`;
        this.ctx.lineWidth = object.type === "light" ? 2.1 : 1.8;
        this.ctx.stroke();
      }
    }
  }

  private drawCentralMass(state: SimulationState): void {
    const mass = state.params.centralMass;
    const center = this.worldToScreen({ x: 0, y: 0 }, state);
    const radius = (20 + Math.sqrt(Math.max(mass, 1)) * 2.6) * this.scale;

    const glow = this.ctx.createRadialGradient(center.x, center.y, radius * 0.2, center.x, center.y, radius * 2.8);
    glow.addColorStop(0, "rgba(255, 200, 110, 0.62)");
    glow.addColorStop(0.48, "rgba(237, 105, 75, 0.20)");
    glow.addColorStop(1, "rgba(237, 105, 75, 0)");
    this.ctx.fillStyle = glow;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius * 2.8, 0, Math.PI * 2);
    this.ctx.fill();

    const body = this.ctx.createRadialGradient(
      center.x - radius * 0.4,
      center.y - radius * 0.45,
      radius * 0.1,
      center.x,
      center.y,
      radius
    );
    body.addColorStop(0, "#fff1b9");
    body.addColorStop(0.45, "#f2a85d");
    body.addColorStop(1, "#b44842");

    this.ctx.fillStyle = body;
    this.ctx.strokeStyle = "rgba(255, 242, 205, 0.78)";
    this.ctx.lineWidth = 2;
    this.ctx.beginPath();
    this.ctx.arc(center.x, center.y, radius, 0, Math.PI * 2);
    this.ctx.fill();
    this.ctx.stroke();

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.86)";
    this.ctx.font = "600 13px system-ui, sans-serif";
    this.ctx.textAlign = "center";
    this.ctx.fillText(`Zentralmasse ${Math.round(mass)}`, center.x, center.y + radius + 22);
  }

  private drawObjects(state: SimulationState): void {
    for (const object of state.objects) {
      const screen = this.worldToScreen(object.position, state);
      const color = object.type === "light" ? "#ffe27a" : object.active ? "#7adfff" : "#9aa3a8";
      const radius = object.type === "light" ? 4.5 : 6;

      this.ctx.fillStyle = color;
      this.ctx.strokeStyle = "rgba(8, 12, 14, 0.75)";
      this.ctx.lineWidth = 1.5;
      this.ctx.beginPath();
      this.ctx.arc(screen.x, screen.y, radius, 0, Math.PI * 2);
      this.ctx.fill();
      this.ctx.stroke();

      if (state.showVectors && object.active) {
        this.drawObjectVector(object, state);
      }
    }
  }

  private drawObjectVector(object: SimObject, state: SimulationState): void {
    const start = this.worldToScreen(object.position, state);
    const velocityDirection = normalize(object.velocity);
    const velocityEnd = this.worldToScreen(
      {
        x: object.position.x + velocityDirection.x * 42,
        y: object.position.y + velocityDirection.y * 42
      },
      state
    );
    this.drawArrow(start, velocityEnd, object.type === "light" ? "#ffe27a" : "#7adfff", 2);

    if (object.type === "mass") {
      const acceleration = accelerationForMass(object.position, state.params);
      const accelerationVector = scale(acceleration, 8);
      const accelerationEnd = this.worldToScreen(
        {
          x: object.position.x + accelerationVector.x,
          y: object.position.y + accelerationVector.y
        },
        state
      );
      this.drawArrow(start, accelerationEnd, "#f59f7d", 1.5);
    }
  }

  private drawDragPreview(state: SimulationState): void {
    if (!state.drag?.active) return;

    const start = this.worldToScreen(state.drag.start, state);
    const end = this.worldToScreen(state.drag.current, state);
    this.drawArrow(start, end, state.selectedType === "light" ? "#ffe27a" : "#7adfff", 3);

    this.ctx.fillStyle = "rgba(255, 255, 255, 0.82)";
    this.ctx.font = "600 12px system-ui, sans-serif";
    this.ctx.fillText(state.selectedType === "light" ? "Richtung" : "Anfangsgeschwindigkeit", end.x + 14, end.y - 10);
  }

  private drawArrow(start: ScreenPoint, end: ScreenPoint, color: string, width: number): void {
    const angle = Math.atan2(end.y - start.y, end.x - start.x);
    const headLength = 11;

    this.ctx.strokeStyle = color;
    this.ctx.fillStyle = color;
    this.ctx.lineWidth = width;
    this.ctx.lineCap = "round";
    this.ctx.beginPath();
    this.ctx.moveTo(start.x, start.y);
    this.ctx.lineTo(end.x, end.y);
    this.ctx.stroke();

    this.ctx.beginPath();
    this.ctx.moveTo(end.x, end.y);
    this.ctx.lineTo(end.x - headLength * Math.cos(angle - Math.PI / 6), end.y - headLength * Math.sin(angle - Math.PI / 6));
    this.ctx.lineTo(end.x - headLength * Math.cos(angle + Math.PI / 6), end.y - headLength * Math.sin(angle + Math.PI / 6));
    this.ctx.closePath();
    this.ctx.fill();
  }

  private drawLegend(state: SimulationState): void {
    const activeCount = state.objects.filter((object) => object.active).length;
    this.ctx.fillStyle = "rgba(255, 255, 255, 0.84)";
    this.ctx.font = "600 13px system-ui, sans-serif";
    this.ctx.textAlign = "left";
    this.ctx.fillText(state.running ? "Simulation läuft" : "Simulation pausiert", 18, 28);
    this.ctx.font = "12px system-ui, sans-serif";
    this.ctx.fillText(`${activeCount} aktive Objekte · Ziehen im Canvas erzeugt ein Objekt`, 18, 49);
  }
}
