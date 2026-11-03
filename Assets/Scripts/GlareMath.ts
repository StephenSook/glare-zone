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
// measurement. The light values are a real fixture's published photometry (TSLight RXT13,
// manufacturer data, not measured): see FIXTURES below.

export type V3 = { x: number; y: number; z: number }

export type Room = {
  ceilingCm: number
  glassTopCm: number
  glassBottomCm: number
  glassHalfWidthCm: number
  beamDeg: number // full beam angle of the default fixture (a light's own beamDeg wins)
  candela: number // the default fixture's centre-beam intensity at full dimmer (a light's own wins)
}

export type Light = {
  xCm: number // position along the track rail (along the wall)
  distanceCm: number // distance from the wall along its ceiling track
  tiltDeg: number // beam axis angle from straight down
  dimmer: number // 0..1
  beamDeg?: number // this light's reflector: full beam angle (default: the room's)
  candela?: number // this light's centre-beam intensity at full dimmer (default: the room's)
}

/** A track fixture's published photometry: full beam angle and centre-beam candlepower. */
export type Fixture = { id: string; reflector: string; beamDeg: number; candela: number }

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
// TSLight RXT13 (Xicato module, 1,235 lm delivered), manufacturer data, not measured: the
// centre-beam candlepower (CBCP) table in the RXT series specification sheet (tslight.com,
// V2026.03.03, page 2), tested at 3000K, CRI 83. The same sheet's footcandle table agrees with
// E = I / d^2 (5,000 cd at 5 ft is 200 fc; 2,700 cd is 108 fc), checked in the unit tests.
// The model holds the centre-beam value across the whole beam angle and none outside it.
export const FIXTURE_NAME = "TSLight RXT13"
export const RXT13_40: Fixture = { id: "rxt13-40", reflector: "40 deg", beamDeg: 40, candela: 2700 }
export const RXT13_20: Fixture = { id: "rxt13-20", reflector: "20 deg", beamDeg: 20, candela: 5000 }
export const FIXTURES: Fixture[] = [RXT13_40, RXT13_20]
export const DEFAULT_FIXTURE = RXT13_40
export const WORKS_ON_PAPER_LUX = 50
export const RULE_OF_THUMB_FACTOR = 0.577 // tan(30 deg), the 160 cm eye aiming rule
export const TRACK_MIN_CM = 30
export const TRACK_MAX_CM = 150

export const DEFAULT_ROOM: Room = {
  ceilingCm: CEILING_CM,
  glassTopCm: GLASS_TOP_CM,
  glassBottomCm: GLASS_BOTTOM_CM,
  glassHalfWidthCm: GLASS_HALF_WIDTH_CM,
  beamDeg: DEFAULT_FIXTURE.beamDeg,
  candela: DEFAULT_FIXTURE.candela,
}

/** A light's full beam angle: its own reflector's, else the room's default fixture's. */
export function beamDegOf(light: Light, room: Room = DEFAULT_ROOM): number {
  return light.beamDeg ?? room.beamDeg
}

