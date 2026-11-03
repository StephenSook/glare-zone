// Unit tests for Assets/Scripts/GlareMath.ts: the 12 cases in devpost/design-brief.md
// ("Unit test plan: glare reach"), plus checks that the full 3D model used by the Lens
// gives the same reaches for the demo placements.
//
// Run: node --test tests/
// (Node 22.18 or later strips the TypeScript types in GlareMath.ts on import.)
//
// Expected values are worked by hand from the brief's geometry check. They show the code
// implements the model. They do not show the model matches real glass: computed values.

import { test } from "node:test"
import assert from "node:assert/strict"
import * as G from "../Assets/Scripts/GlareMath.ts"

const C = 300
const Y = 200
const TOL = 0.1

function near(actual, expected, tol = TOL, label = "") {
  assert.ok(
    Math.abs(actual - expected) <= tol,
    `${label} expected ${expected} +/- ${tol}, got ${actual}`,
  )
}

test("1. factor (Y - h) / (C - Y): seated 0.91, standing 0.40, child seated 0.96", () => {
  near(G.glareFactor(Y, 109, C), 0.91, 0.005, "seated")
  near(G.glareFactor(Y, 160, C), 0.4, 0.005, "standing")
  near(G.glareFactor(Y, 104, C), 0.96, 0.005, "child seated")
})

test("2. standard placement D = (300 - 160) x 0.577 = 80.78 cm", () => {
  near(G.standardPlacementCm(300, 160), 80.78, 0.005, "D")
})

test("3. at D = 80.78: standing 32.31 pass, seated 73.51 fail, child seated 77.55 fail", () => {
  const D = 80.78
  const standing = G.glareReach(D, C, Y, 160)
  const seated = G.glareReach(D, C, Y, 109)
  const child = G.glareReach(D, C, Y, 104)
  near(standing, 32.31, TOL, "standing")
  near(seated, 73.51, TOL, "seated")
  near(child, 77.55, TOL, "child seated")
  assert.equal(G.passesNearEdge(standing), true)
  assert.equal(G.passesNearEdge(seated), false)
  assert.equal(G.passesNearEdge(child), false)
})

test("4. at D = 65: standing 26.00 pass, seated 59.15 pass, child seated 62.40 fail", () => {
  const D = 65
  near(G.glareReach(D, C, Y, 160), 26.0, TOL, "standing")
  near(G.glareReach(D, C, Y, 109), 59.15, TOL, "seated")
  near(G.glareReach(D, C, Y, 104), 62.4, TOL, "child seated")
  assert.equal(G.passesNearEdge(G.glareReach(D, C, Y, 160)), true)
  assert.equal(G.passesNearEdge(G.glareReach(D, C, Y, 109)), true)
  assert.equal(G.passesNearEdge(G.glareReach(D, C, Y, 104)), false)
})

test("5. at D = 62 (demo target): standing 24.80, seated 56.42, child seated 59.52, all pass", () => {
  const D = 62
  const r = [G.glareReach(D, C, Y, 160), G.glareReach(D, C, Y, 109), G.glareReach(D, C, Y, 104)]
  near(r[0], 24.8, TOL, "standing")
  near(r[1], 56.42, TOL, "seated")
  near(r[2], 59.52, TOL, "child seated")
  for (const reach of r) assert.equal(G.passesNearEdge(reach), true)
})

test("6. boundary: reach 59.9 passes, 60.1 fails (strictly inside the near edge)", () => {
  assert.equal(G.passesNearEdge(59.9, 60), true)
  assert.equal(G.passesNearEdge(60.1, 60), false)
  assert.equal(G.passesNearEdge(60, 60), false)
})

