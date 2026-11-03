// LEAF scenario for a Glare Zone done criterion (devpost/design-brief.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {amberCellCentres, controller, galleryDir, handLux, interactable, resetToStandard} from "./GlareLeafHelpers"

// Hand values with the TSLight RXT13 40 deg reflector (2,700 cd, manufacturer data; unit test
// "light level at the print centre"): at the print centre the two lights give 2 x 2,700 cd x
// cos(incidence) / d^2 = 2 x 2,700 x 0.4550 / 1.7755^2 = 779 lux at full, so the cell next to
// it glows at full and does not at 5% (about 40 lux). Every cell scales with the dimmer.
const CENTRE_CELL = {x: 2.5, y: 152.5} // the 5 cm cell next to the print centre (0, 150)
const PART = 0.05 // some cells over 50 lux, the centre under it
const NONE = 0.03 // every cell under 50 lux

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
    // lit print, including the centre (about 780 lux).
    await interactor.trigger(interactable("More button"))
    await sleep(400)
    await interactor.trigger(interactable("Paper art button"))
    await sleep(300)
    const lit = c.amberCellCount()
    expect(lit, "amber cells over 50 lux with both lights at full").toBeGreaterThan(10)
    expect(c.amberAt(CENTRE_CELL.x, CENTRE_CELL.y), "the centre (about 780 lux) glows").toBe(true)
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

    // The limit is 50 lux, not "any light": at 5% some cells still glow (positive control
    // first), but the centre (about 40 lux by hand) does not, so only parts over 50 glow.
    c.setDimmer(0, PART)
    c.setDimmer(1, PART)
    await sleep(200)
    expect(c.amberCellCount(), "at 5% some cells are still over 50 lux").toBeGreaterThan(0)
    expect(c.amberCellCount(), "at 5% only part of the print glows").toBeLessThan(lit)
    expect(c.amberAt(CENTRE_CELL.x, CENTRE_CELL.y), "at 5% the centre (about 40 lux) does not glow").toBe(false)
    // Cell by cell against the fixture (the RXT13's published 2,700 cd, 40 deg, computed here
    // apart from GlareMath): a cell glows exactly when the fixture puts it over 50 lux.
    const cells = amberCellCentres()
    const handPeak = (dim: number) => {
      const ls = c.lights.map((l) => ({xCm: l.xCm, distanceCm: l.distanceCm, tiltDeg: l.tiltDeg, dimmer: dim}))
      return Math.max(...cells.map((p) => handLux(ls, p.x, p.y)))
    }
    const atPart = c.lights.map((l) => ({xCm: l.xCm, distanceCm: l.distanceCm, tiltDeg: l.tiltDeg, dimmer: PART}))
    let agree = 0
    for (const p of cells) {
      const want = handLux(atPart, p.x, p.y) > 50
      if (c.amberAt(p.x, p.y) === want) agree++
      else expect(c.amberAt(p.x, p.y), `cell (${p.x}, ${p.y}) at 5%: fixture says ${handLux(atPart, p.x, p.y).toFixed(1)} lux`).toBe(want)
    }
    expect(agree, "every one of the 400 cells agrees with the fixture at 5%").toBe(400)
    const peakPart = handPeak(PART)
    expect(peakPart, `fixture peak at 5% is over 50 (${peakPart.toFixed(1)} lux)`).toBeGreaterThan(50)
    // At 3% the fixture's brightest cell is under 50 lux, so nothing may glow.
    const peakNone = handPeak(NONE)
    expect(peakNone, `fixture peak at 3% is under 50 (${peakNone.toFixed(1)} lux)`).toBeLessThan(50)
    c.setDimmer(0, NONE)
    c.setDimmer(1, NONE)
    await sleep(200)
    expect(c.amberCellCount(), "at 3% nothing glows").toBe(0)

    await interactor.trigger(interactable("Paper art button"))
    await resetToStandard(c)
  }
}
