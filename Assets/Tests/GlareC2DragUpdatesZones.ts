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
  SteppedDragInteractor,
} from "./GlareLeafHelpers"

// Hand values from the brief's geometry check, not from GlareMath: with the whole glass lit
// (top Y = 200 cm), a light D cm out reaches 0.91 x D for seated eyes and 0.40 x D for
// standing eyes. A frame of lag between the light moving and the zone redrawing is allowed.
const SEATED_FACTOR = 0.91
const STANDING_FACTOR = 0.4
const LAG_CM = 1.0
const MIN_WAYPOINTS = 4
// The tilt check (B2): the knob moves down in fixed steps and is read after each step, still
// held, once the Lens has rebuilt, so no lag is allowed; the tolerance covers the hand cone
// search (0.5 cm grid, about 0.05 cm of reach). With the RXT13's 40 deg reflector (B3) the
// beam's top leaves the glass top only near 21 deg of tilt, so the steps are 4 cm (6 cm of aim).
const TILT_STEP_CM = 4.0
const TILT_STEPS = 22
const TILT_TOL_CM = 0.15

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

    // Tilt, at fixed knob positions (B2): the right aim handle is held and moved down in
    // TILT_STEPS steps of TILT_STEP_CM, one drag update per step, and the Lens is read after
    // each step while the knob is still held. Before B2 this was a timed drag sampled every
    // 60 ms, so how far the knob went and how many samples fell past the glass top depended on
    // the frame rate (2 or 3 of the 3 needed, BUILD_LOG row 10). Now each step k is a known
    // knob position with a hand value:
    //   aim point:  150 - 1.5 x TILT_STEP_CM x k (rest aim at the print centre, 150 cm; the
    //               handle moves the aim 1.5 cm per cm, as the Lens's handle is specified)
    //   tilt:       atan(sqrt(50^2 + D^2) / (300 - aim)) from straight down
    //   lit top Y:  from the beam cone itself (coneLitTopCm, not GlareMath)
    //   reach:      D x (Y - h) / (300 - Y) (the brief's geometry check)
    await isolate()
    const handReach = (D: number, tiltDeg: number, h: number) => {
      const Y = coneLitTopCm(50, D, tiltDeg)
      return Y === null || Y <= h ? 0 : (D * (Y - h)) / (300 - Y)
    }
    // Positive control at rest: the cone lights the glass to its top, so 73.51 and 32.31.
    expect(near(handReach(80.78, c.lights[1].tiltDeg, 109), 73.51, 0.05), "hand seated reach at rest").toBe(true)
    expect(near(handReach(80.78, c.lights[1].tiltDeg, 160), 32.31, 0.05), "hand standing reach at rest").toBe(true)
    const D0 = c.lights[1].distanceCm
    expect(near(D0, 80.78, 0.01), `right light at the standard 80.78 cm (${D0.toFixed(3)})`).toBe(true)
    const horiz = Math.sqrt(50 * 50 + D0 * D0)
    const handTilt = (k: number) => (Math.atan2(horiz, 300 - (150 - 1.5 * TILT_STEP_CM * k)) * 180) / Math.PI
    expect(near(c.lights[1].tiltDeg, handTilt(0), 0.01), `rest tilt ${c.lights[1].tiltDeg.toFixed(3)} vs hand ${handTilt(0).toFixed(3)}`).toBe(true)
    const stepped = new SteppedDragInteractor("C2 stepped drag")
    const tiltSamples: number[][] = []
    const delivered = await stepped.stepDrag(handleR, galleryDir(c, new vec3(0, -TILT_STEP_CM, 0)), TILT_STEPS, (k) => {
      tiltSamples.push([k, c.lights[1].tiltDeg, c.zoneFarEdgeCm("seated"), c.zoneFarEdgeCm("standing"),
        c.lights[1].distanceCm, knobR.isHeld ? 1 : 0])
    })
    expect(delivered, "tilt: every knob step was delivered").toBe(TILT_STEPS)
    expect(tiltSamples.length, "tilt: one sample per knob step").toBe(TILT_STEPS)
    let shrinking = 0
    let prevSeated = Infinity
    for (const [k, t, seated, standing, D, held] of tiltSamples) {
      const tilt = handTilt(k)
      const wantSeated = handReach(D0, tilt, 109)
      const wantStanding = handReach(D0, tilt, 160)
      if (wantSeated < 73.0) shrinking++
      expect(held, `tilt step ${k}: the knob is still held`).toBe(1)
      expect(near(D, D0, 1e-3), `tilt step ${k}: the light did not slide (${D.toFixed(3)})`).toBe(true)
      expect(near(t, tilt, 0.01), `tilt step ${k}: tilt ${t.toFixed(3)} vs hand ${tilt.toFixed(3)}`).toBe(true)
      expect(near(seated, wantSeated, TILT_TOL_CM), `tilt step ${k} (${tilt.toFixed(2)} deg): seated ${seated.toFixed(2)} vs hand ${wantSeated.toFixed(2)}`).toBe(true)
      expect(near(standing, wantStanding, TILT_TOL_CM), `tilt step ${k} (${tilt.toFixed(2)} deg): standing ${standing.toFixed(2)} vs hand ${wantStanding.toFixed(2)}`).toBe(true)
      expect(seated <= prevSeated + 1e-6, `tilt step ${k}: seated only shrinks`).toBe(true)
      prevSeated = seated
    }
    // Hand (40 deg reflector): the beam's top leaves the glass top between steps 15 and 16
    // (21.60 and 21.12 deg of tilt, aim 60 and 54 cm); steps 16 to 22 (aim 54 to 18 cm) are past it.
    expect(shrinking, `tilt: ${shrinking} knob positions with the beam's top below the glass top`).toBeGreaterThan(3)
    print("[C2] tilt at fixed knob positions (step: tilt deg, seated cm, standing cm): " +
      tiltSamples.map(([k, t, s, st]) => `${k}: ${t.toFixed(3)}, ${s.toFixed(2)}, ${st.toFixed(2)}`).join("; "))
    await resetToStandard(c)
  }
}
