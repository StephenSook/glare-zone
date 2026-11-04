// LEAF scenario: the answer is readable at every eye-height preset.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {EyePreset, ZoneKey} from "../Scripts/GlareZoneController"
import {
  AngularRect,
  aabbCorners,
  angularGap,
  angularRect,
  controller,
  interactable,
  outOfView,
  press,
  resetToStandard,
  targetVisual,
} from "./GlareLeafHelpers"

// The answer each preset must state, from the brief's hand values at the standard placement
// (80.78 cm): 0.40, 0.91 and 0.96 x 80.78 = 32.31, 73.51 and 77.55 cm; My eyes starts at 160.
// Feet and inches by hand (1 in = 2.54 cm): 12.72, 28.94 and 30.53 in, to the nearest inch.
const HEADLINE: {[k: string]: string} = {
  standing: "Standing: glare up to 32.3 cm (1 ft 1 in) from the wall",
  seated: "Seated: glare up to 73.5 cm (2 ft 5 in) from the wall",
  child: "Child seated: glare up to 77.5 cm (2 ft 7 in) from the wall",
  my: "My eyes (160 cm): glare up to 32.3 cm (1 ft 1 in) from the wall",
}

/** How far (deg) one rectangle sticks out of another; 0 when it lies inside. */
function overhang(inner: AngularRect, outer: AngularRect): number {
  return Math.max(0, outer.x0 - inner.x0, inner.x1 - outer.x1, outer.y0 - inner.y0, inner.y1 - outer.y1)
}

/**
 * 7. The headline answer, the legend and the main buttons are inside the display
 * rectangle at Standing, Seated, Child seated and My eyes (the seated case is the point),
 * and the headline states that preset's answer.
 */
