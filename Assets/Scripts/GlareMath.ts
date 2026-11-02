// GlareMath: the glare and light-level model for Glare Zone.
//
// Pure functions only. No scene objects and no Lens Studio globals, so the same file
// runs inside the Lens and in plain Node unit tests (tests/glareMath.test.mjs).
//
// Frame (gallery-local, centimetres):
//   x runs along the wall (0 = the print's centre line),
//   y is height above the floor,
//   z is distance out from the wall. The print's glass lies in the plane z = 0.
// Glare is tested against the glazing rectangle (the frame opening): GLASS_* below.
//
// This is a computed model: a point light mirrored in flat glass. It is not an optical
// measurement. Light values are sample fixture values, not a real fixture.

export type V3 = { x: number; y: number; z: number }

export type Room = {
  ceilingCm: number
  glassTopCm: number
  glassBottomCm: number
  glassHalfWidthCm: number
  beamDeg: number // full beam angle of the sample fixture
  candela: number // sample peak intensity at full dimmer
}

export type Light = {
  xCm: number // position along the track rail (along the wall)
  distanceCm: number // distance from the wall along its ceiling track
  tiltDeg: number // beam axis angle from straight down
  dimmer: number // 0..1
}

export type Interval = { min: number; max: number }

export type ZoneRow = { z0: number; z1: number; xMin: number; xMax: number }

export const CEILING_CM = 300
// The glazing rectangle (frame opening): 100 cm wide, 100 cm tall, centre 150 cm high.
export const GLASS_TOP_CM = 200
export const GLASS_BOTTOM_CM = 100
export const GLASS_HALF_WIDTH_CM = 50
export const EYE_STANDING_CM = 160
export const EYE_SEATED_CM = 109
export const EYE_CHILD_SEATED_CM = 104
export const VIEWING_NEAR_CM = 60
export const VIEWING_FAR_CM = 182
export const VIEWING_HALF_WIDTH_CM = 100 // print half width plus 50 cm each side
export const SAMPLE_BEAM_DEG = 25
export const SAMPLE_CANDELA = 1500
export const WORKS_ON_PAPER_LUX = 50
export const RULE_OF_THUMB_FACTOR = 0.577 // tan(30 deg), the 160 cm eye aiming rule
export const TRACK_MIN_CM = 30
export const TRACK_MAX_CM = 150

export const DEFAULT_ROOM: Room = {
  ceilingCm: CEILING_CM,
  glassTopCm: GLASS_TOP_CM,
  glassBottomCm: GLASS_BOTTOM_CM,
  glassHalfWidthCm: GLASS_HALF_WIDTH_CM,
  beamDeg: SAMPLE_BEAM_DEG,
  candela: SAMPLE_CANDELA,
}

const DEG = Math.PI / 180

// ---------------------------------------------------------------------------
// The side-view geometry check from the design brief.
// ---------------------------------------------------------------------------

/** (Y - h) / (C - Y). Zero when the eye is at or above the top of the lit glass. */
export function glareFactor(Y: number, h: number, C: number = CEILING_CM): number {
  if (h >= Y) return 0
  if (C <= Y) return Number.POSITIVE_INFINITY
  return (Y - h) / (C - Y)
}

/**
 * Furthest distance from the wall at which an eye at height h sees the reflection of a
 * light at distance D from the wall and ceiling height C, when Y is the top of the lit glass.
 */
export function glareReach(D: number, C: number, Y: number, h: number): number {
  return D * glareFactor(Y, h, C)
}

/**
 * Side view: the height at which the line from an eye (height eyeH, eyeDist from the
 * wall) to the lamp mirrored behind the wall (height lampH, lampDist behind it) meets
 * the wall. z_hit = ze + (H - ze) * x / (x + d).
 */
export function wallHitHeight(eyeH: number, eyeDist: number, lampH: number, lampDist: number): number {
  return eyeH + ((lampH - eyeH) * eyeDist) / (eyeDist + lampDist)
}

