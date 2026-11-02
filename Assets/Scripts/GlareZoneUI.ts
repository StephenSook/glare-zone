import {FlexLayout} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexLayout"
import {FlexItem} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexItem"
import {FlexAlign, FlexDirection, FlexJustify} from "SpectaclesUIKit.lspkg/Scripts/Components/Layout2D/Flex/FlexTypes"
import {BackPlate} from "SpectaclesUIKit.lspkg/Scripts/BackPlate"
import {Button} from "SpectaclesUIKit.lspkg/Scripts/Components/Button/Button"
import {Slider} from "SpectaclesUIKit.lspkg/Scripts/Components/Slider/Slider"
import Event, {PublicApi} from "SpectaclesInteractionKit.lspkg/Utils/Event"
import {LAYOUT} from "./GlareLayout"

const CONTENT_Z_OFFSET = 0.08 // a label drawn on a button face sits just in front of it
// "More controls" columns: two cells per light, the dimmer above the aim handle and the
// distance below it, with the handle showing through the gap between them. Cell-local cm
// (origin at the cell centre, LAYOUT.columnCellHeight tall): a 6 cm track whose 4.2 cm knob
// reaches 2.1 cm past either end (10.2 cm), and the value on the gap side of its slider, so
// the knobs stay at least 1 deg from the handle.
const CELL_SLIDER_Y = 0.7 // dimmer cell: slider on top, value under it
const CELL_VALUE_Y = -5.1
// Button row with More open: Eye height 14, Save results 10.5, More 10.5, Paper art 8.5 and
// 2 cm gaps = 49.5 cm, centred: the three-button row shifts left, Paper art on the right.
const MAIN_ROW_SHIFT = -5.25
const PAPER_ART_X = 20.5
const TEXT_PRIMARY = new vec4(1, 1, 1, 1)
const TEXT_SMALL = new vec4(1, 1, 1, 0.75)

/** Text size as em height in cm. */
function applyEm(t: Text, emCm: number, weight: number = 500): void {
  t.size = emCm * 43.886
  ;(t as Text & {weight?: number}).weight = weight
}

export type LightValue = {light: number; value: number}

type ButtonSpec = {name: string; label: string; hint?: string; width: number; toggle?: boolean}

/**
 * Controls for Glare Zone, built from UIKit, on a near panel about 1 m in front of the
 * start position and below the eye line (the controller anchors it to the eye height).
 *
 * Opening view: three buttons (eye height, save results, more controls). "More controls"
 * adds a dimmer and a distance slider per light, each with its value beside it, and a
 * "Paper art" toggle (50 lux limit). "Save results" switches to the results view with
 * "Done" and "Restart" as clear exits.
 * The controller pushes state in with set* methods and listens to the on* events.
 */
@component
export class GlareZoneUI extends BaseScriptComponent {
  private _onEyeCycle = new Event<void>()
  private _onPaperArt = new Event<boolean>()
  private _onSave = new Event<void>()
  private _onDone = new Event<void>()
  private _onRestart = new Event<void>()
  private _onMore = new Event<boolean>()
  private _onDimmer = new Event<LightValue>()
  private _onDistance = new Event<LightValue>()
  private _onAdjust = new Event<void>()

  get onEyeCycle(): PublicApi<void> {
    return this._onEyeCycle.publicApi()
  }
  get onPaperArt(): PublicApi<boolean> {
    return this._onPaperArt.publicApi()
  }
  get onSave(): PublicApi<void> {
    return this._onSave.publicApi()
  }
  get onDone(): PublicApi<void> {
    return this._onDone.publicApi()
  }
  get onRestart(): PublicApi<void> {
    return this._onRestart.publicApi()
  }
  get onMore(): PublicApi<boolean> {
    return this._onMore.publicApi()
  }
  get onDimmer(): PublicApi<LightValue> {
    return this._onDimmer.publicApi()
  }
  get onDistance(): PublicApi<LightValue> {
    return this._onDistance.publicApi()
  }
  /** Fires while any slider is being moved, so the zones show at full strength. */
  get onAdjust(): PublicApi<void> {
    return this._onAdjust.publicApi()
  }

