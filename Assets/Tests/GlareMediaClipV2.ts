// Media helper, not a test: the timeline for the 30 to 45 s preview clip (v2, BUILD_LOG row 33).
// The opening view; Seated with the red overlap at the standard setback (80.78 cm); both lights
// slid to the 62 cm demo setback; the card turns "All three: clear"; then Save results, whose
// cards name the lamp. LEAF's overlay is hidden.
// The head turns are made by turning the practice room around the eye, as a head pitch looks.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {GlareZoneController} from "../Scripts/GlareZoneController"
import * as G from "../Scripts/GlareMath"
import {controller, hideLeafOverlay, press, resetToStandard} from "./GlareLeafHelpers"

const STEP_MS = 40

/** Look down by `deg` (negative: up), in 1 deg steps: the room turns about the eye's right axis. */
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
    await sleep(STEP_MS)
  }
}

@component
export class GlareMediaClipV2 extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    print("[CLIP] t0 opening view")
    await sleep(4000)

    // Seated: the red overlap at the standard setback, seen on the floor.
    await press(interactor, "Eye height button")
    print("[CLIP] seated")
    await sleep(2000)
    await pitchHeadBy(c, 20)
    print("[CLIP] floor, red overlap")
    await sleep(5000)
    await pitchHeadBy(c, -20)
    await sleep(800)

    // More controls, then both lights slide toward the wall to 62 cm, together.
    await press(interactor, "More button")
    await sleep(1000)
    print("[CLIP] slide start")
    const D0 = G.standardPlacementCm()
    const n = 120
    for (let i = 1; i <= n; i++) {
      const d = D0 + ((62 - D0) * i) / n
      c.setLightDistance(0, d)
      c.setLightDistance(1, d)
      await sleep(STEP_MS)
    }
    print(`[CLIP] slide end at ${c.lights[0].distanceCm.toFixed(2)} and ${c.lights[1].distanceCm.toFixed(2)} cm; card "${c.verdictLineText()}"`)
    await sleep(4000)
    await pitchHeadBy(c, 20)
    print(`[CLIP] floor, clear; floor line "${c.floorStatusText()}"`)
    await sleep(4000)
    await pitchHeadBy(c, -20)
    await sleep(500)

    // Save results: a card per light, naming the lamp (TSLight RXT13, manufacturer data, not measured).
    await press(interactor, "Save results button")
    print(`[CLIP] results cards: ${c.cardCount()}`)
    await sleep(5000)
    print("[CLIP] end")
    await sleep(500)
  }
}