/**
 * Near limit of the glare band: where the hit point sits on the glass's bottom edge.
 * x >= d (zb - ze) / (H - zb). Zero when the eye is at or above the bottom edge.
 */
export function bandNearCm(lampDist: number, lampH: number, bottomCm: number, eyeH: number): number {
  if (eyeH >= bottomCm) return 0
  return (lampDist * (bottomCm - eyeH)) / (lampH - bottomCm)
}

/** Far limit of the glare band: the hit point on the top edge. x <= d (zt - ze) / (H - zt). */
export function bandFarCm(lampDist: number, lampH: number, topCm: number, eyeH: number): number {
  return glareReach(lampDist, lampH, topCm, eyeH)
}

/**
 * The floor band (distance from the wall) where an eye at height eyeH sees the lamp's
 * reflection land between the glass's bottom and top edges. For a low eye this band starts
 * a few cm off the wall. Null when the eye is at or above the top edge.
 */
export function glareBand(lampDist: number, lampH: number, bottomCm: number, topCm: number, eyeH: number): Interval | null {
  if (eyeH >= topCm) return null
  return {min: bandNearCm(lampDist, lampH, bottomCm, eyeH), max: bandFarCm(lampDist, lampH, topCm, eyeH)}
}

/**
 * One decimal, rounding halves up the way a hand calculation does. toFixed(1) works on the
 * binary double, so 59.15 (65 x 0.91, stored as 59.1499...) would show as "59.1".
 */
export function oneDecimal(x: number): string {
  return (Math.round(x * 10 + 1e-6) / 10).toFixed(1)
}

/** Pass means the reach stays strictly inside the viewing area's near edge. */
export function passesNearEdge(reach: number, nearEdgeCm: number = VIEWING_NEAR_CM): boolean {
  return reach < nearEdgeCm
}

/** The rule-of-thumb distance from the wall for a single eye height: (C - eye) x 0.577. */
export function standardPlacementCm(C: number = CEILING_CM, eyeCm: number = EYE_STANDING_CM): number {
  return (C - eyeCm) * RULE_OF_THUMB_FACTOR
}

// ---------------------------------------------------------------------------
// The light: position, aim and beam.
// ---------------------------------------------------------------------------

export function lightPosition(light: Light, room: Room = DEFAULT_ROOM): V3 {
  return { x: light.xCm, y: room.ceilingCm, z: light.distanceCm }
}

/**
 * The fixture pans to the print's centre line (x = 0) and tilts down by tiltDeg from
 * straight down. Returns the point on the wall plane where the beam axis lands.
 */
export function aimPoint(light: Light, room: Room = DEFAULT_ROOM): V3 {
  const horiz = Math.sqrt(light.xCm * light.xCm + light.distanceCm * light.distanceCm)
  const t = Math.tan(clamp(light.tiltDeg, 0.5, 89.5) * DEG)
  return { x: 0, y: room.ceilingCm - horiz / t, z: 0 }
}

/** Tilt (degrees from straight down) that aims a light at height aimY on the centre line. */
export function tiltForAim(xCm: number, distanceCm: number, aimY: number, room: Room = DEFAULT_ROOM): number {
  const horiz = Math.sqrt(xCm * xCm + distanceCm * distanceCm)
  const drop = room.ceilingCm - aimY
  return Math.atan2(horiz, drop) / DEG
}

export function beamAxis(light: Light, room: Room = DEFAULT_ROOM): V3 {
  const p = lightPosition(light, room)
  const a = aimPoint(light, room)
  return normalize(sub(a, p))
}

/** True when point p lies inside the beam cone (half angle = beamDeg / 2). */
export function inBeam(light: Light, p: V3, room: Room = DEFAULT_ROOM): boolean {
  const L = lightPosition(light, room)
  const d = sub(p, L)
  const len = length(d)
  if (len <= 1e-9) return false
  const cosAngle = dot(d, beamAxis(light, room)) / len
  return cosAngle >= Math.cos((room.beamDeg / 2) * DEG)
}

