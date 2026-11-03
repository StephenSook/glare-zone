// LEAF scenario: "suggest a setback" (B5, BUILD_LOG row 25). While the answer is glare, a faint
// ghost of each fixture sits on its ceiling track where all three eye heights would be clear,
// with one short label; the lights stay where they are until the user moves them.
// Hand values: with the whole glass lit (top Y = 200 cm) a light D cm out reaches
// D x (200 - h) / (300 - 200): child seated (h = 104) binds at 0.96 x D, and a zone reaching
// exactly the 60 cm near edge counts as inside, so the setback is just under 60 / 0.96 = 62.5 cm.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import * as G from "../Scripts/GlareMath"
import {controller, near, resetToStandard} from "./GlareLeafHelpers"

const SETTLE_MS = 1600 // past the 1.2 s after a change, when the suggestion is solved
const HAND_SETBACK = 60 / 0.96 // 62.5 cm

/** 20. Suggest a setback: a ghost fixture on each track where all three are clear. */
@component
export class GlareC20SetbackGhost extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const both = async (cm: number) => {
      c.setLightDistance(0, cm)
      c.setLightDistance(1, cm)
      await sleep(SETTLE_MS)
    }

    // Positive first: the standard placement is glare, and the suggestion is shown.
    expect(c.verdict(), "standard placement").toBe("glare")
    const s = c.setbackSuggestion()
    expect(s !== null, "a setback is suggested").toBe(true)
    const S = s as number
    const solveMs = c.setbackSolveMs()
    expect(near(S, HAND_SETBACK, G.SETBACK_TOL_CM + 1e-6), `setback ${S.toFixed(4)} vs hand 60 / 0.96 = 62.5`).toBe(true)
    expect(c.setbackShown(), "ghost fixtures and label shown").toBe(true)
    expect(c.setbackLabelShown(), "label").toBe("All three clear at 62.4 cm")
    // Each ghost fixture on its own light's track (x = -50 and +50), the fixture's body height
    // (6 cm under the 300 cm ceiling), at the suggested distance.
    const centres = c.setbackMarkerCentres()
    for (let i = 0; i < 2; i++) {
      const x = c.lights[i].xCm
      const m = centres[i]
      expect(near(m.x, x, 0.01) && near(m.y, 294, 0.01) && near(m.z, S, 0.01),
        `ghost fixture ${i === 0 ? "L" : "R"} at (${m.x.toFixed(2)}, ${m.y.toFixed(2)}, ${m.z.toFixed(2)}) vs (${x}, 294, ${S.toFixed(2)})`).toBe(true)
    }
    // The label faces the viewer: its front points at the eye within 10 deg.
    const facing = c.setbackLabelFacingDeg()
    expect(facing < 10, `label faces the viewer (${facing.toFixed(1)} deg off)`).toBe(true)
    // The lights are not moved for you.
    expect(near(c.lights[0].distanceCm, 80.78, 0.01) && near(c.lights[1].distanceCm, 80.78, 0.01), "lights still at 80.78 cm").toBe(true)

    // Move both lights to the suggestion: all three clear, so the ghost goes away.
    await both(S)
    expect(c.verdict(), `both lights at the suggested ${S.toFixed(2)} cm`).toBe("clear")
    expect(c.verdictLineText(), "answer card").toBe("All three: clear")
    expect(c.setbackShown(), "no ghost once clear").toBe(false)

    // Just past it (0.3 cm farther out): glare again, and the same suggestion is back.
    await both(S + 0.3)
    expect(c.verdict(), "0.3 cm past the suggestion").toBe("glare")
    expect(c.setbackShown(), "ghost back").toBe(true)
    expect(near(c.setbackSuggestion() as number, S, G.SETBACK_TOL_CM + 1e-6), "same suggestion from 0.3 cm out").toBe(true)

    // Part of the way (70 cm): still glare, and the suggestion does not depend on where the lights
    // are, only on their aim and the viewing area.
    await both(70)
    expect(c.verdict(), "lights at 70 cm").toBe("glare")
    expect(near(c.setbackSuggestion() as number, S, G.SETBACK_TOL_CM + 1e-6), `same suggestion from 70 cm (${c.setbackSuggestion()})`).toBe(true)
    expect(c.setbackShown(), "ghost shown at 70 cm").toBe(true)

    // Controls: nothing to suggest when already clear (both lights tilted to 80 deg miss the
    // glass, unit case 9), and with the viewing area from 80 cm the standard placement's
    // 77.55 cm child seated zone is outside it.
    await resetToStandard(c)
    c.setLightTilt(0, 80)
    c.setLightTilt(1, 80)
    await sleep(SETTLE_MS)
    expect(c.verdict(), "tilted to 80 deg").toBe("clear")
    expect(c.setbackShown(), "no ghost when the beams miss the glass").toBe(false)
    await resetToStandard(c)
    c.setViewingArea(80, G.VIEWING_FAR_CM)
    await sleep(SETTLE_MS)
    expect(c.verdict(), "viewing area from 80 cm").toBe("clear")
    expect(c.setbackShown(), "no ghost when already clear").toBe(false)

    print(`[C20] setback ${S.toFixed(3)} cm (hand 62.5), label "All three clear at 62.4 cm", ` +
      `solved in ${solveMs.toFixed(1)} ms at the standard placement`)
    await resetToStandard(c)
  }
}
