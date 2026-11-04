// Media helper, not a test: the demo take (T1, BUILD_LOG row 42). One continuous run in the preview,
// driven through the Lens's own controls: the Eye height button pressed by LEAF's hand, both lights
// slid and re-aimed with stepped drags on the real aim handles, and the viewpoint moved in small
// steps (the room moved around the eye, as walking and turning the head look). LEAF's overlay is
// hidden. Every step and change prints one "[TAKE]" line: the step, the eye height preset, each
// light's distance and beam angle, the card's exact text (with the wheelchair line), and the eye's
// position and head pitch, so each event can be placed on the recording's frames.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {GlareZoneController} from "../Scripts/GlareZoneController"
import * as G from "../Scripts/GlareMath"
import {SteppedDragInteractor, controller, galleryDir, hideLeafOverlay, interactable, press, resetToStandard, stepTo} from "./GlareLeafHelpers"

const FRAME_MS = 33

/** The room turns about the eye's right axis by `deg` (positive looks down), in one frame. */
function pitchOnce(c: GlareZoneController, deg: number): void {
  const gt = c.galleryObject().getTransform()
  const camT = c.cameraObject.getTransform()
  const cam = camT.getWorldPosition()
  const right = camT.getWorldRotation().multiplyVec3(vec3.right())
  const camLocal = c.eyeLocal()
  const r = quat.angleAxis((deg * Math.PI) / 180, right).multiply(gt.getWorldRotation())
  gt.setWorldRotation(r)
  gt.setWorldPosition(cam.sub(r.multiplyVec3(camLocal)))
}

@component
export class GlareMediaDemoTake extends Scenario {
  private pitchDeg = 0 // positive: looking down

  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    const hand = new DefaultLeafInteractor()
    const stepper = new SteppedDragInteractor("Demo take drag")
    const f1 = (x: number) => x.toFixed(1)
    const f2 = (x: number) => x.toFixed(2)
    const log = (what: string) => {
      const e = c.eyeLocal()
      print(`[TAKE] ${what} | preset=${c.getEyePreset()} | L ${f2(c.lights[0].distanceCm)} cm beam ${f2(c.beamAngleDeg(0))} deg "${c.beamLabelText(0)}"` +
        ` warn=${c.beamLabelWarns(0)} | R ${f2(c.lights[1].distanceCm)} cm beam ${f2(c.beamAngleDeg(1))} deg "${c.beamLabelText(1)}" warn=${c.beamLabelWarns(1)}` +
        ` | card "${c.headlineText()}" / "${c.verdictLineText()}" / "${c.disclaimerText()}" / "${c.wheelchairLineText()}"` +
        ` | eye x ${f1(e.x)} y ${f1(e.y)} z ${f1(e.z)} cm, pitch ${f1(this.pitchDeg)} deg | glare spots ${c.glareSpotVisible() ? "shown" : "none"}`)
    }
    // Walk: the eye moves to (x, y, z) and the head pitches to `pitchTo`, in `frames` small steps.
    const walk = async (to: vec3, pitchTo: number, frames: number) => {
      const from = c.eyeLocal()
      const p0 = this.pitchDeg
      for (let k = 1; k <= frames; k++) {
        const t = k / frames
        const s = t * t * (3 - 2 * t) // ease in and out: no jump at either end
        pitchOnce(c, -this.pitchDeg) // level the head, step, then pitch again
        await stepTo(c, new vec3(from.x + (to.x - from.x) * s, from.y + (to.y - from.y) * s, from.z + (to.z - from.z) * s), 0)
        this.pitchDeg = p0 + (pitchTo - p0) * s
        pitchOnce(c, this.pitchDeg)
        await sleep(FRAME_MS)
      }
    }
    // Slide (toward the wall) or re-aim (up or down) one light with its real aim handle, in steps.
    const dragHandle = async (i: number, local: vec3, steps: number) => {
      const name = i === 0 ? "Aim handle L" : "Aim handle R"
      const per = new vec3(local.x / steps, local.y / steps, local.z / steps)
      await stepper.stepDrag(interactable(name), galleryDir(c, per), steps, (k) => {
        if (k % 10 === 0 || k === steps) log(`  ${name} step ${k}/${steps}`)
      }, 2)
    }

