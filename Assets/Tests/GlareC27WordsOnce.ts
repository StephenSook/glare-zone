// LEAF scenario: the few-words pass (U1, BUILD_LOG row 39). It reads every text the Lens shows (each
// enabled Text under the practice gallery, the near panels included) and checks: no "click" anywhere
// (Spectacles input is a pinch); each glare distance on screen once, at rest and while a light moves;
// and the honesty line ("... not measured") still shown.
import {Scenario} from "Leaf.lspkg/Scenarios/scenario/Scenario"
import {expect} from "Leaf.lspkg/Utils/common/Expect"
import {sleep} from "Leaf.lspkg/Utils/common/Utils"
import * as G from "../Scripts/GlareMath"
import {controller, resetToStandard} from "./GlareLeafHelpers"

const SETTLE_MS = 1600

/** Every enabled Text under `root` whose object is enabled in the hierarchy. */
function shownTexts(root: SceneObject): string[] {
  const out: string[] = []
  const walk = (so: SceneObject) => {
    if (!so.enabled) return
    for (const t of so.getComponents("Component.Text") as Text[]) {
      if (t.enabled && t.text.length > 0) out.push(t.text)
    }
    for (let i = 0; i < so.getChildrenCount(); i++) walk(so.getChild(i))
  }
  walk(root)
  return out
}

/** How many times `part` appears across the texts. */
function count(texts: string[], part: string): number {
  let n = 0
  for (const t of texts) {
    let i = t.indexOf(part)
    while (i >= 0) {
      n++
      i = t.indexOf(part, i + part.length)
    }
  }
  return n
}

/** 27. No "click"; each glare distance once on screen; the honesty line shown. */
@component
export class GlareC27WordsOnce extends Scenario {
  async run(): Promise<void> {
    const c = controller()
    await resetToStandard(c)
    c.setEyePreset("seated")
    await sleep(SETTLE_MS)
    const root = c.galleryObject()

    // At rest, Seated chosen at the standard placement.
    let texts = shownTexts(root)
    expect(texts.length > 8, `texts found (${texts.length})`).toBe(true)
    const clicks = texts.filter((t) => t.toLowerCase().indexOf("click") >= 0)
    expect(clicks.join(" | "), "no text says click").toBe("")
    expect(count(texts, "pinch to change"), "the Eye height button says pinch").toBe(1)
    const seated = G.oneDecimal(c.zoneFarEdgeCm("seated"))
    expect(seated, "Seated at the standard placement").toBe("73.5")
    expect(count(texts, `${seated} cm`), `"${seated} cm" on screen once: ${texts.filter((t) => t.indexOf(seated) >= 0).join(" | ")}`).toBe(1)
    expect(c.headlineText().indexOf(`${seated} cm`) > 0, "and it is the headline's").toBe(true)
    expect(c.disclaimerText().indexOf("not measured") > 0, `the honesty line is shown: "${c.disclaimerText()}"`).toBe(true)

    // While both lights move to 62 cm: each height's distance once (Seated in the headline, the
    // others in their change lines).
    c.setLightDistance(0, 62)
    c.setLightDistance(1, 62)
    await sleep(300)
    expect(c.isMoveOpen(), "a move is open").toBe(true)
    texts = shownTexts(root)
    for (const k of ["seated", "standing", "child"] as ("seated" | "standing" | "child")[]) {
      const d = `${G.oneDecimal(c.zoneFarEdgeCm(k))} cm`
      expect(count(texts, d), `moving: ${k} "${d}" on screen once: ${texts.filter((t) => t.indexOf(d) >= 0).join(" | ")}`).toBe(1)
    }
    expect(c.disclaimerText().indexOf("not measured") > 0, "the honesty line while moving").toBe(true)

    print(`[C27] ${texts.length} texts shown while moving; no "click"; "${seated} cm" once at rest; ` +
      `each height's distance once while moving`)
    await resetToStandard(c)
  }
}