@component
export class GlareC7AnswerInView extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)

    // Positive control for the cover check: it flags a known overlap (the handle against itself).
    const hL = angularRect(c, aabbCorners(targetVisual(findSceneObjectByName("Aim handle L")!)))
    expect(angularGap(hL, hL) < 0, "cover check flags the handle against itself").toBe(true)

    // Positive and negative controls for the in-view check itself.
    const g = c.galleryObject().getTransform().getWorldTransform()
    expect(outOfView(c, [g.multiplyPoint(new vec3(0, 150, 0))]), "print centre in view from the start").toBe("")
    expect(outOfView(c, [g.multiplyPoint(new vec3(0, 160 + 200, 250))]) !== "", "a point 2 m above the eye is out of view").toBe(true)
    expect(outOfView(c, [g.multiplyPoint(new vec3(120, 160, 250))]) !== "", "a point far to the side is out of view").toBe(true)

    // The glazing (the print's opening, 100 x 100 cm, 100 to 200 cm up) as seen from the eye,
    // and a negative control for the overlap check: the print's frame overlaps it.
    const glazingRect = () => {
      const w = c.galleryObject().getTransform().getWorldTransform()
      return angularRect(c, [new vec3(-50, 100, 0), new vec3(50, 100, 0), new vec3(50, 200, 0), new vec3(-50, 200, 0)]
        .map((p) => w.multiplyPoint(p)))
    }
    const frameRect = angularRect(c, [new vec3(-55, 95, 0), new vec3(55, 205, 0)].map((p) => g.multiplyPoint(p)))
    expect(angularGap(frameRect, glazingRect()), "overlap check: the frame overlaps the glazing").toBeLessThan(0)

    // Controls for the inside-the-card check: the card's backing lies inside itself, and the
    // same backing moved 1 deg right sticks out by 1 deg.
    const plate0 = angularRect(c, c.answerPlateCorners())
    expect(overhang(plate0, plate0), "inside check passes the card itself").toBe(0)
    const moved = {x0: plate0.x0 + 1, x1: plate0.x1 + 1, y0: plate0.y0, y1: plate0.y1}
    expect(Math.abs(overhang(moved, plate0) - 1) < 1e-6, "inside check flags a rect 1 deg out").toBe(true)

    // At every preset, with More controls closed and then open: the headline states that
    // preset's answer, the card stays clear of the glazing (the print stays visible), and the
    // card, headline, every legend line and every control are inside the display.
    // With More open, each aim handle stays usable: no More cell covers it, and each slider
    // knob stays at least 1 deg from it (Snap's pinch-target spacing), with the knobs where
    // they are and at the ends nearest the handle (dimmer at 0%, distance at 150 cm).
    const handleChecks = async (tag: string) => {
      const knobGaps = (when: string) => {
        for (const side of ["L", "R"]) {
          const hRect = angularRect(c, aabbCorners(targetVisual(findSceneObjectByName(`Aim handle ${side}`)!)))
          for (const s of [`Dimmer slider ${side}`, `Distance slider ${side}`]) {
            const g5 = angularGap(angularRect(c, aabbCorners(targetVisual(interactable(s).getSceneObject()))), hRect)
            expect(g5 >= 1, `${tag}, ${when}: ${s} knob ${g5.toFixed(2)} deg from aim handle ${side}`).toBe(true)
          }
        }
      }
      knobGaps("knobs as set")
      for (let i = 0; i < 2; i++) {
        c.setDimmer(i, 0)
        c.setLightDistance(i, 150)
      }
      await sleep(250)
      knobGaps("knobs nearest the handle")
      const D0 = 80.78
      for (let i = 0; i < 2; i++) {
        c.setDimmer(i, 1)
        c.setLightDistance(i, D0)
      }
      await sleep(250)
    }

    const checkPreset = (preset: EyePreset, moreOpen: boolean) => {
      const tag = `${preset}${moreOpen ? ", More open" : ""}`
      expect(c.getEyePreset(), "preset chosen with the Eye height button").toBe(preset)
      expect(c.isMoreOpen(), `${tag}: More state`).toBe(moreOpen)
      expect(c.headlineText(), `${tag}: headline`).toBe(HEADLINE[preset])
      const cardRect = angularRect(c, c.answerPlateCorners())
      const gap = angularGap(cardRect, glazingRect())
      expect(gap, `${tag}: answer card clear of the glazing by ${gap.toFixed(2)} deg`).toBeGreaterThan(0)
      expect(outOfView(c, c.answerCardCorners(), 0.5), `${tag}: answer card corners in view`).toBe("")
      expect(outOfView(c, aabbCorners(c.headlineComponent()), 0.5), `${tag}: headline in view`).toBe("")
      // The longer lines (cm, then feet and inches) stay on the card: no text runs past its
      // backing (the card's text overflows rather than wrapping).
      const oh = overhang(angularRect(c, aabbCorners(c.headlineComponent())), cardRect)
      expect(oh < 0.01, `${tag}: headline inside the answer card (${oh.toFixed(2)} deg out)`).toBe(true)
      // Item D: the second line is the verdict for all three eye heights.
      expect(c.verdictLineText(), `${tag}: verdict`).toBe("Glare in the viewing area: Seated, Child seated")
      expect(outOfView(c, aabbCorners(c.verdictLineComponent()), 0.5), `${tag}: verdict in view`).toBe("")
      const ov = overhang(angularRect(c, aabbCorners(c.verdictLineComponent())), cardRect)
      expect(ov < 0.01, `${tag}: verdict inside the answer card (${ov.toFixed(2)} deg out)`).toBe(true)
      const controls = ["Eye height button", "Save results button", "More button"]
      if (moreOpen) controls.push("Dimmer slider L", "Dimmer slider R", "Distance slider L", "Distance slider R", "Paper art button")
      for (const name of controls) {
        const v = targetVisual(interactable(name).getSceneObject())
        expect(outOfView(c, aabbCorners(v), 0.5), `${tag}: ${name} in view`).toBe("")
      }
      if (moreOpen) {
        // The print stays visible with More open: every column cell clear of the glazing, and
        // of the answer card. The aim handles stay uncovered: every cell clear of them.
        for (const side of ["L", "R"]) {
          const hRect = angularRect(c, aabbCorners(targetVisual(findSceneObjectByName(`Aim handle ${side}`)!)))
          for (const cell of ["dimmer", "distance"]) {
            const colRect = angularRect(c, aabbCorners(targetVisual(findSceneObjectByName(`More controls ${cell} backing ${side}`)!)))
            const g2 = angularGap(cardRect, colRect)
            expect(g2, `${tag}: answer card clear of More ${cell} cell ${side} by ${g2.toFixed(2)} deg`).toBeGreaterThan(0)
            const g3 = angularGap(colRect, glazingRect())
            expect(g3, `${tag}: More ${cell} cell ${side} clear of the glazing by ${g3.toFixed(2)} deg`).toBeGreaterThan(0)
            const g4 = angularGap(colRect, hRect)
            expect(g4, `${tag}: aim handle ${side} clear of the More ${cell} cell by ${g4.toFixed(2)} deg`).toBeGreaterThan(0)
          }
        }
      }
    }

    // While a light moves, each other eye height's change line shows on the card too: in view and
    // inside it (both lights to 62 cm, then back). The chosen height (Standing) has none: its
    // distance is the headline's (U1, each distance once on screen).
    for (let i = 0; i < 2; i++) c.setLightDistance(i, 62)
    await sleep(300)
    const cardNow = angularRect(c, c.answerPlateCorners())
    expect(c.mapLaneText("standing"), "moving: no change line for the chosen height").toBe("")
    for (const k of ["seated", "child"] as ZoneKey[]) {
      expect(c.mapLaneText(k).indexOf(" to ") > 0, `moving: ${k} change line shown (${c.mapLaneText(k)})`).toBe(true)
      expect(outOfView(c, aabbCorners(c.mapLaneTextComponent(k)), 0.5), `moving: ${k} change line in view`).toBe("")
      const oc = overhang(angularRect(c, aabbCorners(c.mapLaneTextComponent(k))), cardNow)
      expect(oc < 0.01, `moving: ${k} change line inside the answer card (${oc.toFixed(2)} deg out)`).toBe(true)
    }
    await resetToStandard(c)

    const presets: EyePreset[] = ["standing", "seated", "child", "my"]
    for (const preset of presets) {
      if (preset !== "standing") await press(interactor, "Eye height button")
      await sleep(200)
      checkPreset(preset, false)
    }
    // Round again to Standing, open More controls, and go through every preset with it open.
    await press(interactor, "Eye height button")
    await press(interactor, "More button")
    for (const preset of presets) {
      if (preset !== "standing") await press(interactor, "Eye height button")
      await sleep(200)
      checkPreset(preset, true)
      await handleChecks(`${preset}, More open`)
    }
    await press(interactor, "More button")

    // Back to Standing, then the results view: both cards in view.
    await press(interactor, "Eye height button")
    expect(c.getEyePreset()).toBe("standing")
    await press(interactor, "Save results button")
    for (const name of ["Results card L", "Results card R"]) {
      const card = findSceneObjectByName(name)!
      const backing = card.getChild(0).getComponent("Component.RenderMeshVisual") as RenderMeshVisual
      expect(outOfView(c, aabbCorners(backing), 0.5), `${name} in view`).toBe("")
    }
    for (const name of ["Done button", "Restart button"]) {
      expect(outOfView(c, aabbCorners(targetVisual(interactable(name).getSceneObject())), 0.5), `${name} in view`).toBe("")
    }
    await resetToStandard(c)
  }
}
