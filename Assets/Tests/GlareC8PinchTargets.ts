// LEAF scenario: every pinch target is big enough and far enough from its neighbours.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {EyePreset} from "../Scripts/GlareZoneController"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {
  AngularRect,
  aabbCorners,
  angularGap,
  angularRect,
  angularSize,
  controller,
  interactable,
  press,
  resetToStandard,
  targetVisual,
} from "./GlareLeafHelpers"

const MIN_SIZE_DEG = 2 // Snap: pinch targets at least 2 deg in angular size
const MIN_GAP_DEG = 1 // ... and spaced at least 1 deg apart

/**
 * 8. Snap's sizing guide, checked from the start position: every control visible at the
 * same time is at least 2 deg across and at least 1 deg clear of its neighbours, in the
 * opening view, with "More controls" open, and in the results view; the aim handles and
 * the floor's viewing-area handles are at least 2 deg across.
 */
@component
export class GlareC8PinchTargets extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)

    // Positive and negative controls for the angle maths, in front of the camera.
    const cam = c.cameraObject.getTransform()
    const square = (cm: number, dist: number) => [-1, 1].map((s) =>
      cam.getWorldTransform().multiplyPoint(new vec3((s * cm) / 2, (s * cm) / 2, -dist)))
    expect(angularSize(angularRect(c, square(3.5, 100))), "3.5 cm at 1 m is 2 deg").toBeCloseTo(2.0, 1)
    expect(angularSize(angularRect(c, square(10, 300))), "the old 10 cm knob at 3 m").toBeLessThan(MIN_SIZE_DEG)
    expect(angularSize(angularRect(c, square(12, 290))), "a 12 cm knob at 2.9 m").toBeGreaterThan(MIN_SIZE_DEG)

    const rectOf = (so: SceneObject): AngularRect => angularRect(c, aabbCorners(targetVisual(so)))
    const check = (state: string, names: string[]) => {
      const rects = names.map((n) => ({n, r: rectOf(findSceneObjectByName(n)!)}))
      for (const {n, r} of rects) {
        expect(angularSize(r), `${state}: ${n} is ${angularSize(r).toFixed(2)} deg`).toBeGreaterThan(MIN_SIZE_DEG)
      }
      let minGap = 1e9
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const gap = angularGap(rects[i].r, rects[j].r)
          minGap = Math.min(minGap, gap)
          expect(gap, `${state}: ${rects[i].n} to ${rects[j].n} gap ${gap.toFixed(2)} deg`).toBeGreaterThan(MIN_GAP_DEG)
        }
      }
      const minSize = Math.min(...rects.map((x) => angularSize(x.r)))
      print(`[C8] ${state}: smallest target ${minSize.toFixed(2)} deg, smallest gap ${minGap.toFixed(2)} deg`)
    }

    const MAIN = ["Eye height button", "Save results button", "More button"]
    const MORE = MAIN.concat(["Paper art button", "Dimmer slider L", "Dimmer slider R", "Distance slider L", "Distance slider R"])
    // Every layout: each eye-height preset (Standing and My eyes above the print, Seated and
    // Child seated below it), with More controls closed and then open.
    const presets: EyePreset[] = ["standing", "seated", "child", "my"]
    for (const moreOpen of [false, true]) {
      if (moreOpen) await press(interactor, "More button")
      for (const preset of presets) {
        c.setEyePreset(preset)
        await sleep(200)
        expect(c.isMoreOpen(), "More state").toBe(moreOpen)
        check(`${preset}${moreOpen ? ", More open" : ""}`, moreOpen ? MORE : MAIN)
      }
    }
    // Sliders at the other end of their tracks too (the knob moves with the value).
    c.setEyePreset("standing")
    c.setDimmer(0, 0)
    c.setDimmer(1, 0)
    c.setLightDistance(0, 150)
    c.setLightDistance(1, 30)
    await sleep(600)
    check("standing, More open, knobs moved", MORE)
    c.setEyePreset("seated")
    await sleep(200)
    check("seated, More open, knobs moved", MORE)
    await resetToStandard(c)

    // The palm-up "Bring panels here" button, shown where a raised left palm would put it:
    // about 40 cm out and 20 cm down from the eye.
    c.handMenu().showAt(cam.getWorldTransform().multiplyPoint(new vec3(0, -20, -40)), 3)
    await sleep(200)
    check("hand menu", ["Bring panels here button"])

    await press(interactor, "Save results button")
    check("results view", ["Done button", "Restart button"])
    await resetToStandard(c)

    // Handles on the wall and the floor (one at a time: they are far apart).
    for (const n of ["Aim handle L", "Aim handle R", "Viewing area near edge handle", "Viewing area far edge handle"]) {
      const s = angularSize(rectOf(findSceneObjectByName(n)!))
      print(`[C8] ${n}: ${s.toFixed(2)} deg`)
      expect(s, `${n} is ${s.toFixed(2)} deg`).toBeGreaterThan(MIN_SIZE_DEG)
    }
  }
}
