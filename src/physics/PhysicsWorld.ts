import RAPIER from "@dimforge/rapier3d-compat";

export class PhysicsWorld {
  world: RAPIER.World;
  private bodies = new Map<string, RAPIER.RigidBody>();
  private nameByHandle = new Map<number, string>();

  constructor() {
    const gravity = { x: 0, y: -9.81, z: 0 };
    this.world = new RAPIER.World(gravity);
    this.world.numSolverIterations = 8;
  }

  addBody(name: string, desc: RAPIER.RigidBodyDesc): RAPIER.RigidBody {
    const body = this.world.createRigidBody(desc);
    this.bodies.set(name, body);
    this.nameByHandle.set(body.handle, name);
    return body;
  }

  getBody(name: string): RAPIER.RigidBody | undefined {
    return this.bodies.get(name);
  }

  getBodyName(body: RAPIER.RigidBody): string | undefined {
    return this.nameByHandle.get(body.handle);
  }

  removeBody(name: string): void {
    const body = this.bodies.get(name);
    if (body) {
      this.bodies.delete(name);
      this.nameByHandle.delete(body.handle);
      this.world.removeRigidBody(body);
    }
  }

  setSolverIterations(n: number): void {
    this.world.numSolverIterations = n;
  }

  step(): void {
    this.world.step();
  }
}
