// Perf helper, not a test: holds the opening view, untouched, for about 12 seconds while a
// trace records (the preview only renders steadily while something is running in it).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlarePerfIdle extends Scenario {
  async run(): Promise<void> {
    await resetToStandard(controller())
    await sleep(12000)
  }
}
