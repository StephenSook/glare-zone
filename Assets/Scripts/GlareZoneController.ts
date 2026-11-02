import * as G from "./GlareMath"
import {DynamicMesh, Quad, barQuads, boxQuads, discQuads, makeText, rectXY, rectXZ, tintedMaterial} from "./DrawKit"
import {DragKnob} from "./DragKnob"
import {GlareZoneUI} from "./GlareZoneUI"
import {GlareHandMenu} from "./GlareHandMenu"
import {LAYOUT, LENS_VERSION} from "./GlareLayout"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {smoothDamp} from "SpectaclesInteractionKit.lspkg/Utils/mathUtils"

export type EyeKey = "standing" | "seated" | "child"
export type ZoneKey = EyeKey | "my"
export type EyePreset = ZoneKey

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
const LANE_Y0 = 2.3
const LANE_STEP = 2.05
const LANE_H = 1.4
const LEGEND_TEXT_X = -8.3
const HEADLINE_Y = 6.4
const DISCLAIMER_Y = 4.4
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

// The disclosure, as the answer card's second line.
const DISCLAIMER = "Computed reflection, sample lamp values, not measured"

// Sources: 160 cm is CCI Notes 2/3's "typical adult eye level" behind D = (H - 160) x 0.577;
// 109 cm (adult wheelchair user) and 104 cm (6-to-9-year-old wheelchair user, about 1036 mm)
// are from the Smithsonian Guidelines for Accessible Exhibition Design.
const SHEET_SOURCES = "Eyes: 160 CCI Notes 2/3; 109, 104 Smithsonian"
const SHEET_FIXTURE = "Sample fixture (not real): 25 deg, 1,500 cd"
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

  onAwake(): void {
    print(`Lens Opened: ${LENS_VERSION}`)
    const D0 = G.standardPlacementCm()
    const tilt0 = G.tiltForAim(50, D0, 150)
    this.lights.push({xCm: -50, distanceCm: D0, tiltDeg: tilt0, dimmer: 1})
    this.lights.push({xCm: 50, distanceCm: D0, tiltDeg: tilt0, dimmer: 1})
    this.buildGallery()
    this.createEvent("OnStartEvent").bind(() => {
      this.placeGallery()
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
    if (this.ui) this.ui.setDistance(light, this.lights[light].distanceCm)
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
    this.closeLightSheets()
  }

  setViewingArea(nearCm: number, farCm: number): void {
    this.viewingNearCm = G.clamp(nearCm, 0, farCm - EDGE_SNAP_CM)
    this.viewingFarCm = Math.max(farCm, this.viewingNearCm + EDGE_SNAP_CM)
    this.dirty = true
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
      `Dimmer ${Math.round(l.dimmer * 100)}%`,
    ]
    for (const eye of EYES) {
      const pass = G.passesViewingArea(l, eye.heightCm, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth)
      const depth = G.zoneDepth(l, eye.heightCm)
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

  /** The eye (camera) position in gallery-local centimetres. */
  eyeLocal(): vec3 {
    const cam = this.cameraObject.getTransform().getWorldPosition()
    return this.gallery.getTransform().getInvertedWorldTransform().multiplyPoint(cam)
  }

  galleryObject(): SceneObject {
    return this.gallery
  }

  // ===================================================================== building

  private mat(color: vec4): Material {
    return tintedMaterial(this.baseMaterial, color)
  }

  private staticMesh(parent: SceneObject, name: string, color: vec4, quads: Quad[], normal?: vec3): DynamicMesh {
    const m = new DynamicMesh(parent, name, this.mat(color))
    m.setQuads(quads, normal)
    return m
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
    }

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
    this.overlapMesh = new DynamicMesh(this.floor, "Glare inside the viewing area", this.mat(OVERLAP_COLOR))
    this.overlapMesh.visual.setRenderOrder(FLOOR_RENDER.overlap)
    this.overlapMesh.sceneObject.getTransform().setLocalPosition(new vec3(0, 0.7, 0))
    this.statusLabel = this.floorLabel(this.floor, "Floor status label", OVERLAP_TEXT)
    this.viewingLabel = this.floorLabel(this.floor, "Viewing area label", new vec4(1, 1, 1, 0.95))

    // Overlays on the glass: amber light-limit cells, the glare spot and its labels.
    this.amberMesh = new DynamicMesh(this.wall, "Amber over 50 lux", this.mat(AMBER))
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
    this.legend.enabled = !results
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
    this.disclaimer = this.cardTextAt(this.answerCard, "Disclaimer", DISCLAIMER, LAYOUT.disclaimerEm,
      new vec4(1, 1, 1, 0.85), HorizontalAlignment.Center, 0, DISCLAIMER_Y, W - 2, 500)
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
      ? `Your eyes (${Math.round(this.myEyeHeightCm)} cm)`
      : EYES.filter((e) => e.key === key)[0].viewers
    const far = this.zoneFarEdgeCm(key)
    return far > 0
      ? `${subject} see glare up to ${G.oneDecimal(far)} cm from the wall`
      : `${subject} see no glare from these lights`
  }

  /** One legend line, eye height and reach with units. */
  private laneLine(key: ZoneKey): string {
    const far = this.zoneFarEdgeCm(key)
    const who = key === "my"
      ? `My eyes, at ${Math.round(this.myEyeHeightCm)} cm`
      : `${this.zoneName(key)}, eyes at ${this.zoneHeight(key)} cm`
    return far > 0 ? `${who}: glare up to ${G.oneDecimal(far)} cm from the wall` : `${who}: no glare`
  }

  /** Bars and lines per eye height (the "My eyes" line only while that preset is chosen). */
  private rebuildLegend(): void {
    const shown = this.eyePreset === "my" ? 4 : 3
    const top = this.laneY(0) + LANE_H / 2 + 0.3
    const bottom = this.laneY(shown - 1) - LANE_H / 2 - 0.3
    this.legendWall.setQuads([rectXY(PLOT_X0 - 0.15, (top + bottom) / 2, 0.3, top - bottom, 0.12)], vec3.forward())
    this.legendFooter.getTransform().setLocalPosition(new vec3(0, this.laneY(shown), 0))
    const vx0 = this.plotX(this.viewingNearCm)
    const vx1 = this.plotX(this.viewingFarCm)
    this.legendViewing.setQuads([rectXY((vx0 + vx1) / 2, (top + bottom) / 2, vx1 - vx0, top - bottom, 0.05)], vec3.forward())
    this.legendViewingLabel.text =
      `Viewing area: ${Math.round(this.viewingNearCm)} to ${Math.round(this.viewingFarCm)} cm from the wall`
    LANES.forEach((key, i) => {
      const bar = this.legendBars[key]
      const label = this.legendLaneTexts[key]
      const show = key !== "my" || this.eyePreset === "my"
      label.getSceneObject().enabled = show
      const rows = this.zoneRows[key] || []
      if (!show || rows.length === 0) {
        bar.setQuads([], vec3.forward())
      } else {
        const x0 = this.plotX(this.zoneNearEdgeCm(key))
        const x1 = this.plotX(G.zoneFarEdge(rows))
        bar.setQuads([rectXY((x0 + x1) / 2, this.laneY(i), Math.max(0.2, x1 - x0), LANE_H, 0.1)], vec3.forward())
      }
      if (show) label.text = this.laneLine(key)
    })
    this.headline.text = this.headlineFor()
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

  /** Put the practice wall in front of the camera, with the floor at the chosen eye height. */
  private placeGallery(): void {
    const camT = this.cameraObject.getTransform()
    const view = camT.getWorldRotation().multiplyVec3(new vec3(0, 0, -1))
    let toUser = new vec3(-view.x, 0, -view.z)
    toUser = toUser.length > 1e-4 ? toUser.normalize() : vec3.forward()
    const yaw = Math.atan2(toUser.x, toUser.z)
    const rot = quat.angleAxis(yaw, vec3.up())
    const offset = rot.multiplyVec3(new vec3(0, this.eyeHeightCm, LAYOUT.startDistanceCm))
    const gt = this.gallery.getTransform()
    gt.setWorldRotation(rot)
    gt.setWorldPosition(camT.getWorldPosition().sub(offset))
    this.placed = true
    this.recallPanels()
    this.applyPanelLayout()
    this.dirty = true
  }

  // ===================================================================== interaction

  private markAdjusted(): void {
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
    if (this.dirty) {
      this.dirty = false
      this.rebuildLights()
      this.rebuildZones()
      this.rebuildViewingArea()
      this.rebuildAmber()
    }
    this.updateGlareSpot()
    const alpha = this.isAdjusting() ? FULL_ALPHA : FAINT_ALPHA
    for (const e of EYES) {
      this.setAlpha(this.zoneMats[e.key], alpha)
      this.setAlpha(this.bandMats[e.key], alpha + 0.2)
    }
    this.setAlpha(this.zoneMats["my"], Math.max(alpha, 0.35))
  }

  private setAlpha(m: Material, a: number): void {
    const c = m.mainPass.baseColor
    if (Math.abs(c.w - a) > 1e-3) m.mainPass.baseColor = new vec4(c.x, c.y, c.z, a)
  }

  private rebuildLights(): void {
    for (let i = 0; i < this.lights.length; i++) {
      const l = this.lights[i]
      const p = G.lightPosition(l)
      this.fixtures[i].getTransform().setLocalPosition(new vec3(p.x, p.y, p.z))
      // Beam: a faint cone from the fixture to where it meets the wall plane.
      const axis = G.beamAxis(l)
      const a = new vec3(axis.x, axis.y, axis.z)
      const helper = Math.abs(a.y) < 0.9 ? vec3.up() : vec3.right()
      const u = a.cross(helper).normalize()
      const v = a.cross(u).normalize()
      const half = (G.SAMPLE_BEAM_DEG / 2) * (Math.PI / 180)
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
    this.rebuildLegend()
  }

  /**
   * One eye height's floor zone: filled when it is the chosen eye height, a faint outline
   * otherwise. Only the chosen zone carries its reach label ("Seated: glare up to 73.5 cm
   * from the wall"); the answer card's legend lists every height's reach at once.
   */
  private rebuildZone(key: ZoneKey): void {
    const active = key !== "my" || this.eyePreset === "my"
    const rows = active ? G.combinedZoneRows(this.lights, this.zoneHeight(key), ZONE_ROW_CM) : []
    this.zoneRows[key] = rows
    const chosen = this.zoneFilled(key)
    const rects = chosen ? rows : G.zoneOutline(rows, ZONE_ROW_CM, OUTLINE_CM)
    this.zoneMeshes[key].setQuads(rects.map((r) => rectXZ(r.xMin, r.xMax, r.z0, r.z1, 0)))
    this.zoneMeshes[key].visual.setRenderOrder(chosen ? FLOOR_RENDER.chosen : FLOOR_RENDER.outline)
    const label = this.zoneLabels[key]
    label.getSceneObject().enabled = chosen && rows.length > 0
    if (rows.length > 0) {
      const name = key === "my" ? `${MY_EYES_LABEL} (${Math.round(this.myEyeHeightCm)} cm)` : this.zoneName(key)
      label.text = `${name}: glare up to ${G.oneDecimal(G.zoneFarEdge(rows))} cm from the wall`
    }
    if (chosen) this.rebuildOverlap()
  }

  /** The chosen zone inside the viewing area: the warning fill and the floor's status line. */
  private rebuildOverlap(): void {
    const key = this.chosenZone()
    const rows = this.zoneRows[key] || []
    this.overlapRowsNow = G.overlapRows(rows, this.viewingNearCm, this.viewingFarCm, LAYOUT.viewingHalfWidth)
    this.overlapMesh.setQuads(this.overlapRowsNow.map((r) => rectXZ(r.xMin, r.xMax, r.z0, r.z1, 0)))
    const name = key === "my" ? MY_EYES_LABEL : this.zoneName(key)
    const inside = this.overlapRowsNow.length > 0
    this.statusLabel.text = inside ? `${name}: glare inside the viewing area` : `${name}: clear`
    this.statusLabel.textFill.color = inside ? OVERLAP_TEXT : new vec4(1, 1, 1, 0.95)
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
          if (G.totalIlluminanceLux(this.lights, c) > G.WORKS_ON_PAPER_LUX) {
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
    const byLight = this.lights.map((l) => G.glarePoint(eye, l))
    const pts = byLight.filter((p) => p !== null) as G.V3[]
    const changed = pts.length !== this.glarePoints.length ||
      pts.some((p, i) => Math.abs(p.x - this.glarePoints[i].x) + Math.abs(p.y - this.glarePoints[i].y) > 0.05)
    this.glarePoints = pts
    if (changed) {
      const outer: Quad[] = []
      const inner: Quad[] = []
      for (const p of pts) {
        outer.push(...discQuads(p.x, p.y, 4, 1.2))
        inner.push(...discQuads(p.x, p.y, 2, 1.3))
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
        t.getSceneObject().getTransform().setLocalPosition(new vec3(p.x, p.y + SPOT_LABEL_ABOVE_CM, 1.6))
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
        const g = G.mirroredLamp(this.lights[i])
        const ghost = new vec3(g.x, g.y, g.z)
        const spot = new vec3(p.x, p.y, 1.4)
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