/**
 * The x range of the beam's footprint on the wall (z = 0) at height y, clipped to the
 * print's width. Null when the beam does not touch the glass at that height.
 */
export function litXInterval(light: Light, y: number, room: Room = DEFAULT_ROOM): Interval | null {
  if (y < room.glassBottomCm - 1e-9 || y > room.glassTopCm + 1e-9) return null
  const L = lightPosition(light, room)
  const a = beamAxis(light, room)
  const c = Math.cos((room.beamDeg / 2) * DEG)
  // d = (x - Lx, y - Ly, -Lz). Solve (d.a)^2 >= c^2 |d|^2 with d.a > 0, as a quadratic in u = x - Lx.
  const k = (y - L.y) * a.y - L.z * a.z
  const m = (y - L.y) * (y - L.y) + L.z * L.z
  const A = a.x * a.x - c * c
  const B = 2 * a.x * k
  const Cq = k * k - c * c * m
  let lo: number
  let hi: number
  if (Math.abs(A) < 1e-12) {
    if (Math.abs(B) < 1e-12) return null
    const root = -Cq / B
    if (B > 0) {
      lo = root
      hi = Number.POSITIVE_INFINITY
    } else {
      lo = Number.NEGATIVE_INFINITY
      hi = root
    }
  } else {
    const disc = B * B - 4 * A * Cq
    if (disc < 0) return null
    const s = Math.sqrt(disc)
    const r1 = (-B - s) / (2 * A)
    const r2 = (-B + s) / (2 * A)
    if (A < 0) {
      lo = Math.min(r1, r2)
      hi = Math.max(r1, r2)
    } else {
      // Degenerate wide beam: not used by the sample fixture.
      return null
    }
  }
  let xMin = Math.max(lo + L.x, -room.glassHalfWidthCm)
  let xMax = Math.min(hi + L.x, room.glassHalfWidthCm)
  if (xMin > xMax) return null
  // Reject the mirror-image nappe of the cone (points behind the light).
  const mid = (xMin + xMax) / 2
  const d = { x: mid - L.x, y: y - L.y, z: -L.z }
  if (dot(d, a) <= 0) return null
  xMin = Math.max(xMin, -room.glassHalfWidthCm)
  xMax = Math.min(xMax, room.glassHalfWidthCm)
  return { min: xMin, max: xMax }
}

/** Top and bottom of the lit part of the glass. Null when the beam misses the glass. */
export function litGlassSpan(light: Light, room: Room = DEFAULT_ROOM): Interval | null {
  // Coarse scan (0.5 cm on a 100 cm glazing), then bisection refines each edge to well
  // under 0.001 cm. 200 steps instead of 2000 because this runs every frame while a light
  // is dragged; a preview trace after the change showed no difference in Scene::Update,
  // so the drag cost is elsewhere (BUILD_LOG row 3).
  const steps = 200
  const span = room.glassTopCm - room.glassBottomCm
  let top: number | null = null
  let bottom: number | null = null
  for (let i = 0; i <= steps; i++) {
    const y = room.glassTopCm - (span * i) / steps
    if (litXInterval(light, y, room)) {
      top = refineEdge(light, room, y, Math.min(room.glassTopCm, y + span / steps), true)
      break
    }
  }
  if (top === null) return null
  for (let i = 0; i <= steps; i++) {
    const y = room.glassBottomCm + (span * i) / steps
    if (litXInterval(light, y, room)) {
      bottom = refineEdge(light, room, y, Math.max(room.glassBottomCm, y - span / steps), false)
      break
    }
  }
  return { min: bottom === null ? top : bottom, max: top }
}

