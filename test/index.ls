# twmapadv 的 test case ( @makechart/viewer 的 mctest )
# 臺北市各區代碼與村里代碼的最大號 ( 有缺號, 圖表會略過不存在的代碼 )
towns =
  "63000010": [\松山區, 35], "63000020": [\信義區, 41], "63000030": [\大安區, 57]
  "63000040": [\中山區, 42], "63000050": [\中正區, 31], "63000060": [\大同區, 26]
  "63000070": [\萬華區, 36], "63000080": [\文山區, 43], "63000090": [\南港區, 20]
  "63000100": [\內湖區, 40], "63000110": [\士林區, 51], "63000120": [\北投區, 42]
cats = <[甲 乙 丙]>
# 每份資料用自己的種子
mk = (seed = 1, opt = {}) ->
  rnd = mctest.random seed
  rows = []
  for code, [name, n] of towns
    row = (v) ->
      val = Math.round(rnd! * 1000) / 10
      [m, f] = [Math.round(rnd! * 3000 + 500), Math.round(rnd! * 3000 + 500)]
      {town: name, village: v, val, pop: m + f, m, f, old: Math.round(rnd! * 1500), cat: cats[Math.floor(rnd! * 3)]}
    if !opt.no-town => rows.push row(\全區)
    if !opt.no-village => for i from 1 to n => rows.push row("#code#{"#i".padStart(3, '0')}")
  raw: rows
  binding: {
    town: {key: \town}
    value: {key: \val, unit: \%}
    size: {key: \pop}
    cat: {key: \cat}
    parts: [{key: \m, name: \男}, {key: \f, name: \女}]
  } <<< (if opt.no-village => {} else {village: {key: \village}})

click = (idx, shift = false) -> (c, ctx) ->
  n = ctx.root.querySelectorAll('g.unit.town path.top')[idx]
  n.dispatchEvent new MouseEvent(\click, {bubbles: true, shift-key: shift})

# legend 的第 idx 項 ( 依 legend 排序後 )
legend-click = (idx) -> (c, ctx) ->
  n = ctx.root.querySelectorAll('.pdlg-g')[idx]
  n.dispatchEvent new MouseEvent(\click, {bubbles: true})

# 展開的村里裡的第 idx 個
click-village = (idx) -> (c, ctx) ->
  n = ctx.root.querySelectorAll('g.unit.village:not([style*=none]) path.top')[idx]
  n.dispatchEvent new MouseEvent(\click, {bubbles: true})

# 載入這個層級的範例資料 ( 全國 / 單一鄉鎮 )
# 載不到 ( 例如 build 之前才產生的檔 ) 時會是空資料, 地圖照樣畫得出來, 所以要檢查
national = (c) -> c.mod.sample!then (d) ->
  if d.raw.length < 5 => throw new Error("範例資料只有 #{d.raw.length} 列")
  c.set-raw d.raw, d.binding

# 外部篩選後的子集 ( dashboard 給的 ), schema 與 raw 相同.
# 核心目前只用一個維度對齊 ( 這張圖是 town ), 所以 subset 的 case 只用鄉鎮資料
subset-of = (d, seed = 9) ->
  r = mctest.random seed
  d.subset = d.raw.map (row, i) ->
    k = if i % 3 == 0 => 0 else r!
    {town: row.town, val: +(row.val * k).toFixed(1), pop: Math.round(row.pop * k), m: Math.round(row.m * k), f: Math.round(row.f * k)}
  d

# chart.interactions! ( 哪個操作會發哪幾維的 filter ) 要等於 want
interactions-is = (want) -> (c) ->
  got = JSON.stringify c.interactions!
  if got != JSON.stringify(want) => throw new Error("interactions: #got, 應為 #{JSON.stringify want}")

mctest.suite do
  size: [480, 480]
  normalize: [[/tmap-grad-[a-z0-9]+/g, "tmap-grad-x"], [/tmap-clip-[a-z0-9]+/g, "tmap-clip-x"]]
  data:
    full: mk 1
    town: mk 2, {no-village: true}
    agg: mk 3, {no-town: true}
    subset: subset-of(mk 5, {no-village: true})
    # dashboard 以村里 groupby 時只有一欄 key: town 欄就是 11 碼村里代碼
    vcode: do ->
      d = mk 7, {no-town: true}
      d.raw.map -> it.town = it.village
      d.binding = {town: {key: \town}, value: {key: \val, unit: \%}, size: {key: \pop}}
      d
    three: (mk 4) <<< binding: {
      town: {key: \town}, village: {key: \village}, size: {key: \pop}
      parts: [{key: \m, name: \男}, {key: \f, name: \女}, {key: \old, name: \老}]
    }
  cases:
    * name: "value", data: \full
    * name: "cat", data: \full, config: {color-by: \cat}
    * name: "town-only", data: \town
    * name: "aggregate", data: \agg
    * name: "diverging", data: \full, config: {heat: {mode: \diverging, center: {mode: \manual, value: 30}, symmetric: false}}
    * name: "log-steps", data: \full, config: {heat: {scale: \log, steps: 5}}
    * name: "village-all", data: \full, config: {village: {mode: \all}}
    * name: "village-label", data: \full, config: {village: {mode: \all}, label: {village: true}}
    * name: "cartogram", data: \full, config: {mode: \cartogram}
    # 依村里變形. 資料含簡化時消失的里 ( 面積 0 ), 曾讓整張圖完全不動
    * name: "cartogram-village", data: \full, config: {mode: \cartogram, village: {mode: \all}}
    * name: "extrude", data: \full, config: {extrude: {enabled: true, rotate: \none}}
    # 立體 + 全村里: 切帶、側面只畫高出鄰居的部分
    * name: "extrude-village", data: \full, config: {village: {mode: \all}, extrude: {enabled: true, rotate: \none, angle: 120}}
    * name: "extrude-cartogram", data: \full, config: {mode: \cartogram, extrude: {enabled: true, rotate: \none, angle: 40}}
    * name: "bubble", data: \full, config: {mode: \bubble}
    * name: "bubble-overlap", data: \full, config: {mode: \bubble, bubble: {overlap: true}}
    * name: "bubble-nobase", data: \full, config: {mode: \bubble, bubble: {basemap: false, leader: false}}
    * name: "pie-desc", data: \full, config: {mode: \bubble, bubble: {pie: \desc}}
    * name: "pie-three", data: \three, config: {mode: \bubble}
    * name: "border", data: \full, config: {border: {color: \#000, width: 2, linejoin: \bevel}}
    * name: "legend-bottom", data: \full, config: {legend: {position: \bottom}}
    * name: "click", data: \full, steps: [click(2)]
    * name: "click-shift", data: \full, steps: [click(2), click(5, true)]
    # 只有鄉鎮資料: 點選只發篩選, 不展開成沒有值的村里
    * name: "click:town-only", data: \town
      steps:
        click(2)
        (c, ctx) ->
          n = ctx.root.querySelectorAll('g.unit.town path.top')[2]
          if n.parentNode.style.display == \none => throw new Error("展開成村里了")
          if !((c.binding.town.filter or {}).value or []).length => throw new Error("沒有發篩選")
    # 點選發 town ( filter-level 是村里時連 village ); 不是核心預設的 name
    * name: "interactions:town", data: \full, steps: [interactions-is {click: <[town]>}]
    * name: "interactions:village", data: \full, config: {filter-level: \village}, steps: [interactions-is {click: <[town village]>}]
    * name: "click-village-filter", data: \full, config: {filter-level: \village}, steps: [click(2), click-village(3)]
    * name: "subset:dim", data: \subset, config: {common: {subset: {mode: \dim}}}
    * name: "subset:partial", data: \subset, config: {common: {subset: {mode: \partial}}}
    * name: "subset:partial-bubble", data: \subset, config: {mode: \bubble, common: {subset: {mode: \partial}}}
    * name: "subset:shrink-bubble", data: \subset, config: {mode: \bubble, common: {subset: {mode: \shrink}}}
    * name: "legend:dim", data: \full, config: {color-by: \cat, legend: {subset: {mode: \dim}}}, steps: [legend-click(0)]
    * name: "legend:shrink", data: \full, config: {color-by: \cat}, steps: [legend-click(0)]
    * name: "legend:pie-dim", data: \full, config: {mode: \bubble, legend: {subset: {mode: \dim}}}, steps: [legend-click(0)]

    # 外部 filter -> 沒選到的變淡; 再清掉
    * name: "filter:external"
      steps:
        * (c, ctx) ->
            c.filter {town: {type: \index, value: <[大安區 信義區]>}}
            ctx.snap \filtered
        * (c) -> c.filter {town: undefined}

    # 點擊要對外發 filter ( 鄉鎮 ), filter-level 為 village 時另發村里
    * name: "filter:emit"
      steps:
        * (c, ctx) ->
            c._mctest-filter = []
            c.on \filter, -> c._mctest-filter.push it
            click(2)(c, ctx)
        * (c) ->
            f = c._mctest-filter[* - 1]
            if !(f and f.town and f.town.value.length == 1) => throw new Error("點擊之後沒有發鄉鎮的 filter")
    * name: "filter:emit-village", config: {filter-level: \village}
      steps:
        * (c, ctx) ->
            c._mctest-filter = []
            c.on \filter, -> c._mctest-filter.push it
            click(2)(c, ctx)
        * click-village(3)
        * (c) ->
            f = c._mctest-filter[* - 1]
            if !(f and f.village and f.village.value.length == 1 and f.town and f.town.value.length) =>
              throw new Error("點村里之後沒有發村里的 filter")

    # 換資料: 只剩部分鄉鎮
    * name: "update:new-data"
      steps: [(c) -> d = mk(6, {no-village: true}); d.raw = d.raw.slice(0, 5); c.set-raw d.raw, d.binding]

    * name: "quantile", data: \full, config: {village: {mode: \all}, heat: {scale: \quantile}}
    * name: "quantile-steps", data: \full, config: {heat: {scale: \quantile, steps: 4}}
    * name: "quantile-diverging", data: \full, config: {heat: {scale: \quantile, mode: \diverging, center: {mode: \manual, value: 30}}}

    # town 欄放村里代碼: 鄉鎮由村里匯總, 點鄉鎮要發出它底下所有村里的代碼 ( 同一個鄉鎮代碼開頭 )
    * name: "village-key", data: \vcode
    * name: "village-key:emit", data: \vcode
      steps:
        * (c, ctx) ->
            c._mctest-filter = []
            c.on \filter, -> c._mctest-filter.push it
            click(2)(c, ctx)
        * (c) ->
            vs = ((c._mctest-filter[* - 1] or {}).town or {}).value or []
            if !(vs.length > 1 and vs.every(-> /^\d{11}$/.test(it) and it.substring(0, 8) == vs.0.substring(0, 8))) =>
              throw new Error("點鄉鎮應發出它底下的村里代碼, 收到 #{JSON.stringify vs}")

    # 點鄉鎮放大到那個鄉鎮; 再點一次 ( 點到它的村里 ) 取消選取並還原
    * name: "zoom", data: \full, config: {village: {zoom: true}}, steps: [click(2)]
    * name: "zoom:collapse", data: \full, config: {village: {zoom: true}}, steps: [click(2), click-village(0)]
    * name: "zoom:extrude", data: \full, config: {village: {zoom: true}, extrude: {enabled: true, rotate: \none}}, steps: [click(2)]

    # 範例資料: sample() 執行時載入 dist/sample/臺北市.json
    * name: "sample"
      steps: [(c) -> c.mod.sample!then (d) -> c.set-raw d.raw, d.binding]

    # 全國 ( level: town ): 縣市 > 鄉鎮, 用鄉鎮檔與它的 objects.county. 資料是 dist/sample/全國.json
    * name: "national", block: {level: \town}, steps: [national]
    * name: "national:towns", block: {level: \town}, config: {village: {mode: \all}}, steps: [national]
    * name: "national:click", block: {level: \town}, steps: [national, click(5)]
    * name: "national:extrude", block: {level: \town}, config: {extrude: {enabled: true, rotate: \none}}, steps: [national]
    * name: "national:bubble", block: {level: \town}, config: {mode: \bubble}, steps: [national]
    # 單一鄉鎮 ( county/<縣市>/<鄉鎮> ): 只有它與它的村里. 旗津區含東沙、南沙, 範圍只看主要的區塊
    * name: "town:single", block: {level: 'county/臺北市/大安區'}, config: {village: {mode: \all}}, steps: [national]
    * name: "town:overflow", block: {level: 'county/高雄市/旗津區'}, config: {village: {mode: \all}}, steps: [national]
