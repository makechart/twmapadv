#!/usr/bin/env node
// 產生範例資料: 每個縣市一個 src/sample/<縣市>.json ( build 時複製到 dist/sample/, 圖表執行時才載入 )
//
//   node tool/sample.js <yyymm> <pdmaptw 目錄> [縣市...]
//   e.g. node tool/sample.js 11409 ../../../plotdb/projects/pdmaptw          # 全部縣市
//        node tool/sample.js 11409 ../../../plotdb/projects/pdmaptw 臺北市
//
//   --csv <目錄>: 另外輸出 builtin-datasets 用的 CSV ( 臺北市村里, 全國鄉鎮 )
//
// 資料來源: 內政部戶政司 村里戶數、單一年齡人口 ( ODRP014, 月資料 )
//   https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/<yyymm>?page=<n>
// 面積取自 pdmaptw 的 village.stat.json / town.stat.json ( 由簡化前的界線算的, km² )
//
// 每個縣市輸出村里各一列, 另加每個鄉鎮一列「全區」, 其值就是鄉鎮值 ( 圖表會優先用它 ).
// 另外輸出 全國.json ( 全國圖, level: town ): 每個鄉鎮一列, 每個縣市一列「全區」.
// 只處理部分縣市時不輸出全國
const fs = require('fs');
const path = require('path');
const https = require('https');

const argv = process.argv.slice(2);
const csvAt = argv.indexOf('--csv');
const csvDir = csvAt >= 0 ? argv.splice(csvAt, 2)[1] : null;
const [yyymm, pdmaptw, ...picked] = argv;
if (!yyymm || !pdmaptw) {
  console.error('usage: node tool/sample.js <yyymm> <pdmaptw dir> [縣市...] [--csv <dir>]');
  process.exit(1);
}
const counties = picked.length ? picked : fs.readdirSync(path.join(pdmaptw, 'dist/county'))
  .filter((f) => /^[^.]+\.map\.js$/.test(f)).map((f) => f.replace('.map.js', ''));

const get = (url) => new Promise((res, rej) => {
  https.get(url, (r) => {
    let buf = [];
    r.on('data', (d) => buf.push(d));
    r.on('end', () => { try { res(JSON.parse(Buffer.concat(buf).toString())); } catch (e) { rej(e); } });
  }).on('error', rej);
});

const fetchAll = async () => {
  const base = `https://www.ris.gov.tw/rs-opendata/api/v1/datastore/ODRP014/${yyymm}`;
  const first = await get(`${base}?page=1`);
  if (!first.responseData) throw new Error(`no data for ${yyymm}: ${first.responseMessage}`);
  let rows = first.responseData;
  for (let i = 2; i <= +first.totalPage; i++) rows = rows.concat((await get(`${base}?page=${i}`)).responseData);
  return rows;
};

// 65 歲以上人口比例分級. 7% 高齡化、14% 高齡、20% 超高齡 ( 國發會 ); 25% 是為了把都會區的里分開
const aging = (r) => r < 0.07 ? '年輕 (<7%)' : r < 0.14 ? '高齡化 (7–14%)' : r < 0.2 ? '高齡 (14–20%)'
  : r < 0.25 ? '超高齡 (20–25%)' : '超高齡 (≥25%)';
const round = (v, n = 1) => Math.round(v * 10 ** n) / 10 ** n;

const summarize = (o, area) => {
  const pop = o.m + o.f;
  return [
    pop, round(pop / area, 0), round(o.m / o.f * 100), o.m, o.f, o.a0, o.a1, o.a2, aging(o.a2 / pop)
  ];
};

const head = ['鄉鎮', '村里', '人口', '人口密度', '性比例', '男', '女', '0-14歲', '15-64歲', '65歲以上', '高齡分級'];
const units = {人口: '人', 人口密度: '人/km²', 男: '人', 女: '人', '0-14歲': '人', '15-64歲': '人', '65歲以上': '人'};
const source = `內政部戶政司 村里戶數、單一年齡人口 ${yyymm.slice(0, 3)}年${+yyymm.slice(3)}月`;