function refineEdge(light: Light, room: Room, litY: number, unlitY: number, upward: boolean): number {
  // litY is lit; unlitY is the neighbouring sample (unlit, or the print edge itself).
  if (upward && unlitY >= room.glassTopCm && litXInterval(light, room.glassTopCm, room)) return room.glassTopCm
  if (!upward && unlitY <= room.glassBottomCm && litXInterval(light, room.glassBottomCm, room)) return room.glassBottomCm
  let a = litY
  let b = unlitY
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2
    if (litXInterval(light, m, room)) a = m
    else b = m
  }
  return a
}

// ---------------------------------------------------------------------------
// The computed reflection.
// ---------------------------------------------------------------------------

/**
 * Mirror the light across the glass plane and draw the line from the eye to the mirrored
 * light. Returns the point where that line crosses the glass when it lands on the lit part
 * of the print (inside the light's beam). Otherwise null: no glare from this light.
 */
export function glarePoint(eye: V3, light: Light, room: Room = DEFAULT_ROOM): V3 | null {
  if (eye.z <= 0) return null
  const L = lightPosition(light, room)
  const mirrored = { x: L.x, y: L.y, z: -L.z }
  const t = eye.z / (eye.z + L.z)
  const p = {
    x: eye.x + (mirrored.x - eye.x) * t,
    y: eye.y + (mirrored.y - eye.y) * t,
    z: 0,
  }
  if (p.y < room.glassBottomCm || p.y > room.glassTopCm) return null
  if (Math.abs(p.x) > room.glassHalfWidthCm) return null
  if (!inBeam(light, p, room)) return null
  return p
}

/**
 * Near and far edge of one light's glare zone on the floor for an eye at height h, in
 * centimetres from the wall. Null when the beam misses the glass or the eye is above it.
 * The far edge is the side-view reach with Y = top of the lit glass.
 */
export function zoneDepth(light: Light, h: number, room: Room = DEFAULT_ROOM): Interval | null {
  const span = litGlassSpan(light, room)
  if (!span) return null
  // The band between the lit glass's bottom and top edges (the whole glazing when the
  // beam covers it): from the near limit to the far limit, not wall-to-reach.
  return glareBand(light.distanceCm, room.ceilingCm, span.min, span.max, h)
}

/** The lamp mirrored behind the glass plane (z = 0): the "ghost lamp" the eye sees in the glass. */
export function mirroredLamp(light: Light, room: Room = DEFAULT_ROOM): V3 {
  const p = lightPosition(light, room)
  return { x: p.x, y: p.y, z: -p.z }
}

/**
 * The exact floor footprint of one light's glare zone at eye height h, as rows of constant
 * depth. Each row lists the x range of eye positions that see the reflection.
 */
export function zoneRows(light: Light, h: number, stepCm: number = 2, room: Room = DEFAULT_ROOM): ZoneRow[] {
  const depth = zoneDepth(light, h, room)
  if (!depth) return []
  const rows: ZoneRow[] = []
  const D = light.distanceCm
  const C = room.ceilingCm
  const start = Math.floor(depth.min / stepCm) * stepCm
  for (let z0 = start; z0 < depth.max; z0 += stepCm) {
    const z1 = Math.min(z0 + stepCm, depth.max)
    const zc = Math.max((Math.max(z0, depth.min) + z1) / 2, 1e-6)
    const py = h + ((C - h) * zc) / (zc + D)
    const lit = litXInterval(light, py, room)
    if (!lit) continue
    const xa = (lit.min * (zc + D) - light.xCm * zc) / D
    const xb = (lit.max * (zc + D) - light.xCm * zc) / D
    rows.push({ z0: Math.max(z0, depth.min), z1, xMin: Math.min(xa, xb), xMax: Math.max(xa, xb) })
  }
  return rows
}

