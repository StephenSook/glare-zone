// LEAF scenario: a measured real-scale check (v0.4 item 6b, BUILD_LOG row 19). It measures, at
// run time, what is drawn (the practice wall, the glazed print, the two track lights and the
// eye at each eye height) in world centimetres along the wall's own axes, compares each with
// the brief's value within a stated tolerance, and prints the measured numbers to the log.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import * as G from "../Scripts/GlareMath"
import {controller, resetToStandard} from "./GlareLeafHelpers"

// Tolerances: sizes 1 cm (the wall is "about 3 m" in the brief; 400 cm wide is its default),
// positions 0.5 cm, the light's distance from the wall 0.1 cm.
const SIZE_TOL = 1.0
const POS_TOL = 0.5
const DIST_TOL = 0.1

function within(measured: number, want: number, tol: number): boolean {
  return Math.abs(measured - want) <= tol
}

/** 18. The practice wall, print, lights and eye heights are drawn at the brief's real size. */
@component
export class GlareC18RealScale extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const f = (x: number) => x.toFixed(2)
    const rows: string[] = []
    const check = (label: string, measured: number, want: number, tol: number) => {
      rows.push(`${label} ${f(measured)} (brief ${f(want)}, +/- ${tol})`)
      expect(within(measured, want, tol), `${label}: measured ${f(measured)} cm vs brief ${f(want)} +/- ${tol}`).toBe(true)
    }

    // Controls: the tolerance check flags a value 1% off, and an unknown mesh measures nothing.
    expect(within(400 * 0.99, 400, SIZE_TOL), "control: 396 cm is not 400 +/- 1").toBe(false)
    expect(within(400.4, 400, SIZE_TOL), "control: 400.4 cm is 400 +/- 1").toBe(true)
    expect(c.drawnSize("No such mesh") === null, "control: an unknown mesh measures nothing").toBe(true)

    // The practice wall: 400 cm wide (default), about 3 m tall.
    const wall = c.drawnSize("Wall surface")!
    expect(wall !== null, "wall measured").toBe(true)
    check("wall width cm", wall.widthCm, 400, SIZE_TOL)
    check("wall height cm", wall.heightCm, 300, SIZE_TOL)

    // The glazed print: 100 x 100 cm, centre 150 cm above the floor, so the glass runs 100 to 200 cm.
    const glass = c.drawnSize("Mat")!
    expect(glass !== null, "glazed print measured").toBe(true)
    check("print width cm", glass.widthCm, 100, POS_TOL)
    check("print height cm", glass.heightCm, 100, POS_TOL)
    check("print centre above floor cm", glass.centreCm, 150, POS_TOL)
    check("glass bottom above floor cm", glass.bottomCm, 100, POS_TOL)

    // The two track lights at the standard placement: on the 300 cm ceiling, 100 cm apart, and
    // (300 - 160) x 0.577 = 80.78 cm from the wall.
    const D0 = G.standardPlacementCm()
    for (const [i, side] of [[0, -50], [1, 50]] as [number, number][]) {
      const tag = i === 0 ? "L" : "R"
      const l = c.drawnLight(i)
      check(`light ${tag} from wall cm`, l.outCm, D0, DIST_TOL)
      check(`light ${tag} above floor cm`, l.upCm, 300, POS_TOL)
      check(`light ${tag} along wall cm`, l.sideCm, side, POS_TOL)
    }

    // The eye at each eye height, measured from the camera to the practice floor.
    for (const [preset, h] of [["standing", 160], ["seated", 109], ["child", 104]] as ["standing" | "seated" | "child", number][]) {
      c.setEyePreset(preset)
      await sleep(300)
      check(`eye ${preset} above floor cm`, c.drawnEyeHeightCm(), h, POS_TOL)
    }

    print(`[C18] measured as drawn (world cm, Lens Studio preview): ${rows.join("; ")}`)
    await resetToStandard(c)
  }
}
