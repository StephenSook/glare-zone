// LEAF scenario: floor rings at each eye height's viewing spot. Standing in one for 1 s switches
// to that eye height; a shorter stay does not, and stepping out cancels (v0.4 item C, BUILD_LOG
// row 16).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {LAYOUT} from "../Scripts/GlareLayout"
import {controller, resetToStandard, stepTo} from "./GlareLeafHelpers"

/** 17. A 1 s hold in a floor ring switches the eye height; a shorter stay does not. */
@component
export class GlareC17FloorRingHold extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const y = () => c.eyeLocal().y
    const into = async (key: "standing" | "seated" | "child", dx: number = 0) => {
      const r = c.ringCentre(key)
      await stepTo(c, new vec3(r.x + dx, y(), r.z), 0)
    }
    const away = async () => stepTo(c, new vec3(0, y(), LAYOUT.startDistanceCm), 0)

    // The rings are drawn, one per eye height, in the viewing area, and the start position
    // (3 m out) is in none of them.
    for (const k of ["standing", "seated", "child"]) {
      expect(c.ringQuadCount(k as "seated") > 20, `${k} ring drawn`).toBe(true)
      const r = c.ringCentre(k as "seated")
      const area = c.getViewingArea()
      expect(r.z > area.min && r.z < area.max, `${k} ring at ${r.z} cm, inside the viewing area`).toBe(true)
    }
    expect(c.ringState().key, "start position is in no ring").toBe("")
    expect(c.getEyePreset(), "Standing at the start").toBe("standing")

    // Control for the ring test: just outside the seated ring's edge is no ring.
    await into("seated", c.ringRadiusCm() + 3)
    await sleep(100)
    expect(c.ringState().key, "3 cm outside the ring edge").toBe("")

    // A shorter stay (0.5 s) does not switch; stepping out cancels, and waiting outside
    // afterwards still does not switch.
    await into("seated")
    await sleep(500)
    const mid = c.ringState()
    expect(c.getEyePreset(), "0.5 s: not switched").toBe("standing")
    expect(mid.key, "inside the seated ring").toBe("seated")
    expect(mid.progress > 0.2 && mid.progress < 0.95, `hold under way after 0.5 s (${mid.progress.toFixed(2)})`).toBe(true)
    await away()
    await sleep(200)
    expect(c.ringState().key, "stepped out").toBe("")
    await sleep(1000)
    expect(c.getEyePreset(), "stepping out cancelled: still Standing 1.2 s later").toBe("standing")

    // Stepping back in starts the hold again from zero.
    await into("seated")
    await sleep(100)
    expect(c.ringState().progress < 0.5, `hold restarted (${c.ringState().progress.toFixed(2)})`).toBe(true)

    // A full hold (over 1 s) switches to Seated, once.
    await sleep(1200)
    expect(c.getEyePreset(), "1 s hold in the seated ring: Seated").toBe("seated")
    expect(c.ringState().fired, "the hold fired").toBe(true)
    await sleep(800)
    expect(c.getEyePreset(), "staying on keeps Seated").toBe("seated")

    // The other two rings.
    await into("child")
    await sleep(1300)
    expect(c.getEyePreset(), "1 s hold in the child seated ring").toBe("child")
    await into("standing")
    await sleep(400)
    expect(c.getEyePreset(), "0.4 s in the standing ring: still Child seated").toBe("child")
    await sleep(900)
    expect(c.getEyePreset(), "1.3 s in the standing ring: Standing").toBe("standing")

    await away()
    await resetToStandard(c)
  }
}
