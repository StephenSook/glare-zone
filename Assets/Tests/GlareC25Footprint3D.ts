// LEAF scenario: the 3D footprint (G1, BUILD_LOG row 36). Each lamp is mirrored through the glass
// plane itself, which may lean forward about its bottom edge; the floor shows a soft patch per
// lamp (its lobe) under the chosen eye height's zone, and the part inside the viewing area flashes.
// Hand values are worked here, apart from GlareMath:
// - upright glass, the whole glass lit: a light D cm out reaches (200 - e) x D / 100; Seated at
//   80.78 cm is 73.51 cm. Each lamp's lobe, where the full glass width is lit, spans eye x from
//   -50 - 100 x zc / D to 50 (the right lamp) at row centre zc, and the mirror image for the left.
// - a forward lean: the side-view mirror construction in sideViewReach below.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, near, resetToStandard} from "./GlareLeafHelpers"

const SETTLE_MS = 1600
const LEAN_DEG = 5

/** Side view: mirror the lamp (300, D) through the glass line from (100, 0) at `lean` deg, then follow the line from the image through the glass top down to eye height h. */
function sideViewReach(h: number, D: number, lean: number): number {
  const th = (lean * Math.PI) / 180
  const n = [-Math.sin(th), Math.cos(th)]
  const k = 2 * ((300 - 100) * n[0] + D * n[1])
  const I = [300 - k * n[0], D - k * n[1]]
  const T = [100 + 100 * Math.cos(th), 100 * Math.sin(th)]
  const lam = (h - I[0]) / (T[0] - I[0])
  return I[1] + lam * (T[1] - I[1])
}

/** 25. The 3D footprint: lobes per lamp, the flashing overlap, the switch, and a forward lean. */
@component
export class GlareC25Footprint3D extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    try {
      // Positive first: 3D on, upright, Seated chosen. The zone matches the hand value.
      expect(c.footprint3D(), "the 3D footprint is on by default").toBe(true)
      expect(c.frameLeanDeg(), "upright by default").toBe(0)
      c.setEyePreset("seated")
      await sleep(SETTLE_MS)
      const D = c.lights[1].distanceCm
      const seated = c.zoneFarEdgeCm("seated")
      expect(near(seated, (91 * D) / 100, 0.05), `Seated ${seated.toFixed(2)} vs hand 91 x ${D.toFixed(2)} / 100`).toBe(true)

      // A soft patch per lamp: two lobes, each drawn, each the hand range at the 40 cm row.
      const lobes = c.lobeRows()
      expect(lobes.length, "one lobe per lamp").toBe(2)
      const counts = c.lobePatchCounts()
      expect(counts[0] > 5 && counts[1] > 5, `both lamp patches drawn (${counts.join(", ")} rectangles)`).toBe(true)
      const rowAt = (rows: {z0: number; z1: number; xMin: number; xMax: number}[], z: number) =>
        rows.filter((r) => r.z0 <= z && r.z1 > z)[0]
      const L = rowAt(lobes[0], 40)
      const R = rowAt(lobes[1], 40)
      const zc = (R.z0 + R.z1) / 2
      const edge = -50 - (100 * zc) / D
      expect(near(R.xMin, edge, 0.05) && near(R.xMax, 50, 0.05),
        `right lamp lobe at ${zc} cm: ${R.xMin.toFixed(2)} to ${R.xMax.toFixed(2)} vs hand ${edge.toFixed(2)} to 50`).toBe(true)
      expect(near(L.xMin, -50, 0.05) && near(L.xMax, -edge, 0.05),
        `left lamp lobe at ${zc} cm: ${L.xMin.toFixed(2)} to ${L.xMax.toFixed(2)} vs hand -50 to ${(-edge).toFixed(2)}`).toBe(true)

      // The part inside the viewing area flashes, and stays bright while it does.
      const alphas: number[] = []
      for (let i = 0; i < 8; i++) {
        alphas.push(c.overlapAlpha())
        await sleep(110)
      }
      const lo = Math.min(...alphas)
      const hi = Math.max(...alphas)
      expect(hi - lo > 0.05, `the warning fill flashes (alpha ${lo.toFixed(2)} to ${hi.toFixed(2)})`).toBe(true)
      expect(lo >= 0.7, `and stays bright (lowest alpha ${lo.toFixed(2)})`).toBe(true)

      // A forward lean of the frame: the print turns, and the zone follows the side-view mirror.
      c.setFrameLeanDeg(LEAN_DEG)
      await sleep(SETTLE_MS)
      expect(near(c.printLeanDeg(), LEAN_DEG, 0.01), `the print leans ${c.printLeanDeg().toFixed(2)} deg`).toBe(true)
      const leanHand = sideViewReach(109, D, LEAN_DEG)
      const leaned = c.zoneFarEdgeCm("seated")
      expect(near(leaned, leanHand, 0.1), `Seated at a ${LEAN_DEG} deg lean ${leaned.toFixed(2)} vs hand ${leanHand.toFixed(2)}`).toBe(true)
      const childHand = sideViewReach(104, D, LEAN_DEG)
      expect(near(c.zoneFarEdgeCm("child"), childHand, 0.1), `Child seated at the lean vs hand ${childHand.toFixed(2)}`).toBe(true)
      expect(c.verdictLineText(), `the lean clears the standard placement (child seated to ${childHand.toFixed(2)} cm)`).toBe("All three: clear")

      // The switch: off, the side-view reference ignores the lean (73.51 again); on, the lean is back.
      c.setFootprint3D(false)
      await sleep(SETTLE_MS)
      expect(near(c.zoneFarEdgeCm("seated"), (91 * D) / 100, 0.05), `3D off at the lean: ${c.zoneFarEdgeCm("seated").toFixed(2)}`).toBe(true)
      c.setFootprint3D(true)
      await sleep(SETTLE_MS)
      expect(near(c.zoneFarEdgeCm("seated"), leanHand, 0.1), "3D on again: the lean counts").toBe(true)

      print(`[C25] 3D footprint: Seated ${seated.toFixed(2)} cm upright (hand ${((91 * D) / 100).toFixed(2)}); ` +
        `lobes at ${zc} cm: L ${L.xMin.toFixed(2)} to ${L.xMax.toFixed(2)}, R ${R.xMin.toFixed(2)} to ${R.xMax.toFixed(2)}; ` +
        `flash alpha ${lo.toFixed(2)} to ${hi.toFixed(2)}; at a ${LEAN_DEG} deg lean Seated ${leaned.toFixed(2)} (hand ${leanHand.toFixed(2)}), ` +
        `child seated ${c.zoneFarEdgeCm("child").toFixed(2)} (hand ${childHand.toFixed(2)})`)
    } finally {
      c.setFrameLeanDeg(0)
      c.setFootprint3D(true)
    }
    await resetToStandard(c)
  }
}