/** A light's centre-beam intensity at full dimmer: its own, else the room's default fixture's. */
export function candelaOf(light: Light, room: Room = DEFAULT_ROOM): number {
  return light.candela ?? room.candela
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

/** A length in feet and whole inches (1 in = 2.54 cm): 62 cm is "2 ft 0 in", 10 cm is "4 in". */
export function feetInches(cm: number): string {
  // Round to the nearest inch first, so 30.4 cm (11.97 in) reads "1 ft 0 in", not "0 ft 12 in".
  const inches = Math.round(Math.max(0, cm) / 2.54 + 1e-6)
  const ft = Math.floor(inches / 12)
  const rest = inches - ft * 12
  return ft > 0 ? `${ft} ft ${rest} in` : `${rest} in`
}

/** A reach on the answer card: cm to one decimal, then feet and inches, "73.5 cm (2 ft 5 in)". */
export function cmAndFeet(cm: number): string {
  return `${oneDecimal(cm)} cm (${feetInches(cm)})`
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
  return cosAngle >= Math.cos((beamDegOf(light, room) / 2) * DEG)
}

/**
 * The x range of the beam's footprint on the wall (z = 0) at height y, clipped to the
 * print's width. Null when the beam does not touch the glass at that height.
 */
export function litXInterval(light: Light, y: number, room: Room = DEFAULT_ROOM): Interval | null {
  if (y < room.glassBottomCm - 1e-9 || y > room.glassTopCm + 1e-9) return null
  return litXAt(beamOf(light, room), y, room)
}

/** A light's apex, beam axis and cos(half beam angle): the same for every height it is asked about. */
type Beam = { L: V3; a: V3; c: number }

function beamOf(light: Light, room: Room): Beam {
  return { L: lightPosition(light, room), a: beamAxis(light, room), c: Math.cos((beamDegOf(light, room) / 2) * DEG) }
}

/**
 * litXInterval with the beam worked out once by the caller: the span scan and the zone rows
 * ask about many heights for one light (BUILD_LOG B1). Same arithmetic, same answers.
 */
function litXAt(beam: Beam, y: number, room: Room): Interval | null {
  if (y < room.glassBottomCm - 1e-9 || y > room.glassTopCm + 1e-9) return null
  const L = beam.L
  const a = beam.a
  const c = beam.c
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
      // Degenerate wide beam (a cone wider than the angle to the glass): not used by the RXT13.
      return null
    }
  }
  let xMin = Math.max(lo + L.x, -room.glassHalfWidthCm)
  let xMax = Math.min(hi + L.x, room.glassHalfWidthCm)
  if (xMin > xMax) return null
  // Reject the mirror-image nappe of the cone (points behind the light): d = (mid - Lx,
  // y - Ly, -Lz) . a, written out so this hot path makes no object (BUILD_LOG B1).
  const mid = (xMin + xMax) / 2
  if ((mid - L.x) * a.x + (y - L.y) * a.y + -L.z * a.z <= 0) return null
  xMin = Math.max(xMin, -room.glassHalfWidthCm)
  xMax = Math.min(xMax, room.glassHalfWidthCm)
  return { min: xMin, max: xMax }
}

// The lit span depends on the light's place and aim and on the room, not on the eye height,
// but every zone row list (one per eye height, every frame of a drag) asked for it again:
// up to 280 cone tests per call. The last few answers are kept by their inputs (BUILD_LOG B1).
const SPAN_CACHE_SIZE = 8
const spanCache: { key: string; span: Interval | null }[] = []

/** Every input litGlassSpan reads, as one string (the span cache's key). A new model input must be added here. */
export function litGlassSpanKey(light: Light, room: Room = DEFAULT_ROOM): string {
  return `${light.xCm}|${light.distanceCm}|${light.tiltDeg}|${room.ceilingCm}|${room.glassTopCm}|` +
    `${room.glassBottomCm}|${room.glassHalfWidthCm}|${beamDegOf(light, room)}`
}

/** Top and bottom of the lit part of the glass. Null when the beam misses the glass. */
export function litGlassSpan(light: Light, room: Room = DEFAULT_ROOM): Interval | null {
  const key = litGlassSpanKey(light, room)
  let hit = spanCache.find((e) => e.key === key)
  if (!hit) {
    hit = { key, span: computeLitGlassSpan(light, room) }
    spanCache.unshift(hit)
    if (spanCache.length > SPAN_CACHE_SIZE) spanCache.pop()
  }
  // A copy, so a caller changing the result cannot change the cached answer.
  return hit.span ? { min: hit.span.min, max: hit.span.max } : null
}

function computeLitGlassSpan(light: Light, room: Room): Interval | null {
  // Coarse scan (0.5 cm on a 100 cm glazing), then bisection refines each edge to well
  // under 0.001 cm. 200 steps instead of 2000 because this runs every frame while a light
  // is dragged; a preview trace after the change showed no difference in Scene::Update,
  // so the drag cost is elsewhere (BUILD_LOG row 3).
  const steps = 200
  const span = room.glassTopCm - room.glassBottomCm
  const beam = beamOf(light, room)
  let top: number | null = null
  let bottom: number | null = null
  for (let i = 0; i <= steps; i++) {
    const y = room.glassTopCm - (span * i) / steps
    if (litXAt(beam, y, room)) {
      top = refineEdge(beam, room, y, Math.min(room.glassTopCm, y + span / steps), true)
      break
    }
  }
  if (top === null) return null
  for (let i = 0; i <= steps; i++) {
    const y = room.glassBottomCm + (span * i) / steps
    if (litXAt(beam, y, room)) {
      bottom = refineEdge(beam, room, y, Math.max(room.glassBottomCm, y - span / steps), false)
      break
    }
  }
  return { min: bottom === null ? top : bottom, max: top }
}

