// Regenerate the review drawing from the same geometry used by the game/Worker.
import fs from "node:fs/promises";
import ts from "typescript";
const source = await fs.readFile(
  new URL("../src/game/level.ts", import.meta.url),
  "utf8",
);
const { outputText } = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ESNext,
    target: ts.ScriptTarget.ES2022,
  },
});
const level = await import(
  `data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`
);
const { FLOOR_REGIONS, ROOMS, WALLS, OPENINGS, FURNITURE, RAMPS, DOCK } = level;
const scale = 42,
  escape = (text) =>
    String(text).replaceAll("&", "&amp;").replaceAll("<", "&lt;");
let svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1240" height="820" viewBox="0 0 1240 820"><rect width="1240" height="820" fill="#f7f2e8"/><style>text{font-family:Arial,sans-serif;fill:#273332}.label{font-size:10px;font-weight:700;paint-order:stroke;stroke:#faf7ef;stroke-width:4px;stroke-linejoin:round}</style><text x="48" y="46" font-size="27" font-weight="700">THE ALHAMBRA HOUSE PARTY</text><text x="48" y="72" font-size="13">Playable floor plan · meters · ruleset 2.3.0 · adapted from the Sears Alhambra first- and second-floor drawings</text>`;
for (const floor of [0, 1]) {
  const ox = 48 + floor * 610,
    oy = 132;
  const px = (x) => ox + (x + 6) * scale,
    pz = (z) => oy + (z + 5.4) * scale;
  const rect = (o, fill, stroke = "none", width = 0) =>
    `<rect x="${px(o.x - o.w / 2)}" y="${pz(o.z - o.d / 2)}" width="${o.w * scale}" height="${o.d * scale}" fill="${fill}" stroke="${stroke}" stroke-width="${width}"/>`;
  svg += `<text x="${ox}" y="112" font-size="18" font-weight="700">${floor ? "UPSTAIRS / PRIVATE ROOMS" : "GROUND FLOOR / SOCIAL LOOP"}</text>`;
  for (const r of FLOOR_REGIONS.filter((r) => r.floor === floor))
    svg += rect(
      r,
      r.finish === "terrace" ? "#e6d6bc" : "#fffcf5",
      "#697973",
      1,
    );
  for (const r of ROOMS.filter((r) => r.floor === floor && r.finish === "tile"))
    svg += rect(r, "#dbe9e4");
  for (const r of RAMPS) {
    svg += rect(r, "#efdb93", "#82713c", 1);
    for (let i = 1; i < 14; i++) {
      const z = r.bottomZ + ((r.topZ - r.bottomZ) * i) / 14;
      svg += `<path d="M ${px(r.x - r.w / 2)} ${pz(z)} H ${px(r.x + r.w / 2)}" stroke="#b29a53" stroke-width="1"/>`;
    }
    svg += `<text x="${px(r.x)}" y="${pz(r.z)}" text-anchor="middle" font-size="18">${r.topZ < r.bottomZ ? "↑" : "↓"}</text>`;
  }
  for (const o of FURNITURE.filter((o) => o.floor === floor)) {
    svg += rect(
      o,
      ["bath", "toilet", "vanity"].includes(o.kind)
        ? "#99c7c3"
        : o.bottom > 0
          ? "#c6d0b9"
          : "#b7ac97",
      "#746e60",
      0.65,
    );
    if (o.kind === "bed")
      svg += rect(
        { ...o, z: o.z + o.d * 0.31, w: o.w * 0.86, d: 0.35 },
        "#eef0df",
        "#746e60",
        0.5,
      );
    if (o.bottom > 0)
      for (const sx of [-1, 1])
        for (const sz of [-1, 1])
          svg += rect(
            {
              ...o,
              x: o.x + sx * (o.w / 2 - 0.1),
              z: o.z + sz * (o.d / 2 - 0.1),
              w: 0.09,
              d: 0.09,
            },
            "#494d42",
          );
  }
  for (const o of WALLS.filter((o) => o.floor === floor && o.bottom === 0))
    svg += rect(o, "#3e4946");
  for (const o of OPENINGS.filter((o) => o.floor === floor)) {
    const x = o.axis === "x" ? o.center : o.at,
      z = o.axis === "z" ? o.center : o.at;
    if (o.type === "window")
      svg += `<path d="M ${px(x - (o.axis === "x" ? o.width / 2 : 0))} ${pz(z - (o.axis === "z" ? o.width / 2 : 0))} L ${px(x + (o.axis === "x" ? o.width / 2 : 0))} ${pz(z + (o.axis === "z" ? o.width / 2 : 0))}" stroke="#69b6c2" stroke-width="3"/>`;
    else svg += `<circle cx="${px(x)}" cy="${pz(z)}" r="3" fill="#d47e42"/>`;
  }
  for (const r of ROOMS.filter((r) => r.floor === floor)) {
    const z = r.z + (r.id === "living" ? -0.35 : 0);
    svg += `<text class="label" x="${px(r.x)}" y="${pz(z)}" text-anchor="middle">${escape(r.name.toUpperCase())}</text>`;
  }
  if (!floor)
    svg += `<circle cx="${px(DOCK.x)}" cy="${pz(DOCK.z)}" r="9" fill="#4e9875"/><text x="${px(DOCK.x)}" y="${pz(DOCK.z) + 4}" text-anchor="middle" font-size="9" fill="white" style="fill:white">D</text>`;
  svg += `<path d="M ${ox} 715 h ${scale * 2}" stroke="#273332" stroke-width="3"/><path d="M ${ox} 710 v10 m ${scale * 2} -10 v10" stroke="#273332"/><text x="${ox}" y="738" font-size="11">2 meters</text>`;
}
svg += `<text x="48" y="770" font-size="12">Blue: windows   Orange dots: open doorways   Yellow: stair flights   Green D: delivery dock</text><text x="48" y="792" font-size="11">Source: Prince George’s County Sears survey, printed page 34 (PDF page 42). Reference and gameplay adaptations: docs/ARCHITECTURE_REFERENCES.md</text></svg>`;
await fs.writeFile(
  new URL("../docs/HOUSE_FLOORPLAN.svg", import.meta.url),
  svg,
);