test("6 (Lens path). the card's pass/fail at the boundary: seated reach 59.9 passes, exactly 60 and 60.1 fail", () => {
  // The card uses passesViewingArea on the 3D zone. Seated reach = 0.91 x D while the whole
  // glass is lit, so D = 59.9 / 0.91, 60 / 0.91 and 60.1 / 0.91 put the far edge on each side.
  for (const x of [50, -50]) {
    near(G.zoneDepth(sceneLight(x, 59.9 / 0.91), 109).max, 59.9, 0.01, "reach 59.9")
    assert.equal(G.passesViewingArea(sceneLight(x, 59.9 / 0.91), 109), true, "59.9 passes")
    assert.equal(G.passesViewingArea(sceneLight(x, 60.1 / 0.91), 109), false, "60.1 fails")
  }
  // Exactly 60 needs numbers a double holds exactly: D = 100 and eyes at 140 give
  // 100 x (200 - 140) / (300 - 200) = 60. Aimed at the print centre so the whole glass is lit.
  const tilt100 = (Math.atan(Math.sqrt(50 * 50 + 100 * 100) / 150) * 180) / Math.PI
  const at60 = { xCm: 50, distanceCm: 100, tiltDeg: tilt100, dimmer: 1 }
  assert.equal(G.zoneDepth(at60, 140).max, 60, "reach exactly 60")
  assert.equal(G.passesViewingArea(at60, 140), false, "exactly 60 fails")
  // The brief's own numbers: at 66 cm seated reaches 60.06 (fail); at 65.9 it reaches 59.97 (pass).
  assert.equal(G.passesViewingArea(sceneLight(50, 66), 109), false, "66 cm fails")
  assert.equal(G.passesViewingArea(sceneLight(50, 65.9), 109), true, "65.9 cm passes")
})

test("7. eye above the lit glass: h = 210 gives reach 0", () => {
  assert.equal(G.glareReach(80.78, C, Y, 210), 0)
  assert.equal(G.glareReach(80.78, C, Y, 200), 0)
})

test("8. tilt lowers the lit top: Y = 180 gives seated factor 0.5917, reach 47.79 at D = 80.78, pass", () => {
  near(G.glareFactor(180, 109, C), 0.5917, 0.0005, "factor")
  const reach = G.glareReach(80.78, C, 180, 109)
  near(reach, 47.79, TOL, "reach")
  assert.equal(G.passesNearEdge(reach), true)
})

test("9. beam misses the glass entirely: no glare zone at any eye height", () => {
  // Tilted almost horizontal: the beam lands far above the print (above the ceiling line).
  // 80 deg is the steepest tilt the Lens allows (it clamps to 2..80).
  const light = { xCm: 0, distanceCm: 80.78, tiltDeg: 80, dimmer: 1 }
  assert.equal(G.litGlassSpan(light), null)
  for (const h of [160, 109, 104]) {
    assert.equal(G.zoneDepth(light, h), null)
    assert.deepEqual(G.zoneRows(light, h), [])
    assert.equal(G.passesViewingArea(light, h), true)
  }
  // And no glare point anywhere in front of the print.
  assert.equal(G.glarePoint({ x: 0, y: 109, z: 40 }, light), null)
})

test("10. reach is linear in D: doubling D doubles reach", () => {
  for (const h of [160, 109, 104]) {
    const a = G.glareReach(40, C, Y, h)
    const b = G.glareReach(80, C, Y, h)
    near(b, 2 * a, 1e-9, `h=${h}`)
  }
})

test("11. 3D check: in line with the light gives the 2D reach; far to the side sees no glare", () => {
  // A light on the print's centre line, aimed so its beam covers the whole glass.
  const D = 80.78
  const light = { xCm: 0, distanceCm: D, tiltDeg: G.tiltForAim(0, D, 150), dimmer: 1 }
  const span = G.litGlassSpan(light)
  assert.ok(span, "beam lights the glass")
  near(span.max, 200, 1e-6, "lit top")
  const reach2D = 73.51 // hand: 80.78 x 0.91 (case 3)
  // The 3D zone for an eye in line with the light ends at the 2D reach.
  near(G.zoneDepth(light, 109).max, reach2D, 0.01, "zone far edge")
  // Just inside the reach, in line: glare, landing on the centre line at the top of the glass.
  const inside = G.glarePoint({ x: 0, y: 109, z: reach2D - 0.5 }, light)
  assert.ok(inside, "glare just inside the reach")
  near(inside.x, 0, 1e-9, "glare point x")
  assert.ok(inside.y <= 200 && inside.y > 199, `glare point near the top, got ${inside.y}`)
  // Just beyond the reach, in line: no glare.
  assert.equal(G.glarePoint({ x: 0, y: 109, z: reach2D + 0.5 }, light), null)
  // Far enough to the side that the reflection falls outside the print's width: no glare.
  const side = { x: 200, y: 109, z: 40 }
  const t = side.z / (side.z + D)
  const px = side.x + (0 - side.x) * t
  assert.ok(Math.abs(px) > 50, `reflection lands outside the print (x = ${px})`)
  assert.equal(G.glarePoint(side, light), null)
})

