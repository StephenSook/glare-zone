// LEAF scenario for a Glare Zone done criterion (devpost/design-brief.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {findSceneObjectByName, sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, near, resetToStandard} from "./GlareLeafHelpers"

/** 1. "Seated" and "Standing" glare zones appear on the floor, each showing its depth from the wall in cm. */
@component
export class GlareC1ZonesAppear extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    // Hand values (brief cases 2 and 3): D = (300 - 160) x 0.577 = 80.78; seated reach
    // 0.91 x 80.78 = 73.51, standing 0.40 x 80.78 = 32.31, child seated 0.96 x 80.78 = 77.55.
    for (const [key, label, h, reach, shown] of [
      ["seated", "Seated", 109, 73.51, "73.5"],
      ["standing", "Standing", 160, 32.31, "32.3"],
    ] as ["seated" | "standing", string, number, number, string][]) {
      expect(c.zoneVisible(key), `${label} zone mesh visible`).toBe(true)
      expect(c.zoneQuadCount(key), `${label} zone has floor rows`).toBeGreaterThan(5)
      expect(near(c.zoneFarEdgeCm(key), reach, 0.05), `${label} far edge ${c.zoneFarEdgeCm(key)} vs hand ${reach}`).toBe(true)
      expect(c.zoneNearEdgeCm(key), `${label} zone starts at the wall (glazing bottom 100 cm, below every eye)`).toBe(0)
      // The legend on the answer card, in view from the first frame: one plain line per
      // eye height, with units.
      expect(c.mapLaneText(key), `${label} legend line`).toBe(`${label}, eyes at ${h} cm: glare up to ${shown} cm from the wall`)
    }
    expect(near(c.zoneFarEdgeCm("child"), 77.55, 0.05), `child far edge ${c.zoneFarEdgeCm("child")} vs hand 77.55`).toBe(true)
    // The brief's worked numbers, shown on the floor: the chosen eye height's zone is filled
    // and carries its reach; the others are faint outlines (the legend lists every reach).
    expect(c.zoneFilled("standing"), "Standing zone filled (chosen)").toBe(true)
    expect(c.zoneFilled("seated"), "Seated zone an outline").toBe(false)
    expect(c.zoneLabelText("standing")).toBe("Standing: glare up to 32.3 cm from the wall")
    expect(c.zoneLabelText("seated"), "no reach label on an outline").toBe("")
    c.setEyePreset("seated")
    await sleep(300)
    expect(c.zoneFilled("seated"), "Seated zone filled when chosen").toBe(true)
    expect(c.zoneLabelText("seated")).toBe("Seated: glare up to 73.5 cm from the wall")
    c.setEyePreset("standing")
    await sleep(300)
    expect(c.mapLaneText("child")).toBe("Child seated, eyes at 104 cm: glare up to 77.5 cm from the wall")
    expect(c.mapVisible(), "legend shown in the opening view").toBe(true)
    expect(c.mapLaneText("my"), "no My eyes line until that preset is chosen").toBe("")

    // The top line states the answer for the chosen eye height; the disclosure is the
    // smaller second line.
    expect(c.headlineText(), "headline states the answer").toBe("Standing viewers see glare up to 32.3 cm from the wall")
    expect(c.disclaimerText(), "disclosure as the second line").toBe("Computed reflection, sample lamp values, not measured")
    expect(c.viewingLabelText(), "viewing area in plain words").toBe("Viewing area: 60 to 182 cm from the wall")
    expect(c.versionText(), "version shown").toBe("v0.3.3")
    // The unexplained "You" marker is gone from the map. Positive control: the same lookup
    // finds a map label that does exist.
    expect(findSceneObjectByName("Map wall label") !== undefined, "lookup finds an existing map label").toBe(true)
    expect(findSceneObjectByName("Map you label") === undefined, "no \"You\" marker").toBe(true)
  }
}
