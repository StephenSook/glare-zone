// LEAF scenario: an IK reach check (BUILD_LOG row 20). LEAF's IK arm (an adult arm model with
// an avatar) presses the near controls (by ray, about 1 m away), and each press must take
// effect. Run it with __leaf__diagnostic_policy = fail-fast: then a control the arm
// cannot reach throws at the press instead of LEAF falling back to a simulated tap, so a
// green run means every press was a real reach. The policy is printed in the log line.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DiagnosticRecorder} from "Leaf.lspkg/Diagnostic/DiagnosticRecorder"
import {createIKInteractor} from "Leaf.lspkg/Interactors/interactor/ik/visualizer/BitmojiAvatar"
import {controller, interactable, resetToStandard} from "./GlareLeafHelpers"

/** 19. The near controls are within reach of LEAF's IK arm, checked with fail-fast. */
@component
export class GlareC19IKReach extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    const policy = DiagnosticRecorder.getInstance().policy
    print(`[C19] IK reach check, __leaf__diagnostic_policy=${policy}`)
    expect(policy, "run with __leaf__diagnostic_policy fail-fast, so LEAF cannot fall back to a simulated tap").toBe("fail-fast")

    const ik = createIKInteractor()
    await sleep(1500) // let the IK body and its avatar settle before the first reach
    const reached: string[] = []
    // Press with the IK arm, then wait up to 2 s for the press to take effect.
    const press = async (name: string, done: () => boolean) => {
      await ik.trigger(interactable(name))
      for (let i = 0; i < 20 && !done(); i++) await sleep(100)
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

    // Not in this check: the palm menu. LEAF's IK right arm timed out converging on its button
    // (hoverEnter, convergence_timeout) both 40 cm ahead and 20 cm down and 48 cm out, 28 cm
    // down and 12 cm left, so it stays covered by LEAF's scripted pinch (C8, C10, C13).

    print(`[C19] reached with the IK arm (policy ${policy}): ${reached.join(", ")}`)
    await resetToStandard(c)
  }
}
