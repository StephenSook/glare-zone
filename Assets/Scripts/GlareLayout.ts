// GlareLayout: where things live, in centimetres. One table so placement can be tuned in
// one place.
//
// Wall-local: x runs along the wall (0 = the print's centre line), y is height above the
// floor, z is distance out from the wall.
//
// Near panels: the answer card and the controls sit about 1 m in front of the start
// position (Snap: detailed content is most comfortable at about 1 m) and are anchored to
// the eye height, so they stay in view at every eye-height preset. Their numbers are in
// panel-local cm, 1 m from the eye.
//
// Measured in Lens Studio 5.23.2 with the SPECS 27 preview: vertical field of view
// 0.6386 rad (36.6 deg), frame about 0.95 wide per 1 tall (about 35 deg across). At 1 m
// that is about +-33 cm up and down and +-31 cm across. Panels stay within about +-14 deg
// across (+-25 cm at 1 m), clear of the display's monocular side regions.
//
// Pinch targets (Snap sizing guide): at least 2 deg across and at least 1 deg apart.
// At about 1 m: 3.5 cm and 1.75 cm. At 3 m: 10.5 cm and 5.2 cm.

export const LENS_VERSION = "v0.4"

export const LAYOUT = {
  startDistanceCm: 300, // the user starts this far back from the wall

  wallWidth: 400,
  wallHeight: 300,

  // Text on the wall and floor, as em height in cm, sized for reading from 3 m.
  smallEm: 3.0,
  floorLabelEm: 5.0,

  // Aim handles: one per light, just outside each side of the frame, centre 150 cm high.
  // 12 cm at about 2.9 m is 2.4 deg, over the 2 deg minimum.
  handleX: 63,
  handleY: 150,
  knobSize: 12,
  knobOut: 10, // how far the knob stands off the wall

  // Eye-height marks either side of the print.
  bandLength: 6,
  bandHeight: 3,

  // "Seated: glare here" beside a glare spot, read from the zone (about 0.6 to 1 m).
  spotLabelEm: 1.8,

  // ------------------------------------------------------------ near panels (1 m)
  panelDistanceCm: 100,

  // Answer card above the eye line: the headline answer, the disclosure, the legend
  // (one line per eye height with a small floor map) or, after saving, the results.
  answerY: 22.5, // centre, cm above the eye: the card's lower edge clears the print's top
  answerWidth: 48,
  answerHeight: 17,
  headlineEm: 1.35,
  disclaimerEm: 0.8,
  legendEm: 0.85,
  legendSmallEm: 0.72,
  versionEm: 0.65,

  // Controls below the eye line. Row centres are panel-local (main row at 0).
  controlsY: -24.5, // the main button row, cm below the eye
  buttonHeight: 4.5, // 2.5 deg at about 1 m
  buttonGap: 2, // 1.1 deg at about 1 m
  buttonEm: 1.0,
  hintEm: 0.75,
  // "More controls" columns, one per light, beside the print: between the frame's edge
  // (10.4 deg) and 14 deg out, within 35.3 cm centred at columnYAbove (card above the print)
  // or columnYBelow (card under the print), cm from the eye at 1 m. The aim handles appear
  // at the same angle (about 11.9 deg out), so each column is two cells, dimmer above and
  // distance below, with a gap where the handle appears (its 12 cm knob is about 4.1 cm at
  // 1 m) plus handleClearCm either side.
  columnX: 21.65,
  columnWidth: 6.5,
  columnHeight: 35.3,
  columnYAbove: -4.25, // between the card's lower edge (+13.9) and the buttons' top (-22.25)
  columnYBelow: 12.65, // between the card's top (-5.7) and ...
  columnTopBelow: 19.0, // ... 17.6 deg up (+31.65), column-local, when the card is under the print
  columnCellHeight: 12.4,
  handleClearCm: 0.5,
  sliderLength: 6,
  sliderTrack: 1.2, // a thin track ...
  // ... with a knob big enough to pinch: 3.8 cm measured 1.98 deg at the panel's corner
  // (LEAF C8), so 4.2 cm (about 2.3 deg).
  sliderKnob: 4.2,
  valueEm: 0.8,
  paperArtWidth: 8.5,

  // Results cards, one per light, in the answer card after "Save results".
  cardWidth: 23,
  cardX: 12,
  cardY: -2.8, // under the verdict and the disclosure (item D)
  cardEm: 0.8,
  cardSmallEm: 0.68,

  // "Below" layout, for low eyes (Seated, Child seated, a low "My eyes"): from 3 m the print
  // fills the top half of the view, so the answer card goes under the print and the buttons
  // under the card. "More controls" open in the columns beside the print, as at Standing.
  answerYBelow: -14.2,
  controlsYBelow: -29,
  belowEnterEyeCm: 140, // "My eyes" switches to the below layout under 140 cm ...
  belowExitEyeCm: 145, // ... and back above 145 cm (no flicker at the threshold)

  // Lazy follow: the near panels stay put until the viewer moves more than the dead zone,
  // then glide (spring-damped, about half a second) to sit in front of them again. Close
  // to the wall the panels come nearer and scale down with the distance, so they keep the
  // same angular size and stay this far in front of the wall. Position only: turning the
  // head never moves them.
  followDeadZoneCm: 25,
  followSmoothS: 0.45,
  panelWallClearanceCm: 15,
  panelMinDistanceCm: 40,

  // Floor.
  viewingHalfWidth: 100,
}