function refineEdge(beam: Beam, room: Room, litY: number, unlitY: number, upward: boolean): number {
  // litY is lit; unlitY is the neighbouring sample (unlit, or the print edge itself).
  if (upward && unlitY >= room.glassTopCm && litXAt(beam, room.glassTopCm, room)) return room.glassTopCm
  if (!upward && unlitY <= room.glassBottomCm && litXAt(beam, room.glassBottomCm, room)) return room.glassBottomCm
  let a = litY
  let b = unlitY
  for (let i = 0; i < 40; i++) {
    const m = (a + b) / 2
    if (litXAt(beam, m, room)) a = m
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
  const beam = beamOf(light, room)
  const start = Math.floor(depth.min / stepCm) * stepCm
  for (let z0 = start; z0 < depth.max; z0 += stepCm) {
    const z1 = Math.min(z0 + stepCm, depth.max)
    const zc = Math.max((Math.max(z0, depth.min) + z1) / 2, 1e-6)
    const py = h + ((C - h) * zc) / (zc + D)
    const lit = litXAt(beam, py, room)
    if (!lit) continue
    const xa = (lit.min * (zc + D) - light.xCm * zc) / D
    const xb = (lit.max * (zc + D) - light.xCm * zc) / D
    rows.push({ z0: Math.max(z0, depth.min), z1, xMin: Math.min(xa, xb), xMax: Math.max(xa, xb) })
  }
  return rows
}

/**
 * Union of several lights' zone rows, merged row by row so overlaps are drawn once.
 * Runs for every eye height on every frame of a drag, so it sorts one flat list instead of
 * grouping by string keys and sorting each group (BUILD_LOG B1); the unit tests check it
 * gives the same rows as the earlier grouping.
 */
export function combinedZoneRows(lights: Light[], h: number, stepCm: number = 2, room: Room = DEFAULT_ROOM): ZoneRow[] {
  const all: { k: number; r: ZoneRow }[] = []
  for (const light of lights) {
    for (const r of zoneRows(light, h, stepCm, room)) all.push({ k: Math.floor(r.z0 / stepCm), r })
  }
  all.sort((a, b) => a.k - b.k || a.r.xMin - b.r.xMin)
  const out: ZoneRow[] = []
  let cur: ZoneRow | null = null
  let curK = 0
  for (const e of all) {
    const r = e.r
    if (cur !== null && e.k === curK && r.xMin <= cur.xMax) {
      cur.xMax = Math.max(cur.xMax, r.xMax)
      cur.z0 = Math.min(cur.z0, r.z0)
      cur.z1 = Math.max(cur.z1, r.z1)
    } else {
      if (cur !== null) out.push(cur)
      cur = { z0: r.z0, z1: r.z1, xMin: r.xMin, xMax: r.xMax }
      curK = e.k
    }
  }
  if (cur !== null) out.push(cur)
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

/**
 * How deep a zone reaches into the viewing area: the depth its overlap rows span, or null
 * when the zone stays outside the area. A zone touching an edge is inside, depth 0.
 */
export function insideDepth(overlap: ZoneRow[]): number | null {
  if (overlap.length === 0) return null
  let a = Number.POSITIVE_INFINITY
  let b = Number.NEGATIVE_INFINITY
  for (const r of overlap) {
    a = Math.min(a, r.z0)
    b = Math.max(b, r.z1)
  }
  return b - a
}

/** One eye height's result: its zone's far end, and how deep it reaches into the viewing area. */
export type EyeResult = { key: string; endCm: number; insideCm: number | null }

/**
 * The overall answer for all eye heights: "clear" only when every zone stays outside the
 * viewing area and every number is a real number; anything that cannot be computed is
 * "glare", so a failure never shows as clear.
 */
export function overallVerdict(eyes: EyeResult[]): "clear" | "glare" {
  if (eyes.length === 0) return "glare"
  for (const e of eyes) {
    if (!Number.isFinite(e.endCm)) return "glare"
    if (e.insideCm !== null) return "glare"
  }
  return "clear"
}

/** A light whose numbers are all real can be computed; one with a missing or broken value cannot. */
export function lightComputable(light: Light): boolean {
  const own = [light.beamDeg, light.candela].filter((v) => v !== undefined) as number[]
  return [light.xCm, light.distanceCm, light.tiltDeg, light.dimmer, ...own].every((v) => Number.isFinite(v))
}

/** Zone rows can be used only when every number in them is real. */
export function rowsComputable(rows: ZoneRow[]): boolean {
  return rows.every((r) => [r.z0, r.z1, r.xMin, r.xMax].every((v) => Number.isFinite(v)))
}

function nameList(names: string[]): string {
  return names.join(", ")
}

/**
 * The verdict in words, for the floor status line and the answer card: "All three: clear"
 * only when overallVerdict is "clear"; otherwise which eye heights see glare in the viewing
 * area and which cannot be computed (read as glare).
 */
export function verdictText(eyes: EyeResult[], names: { [key: string]: string }): string {
  if (overallVerdict(eyes) === "clear") return "All three: clear"
  const bad = eyes.filter((e) => !Number.isFinite(e.endCm)).map((e) => names[e.key] || e.key)
  const inside = eyes.filter((e) => Number.isFinite(e.endCm) && e.insideCm !== null).map((e) => names[e.key] || e.key)
  const parts: string[] = []
  if (inside.length > 0) parts.push(`Glare in the viewing area: ${nameList(inside)}`)
  if (bad.length > 0) {
    const who = bad.length === eyes.length && eyes.length === 3 ? "all three" : nameList(bad)
    parts.push(inside.length > 0 ? `cannot be computed: ${who}` : `Glare (cannot be computed): ${who}`)
  }
  return parts.length > 0 ? parts.join("; ") : "Glare (no eye heights)"
}

/** A live eye height (the "My eyes" preset) with its own result, as shown beside the verdict. */
export type LiveEye = { label: string; h: number; result: EyeResult }

/** The lowest of the three eye heights the verdict speaks for (child seated, 104 cm). */
export const LOWEST_VERDICT_EYE_CM = EYE_CHILD_SEATED_CM

/** True when a live eye height sits below all three verdict eye heights, so the verdict cannot speak for it. */
export function liveEyeBelowVerdict(live: LiveEye | null): boolean {
  return live !== null && live.h < LOWEST_VERDICT_EYE_CM
}

/**
 * The verdict line with a live eye height (B7). "All three: clear" speaks for 160, 109 and
 * 104 cm only. A live eye below 104 cm (wheelchair users' eyes can be as low as 96 cm) is
 * named after the verdict with its own answer, by the same rule ("All three: clear; My eyes
 * (96 cm): glare"), so a clear verdict never reads as clear for every lower eye. Otherwise the
 * line is verdictText's.
 */
export function verdictTextWithEye(eyes: EyeResult[], names: { [key: string]: string }, live: LiveEye | null): string {
  const base = verdictText(eyes, names)
  if (!liveEyeBelowVerdict(live)) return base
  const l = live as LiveEye
  return `${base}; ${l.label}: ${overallVerdict([l.result])}`
}

/** "clear" only when the three eye heights are clear and so is a live eye below them (B7). */
export function overallVerdictWithEye(eyes: EyeResult[], live: LiveEye | null): "clear" | "glare" {
  if (overallVerdict(eyes) !== "clear") return "glare"
  return liveEyeBelowVerdict(live) ? overallVerdict([(live as LiveEye).result]) : "clear"
}

function logNum(x: number): string {
  return Number.isFinite(x) ? x.toFixed(2) : "nan"
}

/**
 * One line of the session log, written once per light move. Plain key=value pairs, so a
 * Logger export can be read back by devpost/tools/summarize_session.py. "_in_cm" is how deep
 * that eye height's zone reaches into the viewing area, "-" when it stays outside.
 */
export function moveLogLine(
  seq: number,
  light: string,
  distanceCm: number,
  tiltDeg: number,
  nearCm: number,
  farCm: number,
  eyes: EyeResult[],
): string {
  const parts = [`GLARE_LOG seq=${seq}`, `light=${light}`, `distance_cm=${logNum(distanceCm)}`, `tilt_deg=${logNum(tiltDeg)}`]
  for (const e of eyes) parts.push(`${e.key}_end_cm=${logNum(e.endCm)}`)
  parts.push(`viewing_near_cm=${logNum(nearCm)}`, `viewing_far_cm=${logNum(farCm)}`)
  for (const e of eyes) parts.push(`${e.key}_in_cm=${e.insideCm === null ? "-" : logNum(e.insideCm)}`)
  parts.push(`verdict=${overallVerdict(eyes)}`)
  return parts.join(" ")
}

/** Parse a session log line back into its fields (the same rules the Python summary uses). */
export function parseLogLine(line: string): { [k: string]: string } | null {
  const i = line.indexOf("GLARE_LOG ")
  if (i < 0) return null
  const out: { [k: string]: string } = {}
  for (const tok of line.slice(i + "GLARE_LOG ".length).trim().split(/\s+/)) {
    const eq = tok.indexOf("=")
    if (eq > 0) out[tok.slice(0, eq)] = tok.slice(eq + 1)
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
  // Rows grouped into slabs (one per row step). Each slab's x cover, top and bottom are
  // worked out once, not again for each neighbour: this runs for two eye heights on every
  // frame of a drag (BUILD_LOG B1). The unit tests check it against the earlier version.
  type Slab = { k: number; rows: ZoneRow[]; cover: Interval[]; top: number; bottom: number }
  const slabs: Slab[] = []
  const byKey = new Map<number, Slab>()
  for (const r of rows) {
    const k = Math.floor(r.z0 / stepCm + 1e-9)
    let s = byKey.get(k)
    if (!s) {
      s = { k, rows: [], cover: [], top: -Infinity, bottom: Infinity }
      byKey.set(k, s)
      slabs.push(s)
    }
    s.rows.push(r)
  }
  slabs.sort((a, b) => a.k - b.k)
  for (const s of slabs) {
    for (const r of s.rows) {
      s.cover.push({ min: r.xMin, max: r.xMax })
      s.top = Math.max(s.top, r.z1)
      s.bottom = Math.min(s.bottom, r.z0)
    }
    if (s.cover.length > 1) s.cover.sort((a, b) => a.min - b.min)
  }
  const out: ZoneRow[] = []
  for (const r of rows) {
    out.push({ z0: r.z0, z1: r.z1, xMin: r.xMin - h, xMax: r.xMin + h })
    out.push({ z0: r.z0, z1: r.z1, xMin: r.xMax - h, xMax: r.xMax + h })
  }
  const strip = (iv: Interval, z: number) => out.push({ z0: z - h, z1: z + h, xMin: iv.min - h, xMax: iv.max + h })
  const none: Slab = { k: 0, rows: [], cover: [], top: -Infinity, bottom: Infinity }
  for (let i = 0; i <= slabs.length; i++) {
    const prev = i > 0 ? slabs[i - 1] : none
    const next = i < slabs.length ? slabs[i] : none
    const adjacent = i > 0 && i < slabs.length && next.k === prev.k + 1
    if (adjacent) {
      for (const iv of subtractIntervals(prev.cover, next.cover)) strip(iv, prev.top)
      for (const iv of subtractIntervals(next.cover, prev.cover)) strip(iv, next.bottom)
    } else {
      for (const iv of prev.cover) strip(iv, prev.top)
      for (const iv of next.cover) strip(iv, next.bottom)
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
// Suggest a setback (B5): how far out the lights can hang with all three eye heights clear.
// ---------------------------------------------------------------------------

/** The three eye heights the verdict speaks for ("All three: clear"). */
export const VERDICT_HEIGHTS: { key: string; h: number }[] = [
  { key: "standing", h: EYE_STANDING_CM },
  { key: "seated", h: EYE_SEATED_CM },
  { key: "child", h: EYE_CHILD_SEATED_CM },
]

/**
 * Each eye height's result for these lights, by the same rule as the Lens's answer card:
 * the combined zone rows (stepCm rows), the zone's far end, and how deep it reaches into the
 * viewing area (touching counts as inside). A light or a row that cannot be computed gives an
 * end that is not a number, which reads as glare.
 */
export function eyeResultsFor(
  lights: Light[],
  heights: { key: string; h: number }[],
  nearCm: number,
  farCm: number,
  halfWidthCm: number,
  stepCm: number = 2,
  room: Room = DEFAULT_ROOM,
): EyeResult[] {
  const lightsOk = lights.every((l) => lightComputable(l))
  return heights.map(({ key, h }) => {
    if (!lightsOk || !Number.isFinite(h)) return { key, endCm: Number.NaN, insideCm: null }
    const rows = combinedZoneRows(lights, h, stepCm, room)
    if (!rowsComputable(rows)) return { key, endCm: Number.NaN, insideCm: null }
    return { key, endCm: zoneFarEdge(rows), insideCm: insideDepth(overlapRows(rows, nearCm, farCm, halfWidthCm)) }
  })
}

/** How close (cm) the suggested setback is to the boundary: it is always on the clear side. */
export const SETBACK_TOL_CM = 0.01

/** The coarse step (cm) of the setback search, before bisection refines it. */
export const SETBACK_SCAN_CM = 2

/**
 * Suggest a setback: moving every light toward the wall along its track from where the
 * farthest one hangs now, each keeping its tilt and its place along the track (as the distance
 * slider moves it), the first distance at which all three eye heights are clear. That is the
 * clear setback nearest to where the lights are. Returns the starting distance when the lights
 * are already clear there, and null when no distance down to TRACK_MIN_CM is clear (or a light
 * cannot be computed).
 *
 * Only toward the wall: with the tilt kept, a light moved far out aims so low that its beam
 * leaves the glass and the zones vanish, which is clear but no longer lights the print.
 *
 * A 2 cm scan inward finds the first clear step; bisection then refines it to SETBACK_TOL_CM,
 * always on the clear side (a zone reaching exactly the near edge counts as inside), so at the
 * standard placement the answer is just under 60 / 0.96 = 62.5 cm (child seated binds). The
 * unit tests check it against a 0.1 cm scan.
 */
export function suggestSetbackCm(
  lights: Light[],
  nearCm: number = VIEWING_NEAR_CM,
  farCm: number = VIEWING_FAR_CM,
  halfWidthCm: number = VIEWING_HALF_WIDTH_CM,
  heights: { key: string; h: number }[] = VERDICT_HEIGHTS,
  room: Room = DEFAULT_ROOM,
): number | null {
  if (lights.length === 0 || !lights.every((l) => lightComputable(l))) return null
  const clearAt = (D: number) =>
    overallVerdict(eyeResultsFor(lights.map((l) => ({ ...l, distanceCm: D })), heights, nearCm, farCm, halfWidthCm, 2, room)) === "clear"
  const start = clamp(Math.max(...lights.map((l) => l.distanceCm)), TRACK_MIN_CM, TRACK_MAX_CM)
  if (clearAt(start)) return start
  let glare = start
  let clear: number | null = null
  for (let D = start - SETBACK_SCAN_CM; ; D -= SETBACK_SCAN_CM) {
    const d = Math.max(D, TRACK_MIN_CM)
    if (clearAt(d)) {
      clear = d
      break
    }
    glare = d
    if (d <= TRACK_MIN_CM) break
  }
  if (clear === null) return null
  let lo = clear
  let hi = glare
  while (hi - lo > SETBACK_TOL_CM) {
    const mid = (lo + hi) / 2
    if (clearAt(mid)) lo = mid
    else hi = mid
  }
  return lo
}

/** The marker's label: the setback rounded down to a millimetre, so the number shown is clear. */
export function setbackLabel(cm: number): string {
  return `All three clear at ${(Math.floor(cm * 10 + 1e-9) / 10).toFixed(1)} cm`
}

// ---------------------------------------------------------------------------
// The computed light level.
// ---------------------------------------------------------------------------

/**
 * Illuminance in lux at point p on the print from one light: intensity toward p x
 * cos(angle of incidence) / distance squared (distance in metres), scaled by the dimmer.
 * The fixture is modelled as its centre-beam intensity held across its beam angle, none outside.
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
  return (candelaOf(light, room) * clamp(light.dimmer, 0, 1) * cosIncidence) / (metres * metres)
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
