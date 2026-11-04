import * as G from "./GlareMath"
import {DynamicMesh, Quad, barQuads, boxQuads, discQuads, makeText, rectXY, rectXZ, tintedMaterial} from "./DrawKit"
import {DragKnob} from "./DragKnob"
import {GlareZoneUI} from "./GlareZoneUI"
import {GlareHandMenu} from "./GlareHandMenu"
import {GlareWallPlacer, WallHit} from "./GlareWallPlacer"
import * as P from "./PlacementMath"
import {LAYOUT, LENS_VERSION} from "./GlareLayout"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {smoothDamp} from "SpectaclesInteractionKit.lspkg/Utils/mathUtils"

export type EyeKey = "standing" | "seated" | "child"
export type ZoneKey = EyeKey | "my"
export type EyePreset = ZoneKey
export type Placement = {kind: "front" | "wall"; distanceCm: number; hit: vec3 | null; normal: vec3 | null}

type Eye = {key: EyeKey; label: string; heightCm: number; color: vec3; viewers: string}

export const EYES: Eye[] = [
  {key: "standing", label: "Standing", heightCm: G.EYE_STANDING_CM, color: new vec3(0.2, 0.85, 1.0), viewers: "Standing viewers"},
  {key: "seated", label: "Seated", heightCm: G.EYE_SEATED_CM, color: new vec3(1.0, 0.35, 0.85), viewers: "Seated viewers"},
  {key: "child", label: "Child seated", heightCm: G.EYE_CHILD_SEATED_CM, color: new vec3(0.5, 1.0, 0.3), viewers: "Seated children"},
]

// "My eyes": the eye height is wherever the camera is above the practice floor, live.
const MY_EYES_LABEL = "My eyes"
const MY_EYES_COLOR = new vec3(1.0, 0.95, 0.45)
const MY_EYES_STEP_CM = 0.5 // redraw the live zone when the eye moves this much
const PRESET_ORDER: EyePreset[] = ["standing", "seated", "child", "my"]
const LANES: ZoneKey[] = ["standing", "seated", "child", "my"]

// Answer card (panel-local cm, 1 m from the eye). A small top-down floor map on the left
// (wall at the left edge, 0 to 200 cm out) and one plain line per eye height on the right.
const PLOT_X0 = -22.5
const PLOT_W = 13
const PLOT_RANGE_CM = 200
const LANE_Y0 = 0.8 // the change lines, under the disclosure (item D)
const LANE_STEP = 2.05
const LANE_H = 1.4
const LEGEND_TEXT_X = -8.3
const HEADLINE_Y = 6.4
const VERDICT_Y = 4.5
const DISCLAIMER_Y = 2.9
const VIEWING_TINT = new vec4(1, 1, 1, 0.22)

// Light, low-opacity backing behind text floating over the room (never black: black
// renders transparent on Specs).
const TEXT_BACKING = new vec4(0.85, 0.92, 1.0, 0.18)

// Floor view: the viewing area as a filled band with a bold near edge; the chosen eye
// height's zone filled on top, the other heights as faint outlines; where the chosen zone
// reaches into the viewing area, a bright warning fill (red, not amber: amber is the light
// limit; bright, because black renders transparent on Specs).
const VIEWING_FILL = new vec4(1, 1, 1, 0.16)
const VIEWING_EDGE = new vec4(1, 1, 1, 0.95)
const NEAR_EDGE_CM = 4 // the bold near edge, in cm of floor
const OUTLINE_CM = 1.5
export const OVERLAP_COLOR = new vec4(1.0, 0.18, 0.12, 0.85)
const OVERLAP_TEXT = new vec4(1.0, 0.42, 0.36, 1)
const FLOOR_RENDER = {fill: 1, outline: 2, chosen: 3, overlap: 4, edge: 5, label: 6}
// Floor labels stack in screen space from the viewer's eye, so they never overlap: the zone's
// reach and the viewing area's start just above the bold edge, the status just below it.
const FLOOR_LABEL_PITCH_DEG = 1.9
const FLOOR_LABEL_HALF_DEG = 0.95

const AMBER = new vec4(1.0, 0.6, 0.05, 0.62)
const FULL_ALPHA = 0.55
const FAINT_ALPHA = 0.3
const ADJUST_HOLD_S = 1.2

// Floor rings (v0.4 item C): one per eye height in the viewing area. Stand in one for
// RING_HOLD_S and the Lens switches to that eye height; stepping out first cancels.
const RING_Z_CM = 150 // cm from the wall, inside the 60 to 182 cm viewing area
const RING_X_CM = [-60, 0, 60] // Standing, Seated, Child seated
const RING_RADIUS_CM = 22
const RING_WIDTH_CM = 3
const RING_HOLD_S = 1.0
const AIM_GAIN = 1.5 // aim point moves 1.5 cm per cm the hand moves up or down
const AMBER_CELL_CM = 5
const ZONE_ROW_CM = 2
const EDGE_SNAP_CM = 5
const EDGE_HANDLE_X = -65

const BEAM_ALPHA = 0.035
const GHOST_FADE_PER_S = 4 // ghost lamp fades in and out over about a quarter second
// The ghost lamp sits behind the wall and is drawn over the print (depth test off, late
// render order): Snap advises against far content drawn over near content, so it stays
// faint and only shows while the eye is in a glare zone. See BUILD_LOG.
const GHOST_ALPHA = 0.25
const GHOST_LABEL_ALPHA = 0.6
const LAMP_RAY_ALPHA = 0.7 // warm like the spot: a faint white line vanishes against the mat
const LAMP_RAY_THICKNESS = 0.4
const GHOST_RENDER_ORDER = 50
const SPOT_LABEL_RENDER_ORDER = 5 // labels on the glass and floor, at their own depth
const SPOT_LABEL_ABOVE_CM = 5.5 // clear of the spot's 4 cm halo
// Suggest a setback (B5): a faint green ghost of each fixture on its track where all three
// eye heights would be clear, and one short label between them.
const SETBACK_COLOR = new vec4(0.45, 1.0, 0.6, 0.35)
const SETBACK_LABEL_COLOR = new vec4(0.6, 1.0, 0.72, 0.95)
const SETBACK_LABEL_BELOW_CM = 22 // under the tracks, between the two ghost fixtures

// The disclosure and the model's limits (eighth note), as one line under the verdict: the
// answer holds for flat glass in this room's sizes, so "All three: clear" is not a promise
// about every room.
const DISCLAIMER = "Computed for flat glass in this room; manufacturer lamp data, not measured"
// G1: the floor's soft patch per lamp (each lamp's own lobe of the chosen eye height's zone,
// drawn twice: its rows, and its rows widened by a feather, so the edge is soft), how far a
// frame may lean forward, and the warning fill's flash (alpha between these, at this rate).
const LOBE_FEATHER_CM = 4
const LOBE_ALPHA_SCALE = 0.45
export const FRAME_LEAN_MAX_DEG = 15
// U1b item 5: each lamp's beam angle (its axis from the horizontal), shown live under its aim
// handle. CCI Notes 2/3 (Track Lighting) aims the beam at 60 deg to the horizontal; steeper than
// that the label turns amber: frame shadows and exaggerated texture, the trade-off ERCO describes
// for lights under 30 deg from vertical.
export const CCI_BEAM_DEG = 60
const BEAM_LABEL_BELOW_CM = 9 // under the aim handle's knob
const BEAM_LABEL_OK = new vec4(1, 1, 1, 0.9)
const BEAM_LABEL_WARN = new vec4(1.0, 0.6, 0.05, 1)
const OVERLAP_FLASH_MIN = 0.72
const OVERLAP_FLASH_MAX = 0.95
const OVERLAP_FLASH_HZ = 1.25
// The clear cue's volume: a quiet confirmation (the WAV itself is peak-normalized).
const CLEAR_CUE_VOLUME = 0.35

// Sources: 160 cm is CCI Notes 2/3's "typical adult eye level" behind D = (H - 160) x 0.577;
// 109 cm (adult wheelchair user) and 104 cm (6-to-9-year-old wheelchair user, about 1036 mm)
// are from the Smithsonian Guidelines for Accessible Exhibition Design.
const SHEET_SOURCES = "Eyes: 160 CCI Notes 2/3; 109, 104 Smithsonian"
// The fixture (B3): TSLight RXT13 photometry from its specification sheet (GlareMath FIXTURES).
const SHEET_FIXTURE = `${G.FIXTURE_NAME}, manufacturer data, not measured`
const SHEET_SMALL_LINES = 2

/**
 * Glare Zone: a practice gallery wall with one glazed print and two ceiling track lights.
 * Slide, tilt and dim the lights; the Lens draws where each eye height sees the lights'
 * reflection in the glass (floor zones), states the answer for the chosen eye height,
 * shows a labelled glare spot when you stand in a zone, an amber glow over 50 lux with
 * "Paper art" on, and saves results per light.
 * All of it is computed geometry (see GlareMath.ts), labelled as computed.
 */
@component
export class GlareZoneController extends BaseScriptComponent {
  @input
  @hint("The Specs camera. Its position is the eye the glare is computed for.")
  cameraObject!: SceneObject

  @input
  @hint("Unlit material, cloned and tinted for every surface the Lens draws.")
  baseMaterial!: Material

  readonly lights: G.Light[] = []
  private eyeHeightCm = G.EYE_STANDING_CM
  private worksOnPaper = false
  private viewingNearCm = G.VIEWING_NEAR_CM
  private viewingFarCm = G.VIEWING_FAR_CM

  private gallery!: SceneObject
  private wall!: SceneObject
  private floor!: SceneObject
  private ui!: GlareZoneUI
  private zoneMeshes: {[k: string]: DynamicMesh} = {}
  private zoneMats: {[k: string]: Material} = {}
  private zoneLabels: {[k: string]: Text} = {}
  private zoneRows: {[k: string]: G.ZoneRow[]} = {}
  // Eye heights whose zone cannot be computed (a light with a broken value): read as glare.
  private zoneBad: {[k: string]: boolean} = {}
  // Fixed meshes by name (the first of each name), for the real-scale check (item 6b).
  private drawnMeshes: {[k: string]: DynamicMesh} = {}
  private ringMeshes: {[k: string]: DynamicMesh} = {}
  private ringMats: {[k: string]: Material} = {}
  private ringProgressMesh!: DynamicMesh
  private ringKey = ""
  private ringSince = 0
  private ringFired = false
  private ringShown = -1
  private bandMats: {[k: string]: Material} = {}
  private amberMesh!: DynamicMesh
  private spotOuter!: DynamicMesh
  private spotInner!: DynamicMesh
  private spotLabels: Text[] = []
  private beamMeshes: DynamicMesh[] = []
  private handleLines: DynamicMesh[] = []
  private fixtures: SceneObject[] = []
  private knobs: DragKnob[] = []
  private viewingMesh!: DynamicMesh
  private viewingFill!: DynamicMesh
  private nearEdgeMesh!: DynamicMesh
  private viewingLabel!: Text
  private overlapMesh!: DynamicMesh
  private overlapRowsNow: G.ZoneRow[] = []
  private statusLabel!: Text
  private edgeKnobObjects: SceneObject[] = []
  private edgeAccum = [0, 0]
  private dirty = true
  // Per-frame rebuild bookkeeping (BUILD_LOG B1): the overlap waits for the batch, and each
  // light's beam is rebuilt only when its inputs change.
  private deferOverlap = false
  private overlapPending = false
  private lightBuilt: string[] = []
  private fixture: G.Fixture = G.DEFAULT_FIXTURE
  // Suggest a setback (B5): solved when a move settles and its inputs changed.
  private setbackMarkers: DynamicMesh[] = []
  private setbackLabelText!: Text
  private setbackInputs = ""
  private setbackAimInputs = ""
  private setbackCm: number | null = null
  private setbackFrom = 0
  private setbackSolveMsLast = 0
  private lastVerdict: "clear" | "glare" = "glare"
  private lastAdjustTime = -100
  private glarePoints: G.V3[] = []
  private ghostRoot!: SceneObject
  private ghostLamps: DynamicMesh[] = []
  private ghostRays: DynamicMesh[] = []
  private ghostMats: {mat: Material; alpha: number}[] = []
  private ghostLabel!: Text
  private ghostAlpha = 0
  private amberCells = 0
  private placed = false
  private eyePreset: EyePreset = "standing"
  private myEyeHeightCm = G.EYE_STANDING_CM

  // View-anchored near panels.
  private anchor!: SceneObject
  private answerCard!: SceneObject
  private controlsPanel!: SceneObject
  private headline!: Text
  private verdictLine!: Text
  private disclaimer!: Text
  private versionLabel!: Text
  private legend!: SceneObject
  private legendViewing!: DynamicMesh
  private legendWall!: DynamicMesh
  private legendFooter!: SceneObject
  private legendLaneTexts: {[k: string]: Text} = {}
  private legendBars: {[k: string]: DynamicMesh} = {}
  private legendViewingLabel!: Text
  private resultsHost!: SceneObject
  private cards: (SceneObject | null)[] = [null, null]
  private cardTexts: string[] = ["", ""]
  private answerBacking!: SceneObject
  private answerPlate!: BackPlate
  private panelsBelow = false
  // Lazy follow state, gallery-local: where the near panels' eye point is, and their scale.
  // yaw: the direction the panels face, gallery-local (0 = facing the wall); set by a recall.
  private follow = {x: 0, z: LAYOUT.startDistanceCm, s: 1, yaw: 0, vx: 0, vz: 0, vs: 0, moving: false}
  private morePanel!: SceneObject
  private menu!: GlareHandMenu
  private placer!: GlareWallPlacer
  // How the practice wall was last placed: "front" (Place in front of me, and the start) or
  // "wall" (a World Query wall hit), with the hit and the distance from the eye at the time.
  private placement: Placement = {kind: "front", distanceCm: LAYOUT.startDistanceCm, hit: null, normal: null}
  // The session log: one GLARE_LOG line per light move. A move opens at the first change and
  // closes when adjusting settles (no knob held, ADJUST_HOLD_S since the last change); then
  // each light whose distance or tilt changed since its last line gets one line.
  private logSeq = 0
  private logBuffer: string[] = []
  private loggedLights: {d: number; t: number}[] = []
  private moveOpen = false
  private moveStartEnds: {[k: string]: number} = {}
  // The "All three: clear" cue (seventh note): a soft two-bell tone made with CLAD's build-sfx
  // (Assets/GeneratedSFX/all_three_clear.wav), played once on the frame the answer card turns clear.
  private clearCue: AudioComponent | null = null
  private cueVerdict: "clear" | "glare" | "" = ""
  private cueStats = {plays: 0, playFrame: -1, clearFrame: -1, playingAtPlay: false}
  private frameNo = 0
  // G1: the model's room. The 3D footprint (each lamp mirrored through the glass plane, which
  // may lean forward) is on; setFootprint3D(false) goes back to the side-view reference.
  private room: G.Room = {...G.DEFAULT_ROOM, footprint: "3d", leanDeg: 0}
  private printObj!: SceneObject
  private lobeMeshes: DynamicMesh[] = []
  private lobeMats: Material[] = []
  private lobeRowsChosen: G.ZoneRow[][] = []
  private overlapMat!: Material
  private beamLabels: Text[] = []
  private beamAngles: number[] = []
  // G2: the wheelchair coverage estimate on the answer card (solved when a change settles).
  private wheelchairLine!: Text
  private wheelchairInputs = ""
  private wheelchairNow: {share: number; boundaryCm: number} | null = null

