// Perf helper, not a test: the same handle drags as perf-exerciser for about 36 seconds, so a
// trace can start after the run has begun (a LEAF run starts only after the Lens resets, too
// late to start a trace before it).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {exerciseHandle} from "./GlarePerfExerciser"

@component
export class GlarePerfExerciserLong extends Scenario {
  async run(): Promise<void> {
    await exerciseHandle(12)
  }
}
