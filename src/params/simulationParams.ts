export interface SimulationParams {
  shieldHeight: number;
  closingTorque: number;
  holdTorque: number;
  maxOpeningAngle: number;
  maxCloseAngle: number;
  clawPitch: number;
  forearmAngle: number;
  upperArmLength: number;
  forearmLength: number;
  clawLength: number;
  prizeMass: number;
  collisionLimitEnabled: boolean;
  collisionLimitForce: number;
  armRotation: number;
  clawFriction: number;
}

export const defaultParams: SimulationParams = {
  shieldHeight: 0.5,
  closingTorque: 400,
  holdTorque: 100,
  maxOpeningAngle: 1.2,
  maxCloseAngle: 0,
  clawPitch: 0.3,
  forearmAngle: 0.7,
  upperArmLength: 0.17,
  forearmLength: 0.12,
  clawLength: 0.07,
  prizeMass: 0.1,
  collisionLimitEnabled: true,
  collisionLimitForce: 0.5,
  armRotation: 0,
  clawFriction: 1,
};