test("12. viewing area edited to 40 to 182 cm: seated at D = 62 (56.42 cm) now fails", () => {
  const reach = G.glareReach(62, C, Y, 109)
  near(reach, 56.42, TOL, "seated reach")
  assert.equal(G.passesNearEdge(reach, 60), true)
  assert.equal(G.passesNearEdge(reach, 40), false)
})

test("12 (Lens path). the card with the viewing area edited to 40 to 182 cm: seated at D = 62 fails", () => {
  for (const x of [50, -50]) {
    assert.equal(G.passesViewingArea(sceneLight(x, 62), 109, 60, 182), true, "default area: pass")
    assert.equal(G.passesViewingArea(sceneLight(x, 62), 109, 40, 182), false, "edited area: fail")
    // A far edge pulled in to 56 cm: the zone (0 to 56.42) still enters it.
    assert.equal(G.passesViewingArea(sceneLight(x, 62), 109, 40, 56), false, "far edge inside the zone")
  }
})

test("viewing area's side width: a zone that stays beside the area passes, one inside it fails", () => {
  // A light far to the right (x = 300, 80.78 out, aimed at the print centre) lights the whole
  // glass. An eye at depth z sees its reflection at x = ex (1 - t) + 300 t, t = z / (z + 80.78),
  // and that must be on the glass (x <= 50), so ex <= (50 - 300 t) / (1 - t). For the rows that
  // touch the 40 cm near edge (from 38 cm, t = 0.3199) that is ex <= -67.6: the whole zone
  // inside the depth range lies left of x = -67.6.
  const tilt = (Math.atan(Math.sqrt(300 * 300 + 80.78 * 80.78) / 150) * 180) / Math.PI
  const light = { xCm: 300, distanceCm: 80.78, tiltDeg: tilt, dimmer: 1 }
  near(G.zoneDepth(light, 109).max, 73.51, 0.05, "the zone reaches 73.51 (whole glass lit)")
  // Positive control: an area 200 cm wide (half width 100) takes in part of the zone: fail.
  assert.equal(G.passesViewingArea(light, 109, 40, 182, 100), false, "half width 100: zone inside, fail")
  // An area 120 cm wide (half width 60) stays clear of the zone, which is left of -67.6: pass.
  assert.equal(G.passesViewingArea(light, 109, 40, 182, 60), true, "half width 60: zone beside it, pass")
})

test("tilt from vertical, by hand: a light 50 cm off the centre line and 80.78 cm out, aimed at (0, 150)", () => {
  // Horizontal run sqrt(50^2 + 80.78^2) = 95.00, drop 150: atan(95.00 / 150) = 32.35 deg.
  near(G.tiltForAim(50, 80.78, 150), 32.35, 0.01, "tilt")
  near(TILT0, 32.35, 0.01, "the scene tilt is the same angle")
})

test("8 (Lens path). a partly lit glass: the beam's top edge at 180 cm gives seated 47.79 cm", () => {
  // Light on the centre line, 80.78 cm out, 300 cm up. Its beam's top edge (12.5 deg above
  // the axis) should meet the wall at 180: atan(80.78 / 120) = 33.95 deg from vertical, so
  // the axis tilt is 33.95 - 12.5 = 21.45 deg. Then Y = 180 and seated reach = 0.5917 x 80.78.
  const tilt = (Math.atan(80.78 / 120) * 180) / Math.PI - 12.5
  const light = { xCm: 0, distanceCm: 80.78, tiltDeg: tilt, dimmer: 1 }
  const span = G.litGlassSpan(light)
  assert.ok(span, "beam lights the glass")
  near(span.max, 180, 0.01, "lit top found by the scan and bisection")
  near(G.zoneDepth(light, 109).max, 47.79, 0.01, "seated reach")
})

test("labels round halves up like a hand calculation", () => {
  assert.equal(G.oneDecimal(59.15), "59.2") // 65 x 0.91, stored as 59.1499...
  assert.equal(G.oneDecimal(73.51), "73.5")
  assert.equal(G.oneDecimal(77.5488), "77.5")
  assert.equal(G.oneDecimal(32.312), "32.3")
  assert.equal(G.oneDecimal(80.78), "80.8")
})

