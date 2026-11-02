// LEAF scenario for the "My eyes" preset: the zone follows the real eye height.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, interactable, near, outOfView, resetToStandard, stepTo} from "./GlareLeafHelpers"

/**
 * 6. "My eyes": eye height is the camera's height above the practice floor, every frame.
 * Crouching (lowering the eye) moves the zone; the fixed presets do not change.
 */
@component
export class GlareC6MyEyes extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    // Hand values: with the whole glass lit (top 200 cm) the reach is 80.78 x (200 - h) / 100:
    // 160 cm: 32.31, 130 cm: 56.55, 105 cm: 76.74.
    const seatedBefore = c.zoneFarEdgeCm("seated")

    // Eye height button: Standing, Seated, Child seated, My eyes.
    for (let i = 0; i < 3; i++) {
      await interactor.trigger(interactable("Eye height button"))
      await sleep(300)
    }
    expect(c.getEyePreset(), "My eyes chosen").toBe("my")

    // Positive control: at the camera's own height (160 cm) the My eyes zone matches the model.
    const eye0 = c.eyeLocal().y
    expect(near(eye0, 160, 0.6), `My eyes starts from the start placement (160 cm), got ${eye0}`).toBe(true)
    expect(near(c.getEyeHeight(), eye0, 0.6), `My eyes height ${c.getEyeHeight()} vs camera ${eye0}`).toBe(true)
    expect(c.zoneVisible("my"), "My eyes zone drawn").toBe(true)
    expect(near(c.zoneFarEdgeCm("my"), 32.31, 0.5), `far edge ${c.zoneFarEdgeCm("my")} vs hand 32.31`).toBe(true)
    expect(c.mapLaneText("my").indexOf("My eyes") === 0, `map lane: ${c.mapLaneText("my")}`).toBe(true)

    // Crouch to 130 cm (the floor stays put, the eye drops): the zone reaches further.
    const z = c.eyeLocal().z
    await stepTo(c, new vec3(0, 130, z))
    await sleep(200)
    const at130 = c.zoneFarEdgeCm("my")
    expect(near(c.getEyeHeight(), 130, 0.6), `eye height follows the camera: ${c.getEyeHeight()}`).toBe(true)
    expect(near(at130, 56.55, 0.05), `far edge at 130: ${at130} vs hand 56.55`).toBe(true)
    expect(c.zoneLabelText("my").indexOf("My eyes (130 cm)") === 0, `label: ${c.zoneLabelText("my")}`).toBe(true)
    // The headline follows the live eye height, and the answer card follows the view.
    expect(c.headlineText(), "headline at 130 cm").toBe("Your eyes (130 cm) see glare up to 56.5 cm from the wall")
    expect(c.mapLaneText("my"), "legend line at 130 cm").toBe("My eyes, at 130 cm: glare up to 56.5 cm from the wall")
    // Under 140 cm the panels move below the print, and the answer card stays in view.
    expect(c.panelsAreBelow(), "panels below the print at 130 cm").toBe(true)
    expect(outOfView(c, c.answerPlateCorners()), "answer card in view after crouching").toBe("")

    // Lower still, to 105 cm: further again.
    await stepTo(c, new vec3(0, 105, z))
    await sleep(200)
    expect(near(c.zoneFarEdgeCm("my"), 76.74, 0.05), `far edge at 105: ${c.zoneFarEdgeCm("my")} vs hand 76.74`).toBe(true)
    expect(c.zoneFarEdgeCm("my"), "zone moved with the eye").toBeGreaterThan(at130)

    // The fixed presets are not affected by the live eye.
    expect(c.zoneFarEdgeCm("seated"), "seated zone unchanged").toBe(seatedBefore)

    // Back to Standing: the My eyes zone and map lane go away.
    await interactor.trigger(interactable("Eye height button"))
    await sleep(300)
    expect(c.getEyePreset()).toBe("standing")
    expect(c.zoneVisible("my"), "My eyes zone hidden for fixed presets").toBe(false)
    expect(c.mapLaneText("my")).toBe("")
    await stepTo(c, new vec3(0, c.eyeLocal().y, 300))
    await resetToStandard(c)
  }
}
