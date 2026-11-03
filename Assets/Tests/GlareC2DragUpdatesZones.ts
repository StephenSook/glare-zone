// LEAF scenario for a Glare Zone done criterion (devpost/design-brief.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {DragKnob} from "../Scripts/DragKnob"
import {
  coneLitTopCm,
  controller,
  distinctValues,
  dragFlag,
  galleryDir,
  interactable,
  near,
  resetToStandard,
  sampleWhileHeld,
} from "./GlareLeafHelpers"

// Hand values from the brief's geometry check, not from GlareMath: with the whole glass lit
// (top Y = 200 cm), a light D cm out reaches 0.91 x D for seated eyes and 0.40 x D for
// standing eyes. A frame of lag between the light moving and the zone redrawing is allowed.
const SEATED_FACTOR = 0.91
const STANDING_FACTOR = 0.4
const LAG_CM = 1.0
// A tilt drag moves the aim about 0.3 cm a frame, about 0.5 cm of reach: one frame of lag.
const TILT_LAG_CM = 1.5
const MIN_WAYPOINTS = 4

/** 2. Sliding or tilting a light updates both zones while dragging. */
@component
export class GlareC2DragUpdatesZones extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    // [right light distance, seated far edge, standing far edge]
    const read = () => [c.lights[1].distanceCm, c.zoneFarEdgeCm("seated"), c.zoneFarEdgeCm("standing")]

    // Only the right light lights the glass: the left one tilted to 80 deg (the steepest the
    // Lens allows) misses it (unit case 9), so each zone is the right light's own zone.
    const isolate = async () => {
      await resetToStandard(c)
      c.setLightTilt(0, 80)
      await sleep(300)
    }
    // At every waypoint both zones match the hand factors for the light where it is now.
    const checkWaypoints = (label: string, samples: number[][]) => {
      expect(samples.length, `${label}: samples taken while held`).toBeGreaterThan(MIN_WAYPOINTS - 1)
      expect(distinctValues(samples, 0), `${label}: the light was at ${distinctValues(samples, 0)} distinct places during the drag`)
        .toBeGreaterThan(2)
      for (const [D, seated, standing] of samples) {
        expect(near(seated, SEATED_FACTOR * D, LAG_CM), `${label}: seated ${seated.toFixed(2)} vs 0.91 x ${D.toFixed(2)}`).toBe(true)
        expect(near(standing, STANDING_FACTOR * D, LAG_CM), `${label}: standing ${standing.toFixed(2)} vs 0.40 x ${D.toFixed(2)}`).toBe(true)
      }
      for (let i = 1; i < samples.length; i++) {
        expect(samples[i][0] <= samples[i - 1][0] + 1e-6, `${label}: the light only moves toward the wall`).toBe(true)
      }
    }

    // Positive control at rest: 0.91 x 80.78 = 73.51 and 0.40 x 80.78 = 32.31.
    await isolate()
    expect(near(c.zoneFarEdgeCm("seated"), 73.51, 0.05), `seated at rest ${c.zoneFarEdgeCm("seated")}`).toBe(true)
    expect(near(c.zoneFarEdgeCm("standing"), 32.31, 0.05), `standing at rest ${c.zoneFarEdgeCm("standing")}`).toBe(true)

    // Slide: push the right aim handle toward the wall.
    const handleR = interactable("Aim handle R")
    const knobR = handleR.getSceneObject().getComponent(DragKnob.getTypeName()) as DragKnob
    const slide = interactor.drag(handleR, galleryDir(c, new vec3(0, 0, -0.3)), 1500)
    checkWaypoints("handle slide", await sampleWhileHeld(slide, () => knobR.isHeld, read))
    expect(c.lights[1].distanceCm, "light slid toward the wall").toBeLessThan(75)

    // Slide with the "Distance" slider (the mouse-friendly path), behind "More controls".
    await isolate()
    await interactor.trigger(interactable("More button"))
    await sleep(400)
    expect(c.isMoreOpen(), "More controls open").toBe(true)
    const slider = interactable("Distance slider R")
    const sliderHeld = dragFlag(slider)
    // The slider stands upright (down is nearer the wall). 1 cm of slider is 20 cm of track:
    // a short, slow drag keeps the light above about 50 cm, where the whole glass is lit.
    const sliderDrag = interactor.drag(slider, galleryDir(c, new vec3(0, -0.03, 0)), 800)
    checkWaypoints("slider slide", await sampleWhileHeld(sliderDrag, sliderHeld, read))

    // Tilt: drag the right aim handle down so the beam aims lower; once its top edge drops
    // below the glass top the zones shrink. At every waypoint both zones match the hand value
    // for the tilt the light has then: the lit top Y from the beam cone itself (coneLitTopCm,
    // not GlareMath), then reach = D x (Y - h) / (300 - Y) (the brief's geometry check).
    await isolate()
    const handReach = (D: number, tiltDeg: number, h: number) => {
      const Y = coneLitTopCm(50, D, tiltDeg)
      return Y === null || Y <= h ? 0 : (D * (Y - h)) / (300 - Y)
    }
    // Positive control at rest: the cone lights the glass to its top, so 73.51 and 32.31.
    expect(near(handReach(80.78, c.lights[1].tiltDeg, 109), 73.51, 0.05), "hand seated reach at rest").toBe(true)
    expect(near(handReach(80.78, c.lights[1].tiltDeg, 160), 32.31, 0.05), "hand standing reach at rest").toBe(true)
    const tiltBefore = c.lights[1].tiltDeg
    // The beam's top passes the glass top about 2.6 deg below the rest tilt. A 0.2 drag over
    // 2 s stopped only 0.2 deg past it (2 or 3 samples, by frame timing), so the drag is 0.3
    // over 3 s: the same speed (same lag), with well over 3 samples past the glass top.
    const tilt = interactor.drag(handleR, galleryDir(c, new vec3(0, -0.3, 0)), 3000)
    const tiltSamples = await sampleWhileHeld(tilt, () => knobR.isHeld,
      () => [c.lights[1].tiltDeg, c.zoneFarEdgeCm("seated"), c.zoneFarEdgeCm("standing"), c.lights[1].distanceCm])
    expect(tiltSamples.length, "tilt: samples taken while held").toBeGreaterThan(MIN_WAYPOINTS - 1)
    let shrinking = 0
    for (const [t, seated, standing, D] of tiltSamples) {
      const wantSeated = handReach(D, t, 109)
      const wantStanding = handReach(D, t, 160)
      if (wantSeated < 73.0) shrinking++
      expect(near(seated, wantSeated, TILT_LAG_CM), `tilt ${t.toFixed(2)}: seated ${seated.toFixed(2)} vs hand ${wantSeated.toFixed(2)}`).toBe(true)
      expect(near(standing, wantStanding, TILT_LAG_CM), `tilt ${t.toFixed(2)}: standing ${standing.toFixed(2)} vs hand ${wantStanding.toFixed(2)}`).toBe(true)
    }
    expect(shrinking, `tilt: ${shrinking} waypoints with the beam's top below the glass top`).toBeGreaterThan(2)
    expect(c.lights[1].tiltDeg, "tilted down (smaller angle from vertical)").toBeLessThan(tiltBefore - 2)
    await resetToStandard(c)
  }
}
