export type Vector2 = {
  x: number;
  y: number;
};

export type BodyType = "mass" | "light";

export type SimObject = {
  id: string;
  type: BodyType;
  position: Vector2;
  velocity: Vector2;
  direction: Vector2;
  trail: Vector2[];
  active: boolean;
  collided: boolean;
  age: number;
};

export type SimulationParams = {
  centralMass: number;
  gravitationalConstant: number;
  softening: number;
  visualWarp: number;
  simulationSpeed: number;
  lightSpeed: number;
  lightBendingFactor: number;
  trailLength: number;
  collisionRadius: number;
  maxAcceleration: number;
};

export type DragPreview = {
  active: boolean;
  start: Vector2;
  current: Vector2;
};

export type SimulationState = {
  params: SimulationParams;
  objects: SimObject[];
  running: boolean;
  selectedType: BodyType;
  showVectors: boolean;
  drag: DragPreview | null;
};
