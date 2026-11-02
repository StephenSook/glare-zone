// LEAF scenario for a Glare Zone done criterion (devpost/design-brief.md).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, interactable, near, resetToStandard, stepTo} from "./GlareLeafHelpers"

// Hand values. The lights hang at x = +-50, 300 cm up, 80.78 cm out; each one's mirror
// image is at (+-50, 300, -80.78). An eye at (0, h, z) sees a light where the line to its
// mirror image crosses the wall: t = z / (z + 80.78), x = +-50 t, y = h + (300 - h) t.
//   Seated (0, 109, 60):  t = 0.42620, x = +-21.31, y = 190.40
//   Child  (0, 104, 60):  t = 0.42620, x = +-21.31, y = 187.54
//   Standing (0, 160, 20): t = 0.19845, x = +-9.92, y = 187.78
// The zones reach 73.51 (seated), 77.55 (child) and 32.31 (standing) cm, so each eye is
// inside its zone, and 12 cm past a zone's far edge is outside it.
type Spot = {x: number; y: number}

/** 4. At an eye height, standing inside that height's zone shows a glare spot on the glass; stepping out removes it. */
@component
export class GlareC4GlareSpot extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)

    const expectSpots = (label: string, name: string, want: Spot[]) => {
      expect(c.glareSpotVisible(), `${label}: glare spot shows inside the zone`).toBe(true)
      const pts = c.glareSpotPoints().slice().sort((a, b) => a.x - b.x)
      expect(pts.length, `${label}: one spot per light`).toBe(want.length)
      for (let i = 0; i < want.length; i++) {
        expect(near(pts[i].x, want[i].x, 0.05) && near(pts[i].y, want[i].y, 0.05),
          `${label}: spot ${i} at (${pts[i].x.toFixed(2)}, ${pts[i].y.toFixed(2)}), hand (${want[i].x}, ${want[i].y})`).toBe(true)
      }
      const labels = c.spotLabelTexts()
      expect(labels.length, `${label}: one label per spot ${JSON.stringify(labels)}`).toBe(want.length)
      for (const t of labels) expect(t, `${label}: spot label`).toBe(`${name}: glare here`)
      const at = c.spotLabelPositions().slice().sort((a, b) => a.x - b.x)
      for (let i = 0; i < at.length; i++) {
        const d = Math.abs(at[i].x - want[i].x) + Math.abs(at[i].y - want[i].y)
        expect(d, `${label}: label ${i} right beside its spot`).toBeLessThan(7)
      }
    }
    const expectNone = (label: string) => {
      expect(c.glareSpotVisible(), `${label}: no glare spot`).toBe(false)
      expect(c.spotLabelTexts().length, `${label}: no spot labels`).toBe(0)
    }

    // Seated, chosen with the "Eye height" button (Standing, then Seated): the floor moves so
    // the camera is at 109 cm.
    await interactor.trigger(interactable("Eye height button"))
    await sleep(300)
    expect(c.getEyePreset(), "seated preset selected").toBe("seated")
    expect(near(c.eyeLocal().y, 109, 0.5), `camera at 109 cm, got ${c.eyeLocal().y}`).toBe(true)
    await stepTo(c, new vec3(0, 109, 60))
    expectSpots("seated at 60 cm", "Seated", [{x: -21.31, y: 190.4}, {x: 21.31, y: 190.4}])
    // The ghost lamp construction fades in while the eye sees glare, and stays faint.
    await sleep(500)
    expect(c.ghostVisibility(), "ghost lamp shown inside the zone").toBeGreaterThan(0.9)
    expect(c.ghostLampAlpha(), "ghost lamp drawn faint").toBeLessThan(0.3)
    // Step out past the far edge: the spots and labels go away, the ghost lamp fades out.
    await stepTo(c, new vec3(0, 109, 73.51 + 12))
    expectNone("seated 12 cm past the far edge")
    await sleep(500)
    expect(c.ghostVisibility(), "ghost lamp faded out").toBe(0)

    // Child seated (the next press): same place in front of the wall, lower spots.
    await interactor.trigger(interactable("Eye height button"))
    await sleep(300)
    expect(c.getEyePreset(), "child seated preset selected").toBe("child")
    await stepTo(c, new vec3(0, 104, 60))
    expectSpots("child seated at 60 cm", "Child seated", [{x: -21.31, y: 187.54}, {x: 21.31, y: 187.54}])
    await stepTo(c, new vec3(0, 104, 77.55 + 12))
    expectNone("child seated 12 cm past the far edge")

    // Standing: a positive control inside the standing zone first, then the spot where seated
    // eyes saw glare (60 cm) is outside the standing zone (32.31 cm).
    c.setEyePreset("standing")
    await sleep(300)
    await stepTo(c, new vec3(0, 160, 20))
    expectSpots("standing at 20 cm", "Standing", [{x: -9.92, y: 187.78}, {x: 9.92, y: 187.78}])
    await stepTo(c, new vec3(0, 160, 60))
    expectNone("standing at 60 cm")

    await resetToStandard(c)
  }
}