    // Set-up, before the take's opening still: Seated, standing in the seated zone on the centre line,
    // 65 cm from the wall, looking up at the print (the glare spots sit near its top from here).
    await resetToStandard(c)
    await press(hand, "Eye height button") // Standing -> Seated (the Lens moves the floor: eyes at 109 cm)
    await stepTo(c, new vec3(0, c.eyeLocal().y, 65), 0)
    this.pitchDeg = -44
    pitchOnce(c, this.pitchDeg)
    await sleep(2500)
    log("T0 opening still (set-up done)")
    await sleep(2500)

    // 1. Open on the glare: hold 10 s.
    log("STEP 1 open on the glare: start of the 10 s hold")
    await sleep(10000)
    log("STEP 1 end")

    // 2. Walk back to the overview, 3 m out, in small steps (5 s), head turning down to the floor; hold 15 s.
    log("STEP 2 walk back: start")
    await walk(new vec3(0, c.eyeLocal().y, 300), 8, 150)
    log("STEP 2 overview: start of the 15 s hold")
    await sleep(15000)
    log("STEP 2 end")

    // 3. Slide both lights in to 62 cm with the aim handles (about 3 s each).
    log("STEP 3 slide: start")
    const D0 = c.lights[0].distanceCm
    await dragHandle(1, new vec3(0, 0, 62 - c.lights[1].distanceCm), 36)
    await dragHandle(0, new vec3(0, 0, 62 - D0), 36)
    log("STEP 3 slide: end")
    await sleep(1600) // the move settles (the card's change lines go, the estimate returns)

    // 4. Hold 6 s on "All three: clear".
    log("STEP 4 clear: start of the 6 s hold")
    await sleep(6000)
    log("STEP 4 end")

    // 4b. Re-aim both lights at the print centre with the aim handles (up or down); hold 6 s.
    log("STEP 4b re-aim: start")
    for (const i of [1, 0]) {
      const aimY = G.aimPoint(c.lights[i]).y
      await dragHandle(i, new vec3(0, (150 - aimY) / 1.5, 0), 30) // the handle moves the aim 1.5 cm per cm
    }
    log("STEP 4b re-aim: end")
    await sleep(1600)
    log("STEP 4b beam: start of the 6 s hold")
    await sleep(6000)
    log("STEP 4b end")

    // 5. Eye height: My eyes (Seated -> Child seated -> My eyes; the Lens puts the floor back at
    //    standing height for My eyes), then crouch in small steps until the eye is at 96 cm; hold 8 s.
    log("STEP 5 eye height: start")
    await press(hand, "Eye height button")
    log("STEP 5 pressed once")
    await sleep(700)
    await press(hand, "Eye height button")
    log("STEP 5 pressed twice")
    await sleep(700)
    const e5 = c.eyeLocal()
    await walk(new vec3(e5.x, 96, e5.z), this.pitchDeg, 75)
    await sleep(1600)
    log("STEP 5 My eyes at 96 cm: start of the 8 s hold")
    await sleep(8000)
    log("STEP 5 end")

    // 6. Eye height back to Standing (the Lens puts the eyes at 160 cm), the head turning level so
    //    the card shows; hold 3 s; then the closing still.
    await press(hand, "Eye height button")
    log("STEP 6 Standing pressed")
    const e6 = c.eyeLocal()
    await walk(new vec3(e6.x, e6.y, e6.z), 0, 30)
    log("STEP 6 Standing: start of the 3 s hold")
    await sleep(3000)
    log("STEP 6 end, closing still")
    await sleep(2500)
    log("END")
  }
}
