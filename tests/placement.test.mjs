// Unit tests for Assets/Scripts/PlacementMath.ts: when a World Query hit counts as a wall,
// which way the placed wall faces, and the "Place in front of me" distance.
//
// Run: node --test tests/
// Expected values are worked by hand.

import { test } from "node:test"
import assert from "node:assert/strict"
import * as P from "../Assets/Scripts/PlacementMath.ts"

const deg = (d) => (d * Math.PI) / 180
const near = (a, b, tol, label) => assert.ok(Math.abs(a - b) <= tol, `${label}: expected ${b} +/- ${tol}, got ${a}`)

/** The gallery's +Z (out of the wall) after a yaw about +Y: (sin yaw, 0, cos yaw). */
const outOf = (yaw) => ({ x: Math.sin(yaw), z: Math.cos(yaw) })

test("wall test: upright normals pass, floor and ceiling fail, 20 deg is the limit", () => {
  assert.equal(P.isWallNormal({ x: 0, y: 0, z: 1 }), true, "facing +Z")
  assert.equal(P.isWallNormal({ x: -1, y: 0, z: 0 }), true, "facing -X")
  assert.equal(P.isWallNormal({ x: 0, y: 1, z: 0 }), false, "floor (normal up)")
  assert.equal(P.isWallNormal({ x: 0, y: -1, z: 0 }), false, "ceiling (normal down)")
  // A normal tilted 19.9 deg from horizontal passes; 20.1 deg fails.
  assert.equal(P.isWallNormal({ x: 0, y: Math.sin(deg(19.9)), z: Math.cos(deg(19.9)) }), true, "19.9 deg")
  assert.equal(P.isWallNormal({ x: 0, y: Math.sin(deg(20.1)), z: Math.cos(deg(20.1)) }), false, "20.1 deg")
  // Not unit length: the test uses the direction only.
  assert.equal(P.isWallNormal({ x: 0, y: 0.3, z: 3 }), true, "scaled normal")
  assert.equal(P.isWallNormal({ x: 0, y: 0, z: 0 }), false, "zero normal")
})

test("placed wall faces the viewer: along the hit normal, flipped if it points away", () => {
  // Wall ahead at z = -500, viewer at the origin: out of the wall is +Z, yaw 0.
  near(P.wallYaw({ x: 0, y: 0, z: 1 }, { x: 0, y: 0, z: -500 }, { x: 0, y: 0, z: 0 }), 0, 1e-9, "normal toward viewer")
  // Same wall with the normal reported the other way: flipped, still yaw 0.
  near(P.wallYaw({ x: 0, y: 0, z: -1 }, { x: 0, y: 0, z: -500 }, { x: 0, y: 0, z: 0 }), 0, 1e-9, "normal flipped")
  // Wall to the left at x = -300: out of the wall is +X, yaw 90 deg.
  const y1 = P.wallYaw({ x: 1, y: 0, z: 0 }, { x: -300, y: 0, z: 0 }, { x: 0, y: 0, z: 0 })
  near(y1, Math.PI / 2, 1e-9, "wall to the left")
  near(outOf(y1).x, 1, 1e-9, "out of the wall points at the viewer")
  // A slanted normal: only its horizontal part sets the yaw (the wall stays upright).
  const y2 = P.wallYaw({ x: 0.5, y: 0.2, z: 0.5 }, { x: -100, y: 0, z: -100 }, { x: 0, y: 0, z: 0 })
  near(y2, Math.PI / 4, 1e-9, "45 deg wall")
})

test("Place in front of me faces the viewer's look direction", () => {
  // Looking along -Z: the wall's +Z must point back along +Z, yaw 0.
  near(P.yawFacingViewer(0, -1), 0, 1e-9, "look -Z")
  // Looking along +X: the wall's +Z points along -X, yaw -90 deg.
  const y = P.yawFacingViewer(1, 0)
  near(y, -Math.PI / 2, 1e-9, "look +X")
  near(outOf(y).x, -1, 1e-9, "faces back along -X")
})

test("Place in front of me distance is kept between 0.5 m and 3 m", () => {
  assert.equal(P.frontDistanceCm(20), 50)
  assert.equal(P.frontDistanceCm(50), 50)
  assert.equal(P.frontDistanceCm(120), 120)
  assert.equal(P.frontDistanceCm(300), 300)
  assert.equal(P.frontDistanceCm(500), 300)
})