const csv = (rows) => rows.map((r) => r.map((v) => /[",\n]/.test(`${v}`) ? `"${`${v}`.replace(/"/g, '""')}"` : v).join(',')).join('\n') + '\n';

(async () => {
  const rows = await fetchAll();
  const vstat = JSON.parse(fs.readFileSync(path.join(pdmaptw, 'src/topojson/village.stat.json')));
  const tstat = JSON.parse(fs.readFileSync(path.join(pdmaptw, 'src/topojson/town.stat.json')));
  const cstat = JSON.parse(fs.readFileSync(path.join(pdmaptw, 'src/topojson/county.stat.json')));
  const nation = { towns: [], counties: [] };
  const outDir = path.join(__dirname, '../src/sample');
  fs.mkdirSync(outDir, { recursive: true });
  const all = {};
  const missing = [];
  for (const county of counties) {
    const list = rows.filter((r) => r.site_id.startsWith(county));
    if (!list.length) throw new Error(`no rows for ${county}`);
    const towns = {};
    const vrows = list.map((r) => {
      const age = [0, 0, 0];
      for (let k = 0; k <= 100; k++) {
        const s = k == 100 ? '100up' : String(k).padStart(3, '0');
        age[k < 15 ? 0 : k < 65 ? 1 : 2] += (+r[`people_age_${s}_m`] || 0) + (+r[`people_age_${s}_f`] || 0);
      }
      const o = { m: +r.people_total_m, f: +r.people_total_f, a0: age[0], a1: age[1], a2: age[2] };
      const town = r.site_id.slice(county.length);
      const tcode = r.district_code.slice(0, 8);
      const t = towns[tcode] || (towns[tcode] = { town, m: 0, f: 0, a0: 0, a1: 0, a2: 0 });
      ['m', 'f', 'a0', 'a1', 'a2'].forEach((k) => t[k] += o[k]);
      const area = (vstat[r.district_code] || {}).area;
      // 人口資料與地圖界線的版本不同, 中間合併 / 改編的里地圖上沒有. 不輸出這一列,
      // 但人口仍算進鄉鎮的「全區」
      if (!area) { missing.push(`${r.district_code} ${r.site_id}${r.village}`); return null; }
      return [town, r.village].concat(summarize(o, area));
    }).filter((r) => r);
    const trows = Object.entries(towns).map(([code, t]) => {
      if (!tstat[code]) throw new Error(`no area for town ${code} ${county}${t.town}`);
      return [t.town, '全區'].concat(summarize(t, tstat[code].area));
    });
    // 全國: 縣市的值是它所有鄉鎮的和
    const ccode = Object.keys(towns)[0].slice(0, 5);
    if (!cstat[ccode]) throw new Error(`no area for county ${ccode} ${county}`);
    const c = { m: 0, f: 0, a0: 0, a1: 0, a2: 0 };
    for (const [code, t] of Object.entries(towns)) {
      ['m', 'f', 'a0', 'a1', 'a2'].forEach((k) => c[k] += t[k]);
      nation.towns.push([county, t.town].concat(summarize(t, tstat[code].area)));
    }
    nation.counties.push([county, '全區'].concat(summarize(c, cstat[ccode].area)));
    all[county] = trows.concat(vrows);
    fs.writeFileSync(path.join(outDir, `${county}.json`), JSON.stringify({ source, head, units, rows: all[county] }));
    console.error(`${county}: ${trows.length} towns, ${vrows.length} villages`);
  }
  if (!picked.length) {
    const nhead = ['縣市', '鄉鎮'].concat(head.slice(2));
    fs.writeFileSync(path.join(outDir, '全國.json'), JSON.stringify({ source, head: nhead, units, rows: nation.counties.concat(nation.towns) }));
    console.error(`全國: ${nation.counties.length} counties, ${nation.towns.length} towns`);
  }
  if (missing.length) console.error(`地圖上沒有的村里 ( 已略過, 人口仍算進鄉鎮 ) ${missing.length}:\n  ${missing.join('\n  ')}`);
  if (csvDir) {
    // 臺北市村里 ( 含各區「全區」列 ), 全國鄉鎮 ( 只有「全區」列, 鄉鎮名前加縣市 )
    const tp = all['臺北市'] || [];
    fs.writeFileSync(path.join(csvDir, 'taipei-village-population.csv'), csv([head].concat(tp)));
    const nation = [['縣市'].concat(head.filter((h) => h != '村里'))];
    for (const [county, rs] of Object.entries(all)) {
      rs.filter((r) => r[1] == '全區').forEach((r) => nation.push([county, `${county}${r[0]}`].concat(r.slice(2))));
    }
    fs.writeFileSync(path.join(csvDir, 'taiwan-town-population.csv'), csv(nation));
    console.error(`csv: ${tp.length} taipei rows, ${nation.length - 1} towns`);
  }
})().catch((e) => { console.error(e); process.exit(1); });
