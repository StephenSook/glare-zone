// LEAF scenario: "Place on a wall" uses a real World Query hit from the preview room; the
// practice wall then stands upright where the hit is, facing you; "Place in front of me" is
// the fallback, 0.5 to 3 m away and set down once; the glare numbers do not change when the
// wall moves (BUILD_LOG row 9).
//
// Needs a Lens Studio preview scene with walls (run in "Sunlit Room"). In the plain "Plane"
// scene World Query returns no hit at all, and this scenario fails on purpose rather than
// inventing one.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {AIM_WALL, WallHit} from "../Scripts/GlareWallPlacer"
import {controller, near, press, resetToStandard} from "./GlareLeafHelpers"

// Fixture values, worked by hand from the brief (ceiling 300, glazing lit to its top at
// 200 cm), standard placement D = (300 - 160) x 0.577 = 80.78 cm.
const STANDING_FIXTURE = 32.31 // 80.78 x (200 - 160) / 100
const SEATED_FIXTURE = 73.51 // 80.78 x (200 - 109) / 100
const CHILD_FIXTURE = 77.55 // 80.78 x (200 - 104) / 100

/** Distance from a point to the segment a..b. */
function offRay(p: vec3, a: vec3, b: vec3): number {
  const ab = b.sub(a)
  const t = Math.max(0, Math.min(1, p.sub(a).dot(ab) / ab.dot(ab)))
  return p.sub(a.add(ab.uniformScale(t))).length
}

function flat(v: vec3): vec3 {
  return new vec3(v.x, 0, v.z)
}