  onAwake(): void {
    print(`Lens Opened: ${LENS_VERSION}`)
    const D0 = G.standardPlacementCm()
    const tilt0 = G.tiltForAim(50, D0, 150)
    const f = G.DEFAULT_FIXTURE
    this.lights.push({xCm: -50, distanceCm: D0, tiltDeg: tilt0, dimmer: 1, beamDeg: f.beamDeg, candela: f.candela})
    this.lights.push({xCm: 50, distanceCm: D0, tiltDeg: tilt0, dimmer: 1, beamDeg: f.beamDeg, candela: f.candela})
    this.loggedLights = this.lights.map((l) => ({d: l.distanceCm, t: l.tiltDeg}))
    this.buildGallery()
    this.createEvent("OnStartEvent").bind(() => {
      this.placeInFront(LAYOUT.startDistanceCm)
      this.wireUi()
    })
    this.createEvent("UpdateEvent").bind(() => this.onUpdate())
  }

  // ===================================================================== public API
  // Used by the controls and by the LEAF scenarios.

  /** Fixed eye height: move the practice floor so the camera sits exactly at it. */
  setEyeHeight(heightCm: number): void {
    this.eyeHeightCm = heightCm
    const fixed = EYES.filter((e) => e.heightCm === heightCm)[0]
    this.eyePreset = fixed ? fixed.key : this.eyePreset
    if (this.placed) {
      const camLocal = this.eyeLocal()
      const pos = this.gallery.getTransform().getWorldPosition()
      this.gallery.getTransform().setWorldPosition(new vec3(pos.x, pos.y + (camLocal.y - heightCm), pos.z))
    }
    this.placeAnchor()
    this.applyPanelLayout()
    this.dirty = true
    if (this.ui) this.ui.setEyeHeightName(this.presetName(this.eyePreset))
  }

  /** Choose a preset. "my" keeps the floor where it is and follows the real eye height. */
  setEyePreset(preset: EyePreset): void {
    if (preset === "my") {
      // Put the practice floor back where it started (your eyes at the standing 160 cm),
      // then follow the real eye height: crouch (Q in Interactive Preview) and the zone moves.
      this.setEyeHeight(G.EYE_STANDING_CM)
      this.eyePreset = "my"
      if (this.placed) this.myEyeHeightCm = this.eyeLocal().y
      this.eyeHeightCm = this.myEyeHeightCm
      this.placeAnchor()
      this.applyPanelLayout()
      this.dirty = true
      if (this.ui) this.ui.setEyeHeightName(MY_EYES_LABEL)
      return
    }
    this.setEyeHeight(EYES.filter((e) => e.key === preset)[0].heightCm)
  }

  /** The "Eye height" button: Standing, Seated, Child seated, My eyes, then round again. */
  cycleEyePreset(): void {
    const i = PRESET_ORDER.indexOf(this.eyePreset)
    this.setEyePreset(PRESET_ORDER[(i + 1) % PRESET_ORDER.length])
  }

  getEyePreset(): EyePreset {
    return this.eyePreset
  }

  getEyeHeight(): number {
    return this.eyePreset === "my" ? this.myEyeHeightCm : this.eyeHeightCm
  }

  private presetName(p: EyePreset): string {
    if (p === "my") return MY_EYES_LABEL
    return EYES.filter((e) => e.key === p)[0].label
  }

  setLightDistance(light: number, cm: number): void {
    this.lights[light].distanceCm = G.clamp(cm, G.TRACK_MIN_CM, G.TRACK_MAX_CM)
    this.markAdjusted()
    const d = this.lights[light].distanceCm
    if (this.ui && Number.isFinite(d)) this.ui.setDistance(light, d)
  }

  setLightTilt(light: number, tiltDeg: number): void {
    this.lights[light].tiltDeg = G.clamp(tiltDeg, 2, 80)
    this.markAdjusted()
  }

  setDimmer(light: number, value: number): void {
    this.lights[light].dimmer = G.clamp(value, 0, 1)
    this.dirty = true
    if (this.ui) this.ui.setDimmer(light, this.lights[light].dimmer)
  }

  /** "Paper art" (50 lux limit): works on paper (prints, drawings, watercolours). */
  setWorksOnPaper(on: boolean): void {
    this.worksOnPaper = on
    this.dirty = true
    if (this.ui) this.ui.setPaperArt(on)
  }

  setMoreOpen(open: boolean): void {
    if (this.ui) this.ui.setMoreOpen(open)
    this.applyPanelLayout()
  }

  isMoreOpen(): boolean {
    return this.ui ? this.ui.isMoreOpen() : false
  }

  isResultsMode(): boolean {
    return this.ui ? this.ui.isResultsMode() : false
  }

  /** "Done": close the results and keep the lights as they are. */
  closeLightSheets(): void {
    this.clearCards()
    this.ui.setResultsMode(false)
    this.applyPanelLayout()
  }

  /** "Restart": lights back to the standard placement, results closed. */
  restart(): void {
    const D0 = G.standardPlacementCm()
    const tilt0 = G.tiltForAim(50, D0, 150)
    for (let i = 0; i < this.lights.length; i++) {
      this.setLightDistance(i, D0)
      this.setLightTilt(i, tilt0)
      this.setDimmer(i, 1)
    }
    this.setReflector(G.DEFAULT_FIXTURE)
    this.closeLightSheets()
  }

  /**
   * The lights' reflector (B3): the TSLight RXT13's 40 deg reflector (default, 2,700 cd) or
   * its 20 deg one (5,000 cd). Both lights take it; their zones and light levels follow.
   */
  setReflector(f: G.Fixture): void {
    this.fixture = f
    for (const l of this.lights) {
      l.beamDeg = f.beamDeg
      l.candela = f.candela
    }
    if (this.ui) this.ui.setReflector(f !== G.DEFAULT_FIXTURE, f.reflector)
    this.markAdjusted()
  }

  /** The reflector in use. */
  reflector(): G.Fixture {
    return this.fixture
  }

  /** The Reflector button's hint as shown ("40 deg"), "" while More controls are closed. */
  reflectorHint(): string {
    return this.ui ? this.ui.reflectorHintText() : ""
  }

  setViewingArea(nearCm: number, farCm: number): void {
    this.viewingNearCm = G.clamp(nearCm, 0, farCm - EDGE_SNAP_CM)
    this.viewingFarCm = Math.max(farCm, this.viewingNearCm + EDGE_SNAP_CM)
    this.dirty = true
  }

  /** G1: the 3D footprint on (the default) or off (the side-view reference). */
  setFootprint3D(on: boolean): void {
    this.room = {...this.room, footprint: on ? "3d" : "2d"}
    this.dirty = true
  }

  footprint3D(): boolean {
    return this.room.footprint === "3d"
  }

  /** G1: the frame's forward lean (deg, 0 to FRAME_LEAN_MAX_DEG); the print turns about the glass's bottom edge. */
  setFrameLeanDeg(deg: number): void {
    const lean = G.clamp(Number.isFinite(deg) ? deg : 0, 0, FRAME_LEAN_MAX_DEG)
    this.room = {...this.room, leanDeg: lean}
    const r = quat.angleAxis((lean * Math.PI) / 180, vec3.right())
    const pivot = new vec3(0, G.GLASS_BOTTOM_CM, 0)
    const t = this.printObj.getTransform()
    t.setLocalRotation(r)
    t.setLocalPosition(pivot.sub(r.multiplyVec3(pivot)))
    this.glarePoints = []
    this.dirty = true
  }

  frameLeanDeg(): number {
    return this.room.leanDeg ?? 0
  }

  /** The model's room as the zones use it (a copy). */
  modelRoom(): G.Room {
    return {...this.room}
  }

  /** G1: each lamp's own rows (its lobe) for the chosen eye height, as drawn. */
  lobeRows(): G.ZoneRow[][] {
    return this.lobeRowsChosen.map((r) => r.slice())
  }

  /** G1: how many rectangles each lamp's soft patch draws (0 when hidden). */
  lobePatchCounts(): number[] {
    return this.lobeMeshes.map((m) => (m.visual.enabled ? m.count : 0))
  }

  /** G1: the warning fill's alpha now (it flashes while it shows). */
  overlapAlpha(): number {
    return this.overlapMat.mainPass.baseColor.w
  }

  /** G1: the print's lean as drawn: the angle its up direction turned toward the room (deg). */
  printLeanDeg(): number {
    const up = this.printObj.getTransform().getLocalRotation().multiplyVec3(vec3.up())
    return (Math.atan2(up.z, up.y) * 180) / Math.PI
  }

  getViewingArea(): G.Interval {
    return {min: this.viewingNearCm, max: this.viewingFarCm}
  }

  /** "Save results": a results card for each light (replacing any earlier card). */
  saveLightSheets(): void {
    for (let i = 0; i < this.lights.length; i++) this.showCard(i, this.sheetLines(i), SHEET_SMALL_LINES)
    this.ui.setResultsMode(true)
    this.applyPanelLayout()
  }

  sheetLines(light: number): string[] {
    const l = this.lights[light]
    const lines = [
      `Light ${light === 0 ? "L" : "R"} results (computed)`,
      `Tilt ${G.oneDecimal(l.tiltDeg)} deg from vertical`,
      `Distance from wall ${G.oneDecimal(l.distanceCm)} cm`,
      `Dimmer ${Math.round(l.dimmer * 100)}%, reflector ${this.fixture.reflector}`,
    ]
    for (const eye of EYES) {
      if (!G.lightComputable(l)) {
        lines.push(`${eye.label}, eyes ${eye.heightCm} cm: FAIL, cannot be computed`)
        continue
      }
      const pass = G.passesViewingArea(l, eye.heightCm, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth, this.room)
      const depth = G.zoneDepthFor(l, eye.heightCm, this.room)
      const reach = depth ? `glare to ${G.oneDecimal(depth.max)} cm` : "no glare"
      lines.push(`${eye.label}, eyes ${eye.heightCm} cm: ${pass ? "PASS" : "FAIL"}, ${reach}`)
    }
    lines.push(SHEET_FIXTURE)
    lines.push(SHEET_SOURCES)
    return lines
  }

  cardText(light: number): string {
    return this.cards[light] ? this.cardTexts[light] : ""
  }

  cardCount(): number {
    let n = 0
    for (const c of this.cards) if (c) n++
    return n
  }

  /** Far edge of an eye height's combined floor zone, in cm from the wall (0 = no zone). */
  zoneFarEdgeCm(key: ZoneKey): number {
    return G.zoneFarEdge(this.zoneRows[key] || [])
  }

  /** Near edge of an eye height's combined floor zone (0 = starts at the wall). */
  zoneNearEdgeCm(key: ZoneKey): number {
    const rows = this.zoneRows[key] || []
    let near = rows.length > 0 ? Number.POSITIVE_INFINITY : 0
    for (const r of rows) near = Math.min(near, r.z0)
    return near
  }

  zoneQuadCount(key: ZoneKey): number {
    return this.zoneMeshes[key] ? this.zoneMeshes[key].count : 0
  }

  /** The eye height whose zone the floor shows filled (the others are outlines). */
  chosenZone(): ZoneKey {
    return this.eyePreset
  }

  /** True when this zone is drawn filled on the floor, false when it is a faint outline. */
  zoneFilled(key: ZoneKey): boolean {
    return key === this.chosenZone()
  }

  /** The zone's draw order on the floor (the chosen zone above the outlines). */
  zoneRenderOrder(key: ZoneKey): number {
    return this.zoneMeshes[key] ? this.zoneMeshes[key].visual.getRenderOrder() : -1
  }

  /** True while the warning fill (the chosen zone inside the viewing area) is drawn. */
  overlapVisible(): boolean {
    return this.overlapMesh.visual.enabled && this.overlapMesh.count > 0 && this.overlapMesh.sceneObject.isEnabledInHierarchy
  }

  /** Near and far edge of the drawn warning fill, cm from the wall (0, 0 when none). */
  overlapDepth(): G.Interval {
    if (this.overlapRowsNow.length === 0) return {min: 0, max: 0}
    let n = Number.POSITIVE_INFINITY
    for (const r of this.overlapRowsNow) n = Math.min(n, r.z0)
    return {min: n, max: G.zoneFarEdge(this.overlapRowsNow)}
  }

  overlapColor(): vec4 {
    return this.overlapMesh.visual.mainMaterial.mainPass.baseColor
  }

  overlapRenderOrder(): number {
    return this.overlapMesh.visual.getRenderOrder()
  }

  /** The floor's status line ("Seated: glare inside the viewing area" or "Seated: clear"). */
  floorStatusText(): string {
    return this.statusLabel.getSceneObject().isEnabledInHierarchy ? this.statusLabel.text : ""
  }

  /** The label at the viewing area's bold near edge on the floor. */
  floorViewingLabelText(): string {
    return this.viewingLabel.getSceneObject().isEnabledInHierarchy ? this.viewingLabel.text : ""
  }

  /** The bold near edge strip as drawn (its quads), gallery-local cm from the wall; null when hidden. */
  nearEdgeSpan(): G.Interval | null {
    const e = this.nearEdgeMesh.visual.enabled ? this.nearEdgeMesh.extent : null
    return e ? {min: e.min.z, max: e.max.z} : null
  }

  /** The floor labels that are showing (zone reach, viewing area, status), for overlap checks. */
  floorLabels(): Text[] {
    const all = [this.viewingLabel, this.statusLabel].concat(LANES.map((k) => this.zoneLabels[k]))
    return all.filter((t) => t.getSceneObject().isEnabledInHierarchy)
  }

  /** The viewing area's filled band as drawn (its quads; the floor sits at the gallery origin), cm; null when hidden. */
  viewingFillExtent(): {x0: number; x1: number; z0: number; z1: number} | null {
    const e = this.viewingFill.visual.enabled && this.viewingFill.sceneObject.isEnabledInHierarchy ? this.viewingFill.extent : null
    return e ? {x0: e.min.x, x1: e.max.x, z0: e.min.z, z1: e.max.z} : null
  }

