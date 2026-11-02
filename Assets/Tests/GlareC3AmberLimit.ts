// LEAF scenario for a Glare Zone done criterion (devpost/design-brief.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {amberCellCentres, controller, galleryDir, handLux, interactable, resetToStandard} from "./GlareLeafHelpers"

// Hand value (unit test "sample light level"): at the print centre the two lights give
// 2 x 1500 cd x cos(incidence) / d^2 = 2 x 1500 x 0.455 / 1.776^2 = about 432 lux at full.
// So the cell at the centre glows at full (432 > 50) and does not at 10% (43 < 50).
const CENTRE_CELL = {x: 2.5, y: 152.5} // the 5 cm cell next to the print centre (0, 150)

/** 3. With "Works on paper" on, parts of the print over 50 lux glow amber; turning the dimmer down clears it. */
@component
export class GlareC3AmberLimit extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    expect(c.amberCellCount(), "no amber while the paper art limit is off").toBe(0)
    expect(c.amberAt(CENTRE_CELL.x, CENTRE_CELL.y), "centre not amber while off").toBe(false)

    // Positive control: "Paper art" (under More controls) turns amber on over the brightly
    // lit print, including the centre (about 432 lux).
    await interactor.trigger(interactable("More button"))
    await sleep(400)
    await interactor.trigger(interactable("Paper art button"))
    await sleep(300)
    const lit = c.amberCellCount()
    expect(lit, "amber cells over 50 lux with both lights at full").toBeGreaterThan(10)
    expect(c.amberAt(CENTRE_CELL.x, CENTRE_CELL.y), "the centre (about 432 lux) glows").toBe(true)
    // ... and the glow is amber: strong red, middling green, little blue, clearly visible.
    // Controls for the colour check: amber (1, 0.6, 0.05) passes; the Seated zone's pink and
    // the glare spot's warm yellow (green over 0.75) do not.
    const isAmber = (k: vec4) => k.x >= 0.9 && k.y >= 0.45 && k.y <= 0.75 && k.z <= 0.2 && k.w >= 0.4
    expect(isAmber(new vec4(1, 0.6, 0.05, 0.62)), "colour check passes amber").toBe(true)
    expect(isAmber(new vec4(1, 0.35, 0.85, 0.55)), "colour check rejects the Seated pink").toBe(false)
    expect(isAmber(new vec4(1, 0.78, 0.3, 0.75)), "colour check rejects the spot's yellow").toBe(false)
    const k = c.amberColor()
    expect(isAmber(k), `the glow is amber: (${k.x}, ${k.y}, ${k.z}, ${k.w})`).toBe(true)

    // Dim the right light with its slider: fewer cells glow.
    await interactor.drag(interactable("Dimmer slider R"), galleryDir(c, new vec3(0, -0.6, 0)), 1200)
    await sleep(300)
    expect(c.lights[1].dimmer, "right dimmer turned down").toBeLessThan(0.1)
    const afterOne = c.amberCellCount()
    expect(afterOne, "dimming one light shrinks the amber area").toBeLessThan(lit)
    expect(afterOne, "the left light alone still exceeds 50 lux somewhere").toBeGreaterThan(0)

    // Dim the left light too: the amber clears.
    await interactor.drag(interactable("Dimmer slider L"), galleryDir(c, new vec3(0, -0.6, 0)), 1200)
    await sleep(300)
    expect(c.lights[0].dimmer, "left dimmer turned down").toBeLessThan(0.1)
    expect(c.amberCellCount(), "amber clears once the print is at or under 50 lux").toBe(0)

    // The limit is 50 lux, not "any light": at 10% some cells still glow (positive control
    // first), but the centre (about 43 lux by hand) does not, so only parts over 50 glow.
    c.setDimmer(0, 0.1)
    c.setDimmer(1, 0.1)
    await sleep(200)
    expect(c.amberCellCount(), "at 10% some cells are still over 50 lux").toBeGreaterThan(0)
    expect(c.amberCellCount(), "at 10% only part of the print glows").toBeLessThan(lit)
    expect(c.amberAt(CENTRE_CELL.x, CENTRE_CELL.y), "at 10% the centre (about 43 lux) does not glow").toBe(false)
    // Cell by cell against the fixture (the brief's 1,500 cd, 25 deg sample, computed here):
    // a cell glows exactly when the fixture puts it over 50 lux.
    const cells = amberCellCentres()
    const handPeak = (dim: number) => {
      const ls = c.lights.map((l) => ({xCm: l.xCm, distanceCm: l.distanceCm, tiltDeg: l.tiltDeg, dimmer: dim}))
      return Math.max(...cells.map((p) => handLux(ls, p.x, p.y)))
    }
    const at10 = c.lights.map((l) => ({xCm: l.xCm, distanceCm: l.distanceCm, tiltDeg: l.tiltDeg, dimmer: 0.1}))
    let agree = 0
    for (const p of cells) {
      const want = handLux(at10, p.x, p.y) > 50
      if (c.amberAt(p.x, p.y) === want) agree++
      else expect(c.amberAt(p.x, p.y), `cell (${p.x}, ${p.y}) at 10%: fixture says ${handLux(at10, p.x, p.y).toFixed(1)} lux`).toBe(want)
    }
    expect(agree, "every one of the 400 cells agrees with the fixture at 10%").toBe(400)
    const peak10 = handPeak(0.1)
    expect(peak10, `fixture peak at 10% is over 50 (${peak10.toFixed(1)} lux)`).toBeGreaterThan(50)
    // At 5% the fixture's brightest cell is under 50 lux, so nothing may glow.
    const peak5 = handPeak(0.05)
    expect(peak5, `fixture peak at 5% is under 50 (${peak5.toFixed(1)} lux)`).toBeLessThan(50)
    c.setDimmer(0, 0.05)
    c.setDimmer(1, 0.05)
    await sleep(200)
    expect(c.amberCellCount(), "at 5% nothing glows").toBe(0)

    await interactor.trigger(interactable("Paper art button"))
    await resetToStandard(c)
  }
}
