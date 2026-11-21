# Change Logs

## v0.0.6

 - add `desc` ( en / zh-TW ) to the config items, shown under the label in the makechart style panel

## v0.0.5

 - fix bug: `filterDims` was not declared, so the core reported `name`, a dimension this chart doesn't have.
   it now returns what a click emits: `town`, plus `village` when `filter-level` is village with a village
   binding, or nothing without a town binding. a host driving `select` by `filterDims` stops treating `town`
   as a dimension the chart doesn't handle itself
 - declare `interactions` ( needs `@plotdb/chart` >= 3.16.0 ): click emits the dimensions above
 - add `interactions:*` test cases

## v0.0.4

 - `village.mode: click` no longer expands a town when the data has no village rows. expanding showed
   villages without values, so the town just picked looked cleared ( e.g. a dashboard with county data only ).
   clicking still emits the filter
 - add `click:town-only` test case


## v0.0.3

 - `pdmaptw` 2.7.0: finer village boundaries, and no village lost in simplification
 - tooltip stays at the upper left of the pointer and only flips where there is no room ( it used to jump
   around inside large regions ), without blank lines between rows
 - `tool/icon.js`: `--paths` writes the simplified town paths per county ( the site draws town icons with
   them ); the point budget counts only the arcs the towns use

## v0.0.2

 - more levels ( block data `level` ): `town` is the whole country, counties over towns, from the town
   file and its `objects.county`; `county/<縣市>/<鄉鎮>` is one town over its villages. needs `pdmaptw` 2.6.0
 - dimension names follow the level ( 縣市 / 鄉鎮 for the whole country )
 - the map extent leaves out far away islands ( 東沙 / 南沙 under 高雄市旗津區 ), which are clipped
 - national sample data `sample/全國.json`; a single town filters its county's sample
 - `tool/icon.js`: per-county chart icons for `@makechart/iconset`

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