// ---------------------------------------------------------------------------
// Glare band between the glass's bottom and top edges (side view). H = 300, d = 81,
// glazing bottom zb = 120. For a low eye the band starts a few cm off the wall.
// At each limit the sight line to the mirrored lamp must hit the wall exactly on the edge.
// ---------------------------------------------------------------------------

const BAND_CASES = [
  // [zt, ze, near, far]
  [200, 160, 0.0, 32.4],
  [200, 109, 4.95, 73.71],
  [200, 104, 7.2, 77.76],
  [170, 160, 0.0, 6.23],
  [170, 109, 4.95, 38.01],
  [170, 104, 7.2, 41.12],
]

for (const [zt, ze, nearCm, farCm] of BAND_CASES) {
  test(`band: zb 120, zt ${zt}, eye ${ze}: ${nearCm.toFixed(2)} to ${farCm.toFixed(2)} cm; hits land on the edges`, () => {
    const H = 300
    const d = 81
    const zb = 120
    const band = G.glareBand(d, H, zb, zt, ze)
    assert.ok(band, "band exists")
    near(band.min, nearCm, 0.005, "near limit")
    near(band.max, farCm, 0.005, "far limit")
    // Far limit: the hit is on the top edge. Near limit: on the bottom edge (or the eye
    // is already at or above the bottom edge, so the band starts at the wall).
    near(G.wallHitHeight(ze, band.max, H, d), zt, 1e-9, "z_hit at far limit")
    if (ze < zb) near(G.wallHitHeight(ze, band.min, H, d), zb, 1e-9, "z_hit at near limit")
    else assert.equal(band.min, 0)
    // Just outside each limit the hit leaves the glass; just inside it stays on it.
    assert.ok(G.wallHitHeight(ze, band.max + 0.5, H, d) > zt, "beyond far limit: above the glass")
    assert.ok(G.wallHitHeight(ze, band.max - 0.5, H, d) < zt, "inside far limit: below the top edge")
    if (ze < zb) {
      assert.ok(G.wallHitHeight(ze, band.min - 0.5, H, d) < zb, "nearer than near limit: below the glass")
      assert.ok(G.wallHitHeight(ze, band.min + 0.5, H, d) > zb, "inside near limit: above the bottom edge")
    }
  })
}

test("band: the full 3D model draws the zone from the near limit, not from the wall", () => {
  // A light on the centre line, wide enough aim that the whole glazing is lit, with a raised
  // glazing bottom (120 cm) so a seated eye's band starts off the wall.
  const room = { ...G.DEFAULT_ROOM, glassBottomCm: 120, glassTopCm: 200 }
  const light = { xCm: 0, distanceCm: 81, tiltDeg: G.tiltForAim(0, 81, 160, room), dimmer: 1 }
  const span = G.litGlassSpan(light, room)
  near(span.min, 120, 1e-6, "lit bottom = glazing bottom")
  near(span.max, 200, 1e-6, "lit top = glazing top")
  const depth = G.zoneDepth(light, 109, room)
  near(depth.min, 4.95, 0.005, "zone near limit")
  near(depth.max, 73.71, 0.005, "zone far limit")
  const rows = G.zoneRows(light, 109, 2, room)
  near(rows[0].z0, 4.95, 0.005, "first floor row starts at the near limit")
  // An eye between the wall and the near limit sees the reflection below the glass: no glare.
  assert.equal(G.glarePoint({ x: 0, y: 109, z: 3 }, light, room), null)
  assert.ok(G.glarePoint({ x: 0, y: 109, z: 10 }, light, room), "glare inside the band")
})

test("ghost lamp: the mirrored lamp, the glare point and the eye are on one line", () => {
  const light = { xCm: 50, distanceCm: 80.78, tiltDeg: G.tiltForAim(50, 80.78, 150), dimmer: 1 }
  const ghost = G.mirroredLamp(light)
  assert.deepEqual(ghost, { x: 50, y: 300, z: -80.78 })
  const eye = { x: -20, y: 109, z: 40 }
  const p = G.glarePoint(eye, light)
  assert.ok(p, "glare for this eye")
  // p = eye + t (ghost - eye) with t = eye.z / (eye.z + d)
  const t = eye.z / (eye.z + 80.78)
  near(p.x, eye.x + (ghost.x - eye.x) * t, 1e-9, "x on the line")
  near(p.y, eye.y + (ghost.y - eye.y) * t, 1e-9, "y on the line")
  near(p.y, G.wallHitHeight(eye.y, eye.z, 300, 80.78), 1e-9, "same height as the side-view hit")
})