/** 13. Wall placement with World Query, and the "Place in front of me" fallback. */
@component
export class GlareC13WallPlacement extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    const p = c.wallPlacer()
    const cam = c.cameraObject.getTransform()
    const palmUp = () => c.handMenu().showAt(cam.getWorldTransform().multiplyPoint(new vec3(0, -20, -40)), 3)
    const reach = () => ({standing: c.zoneFarEdgeCm("standing"), seated: c.zoneFarEdgeCm("seated"), child: c.zoneFarEdgeCm("child")})
    const fixtures = (state: string) => {
      const r = reach()
      expect(near(r.standing, STANDING_FIXTURE, 0.1), `${state}: standing ${r.standing} vs fixture ${STANDING_FIXTURE}`).toBe(true)
      expect(near(r.seated, SEATED_FIXTURE, 0.1), `${state}: seated ${r.seated} vs fixture ${SEATED_FIXTURE}`).toBe(true)
      expect(near(r.child, CHILD_FIXTURE, 0.1), `${state}: child seated ${r.child} vs fixture ${CHILD_FIXTURE}`).toBe(true)
      return r
    }
    const before = fixtures("before the move")
    const unchanged = (state: string) => {
      const r = fixtures(state)
      expect(r.standing === before.standing && r.seated === before.seated && r.child === before.child,
        `${state}: zones identical to before the move`).toBe(true)
      expect(near(c.eyeLocal().y, 160, 0.01), `${state}: eyes still at 160 cm above the practice floor (${c.eyeLocal().y})`).toBe(true)
    }

    // Controls for the checks: a point on the ray passes, a point 5 cm off it fails.
    const a = new vec3(0, 0, 0)
    const b = new vec3(0, 0, -1000)
    expect(offRay(new vec3(0, 0, -500), a, b) < 1, "on-ray check passes a point on the ray").toBe(true)
    expect(offRay(new vec3(5, 0, -500), a, b) < 1, "on-ray check fails a point 5 cm off").toBe(false)

    // Positive first: palm up, press "Place on a wall" (the real button), aim straight ahead.
    expect(p.isAvailable(), `World Query available (${p.unavailableReason()})`).toBe(true)
    palmUp()
    await sleep(200)
    await press(interactor, "Place on a wall button")
    expect(c.isPlacingOnWall(), "aiming after Place on a wall").toBe(true)

    // About 5 hit tests a second while aiming (World Query updates at about 5 Hz).
    const q0 = p.queryCounts().queries
    await sleep(2000)
    const perTwo = p.queryCounts().queries - q0
    expect(perTwo >= 6 && perTwo <= 11, `${perTwo} hit tests in 2 s (about 5 a second)`).toBe(true)

    // The aim ray here is the head's forward ray (LEAF has no hand ray). Wait for a wall hit.
    let h: WallHit | null = null
    for (let i = 0; i < 30 && !(h && h.wall); i++) {
      h = p.lastHit()
      if (!(h && h.wall)) await sleep(100)
    }
    expect(h !== null, "World Query returned a hit on the aim ray (needs a preview room with walls)").toBe(true)
    const hit = h!
    const ray = p.aimRay()
    const off = offRay(hit.position, ray.start, ray.end)
    expect(off < 1, `the hit lies on the aim ray (${off.toFixed(2)} cm off)`).toBe(true)
    const n = hit.normal
    expect(hit.wall, `the hit is a wall: normal (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)})`).toBe(true)
    expect(p.reticleVisible(), "reticle shows at the hit").toBe(true)
    expect(p.reticleWorldPosition().distance(hit.position) < 0.5, "reticle at the hit").toBe(true)
    expect(p.promptText(), "prompt while on a wall").toBe(AIM_WALL)
    const rs = ray.start
    const rd = ray.end.sub(ray.start).normalize()
    print(`[C13] wall hit (${hit.position.x.toFixed(1)}, ${hit.position.y.toFixed(1)}, ${hit.position.z.toFixed(1)}) normal (${n.x.toFixed(2)}, ${n.y.toFixed(2)}, ${n.z.toFixed(2)}); aim ray from (${rs.x.toFixed(1)}, ${rs.y.toFixed(1)}, ${rs.z.toFixed(1)}) along (${rd.x.toFixed(2)}, ${rd.y.toFixed(2)}, ${rd.z.toFixed(2)})`)

    // Pinch (the placer's pinch handler): the practice wall goes to the hit.
    expect(p.confirm(), "pinch on a wall hit places the wall").toBe(true)
    await sleep(300)
    const pose = c.wallPose()
    expect(c.placementInfo().kind, "placed on a wall").toBe("wall")
    expect(near(pose.origin.x, hit.position.x, 0.5) && near(pose.origin.z, hit.position.z, 0.5),
      `wall base at the hit: (${pose.origin.x.toFixed(1)}, ${pose.origin.z.toFixed(1)}) vs (${hit.position.x.toFixed(1)}, ${hit.position.z.toFixed(1)})`).toBe(true)
    expect(pose.up.dot(vec3.up()) > 0.9999, `wall upright (up ${pose.up.y.toFixed(5)})`).toBe(true)
    expect(Math.abs(pose.out.y) < 1e-3, "wall faces out horizontally").toBe(true)
    const nFlat = flat(n).normalize()
    expect(Math.abs(pose.out.dot(nFlat)) > 0.999, `wall faces along the hit normal (${pose.out.dot(nFlat).toFixed(4)})`).toBe(true)
    const toEye = flat(cam.getWorldPosition().sub(pose.origin)).normalize()
    expect(pose.out.dot(toEye) > 0, "wall faces the viewer").toBe(true)
    expect(c.isPlacingOnWall(), "aiming ends after placing").toBe(false)
    expect(p.reticleVisible() || p.promptVisible(), "reticle and prompt gone after placing").toBe(false)
    unchanged("after Place on a wall")

    // Not a wall: a real World Query hit on the ceiling (normal pointing down) is refused and
    // nothing moves.
    p.begin()
    await sleep(1500)
    const eye = cam.getWorldPosition()
    const fwd = cam.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const upRay = quat.angleAxis((15 * Math.PI) / 180, cam.getWorldRotation().multiplyVec3(vec3.right())).multiplyVec3(fwd)
    const hc = await p.hitTest(eye, eye.add(upRay.uniformScale(1000)))
    expect(hc !== null, "a real hit 15 deg up (the preview room's ceiling)").toBe(true)
    expect(hc!.wall, `ceiling is not a wall: normal y ${hc!.normal.y.toFixed(2)}`).toBe(false)
    const stay = c.wallPose().origin
    expect(c.placeOnWallHit(hc!.position, hc!.normal), "a non-wall hit is refused").toBe(false)
    expect(c.wallPose().origin.distance(stay) < 1e-3, "nothing moved").toBe(true)
    // Outside the depth view: a ray behind the eye returns null, not a guess.
    const hb = await p.hitTest(eye, eye.sub(fwd.uniformScale(1000)))
    expect(hb === null, "a ray behind the eye returns null").toBe(true)
    p.stop()

    // Fallback: "Place in front of me" (the real button) sets the wall 3 m ahead, facing you.
    palmUp()
    await sleep(200)
    await press(interactor, "Place in front of me button")
    const view = flat(fwd).normalize()
    const checkFront = (asked: number, want: number) => {
      const got = asked === 300 ? c.placementInfo().distanceCm : c.placeInFront(asked)
      expect(got, `Place in front of me at ${asked} cm uses ${want} cm`).toBe(want)
      const pf = c.wallPose()
      const v = flat(pf.origin.sub(cam.getWorldPosition()))
      expect(near(v.length, want, 0.5), `wall ${v.length.toFixed(1)} cm away (want ${want})`).toBe(true)
      expect(v.normalize().dot(view) > 0.9999, "wall straight ahead").toBe(true)
      expect(pf.out.dot(view.uniformScale(-1)) > 0.9999 && pf.up.dot(vec3.up()) > 0.9999, "upright, facing you").toBe(true)
      expect(c.placementInfo().kind).toBe("front")
    }
    checkFront(300, 300)
    unchanged("after Place in front of me")
    checkFront(20, 50)
    checkFront(500, 300)
    checkFront(120, 120)
    // Set down once: it stays where it was put.
    const set = c.wallPose().origin
    await sleep(1000)
    expect(c.wallPose().origin.distance(set) < 1e-3, "the wall stays where it was set").toBe(true)

    // Back to the start for the next scenario.
    c.placeInFront(300)
    await resetToStandard(c)
  }
}
