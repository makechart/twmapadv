# @makechart/twmapadv

縣市內的鄉鎮 / 村里地圖。地圖資料來自 `pdmaptw` ( 2.4.0 起的各縣市村里檔 )。

block data `level` 決定畫哪兩層 ( 程式與資料的維度一律叫上層 `town`、下層 `village` ):

| level | 上層 / 下層 | 地圖檔 ( pdmaptw >= 2.6.0 ) |
| --- | --- | --- |
| `town` | 縣市 / 鄉鎮 ( 全國 ) | `town.map.js`, 上層是它的 `objects.county` |
| `county/<縣市>` ( 預設 `county/臺北市` ) | 鄉鎮 / 村里 | `county/<縣市>.village.map.js`, 上層是它的 `objects.town` |
| `county/<縣市>/<鄉鎮>` | 該鄉鎮 / 它的村里 | 同上, 只留這個鄉鎮 ( 名稱或 8 碼代碼 ) |

維度在編輯器裡的名稱依層級顯示 ( 全國是縣市 / 鄉鎮 ). 下層名稱可以帶上層的名字 ( `臺北市中正區` ).
地圖範圍不含遠方的小島 ( 例如東沙、南沙 ), 範圍外的部分會被裁掉.

鄉鎮的形狀用村里檔裡的 `objects.town` ( pdmaptw 2.5.0 起, 由村里合成、與村里共用 arc ), 不用鄉鎮檔:
兩個檔來自不同的 shapefile、各自簡化, 界線對不上, 一起畫時會錯開.
村里檔沒有 `objects.town` 時 ( 2.4.0 ) 在執行時由村里合成: 那一版的村里界在外框上不一定接在同一點
( 差約 10m, 約一半的鄉鎮有 ), 合併後斷開的線依端點最近的接回去. 全縣市合起來幾 ms.
鄉鎮檔只在沒有村里檔時使用.

立體: 每一格依當下的角度把每塊沿深度切成窄帶, 由遠而近畫, 同一帶裡由低到高; 側面只畫高出前方鄰居的部分.
行政區不是凸的, 整塊排序在互相嵌合的地方 ( 例如士林、北投 ) 會畫錯. 轉場 ( 高度、顏色、形狀、視角 ) 也是
每一格重畫, 轉動中也能轉場. 淡化在立體時改成往背景色混, 不用半透明.


## 資料

| 維度 | 型別 | 說明 |
| --- | --- | --- |
| `town` | N | 鄉鎮名 ( `大安區` / `臺北市大安區` 皆可, 臺 / 台 不拘 ) 或 8 碼代碼. 也可以是 11 碼村里代碼 ( 見下 ) |
| `village` | N | 村里名或 11 碼代碼. 空白或 `全區` / `總計` / `合計` 的那一列就是鄉鎮值 |
| `value` | R | 數值: 熱度顏色、立體高度 |
| `size` | R | 大小: 泡泡、cartogram 面積. 沒綁時用 `value` |
| `cat` | C | 分類: 顏色 ( `color-by: cat` 或沒有 `value` 時 ) |
| `parts` | R, 多欄 | 比例: 泡泡模式下兩欄以上畫成圓餅 |

沒有「全區」列的鄉鎮, 依 `village.aggregate` ( sum / mean / none ) 由村里算出.
只有鄉鎮資料時不綁 `village` 即可.

`town` 欄是 11 碼村里代碼時, 每一列就是一個村里, 鄉鎮由村里匯總. 這是給只有一欄 key 的來源用的
( 例如 dashboard 以村里 groupby ): 點鄉鎮時發出的 filter 是它底下所有村里的代碼.


## 模式

 - `mode`: `map` / `cartogram` ( 連續型, Dougenik 1985 ) / `bubble` ( Dorling )
 - `extrude.enabled`: 立體. 有底板, 高度 = 數值; `extrude.rotate` 為 `drag` / `auto` / `both` ( 自動轉, 拖曳時暫停 ) / `none`
 - `village.mode`: `click` ( 點鄉鎮展開村里; 再點一次取消選取、或點空白處收合. 資料裡沒有村里列時不展開, 點選只發篩選 ) / `all` / `none`.
   `village.zoom`: 展開時放大到那個鄉鎮, 色條改顯示村里的範圍
 - `heat`: `sequential` / `diverging` ( 中點 median / mean / manual, 可對稱 ), `steps` 分級;
   刻度 `linear` / `log` ( 跨好幾個數量級時 ) / `pow` / `quantile` ( 依名次, 偏斜的資料也會用滿色階 )
 - `bubble`: 重疊或排開, 排開時可畫虛線連到行政區中心; 有無底圖;
   圓餅 `side` ( 左右上下依序 ) / `desc` ( 由大到小, 12 點鐘起順時針 ) / `none`
 - `filter-level`: crossfilter 發 `town`, 或 `town` + `village`. 沒選到的依 `common.subset.opacity` 淡化
 - subset ( dashboard compare 的分子, `common.subset.mode` ): `dim` 子集裡為 0 的淡化;
   `partial` 泡泡 / 圓餅畫出子集比例的內圈, 行政區塊沒有可切的維度, 退回 dim; `shrink` 直接用子集的值.
   注意: 核心目前只用一個維度 ( `town` ) 對齊子集, 有村里列時同一鄉鎮的村里會對到同一列
 - legend ( 分類 / 圓餅欄位 ) 關掉的項目依 `legend.subset.mode`: `shrink` 拿掉, `dim` 淡化


## 範例資料

每個縣市一個 `src/sample/<縣市>.json`, 全國是 `src/sample/全國.json` ( build 時複製到 `dist/sample/` ),
`sample()` 執行時才依 `level` 載入那一個 ( 單一鄉鎮從縣市檔篩出 ) ( 網址由 block manager 照 registry 規則組出 ). 由 `tool/sample.js` 產生
( 內政部戶政司 ODRP014 村里戶數、單一年齡人口; 面積取自 pdmaptw ):

    node tool/sample.js 11409 ../../../plotdb/projects/pdmaptw                 # 全部縣市
    node tool/sample.js 11409 ../../../plotdb/projects/pdmaptw --csv <目錄>    # 另出 builtin-datasets 的 CSV

人口資料與地圖界線的版本不同時, 地圖上沒有的村里會略過 ( 列在輸出裡 ), 人口仍算進鄉鎮的「全區」.
`--csv` 輸出 `taipei-village-population.csv` 與 `taiwan-town-population.csv`, 放在 makechart server 的
`module/makechart/builtin-datasets/data/`.


## 測試

    npm run test:dev          # 連本地的 pdmaptw / base / @plotdb/chart
    npm run test:dev:serve    # UI 與 /playground
