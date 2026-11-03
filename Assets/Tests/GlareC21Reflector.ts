// LEAF scenario: the fixture is a real one (B3, BUILD_LOG row 26): the TSLight RXT13 with its
// 40 deg reflector by default (2,700 cd) or its 20 deg reflector (5,000 cd), from the
// manufacturer's specification sheet (manufacturer data, not measured). The "Reflector" button
// switches both lights, and the zones, the light levels and the results card follow.
// Hand values here come from SHEET_RXT13 (copied from the sheet) and the cone and lux helpers,
// not from GlareMath.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {
  amberCellCentres,
  coneLitTopCm,
  controller,
  handLux,
  interactable,
  near,
  resetToStandard,
  SHEET_RXT13,
} from "./GlareLeafHelpers"

const DIM = 0.03 // at 3% the 40 deg reflector lights no cell over 50 lux (C3); the 20 deg one does

/** 21. The RXT13's reflectors: the default 40 deg and the 20 deg, from manufacturer data. */
@component
export class GlareC21Reflector extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    const D = c.lights[1].distanceCm
    const tilt = c.lights[1].tiltDeg
    // Reach by hand for this light: the lit top Y from the cone at the reflector's beam angle,
    // then D x (Y - h) / (300 - Y).
    const reach = (beamDeg: number, h: number) => {
      const Y = coneLitTopCm(50, D, tilt, beamDeg)
      return Y === null || Y <= h ? 0 : (D * (Y - h)) / (300 - Y)
    }

    // Positive first: the default is the 40 deg reflector, as published, on both lights.
    expect(c.reflector().beamDeg, "default reflector").toBe(SHEET_RXT13.wide.beamDeg)
    for (const l of c.lights) {
      expect(l.beamDeg === SHEET_RXT13.wide.beamDeg && l.candela === SHEET_RXT13.wide.candela,
        `light at 40 deg, 2,700 cd (${l.beamDeg}, ${l.candela})`).toBe(true)
    }
    const seated40 = reach(SHEET_RXT13.wide.beamDeg, 109)
    expect(near(seated40, 73.51, 0.05), `hand seated reach with 40 deg ${seated40.toFixed(2)} (whole glass lit: 73.51)`).toBe(true)
    expect(near(c.zoneFarEdgeCm("seated"), seated40, 0.15), `seated zone ${c.zoneFarEdgeCm("seated").toFixed(2)} vs hand ${seated40.toFixed(2)}`).toBe(true)

    // The real "Reflector" button (in the More row) switches both lights to the 20 deg reflector.
    await interactor.trigger(interactable("More button"))
    await sleep(400)
    await interactor.trigger(interactable("Reflector button"))
    await sleep(400)
    expect(c.reflector().beamDeg, "Reflector pressed: 20 deg").toBe(SHEET_RXT13.narrow.beamDeg)
    for (const l of c.lights) {
      expect(l.beamDeg === SHEET_RXT13.narrow.beamDeg && l.candela === SHEET_RXT13.narrow.candela,
        `light at 20 deg, 5,000 cd (${l.beamDeg}, ${l.candela})`).toBe(true)
    }
    expect(c.reflectorHint(), "the button shows the reflector").toBe("20 deg")
    // The zones follow: a narrower beam, aimed the same, lights less of the glass top.
    const seated20 = reach(SHEET_RXT13.narrow.beamDeg, 109)
    const standing20 = reach(SHEET_RXT13.narrow.beamDeg, 160)
    expect(seated20 < seated40, `hand: the 20 deg beam reaches less (${seated20.toFixed(2)} < ${seated40.toFixed(2)})`).toBe(true)
    expect(near(c.zoneFarEdgeCm("seated"), seated20, 0.15), `seated zone with 20 deg ${c.zoneFarEdgeCm("seated").toFixed(2)} vs hand ${seated20.toFixed(2)}`).toBe(true)
    expect(near(c.zoneFarEdgeCm("standing"), standing20, 0.15), `standing zone with 20 deg ${c.zoneFarEdgeCm("standing").toFixed(2)} vs hand ${standing20.toFixed(2)}`).toBe(true)
    // The light levels follow: at 3% every amber cell agrees with the 20 deg fixture by hand,
    // and some glow (the 40 deg reflector lights none over 50 lux at 3%, C3).
    c.setWorksOnPaper(true)
    c.setDimmer(0, DIM)
    c.setDimmer(1, DIM)
    await sleep(300)
    const at = c.lights.map((l) => ({xCm: l.xCm, distanceCm: l.distanceCm, tiltDeg: l.tiltDeg, dimmer: DIM,
      beamDeg: SHEET_RXT13.narrow.beamDeg, candela: SHEET_RXT13.narrow.candela}))
    const wide = at.map((l) => ({...l, beamDeg: SHEET_RXT13.wide.beamDeg, candela: SHEET_RXT13.wide.candela}))
    let agree = 0
    let glowing = 0
    let wideGlowing = 0
    for (const p of amberCellCentres()) {
      const want = handLux(at, p.x, p.y) > 50
      if (want) glowing++
      if (handLux(wide, p.x, p.y) > 50) wideGlowing++
      if (c.amberAt(p.x, p.y) === want) agree++
      else expect(c.amberAt(p.x, p.y), `cell (${p.x}, ${p.y}) at 3%, 20 deg: fixture says ${handLux(at, p.x, p.y).toFixed(1)} lux`).toBe(want)
    }
    expect(agree, "every one of the 400 cells agrees with the 20 deg fixture at 3%").toBe(400)
    expect(glowing > 0 && wideGlowing === 0, `at 3%: ${glowing} cells over 50 lux with 20 deg, ${wideGlowing} with 40 deg`).toBe(true)
    expect(c.amberCellCount(), "amber cells shown").toBe(glowing)
    // The results card names the fixture and the reflector.
    const sheet = c.sheetLines(1).join(" | ")
    expect(sheet.indexOf("TSLight RXT13, manufacturer data, not measured") >= 0, "fixture on the card").toBe(true)
    expect(sheet.indexOf("reflector 20 deg") >= 0, `reflector on the card: ${sheet}`).toBe(true)

    // Press again: back to the 40 deg reflector, and the zone with it.
    c.setWorksOnPaper(false)
    c.setDimmer(0, 1)
    c.setDimmer(1, 1)
    await interactor.trigger(interactable("Reflector button"))
    await sleep(400)
    expect(c.reflector().beamDeg, "pressed again: 40 deg").toBe(SHEET_RXT13.wide.beamDeg)
    expect(c.reflectorHint(), "the button shows 40 deg").toBe("40 deg")
    expect(near(c.zoneFarEdgeCm("seated"), seated40, 0.15), `seated zone back to ${c.zoneFarEdgeCm("seated").toFixed(2)}`).toBe(true)

    // Restart returns to the default reflector.
    await interactor.trigger(interactable("Reflector button"))
    await sleep(300)
    expect(c.reflector().beamDeg, "20 deg before Restart").toBe(SHEET_RXT13.narrow.beamDeg)
    c.restart()
    await sleep(300)
    expect(c.reflector().beamDeg, "Restart: back to 40 deg").toBe(SHEET_RXT13.wide.beamDeg)
    expect(c.lights.every((l) => l.beamDeg === 40 && l.candela === 2700), "both lights back to 40 deg, 2,700 cd").toBe(true)

    print(`[C21] RXT13 reflectors (manufacturer data): 40 deg seated ${seated40.toFixed(2)} cm; ` +
      `20 deg seated ${seated20.toFixed(2)}, standing ${standing20.toFixed(2)} cm; at 3% ${glowing} cells over 50 lux with 20 deg, ${wideGlowing} with 40 deg`)
    await resetToStandard(c)
  }
}
