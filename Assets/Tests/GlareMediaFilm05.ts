// Media helper, not a test: film still 05. "My eyes" chosen at the standard placement; then
// lower the preview camera (MovePreviewCamera down 40) and the My eyes zone follows.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, hideLeafOverlay, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaFilm05 extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    c.setEyePreset("my")
    await sleep(600)
  }
}
