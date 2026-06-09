import type { SimObject, SimulationParams, Vector2 } from "./types";

export const add = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x + b.x, y: a.y + b.y });
export const sub = (a: Vector2, b: Vector2): Vector2 => ({ x: a.x - b.x, y: a.y - b.y });
export const scale = (v: Vector2, s: number): Vector2 => ({ x: v.x * s, y: v.y * s });
export const dot = (a: Vector2, b: Vector2): number => a.x * b.x + a.y * b.y;
export const lengthSq = (v: Vector2): number => v.x * v.x + v.y * v.y;
export const length = (v: Vector2): number => Math.sqrt(lengthSq(v));

export function normalize(v: Vector2, fallback: Vector2 = { x: 1, y: 0 }): Vector2 {
  const len = length(v);
  if (len < 1e-6) return fallback;
  return scale(v, 1 / len);
}

function clampMagnitude(v: Vector2, max: number): Vector2 {
  const len = length(v);
  if (len <= max || len < 1e-6) return v;
  return scale(v, max / len);
}

export function accelerationForMass(position: Vector2, params: SimulationParams): Vector2 {
  if (params.centralMass <= 0) return { x: 0, y: 0 };

  const rVec = scale(position, -1);
  const softened = lengthSq(rVec) + params.softening * params.softening;
  const denominator = Math.pow(softened, 1.5);
  const strength = params.gravitationalConstant * params.centralMass;
  return clampMagnitude(scale(rVec, strength / denominator), params.maxAcceleration);
}

function refractiveIndexGradient(position: Vector2, params: SimulationParams): Vector2 {
  if (params.centralMass <= 0 || params.lightBendingFactor <= 0) return { x: 0, y: 0 };

  const softened = lengthSq(position) + params.softening * params.softening;
  const denominator = Math.pow(softened, 1.5);

  // n(r) = 1 + kM / sqrt(r²+s²), therefore grad(n) points toward the center.
  return scale(position, (-params.lightBendingFactor * params.centralMass) / denominator);
}

export function updateObject(object: SimObject, dt: number, params: SimulationParams): void {
  if (!object.active) return;

  if (object.type === "mass") {
    const acceleration = accelerationForMass(object.position, params);
    object.velocity = add(object.velocity, scale(acceleration, dt));
    object.position = add(object.position, scale(object.velocity, dt));
    object.direction = normalize(object.velocity, object.direction);
  } else {
    const direction = normalize(object.direction);
    const gradN = refractiveIndexGradient(object.position, params);
    const parallel = scale(direction, dot(gradN, direction));
    const perpendicular = sub(gradN, parallel);

    object.direction = normalize(add(direction, scale(perpendicular, dt)));
    object.velocity = scale(object.direction, params.lightSpeed);
    object.position = add(object.position, scale(object.velocity, dt));
  }

  object.trail.push({ ...object.position });
  if (object.trail.length > params.trailLength) {
    object.trail.splice(0, object.trail.length - params.trailLength);
  }

  const centralRadius = params.collisionRadius + Math.sqrt(params.centralMass) * 1.8;
  if (length(object.position) < centralRadius && params.centralMass > 0) {
    object.active = false;
    object.collided = true;
  }

  if (Math.abs(object.position.x) > 1500 || Math.abs(object.position.y) > 1200) {
    object.active = false;
  }
}