  private mainRow!: SceneObject
  private resultsRow!: SceneObject
  private moreGroup!: SceneObject
  private eyeLabel!: Text
  private moreLabel!: Text
  private paperArtButton!: Button
  private paperArtObj!: SceneObject
  private dimmerSliders: Slider[] = []
  private distanceSliders: Slider[] = []
  private dimmerLabels: Text[] = []
  private distanceLabels: Text[] = []
  private quiet = false
  private moreOpen = false
  private results = false
  // Rows are only hidden once every UIKit element in them has initialised: an element
  // disabled before its OnStart never initialises.
  private pendingInit = 0
  private ready = false
  private distanceRange = {min: 30, max: 150}

  onAwake(): void {
    this.sceneObject.createComponent("Component.Canvas")
    this.mainRow = this.buildRow("Main buttons", 0, [
      {name: "Eye height button", label: "Eye height: Standing", hint: "click to change", width: 14},
      {name: "Save results button", label: "Save results", width: 10.5},
      {name: "More button", label: "More controls", width: 10.5},
    ])
    this.resultsRow = this.buildRow("Results buttons", 0, [
      {name: "Done button", label: "Done", hint: "keep these lights", width: 13},
      {name: "Restart button", label: "Restart", hint: "standard placement", width: 15},
    ])
    this.buildMoreGroup()
  }

  private trackInit(element: Button | Slider): void {
    this.pendingInit++
    element.onInitialized.add(() => {
      this.pendingInit--
      if (this.pendingInit === 0) {
        this.ready = true
        this.applyVisibility()
      }
    })
  }

  /** True once every control has initialised and the opening layout is applied. */
  isReady(): boolean {
    return this.ready
  }

  // ---------------------------------------------------------------- state in

  setDistanceRange(min: number, max: number): void {
    this.distanceRange = {min, max}
  }

  setEyeHeightName(name: string): void {
    if (this.eyeLabel) this.eyeLabel.text = `Eye height: ${name}`
  }

  setPaperArt(on: boolean): void {
    if (this.paperArtButton) this.paperArtButton.isOn = on
  }

  setMoreOpen(open: boolean): void {
    this.moreOpen = open
    this.applyVisibility()
  }

  isMoreOpen(): boolean {
    return this.moreOpen
  }

  /**
   * The "More controls" group, so the controller can hang it on its own panel: under the
   * print it sits above the answer card, not between the card and the buttons.
   */
  moreGroupObject(): SceneObject {
    return this.moreGroup
  }

  /** Results view: Done and Restart replace the main buttons. */
  setResultsMode(on: boolean): void {
    this.results = on
    this.applyVisibility()
  }

  isResultsMode(): boolean {
    return this.results
  }

  /** Move a slider to match the light without echoing an onDistance event. */
  setDistance(light: number, cm: number): void {
    const s = this.distanceSliders[light]
    const r = this.distanceRange
    const v = Math.min(1, Math.max(0, (cm - r.min) / (r.max - r.min)))
    if (s && Math.abs(s.currentValue - v) > 1e-4) {
      this.quiet = true
      s.currentValue = v
      this.quiet = false
    }
    if (this.distanceLabels[light]) this.distanceLabels[light].text = `Distance ${Math.round(cm)} cm`
  }

  setDimmer(light: number, value: number): void {
    const s = this.dimmerSliders[light]
    if (s && Math.abs(s.currentValue - value) > 1e-4) {
      this.quiet = true
      s.currentValue = value
      this.quiet = false
    }
    if (this.dimmerLabels[light]) this.dimmerLabels[light].text = `Dimmer ${Math.round(value * 100)}%`
  }

  /** The value shown beside a slider ("Dimmer 100%", "Distance 81 cm"). */
  sliderValueText(kind: "dimmer" | "distance", light: number): string {
    const t = kind === "dimmer" ? this.dimmerLabels[light] : this.distanceLabels[light]
    return t && t.getSceneObject().isEnabledInHierarchy ? t.text : ""
  }