// ---------------------------------------------------------------------------
// The full model the Lens runs: two track lights at x = +/-50 cm, panned to the print's
// centre line, starting at the standard placement aimed at the print centre (150 cm).
// Sliding keeps the tilt, as a real track head does.
// ---------------------------------------------------------------------------

// Hand values, not the product's: D0 = (300 - 160) x 0.577 = 80.78 (case 2), and the tilt
// from vertical of a light 50 cm off the centre line aimed at the print centre (0, 150):
// atan(sqrt(50^2 + 80.78^2) / 150).
const D0 = 80.78
const TILT0 = (Math.atan(Math.sqrt(50 * 50 + 80.78 * 80.78) / 150) * 180) / Math.PI

function sceneLight(x, D) {
  return { xCm: x, distanceCm: D, tiltDeg: TILT0, dimmer: 1 }
}

test("scene model: standard placement lights the whole glass height (Y = 200)", () => {
  for (const x of [50, -50]) {
    const span = G.litGlassSpan(sceneLight(x, D0))
    near(span.max, 200, 1e-6, "top")
    near(span.min, 100, 1e-6, "bottom")
  }
})

test("scene model: zone far edges and pass/fail match the brief at 80.78, 65 and 62 cm", () => {
  const cases = [
    [D0, { 160: [32.31, true], 109: [73.51, false], 104: [77.55, false] }],
    [65, { 160: [26.0, true], 109: [59.15, true], 104: [62.4, false] }],
    [62, { 160: [24.8, true], 109: [56.42, true], 104: [59.52, true] }],
  ]
  for (const [D, expect] of cases) {
    for (const x of [50, -50]) {
      const light = sceneLight(x, D)
      for (const h of [160, 109, 104]) {
        const [reach, pass] = expect[h]
        near(G.zoneDepth(light, h).max, reach, TOL, `D=${D} x=${x} h=${h}`)
        assert.equal(G.passesViewingArea(light, h), pass, `pass D=${D} x=${x} h=${h}`)
      }
    }
  }
})

test("scene model: glare point appears inside the seated zone and not outside it", () => {
  const light = sceneLight(50, D0)
  const rows = G.zoneRows(light, 109)
  assert.ok(rows.length > 0)
  const mid = rows[Math.floor(rows.length / 2)]
  const eyeIn = { x: (mid.xMin + mid.xMax) / 2, y: 109, z: (mid.z0 + mid.z1) / 2 }
  const p = G.glarePoint(eyeIn, light)
  assert.ok(p, "glare inside the zone")
  assert.ok(p.y >= 100 && p.y <= 200 && Math.abs(p.x) <= 50, "point on the print")
  const eyeOut = { x: eyeIn.x, y: 109, z: G.zoneDepth(light, 109).max + 5 }
  assert.equal(G.glarePoint(eyeOut, light), null)
})

test("scene model: sample light level at the print centre and the 50 lux check", () => {
  const lights = [sceneLight(50, D0), sceneLight(-50, D0)]
  const centre = { x: 0, y: 150, z: 0 }
  const lux = G.totalIlluminanceLux(lights, centre)
  // 1500 cd x cos(incidence) / d^2 per light: d = 1.776 m, cos = 0.455 -> about 216 lux each.
  near(lux, 432, 2, "two lights at full")
  assert.ok(lux > G.WORKS_ON_PAPER_LUX)
  const dimmed = lights.map((l) => ({ ...l, dimmer: 0.1 }))
  assert.ok(G.totalIlluminanceLux(dimmed, centre) < G.WORKS_ON_PAPER_LUX)
})

// Floor view (row 8): the part of the selected zone inside the viewing area, and the faint
// outlines of the other zones.

