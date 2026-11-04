// Media helper, not a test: the G1 floor view for two stills (BUILD_LOG row 36). Seated chosen, the
// head turned 20 deg down to the floor: the soft patch per lamp under the Seated zone, the other
// eye heights faint, the viewing area band with its bold near edge, and the flashing warning fill.
// First at the standard setback (80.78 cm), then with both lights at 62 cm. LEAF's overlay is hidden.
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
export class GlareMediaG1Floor extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    c.setEyePreset("seated")
    await sleep(1600)
    await pitchHeadBy(c, 24)
    await sleep(1600)
    print(`[G1 STILL] standard setback: Seated ${c.zoneFarEdgeCm("seated").toFixed(2)} cm, lamp patches ${c.lobePatchCounts().join("/")}; card "${c.verdictLineText()}"`)
    await sleep(6000)
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(2500)
    print(`[G1 STILL] 62 cm: Seated ${c.zoneFarEdgeCm("seated").toFixed(2)} cm, lamp patches ${c.lobePatchCounts().join("/")}; card "${c.verdictLineText()}"`)
    await sleep(6000)
    print("[G1 STILL] end")
  }
}