  // ---------------------------------------------------------------- builders

  private applyVisibility(): void {
    if (!this.mainRow || !this.ready) return
    this.mainRow.enabled = !this.results
    this.resultsRow.enabled = this.results
    this.moreGroup.enabled = this.moreOpen && !this.results
    // With More open, "Paper art" joins the button row on the right and the row shifts left.
    const more = this.moreOpen && !this.results
    this.paperArtObj.enabled = more
    this.mainRow.getTransform().setLocalPosition(new vec3(more ? MAIN_ROW_SHIFT : 0, 0, 0))
    if (this.moreLabel) this.moreLabel.text = this.moreOpen ? "Fewer controls" : "More controls"
  }

  private buildRow(name: string, y: number, specs: ButtonSpec[]): SceneObject {
    const total = specs.reduce((s, b) => s + b.width, 0) + LAYOUT.buttonGap * (specs.length - 1)
    const row = global.scene.createSceneObject(name)
    row.setParent(this.sceneObject)
    row.getTransform().setLocalPosition(new vec3(0, y, 0))
    const flex = row.createComponent(FlexLayout.getTypeName()) as FlexLayout
    flex.direction = FlexDirection.Row
    flex.justifyContent = FlexJustify.Center
    flex.alignItems = FlexAlign.Center
    flex.columnGap = LAYOUT.buttonGap
    flex.width = total
    flex.height = LAYOUT.buttonHeight
    const items: FlexItem[] = []
    for (const spec of specs) {
      const so = global.scene.createSceneObject(spec.name)
      so.setParent(row)
      const button = so.createComponent(Button.getTypeName()) as Button
      const w = spec.width
      button.onInitialized.add(() => {
        button.size = new vec3(w, LAYOUT.buttonHeight, 1)
      })
      if (spec.toggle) button.setIsToggleable(true)
      this.trackInit(button)
      const label = this.addButtonLabel(so, spec.label, spec.hint, w)
      const item = so.createComponent(FlexItem.getTypeName()) as FlexItem
      item.overrideWidth = w
      item.overrideHeight = LAYOUT.buttonHeight
      items.push(item)
      this.wireButton(spec.name, button, label)
    }
    flex.autoDiscoverItemsOnStart = false
    flex.addItems(items)
    return row
  }

  private wireButton(name: string, button: Button, label: Text): void {
    if (name === "Eye height button") {
      this.eyeLabel = label
      button.onTriggerUp.add(() => this._onEyeCycle.invoke())
    } else if (name === "Save results button") {
      button.onTriggerUp.add(() => this._onSave.invoke())
    } else if (name === "More button") {
      this.moreLabel = label
      button.onTriggerUp.add(() => {
        this.setMoreOpen(!this.moreOpen)
        this._onMore.invoke(this.moreOpen)
      })
    } else if (name === "Paper art button") {
      this.paperArtButton = button
      button.onTriggerUp.add(() => this._onPaperArt.invoke(button.isOn))
    } else if (name === "Done button") {
      button.onTriggerUp.add(() => this._onDone.invoke())
    } else if (name === "Restart button") {
      button.onTriggerUp.add(() => this._onRestart.invoke())
    }
  }

  /** The main label on a button face, with an optional small hint line under it. */
  private addButtonLabel(parent: SceneObject, label: string, hint: string | undefined, widthCm: number): Text {
    if (!hint) return this.makeLabel(parent, "Label", label, LAYOUT.buttonEm, 0, widthCm, TEXT_PRIMARY, 600)
    const main = this.makeLabel(parent, "Label", label, LAYOUT.buttonEm, 0.75, widthCm, TEXT_PRIMARY, 600)
    this.makeLabel(parent, "Hint", hint, LAYOUT.hintEm, -1.1, widthCm, TEXT_SMALL, 500)
    return main
  }