test("floor overlap: at 80.78 cm the seated zone reaches 73.51 cm into the 60 to 182 cm area; at 62 cm it is gone", () => {
  // Hand: 80.78 x (200 - 109) / (300 - 200) = 73.51; 62 x 0.91 = 56.42 < 60.
  const at = (D) => G.overlapRows(G.combinedZoneRows([sceneLight(50, D), sceneLight(-50, D)], 109), 60, 182, 100)
  const ov = at(80.78)
  assert.ok(ov.length > 0, "overlap at the standard placement")
  near(G.zoneFarEdge(ov), 73.51, 0.1, "overlap far edge")
  near(Math.min(...ov.map((r) => r.z0)), 60, 1e-9, "overlap starts at the near edge")
  assert.ok(ov.every((r) => r.xMin >= -100 && r.xMax <= 100), "inside the area's width")
  assert.equal(at(62).length, 0, "no overlap at 62 cm")
  // A row touching the near edge counts as inside, like passesViewingArea (exactly 60 fails).
  assert.equal(G.overlapRows([{ z0: 58, z1: 60, xMin: -5, xMax: 5 }], 60, 182, 100).length, 1)
  assert.equal(G.overlapRows([{ z0: 57.9, z1: 59.9, xMin: -5, xMax: 5 }], 60, 182, 100).length, 0)
  assert.equal(G.overlapRows([{ z0: 70, z1: 72, xMin: 101, xMax: 120 }], 60, 182, 100).length, 0, "beside the area")
})

test("floor outline: one row is a closed box; a step between rows is closed by a strip over the step", () => {
  const one = G.zoneOutline([{ z0: 0, z1: 2, xMin: -10, xMax: 10 }], 2, 1)
  assert.equal(one.length, 4, "two sides, near edge, far edge")
  assert.ok(one.some((r) => r.z0 === 1.5 && r.z1 === 2.5 && r.xMin === -10.5 && r.xMax === 10.5), "far edge across the row")
  const stair = G.zoneOutline([
    { z0: 0, z1: 2, xMin: -10, xMax: 10 },
    { z0: 2, z1: 4, xMin: -6, xMax: 10 },
  ], 2, 1)
  // 4 sides + near edge of row 1 + the step (x -10 to -6 at z 2) + far edge of row 2.
  assert.equal(stair.length, 7)
  assert.ok(stair.some((r) => r.z0 === 1.5 && r.xMin === -10.5 && r.xMax === -5.5), "strip over the step")
  assert.ok(!stair.some((r) => r.z0 === 1.5 && r.xMax > 0), "no strip where both rows reach")
})

test("answer card units: cm to one decimal, then feet and whole inches (1 in = 2.54 cm)", () => {
  // Worked by hand: 62 / 2.54 = 24.41 in, so 24 in = 2 ft 0 in.
  assert.equal(G.feetInches(62), "2 ft 0 in")
  assert.equal(G.cmAndFeet(62), "62.0 cm (2 ft 0 in)")
  // The three reaches at the standard placement (80.78 cm x 0.40, 0.91, 0.96):
  // 32.31 cm = 12.72 in (13), 73.51 cm = 28.94 in (29), 77.55 cm = 30.53 in (31).
  assert.equal(G.cmAndFeet(80.78 * 0.4), "32.3 cm (1 ft 1 in)")
  assert.equal(G.cmAndFeet(80.78 * 0.91), "73.5 cm (2 ft 5 in)")
  assert.equal(G.cmAndFeet(80.78 * 0.96), "77.5 cm (2 ft 7 in)")
  // Rounding to the nearest inch carries into feet: 30.4 cm = 11.97 in reads 1 ft 0 in.
  assert.equal(G.feetInches(30.4), "1 ft 0 in")
  // Under a foot, inches only; 15.24 cm is exactly 6 in.
  assert.equal(G.feetInches(10), "4 in")
  assert.equal(G.feetInches(15.24), "6 in")
  assert.equal(G.feetInches(0), "0 in")
})

test("overall verdict: clear only when every eye height stays out of the viewing area", () => {
  const out = (key, endCm) => ({ key, endCm, insideCm: null })
  // The standard placement in the 60 to 182 cm area: standing 32.31 stays out; seated 73.51
  // and child 77.55 reach 13.51 and 17.55 cm into it.
  const std = [out("standing", 32.31), { key: "seated", endCm: 73.51, insideCm: 13.51 }, { key: "child", endCm: 77.55, insideCm: 17.55 }]
  assert.equal(G.overallVerdict(std), "glare")
  assert.equal(G.overallVerdict([out("standing", 32.31), out("seated", 55), out("child", 58)]), "clear")
  // One eye height inside is enough, even touching the edge (depth 0).
  assert.equal(G.overallVerdict([out("standing", 10), out("seated", 20), { key: "child", endCm: 60, insideCm: 0 }]), "glare")
  // A number that cannot be computed reads as glare, never clear; so does no data at all.
  assert.equal(G.overallVerdict([out("standing", 10), out("seated", NaN), out("child", 20)]), "glare")
  assert.equal(G.overallVerdict([out("standing", 10), out("seated", Infinity), out("child", 20)]), "glare")
  assert.equal(G.overallVerdict([]), "glare")
})

