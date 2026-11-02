// Media helper, not a test: film still 07. Standard placement (both lights 80.78 cm out),
// Seated chosen; then glance down (MovePreviewCamera rotate pitch -30): the seated zone
// filled, the red overlap from 60 to 73.5 cm, the bold near edge and its labels.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, hideLeafOverlay, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaFilm07 extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    c.setEyePreset("seated")
    await sleep(600)
  }
}
