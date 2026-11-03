// LEAF scenario: the Lens says "clear" only when all three eye heights are clear. A light whose
// zone reaches the viewing area for any eye height, or that cannot be computed, reads as glare
// (v0.4 item A, BUILD_LOG row 14).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import * as G from "../Scripts/GlareMath"
import {controller, near, resetToStandard} from "./GlareLeafHelpers"

const CLEAR = "All three: clear"
const STD_GLARE = "Glare in the viewing area: Seated, Child seated"
const SETTLE_MS = 1600

/** 15. "Clear" only when all three eye heights are clear; what cannot be computed is glare. */
@component
export class GlareC15ClearOnlyAllThree extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)

    // Standard placement, Standing chosen: the standing zone (0.40 x 80.78 = 32.31 cm) stays
    // out of the 60 cm area, but seated (73.51) and child seated (77.55) reach in. Not clear.
    expect(c.getEyePreset(), "Standing chosen").toBe("standing")
    expect(c.zoneFarEdgeCm("standing") < 60, `standing reach ${c.zoneFarEdgeCm("standing")} is outside the area`).toBe(true)
    expect(c.verdict(), "standard placement").toBe("glare")
    expect(c.floorStatusText(), "status at the standard placement").toBe(STD_GLARE)
    expect(c.floorStatusText().indexOf("clear") < 0, "the word clear is not shown").toBe(true)

    // Positive control: both lights at 62 cm. Hand values 0.40, 0.91 and 0.96 x 62 = 24.8,
    // 56.42 and 59.52 cm, all short of the 60 cm near edge: all three clear.
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(300)
    expect(near(c.zoneFarEdgeCm("child"), 59.52, 0.1), `child reach at 62 cm ${c.zoneFarEdgeCm("child")} vs hand 59.52`).toBe(true)
    expect(c.verdict(), "both at 62 cm").toBe("clear")
    expect(c.floorStatusText(), "status at 62 cm").toBe(CLEAR)

    // One light's zone reaching the area is enough: the right light back at the standard
    // placement makes the combined seated zone reach 73.51 cm again.
    c.setLightDistance(1, G.standardPlacementCm())
    await sleep(300)
    expect(c.verdict(), "right light back at 80.78 cm").toBe("glare")
    expect(c.floorStatusText(), "status with one light reaching in").toBe(STD_GLARE)

    // A light that cannot be computed: from all three clear (both at 62 cm), the right light
    // gets a distance that is not a number. Without a computable zone the floor would show
    // nothing, which must not read as clear.
    c.setLightDistance(1, 62)
    await sleep(300)
    expect(c.floorStatusText(), "control: clear just before").toBe(CLEAR)
    c.setLightDistance(1, Number.NaN)
    await sleep(300)
    // What the user sees first: the status line and the verdict.
    expect(c.floorStatusText(), "status when it cannot be computed").toBe("Glare (cannot be computed): all three")
    expect(c.verdict(), "a light that cannot be computed").toBe("glare")
    for (const k of ["standing", "seated", "child"]) {
      expect(c.zoneUncomputable(k as "standing"), `${k}: cannot be computed`).toBe(true)
    }
    expect(c.verdictLineText(), "verdict on the card").toBe("Glare (cannot be computed): all three")
    expect(c.headlineText(), "the one line").toBe("Standing: glare cannot be computed, so not clear")
    // The session log says the same once the move settles.
    await sleep(SETTLE_MS)
    const f = G.parseLogLine(c.logLines()[c.logLines().length - 1])!
    expect(f.distance_cm + " " + f.verdict, "log line for the broken light").toBe("nan glare")

    // A real number again: back to a computable, clear answer.
    c.setLightDistance(1, 62)
    await sleep(300)
    expect(c.zoneUncomputable("seated"), "computable again").toBe(false)
    expect(c.floorStatusText(), "clear again at 62 cm").toBe(CLEAR)

    await resetToStandard(c)
    expect(c.floorStatusText(), "back to the standard placement").toBe(STD_GLARE)
  }
}
