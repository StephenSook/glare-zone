// LEAF scenario: an IK reach check (BUILD_LOG rows 20 and 24). LEAF's IK arm (an adult arm
// model with an avatar) presses the near controls (about 1 m away, so by ray) and the three
// palm menu buttons (within arm reach, so by SIK's physical proximity), and each press must
// take effect. Run it with __leaf__diagnostic_policy = fail-fast: then a reach error that
// LEAF throws (target beyond reach, behind the body, past the ray cap) stops the run at the
// press instead of falling back to a simulated tap. LEAF records some errors without throwing
// (a hover or trigger that times out, convergence_timeout), so after every press this check
// also asserts that no reach diagnostic was recorded. The policy is printed in the log line.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {bridgeLeafDirectPoke, controller, interactable, resetToStandard} from "./GlareLeafHelpers"

/** 19. The near controls and the palm menu are within reach of LEAF's IK arm, checked with fail-fast. */
@component
export class GlareC19IKReach extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const recorder = DiagnosticRecorder.getInstance()
    const policy = recorder.policy
    print(`[C19] IK reach check, __leaf__diagnostic_policy=${policy}`)
    expect(policy, "run with __leaf__diagnostic_policy fail-fast, so LEAF cannot fall back to a simulated tap").toBe("fail-fast")

    const ik = createIKInteractor()
    // The palm menu is pressed directly (within arm reach); see bridgeLeafDirectPoke for why
    // the bridge is needed with this project's SIK. Restored at the end.
    const unbridge = bridgeLeafDirectPoke("right")
    try {
      await sleep(1500) // let the IK body and its avatar settle before the first reach
      const reached: string[] = []
      // Control for the diagnostics check: nothing recorded before the first press.
      expect(recorder.getAll().length, "no reach diagnostics before the first press").toBe(0)
      // Press with the IK arm, wait up to 2 s for the press to take effect, then require that
      // LEAF recorded no reach diagnostic for it (errors it does not throw included).
      const press = async (name: string, done: () => boolean) => {
        await ik.trigger(interactable(name))
        for (let i = 0; i < 20 && !done(); i++) await sleep(100)
        const diag = recorder.getAll().map((e) => e.diagnostic.category)
        expect(diag.join(", "), `${name}: no reach diagnostics recorded`).toBe("")
        reached.push(name)
      }

      // Near controls (about 1 m away, so pressed by ray): each press takes effect.
      await press("Eye height button", () => c.getEyePreset() === "seated")
      expect(c.getEyePreset(), "Eye height button pressed by the IK arm").toBe("seated")
      await press("More button", () => c.isMoreOpen())
      expect(c.isMoreOpen(), "More button pressed by the IK arm").toBe(true)
      await press("More button", () => !c.isMoreOpen())
      expect(c.isMoreOpen(), "More button pressed again").toBe(false)
      await press("Save results button", () => c.isResultsMode())
      expect(c.isResultsMode(), "Save results pressed by the IK arm").toBe(true)
      await press("Done button", () => !c.isResultsMode())
      expect(c.isResultsMode(), "Done pressed by the IK arm").toBe(false)

      // The palm menu (B4), where a raised left palm puts it: 40 cm ahead of the eye and 20 cm
      // down (as in C8, C10 and C13), held up for 30 s because the arm takes a few seconds to
      // settle and converge (the other checks show it for 3 s). Within arm reach, so each
      // button is pressed by SIK's physical proximity (a poke from the IK finger), not a ray.
      const menu = c.handMenu()
      const cam = c.cameraObject.getTransform()
      const fired = {recall: 0, front: 0, wall: 0}
      menu.onRecall.add(() => fired.recall++)
      menu.onPlaceFront.add(() => fired.front++)
      menu.onPlaceWall.add(() => fired.wall++)
      menu.showAt(cam.getWorldTransform().multiplyPoint(new vec3(0, -20, -40)), 30)
      await sleep(300)
      expect(menu.isShowing(), "palm menu showing").toBe(true)
      await press("Bring panels here button", () => fired.recall > 0)
      expect(fired.recall, "Bring panels here pressed by the IK arm").toBe(1)
      await press("Place in front of me button", () => fired.front > 0)
      expect(fired.front, "Place in front of me pressed by the IK arm").toBe(1)
      await press("Place on a wall button", () => fired.wall > 0)
      expect(fired.wall, "Place on a wall pressed by the IK arm").toBe(1)
      expect(c.isPlacingOnWall(), "Place on a wall started wall aiming").toBe(true)

      print(`[C19] reached with the IK arm (policy ${policy}, reach diagnostics ${recorder.getAll().length}): ${reached.join(", ")}`)
    } finally {
      unbridge()
    }
    await resetToStandard(c) // also stops the wall aiming
  }
}
