#!/usr/bin/env node
// 各縣市的圖表圖示: 鄉鎮簡化後平塗, 白色細邊, 相鄰的鄉鎮不同色. 給 makechart 的 @makechart/iconset
//
//   node tool/icon.js <pdmaptw dist 目錄> <iconset 的 src/flat 目錄>
//   e.g. node tool/icon.js ../../../plotdb/projects/pdmaptw/dist ../../server/module/makechart/iconset/src/flat
//
// 輸出 twmap-<縣市代碼>.svg ( 256x256, 與 iconset 其他圖示相同 ), 並更新同目錄的 index.json.
// --paths <檔案>: 另外輸出各縣市簡化、投影後的鄉鎮路徑 ( 與圖示相同的形狀與位置 ),
//   {<縣市代碼>: [[鄉鎮代碼, 鄉鎮名, d], ...]}. 網站的鄉鎮圖示用它在頁面上畫 ( 縣市灰底, 標出該鄉鎮 )
// 顏色用 icon-gen 的原色 ( teal / coral / gold + 兩種灰 ), iconset 的 build.ls 會換成 logo 色.
// 鄉鎮取自村里檔的 objects.town ( pdmaptw 2.5.0 起 ), 與村里共用 arc, 簡化後鄰接關係不變
const fs = require('fs');
const path = require('path');
const topojson = require('topojson-client');
const simplify = require('topojson-simplify');
// d3-geo 3 是 ESM, node 22 可以直接 require
const d3 = require('d3-geo');

const argv = process.argv.slice(2);
const pathsAt = argv.indexOf('--paths');
const pathsOut = pathsAt >= 0 ? argv.splice(pathsAt, 2)[1] : null;
const [src, out] = argv;
const allPaths = {};
if (!src || !out) {
  console.error('usage: node tool/icon.js <pdmaptw dist dir> <iconset src/flat dir>');
  process.exit(1);
}

const reg = {};
global.pdmaptw = { register: (k, d) => { reg[k] = d; } };
const files = fs.readdirSync(path.join(src, 'county')).filter((f) => /\.village\.map\.js$/.test(f));

// 尺寸與風格: 同 iconset 的 taiwan-town ( 256 見方, 白邊圓角 )
const SIZE = 256;
const PAD = 20;
const colors = ['#158b89', '#ec6948', '#dfac28', '#c8c8c8', '#d7d7d7'];
// 每個縣市留下的點數 ( 大約 ). 太多檔案變大, 太少形狀認不出來
const POINTS = 400;