test("inside depth: span of the overlap rows; null when the zone stays outside", () => {
  // Seated zone at the standard placement reaches 73.51 cm; clipped to the area from 60 cm.
  const rows = [{ z0: 58, z1: 60, xMin: -5, xMax: 5 }, { z0: 60, z1: 73.51, xMin: -5, xMax: 5 }]
  assert.ok(Math.abs(G.insideDepth(G.overlapRows(rows, 60, 182, 100)) - 13.51) < 1e-9)
  assert.equal(G.insideDepth(G.overlapRows([{ z0: 0, z1: 32.31, xMin: -5, xMax: 5 }], 60, 182, 100)), null)
  // Outside the area's width: no overlap even though the depth reaches past 60 cm.
  assert.equal(G.insideDepth(G.overlapRows([{ z0: 0, z1: 80, xMin: 120, xMax: 140 }], 60, 182, 100)), null)
})

test("session log line: one line, key=value, read back with the same rules", () => {
  const eyes = [
    { key: "standing", endCm: 32.312, insideCm: null },
    { key: "seated", endCm: 73.507, insideCm: 13.507 },
    { key: "child", endCm: NaN, insideCm: null },
  ]
  const line = G.moveLogLine(7, "R", 80.78, 32.35, 60, 182, eyes)
  assert.equal(line, "GLARE_LOG seq=7 light=R distance_cm=80.78 tilt_deg=32.35 standing_end_cm=32.31 seated_end_cm=73.51 " +
    "child_end_cm=nan viewing_near_cm=60.00 viewing_far_cm=182.00 standing_in_cm=- seated_in_cm=13.51 child_in_cm=- verdict=glare")
  // A Logger export adds a prefix; the parser finds the tag anywhere in the line.
  const f = G.parseLogLine("12:01:02 [Assets/Scripts/GlareZoneController.ts:600] " + line)
  assert.equal(f.seq, "7")
  assert.equal(f.seated_in_cm, "13.51")
  assert.equal(f.verdict, "glare")
  assert.equal(G.parseLogLine("Lens Opened: v0.4"), null)
})

test("verdict text: 'All three: clear' only when all three are clear; broken numbers read as glare", () => {
  const names = { standing: "Standing", seated: "Seated", child: "Child seated" }
  const out = (key, endCm) => ({ key, endCm, insideCm: null })
  assert.equal(G.verdictText([out("standing", 24), out("seated", 54.6), out("child", 57.6)], names), "All three: clear")
  // Standard placement: Standing alone is out of the area, but the answer is not clear.
  const std = [out("standing", 32.31), { key: "seated", endCm: 73.51, insideCm: 13.51 }, { key: "child", endCm: 77.55, insideCm: 17.55 }]
  assert.equal(G.verdictText(std, names), "Glare in the viewing area: Seated, Child seated")
  assert.equal(G.verdictText([out("standing", NaN), out("seated", NaN), out("child", NaN)], names), "Glare (cannot be computed): all three")
  assert.equal(G.verdictText([out("standing", 10), out("seated", NaN), { key: "child", endCm: 70, insideCm: 10 }], names),
    "Glare in the viewing area: Child seated; cannot be computed: Seated")
  // A light with a broken value cannot be computed; rows with a broken number cannot be used.
  assert.equal(G.lightComputable({ xCm: 50, distanceCm: 80.78, tiltDeg: 32.35, dimmer: 1 }), true)
  assert.equal(G.lightComputable({ xCm: 50, distanceCm: NaN, tiltDeg: 32.35, dimmer: 1 }), false)
  assert.equal(G.rowsComputable([{ z0: 0, z1: 2, xMin: -5, xMax: 5 }]), true)
  assert.equal(G.rowsComputable([{ z0: 0, z1: NaN, xMin: -5, xMax: 5 }]), false)
})
