// LEAF scenario: the live beam angle (U1b item 5, BUILD_LOG row 40). Under each aim handle the Lens
// shows that lamp's beam angle, its axis from the horizontal ("Beam 58 deg"), and turns it amber when
// the beam is steeper than CCI Notes 2/3's 60 deg. Hand values, worked here: a lamp at x = 50 cm,
// D cm from the wall, 300 cm up, aimed at the print centre (150 cm) has its axis at
// atan(150 / sqrt(50^2 + D^2)) below the horizontal: 57.65 deg at 80.78 cm, 62.03 deg at 62 cm.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {aabbCorners, controller, near, outOfView, resetToStandard} from "./GlareLeafHelpers"

const SETTLE_MS = 800
const toDeg = 180 / Math.PI

/** 28. The live beam angle under each aim handle, amber past CCI's 60 deg. */
@component
export class GlareC28BeamAngle extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const aimAtCentre = (D: number) => 90 - Math.atan2(Math.sqrt(50 * 50 + D * D), 150) * toDeg

    // Positive first: the standard placement, aimed at the print centre: 57.65 deg, not amber, in view.
    const hand0 = Math.atan2(150, Math.sqrt(50 * 50 + 80.78 * 80.78)) * toDeg
    for (let i = 0; i < 2; i++) {
      expect(near(c.beamAngleDeg(i), hand0, 0.02), `lamp ${i}: ${c.beamAngleDeg(i).toFixed(2)} deg vs hand ${hand0.toFixed(2)}`).toBe(true)
      expect(c.beamLabelText(i), `lamp ${i} label`).toBe("Beam 58 deg")
      expect(c.beamLabelWarns(i), `lamp ${i}: not amber at 58 deg`).toBe(false)
      expect(outOfView(c, aabbCorners(c.beamLabelComponent(i)), 0.5), `lamp ${i} label in view`).toBe("")
    }

    // Moving along the track keeps the tilt, so the beam angle stays (the light lands lower).
    c.setLightDistance(1, 62)
    await sleep(SETTLE_MS)
    expect(c.beamLabelText(1), "slid to 62 cm, same aim").toBe("Beam 58 deg")

    // Re-aimed at the print centre from 62 cm: 62.03 deg, steeper than CCI's 60: amber, live.
    const t62 = 90 - aimAtCentre(62)
    c.setLightTilt(1, t62)
    await sleep(SETTLE_MS)
    const hand62 = Math.atan2(150, Math.sqrt(50 * 50 + 62 * 62)) * toDeg
    expect(near(c.beamAngleDeg(1), hand62, 0.02), `re-aimed: ${c.beamAngleDeg(1).toFixed(2)} vs hand ${hand62.toFixed(2)}`).toBe(true)
    expect(c.beamLabelText(1), "re-aimed from 62 cm").toBe("Beam 62 deg")
    expect(c.beamLabelWarns(1), "amber past 60 deg").toBe(true)
    expect(c.beamLabelWarns(0), "the other lamp unchanged").toBe(false)

    // At exactly 60 shown (60.2 deg rounds to 60): not past it, not amber.
    c.setLightTilt(1, 90 - 60.2)
    await sleep(SETTLE_MS)
    expect(c.beamLabelText(1), "60.2 deg").toBe("Beam 60 deg")
    expect(c.beamLabelWarns(1), "60 is CCI's own angle: not amber").toBe(false)

    print(`[C28] beam angles: ${hand0.toFixed(2)} deg at 80.78 cm ("Beam 58 deg"); re-aimed from 62 cm ` +
      `${hand62.toFixed(2)} deg ("Beam 62 deg", amber); 60.2 deg "Beam 60 deg", not amber`)
    await resetToStandard(c)
  }
}