const list = [];
for (const f of files.sort()) {
  const name = f.replace('.village.map.js', '');
  (new Function(fs.readFileSync(path.join(src, 'county', f), 'utf8')))();
  const d = reg[`county/${name}/village`];
  if (!(d && d.topo.objects.town)) { console.error(`${name}: no objects.town, skipped ( needs pdmaptw >= 2.5.0 )`); continue; }
  // 只留鄉鎮 ( 村里不畫 )
  let topo = { ...d.topo, objects: { town: d.topo.objects.town } };
  topo = simplify.presimplify(topo);
  let total = 0;
  for (const a of topo.arcs) total += a.length;
  topo = simplify.simplify(topo, simplify.quantile(topo, Math.max(0, 1 - POINTS / total)));
  const fc = topojson.feature(topo, topo.objects.town);
  // 範圍只看夠大的區塊 ( 佔全縣 1% 以上 ): 高雄市含東沙、南沙, 連江、金門有遠方的小島,
  // 全部框進來本島會縮成一點. 框外的小島不畫
  const polys = [];
  for (const ft of fc.features) {
    const g = ft.geometry;
    if (g) for (const p of (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)) polys.push({ type: 'Polygon', coordinates: p });
  }
  const sum = polys.reduce((a, p) => a + d3.geoArea(p), 0);
  const main = { type: 'GeometryCollection', geometries: polys.filter((p) => d3.geoArea(p) > sum * 0.01) };
  const proj = d3.geoMercator().fitExtent([[PAD, PAD], [SIZE - PAD, SIZE - PAD]], main);
  const gp = d3.geoPath(proj).digits(0);
  const inside = (p) => {
    const [[x0, y0], [x1, y1]] = gp.bounds({ type: 'Polygon', coordinates: p });
    return x0 >= 0 && y0 >= 0 && x1 <= SIZE && y1 <= SIZE;
  };
  // 太小的島 ( 畫出來不到 1.5px 見方 ) 不畫
  const feats = fc.features.map((ft) => {
    const g = ft.geometry;
    if (!g) return null;
    const polys = (g.type === 'Polygon' ? [g.coordinates] : g.coordinates)
      .filter((p) => inside(p) && gp.area({ type: 'Polygon', coordinates: p }) > 2.25);
    if (!polys.length) return null;
    return { code: ft.properties.code, geometry: { type: 'MultiPolygon', coordinates: polys }, area: 0 };
  });
  // 著色: 由大到小, 避開相鄰的顏色, 其中挑用得最少的 ( 同樣少時依代碼輪替, 結果固定 )
  const nb = topojson.neighbors(topo.objects.town.geometries);
  const used = colors.map(() => 0);
  const color = [];
  feats.forEach((ft, i) => { if (ft) ft.area = gp.area(ft.geometry); });
  const order = feats.map((ft, i) => i).filter((i) => feats[i]).sort((a, b) => feats[b].area - feats[a].area);
  for (const i of order) {
    const ban = new Set(nb[i].map((j) => color[j]).filter((c) => c != null));
    const k = +feats[i].code.slice(-2);
    const ok = colors.map((c, ci) => ci).filter((ci) => !ban.has(ci));
    const pick = (ok.length ? ok : colors.map((c, ci) => ci))
      .sort((a, b) => (used[a] - used[b]) || (((a + k) % colors.length) - ((b + k) % colors.length)))[0];
    color[i] = pick;
    used[pick]++;
  }
  // 離島縣 ( 連江、澎湖 ) 的島又小又散, 填色不到畫面的 5% 時 ( 臺東細長, 約 10% ), 用同色的粗邊把島加粗, 不畫白邊
  const cover = order.reduce((a, i) => a + feats[i].area, 0) / (SIZE * SIZE);
  const sparse = cover < 0.05;
  // 填色越少邊越粗: 澎湖 ( 2% ) 6px, 連江 ( 1% ) 約 8.5px
  const fat = Math.min(12, 6 * Math.sqrt(0.02 / cover)).toFixed(1);
  const paths = order.map((i) => {
    const c = colors[color[i]];
    return `    <path fill="${c}"${sparse ? ` stroke="${c}"` : ''} d="${gp(feats[i].geometry)}"/>`;
  });
  const code = d.topo.objects.town.geometries[0].properties.code.slice(0, 5);
  allPaths[code] = order.map((i) => [feats[i].code, d.meta.name[topo.objects.town.geometries[i].properties.t], gp(feats[i].geometry)])
    .sort((a, b) => (a[0] < b[0] ? -1 : 1));
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${SIZE} ${SIZE}" width="${SIZE}" height="${SIZE}">\n` +
    `  <g id="towns"${sparse ? ` stroke-width="${fat}"` : ' stroke="#ffffff" stroke-width="1.5"'} stroke-linejoin="round" stroke-linecap="round">\n` +
    paths.join('\n') + '\n  </g>\n</svg>\n';
  const fn = `twmap-${code}.svg`;
  fs.writeFileSync(path.join(out, fn), svg);
  list.push({ name: `twmap-${code}`, subject: `map of ${name} ( ${code} ) by town`, set: 'twmap' });
  console.error(`${name} ${code}: ${paths.length} towns${sparse ? ' ( sparse, cover ' + Math.round(cover * 100) + '% )' : ''}, ${Math.round(svg.length / 1024 * 10) / 10}KB`);
}

if (pathsOut) fs.writeFileSync(pathsOut, JSON.stringify(allPaths));
const idx = path.join(out, 'index.json');
const old = fs.existsSync(idx) ? JSON.parse(fs.readFileSync(idx, 'utf8')) : [];
const names = new Set(list.map((d) => d.name));
fs.writeFileSync(idx, JSON.stringify(old.filter((d) => !names.has(d.name)).concat(list), null, 1) + '\n');