  private makeLabel(parent: SceneObject, name: string, text: string, em: number, y: number, widthCm: number,
    color: vec4, weight: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(new vec3(0, y, CONTENT_Z_OFFSET))
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyEm(t, em, weight)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-(widthCm - 0.5) / 2, (widthCm - 0.5) / 2, -em, em)
    t.textFill.color = color
    return t
  }

  /** A cell of a More column: its UIKit backing, created first so the controls draw on top. */
  private moreCell(col: SceneObject, name: string, backingName: string): SceneObject {
    const cell = global.scene.createSceneObject(name)
    cell.setParent(col)
    const backing = global.scene.createSceneObject(backingName)
    backing.setParent(cell)
    backing.getTransform().setLocalPosition(new vec3(0, 0, -0.4))
    const plate = backing.createComponent(BackPlate.getTypeName()) as BackPlate
    plate.size = new vec2(LAYOUT.columnWidth, LAYOUT.columnCellHeight)
    return cell
  }

  /**
   * Put the two cells of a light's column either side of a gap (column-local cm): the gap's
   * centre and half height, kept inside lo..hi. The controller sets it from where the aim
   * handle appears, so the handle shows through the gap and stays usable with More open.
   */
  setColumnGap(light: number, centreY: number, halfGap: number, lo: number, hi: number): void {
    const cells = this.columnCells[light]
    if (!cells) return
    const h = LAYOUT.columnCellHeight
    const g = Math.min(Math.max(centreY, lo + halfGap + h), hi - halfGap - h)
    cells[0].getTransform().setLocalPosition(new vec3(0, g + halfGap + h / 2, 0))
    cells[1].getTransform().setLocalPosition(new vec3(0, g - halfGap - h / 2, 0))
    this.columnGaps[light] = {centre: g, half: halfGap}
  }

  /** Where a light's column gap is now (column-local cm). */
  columnGap(light: number): {centre: number; half: number} {
    return this.columnGaps[light]
  }

  private columnCells: SceneObject[][] = []
  private columnGaps: {centre: number; half: number}[] = [{centre: 0, half: 0}, {centre: 0, half: 0}]

  /**
   * "More controls": a column beside the print for each light, on that light's side, in two
   * cells: the dimmer above the aim handle and the distance below it, each slider standing
   * upright (up is brighter, up is farther from the wall) with its value on the handle's side.
   * The columns sit beside the print, never over it, and leave the aim handle uncovered.
   * "Paper art" (the 50 lux limit) joins the button row. Spacing keeps every pinch target at
   * least 1 deg from the next.
   */
  private buildMoreGroup(): void {
    this.moreGroup = global.scene.createSceneObject("More controls group")
    this.moreGroup.setParent(this.sceneObject)
    const L = LAYOUT
    for (let light = 0; light < 2; light++) {
      const tag = light === 0 ? "L" : "R"
      const col = global.scene.createSceneObject(`More controls column ${tag}`)
      col.setParent(this.moreGroup)
      col.getTransform().setLocalPosition(new vec3((light === 0 ? -1 : 1) * L.columnX, 0, 0))
      const dimCell = this.moreCell(col, `More controls dimmer cell ${tag}`, `More controls dimmer backing ${tag}`)
      const distCell = this.moreCell(col, `More controls distance cell ${tag}`, `More controls distance backing ${tag}`)
      this.columnCells[light] = [dimCell, distCell]
      this.dimmerLabels[light] = this.looseText(dimCell, `Dimmer value ${tag}`, "Dimmer 100%", L.valueEm,
        new vec3(0, CELL_VALUE_Y, 0), L.columnWidth)
      const dim = this.slider(dimCell, `Dimmer slider ${tag}`, new vec3(0, CELL_SLIDER_Y, 0))
      this.distanceLabels[light] = this.looseText(distCell, `Distance value ${tag}`, "Distance 81 cm", L.valueEm,
        new vec3(0, -CELL_VALUE_Y, 0), L.columnWidth)
      const dist = this.slider(distCell, `Distance slider ${tag}`, new vec3(0, -CELL_SLIDER_Y, 0))
      this.setColumnGap(light, 0, 2.6, -L.columnHeight / 2, L.columnHeight / 2)
      this.dimmerSliders[light] = dim
      this.distanceSliders[light] = dist
      dim.currentValue = 1
      dim.onValueChange.add((v: number) => {
        this.dimmerLabels[light].text = `Dimmer ${Math.round(v * 100)}%`
        if (this.quiet) return
        this._onAdjust.invoke()
        this._onDimmer.invoke({light, value: v})
      })
      dist.onValueChange.add((v: number) => {
        if (this.quiet) return
        const r = this.distanceRange
        this._onAdjust.invoke()
        this._onDistance.invoke({light, value: r.min + v * (r.max - r.min)})
      })
      this.followWhileDragging(dim, (v) => {
        this.dimmerLabels[light].text = `Dimmer ${Math.round(v * 100)}%`
        this._onDimmer.invoke({light, value: v})
      })
      this.followWhileDragging(dist, (v) => {
        const r = this.distanceRange
        this._onDistance.invoke({light, value: r.min + v * (r.max - r.min)})
      })
    }
    // "Paper art" in the button row (shown with More open), to the right of More controls.
    const so = global.scene.createSceneObject("Paper art button")
    so.setParent(this.sceneObject)
    so.getTransform().setLocalPosition(new vec3(PAPER_ART_X, 0, 0))
    const button = so.createComponent(Button.getTypeName()) as Button
    button.onInitialized.add(() => {
      button.size = new vec3(L.paperArtWidth, L.buttonHeight, 1)
    })
    button.setIsToggleable(true)
    this.trackInit(button)
    const label = this.addButtonLabel(so, "Paper art", "50 lux limit", L.paperArtWidth)
    this.wireButton("Paper art button", button, label)
    this.paperArtObj = so
  }

  /** Text in a column (on the column's backing), centred. */
  private looseText(parent: SceneObject, name: string, text: string, em: number, pos: vec3, w: number): Text {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(pos)
    const t = so.createComponent("Component.Text") as Text
    t.text = text
    t.depthTest = true
    applyEm(t, em, 600)
    t.horizontalAlignment = HorizontalAlignment.Center
    t.verticalAlignment = VerticalAlignment.Center
    t.horizontalOverflow = HorizontalOverflow.Overflow
    t.verticalOverflow = VerticalOverflow.Overflow
    t.layoutRect = Rect.create(-w / 2, w / 2, -em, em)
    t.textFill.color = TEXT_PRIMARY
    return t
  }

  /**
   * A thin track with a knob big enough to pinch, sized before the slider initialises,
   * standing upright (turned 90 deg, so its value grows upward).
   */
  private slider(parent: SceneObject, name: string, pos: vec3): Slider {
    const so = global.scene.createSceneObject(name)
    so.setParent(parent)
    so.getTransform().setLocalPosition(pos)
    so.getTransform().setLocalRotation(quat.angleAxis(Math.PI / 2, vec3.forward()))
    const slider = so.createComponent(Slider.getTypeName()) as Slider
    slider.size = new vec3(LAYOUT.sliderLength, LAYOUT.sliderTrack, 1)
    slider.customKnobSize = true
    slider.knobSize = new vec2(LAYOUT.sliderKnob, LAYOUT.sliderKnob)
    this.trackInit(slider)
    return slider
  }

  /**
   * UIKit sliders move only their knob while dragged and commit the value on release.
   * To update the zones while dragging, follow the knob's position every frame of a drag.
   */
  private followWhileDragging(slider: Slider, emit: (value: number) => void): void {
    const state = {dragging: false, last: -1}
    slider.onInitialized.add(() => {
      slider.interactable.onDragStart.add(() => {
        state.dragging = true
        state.last = slider.knobValue
      })
      const stop = () => (state.dragging = false)
      slider.interactable.onDragEnd.add(stop)
      slider.interactable.onTriggerCanceled.add(stop)
    })
    this.createEvent("UpdateEvent").bind(() => {
      if (!state.dragging) return
      const v = slider.knobValue
      if (Math.abs(v - state.last) < 1e-4) return
      state.last = v
      this._onAdjust.invoke()
      emit(v)
    })
  }
}
