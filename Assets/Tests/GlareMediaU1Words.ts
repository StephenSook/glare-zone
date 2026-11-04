// Media helper, not a test: the screens for the U1 wording pass (before and after stills, BUILD_LOG
// row 39). Holds, each about 5 s: the opening view (standard setback, Standing); Seated with the head
// turned 14 deg down so the answer card and the floor show together; and Seated while a light moves
// (the change lines show). LEAF's overlay is hidden.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {GlareZoneController} from "../Scripts/GlareZoneController"
import {controller, hideLeafOverlay, resetToStandard} from "./GlareLeafHelpers"

/** Look down by `deg`, in 1 deg steps: the room turns about the eye's right axis, as a head pitch looks. */
async function pitchHeadBy(c: GlareZoneController, deg: number): Promise<void> {
  const steps = Math.max(1, Math.round(Math.abs(deg)))
  for (let i = 0; i < steps; i++) {
    const gt = c.galleryObject().getTransform()
    const camT = c.cameraObject.getTransform()
    const cam = camT.getWorldPosition()
    const right = camT.getWorldRotation().multiplyVec3(vec3.right())
    const camLocal = c.eyeLocal()
    const r = quat.angleAxis(((deg / steps) * Math.PI) / 180, right).multiply(gt.getWorldRotation())
    gt.setWorldRotation(r)
    gt.setWorldPosition(cam.sub(r.multiplyVec3(camLocal)))
    await sleep(40)
  }
}

@component
export class GlareMediaU1Words extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    print("[U1 STILL] A opening view")
    await sleep(5000)
    c.setEyePreset("seated")
    await sleep(1200)
    await pitchHeadBy(c, 14)
    await sleep(800)
    print(`[U1 STILL] B seated, card and floor: headline "${c.headlineText()}", floor label "${c.zoneLabelText("seated")}"`)
    await sleep(5000)
    // A slow slide, so the change lines show for a while.
    for (let i = 1; i <= 100; i++) {
      c.setLightDistance(1, 80.78 - (10 * i) / 100)
      await sleep(50)
    }
    print(`[U1 STILL] C seated, moving: headline "${c.headlineText()}"`)
    await sleep(400)
    print("[U1 STILL] end")
  }
}
