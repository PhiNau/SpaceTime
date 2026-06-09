import "./styles.css";
import { Controls } from "./controls";
import { Renderer } from "./renderer";
import { Simulation } from "./simulation";

const canvas = document.getElementById("simulationCanvas");
if (!(canvas instanceof HTMLCanvasElement)) {
  throw new Error("Canvas #simulationCanvas wurde nicht gefunden.");
}

const simulation = new Simulation();
const renderer = new Renderer(canvas);
const controls = new Controls(simulation, renderer, canvas);

controls.bind();

let previousTimestamp = performance.now();

function animationLoop(timestamp: number): void {
  const dt = (timestamp - previousTimestamp) / 1000;
  previousTimestamp = timestamp;

  simulation.update(dt, (object) => !renderer.isObjectVisible(object, simulation.state));
  renderer.render(simulation.state);

  requestAnimationFrame(animationLoop);
}

window.addEventListener("resize", () => renderer.resize());
requestAnimationFrame(animationLoop);
