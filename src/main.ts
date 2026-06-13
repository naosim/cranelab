import RAPIER from "@dimforge/rapier3d-compat";
import { GameManager } from "./GameManager";

async function main(): Promise<void> {
  await RAPIER.init();

  const game = new GameManager(document.body);

  let prev = performance.now();
  const loop = (now: number) => {
    const dt = Math.min((now - prev) / 1000, 0.05);
    prev = now;
    game.update(dt);
    requestAnimationFrame(loop);
  };
  requestAnimationFrame(loop);
}

main();