/** Union of several lights' zone rows, merged row by row so overlaps are drawn once. */
export function combinedZoneRows(lights: Light[], h: number, stepCm: number = 2, room: Room = DEFAULT_ROOM): ZoneRow[] {
  const byRow: { [key: string]: ZoneRow[] } = {}
  for (const light of lights) {
    for (const r of zoneRows(light, h, stepCm, room)) {
      const key = Math.floor(r.z0 / stepCm).toString()
      if (!byRow[key]) byRow[key] = []
      byRow[key].push(r)
    }
  }
  const out: ZoneRow[] = []
  for (const key of Object.keys(byRow)) {
    const rows = byRow[key].slice().sort((a, b) => a.xMin - b.xMin)
    let cur = { ...rows[0] }
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i]
      if (r.xMin <= cur.xMax) {
        cur.xMax = Math.max(cur.xMax, r.xMax)
        cur.z0 = Math.min(cur.z0, r.z0)
        cur.z1 = Math.max(cur.z1, r.z1)
      } else {
        out.push(cur)
        cur = { ...r }
      }
    }
    out.push(cur)
  }
  out.sort((a, b) => a.z0 - b.z0 || a.xMin - b.xMin)
  return out
}

/** Farthest depth reached by any of the rows (0 when there is no zone). */
export function zoneFarEdge(rows: ZoneRow[]): number {
  let far = 0
  for (const r of rows) far = Math.max(far, r.z1)
  return far
}

/**
 * The part of a zone that lies inside the viewing area: each row clipped to the area's near
 * and far edges and its width. Empty when the zone stays outside it. A row touching an edge
 * counts as inside, as in passesViewingArea (pass is strictly outside).
 */
export function overlapRows(rows: ZoneRow[], nearCm: number, farCm: number, halfWidthCm: number): ZoneRow[] {
  const out: ZoneRow[] = []
  for (const r of rows) {
    if (r.z1 < nearCm || r.z0 > farCm) continue
    if (r.xMax < -halfWidthCm || r.xMin > halfWidthCm) continue
    out.push({
      z0: Math.max(r.z0, nearCm),
      z1: Math.min(r.z1, farCm),
      xMin: Math.max(r.xMin, -halfWidthCm),
      xMax: Math.min(r.xMax, halfWidthCm),
    })
  }
  return out
}

/** Parts of the first interval list not covered by the second (both sorted, disjoint). */
function subtractIntervals(a: Interval[], b: Interval[]): Interval[] {
  let out = a.map((i) => ({ min: i.min, max: i.max }))
  for (const s of b) {
    const next: Interval[] = []
    for (const i of out) {
      if (s.max <= i.min || s.min >= i.max) {
        next.push(i)
        continue
      }
      if (s.min > i.min) next.push({ min: i.min, max: s.min })
      if (s.max < i.max) next.push({ min: s.max, max: i.max })
    }
    out = next
  }
  return out
}

/**
 * The outline of a zone drawn as rows (from combinedZoneRows with the same step), as thin
 * strips of the given thickness: each row's left and right edge, plus, between neighbouring
 * rows, the stretch of x where one row reaches and the other does not (so the staircase
 * edge stays closed), plus the first row's near edge and the last row's far edge.
 */
