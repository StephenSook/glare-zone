// LEAF scenario for a Glare Zone done criterion (devpost/design-brief.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, has, interactable, near, resetToStandard} from "./GlareLeafHelpers"

// Hand values: D0 = (300 - 160) x 0.577 = 80.78 cm (brief case 2); reaches from brief cases
// 3 to 5 (0.40, 0.91 and 0.96 x D), shown to one decimal rounding halves up.
const D0 = 80.78

/** 5. "Save results" puts a card per light with tilt, distance, dimmer and pass or fail per eye height. */
@component
export class GlareC5LightSheet extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)

    await interactor.trigger(interactable("Save results button"))
    await sleep(300)
    expect(c.cardCount(), "one card per light").toBe(2)
    for (let i = 0; i < 2; i++) {
      const t = c.cardText(i)
      expect(has(t, `Light ${i === 0 ? "L" : "R"} results (computed)`), `card title ${i}: ${t}`).toBe(true)
      expect(has(t, "Tilt 32.3 deg from vertical"), `tilt on card ${i}: ${t}`).toBe(true)
      expect(has(t, "Distance from wall 80.8 cm"), "distance on card").toBe(true)
      expect(has(t, "Dimmer 100%"), "dimmer on card").toBe(true)
      expect(has(t, "Standing, eyes 160 cm: PASS, glare to 32.3 cm"), "standing passes").toBe(true)
      expect(has(t, "Seated, eyes 109 cm: FAIL, glare to 73.5 cm"), "seated fails").toBe(true)
      expect(has(t, "Child seated, eyes 104 cm: FAIL, glare to 77.5 cm"), "child seated fails").toBe(true)
      expect(has(t, "Sample fixture"), "sample fixture values labelled on the card").toBe(true)
      expect(has(t, "CCI Notes 2/3") && has(t, "Smithsonian"), "eye-height sources on the card").toBe(true)
    }

    // Each card sits on its own light's side.
    const cardL = findSceneObjectByName("Results card L")!
    const cardR = findSceneObjectByName("Results card R")!
    expect(cardL.getTransform().getLocalPosition().x, "left card on the left").toBeLessThan(0)
    expect(cardR.getTransform().getLocalPosition().x, "right card on the right").toBeGreaterThan(0)

    // The results are an end view with clear exits: legend and main buttons hidden, Done
    // and Restart shown, the headline answer still on top.
    expect(c.isResultsMode(), "results view after saving").toBe(true)
    expect(c.mapVisible(), "legend hidden behind the results").toBe(false)
    expect(c.headlineText(), "headline still shown").toBe("Standing: glare up to 32.3 cm (1 ft 1 in) from the wall")

    // Done: results close, lights stay where they are.
    await interactor.trigger(interactable("Done button"))
    await sleep(300)
    expect(c.isResultsMode(), "Done closes the results").toBe(false)
    expect(c.cardCount(), "no cards after Done").toBe(0)
    // Back to the card at rest (item D): one line plus the verdict, no per-height lines.
    expect(c.mapVisible(), "no per-height lines at rest after Done").toBe(false)
    expect(c.verdictLineText(), "verdict back after Done").toBe("Glare in the viewing area: Seated, Child seated")
    expect(near(c.lights[0].distanceCm, D0, 0.01), "Done keeps the lights").toBe(true)

    // Slide both lights to 62 cm (the demo target) and save again: new cards, all pass.
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await interactor.trigger(interactable("Save results button"))
    await sleep(300)
    expect(c.cardCount(), "a new save puts a card for each light").toBe(2)
    for (let i = 0; i < 2; i++) {
      const t = c.cardText(i)
      expect(has(t, "Distance from wall 62.0 cm"), `distance updated: ${t}`).toBe(true)
      expect(has(t, "Standing, eyes 160 cm: PASS, glare to 24.8 cm"), "standing passes at 62").toBe(true)
      expect(has(t, "Seated, eyes 109 cm: PASS, glare to 56.4 cm"), "seated passes at 62").toBe(true)
      expect(has(t, "Child seated, eyes 104 cm: PASS, glare to 59.5 cm"), "child seated passes at 62").toBe(true)
    }

    // The dimmer on the card follows the light: 50% on the left light only.
    await interactor.trigger(interactable("Done button"))
    await sleep(300)
    c.setDimmer(0, 0.5)
    await interactor.trigger(interactable("Save results button"))
    await sleep(300)
    expect(has(c.cardText(0), "Dimmer 50%"), `left card dimmer: ${c.cardText(0)}`).toBe(true)
    expect(has(c.cardText(1), "Dimmer 100%"), "right card dimmer unchanged").toBe(true)

    // Restart: lights back to the standard placement, sheets closed.
    await interactor.trigger(interactable("Restart button"))
    await sleep(300)
    expect(c.isResultsMode(), "Restart closes the sheets").toBe(false)
    expect(c.cardCount(), "no cards after Restart").toBe(0)
    for (let i = 0; i < 2; i++) {
      expect(near(c.lights[i].distanceCm, D0, 0.01), `Restart puts light ${i} back at 80.8 cm`).toBe(true)
    }

    // 65 cm: standing and seated pass, child seated still fails (the brief's open question).
    c.setLightDistance(0, 65)
    c.setLightDistance(1, 65)
    await interactor.trigger(interactable("Save results button"))
    await sleep(300)
    const t65 = c.cardText(1)
    expect(has(t65, "Seated, eyes 109 cm: PASS, glare to 59.2 cm"), `seated at 65: ${t65}`).toBe(true)
    expect(has(t65, "Child seated, eyes 104 cm: FAIL, glare to 62.4 cm"), "child seated fails at 65").toBe(true)
    await resetToStandard(c)
  }
}
