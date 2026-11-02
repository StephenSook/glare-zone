// LEAF scenario: the floor view reads in one glance (BUILD_LOG row 8). The viewing area is a
// filled band with a bold, labelled near edge; the chosen eye height's zone is filled on top
// and the other two are faint outlines; where the chosen zone reaches into the viewing area
// a bright warning fill shows, with a status line that turns to "clear" when it is gone.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {EYES} from "../Scripts/GlareZoneController"
import {aabbCorners, angularGap, angularRect, controller, near, press, resetToStandard} from "./GlareLeafHelpers"

// Fixture values, worked by hand from the brief (ceiling H 300, the glazing lit to its top at
// 200 cm, seated eyes 109): standard placement D = (300 - 160) x 0.577 = 80.78 cm.
const OVERLAP_FAR_STANDARD = 73.51 // 80.78 x (200 - 109) / (300 - 200)
const SEATED_FAR_AT_62 = 56.42 // 62 x (200 - 109) / (300 - 200), short of the 60 cm edge
const NEAR_EDGE = 60
const FAR_EDGE = 182
const HALF_WIDTH = 100 // print half width plus 50 cm each side

/** Colour distance (r, g, b). */
function dist(a: vec4 | vec3, b: vec4 | vec3): number {
  return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2 + (a.z - b.z) ** 2)
}

/** Bright, additive-safe (not dark), and not the amber light limit or any zone's colour. */
function warningColourOk(c: vec4, amber: vec4): boolean {
  const bright = Math.max(c.x, c.y, c.z) >= 0.9 && c.x + c.y + c.z >= 1.0 && c.w >= 0.7
  return bright && dist(c, amber) > 0.3 && EYES.every((e) => dist(c, e.color) > 0.3)
}

/** 12. The floor view: filled viewing area, chosen zone on top, the overlap shown and cleared. */
@component
export class GlareC12FloorOverlap extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)

    // Controls for the checks themselves: the colour check rejects the seated pink and the
    // amber; the overlap check flags a label against itself.
    const amber = c.amberColor()
    const pink = EYES.filter((e) => e.key === "seated")[0].color
    expect(warningColourOk(new vec4(pink.x, pink.y, pink.z, 0.85), amber), "colour check rejects the seated pink").toBe(false)
    expect(warningColourOk(amber, amber), "colour check rejects amber").toBe(false)

    // Positive first: standard placement, Seated chosen with the Eye height button. The seated
    // zone reaches 73.51 cm, past the 60 cm near edge: the overlap is drawn from 60 to 73.51.
    await press(interactor, "Eye height button")
    await sleep(300)
    expect(c.getEyePreset(), "Seated chosen").toBe("seated")
    expect(c.zoneFilled("seated"), "Seated zone filled").toBe(true)
    expect(c.zoneFilled("standing") || c.zoneFilled("child"), "Standing and Child seated are outlines").toBe(false)
    expect(c.zoneQuadCount("standing") > 5 && c.zoneQuadCount("child") > 5, "outlines drawn").toBe(true)
    const so = c.zoneRenderOrder("seated")
    expect(so > c.zoneRenderOrder("standing") && so > c.zoneRenderOrder("child"), `Seated zone drawn on top (${so})`).toBe(true)
    expect(c.zoneLabelText("seated"), "Seated reach on the floor").toBe("Seated: glare up to 73.5 cm from the wall")
    expect(c.zoneLabelText("child"), "no reach label on an outline").toBe("")

    expect(c.overlapVisible(), "glare inside the viewing area shown at the standard placement").toBe(true)
    const d = c.overlapDepth()
    expect(near(d.max, OVERLAP_FAR_STANDARD, 0.1), `overlap far edge ${d.max} vs fixture ${OVERLAP_FAR_STANDARD}`).toBe(true)
    expect(near(d.min, NEAR_EDGE, 0.01), `overlap starts at the near edge: ${d.min}`).toBe(true)
    expect(c.overlapRenderOrder() > so, "overlap drawn over the Seated zone").toBe(true)
    const oc = c.overlapColor()
    expect(warningColourOk(oc, amber), `overlap colour bright and distinct: (${oc.x}, ${oc.y}, ${oc.z}, ${oc.w})`).toBe(true)
    expect(c.floorStatusText(), "status line").toBe("Seated: glare inside the viewing area")

    // The viewing area: a filled band 60 to 182 cm, 200 cm wide, and a bold labelled near edge.
    const band = c.viewingFillExtent()
    expect(band !== null, "viewing area filled").toBe(true)
    expect(near(band!.z0, NEAR_EDGE, 0.5) && near(band!.z1, FAR_EDGE, 0.5), `band ${band!.z0} to ${band!.z1} cm`).toBe(true)
    expect(near(band!.x0, -HALF_WIDTH, 0.5) && near(band!.x1, HALF_WIDTH, 0.5), `band x ${band!.x0} to ${band!.x1}`).toBe(true)
    const edge = c.nearEdgeSpan()
    expect(edge !== null, "bold near edge drawn").toBe(true)
    const depth = edge!.max - edge!.min
    expect(depth >= 3, `near edge bold: ${depth.toFixed(2)} cm deep (side lines 1.5)`).toBe(true)
    expect(edge!.min <= NEAR_EDGE && edge!.max >= NEAR_EDGE, `near edge at 60 cm: ${edge!.min} to ${edge!.max}`).toBe(true)
    expect(c.floorViewingLabelText(), "near edge label").toBe("Viewing area starts 60 cm from the wall")

    // One glance: the floor labels never overlap as seen from where you stand.
    const labels = c.floorLabels()
    expect(labels.length, "reach, viewing area and status labels showing").toBe(3)
    const rects = labels.map((t) => angularRect(c, aabbCorners(t)))
    expect(angularGap(rects[0], rects[0]) < 0, "overlap check flags a label against itself").toBe(true)
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const g = angularGap(rects[i], rects[j])
        expect(g, `"${labels[i].text}" clear of "${labels[j].text}" by ${g.toFixed(2)} deg`).toBeGreaterThan(0)
      }
    }

    // Slide both lights to 62 cm (the demo target): the seated zone ends at 56.42 cm, short of
    // the near edge, so the overlap is gone and the status reads clear.
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(300)
    expect(near(c.zoneFarEdgeCm("seated"), SEATED_FAR_AT_62, 0.1), `seated far edge ${c.zoneFarEdgeCm("seated")} vs fixture ${SEATED_FAR_AT_62}`).toBe(true)
    expect(c.overlapVisible(), "no glare inside the viewing area at 62 cm").toBe(false)
    expect(c.overlapDepth().max, "no overlap depth at 62 cm").toBe(0)
    expect(c.floorStatusText(), "status line at 62 cm").toBe("Seated: clear")
    expect(c.zoneLabelText("seated")).toBe("Seated: glare up to 56.4 cm from the wall")

    // And at Standing (standard placement), the standing zone (32.31 cm) is clear too.
    await resetToStandard(c)
    expect(c.zoneFilled("standing"), "Standing zone filled when chosen").toBe(true)
    expect(c.overlapVisible(), "Standing: no overlap").toBe(false)
    expect(c.floorStatusText()).toBe("Standing: clear")
  }
}
