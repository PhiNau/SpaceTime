import { normalize, scale, sub, updateObject } from "./physics";
import type { BodyType, SimObject, SimulationParams, SimulationState, Vector2 } from "./types";

const MASS_DRAG_TO_VELOCITY = 0.62;

export class Simulation {
  readonly state: SimulationState;
  private nextId = 1;

  constructor() {
    this.state = {
      params: {
        centralMass: 44,
        gravitationalConstant: 8500,
        softening: 36,
        visualWarp: 1,
        simulationSpeed: 1,
        lightSpeed: 235,
        lightBendingFactor: 18,
        trailLength: 1200,
        collisionRadius: 18,
        maxAcceleration: 420
      },
      objects: [],
      running: false,
      selectedType: "mass",
      showVectors: true,
      drag: null
    };
  }

  setRunning(running: boolean): void {
    this.state.running = running;
  }

  setSelectedType(type: BodyType): void {
    this.state.selectedType = type;
  }

  update(dtSeconds: number): void {
    if (!this.state.running) return;

    const dt = Math.min(dtSeconds * this.state.params.simulationSpeed, 0.03);
    for (const object of this.state.objects) {
      updateObject(object, dt, this.state.params);
    }
  }

  addObject(start: Vector2, end: Vector2): void {
    const drag = sub(end, start);
    const direction = normalize(drag, { x: 1, y: 0 });
    const velocity =
      this.state.selectedType === "light"
        ? scale(direction, this.state.params.lightSpeed)
        : scale(drag, MASS_DRAG_TO_VELOCITY);

    const object: SimObject = {
      id: `object-${this.nextId++}`,
      type: this.state.selectedType,
      position: { ...start },
      velocity,
      direction: normalize(velocity, direction),
      trail: [{ ...start }],
      active: true,
      collided: false
    };

    this.state.objects.push(object);
    this.state.running = true;
  }

  reset(): void {
    this.state.objects = [];
    this.state.drag = null;
    this.state.running = false;
  }

  clearTrails(): void {
    for (const object of this.state.objects) {
      object.trail = [{ ...object.position }];
    }
  }

  updateParams(partial: Partial<SimulationParams>): void {
    Object.assign(this.state.params, partial);
  }
}
