// LEAF scenario: "My eyes" below the lowest verdict eye height (sixth note and B7, BUILD_LOG
// rows 28 and 29). "All three: clear" speaks for 160, 109 and 104 cm only; a My eyes height
// under 104 cm is named beside it with its own answer, so it never reads as clear for every eye.
// The UK Inclusive Mobility guide gives wheelchair users' eye heights from 960 to 1250 mm
// (5th to 95th percentile), lower than the 109 cm seated height the verdict speaks for.
// Hand value: with the whole glass lit (top Y = 200 cm) a light D cm out reaches
// D x (200 - h) / (300 - 200), so a 96 cm eye with both lights 62 cm out sees glare to
// 62 x 104 / 100 = 64.48 cm, 4.48 cm into the viewing area (near edge 60 cm); the lights clear
// it only under 60 / 1.04 = 57.69 cm.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, interactable, near, resetToStandard, stepTo} from "./GlareLeafHelpers"

const SETTLE_MS = 1600
const DEMO_CM = 62
const LOW_EYE_CM = 96
const HAND_END = (DEMO_CM * (200 - LOW_EYE_CM)) / 100 // 64.48 cm

/** 22. My eyes at 96 cm with both lights at the 62 cm demo setback. */
@component
export class GlareC22MyEyesLow extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)

    // Both lights at the demo setback: the three verdict eye heights are clear there.
    c.setLightDistance(0, DEMO_CM)
    c.setLightDistance(1, DEMO_CM)
    await sleep(SETTLE_MS)
    expect(c.verdictLineText(), "standing preset, lights at 62 cm").toBe("All three: clear")

    // My eyes (Eye height button: Standing, Seated, Child seated, My eyes), then lower the eye to 96 cm.
    for (let i = 0; i < 3; i++) {
      await interactor.trigger(interactable("Eye height button"))
      await sleep(300)
    }
    expect(c.getEyePreset(), "My eyes chosen").toBe("my")
    // Positive control: My eyes at the start height (160 cm, above 104) adds nothing.
    expect(c.verdictLineText(), "My eyes at 160 cm").toBe("All three: clear")
    const z = c.eyeLocal().z
    await stepTo(c, new vec3(0, LOW_EYE_CM, z))
    await sleep(SETTLE_MS)
    expect(near(c.getEyeHeight(), LOW_EYE_CM, 0.6), `eye height ${c.getEyeHeight()}`).toBe(true)
    const end = c.zoneFarEdgeCm("my")
    print(`[C22] My eyes ${c.getEyeHeight().toFixed(2)} cm, lights ${c.lights[0].distanceCm.toFixed(2)} and ` +
      `${c.lights[1].distanceCm.toFixed(2)} cm: zone end ${end.toFixed(2)} cm (hand ${HAND_END.toFixed(2)}); ` +
      `headline "${c.headlineText()}"; verdict "${c.verdictLineText()}"`)
    expect(near(end, HAND_END, 0.05), `My eyes zone end ${end.toFixed(2)} vs hand 62 x 104 / 100 = 64.48`).toBe(true)

    // B7: the card and the floor's line name the 96 cm eye and its glare; the line is not white.
    const named = "All three: clear; My eyes (96 cm): glare"
    expect(c.verdictLineText(), "answer card at 96 cm, lights at 62 cm").toBe(named)
    expect(c.floorStatusText(), "floor line at 96 cm, lights at 62 cm").toBe(named)
    const col = c.verdictLineComponent().textFill.color
    expect(col.g < 0.6 && col.b < 0.6, `verdict line in the glare colour (${col.r.toFixed(2)}, ${col.g.toFixed(2)}, ${col.b.toFixed(2)})`).toBe(true)
    expect(c.verdict(), "the three eye heights themselves are still clear").toBe("clear")

    // Lights just under 60 / 1.04 = 57.69 cm: the 96 cm eye is clear too, and the card says so.
    c.setLightDistance(0, 57.6)
    c.setLightDistance(1, 57.6)
    await sleep(SETTLE_MS)
    expect(c.verdictLineText(), "lights at 57.6 cm").toBe("All three: clear; My eyes (96 cm): clear")

    // At 105 cm (not below 104) the line is the three heights' verdict alone.
    await stepTo(c, new vec3(0, 105, z))
    await sleep(SETTLE_MS)
    expect(c.verdictLineText(), "My eyes at 105 cm").toBe("All three: clear")

    await stepTo(c, new vec3(0, c.eyeLocal().y, 300))
    await resetToStandard(c)
  }
}
