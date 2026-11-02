// LEAF scenario: zones and eye-height marks show at full strength while a light is being
// adjusted and stay faint afterwards (brief: "Floor zones: show while I am adjusting a light
// and stay faint afterwards"; "Glare bands on the wall: same as the floor zones").
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {DragKnob} from "../Scripts/DragKnob"
import {EyeKey} from "../Scripts/GlareZoneController"
import {controller, galleryDir, interactable, near, resetToStandard, sampleWhileHeld} from "./GlareLeafHelpers"

// Fixture (the design values, written here, not read from the product): zones 0.55 opaque
// while adjusting and 0.30 after; the wall marks 0.20 more (0.75 and 0.50); full holds for
// 1.2 s after the last change, so 2 s after letting go everything is faint.
const ZONE_FULL = 0.55
const ZONE_FAINT = 0.3
const MARK_FULL = 0.75
const MARK_FAINT = 0.5
const SETTLED_MS = 2000
const EYES: EyeKey[] = ["standing", "seated", "child"]

/** 11. Full while adjusting, faint afterwards: floor zones and wall marks, during and after a drag. */
@component
export class GlareC11FullThenFaint extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c) // waits 1.6 s
    await sleep(SETTLED_MS)
    const read = () => EYES.map((k) => c.zoneAlpha(k)).concat(EYES.map((k) => c.bandAlpha(k)))

    // At rest (positive control for "faint"): every zone 0.30, every mark 0.50.
    const rest = read()
    for (let i = 0; i < 3; i++) {
      expect(near(rest[i], ZONE_FAINT, 0.01), `${EYES[i]} zone faint at rest: ${rest[i]}`).toBe(true)
      expect(near(rest[3 + i], MARK_FAINT, 0.01), `${EYES[i]} mark faint at rest: ${rest[3 + i]}`).toBe(true)
    }

    // While the right aim handle is held and moving: full at every waypoint.
    const handle = interactable("Aim handle R")
    const knob = handle.getSceneObject().getComponent(DragKnob.getTypeName()) as DragKnob
    const drag = interactor.drag(handle, galleryDir(c, new vec3(0, 0, -0.2)), 1200)
    const during = await sampleWhileHeld(drag, () => knob.isHeld, read)
    expect(during.length, "samples while the handle was held").toBeGreaterThan(3)
    for (const s of during) {
      for (let i = 0; i < 3; i++) {
        expect(near(s[i], ZONE_FULL, 0.01), `${EYES[i]} zone full while adjusting: ${s[i]}`).toBe(true)
        expect(near(s[3 + i], MARK_FULL, 0.01), `${EYES[i]} mark full while adjusting: ${s[3 + i]}`).toBe(true)
      }
    }

    // After letting go: faint again once the hold has passed.
    await sleep(SETTLED_MS)
    const after = read()
    for (let i = 0; i < 3; i++) {
      expect(near(after[i], ZONE_FAINT, 0.01), `${EYES[i]} zone faint afterwards: ${after[i]}`).toBe(true)
      expect(near(after[3 + i], MARK_FAINT, 0.01), `${EYES[i]} mark faint afterwards: ${after[3 + i]}`).toBe(true)
    }
    await resetToStandard(c)
  }
}
