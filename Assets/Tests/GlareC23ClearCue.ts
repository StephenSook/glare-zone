// LEAF scenario: the "All three: clear" cue (seventh note, BUILD_LOG row 30). A soft two-bell tone
// made with CLAD's build-sfx skill (Assets/GeneratedSFX/all_three_clear.wav, 0.9 s) plays once, on
// the frame the answer card turns clear: not at launch, not again while it stays clear, and not when
// the card names a low My eyes height with glare (B7).
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import {DefaultLeafInteractor} from "Leaf.lspkg/Interactors/interactor/DefaultLeafInteractor"
import {controller, interactable, near, resetToStandard, stepTo} from "./GlareLeafHelpers"

const SETTLE_MS = 1600
const DEMO_CM = 62

/** 23. The clear cue plays on the frame the card turns "All three: clear". */
@component
export class GlareC23ClearCue extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    const interactor = new DefaultLeafInteractor()
    await resetToStandard(c)
    const both = (cm: number) => {
      c.setLightDistance(0, cm)
      c.setLightDistance(1, cm)
    }
    // Wait, a frame or so at a time, until the card reads `want`; true if it did within 2 s.
    const untilCard = async (want: string) => {
      for (let i = 0; i < 40; i++) {
        if (c.verdictLineText() === want) return true
        await sleep(50)
      }
      return c.verdictLineText() === want
    }

    // The cue is loaded: the generated 0.9 s track, at a quiet volume.
    const cue = c.clearCueComponent()
    expect(cue !== null && cue.audioTrack !== null, "clear cue has its sound").toBe(true)
    const cueC = cue as AudioComponent
    expect(near(cueC.duration, 0.9, 0.05), `cue length ${cueC.duration.toFixed(3)} s vs 0.9`).toBe(true)
    expect(cueC.volume <= 0.5, `cue volume ${cueC.volume}`).toBe(true)
    expect(c.verdict(), "standard placement").toBe("glare")
    const plays0 = c.clearCueStats().plays

    // Positive: both lights to the 62 cm demo setback; the card turns clear and the cue plays on
    // that frame, and is still sounding just after.
    both(DEMO_CM)
    expect(await untilCard("All three: clear"), `card turned clear (${c.verdictLineText()})`).toBe(true)
    const playingNow = cueC.isPlaying()
    const s1 = c.clearCueStats()
    expect(s1.plays, "the cue played once").toBe(plays0 + 1)
    expect(s1.playFrame, `cue frame ${s1.playFrame} vs the frame the card turned clear ${s1.clearFrame}`).toBe(s1.clearFrame)
    expect(s1.playingAtPlay, "the cue's voice is playing on that frame").toBe(true)
    expect(playingNow, "the cue is still sounding when the test reads the card").toBe(true)

    // Staying clear (61 cm) does not play it again.
    await sleep(SETTLE_MS)
    both(61)
    await sleep(SETTLE_MS)
    expect(c.verdictLineText(), "still clear at 61 cm").toBe("All three: clear")
    expect(c.clearCueStats().plays, "no second cue while it stays clear").toBe(plays0 + 1)

    // Back to glare: no cue; clear again: one more.
    both(80.78)
    await sleep(SETTLE_MS)
    expect(c.verdict(), "glare at 80.78 cm").toBe("glare")
    expect(c.clearCueStats().plays, "no cue on turning to glare").toBe(plays0 + 1)
    both(DEMO_CM)
    expect(await untilCard("All three: clear"), "clear again").toBe(true)
    expect(c.clearCueStats().plays, "one cue each time it turns clear").toBe(plays0 + 2)

    // Control (B7): My eyes at 96 cm with the lights at 62 cm is not clear on the card, so no cue;
    // raising the eye to 105 cm turns the card clear, and the cue plays then.
    await resetToStandard(c)
    for (let i = 0; i < 3; i++) {
      await interactor.trigger(interactable("Eye height button"))
      await sleep(300)
    }
    expect(c.getEyePreset(), "My eyes chosen").toBe("my")
    const z = c.eyeLocal().z
    await stepTo(c, new vec3(0, 96, z))
    await sleep(SETTLE_MS)
    const plays2 = c.clearCueStats().plays
    both(DEMO_CM)
    await sleep(SETTLE_MS)
    expect(c.verdictLineText(), "My eyes 96 cm, lights at 62 cm").toBe("All three: clear; My eyes (96 cm): glare")
    expect(c.clearCueStats().plays, "no cue while the card names glare for the low eye").toBe(plays2)
    await stepTo(c, new vec3(0, 105, z), 0)
    expect(await untilCard("All three: clear"), "card clear at 105 cm").toBe(true)
    expect(c.clearCueStats().plays, "cue when the card turns clear at 105 cm").toBe(plays2 + 1)

    const s = c.clearCueStats()
    print(`[C23] clear cue: ${cueC.duration.toFixed(2)} s at volume ${cueC.volume}; played on frame ${s1.playFrame} ` +
      `(card clear on frame ${s1.clearFrame}), playing then: ${s1.playingAtPlay}; total plays ${s.plays - plays0}`)
    await stepTo(c, new vec3(0, c.eyeLocal().y, 300))
    await resetToStandard(c)
  }
}