export function zoneOutline(rows: ZoneRow[], stepCm: number, thicknessCm: number): ZoneRow[] {
  const h = thicknessCm / 2
  const slabs: { [k: string]: ZoneRow[] } = {}
  const keys: number[] = []
  for (const r of rows) {
    const k = Math.floor(r.z0 / stepCm + 1e-9)
    if (!slabs[k]) {
      slabs[k] = []
      keys.push(k)
    }
    slabs[k].push(r)
  }
  keys.sort((a, b) => a - b)
  const out: ZoneRow[] = []
  for (const r of rows) {
    out.push({ z0: r.z0, z1: r.z1, xMin: r.xMin - h, xMax: r.xMin + h })
    out.push({ z0: r.z0, z1: r.z1, xMin: r.xMax - h, xMax: r.xMax + h })
  }
  const cover = (rs: ZoneRow[]): Interval[] =>
    rs.map((r) => ({ min: r.xMin, max: r.xMax })).sort((a, b) => a.min - b.min)
  const strip = (iv: Interval, z: number) => out.push({ z0: z - h, z1: z + h, xMin: iv.min - h, xMax: iv.max + h })
  for (let i = 0; i <= keys.length; i++) {
    const prev = i > 0 ? slabs[keys[i - 1]] : []
    const next = i < keys.length ? slabs[keys[i]] : []
    const adjacent = i > 0 && i < keys.length && keys[i] === keys[i - 1] + 1
    const prevTop = prev.reduce((m, r) => Math.max(m, r.z1), -Infinity)
    const nextBottom = next.reduce((m, r) => Math.min(m, r.z0), Infinity)
    if (adjacent) {
      for (const iv of subtractIntervals(cover(prev), cover(next))) strip(iv, prevTop)
      for (const iv of subtractIntervals(cover(next), cover(prev))) strip(iv, nextBottom)
    } else {
      for (const iv of cover(prev)) strip(iv, prevTop)
      for (const iv of cover(next)) strip(iv, nextBottom)
    }
  }
  return out
}

/**
 * A light passes for an eye height when that height's glare zone stays outside the viewing
 * area: no part of the zone lies between the near and far edges inside the area's width.
 * Strictly outside, as the brief's case 6 asks: a zone that reaches exactly the near edge
 * (or exactly the far edge, or exactly the side) fails.
 */
export function passesViewingArea(
  light: Light,
  h: number,
  nearCm: number = VIEWING_NEAR_CM,
  farCm: number = VIEWING_FAR_CM,
  halfWidthCm: number = VIEWING_HALF_WIDTH_CM,
  room: Room = DEFAULT_ROOM,
): boolean {
  const depth = zoneDepth(light, h, room)
  if (!depth) return true
  if (depth.max < nearCm || depth.min > farCm) return true
  const rows = zoneRows(light, h, 0.5, room)
  for (const r of rows) {
    if (r.z1 < nearCm || r.z0 > farCm) continue
    if (r.xMax < -halfWidthCm || r.xMin > halfWidthCm) continue
    return false
  }
  return true
}

// ---------------------------------------------------------------------------
// The computed light level.
// ---------------------------------------------------------------------------

/**
 * Illuminance in lux at point p on the print from one light: intensity toward p x
 * cos(angle of incidence) / distance squared (distance in metres), scaled by the dimmer.
 * The sample fixture is modelled as constant intensity inside its beam and none outside.
 */
export function illuminanceLux(light: Light, p: V3, room: Room = DEFAULT_ROOM): number {
  if (!inBeam(light, p, room)) return 0
  const L = lightPosition(light, room)
  const d = sub(L, p)
  const dist = length(d)
  if (dist <= 1e-9) return 0
  const cosIncidence = d.z / dist // the glass faces +z
  if (cosIncidence <= 0) return 0
  const metres = dist / 100
  return (room.candela * clamp(light.dimmer, 0, 1) * cosIncidence) / (metres * metres)
}

export function totalIlluminanceLux(lights: Light[], p: V3, room: Room = DEFAULT_ROOM): number {
  let sum = 0
  for (const light of lights) sum += illuminanceLux(light, p, room)
  return sum
}

// ---------------------------------------------------------------------------
// Small helpers.
// ---------------------------------------------------------------------------

export function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v))
}

function sub(a: V3, b: V3): V3 {
  return { x: a.x - b.x, y: a.y - b.y, z: a.z - b.z }
}

function dot(a: V3, b: V3): number {
  return a.x * b.x + a.y * b.y + a.z * b.z
}

function length(a: V3): number {
  return Math.sqrt(dot(a, a))
}

function normalize(a: V3): V3 {
  const l = length(a)
  return l > 1e-12 ? { x: a.x / l, y: a.y / l, z: a.z / l } : { x: 0, y: -1, z: 0 }
}
