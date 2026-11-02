# Film stills (Lens Studio 5.23.2 preview, SPECS 27 device, 1505 x 1590 px)

Each still is the preview panel's own screenshot (PreviewPanelTool screenshot) with Lens Studio maximized and LEAF's on-screen log camera switched off by the media helper (`hideLeafOverlay`). The preview camera is reset (MovePreviewCamera reset) before each helper runs; a pitch in the note is a MovePreviewCamera rotate from that reset pose. Sample lamp values, computed reflection: the Lens labels them so on screen.

All seven stills are v0.3.3 (BUILD_LOG row 8). 02, 04 and 07 show the row 8 floor view; 01, 03, 05 and 06 were retaken at v0.3.3 after row 8 with the same helpers and camera moves.

- `01_opening_view.png`: refresh the preview (no helper): headline, legend with the floor map, the print, the two aim handles, the buttons.
- `02_seated_zone_reaches_viewing_area.png`: run LEAF helper `media-seated` (standard placement, 80.8 cm, Seated chosen with the Eye height button), then rotate pitch -18: the answer card ("Seated viewers see glare up to 73.5 cm from the wall") above the floor, where the filled Seated zone crosses the bold near edge and the red fill and "Seated: glare inside the viewing area" show.
- `03_in_seated_zone_glare_spot.png`: run `media-in-zone` (Seated, stepped to 12 cm inside the seated zone), then MovePreviewCamera rotate pitch +48: two glare spots labelled "Seated: glare here", the lamp rays down to them, the faint ghost lamps.
- `04_lights_at_62cm_all_clear.png`: run `media-film-04` (Seated, both lights slid to 62 cm), then rotate pitch -18: headline "Seated viewers see glare up to 56.4 cm from the wall"; on the floor the Seated zone stops short of the bold near edge and the status reads "Seated: clear".
- `05_my_eyes_crouched_zone_follows.png`: run `media-film-05` (My eyes chosen), then MovePreviewCamera move down 40: headline "Your eyes (120 cm) see glare up to 64.6 cm from the wall", the My eyes line in the legend; the card sits under the print (eyes under 140 cm).
- `06_saved_results_done_restart.png`: run `media-saved-sheet` (both lights at 62 cm, Save results): one results card per light, Done and Restart.
- `07_floor_overlap_seated.png`: run `media-film-07` (standard placement, 80.8 cm, Seated), then rotate pitch -30 (a glance down): the filled Seated zone with "Seated: glare up to 73.5 cm from the wall", Standing and Child seated as faint outlines, the viewing area as a light band with its bold near edge "Viewing area starts 60 cm from the wall", and the red fill from 60 to 73.5 cm with "Seated: glare inside the viewing area".