  /** Floor area of an eye height's combined zone as drawn, in cm squared. */
  zoneAreaCm2(key: ZoneKey): number {
    let area = 0
    for (const r of this.zoneRows[key] || []) area += (r.xMax - r.xMin) * (r.z1 - r.z0)
    return area
  }

  zoneVisible(key: ZoneKey): boolean {
    const m = this.zoneMeshes[key]
    return !!m && m.visual.enabled && m.sceneObject.isEnabledInHierarchy
  }

  /** The legend line for an eye height ("" when the line is hidden). */
  mapLaneText(key: ZoneKey): string {
    const t = this.legendLaneTexts[key]
    return t && t.getSceneObject().isEnabledInHierarchy ? t.text : ""
  }

  /** The legend line's Text, for the in-view checks. */
  mapLaneTextComponent(key: ZoneKey): Text {
    return this.legendLaneTexts[key]
  }

  /** True while the legend (with its small floor map) is shown. */
  mapVisible(): boolean {
    return this.legend.isEnabledInHierarchy
  }

  viewingLabelText(): string {
    return this.legendViewingLabel.getSceneObject().isEnabledInHierarchy ? this.legendViewingLabel.text : ""
  }

  headlineText(): string {
    return this.headline.getSceneObject().isEnabledInHierarchy ? this.headline.text : ""
  }

  headlineComponent(): Text {
    return this.headline
  }

  disclaimerText(): string {
    return this.disclaimer.getSceneObject().isEnabledInHierarchy ? this.disclaimer.text : ""
  }

  disclaimerComponent(): Text {
    return this.disclaimer
  }

  versionText(): string {
    return this.versionLabel.getSceneObject().isEnabledInHierarchy ? this.versionLabel.text : ""
  }

  /** The answer card and the controls panel (both about 1 m from the start position). */
  answerCardObject(): SceneObject {
    return this.answerCard
  }

  controlsPanelObject(): SceneObject {
    return this.controlsPanel
  }

  /** The answer card's corners in world space (its backing panel). */
  answerCardCorners(): vec3[] {
    const t = this.answerCard.getTransform()
    const w = LAYOUT.answerWidth / 2
    const h = LAYOUT.answerHeight / 2
    return [new vec3(-w, -h, 0), new vec3(w, -h, 0), new vec3(w, h, 0), new vec3(-w, h, 0)].map((p) =>
      t.getWorldTransform().multiplyPoint(p))
  }

  zoneLabelText(key: ZoneKey): string {
    const t = this.zoneLabels[key]
    return t && t.getSceneObject().isEnabledInHierarchy ? t.text : ""
  }

  zoneAlpha(key: ZoneKey): number {
    return this.zoneMats[key] ? this.zoneMats[key].mainPass.baseColor.w : 0
  }

  /** The eye-height marks on the wall: their opacity right now. */
  bandAlpha(key: EyeKey): number {
    return this.bandMats[key] ? this.bandMats[key].mainPass.baseColor.w : 0
  }

  glareSpotVisible(): boolean {
    return this.spotInner.visual.enabled && this.spotInner.sceneObject.isEnabledInHierarchy
  }

  glareSpotPoints(): G.V3[] {
    return this.glarePoints.slice()
  }

  /** The "Seated: glare here" labels beside the glare spots that are showing. */
  spotLabelTexts(): string[] {
    return this.spotLabels.filter((t) => t.getSceneObject().isEnabledInHierarchy).map((t) => t.text)
  }

  /** Where a spot label sits, in wall-local cm (for "right beside the spot" checks). */
  spotLabelPositions(): vec3[] {
    return this.spotLabels.filter((t) => t.getSceneObject().isEnabledInHierarchy).map((t) =>
      t.getSceneObject().getTransform().getLocalPosition())
  }

  /** The amber overlay's colour (r, g, b, a). */
  amberColor(): vec4 {
    return this.amberMesh.visual.mainMaterial.mainPass.baseColor
  }

  amberCellCount(): number {
    return this.amberMesh.visual.enabled ? this.amberCells : 0
  }

  isAdjusting(): boolean {
    for (const k of this.knobs) if (k.isHeld) return true
    return getTime() - this.lastAdjustTime < ADJUST_HOLD_S
  }

  /** Each eye height's zone end, and how deep it reaches into the viewing area (null: outside). */
  eyeResults(): G.EyeResult[] {
    return EYES.map((e) => {
      const rows = this.zoneRows[e.key] || []
      const overlap = G.overlapRows(rows, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth)
      if (this.zoneBad[e.key]) return {key: e.key, endCm: Number.NaN, insideCm: null}
      return {key: e.key, endCm: G.zoneFarEdge(rows), insideCm: G.insideDepth(overlap)}
    })
  }

  /** The answer for all three eye heights: "clear" only when every zone stays out of the area. */
  verdict(): "clear" | "glare" {
    return G.overallVerdict(this.eyeResults())
  }

  /** The verdict in words: "All three: clear", or which eye heights see glare or cannot be computed. */
  verdictText(): string {
    return G.verdictText(this.eyeResults(), this.eyeNames())
  }

  /** The live "My eyes" height and its result while that preset is chosen (B7), else null. */
  private liveEye(): G.LiveEye | null {
    if (this.eyePreset !== "my") return null
    const rows = this.zoneRows["my"] || []
    const result: G.EyeResult = this.zoneBad["my"]
      ? {key: "my", endCm: Number.NaN, insideCm: null}
      : {key: "my", endCm: G.zoneFarEdge(rows),
        insideCm: G.insideDepth(G.overlapRows(rows, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth))}
    return {label: `${MY_EYES_LABEL} (${Math.round(this.myEyeHeightCm)} cm)`, h: this.myEyeHeightCm, result}
  }

  private eyeNames(): {[k: string]: string} {
    const names: {[k: string]: string} = {}
    for (const e of EYES) names[e.key] = e.label
    return names
  }

  /** True when an eye height's zone cannot be computed (it then reads as glare). */
  zoneUncomputable(key: ZoneKey): boolean {
    return !!this.zoneBad[key]
  }

  /** The session log lines written so far (the last 50), oldest first. */
  logLines(): string[] {
    return this.logBuffer.slice()
  }

  /** How many session log lines have been written since the Lens opened. */
  logCount(): number {
    return this.logSeq
  }

  /** True between a light's first change and the moment adjusting settles. */
  isMoveOpen(): boolean {
    return this.moveOpen
  }

  /** An eye height's zone end when the current move began (the end now if no move is open). */
  moveStartEnd(key: ZoneKey): number {
    return this.moveOpen && key in this.moveStartEnds ? this.moveStartEnds[key] : this.zoneFarEdgeCm(key)
  }

