// LEAF scenario: the wheelchair coverage estimate (G2, BUILD_LOG row 37). The answer card says how
// many wheelchair users would see glare in the viewing area, labelled as an estimate. Hand values,
// worked here: DfT Inclusive Mobility (2021, p. 21) gives wheelchair users' eye height from 960 to
// 1250 mm (5th to 95th percentile); a normal fit gives mean 110.5 cm, sd (125 - 96) / (2 x 1.6449).
// With the whole glass lit, a light D cm out reaches D x (200 - h) / 100, so eyes at or below
// h* = 200 - 6000 / D reach the 60 cm near edge, and the share is Phi((h* - 110.5) / sd).
// devpost/tools/coverage_estimate.py prints the same figures: 95.79% at 80.78 cm, 20.46% at 62 cm.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {aabbCorners, controller, near, outOfView, resetToStandard} from "./GlareLeafHelpers"

const SETTLE_MS = 1600
const SD = (125 - 96) / (2 * 1.6448536269514722)

/** Phi by the series erf(x) = 2/sqrt(pi) sum (-1)^n x^(2n+1) / (n! (2n+1)), written apart from GlareMath. */
function phi(z: number): number {
  const x = z / Math.SQRT2
  let sum = 0
  let term = x
  for (let n = 0; n < 60; n++) {
    sum += term / (2 * n + 1)
    term *= (-x * x) / (n + 1)
  }
  return 0.5 * (1 + (2 / Math.sqrt(Math.PI)) * sum)
}

/** 26. The answer card's wheelchair estimate. */
@component
export class GlareC26WheelchairEstimate extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const check = (D: number, words: string, scriptPct: number) => {
      const hStar = 200 - 6000 / D
      const hand = 100 * phi((hStar - 110.5) / SD)
      const b = c.wheelchairBoundaryCm() as number
      const s = c.wheelchairShare() as number
      expect(b !== null && near(b, hStar, 0.01), `boundary eye at ${D} cm: ${b} vs hand 200 - 6000 / ${D} = ${hStar.toFixed(3)}`).toBe(true)
      expect(near(100 * s, hand, 0.01), `share at ${D} cm: ${(100 * s).toFixed(3)}% vs hand ${hand.toFixed(3)}%`).toBe(true)
      expect(near(hand, scriptPct, 0.006), `hand ${hand.toFixed(3)}% vs coverage_estimate.py ${scriptPct}%`).toBe(true)
      expect(c.wheelchairLineText(), `card at ${D} cm`).toBe(words)
      expect(outOfView(c, aabbCorners(c.wheelchairLineComponent()), 0.5), `estimate line in view at ${D} cm`).toBe("")
    }

    // Positive first: the standard placement.
    expect(c.verdict(), "standard placement").toBe("glare")
    check(c.lights[0].distanceCm, "About 96% of wheelchair users see glare here (estimate)", 95.79)

    // While a light moves the line is not shown (the estimate is for a settled placement).
    c.setLightDistance(0, 70)
    await sleep(150)
    expect(c.isMoveOpen(), "a move is open").toBe(true)
    expect(c.wheelchairLineText(), "no estimate while a light moves").toBe("")

    // The 62 cm demo setback: the card is clear for the three eye heights, and the estimate still
    // names the wheelchair users who see glare.
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(SETTLE_MS)
    expect(c.verdictLineText(), "62 cm").toBe("All three: clear")
    check(62, "About 20% of wheelchair users see glare here (estimate)", 20.46)

    // Not over the results cards.
    c.saveLightSheets()
    await sleep(400)
    expect(c.wheelchairLineText(), "no estimate in the results view").toBe("")
    c.restart()
    await sleep(SETTLE_MS)
    expect(c.wheelchairLineText().length > 0, "back after the results").toBe(true)

    print(`[C26] wheelchair estimate: 80.78 cm "About 96% ..." (hand 95.79%), 62 cm "About 20% ..." (hand 20.46%), ` +
      `boundary at 62 cm ${(200 - 6000 / 62).toFixed(3)} cm`)
    await resetToStandard(c)
  }
}
