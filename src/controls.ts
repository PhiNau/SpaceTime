import { Renderer } from "./renderer";
import { Simulation } from "./simulation";
import type { BodyType, Vector2 } from "./types";

function requireElement<T extends HTMLElement>(id: string, type: new () => T): T {
  const element = document.getElementById(id);
  if (!(element instanceof type)) {
    throw new Error(`UI-Element #${id} wurde nicht gefunden.`);
  }
  return element;
}

export class Controls {
  private readonly centralMass = requireElement("centralMass", HTMLInputElement);
  private readonly centralMassValue = requireElement("centralMassValue", HTMLOutputElement);
  private readonly warpStrength = requireElement("warpStrength", HTMLInputElement);
  private readonly warpStrengthValue = requireElement("warpStrengthValue", HTMLOutputElement);
  private readonly simulationSpeed = requireElement("simulationSpeed", HTMLInputElement);
  private readonly simulationSpeedValue = requireElement("simulationSpeedValue", HTMLOutputElement);
  private readonly lightBending = requireElement("lightBending", HTMLInputElement);
  private readonly lightBendingValue = requireElement("lightBendingValue", HTMLOutputElement);
  private readonly showVectors = requireElement("showVectors", HTMLInputElement);
  private readonly selectMass = requireElement("selectMass", HTMLButtonElement);
  private readonly selectLight = requireElement("selectLight", HTMLButtonElement);
  private readonly startButton = requireElement("startButton", HTMLButtonElement);
  private readonly pauseButton = requireElement("pauseButton", HTMLButtonElement);
  private readonly resetButton = requireElement("resetButton", HTMLButtonElement);
  private readonly clearTrailsButton = requireElement("clearTrailsButton", HTMLButtonElement);
  private readonly resetCameraButton = requireElement("resetCameraButton", HTMLButtonElement);
  private cameraDragPointerId: number | null = null;
  private lastCameraPointer: Vector2 | null = null;

  constructor(
    private readonly simulation: Simulation,
    private readonly renderer: Renderer,
    private readonly canvas: HTMLCanvasElement
  ) {}

  bind(): void {
    this.bindSliders();
    this.bindButtons();
    this.bindCanvas();
    this.syncLabels();
  }

  private bindSliders(): void {
    this.centralMass.addEventListener("input", () => {
      this.simulation.updateParams({ centralMass: Number(this.centralMass.value) });
      this.syncLabels();
    });

    this.warpStrength.addEventListener("input", () => {
      this.simulation.updateParams({ visualWarp: Number(this.warpStrength.value) });
      this.syncLabels();
    });

    this.simulationSpeed.addEventListener("input", () => {
      this.simulation.updateParams({ simulationSpeed: Number(this.simulationSpeed.value) });
      this.syncLabels();
    });

    this.lightBending.addEventListener("input", () => {
      this.simulation.updateParams({ lightBendingFactor: Number(this.lightBending.value) });
      this.syncLabels();
    });

    this.showVectors.addEventListener("change", () => {
      this.simulation.state.showVectors = this.showVectors.checked;
    });
  }

  private bindButtons(): void {
    this.selectMass.addEventListener("click", () => this.selectType("mass"));
    this.selectLight.addEventListener("click", () => this.selectType("light"));
    this.startButton.addEventListener("click", () => this.simulation.setRunning(true));
    this.pauseButton.addEventListener("click", () => this.simulation.setRunning(false));
    this.resetButton.addEventListener("click", () => this.simulation.reset());
    this.clearTrailsButton.addEventListener("click", () => this.simulation.clearTrails());
    this.resetCameraButton.addEventListener("click", () => this.renderer.resetCamera());
  }

  private bindCanvas(): void {
    this.canvas.addEventListener("contextmenu", (event) => event.preventDefault());

    this.canvas.addEventListener("pointerdown", (event) => {
      if (this.isCameraControl(event)) {
        this.simulation.state.drag = null;
        this.cameraDragPointerId = event.pointerId;
        this.lastCameraPointer = { x: event.clientX, y: event.clientY };
        this.canvas.setPointerCapture(event.pointerId);
        return;
      }

      const start = this.pointerToWorld(event);
      this.canvas.setPointerCapture(event.pointerId);
      this.simulation.state.drag = {
        active: true,
        start,
        current: start
      };
    });

    this.canvas.addEventListener("pointermove", (event) => {
      if (this.cameraDragPointerId === event.pointerId && this.lastCameraPointer) {
        const deltaX = event.clientX - this.lastCameraPointer.x;
        const deltaY = event.clientY - this.lastCameraPointer.y;
        this.renderer.rotateCamera(deltaX, deltaY);
        this.lastCameraPointer = { x: event.clientX, y: event.clientY };
        return;
      }

      if (!this.simulation.state.drag?.active) return;
      this.simulation.state.drag.current = this.pointerToWorld(event);
    });

    this.canvas.addEventListener("pointerup", (event) => {
      if (this.cameraDragPointerId === event.pointerId) {
        this.cameraDragPointerId = null;
        this.lastCameraPointer = null;
        this.canvas.releasePointerCapture(event.pointerId);
        return;
      }

      const drag = this.simulation.state.drag;
      if (!drag?.active) return;

      const end = this.pointerToWorld(event);
      this.simulation.addObject(drag.start, end);
      this.simulation.state.drag = null;
      this.canvas.releasePointerCapture(event.pointerId);
    });

    this.canvas.addEventListener("pointercancel", () => {
      this.simulation.state.drag = null;
      this.cameraDragPointerId = null;
      this.lastCameraPointer = null;
    });

    this.canvas.addEventListener(
      "wheel",
      (event) => {
        event.preventDefault();
        this.renderer.zoomCamera(event.deltaY);
      },
      { passive: false }
    );
  }

  private isCameraControl(event: PointerEvent): boolean {
    return event.button === 2 || event.shiftKey;
  }

  private pointerToWorld(event: PointerEvent): Vector2 {
    const rect = this.canvas.getBoundingClientRect();
    return this.renderer.screenToWorld(
      {
        x: event.clientX - rect.left,
        y: event.clientY - rect.top
      },
      this.simulation.state
    );
  }

  private selectType(type: BodyType): void {
    this.simulation.setSelectedType(type);
    this.selectMass.classList.toggle("active", type === "mass");
    this.selectLight.classList.toggle("active", type === "light");
  }

  private syncLabels(): void {
    this.centralMassValue.value = String(Math.round(this.simulation.state.params.centralMass));
    this.warpStrengthValue.value = `${this.simulation.state.params.visualWarp.toFixed(1)}x`;
    this.simulationSpeedValue.value = `${this.simulation.state.params.simulationSpeed.toFixed(1)}x`;
    this.lightBendingValue.value = String(Math.round(this.simulation.state.params.lightBendingFactor));
  }
}