  /** Close the open move: one log line for each light whose distance or tilt changed. */
  private closeMove(): void {
    this.moveOpen = false
    this.rebuildLegend() // the change lines go back to the reach lines
    const eyes = this.eyeResults()
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]
      const was = this.loggedLights[i]
      if (Math.abs(l.distanceCm - was.d) < 1e-6 && Math.abs(l.tiltDeg - was.t) < 1e-6) continue
      this.loggedLights[i] = {d: l.distanceCm, t: l.tiltDeg}
      this.logSeq++
      const line = G.moveLogLine(this.logSeq, i === 0 ? "L" : "R", l.distanceCm, l.tiltDeg,
        this.viewingNearCm, this.viewingFarCm, eyes)
      this.logBuffer.push(line)
      if (this.logBuffer.length > 50) this.logBuffer.shift()
      print(line)
    }
  }

  /** The eye (camera) position in gallery-local centimetres. */
  eyeLocal(): vec3 {
    const cam = this.cameraObject.getTransform().getWorldPosition()
    return this.gallery.getTransform().getInvertedWorldTransform().multiplyPoint(cam)
  }

  galleryObject(): SceneObject {
    return this.gallery
  }

  // ------------------------------------------------------------------ wall placement

  /**
   * "Place on a wall": aim at a wall and pinch. The World Query placer runs until a wall hit
   * is placed or "Place in front of me" is chosen. False when World Query is not available.
   */
  startWallPlacement(): boolean {
    return this.placer.begin()
  }

  isPlacingOnWall(): boolean {
    return this.placer.isActive()
  }

  wallPlacer(): GlareWallPlacer {
    return this.placer
  }

  /**
   * Use a World Query hit: if its normal is near horizontal (a wall), the practice wall and
   * print go there, upright, facing the viewer, the floor still at the chosen eye height below
   * the eye. False, and nothing moves, when the hit is not a wall.
   */
  placeOnWallHit(position: vec3, normal: vec3): boolean {
    if (!P.isWallNormal(normal)) return false
    const eye = this.cameraObject.getTransform().getWorldPosition()
    this.placeGalleryAt(position.x, position.z, P.wallYaw(normal, position, eye))
    const dx = eye.x - position.x
    const dz = eye.z - position.z
    this.placement = {kind: "wall", distanceCm: Math.sqrt(dx * dx + dz * dz), hit: position, normal}
    this.placer.stop()
    return true
  }

  /**
   * "Place in front of me": the practice wall is set down once in front of the viewer,
   * facing them, between 0.5 m and 3 m away (the start uses 3 m). It stays where it is put:
   * never head-locked. Returns the distance used.
   */
  placeInFront(distanceCm: number = LAYOUT.startDistanceCm): number {
    const d = P.frontDistanceCm(distanceCm)
    const camT = this.cameraObject.getTransform()
    const view = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const yaw = P.yawFacingViewer(view.x, view.z)
    const out = quat.angleAxis(yaw, vec3.up()).multiplyVec3(vec3.forward())
    const cam = camT.getWorldPosition()
    this.placeGalleryAt(cam.x - out.x * d, cam.z - out.z * d, yaw)
    this.placement = {kind: "front", distanceCm: d, hit: null, normal: null}
    if (this.placer) this.placer.stop()
    return d
  }

  /** How the wall was last placed (for the LEAF checks). */
  placementInfo(): Placement {
    return this.placement
  }

  /** The practice wall's pose in world space: its base point, the way out of it, and its up. */
  wallPose(): {origin: vec3; out: vec3; up: vec3} {
    const t = this.gallery.getTransform()
    const r = t.getWorldRotation()
    return {origin: t.getWorldPosition(), out: r.multiplyVec3(vec3.forward()), up: r.multiplyVec3(vec3.up())}
  }

  // ===================================================================== building

  private mat(color: vec4): Material {
    return tintedMaterial(this.baseMaterial, color)
  }

  /** A flat ring (or part of one) on the floor, as quads, from angle a0 to a1 (radians). */
  private ringQuads(cx: number, cz: number, r0: number, r1: number, a0: number, a1: number, y: number): Quad[] {
    const quads: Quad[] = []
    const segs = Math.max(2, Math.ceil(((a1 - a0) / (Math.PI * 2)) * 48))
    for (let s = 0; s < segs; s++) {
      const t0 = a0 + ((a1 - a0) * s) / segs
      const t1 = a0 + ((a1 - a0) * (s + 1)) / segs
      quads.push({
        a: new vec3(cx + Math.cos(t0) * r0, y, cz + Math.sin(t0) * r0),
        b: new vec3(cx + Math.cos(t0) * r1, y, cz + Math.sin(t0) * r1),
        c: new vec3(cx + Math.cos(t1) * r1, y, cz + Math.sin(t1) * r1),
        d: new vec3(cx + Math.cos(t1) * r0, y, cz + Math.sin(t1) * r0),
      })
    }
    return quads
  }

  /** The floor rings: one per eye height, in its colour, with its name in front of it. */
  private buildRings(): void {
    EYES.forEach((e, i) => {
      const mat = this.mat(new vec4(e.color.x, e.color.y, e.color.z, 0.6))
      this.ringMats[e.key] = mat
      const m = new DynamicMesh(this.floor, `Eye height ring ${e.label}`, mat)
      m.setQuads(this.ringQuads(RING_X_CM[i], RING_Z_CM, RING_RADIUS_CM - RING_WIDTH_CM, RING_RADIUS_CM, 0, Math.PI * 2, 0.4))
      this.ringMeshes[e.key] = m
      const t = makeText(this.floor, `Eye height ring label ${e.label}`, e.label, LAYOUT.floorLabelEm * 0.7,
        new vec4(e.color.x, e.color.y, e.color.z, 1))
      this.backText(t, 1.5)
      t.setRenderOrder(FLOOR_RENDER.label)
      // In front of the ring, tilted to face the start position (eyes 160 cm up, 3 m out).
      const tilt = Math.atan2(G.EYE_STANDING_CM, LAYOUT.startDistanceCm - RING_Z_CM)
      const tr = t.getSceneObject().getTransform()
      tr.setLocalPosition(new vec3(RING_X_CM[i], 1, RING_Z_CM + RING_RADIUS_CM + 8))
      tr.setLocalRotation(quat.angleAxis(-tilt, vec3.right()))
    })
    this.ringProgressMesh = new DynamicMesh(this.floor, "Eye height ring progress", this.mat(new vec4(1, 1, 1, 0.95)))
  }

  /**
   * Standing in a ring for RING_HOLD_S switches to that eye height; stepping out first
   * cancels. A white arc fills the ring while you hold.
   */
  private updateRings(eye: vec3): void {
    let inKey = ""
    let index = -1
    EYES.forEach((e, i) => {
      const dx = eye.x - RING_X_CM[i]
      const dz = eye.z - RING_Z_CM
      if (dx * dx + dz * dz <= RING_RADIUS_CM * RING_RADIUS_CM) {
        inKey = e.key
        index = i
      }
    })
    const now = getTime()
    if (inKey !== this.ringKey) {
      this.ringKey = inKey
      this.ringSince = now
      this.ringFired = false
    }
    let progress = 0
    if (inKey !== "" && !this.ringFired) {
      progress = Math.min(1, (now - this.ringSince) / RING_HOLD_S)
      if (progress >= 1) {
        this.ringFired = true
        progress = 0
        if (this.eyePreset !== inKey) this.setEyePreset(inKey as EyePreset)
      }
    }
    const shown = Math.round(progress * 50) / 50
    if (shown !== this.ringShown) {
      this.ringShown = shown
      this.ringProgressMesh.setQuads(shown > 0 && index >= 0
        ? this.ringQuads(RING_X_CM[index], RING_Z_CM, RING_RADIUS_CM - RING_WIDTH_CM - 1, RING_RADIUS_CM + 1,
          -Math.PI / 2, -Math.PI / 2 + shown * Math.PI * 2, 0.6)
        : [])
    }
    for (const e of EYES) this.setAlpha(this.ringMats[e.key], this.eyePreset === e.key ? 0.95 : 0.5)
  }

  /** A ring's centre on the practice floor (gallery-local cm), for tests and captures. */
  ringCentre(key: ZoneKey): vec3 {
    const i = EYES.map((e) => e.key as string).indexOf(key)
    return new vec3(RING_X_CM[Math.max(0, i)], 0, RING_Z_CM)
  }

  ringRadiusCm(): number {
    return RING_RADIUS_CM
  }

  /** Which ring the eye is in ("" for none), and how far the hold has gone (0 to 1). */
  ringState(): {key: string; progress: number; fired: boolean} {
    const p = this.ringKey !== "" && !this.ringFired ? Math.min(1, (getTime() - this.ringSince) / RING_HOLD_S) : 0
    return {key: this.ringKey, progress: p, fired: this.ringFired}
  }

  ringQuadCount(key: ZoneKey): number {
    return this.ringMeshes[key] ? this.ringMeshes[key].count : 0
  }

  private staticMesh(parent: SceneObject, name: string, color: vec4, quads: Quad[], normal?: vec3): DynamicMesh {
    const m = new DynamicMesh(parent, name, this.mat(color))
    m.setQuads(quads, normal)
    if (!(name in this.drawnMeshes)) this.drawnMeshes[name] = m
    return m
  }

  /**
   * What a fixed mesh measures as drawn, in world cm along the practice wall's own axes (the
   * axes are unit length, so a scale on the scene shows in these numbers): its width along
   * the wall, its height, how high its bottom and centre sit above the practice floor, and how
   * far its front is from the wall. Null for an unknown or empty mesh.
   */
  drawnSize(name: string): {widthCm: number; heightCm: number; bottomCm: number; centreCm: number; outCm: number} | null {
    const m = this.drawnMeshes[name]
    const e = m ? m.extent : null
    if (!e) return null
    const w = m.sceneObject.getTransform().getWorldTransform()
    const pose = this.wallPose()
    const right = pose.up.cross(pose.out).normalize()
    const pts: vec3[] = []
    for (const x of [e.min.x, e.max.x]) for (const y of [e.min.y, e.max.y]) for (const z of [e.min.z, e.max.z]) {
      pts.push(w.multiplyPoint(new vec3(x, y, z)).sub(pose.origin))
    }
    const along = (axis: vec3) => {
      let lo = Number.POSITIVE_INFINITY
      let hi = Number.NEGATIVE_INFINITY
      for (const p of pts) {
        lo = Math.min(lo, p.dot(axis))
        hi = Math.max(hi, p.dot(axis))
      }
      return {lo, hi}
    }
    const x = along(right)
    const y = along(pose.up)
    const z = along(pose.out)
    return {widthCm: x.hi - x.lo, heightCm: y.hi - y.lo, bottomCm: y.lo, centreCm: (y.lo + y.hi) / 2, outCm: z.hi}
  }

  /** A track light as drawn: cm from the wall, above the practice floor and along the wall. */
  drawnLight(i: number): {outCm: number; upCm: number; sideCm: number} {
    const pose = this.wallPose()
    const right = pose.up.cross(pose.out).normalize()
    const p = this.fixtures[i].getTransform().getWorldPosition().sub(pose.origin)
    return {outCm: p.dot(pose.out), upCm: p.dot(pose.up), sideCm: p.dot(right)}
  }

  /** The eye (camera) as drawn: cm above the practice floor, in world units. */
  drawnEyeHeightCm(): number {
    const pose = this.wallPose()
    return this.cameraObject.getTransform().getWorldPosition().sub(pose.origin).dot(pose.up)
  }

  /** A light, low-opacity backing behind text that floats over the room. */
  private backText(t: Text, marginCm: number): void {
    t.backgroundSettings.enabled = true
    t.backgroundSettings.fill.color = TEXT_BACKING
    t.backgroundSettings.margins = Rect.create(marginCm, marginCm, marginCm * 0.6, marginCm * 0.6)
    t.backgroundSettings.cornerRadius = marginCm * 0.6
  }

  /** A label standing on the floor, facing the viewer (layoutFloorLabels places it). */
  private floorLabel(parent: SceneObject, name: string, color: vec4): Text {
    const t = makeText(parent, name, "", LAYOUT.floorLabelEm, color)
    this.backText(t, 1.5)
    t.setRenderOrder(FLOOR_RENDER.label) // over the floor fills and the opaque edge handles
    t.getSceneObject().enabled = false
    return t
  }

  private buildGallery(): void {
    this.gallery = global.scene.createSceneObject("Practice gallery")
    this.wall = global.scene.createSceneObject("Practice wall (stand-in)")
    this.wall.setParent(this.gallery)
    this.floor = global.scene.createSceneObject("Floor overlays")
    this.floor.setParent(this.gallery)

    // The practice wall, real size: 400 cm wide, 300 cm tall.
    this.staticMesh(this.wall, "Wall surface", new vec4(0.5, 0.48, 0.45, 0.35), [
      rectXY(0, LAYOUT.wallHeight / 2, LAYOUT.wallWidth, LAYOUT.wallHeight, -1),
    ], vec3.forward())

    // The glazed print: frame, a plain sample image and its label.
    const print = global.scene.createSceneObject("Sample print (stand-in)")
    print.setParent(this.wall)
    this.printObj = print
    this.staticMesh(print, "Frame", new vec4(0.82, 0.76, 0.62, 1), boxQuads(new vec3(0, 150, -0.2), new vec3(110, 110, 1.6)))
    this.staticMesh(print, "Mat", new vec4(0.92, 0.9, 0.86, 1), [rectXY(0, 150, 100, 100, 0.7)], vec3.forward())
    this.staticMesh(print, "Image", new vec4(0.42, 0.55, 0.68, 1), [
      rectXY(-6, 158, 64, 52, 0.8),
    ], vec3.forward())
    this.staticMesh(print, "Image accent", new vec4(0.85, 0.62, 0.42, 1), [rectXY(12, 140, 26, 20, 0.85)], vec3.forward())
    const printLabel = makeText(print, "Sample print label", "Sample print", LAYOUT.smallEm, new vec4(0.25, 0.25, 0.3, 1))
    printLabel.getSceneObject().getTransform().setLocalPosition(new vec3(0, 112, 0.9))

    // Ceiling tracks, the two track lights, their beams, and the aim handles.
    for (let i = 0; i < this.lights.length; i++) {
      const tag = i === 0 ? "L" : "R"
      const x = this.lights[i].xCm
      this.staticMesh(this.gallery, `Ceiling track ${tag}`, new vec4(0.8, 0.8, 0.82, 0.9), barQuads(
        new vec3(x, G.CEILING_CM + 3, G.TRACK_MIN_CM - 5),
        new vec3(x, G.CEILING_CM + 3, G.TRACK_MAX_CM + 5),
        2,
      ))
      const fixture = global.scene.createSceneObject(`Track light ${tag}`)
      fixture.setParent(this.gallery)
      this.staticMesh(fixture, "Body", new vec4(0.92, 0.92, 0.95, 1), boxQuads(new vec3(0, -6, 0), new vec3(9, 12, 9)))
      this.fixtures.push(fixture)
      this.beamMeshes.push(new DynamicMesh(this.gallery, `Beam ${tag}`, this.mat(new vec4(1, 0.95, 0.75, BEAM_ALPHA))))
      this.buildHandle(i)
      const marker = new DynamicMesh(this.gallery, `Setback marker ${tag}`, this.mat(SETBACK_COLOR))
      marker.visual.setRenderOrder(GHOST_RENDER_ORDER)
      this.setbackMarkers.push(marker)
    }
    this.setbackLabelText = makeText(this.gallery, "Setback label", "", LAYOUT.smallEm * 2, SETBACK_LABEL_COLOR)
    for (let i = 0; i < this.lights.length; i++) {
      const t = makeText(this.wall, `Beam angle ${i === 0 ? "L" : "R"}`, "", LAYOUT.smallEm * 0.8, BEAM_LABEL_OK)
      t.getSceneObject().enabled = false
      this.beamLabels.push(t)
      this.beamAngles.push(Number.NaN)
    }
    this.setbackLabelText.getSceneObject().enabled = false

    // Eye-height marks on the wall either side of the print, in each eye height's colour
    // (the legend on the answer card names them).
    for (const eye of EYES) {
      const mat = this.mat(new vec4(eye.color.x, eye.color.y, eye.color.z, FULL_ALPHA))
      this.bandMats[eye.key] = mat
      const m = new DynamicMesh(this.wall, `Eye-height mark ${eye.label}`, mat)
      const half = G.GLASS_HALF_WIDTH_CM + 5 // just outside the frame
      m.setQuads([
        rectXY(-half - LAYOUT.bandLength / 2, eye.heightCm, LAYOUT.bandLength, LAYOUT.bandHeight, 0.6),
        rectXY(half + LAYOUT.bandLength / 2, eye.heightCm, LAYOUT.bandLength, LAYOUT.bandHeight, 0.6),
      ], vec3.forward())
    }

    // Viewing area on the floor, always shown: a faint filled band, thin side and far edges,
    // a bold near edge, and its edge handles. Drawn first, under the zones.
    this.viewingFill = new DynamicMesh(this.floor, "Viewing area fill", this.mat(VIEWING_FILL))
    this.viewingFill.visual.setRenderOrder(FLOOR_RENDER.fill)
    this.viewingMesh = new DynamicMesh(this.floor, "Viewing area", this.mat(new vec4(1, 1, 1, 0.35)))
    this.viewingMesh.visual.setRenderOrder(FLOOR_RENDER.edge)
    this.nearEdgeMesh = new DynamicMesh(this.floor, "Viewing area near edge", this.mat(VIEWING_EDGE))
    this.nearEdgeMesh.visual.setRenderOrder(FLOOR_RENDER.edge)
    this.buildEdgeKnob(0, "Viewing area near edge handle")
    this.buildEdgeKnob(1, "Viewing area far edge handle")

    // Floor zones: the chosen eye height's zone filled, the others as faint outlines (one
    // mesh each; rebuildZone picks fill or outline). "My eyes" only while that preset is chosen.
    const order: ZoneKey[] = ["child", "seated", "standing", "my"]
    order.forEach((key) => {
      const name = this.zoneName(key)
      const color = this.zoneColor(key)
      const mat = this.mat(new vec4(color.x, color.y, color.z, FULL_ALPHA))
      this.zoneMats[key] = mat
      const zoneObj = global.scene.createSceneObject(`Floor zone ${name}`)
      zoneObj.setParent(this.floor)
      zoneObj.getTransform().setLocalPosition(new vec3(0, 0.5, 0))
      this.zoneMeshes[key] = new DynamicMesh(zoneObj, "Zone mesh", mat)
      const label = this.floorLabel(zoneObj, `Zone label ${name}`, new vec4(color.x, color.y, color.z, 1))
      this.zoneLabels[key] = label
    })

    // Where the chosen zone reaches into the viewing area: a bright warning fill and a status
    // line ("Seated: glare inside the viewing area", or "Seated: clear").
    // G1: a soft patch per lamp for the chosen eye height, under its zone.
    for (let i = 0; i < this.lights.length; i++) {
      const mat = this.mat(new vec4(1, 1, 1, 0.2))
      this.lobeMats.push(mat)
      const lobe = new DynamicMesh(this.floor, `Lamp patch ${i === 0 ? "L" : "R"}`, mat)
      lobe.sceneObject.getTransform().setLocalPosition(new vec3(0, 0.4, 0))
      lobe.visual.setRenderOrder(FLOOR_RENDER.outline)
      this.lobeMeshes.push(lobe)
    }
    this.overlapMesh = new DynamicMesh(this.floor, "Glare inside the viewing area", this.mat(OVERLAP_COLOR))
    this.overlapMat = this.overlapMesh.visual.mainMaterial
    this.overlapMesh.visual.setRenderOrder(FLOOR_RENDER.overlap)
    this.overlapMesh.sceneObject.getTransform().setLocalPosition(new vec3(0, 0.7, 0))
    this.statusLabel = this.floorLabel(this.floor, "Floor status label", OVERLAP_TEXT)
    this.buildRings()
    this.viewingLabel = this.floorLabel(this.floor, "Viewing area label", new vec4(1, 1, 1, 0.95))

    // Overlays on the glass: amber light-limit cells, the glare spot and its labels.
    // On the print, so the cells lean with its glass (G1).
    this.amberMesh = new DynamicMesh(this.printObj, "Amber over 50 lux", this.mat(AMBER))
    // A warm halo so the spot still reads against the light mat in the preview.
    this.spotOuter = new DynamicMesh(this.wall, "Glare spot halo", this.mat(new vec4(1, 0.78, 0.3, 0.75)))
    this.spotInner = new DynamicMesh(this.wall, "Glare spot", this.mat(new vec4(1, 1, 0.97, 0.95)))
    for (let i = 0; i < this.lights.length; i++) {
      const t = makeText(this.wall, `Glare spot label ${i === 0 ? "L" : "R"}`, "", LAYOUT.spotLabelEm,
        new vec4(1, 1, 1, 1), HorizontalAlignment.Center)
      t.layoutRect = Rect.create(-15, 15, -LAYOUT.spotLabelEm, LAYOUT.spotLabelEm)
      ;(t as Text & {weight?: number}).weight = 700
      t.backgroundSettings.enabled = true
      t.backgroundSettings.fill.color = new vec4(0.25, 0.2, 0.12, 0.55) // over the light mat, a warm dark backing reads
      t.backgroundSettings.margins = Rect.create(0.6, 0.6, 0.35, 0.35)
      t.backgroundSettings.cornerRadius = 0.4
      // Text writes no depth, so without this the opaque print can draw over it. The label
      // sits on the glass at the print's own depth (not far content), so a small order is safe.
      t.setRenderOrder(SPOT_LABEL_RENDER_ORDER)
      t.getSceneObject().enabled = false
      this.spotLabels.push(t)
    }

    // Ghost lamp construction: the lamp mirrored behind the wall, and the lamp's own ray
    // down to the glare spot (lamp to glass to you).
    this.ghostRoot = global.scene.createSceneObject("Reflection construction")
    this.ghostRoot.setParent(this.gallery)
    for (let i = 0; i < this.lights.length; i++) {
      const tag = i === 0 ? "L" : "R"
      const lampMat = this.mat(new vec4(1, 0.95, 0.8, GHOST_ALPHA))
      const rayMat = this.mat(new vec4(1, 0.72, 0.25, LAMP_RAY_ALPHA))
      // The ghost lamp is behind the print it reflects in, so a depth-tested lamp is
      // hidden by the print by construction: it is drawn without depth testing, late.
      lampMat.mainPass.depthTest = false
      this.ghostMats.push({mat: lampMat, alpha: GHOST_ALPHA}, {mat: rayMat, alpha: LAMP_RAY_ALPHA})
      const lampMesh = new DynamicMesh(this.ghostRoot, `Ghost lamp ${tag}`, lampMat)
      lampMesh.visual.setRenderOrder(GHOST_RENDER_ORDER)
      // The ray lies in front of the wall, so it keeps the depth test and default order.
      const rayMesh = new DynamicMesh(this.ghostRoot, `Reflection ray ${tag}`, rayMat)
      this.ghostLamps.push(lampMesh)
      this.ghostRays.push(rayMesh)
    }
    this.ghostLabel = makeText(this.ghostRoot, "Reflection label", "reflection", LAYOUT.smallEm * 2, new vec4(1, 0.95, 0.8, GHOST_LABEL_ALPHA))
    this.ghostLabel.depthTest = false
    this.ghostRoot.enabled = false

    this.buildNearPanels()
  }

  private zoneName(key: ZoneKey): string {
    return key === "my" ? MY_EYES_LABEL : EYES.filter((e) => e.key === key)[0].label
  }

  private zoneColor(key: ZoneKey): vec3 {
    return key === "my" ? MY_EYES_COLOR : EYES.filter((e) => e.key === key)[0].color
  }

  private zoneHeight(key: ZoneKey): number {
    return key === "my" ? this.myEyeHeightCm : EYES.filter((e) => e.key === key)[0].heightCm
  }

  // ===================================================================== near panels

  /**
   * The answer card (above the eye line) and the controls (below it), about 1 m in front
   * of the start position, anchored to the eye height so both stay in view at every
   * eye-height preset. Each panel is tilted to face the eye.
   */
  private buildNearPanels(): void {
    this.anchor = global.scene.createSceneObject("Near panels (eye-anchored)")
    this.anchor.setParent(this.gallery)
    const d = LAYOUT.panelDistanceCm

    this.answerCard = global.scene.createSceneObject("Answer card")
    this.answerCard.setParent(this.anchor)
    this.answerCard.getTransform().setLocalPosition(new vec3(0, LAYOUT.answerY, -d))
    this.answerCard.getTransform().setLocalRotation(quat.angleAxis(Math.atan2(LAYOUT.answerY, d), vec3.right()))
    this.buildAnswerCard()
    this.buildClearCue()

    this.controlsPanel = global.scene.createSceneObject("Near controls")
    this.controlsPanel.setParent(this.anchor)
    this.controlsPanel.getTransform().setLocalPosition(new vec3(0, LAYOUT.controlsY, -d))
    this.controlsPanel.getTransform().setLocalRotation(quat.angleAxis(Math.atan2(LAYOUT.controlsY, d), vec3.right()))
    this.ui = this.controlsPanel.createComponent(GlareZoneUI.getTypeName()) as GlareZoneUI
    this.ui.setDistanceRange(G.TRACK_MIN_CM, G.TRACK_MAX_CM)

    // "More controls" on a panel of their own: above the buttons when the card is above the
    // print, above the card when the card is under the print, so the legend never hides.
    this.morePanel = global.scene.createSceneObject("More controls panel")
    this.morePanel.setParent(this.anchor)
    this.morePanel.createComponent("Component.Canvas")
    this.ui.moreGroupObject().setParent(this.morePanel)

    // One plain control to recall the panels: "Bring panels here" above the left palm.
    const menuObj = global.scene.createSceneObject("Hand menu")
    this.menu = menuObj.createComponent(GlareHandMenu.getTypeName()) as GlareHandMenu
    this.menu.cameraObject = this.cameraObject
    this.menu.onRecall.add(() => this.recallPanels())
    this.menu.onPlaceFront.add(() => this.placeInFront(LAYOUT.startDistanceCm))
    this.menu.onPlaceWall.add(() => this.startWallPlacement())

    // "Place on a wall": World Query hit tests along the aim ray; a pinch places the wall.
    const placerObj = global.scene.createSceneObject("Wall placer")
    this.placer = placerObj.createComponent(GlareWallPlacer.getTypeName()) as GlareWallPlacer
    this.placer.cameraObject = this.cameraObject
    this.placer.baseMaterial = this.baseMaterial
    this.placer.onPlace.add((h: WallHit) => this.placeOnWallHit(h.position, h.normal))

    this.placeAnchor()
    this.applyPanelLayout()
  }

  /** The palm-up hand menu ("Bring panels here"). */
  handMenu(): GlareHandMenu {
    return this.menu
  }

  /**
   * Put the near panels at the eye height (live for "My eyes") and at the lazy-follow
   * position and scale. The anchor sits at the followed eye point; the panels hang 1 m in
   * front of it, so scaling the anchor brings them nearer at the same angular size.
   */
  private placeAnchor(): void {
    if (!this.anchor) return
    const t = this.anchor.getTransform()
    t.setLocalPosition(new vec3(this.follow.x, this.getEyeHeight(), this.follow.z))
    t.setLocalRotation(quat.angleAxis(this.follow.yaw, vec3.up()))
    t.setLocalScale(vec3.one().uniformScale(this.follow.s))
    this.updateColumnGaps()
    this.layoutFloorLabels()
  }

  /**
   * Open each More column where its aim handle appears from the panels' eye point: project
   * the handle's knob (top and bottom) onto the columns' plane and leave that gap, plus
   * LAYOUT.handleClearCm either side, between the dimmer cell and the distance cell.
   */
  private updateColumnGaps(): void {
    if (!this.ui || !this.morePanel || !this.wall) return
    const L = LAYOUT
    const inv = this.morePanel.getTransform().getInvertedWorldTransform()
    const e = inv.multiplyPoint(this.anchor.getTransform().getWorldPosition())
    const w = this.wall.getTransform().getWorldTransform()
    const onPlane = (p: vec3): number => {
      const q = inv.multiplyPoint(w.multiplyPoint(p))
      const t = (0 - e.z) / (q.z - e.z)
      return e.y + t * (q.y - e.y)
    }
    const lo = -L.columnHeight / 2
    const hi = this.panelsBelow ? L.columnTopBelow : L.columnHeight / 2
    for (let i = 0; i < 2; i++) {
      const x = (i === 0 ? -1 : 1) * L.handleX
      const top = onPlane(new vec3(x, L.handleY + L.knobSize / 2, L.knobOut))
      const bottom = onPlane(new vec3(x, L.handleY - L.knobSize / 2, L.knobOut))
      this.ui.setColumnGap(i, (top + bottom) / 2, Math.abs(top - bottom) / 2 + L.handleClearCm, lo, hi)
    }
  }

  /** Where the near panels want to be for this eye: in front of it, and in front of the wall. */
  private panelTarget(eye: vec3, yaw: number = this.follow.yaw): {x: number; z: number; s: number} {
    const L = LAYOUT
    // How fast the panels' facing direction closes on the wall (1 when facing it square on).
    const towardWall = Math.cos(yaw)
    let s = 1
    if (towardWall > 0.05) s = (eye.z - L.panelWallClearanceCm) / (L.panelDistanceCm * towardWall)
    s = G.clamp(s, L.panelMinDistanceCm / L.panelDistanceCm, 1)
    return {x: G.clamp(eye.x, -L.viewingHalfWidth, L.viewingHalfWidth), z: eye.z, s}
  }

  /**
   * Lazy follow: nothing moves until the viewer is more than the dead zone from where the
   * panels were placed, then the panels glide to the new place with SIK's spring-damped
   * smoothDamp. Position and scale only, never the head's rotation.
   */
  private updateFollow(eye: vec3): void {
    const f = this.follow
    const t = this.panelTarget(eye)
    const off = Math.sqrt((t.x - f.x) * (t.x - f.x) + (t.z - f.z) * (t.z - f.z))
    if (!f.moving && (off > LAYOUT.followDeadZoneCm || Math.abs(t.s - f.s) > 0.1)) f.moving = true
    if (!f.moving) return
    const dt = getDeltaTime()
    const T = LAYOUT.followSmoothS
    ;[f.x, f.vx] = smoothDamp(f.x, t.x, f.vx, T, dt)
    ;[f.z, f.vz] = smoothDamp(f.z, t.z, f.vz, T, dt)
    ;[f.s, f.vs] = smoothDamp(f.s, t.s, f.vs, T, dt)
    if (off < 0.5 && Math.abs(t.s - f.s) < 0.005) {
      f.x = t.x
      f.z = t.z
      f.s = t.s
      f.vx = f.vz = f.vs = 0
      f.moving = false
    }
    this.placeAnchor()
  }

  /** "Recall" the near panels: put them in front of the viewer at once, facing the way they look. */
  recallPanels(): void {
    if (!this.placed) return
    const view = this.cameraObject.getTransform().getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    const v = this.gallery.getTransform().getWorldRotation().invert().multiplyVec3(view)
    const yaw = Math.abs(v.x) + Math.abs(v.z) > 1e-4 ? Math.atan2(-v.x, -v.z) : 0
    const t = this.panelTarget(this.eyeLocal(), yaw)
    this.follow = {x: t.x, z: t.z, s: t.s, yaw, vx: 0, vz: 0, vs: 0, moving: false}
    this.placeAnchor()
  }

  /** The near panels' follow state, for the LEAF checks: gallery-local x, z, scale and facing. */
  panelFollowState(): {x: number; z: number; s: number; yaw: number; moving: boolean} {
    const f = this.follow
    return {x: f.x, z: f.z, s: f.s, yaw: f.yaw, moving: f.moving}
  }

  /** True when the near panels use the "below the print" layout (low eyes). */
  panelsAreBelow(): boolean {
    return this.panelsBelow
  }

  /** Low eyes see the print fill the top of the view, so the panels go under it. */
  private wantPanelsBelow(): boolean {
    if (this.eyePreset === "seated" || this.eyePreset === "child") return true
    if (this.eyePreset !== "my") return false
    const h = this.myEyeHeightCm
    return this.panelsBelow ? h < LAYOUT.belowExitEyeCm : h < LAYOUT.belowEnterEyeCm
  }

  /** Answer card and controls placement for the eye height, More controls and results. */
  private applyPanelLayout(): void {
    if (!this.answerCard || !this.ui) return
    const L = LAYOUT
    const d = L.panelDistanceCm
    this.panelsBelow = this.wantPanelsBelow()
    const results = this.isResultsMode()
    const ay = this.panelsBelow ? L.answerYBelow : L.answerY
    const cy = this.panelsBelow ? L.controlsYBelow : L.controlsY
    // More controls: two columns beside the print, between the card and the buttons when the
    // card is above the print, above the card when it is under the print.
    const my = this.panelsBelow ? L.columnYBelow : L.columnYAbove
    const place = (so: SceneObject, y: number) => {
      so.getTransform().setLocalPosition(new vec3(0, y, -d))
      so.getTransform().setLocalRotation(quat.angleAxis(Math.atan2(y, d), vec3.right()))
    }
    place(this.answerCard, ay)
    place(this.controlsPanel, cy)
    place(this.morePanel, my)
    this.legend.enabled = !results && this.moveOpen
    this.sizeAnswerPlate()
    this.updateColumnGaps()
    this.layoutFloorLabels()
  }

  /** The answer card's backing corners in world space. */
  answerPlateCorners(): vec3[] {
    const t = this.answerBacking.getTransform()
    const w = LAYOUT.answerWidth / 2
    const h = this.answerPlate.size.y / 2
    return [new vec3(-w, -h, 0), new vec3(w, -h, 0), new vec3(w, h, 0), new vec3(-w, h, 0)].map((p) =>
      t.getWorldTransform().multiplyPoint(p))
  }

  /** Text on the answer card, with its layout box set to the space it may use. */
  private cardTextAt(parent: SceneObject, name: string, text: string, em: number, color: vec4,
    align: HorizontalAlignment, x: number, y: number, w: number, weight: number = 600): Text {
    const t = makeText(parent, name, text, em, color, align)
    ;(t as Text & {weight?: number}).weight = weight
    if (align === HorizontalAlignment.Left) t.layoutRect = Rect.create(0, w, -em, em)
    else if (align === HorizontalAlignment.Right) t.layoutRect = Rect.create(-w, 0, -em, em)
    else t.layoutRect = Rect.create(-w / 2, w / 2, -em, em)
    t.getSceneObject().getTransform().setLocalPosition(new vec3(x, y, 0.15))
    return t
  }

  private plotX(depthCm: number): number {
    return PLOT_X0 + (G.clamp(depthCm, 0, PLOT_RANGE_CM) / PLOT_RANGE_CM) * PLOT_W
  }

  private laneY(index: number): number {
    return LANE_Y0 - index * LANE_STEP
  }

  /**
   * The answer card: the headline answer for the chosen eye height, the disclosure, then
   * the legend (a small top-down floor map with one bar per eye height and the viewing
   * area shaded, and one plain line per eye height), or the results cards after saving.
   */
  private buildAnswerCard(): void {
    const W = LAYOUT.answerWidth
    const H = LAYOUT.answerHeight
    // Hierarchy sorting: the backing draws first and everything after it on top. Without
    // it, transparent parts sort by distance and the tilted card's lower lines (farther
    // than the backing's centre) draw under the backing.
    this.answerCard.createComponent("Component.Canvas")
    // UIKit's backing, like the controls: at the Seated and Child presets the card sits in
    // front of the bright print, where a light-tint backing gives white text no contrast.
    const backing = global.scene.createSceneObject("Answer card backing")
    backing.setParent(this.answerCard)
    backing.getTransform().setLocalPosition(new vec3(0, 0, -0.3))
    const plate = backing.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(W, H)
    this.answerBacking = backing
    this.answerPlate = plate
    const white = new vec4(1, 1, 1, 1)
    this.headline = this.cardTextAt(this.answerCard, "Headline", "", LAYOUT.headlineEm, white,
      HorizontalAlignment.Center, 0, HEADLINE_Y, W - 2, 700)
    // Item D: the answer card is one line (the chosen eye height) plus the verdict for all three.
    this.verdictLine = this.cardTextAt(this.answerCard, "Verdict", "", LAYOUT.headlineEm * 0.8, white,
      HorizontalAlignment.Center, 0, VERDICT_Y, W - 2, 700)
    // A long verdict (B7 adds a My eyes height) shrinks to fit the card instead of running past it.
    this.verdictLine.horizontalOverflow = HorizontalOverflow.Shrink
    this.disclaimer = this.cardTextAt(this.answerCard, "Disclaimer", DISCLAIMER, LAYOUT.disclaimerEm,
      new vec4(1, 1, 1, 0.85), HorizontalAlignment.Center, 0, DISCLAIMER_Y, W - 2, 500)
    this.disclaimer.horizontalOverflow = HorizontalOverflow.Shrink
    // G2: "About N% of wheelchair users see glare here (estimate)", bottom left (sizeAnswerPlate places it).
    this.wheelchairLine = this.cardTextAt(this.answerCard, "Wheelchair estimate", "", LAYOUT.versionEm,
      new vec4(1, 1, 1, 0.85), HorizontalAlignment.Left, -W / 2 + 0.7, -H / 2 + 1.1, W - 12, 500)
    this.wheelchairLine.horizontalOverflow = HorizontalOverflow.Shrink
    this.wheelchairLine.getSceneObject().enabled = false
    this.versionLabel = this.cardTextAt(this.answerCard, "Version", LENS_VERSION, LAYOUT.versionEm,
      new vec4(1, 1, 1, 0.7), HorizontalAlignment.Right, W / 2 - 0.7, -H / 2 + 1.1, 8, 500)

    this.legend = global.scene.createSceneObject("Legend")
    this.legend.setParent(this.answerCard)
    this.legendViewing = new DynamicMesh(this.legend, "Map viewing area", this.mat(VIEWING_TINT))
    this.legendWall = new DynamicMesh(this.legend, "Map wall", this.mat(new vec4(1, 1, 1, 0.95)))
    // The footer row (under the last shown line): the map's scale under the map, and the
    // viewing area in words beside a swatch of its shading.
    this.legendFooter = global.scene.createSceneObject("Legend footer")
    this.legendFooter.setParent(this.legend)
    this.cardTextAt(this.legendFooter, "Map wall label", "wall", LAYOUT.legendSmallEm, white,
      HorizontalAlignment.Left, PLOT_X0 - 0.3, 0, 4, 500)
    this.cardTextAt(this.legendFooter, "Map scale label", `${PLOT_RANGE_CM} cm`, LAYOUT.legendSmallEm, white,
      HorizontalAlignment.Right, PLOT_X0 + PLOT_W, 0, 6, 500)
    this.staticMesh(this.legendFooter, "Viewing area swatch", VIEWING_TINT,
      [rectXY(LEGEND_TEXT_X + 0.6, 0, 1.2, 1.2, 0.05)], vec3.forward())
    this.legendViewingLabel = this.cardTextAt(this.legendFooter, "Viewing area label (card)", "", LAYOUT.legendSmallEm,
      white, HorizontalAlignment.Left, LEGEND_TEXT_X + 1.7, 0, 24, 500)
    LANES.forEach((key, i) => {
      const c = this.zoneColor(key)
      this.legendBars[key] = new DynamicMesh(this.legend, `Map bar ${this.zoneName(key)}`, this.mat(new vec4(c.x, c.y, c.z, 0.9)))
      this.legendLaneTexts[key] = this.cardTextAt(this.legend, `Legend ${this.zoneName(key)}`, "", LAYOUT.legendEm,
        new vec4(c.x, c.y, c.z, 1), HorizontalAlignment.Left, LEGEND_TEXT_X, this.laneY(i), W / 2 - 0.6 - LEGEND_TEXT_X)
    })

    this.resultsHost = global.scene.createSceneObject("Results")
    this.resultsHost.setParent(this.answerCard)
  }

  /** The answer for the chosen eye height, in words. */
  private headlineFor(): string {
    const key = this.eyePreset
    const subject = key === "my"
      ? `${MY_EYES_LABEL} (${Math.round(this.myEyeHeightCm)} cm)`
      : this.zoneName(key)
    const far = this.zoneFarEdgeCm(key)
    if (this.zoneBad[key]) return `${subject}: glare cannot be computed, so not clear`
    return far > 0
      ? `${subject}: glare up to ${G.cmAndFeet(far)} from the wall`
      : `${subject}: no glare from these lights`
  }

  /**
   * While a light moves: an eye height's zone end when the move began and now, from the same
   * numbers as the zones ("Seated 73.5 to 56.4 cm").
   */
  private changeLine(key: ZoneKey): string {
    const name = key === "my" ? MY_EYES_LABEL : this.zoneName(key)
    const was = this.moveStartEnds[key]
    const from = Number.isFinite(was) ? G.oneDecimal(was) : "?"
    if (this.zoneBad[key]) return `${name} ${from} cm to cannot be computed`
    return `${name} ${from} to ${G.oneDecimal(this.zoneFarEdgeCm(key))} cm`
  }

  /** One legend line, eye height and reach with units. */
  private laneLine(key: ZoneKey): string {
    const far = this.zoneFarEdgeCm(key)
    const who = key === "my"
      ? `My eyes, at ${Math.round(this.myEyeHeightCm)} cm`
      : `${this.zoneName(key)}, eyes at ${this.zoneHeight(key)} cm`
    if (this.zoneBad[key]) return `${who}: cannot be computed (read as glare)`
    return far > 0 ? `${who}: glare up to ${G.cmAndFeet(far)} from the wall` : `${who}: no glare`
  }

  /** Bars and lines per eye height (the "My eyes" line only while that preset is chosen). */
  private rebuildLegend(): void {
    // Item D: no floor map on the card (the floor shows the zones); the per-eye-height lines
    // show only while a light moves, as each height's change (item B).
    this.legendWall.setQuads([], vec3.forward())
    this.legendViewing.setQuads([], vec3.forward())
    this.legendFooter.enabled = false
    this.legend.enabled = this.moveOpen && this.cardCount() === 0
    // U1: each glare distance once on screen. The chosen eye height's distance is the headline's,
    // so its change line is not shown; the other lines close up under the disclosure.
    const chosen = this.chosenZone()
    let row = 0
    LANES.forEach((key) => {
      this.legendBars[key].setQuads([], vec3.forward())
      const label = this.legendLaneTexts[key]
      const show = (key !== "my" || this.eyePreset === "my") && key !== chosen
      label.getSceneObject().enabled = show
      if (show) {
        label.text = this.moveOpen ? this.changeLine(key) : this.laneLine(key)
        label.getSceneObject().getTransform().setLocalPosition(new vec3(LEGEND_TEXT_X, this.laneY(row), 0.15))
        row++
      }
    })
    this.headline.text = this.headlineFor()
    const results = this.eyeResults()
    // B7: a My eyes height below 104 cm is named beside the verdict with its own answer.
    const live = this.liveEye()
    const clear = G.overallVerdictWithEye(results, live) === "clear"
    this.verdictLine.text = G.verdictTextWithEye(results, this.eyeNames(), live)
    this.verdictLine.textFill.color = clear ? new vec4(1, 1, 1, 1) : OVERLAP_TEXT
    // The clear cue: once, on the frame the card turns clear (not at launch, not while it stays clear).
    const v = clear ? "clear" : "glare"
    if (v === "clear" && this.cueVerdict === "glare") this.playClearCue()
    this.cueVerdict = v
    this.sizeAnswerPlate()
  }

  /** The clear cue's player, beside the answer card (not spatial), quiet by design. */
  private buildClearCue(): void {
    const so = global.scene.createSceneObject("Clear cue")
    so.setParent(this.anchor)
    const audio = so.createComponent("Component.AudioComponent") as AudioComponent
    try {
      audio.audioTrack = requireAsset("../GeneratedSFX/all_three_clear.wav") as AudioTrackAsset
    } catch (e) {
      print(`Clear cue: sound not loaded (${e})`)
      return
    }
    audio.volume = CLEAR_CUE_VOLUME
    this.clearCue = audio
  }

  private playClearCue(): void {
    this.cueStats.clearFrame = this.frameNo
    if (!this.clearCue || !this.clearCue.audioTrack) return
    this.clearCue.play(1)
    this.cueStats.plays++
    this.cueStats.playFrame = this.frameNo
    this.cueStats.playingAtPlay = this.clearCue.isPlaying()
  }

  /** The clear cue's player (null when its sound could not be loaded). */
  clearCueComponent(): AudioComponent | null {
    return this.clearCue
  }

  /**
   * The clear cue so far: how often it played, the frame it last played, the frame the card last
   * turned clear, and whether it was playing on that frame.
   */
  clearCueStats(): {plays: number; playFrame: number; clearFrame: number; playingAtPlay: boolean} {
    return {...this.cueStats}
  }

  /** Frames since the Lens opened (the controller's update count). */
  frameNumber(): number {
    return this.frameNo
  }

  /**
   * The answer card's backing fits what it shows, its top edge fixed: the line, the verdict
   * and the disclosure at rest; room for the change lines while a light moves; the full card
   * for the results. The version label sits at its bottom right.
   */
  private sizeAnswerPlate(): void {
    if (!this.answerPlate) return
    const top = LAYOUT.answerHeight / 2
    const H = this.cardCount() > 0 ? LAYOUT.answerHeight : this.moveOpen ? (this.eyePreset === "my" ? 15.5 : 13) : 8.5
    if (Math.abs(this.answerPlate.size.y - H) > 1e-3) this.answerPlate.size = new vec2(LAYOUT.answerWidth, H)
    this.answerBacking.getTransform().setLocalPosition(new vec3(0, top - H / 2, -0.3))
    this.versionLabel.getSceneObject().getTransform().setLocalPosition(new vec3(LAYOUT.answerWidth / 2 - 0.7, top - H + 1.1, 0.15))
    if (this.wheelchairLine) {
      this.wheelchairLine.getSceneObject().getTransform().setLocalPosition(new vec3(-LAYOUT.answerWidth / 2 + 0.7, top - H + 1.1, 0.15))
    }
  }

  /** The verdict line on the answer card ("All three: clear", or the glare list). */
  verdictLineText(): string {
    return this.verdictLine.getSceneObject().isEnabledInHierarchy ? this.verdictLine.text : ""
  }

  verdictLineComponent(): Text {
    return this.verdictLine
  }

  /** Put (or replace) a light's results card in the answer card, on that light's side. */
  private showCard(light: number, lines: string[], smallLines: number): void {
    const old = this.cards[light]
    if (old) old.destroy()
    const side = light === 0 ? -1 : 1
    const card = global.scene.createSceneObject(light === 0 ? "Results card L" : "Results card R")
    card.setParent(this.resultsHost)
    card.getTransform().setLocalPosition(new vec3(side * LAYOUT.cardX, LAYOUT.cardY, 0.05))
    const firstSmall = lines.length - smallLines
    const em = (i: number) => (i >= firstSmall ? LAYOUT.cardSmallEm : LAYOUT.cardEm)
    const lh = (i: number) => em(i) * 1.32
    const pad = 0.6
    let h = pad * 2
    lines.forEach((_, i) => (h += lh(i)))
    this.staticMesh(card, "Card backing", new vec4(0.85, 0.92, 1.0, 0.12), [rectXY(0, 0, LAYOUT.cardWidth, h, 0)], vec3.forward())
    let y = h / 2 - pad
    lines.forEach((line, i) => {
      y -= lh(i) / 2
      const color = i === 0 ? new vec4(1, 1, 1, 1) : i >= firstSmall ? new vec4(1, 1, 1, 0.75) : new vec4(1, 1, 1, 0.95)
      this.cardTextAt(card, `Line ${i}`, line, em(i), color, HorizontalAlignment.Left,
        -LAYOUT.cardWidth / 2 + pad, y, LAYOUT.cardWidth - pad * 2, i === 0 ? 700 : 500)
      y -= lh(i) / 2
    })
    this.cards[light] = card
    this.cardTexts[light] = lines.join("\n")
  }

  private clearCards(): void {
    for (let i = 0; i < this.cards.length; i++) {
      const c = this.cards[i]
      if (c) c.destroy()
      this.cards[i] = null
    }
  }

  // ===================================================================== handles

  private buildHandle(i: number): void {
    const tag = i === 0 ? "L" : "R"
    const side = i === 0 ? -1 : 1
    const so = global.scene.createSceneObject(`Aim handle ${tag}`)
    so.setParent(this.wall)
    so.getTransform().setLocalPosition(new vec3(side * LAYOUT.handleX, LAYOUT.handleY, LAYOUT.knobOut))
    const knobMat = this.mat(new vec4(0.95, 0.85, 0.55, 1))
    const knob = new DynamicMesh(so, "Knob", knobMat)
    knob.setQuads(boxQuads(vec3.zero(), new vec3(LAYOUT.knobSize, LAYOUT.knobSize, LAYOUT.knobSize * 0.6)))
    this.staticMesh(so, "Stem", new vec4(0.75, 0.75, 0.78, 1), barQuads(new vec3(0, 0, -LAYOUT.knobOut), vec3.zero(), 2))
    const dk = so.createComponent(DragKnob.getTypeName()) as DragKnob
    dk.configure(new vec3(LAYOUT.knobSize + 6, LAYOUT.knobSize + 6, LAYOUT.knobSize + 6), knobMat,
      new vec4(0.95, 0.85, 0.55, 1), new vec4(1, 1, 0.75, 1))
    dk.onDragStart.add(() => this.markAdjusted())
    dk.onDragDelta.add((worldDelta: vec3) => this.onHandleDrag(i, worldDelta))
    dk.onDragEnd.add(() => this.markAdjusted())
    this.knobs.push(dk)
    this.handleLines.push(new DynamicMesh(this.gallery, `Handle line ${tag}`, this.mat(new vec4(1, 0.92, 0.6, 0.3))))
  }

  /** Floor handles at the viewing area's near and far edges (big enough to pinch from 3 m). */
  private buildEdgeKnob(edge: number, name: string): void {
    const so = global.scene.createSceneObject(name)
    so.setParent(this.floor)
    const mat = this.mat(new vec4(1, 1, 1, 0.9))
    const m = new DynamicMesh(so, "Handle", mat)
    m.setQuads(boxQuads(new vec3(0, 3, 0), new vec3(20, 6, 10)))
    const dk = so.createComponent(DragKnob.getTypeName()) as DragKnob
    dk.configure(new vec3(26, 12, 16), mat, new vec4(1, 1, 1, 0.9), new vec4(1, 1, 0.6, 1))
    dk.onDragStart.add(() => (this.edgeAccum[edge] = 0))
    dk.onDragDelta.add((worldDelta: vec3) => {
      const local = this.toLocalDirection(worldDelta)
      this.edgeAccum[edge] += local.z
      const steps = Math.trunc(this.edgeAccum[edge] / EDGE_SNAP_CM)
      if (steps !== 0) {
        this.edgeAccum[edge] -= steps * EDGE_SNAP_CM
        if (edge === 0) this.setViewingArea(this.viewingNearCm + steps * EDGE_SNAP_CM, this.viewingFarCm)
        else this.setViewingArea(this.viewingNearCm, this.viewingFarCm + steps * EDGE_SNAP_CM)
      }
    })
    this.edgeKnobObjects.push(so)
  }

  private wireUi(): void {
    this.ui.onEyeCycle.add(() => this.cycleEyePreset())
    this.ui.onPaperArt.add((on: boolean) => this.setWorksOnPaper(on))
    this.ui.onReflector.add((narrow: boolean) => this.setReflector(narrow ? G.RXT13_20 : G.RXT13_40))
    this.ui.onSave.add(() => this.saveLightSheets())
    this.ui.onDone.add(() => this.closeLightSheets())
    this.ui.onRestart.add(() => this.restart())
    this.ui.onDimmer.add((e) => this.setDimmer(e.light, e.value))
    this.ui.onDistance.add((e) => this.setLightDistance(e.light, e.value))
    this.ui.onAdjust.add(() => this.markAdjusted())
    this.ui.onMore.add(() => this.applyPanelLayout())
    for (let i = 0; i < this.lights.length; i++) {
      this.ui.setDistance(i, this.lights[i].distanceCm)
      this.ui.setDimmer(i, this.lights[i].dimmer)
    }
    this.ui.setEyeHeightName(this.presetName(this.eyePreset))
  }

  /**
   * Put the practice wall's base point at (x, z) in world space, turned by yaw (upright: a
   * yaw only), with the floor at the chosen eye height below the camera. The glare model
   * works in the wall's own frame, so moving the wall changes no number.
   */
  private placeGalleryAt(x: number, z: number, yaw: number): void {
    const cam = this.cameraObject.getTransform().getWorldPosition()
    const gt = this.gallery.getTransform()
    gt.setWorldRotation(quat.angleAxis(yaw, vec3.up()))
    gt.setWorldPosition(new vec3(x, cam.y - this.getEyeHeight(), z))
    this.placed = true
    this.recallPanels()
    this.applyPanelLayout()
    this.dirty = true
  }

  // ===================================================================== interaction

  private markAdjusted(): void {
    if (!this.moveOpen) {
      // The zone ends before this move (the zones are rebuilt after the change, next frame).
      this.moveOpen = true
      for (const k of LANES) this.moveStartEnds[k] = this.zoneBad[k] ? Number.NaN : this.zoneFarEdgeCm(k)
      if (this.headline) this.rebuildLegend() // the change lines show from the first frame
    }
    this.lastAdjustTime = getTime()
    this.dirty = true
  }

  private toLocalDirection(worldDelta: vec3): vec3 {
    return this.gallery.getTransform().getWorldRotation().invert().multiplyVec3(worldDelta)
  }

  /** Up or down tilts the light (up aims higher on the wall); toward or away slides it. */
  private onHandleDrag(i: number, worldDelta: vec3): void {
    const l = this.lights[i]
    const d = this.toLocalDirection(worldDelta)
    if (Math.abs(d.y) > 1e-4) {
      const aimY = G.aimPoint(l).y + d.y * AIM_GAIN
      l.tiltDeg = G.clamp(G.tiltForAim(l.xCm, l.distanceCm, G.clamp(aimY, -150, G.CEILING_CM - 5)), 2, 80)
    }
    if (Math.abs(d.z) > 1e-4) {
      l.distanceCm = G.clamp(l.distanceCm + d.z, G.TRACK_MIN_CM, G.TRACK_MAX_CM)
      if (this.ui) this.ui.setDistance(i, l.distanceCm)
    }
    this.markAdjusted()
  }

  // ===================================================================== per frame

  private onUpdate(): void {
    this.frameNo++
    if (!this.placed) return
    const eye = this.eyeLocal()
    if (this.eyePreset === "my" && Math.abs(eye.y - this.myEyeHeightCm) >= MY_EYES_STEP_CM) {
      // "My eyes": the zone follows the real eye height (Q and E in Interactive Preview),
      // and the near panels follow it so the answer stays in view.
      this.myEyeHeightCm = eye.y
      this.eyeHeightCm = eye.y
      this.placeAnchor()
      this.applyPanelLayout()
      this.rebuildZone("my")
      this.rebuildLegend()
    }
    this.updateFollow(eye)
    this.updateRings(eye)
    if (this.dirty) {
      this.dirty = false
      // The warning fill and status line are rebuilt once, after everything they read
      // (zones and viewing area), not once per caller (BUILD_LOG B1).
      this.deferOverlap = true
      try {
        this.rebuildLights()
        this.rebuildZones()
        this.rebuildViewingArea()
        this.rebuildAmber()
      } finally {
        this.deferOverlap = false
      }
      if (this.overlapPending) this.rebuildOverlap()
    }
    this.updateGlareSpot()
    this.updateSetback()
    this.updateWheelchair()
    if (this.moveOpen && !this.isAdjusting()) this.closeMove()
    const alpha = this.isAdjusting() ? FULL_ALPHA : FAINT_ALPHA
    for (const e of EYES) {
      this.setAlpha(this.zoneMats[e.key], alpha)
      this.setAlpha(this.bandMats[e.key], alpha + 0.2)
    }
    this.setAlpha(this.zoneMats["my"], Math.max(alpha, 0.35))
    for (const m of this.lobeMats) this.setAlpha(m, alpha * LOBE_ALPHA_SCALE)
    // G1: the warning fill flashes while it shows (never under OVERLAP_FLASH_MIN, so it stays bright).
    if (this.overlapRowsNow.length > 0) {
      const k = 0.5 + 0.5 * Math.sin(getTime() * Math.PI * 2 * OVERLAP_FLASH_HZ)
      const c = this.overlapMat.mainPass.baseColor
      this.overlapMat.mainPass.baseColor = new vec4(c.x, c.y, c.z, OVERLAP_FLASH_MIN + (OVERLAP_FLASH_MAX - OVERLAP_FLASH_MIN) * k)
    }
  }

  private setAlpha(m: Material, a: number): void {
    const c = m.mainPass.baseColor
    if (Math.abs(c.w - a) > 1e-3) m.mainPass.baseColor = new vec4(c.x, c.y, c.z, a)
  }

  /**
   * Suggest a setback (B5): where along their tracks the lights could hang, toward the wall
   * from the farthest one, with all three eye heights clear (G.suggestSetbackCm). Solved only
   * when a move has settled and its inputs changed (about 20 to 30 zone evaluations). The ghost
   * fixtures and the label show while the answer is glare and the suggestion is toward the
   * wall; the lights stay where they are. While a tilt or the viewing area is changing, the
   * last suggestion no longer applies and is hidden; while only a distance changes it stays.
   */
  private updateSetback(): void {
    const aimInputs = this.lights.map((l) => `${l.xCm}|${l.tiltDeg}`).join(";") +
      `|${this.viewingNearCm}|${this.viewingFarCm}|${this.room.footprint}|${this.room.leanDeg}`
    const inputs = aimInputs + "|" + this.lights.map((l) => `${l.distanceCm}`).join(";")
    if (inputs !== this.setbackInputs && !this.isAdjusting()) {
      const t0 = getRealTimeNanos()
      this.setbackCm = G.suggestSetbackCm(this.lights, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth,
        G.VERDICT_HEIGHTS, this.room)
      this.setbackSolveMsLast = (getRealTimeNanos() - t0) / 1e6
      this.setbackInputs = inputs
      this.setbackAimInputs = aimInputs
      this.setbackFrom = G.clamp(Math.max(...this.lights.map((l) => l.distanceCm)), G.TRACK_MIN_CM, G.TRACK_MAX_CM)
      this.placeSetbackMarkers()
    }
    const D = this.setbackCm
    const show = D !== null && aimInputs === this.setbackAimInputs && D < this.setbackFrom - G.SETBACK_TOL_CM &&
      this.lastVerdict === "glare"
    for (const m of this.setbackMarkers) m.visual.enabled = show && m.count > 0
    this.setbackLabelText.getSceneObject().enabled = show
  }

  private placeSetbackMarkers(): void {
    const D = this.setbackCm
    for (let i = 0; i < this.lights.length; i++) {
      // The fixture's body, on its own track, at the suggested distance.
      this.setbackMarkers[i].setQuads(D === null ? [] :
        boxQuads(new vec3(this.lights[i].xCm, G.CEILING_CM - 6, D), new vec3(9, 12, 9)))
    }
    if (D === null) return
    this.setbackLabelText.text = G.setbackLabel(D)
    // Between the two tracks, under them, tilted down toward the panels' eye point.
    const y = G.CEILING_CM - SETBACK_LABEL_BELOW_CM
    const tr = this.setbackLabelText.getSceneObject().getTransform()
    tr.setLocalPosition(new vec3(0, y, D))
    const down = Math.atan2(y - this.getEyeHeight(), Math.max(this.follow.z - D, 1))
    tr.setLocalRotation(quat.angleAxis(down, vec3.right()))
  }

  /**
   * G2: the wheelchair coverage estimate (G.wheelchairGlareShare on the zones' own model), solved
   * when a change has settled and its inputs changed. Shown on the answer card at rest (not while
   * a light moves, not over the results cards), always labelled as an estimate.
   */
  private updateWheelchair(): void {
    const inputs = this.lights.map((l) => `${l.xCm}|${l.distanceCm}|${l.tiltDeg}|${l.beamDeg}`).join(";") +
      `|${this.viewingNearCm}|${this.viewingFarCm}|${this.room.footprint}|${this.room.leanDeg}`
    if (inputs !== this.wheelchairInputs && !this.isAdjusting()) {
      this.wheelchairNow = G.wheelchairGlareShare(this.lights, this.viewingNearCm, this.viewingFarCm,
        LAYOUT.viewingHalfWidth, this.room)
      this.wheelchairInputs = inputs
      if (this.wheelchairNow) this.wheelchairLine.text = G.wheelchairReadout(this.wheelchairNow.share)
    }
    const show = this.wheelchairNow !== null && inputs === this.wheelchairInputs && !this.moveOpen && this.cardCount() === 0
    if (this.wheelchairLine.getSceneObject().enabled !== show) this.wheelchairLine.getSceneObject().enabled = show
  }

  /** G2: the estimated share (0 to 1) of wheelchair users who see glare in the viewing area, or null. */
  wheelchairShare(): number | null {
    return this.wheelchairNow ? this.wheelchairNow.share : null
  }

  /** G2: the eye height (cm) at and below which a wheelchair user sees glare in the viewing area, or null. */
  wheelchairBoundaryCm(): number | null {
    return this.wheelchairNow ? this.wheelchairNow.boundaryCm : null
  }

  /** G2: the estimate line on the answer card as shown ("" while hidden). */
  wheelchairLineText(): string {
    return this.wheelchairLine.getSceneObject().isEnabledInHierarchy ? this.wheelchairLine.text : ""
  }

  wheelchairLineComponent(): Text {
    return this.wheelchairLine
  }

  /**
   * U1b item 5: lamp i's beam angle, its axis from the horizontal (90 - tilt from straight down),
   * live, under that lamp's aim handle (the control that changes it); amber past CCI's 60 deg.
   */
  private placeBeamLabel(i: number): void {
    const deg = 90 - this.lights[i].tiltDeg
    this.beamAngles[i] = deg
    const t = this.beamLabels[i]
    t.text = `Beam ${Math.round(deg)} deg`
    t.textFill.color = Math.round(deg) > CCI_BEAM_DEG ? BEAM_LABEL_WARN : BEAM_LABEL_OK
    const side = i === 0 ? -1 : 1
    t.getSceneObject().getTransform().setLocalPosition(new vec3(side * LAYOUT.handleX, LAYOUT.handleY - BEAM_LABEL_BELOW_CM, LAYOUT.knobOut))
    t.getSceneObject().enabled = true
  }

  /** U1b item 5: lamp i's beam angle from the horizontal (deg); NaN when it cannot be computed. */
  beamAngleDeg(i: number): number {
    return this.beamAngles[i]
  }

  /** U1b item 5: lamp i's angle label as shown ("" while hidden). */
  beamLabelText(i: number): string {
    const t = this.beamLabels[i]
    return t.getSceneObject().isEnabledInHierarchy ? t.text : ""
  }

  /** U1b item 5: true while lamp i's angle label shows the warning colour (steeper than CCI's 60 deg). */
  beamLabelWarns(i: number): boolean {
    const c = this.beamLabels[i].textFill.color
    return Math.abs(c.x - BEAM_LABEL_WARN.x) + Math.abs(c.y - BEAM_LABEL_WARN.y) + Math.abs(c.z - BEAM_LABEL_WARN.z) < 1e-3
  }

  beamLabelComponent(i: number): Text {
    return this.beamLabels[i]
  }

  /** The suggested setback (cm from the wall), or null when no distance on the track is clear. */
  setbackSuggestion(): number | null {
    return this.setbackCm
  }

  /** True while the setback ghost fixtures and their label are shown. */
  setbackShown(): boolean {
    return this.setbackLabelText.getSceneObject().enabled
  }

  /** The ghost fixtures' centres in the gallery's own space (from their drawn quads). */
  setbackMarkerCentres(): vec3[] {
    return this.setbackMarkers.map((m) => {
      const e = m.extent
      return e ? e.min.add(e.max).uniformScale(0.5) : new vec3(Number.NaN, Number.NaN, Number.NaN)
    })
  }

  /** The setback label as shown ("" while hidden). */
  setbackLabelShown(): string {
    return this.setbackShown() ? this.setbackLabelText.text : ""
  }

  /** How long the last setback solve took (ms). */
  setbackSolveMs(): number {
    return this.setbackSolveMsLast
  }

  /** Angle (deg) between the setback label's front and the direction to the eye (camera). */
  setbackLabelFacingDeg(): number {
    const tr = this.setbackLabelText.getSceneObject().getTransform()
    const front = tr.getWorldRotation().multiplyVec3(vec3.forward()).normalize()
    const toEye = this.cameraObject.getTransform().getWorldPosition().sub(tr.getWorldPosition()).normalize()
    return (Math.acos(G.clamp(front.dot(toEye), -1, 1)) * 180) / Math.PI
  }

  private rebuildLights(): void {
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]
      const ok = G.lightComputable(l)
      this.fixtures[i].enabled = ok
      // Only a light that moved or turned is rebuilt: a drag moves one light (BUILD_LOG B1).
      const built = ok ? G.litGlassSpanKey(l) : "not computable"
      if (this.lightBuilt[i] === built) continue
      this.lightBuilt[i] = built
      if (!ok) {
        this.beamMeshes[i].setQuads([])
        this.handleLines[i].setQuads([])
        this.beamAngles[i] = Number.NaN
        this.beamLabels[i].getSceneObject().enabled = false
        continue
      }
      this.placeBeamLabel(i)
      const p = G.lightPosition(l)
      this.fixtures[i].getTransform().setLocalPosition(new vec3(p.x, p.y, p.z))
      // Beam: a faint cone from the fixture to where it meets the wall plane.
      const axis = G.beamAxis(l)
      const a = new vec3(axis.x, axis.y, axis.z)
      const helper = Math.abs(a.y) < 0.9 ? vec3.up() : vec3.right()
      const u = a.cross(helper).normalize()
      const v = a.cross(u).normalize()
      const half = (G.beamDegOf(l) / 2) * (Math.PI / 180)
      const apex = new vec3(p.x, p.y, p.z)
      const ring: vec3[] = []
      const segs = 28
      for (let s = 0; s < segs; s++) {
        const ang = (s / segs) * Math.PI * 2
        const dir = a.uniformScale(Math.cos(half))
          .add(u.uniformScale(Math.sin(half) * Math.cos(ang)))
          .add(v.uniformScale(Math.sin(half) * Math.sin(ang)))
        const t = dir.z < -1e-4 ? -p.z / dir.z : 400
        ring.push(apex.add(dir.uniformScale(Math.min(t, 400))))
      }
      const quads: Quad[] = []
      for (let s = 0; s < segs; s++) quads.push({a: apex, b: ring[s], c: ring[(s + 1) % segs], d: apex})
      this.beamMeshes[i].setQuads(quads)
      // The handle's thin line up to the light it controls.
      const side = i === 0 ? -1 : 1
      const knob = new vec3(side * LAYOUT.handleX, LAYOUT.handleY + LAYOUT.knobSize / 2, LAYOUT.knobOut)
      this.handleLines[i].setQuads(barQuads(knob, new vec3(p.x, p.y - 12, p.z), 0.6))
    }
  }

  private rebuildZones(): void {
    for (const eye of EYES) this.rebuildZone(eye.key)
    this.rebuildZone("my")
    // Again once every eye height is rebuilt: the status line's verdict reads all three.
    this.rebuildOverlap()
    this.rebuildLegend()
  }

  /**
   * One eye height's floor zone: filled when it is the chosen eye height, a faint outline
   * otherwise. Only the chosen zone carries a label, its name in its colour ("Seated"); its
   * distance is the answer card's headline (U1: each glare distance once on screen).
   */
  private rebuildZone(key: ZoneKey): void {
    const active = key !== "my" || this.eyePreset === "my"
    const h = this.zoneHeight(key)
    const computable = this.lights.every((l) => G.lightComputable(l)) && Number.isFinite(h)
    let rows = active && computable ? G.combinedZoneRows(this.lights, h, ZONE_ROW_CM, this.room) : []
    this.zoneBad[key] = active && (!computable || !G.rowsComputable(rows))
    if (this.zoneBad[key]) rows = []
    this.zoneRows[key] = rows
    const chosen = this.zoneFilled(key)
    const rects = chosen ? rows : G.zoneOutline(rows, ZONE_ROW_CM, OUTLINE_CM)
    this.zoneMeshes[key].setRectsXZ(rects, 0)
    this.zoneMeshes[key].visual.setRenderOrder(chosen ? FLOOR_RENDER.chosen : FLOOR_RENDER.outline)
    if (chosen) this.rebuildLobes(key, h, rows.length > 0)
    const label = this.zoneLabels[key]
    label.getSceneObject().enabled = chosen && rows.length > 0
    if (rows.length > 0) {
      const name = key === "my" ? `${MY_EYES_LABEL} (${Math.round(this.myEyeHeightCm)} cm)` : this.zoneName(key)
      // U1: the colour tag only; the distance is the answer card's headline (each distance once on screen).
      label.text = name
    }
    if (chosen) this.rebuildOverlap()
  }

  /**
   * G1: each lamp's own part of the chosen eye height's zone, as a soft patch: its rows, and
   * the same rows widened by LOBE_FEATHER_CM, in one mesh, so the patch fades at its edge.
   * Where the two lamps' patches overlap, the floor is brighter.
   */
  private rebuildLobes(key: ZoneKey, h: number, any: boolean): void {
    this.lobeRowsChosen = any ? G.lobeRows(this.lights, h, ZONE_ROW_CM, this.room) : this.lights.map(() => [])
    const f = LOBE_FEATHER_CM
    const c = this.zoneColor(key)
    for (let i = 0; i < this.lobeMeshes.length; i++) {
      const rows = this.lobeRowsChosen[i] || []
      const soft = rows.map((r) => ({z0: Math.max(0, r.z0 - f / 2), z1: r.z1 + f / 2, xMin: r.xMin - f, xMax: r.xMax + f}))
      this.lobeMeshes[i].setRectsXZ(rows.concat(soft), 0)
      const m = this.lobeMats[i].mainPass.baseColor
      this.lobeMats[i].mainPass.baseColor = new vec4(c.x, c.y, c.z, m.w)
    }
  }

  /** The chosen zone inside the viewing area: the warning fill and the floor's status line. */
  private rebuildOverlap(): void {
    if (this.deferOverlap) {
      this.overlapPending = true
      return
    }
    this.overlapPending = false
    const key = this.chosenZone()
    const rows = this.zoneRows[key] || []
    this.overlapRowsNow = G.overlapRows(rows, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth)
    this.overlapMesh.setRectsXZ(this.overlapRowsNow, 0)
    // "All three: clear" only when every eye height is clear (G.verdictText).
    const results = this.eyeResults()
    const clear = G.overallVerdict(results) === "clear"
    this.lastVerdict = clear ? "clear" : "glare"
    // B7: the floor's line names a My eyes height below 104 cm too, as the answer card does.
    const live = this.liveEye()
    this.statusLabel.text = G.verdictTextWithEye(results, this.eyeNames(), live)
    this.statusLabel.textFill.color = G.overallVerdictWithEye(results, live) === "clear" ? new vec4(1, 1, 1, 0.95) : OVERLAP_TEXT
    this.statusLabel.getSceneObject().enabled = true
    this.layoutFloorLabels()
  }

  private rebuildViewingArea(): void {
    const n = this.viewingNearCm
    const f = this.viewingFarCm
    const w = LAYOUT.viewingHalfWidth
    const t = 1.5
    this.viewingFill.setQuads([rectXZ(-w, w, n, f, 0.2)])
    this.viewingMesh.setQuads([
      rectXZ(-w, w, f - t / 2, f + t / 2, 0.3),
      rectXZ(-w - t / 2, -w + t / 2, n, f, 0.3),
      rectXZ(w - t / 2, w + t / 2, n, f, 0.3),
    ])
    // The bold near edge, centred on the edge, drawn over the zones and the warning fill.
    this.nearEdgeMesh.setQuads([rectXZ(-w - t / 2, w + t / 2, n - NEAR_EDGE_CM / 2, n + NEAR_EDGE_CM / 2, 0.9)])
    this.viewingLabel.text = `Viewing area starts ${Math.round(n)} cm from the wall`
    this.viewingLabel.getSceneObject().enabled = true
    // Off the centre line, so the handles never sit on the labels (centred at x 0).
    this.edgeKnobObjects[0].getTransform().setLocalPosition(new vec3(EDGE_HANDLE_X, 0, n))
    this.edgeKnobObjects[1].getTransform().setLocalPosition(new vec3(EDGE_HANDLE_X, 0, f))
    this.rebuildOverlap()
  }

  /**
   * Floor labels in screen space from the viewer's eye (the panels' followed eye point), so
   * they read in one glance and never overlap: just above the bold near edge, the viewing
   * area's start, and above that the chosen zone's reach; just below the bold edge (or below
   * the warning fill), the status. A label meant to sit above its feature stands up from it;
   * one meant to sit below lies near the floor, nearer the viewer.
   */
  private layoutFloorLabels(): void {
    if (!this.statusLabel) return
    const eyeZ = this.follow.z
    const eyeH = this.getEyeHeight()
    const x = G.clamp(this.follow.x, -LAYOUT.viewingHalfWidth / 2, LAYOUT.viewingHalfWidth / 2)
    const R = Math.PI / 180
    const depression = (z: number) => Math.atan2(eyeH, Math.max(eyeZ - z, 1)) / R
    const place = (t: Text, featureZ: number, deg: number) => {
      const d = Math.max(eyeZ - featureZ, 1)
      let y = eyeH - Math.tan(deg * R) * d
      let z = featureZ
      if (y < 1) {
        // Below the feature on screen: lie near the floor, nearer the viewer.
        y = 1
        z = eyeZ - (eyeH - 1) / Math.tan(deg * R)
      }
      const tr = t.getSceneObject().getTransform()
      tr.setLocalPosition(new vec3(x, y, z))
      tr.setLocalRotation(quat.angleAxis(-deg * R, vec3.right()))
    }
    const n = this.viewingNearCm
    const edge = depression(n)
    place(this.viewingLabel, n, edge - FLOOR_LABEL_HALF_DEG - 0.35)
    const key = this.chosenZone()
    const far = this.zoneFarEdgeCm(key)
    place(this.zoneLabels[key], Math.max(far, 0), edge - FLOOR_LABEL_HALF_DEG - 0.35 - FLOOR_LABEL_PITCH_DEG)
    const below = this.overlapRowsNow.length > 0 ? Math.max(n, this.overlapDepth().max) : n
    place(this.statusLabel, below, depression(below) + FLOOR_LABEL_HALF_DEG + 0.45)
  }

  private rebuildAmber(): void {
    const quads: Quad[] = []
    const centres: {x: number; y: number}[] = []
    if (this.worksOnPaper) {
      const half = G.GLASS_HALF_WIDTH_CM
      for (let x = -half; x < half - 1e-6; x += AMBER_CELL_CM) {
        for (let y = G.GLASS_BOTTOM_CM; y < G.GLASS_TOP_CM - 1e-6; y += AMBER_CELL_CM) {
          const c = {x: x + AMBER_CELL_CM / 2, y: y + AMBER_CELL_CM / 2, z: 0}
          const onGlass = G.glassPoint(c.y - G.GLASS_BOTTOM_CM, c.x, this.room)
          if (G.totalIlluminanceLux(this.lights.filter((l) => G.lightComputable(l)), onGlass, this.room) > G.WORKS_ON_PAPER_LUX) {
            quads.push(rectXY(c.x, c.y, AMBER_CELL_CM, AMBER_CELL_CM, 1.0))
            centres.push({x: c.x, y: c.y})
          }
        }
      }
    }
    this.amberCells = quads.length
    this.amberCentres = centres
    this.amberMesh.setQuads(quads, vec3.forward())
  }

  private amberCentres: {x: number; y: number}[] = []

  /** True when the 5 cm amber cell around (x, y) on the glass is glowing. */
  amberAt(x: number, y: number): boolean {
    if (!this.amberMesh.visual.enabled) return false
    const h = AMBER_CELL_CM / 2
    return this.amberCentres.some((c) => Math.abs(c.x - x) <= h && Math.abs(c.y - y) <= h)
  }

  private updateGlareSpot(): void {
    const e = this.eyeLocal()
    const eye = {x: e.x, y: e.y, z: e.z}
    const byLight = this.lights.map((l) => (G.lightComputable(l) ? G.glarePointFor(eye, l, this.room) : null))
    const pts = byLight.filter((p) => p !== null) as G.V3[]
    const changed = pts.length !== this.glarePoints.length ||
      pts.some((p, i) => Math.abs(p.x - this.glarePoints[i].x) + Math.abs(p.y - this.glarePoints[i].y) +
        Math.abs(p.z - this.glarePoints[i].z) > 0.05)
    this.glarePoints = pts
    if (changed) {
      const outer: Quad[] = []
      const inner: Quad[] = []
      for (const p of pts) {
        outer.push(...discQuads(p.x, p.y, 4, p.z + 1.2))
        inner.push(...discQuads(p.x, p.y, 2, p.z + 1.3))
      }
      this.spotOuter.setQuads(outer, vec3.forward())
      this.spotInner.setQuads(inner, vec3.forward())
    }
    // "Seated: glare here" right above each spot (centred, so the two labels never meet
    // and neither runs off the side of a close-up view).
    const name = this.presetName(this.eyePreset)
    for (let i = 0; i < this.spotLabels.length; i++) {
      const p = byLight[i]
      const t = this.spotLabels[i]
      t.getSceneObject().enabled = p !== null
      if (p) {
        t.text = `${name}: glare here`
        t.getSceneObject().getTransform().setLocalPosition(new vec3(p.x, p.y + SPOT_LABEL_ABOVE_CM, p.z + 1.6))
      }
    }
    this.updateGhost(e, byLight)
  }

  /**
   * The plane-mirror ray construction: while the eye sees glare, a faint copy of the lamp
   * mirrored behind the wall and the lamp's own ray down to the glare spot. Fades out when
   * the eye steps out of the zone.
   */
  private updateGhost(eye: vec3, byLight: (G.V3 | null)[]): void {
    const target = this.glarePoints.length > 0 ? 1 : 0
    const step = getDeltaTime() * GHOST_FADE_PER_S
    this.ghostAlpha = target > this.ghostAlpha
      ? Math.min(target, this.ghostAlpha + step)
      : Math.max(target, this.ghostAlpha - step)
    if (target > 0) {
      let labelAt: vec3 | null = null
      for (let i = 0; i < this.lights.length; i++) {
        const p = byLight[i]
        if (!p) {
          this.ghostLamps[i].setQuads([])
          this.ghostRays[i].setQuads([])
          continue
        }
        const g = G.mirroredLampFor(this.lights[i], this.room)
        const ghost = new vec3(g.x, g.y, g.z)
        const spot = new vec3(p.x, p.y, p.z + 1.4)
        const lamp = G.lightPosition(this.lights[i])
        this.ghostLamps[i].setQuads(boxQuads(new vec3(ghost.x, ghost.y - 6, ghost.z), new vec3(9, 12, 9)))
        // The lamp's own ray down to the glare spot: the light path, lamp to glass to you.
        // (A line from the eye to the ghost lamp would lie along the line of sight and
        // collapse to a point for the wearer, so it is not drawn.)
        this.ghostRays[i].setQuads(barQuads(new vec3(lamp.x, lamp.y - 12, lamp.z), spot, LAMP_RAY_THICKNESS))
        if (!labelAt) labelAt = new vec3(ghost.x, ghost.y + 10, ghost.z)
      }
      if (labelAt) this.ghostLabel.getSceneObject().getTransform().setLocalPosition(labelAt)
    }
    this.ghostRoot.enabled = this.ghostAlpha > 0.01
    for (const m of this.ghostMats) {
      const c = m.mat.mainPass.baseColor
      m.mat.mainPass.baseColor = new vec4(c.x, c.y, c.z, m.alpha * this.ghostAlpha)
    }
    const lc = this.ghostLabel.textFill.color
    this.ghostLabel.textFill.color = new vec4(lc.x, lc.y, lc.z, GHOST_LABEL_ALPHA * this.ghostAlpha)
  }

  /** How visible the ghost lamp construction is right now (0 hidden, 1 full). */
  ghostVisibility(): number {
    return this.ghostRoot.enabled ? this.ghostAlpha : 0
  }

  /** How strongly the ghost lamp itself is drawn (its material alpha right now). */
  ghostLampAlpha(): number {
    return this.ghostMats.length > 0 ? this.ghostMats[0].mat.mainPass.baseColor.w : 0
  }
}
