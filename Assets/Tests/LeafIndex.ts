import {scenariosIndex} from "Leaf.lspkg/Scenarios/decorator/ScenarioIndexDecorator"
import {ScenarioMetadata} from "Leaf.lspkg/Scenarios/scenario/ScenarioMetadata"
import {GlareC1ZonesAppear} from "./GlareC1ZonesAppear"
import {GlareC2DragUpdatesZones} from "./GlareC2DragUpdatesZones"
import {GlareC3AmberLimit} from "./GlareC3AmberLimit"
import {GlareC4GlareSpot} from "./GlareC4GlareSpot"
import {GlareC5LightSheet} from "./GlareC5LightSheet"
import {GlareC6MyEyes} from "./GlareC6MyEyes"
import {GlareC7AnswerInView} from "./GlareC7AnswerInView"
import {GlareC8PinchTargets} from "./GlareC8PinchTargets"
import {GlareC9PanelFollows} from "./GlareC9PanelFollows"
import {GlareC10RecallPanels} from "./GlareC10RecallPanels"
import {GlareC11FullThenFaint} from "./GlareC11FullThenFaint"
import {GlareC12FloorOverlap} from "./GlareC12FloorOverlap"
import {GlareMediaFilm07} from "./GlareMediaFilm07"
import {GlareMediaSavedSheet} from "./GlareMediaSavedSheet"
import {GlareMediaMoreOpen} from "./GlareMediaMoreOpen"
import {GlareMediaSeated} from "./GlareMediaSeated"
import {GlareMediaInZone} from "./GlareMediaInZone"
import {GlareMediaArt} from "./GlareMediaArt"
import {GlareMediaArtStart} from "./GlareMediaArtStart"
import {GlareMediaFilm04} from "./GlareMediaFilm04"
import {GlareMediaFilm05} from "./GlareMediaFilm05"
import {GlarePerfExerciser} from "./GlarePerfExerciser"
import {GlarePerfIdle} from "./GlarePerfIdle"
import {GlarePerfExerciserNoOverlays} from "./GlarePerfExerciserNoOverlays"

@component
export class LeafIndex extends BaseScriptComponent {
  @scenariosIndex
  static scenariosIndex: ScenarioMetadata[] = [
    {id: "glare-c1-zones-appear", typename: GlareC1ZonesAppear.getTypeName()},
    {id: "glare-c2-drag-updates-zones", typename: GlareC2DragUpdatesZones.getTypeName()},
    {id: "glare-c3-amber-limit", typename: GlareC3AmberLimit.getTypeName()},
    {id: "glare-c4-glare-spot", typename: GlareC4GlareSpot.getTypeName()},
    {id: "glare-c5-light-sheet", typename: GlareC5LightSheet.getTypeName()},
    {id: "glare-c6-my-eyes", typename: GlareC6MyEyes.getTypeName()},
    {id: "glare-c7-answer-in-view", typename: GlareC7AnswerInView.getTypeName()},
    {id: "glare-c8-pinch-targets", typename: GlareC8PinchTargets.getTypeName()},
    {id: "glare-c9-panel-follows", typename: GlareC9PanelFollows.getTypeName()},
    {id: "glare-c10-recall-panels", typename: GlareC10RecallPanels.getTypeName()},
    {id: "glare-c11-full-then-faint", typename: GlareC11FullThenFaint.getTypeName()},
    {id: "glare-c12-floor-overlap", typename: GlareC12FloorOverlap.getTypeName()},
    {id: "media-saved-sheet", typename: GlareMediaSavedSheet.getTypeName()}, // media helper, not a test
    {id: "media-more-open", typename: GlareMediaMoreOpen.getTypeName()}, // media helper, not a test
    {id: "media-seated", typename: GlareMediaSeated.getTypeName()}, // media helper, not a test
    {id: "media-in-zone", typename: GlareMediaInZone.getTypeName()}, // media helper, not a test
    {id: "media-art", typename: GlareMediaArt.getTypeName()}, // media helper (icon), not a test
    {id: "media-art-start", typename: GlareMediaArtStart.getTypeName()}, // media helper (3x4 preview image), not a test
    {id: "media-film-04", typename: GlareMediaFilm04.getTypeName()}, // film still helper, not a test
    {id: "media-film-05", typename: GlareMediaFilm05.getTypeName()}, // film still helper, not a test
    {id: "media-film-07", typename: GlareMediaFilm07.getTypeName()}, // film still helper, not a test
    {id: "perf-exerciser", typename: GlarePerfExerciser.getTypeName()}, // perf helper, not a test
    {id: "perf-idle", typename: GlarePerfIdle.getTypeName()}, // perf helper, not a test
    {id: "perf-exerciser-no-overlays", typename: GlarePerfExerciserNoOverlays.getTypeName()}, // perf A/B helper
  ]
}
