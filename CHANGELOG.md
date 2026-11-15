# Change Logs

## v0.0.1

 - first release. town / village map of one Taiwan county ( block data `level`, e.g. `county/臺北市` ),
   on the lite base ( `@makechart/base` `lite/index.html` ) and `@plotdb/chart` `chart.anim`
 - maps from `pdmaptw` 2.5.0: only the village file is loaded; towns come from its `objects.town`,
   which shares the villages' arcs, so both levels line up
 - modes: `map`, `cartogram` ( contiguous, Dougenik 1985 ), `bubble` ( dorling, optionally pies with
   `side` / `desc` ordering, leader lines, with or without a basemap )
 - heat: sequential / diverging ( center median / mean / manual, symmetric ), `linear` / `log` / `pow` /
   `quantile`, optional steps; category coloring with the `@plotdb/chart` legend
 - 3d extrusion with a base plate; rotation `drag` / `auto` / `both`; drawn in depth bands each frame so
   interlocking districts stay correct, and animated by its own per-frame tween
 - villages: expand on click ( optionally zooming to the town ) or show all; `全區` rows give town values,
   missing ones are aggregated; the town column may also hold 11-digit village codes ( single-key sources )
 - crossfilter on town or town + village, `common.subset` ( dim / partial / shrink ), legend subset modes
 - per-county sample data ( 內政部戶政司 village population ), loaded on demand from `sample/<縣市>.json`
