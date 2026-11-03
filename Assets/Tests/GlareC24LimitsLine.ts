// LEAF scenario: the model's limits on the answer card (eighth note, BUILD_LOG row 31). The line
// under the verdict says the answer is computed for flat glass in this room, so "All three: clear"
// does not read as a promise about every room. Whenever the card shows a verdict (every eye height,
// More open, while a light moves, the results view, the panels under the print) the line is shown,
// in view, inside the card's width, and not faded out.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {aabbCorners, angularRect, controller, outOfView, resetToStandard, stepTo} from "./GlareLeafHelpers"

const LIMITS = "Computed for flat glass in this room; manufacturer lamp data, not measured"

/** 24. The limits line shows under the verdict whenever the card shows one. */
@component
export class GlareC24LimitsLine extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    let checked = 0
    const check = (tag: string) => {
      const verdict = c.verdictLineText()
      expect(verdict.length > 0, `${tag}: the card shows a verdict`).toBe(true)
      expect(c.disclaimerText(), `${tag}: limits line`).toBe(LIMITS)
      const t = c.disclaimerComponent()
      expect(t.textFill.color.a > 0.5, `${tag}: limits line not faded (alpha ${t.textFill.color.a.toFixed(2)})`).toBe(true)
      expect(outOfView(c, aabbCorners(t), 0.5), `${tag}: limits line in view`).toBe("")
      // Inside the card's width (the backing's corners, as seen from the eye), so it reads as the card's.
      const card = angularRect(c, c.answerPlateCorners())
      const line = angularRect(c, aabbCorners(t))
      expect(line.x0 >= card.x0 - 0.05 && line.x1 <= card.x1 + 0.05,
        `${tag}: limits line inside the card (${line.x0.toFixed(2)} to ${line.x1.toFixed(2)} vs ${card.x0.toFixed(2)} to ${card.x1.toFixed(2)} deg)`).toBe(true)
      // Under the verdict (centre below centre; the text boxes are the layout boxes, which may touch).
      const v = angularRect(c, aabbCorners(c.verdictLineComponent()))
      const lineY = (line.y0 + line.y1) / 2
      const verdictY = (v.y0 + v.y1) / 2
      expect(lineY < verdictY - 0.3, `${tag}: limits line under the verdict (${lineY.toFixed(2)} vs ${verdictY.toFixed(2)} deg)`).toBe(true)
      checked++
    }

    // At rest, every eye height (glare at the standard placement), then clear at 62 cm.
    for (const p of ["standing", "seated", "child", "my"]) {
      c.setEyePreset(p as "standing" | "seated" | "child" | "my")
      await sleep(400)
      check(`at rest, ${p}`)
    }
    c.setEyePreset("standing")
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(1600)
    expect(c.verdictLineText(), "clear at 62 cm").toBe("All three: clear")
    check("All three: clear")

    // While a light moves (the change lines are shown).
    c.setLightDistance(0, 70)
    await sleep(150)
    expect(c.isMoveOpen(), "a move is open").toBe(true)
    check("while a light moves")
    await sleep(1600)

    // More controls open.
    c.setMoreOpen(true)
    await sleep(400)
    check("More open")
    c.setMoreOpen(false)
    await sleep(300)

    // The results view (Save results).
    c.saveLightSheets()
    await sleep(400)
    check("results view")
    c.restart()
    await sleep(400)

    // Panels under the print: My eyes at 96 cm, where the card also names that eye (B7).
    await resetToStandard(c)
    c.setEyePreset("my")
    const z = c.eyeLocal().z
    await stepTo(c, new vec3(0, 96, z))
    await sleep(1600)
    expect(c.panelsAreBelow(), "panels under the print at 96 cm").toBe(true)
    check("My eyes 96 cm, panels below")

    print(`[C24] limits line "${LIMITS}" shown, in view and inside the card in ${checked} card states`)
    await stepTo(c, new vec3(0, c.eyeLocal().y, 300))
    await resetToStandard(c)
  }
}
