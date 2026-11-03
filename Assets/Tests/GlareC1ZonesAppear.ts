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
      ["seated", "Seated", 109, 73.51, "73.5 cm (2 ft 5 in)"],
      ["standing", "Standing", 160, 32.31, "32.3 cm (1 ft 1 in)"],
    ] as ["seated" | "standing", string, number, number, string][]) {
      c.setEyePreset("standing")
      await sleep(200)
      expect(c.zoneVisible(key), `${label} zone mesh visible`).toBe(true)
      expect(c.zoneQuadCount(key), `${label} zone has floor rows`).toBeGreaterThan(5)
      expect(near(c.zoneFarEdgeCm(key), reach, 0.05), `${label} far edge ${c.zoneFarEdgeCm(key)} vs hand ${reach}`).toBe(true)
      expect(c.zoneNearEdgeCm(key), `${label} zone starts at the wall (glazing bottom 100 cm, below every eye)`).toBe(0)
      // The reach in the words the card uses (cm, then feet and inches: 32.31 cm = 12.72 in,
      // 73.51 cm = 28.94 in) when that eye height is chosen.
      c.setEyePreset(key)
      await sleep(200)
      expect(c.headlineText(), `${label} line on the card (eyes at ${h} cm)`).toBe(`${label}: glare up to ${shown} from the wall`)
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
    // Item D: at rest the card is one line plus the verdict; no map and no per-height lines.
    expect(c.mapVisible(), "no map or per-height lines at rest").toBe(false)
    expect(c.mapLaneText("child"), "no child seated line at rest").toBe("")

    // The top line states the answer for the chosen eye height, the second the verdict for
    // all three; the disclosure is the small third line.
    expect(c.headlineText(), "the one line").toBe("Standing: glare up to 32.3 cm (1 ft 1 in) from the wall")
    expect(c.verdictLineText(), "the verdict").toBe("Glare in the viewing area: Seated, Child seated")
    expect(c.disclaimerText(), "disclosure").toBe("Computed for flat glass in this room; manufacturer lamp data, not measured")
    expect(c.versionText(), "version shown").toBe("v0.4")
    // The unexplained "You" marker is gone from the map. Positive control: the same lookup
    // finds a map label that does exist.
    expect(findSceneObjectByName("Map wall label") !== undefined, "lookup finds an existing map label").toBe(true)
    expect(findSceneObjectByName("Map you label") === undefined, "no \"You\" marker").toBe(true)
  }
}
