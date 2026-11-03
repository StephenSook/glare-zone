// Pure placement rules for the practice wall (no Lens types, so node can test them).
//
// Wall placement: a World Query hit counts as a wall when its surface normal is close to
// horizontal. In Lens Studio 5.23.2 SurfaceClassification has only None and Ground, so there
// is no wall class to ask for; the normal is the test.
//
// Fallback placement ("Place in front of me"): the wall is set down once, in front of the
// viewer, between 0.5 m and 3 m away, and stays there (never head-locked).

export type V3 = {x: number; y: number; z: number}

/** A hit is a wall when its normal is within this many degrees of horizontal. */
export const WALL_MAX_SLOPE_DEG = 20
export const FRONT_MIN_CM = 50
export const FRONT_MAX_CM = 300

/** True when a surface normal is within maxSlopeDeg of horizontal (an upright surface). */
export function isWallNormal(n: V3, maxSlopeDeg: number = WALL_MAX_SLOPE_DEG): boolean {
  const len = Math.sqrt(n.x * n.x + n.y * n.y + n.z * n.z)
  if (len < 1e-6) return false
  return Math.abs(n.y) / len <= Math.sin((maxSlopeDeg * Math.PI) / 180)
}

/**
 * The yaw (radians about +Y) that turns the gallery's +Z, the direction out of the wall,
 * along the wall's horizontal normal, flipped if needed so it points toward the viewer.
 * Only a yaw: the wall always stands upright.
 */
export function wallYaw(normal: V3, hit: V3, eye: V3): number {
  let nx = normal.x
  let nz = normal.z
  if (Math.abs(nx) + Math.abs(nz) < 1e-6) {
    nx = eye.x - hit.x
    nz = eye.z - hit.z
  }
  if (nx * (eye.x - hit.x) + nz * (eye.z - hit.z) < 0) {
    nx = -nx
    nz = -nz
  }
  return Math.atan2(nx, nz)
}

/** The yaw that turns the gallery's +Z toward a viewer looking along (viewX, viewZ). */
export function yawFacingViewer(viewX: number, viewZ: number): number {
  if (Math.abs(viewX) + Math.abs(viewZ) < 1e-6) return 0
  return Math.atan2(-viewX, -viewZ)
}

/** "Place in front of me": the distance asked for, kept between 0.5 m and 3 m. */
export function frontDistanceCm(requestedCm: number): number {
  return Math.min(FRONT_MAX_CM, Math.max(FRONT_MIN_CM, requestedCm))
}
