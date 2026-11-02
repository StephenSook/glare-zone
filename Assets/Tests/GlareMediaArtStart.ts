// Media helper, not a test: the start position with no text and no panels, for the 3x4
// preview image (bright colours, no text). Pitch the preview camera down about 22 deg after
// it runs so the print and the coloured floor zones share the frame; refresh to restore text.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {controller, hideLeafOverlay, hideTextForArt, resetToStandard} from "./GlareLeafHelpers"

@component
export class GlareMediaArtStart extends Scenario {
  async run(): Promise<void> {
    hideLeafOverlay()
    const c = controller()
    await resetToStandard(c)
    await sleep(100)
    hideTextForArt(c)
  }
}
