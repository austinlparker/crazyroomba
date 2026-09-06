import * as T from "three";
import {
  box,
  cylinder,
  lathe,
  ring,
  beam,
  ellipsoid,
  finish,
  material,
} from "./models";

const ivory = "#eee4cc",
  wood = "#ab754c",
  dark = "#35404d",
  chrome = "#a3b9bd";
function timber(
  g: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
) {
  const m = box(g, x, y, z, w, h, d, wood, 0.012);
  m.material = finish(wood, "wood");
  return m;
}
export function furnitureLegs(
  g: T.Object3D,
  w: number,
  d: number,
  bottom: number,
) {
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      // Keep the exact leg centers/widths used by the navigation colliders.
      const m = box(
        g,
        sx * (w / 2 - 0.1),
        bottom / 2,
        sz * (d / 2 - 0.1),
        0.09,
        bottom,
        0.09,
        wood,
        0.008,
      );
      m.material = finish(wood, "wood");
    }
}
function faucet(g: T.Object3D, x: number, y: number, z: number) {
  const fixture = new T.Group();
  g.add(fixture);
  const neck = ring(fixture, 0.095, 0.016, chrome, Math.PI);
  neck.position.set(x, y + 0.14, z);
  neck.rotation.y = Math.PI / 2;
  cylinder(fixture, x, y + 0.065, z - 0.095, 0.018, 0.15, chrome);
  for (const side of [-1, 1])
    cylinder(
      fixture,
      x + side * 0.12,
      y + 0.024,
      z - 0.07,
      0.027,
      0.04,
      chrome,
    );
  for (const part of fixture.children)
    (part as T.Mesh).material = material(chrome, 0.24, 0.75);
}
function cushion(
  g: T.Object3D,
  x: number,
  y: number,
  z: number,
  w: number,
  h: number,
  d: number,
  color: string,
) {
  const shape = new T.Group();
  shape.position.set(x, y, z);
  g.add(shape);
  const radius = Math.min(h * 0.35, 0.065, w / 3, d / 3);
  const m = box(shape, 0, 0, 0, w, h, d, color, radius);
  m.material = finish(color);
  // The piping is part of the cushion, so it follows its lean and stays inside the rounded corners.
  box(
    shape,
    0,
    -h * 0.12,
    d / 2 - 0.002,
    w - 2 * radius,
    0.012,
    0.014,
    ivory,
    0.005,
  );
  return shape;
}
/** Furniture in local coordinates; true means the specialized model was built. */
export function furnitureModel(
  g: T.Object3D,
  kind: string,
  w: number,
  d: number,
  bottom: number,
  top: number,
  color = "#e58b6e",
) {
  if (kind === "sofa" || kind === "chair") {
    furnitureLegs(g, w, d, bottom);
    const seat = bottom + (top - bottom) * 0.4,
      count = kind === "sofa" ? 3 : 1;
    timber(g, 0, bottom + 0.055, 0, w - 0.03, 0.11, d - 0.02);
    // Size the upholstered support to the actual seat height. A fixed 16 cm
    // base left a visible air gap under taller sofas and armchairs.
    const supportBottom = bottom + 0.055,
      supportTop = seat - 0.07 + 0.016;
    cushion(
      g,
      0,
      (supportBottom + supportTop) / 2,
      0,
      w - 0.04,
      supportTop - supportBottom,
      d - 0.04,
      color,
    );
    // The loose back cushions sit ahead of the seat's rear edge. A continuous
    // upholstered back frame connects them to the plinth when seen from behind.
    const backTop = top - 0.03;
    box(
      g,
      0,
      (supportBottom + backTop) / 2,
      -d / 2 + 0.05,
      w - 0.045,
      backTop - supportBottom,
      0.09,
      color,
      0.018,
    ).material = finish(color);
    for (let i = 0; i < count; i++) {
      const cw = (w - 0.28) / count,
        x = -w / 2 + 0.14 + cw * (i + 0.5);
      cushion(g, x, seat, 0.035, cw - 0.018, 0.14, d - 0.2, color);
      const back = cushion(
        g,
        x,
        (seat + top) / 2,
        -d / 2 + 0.115,
        cw - 0.018,
        Math.max(0.16, top - seat),
        0.18,
        color,
      );
      back.rotation.x = -0.08;
      for (const dx of [-0.16, 0.16])
        if (cw > 0.45)
          ellipsoid(
            back,
            dx,
            (top - seat) / 2 - 0.14,
            0.093,
            0.024,
            0.024,
            0.012,
            ivory,
          );
    }
    for (const side of [-1, 1]) {
      cushion(g, side * (w / 2 - 0.075), seat + 0.035, 0, 0.15, 0.27, d, color);
      if (kind === "sofa") {
        const p = cushion(
          g,
          side * w * 0.3,
          seat + 0.19,
          0.08,
          0.27,
          0.28,
          0.115,
          side < 0 ? "#eac578" : "#66a69b",
        );
        p.rotation.z = -side * 0.23;
      }
    }
    return true;
  }
  if (kind === "bed") {
    furnitureLegs(g, w, d, bottom);
    timber(g, 0, bottom + 0.05, 0, w, 0.1, d);
    cushion(
      g,
      0,
      (bottom + 0.1 + top) / 2,
      0,
      w - 0.035,
      top - bottom - 0.1,
      d - 0.035,
      ivory,
    );
    timber(g, 0, bottom + 0.33, d / 2 - 0.05, w, 0.66, 0.1);
    for (const side of [-1, 1])
      timber(
        g,
        side * (w / 2 - 0.09),
        bottom + 0.41,
        d / 2 - 0.051,
        0.065,
        0.8,
        0.09,
      );
    cushion(g, 0, top + 0.023, -d * 0.15, w - 0.016, 0.055, d * 0.67, color);
    for (const side of [-1, 1])
      cushion(
        g,
        side * w * 0.24,
        top + 0.08,
        d * 0.3,
        w * 0.42,
        0.15,
        d * 0.22,
        ivory,
      );
    // Folded duvet edge and hanging side panels stop above the crawl space.
    cushion(g, 0, top + 0.06, d * 0.135, w - 0.02, 0.045, 0.13, ivory);
    for (const side of [-1, 1])
      box(
        g,
        side * (w / 2 - 0.013),
        top - 0.07,
        -d * 0.15,
        0.035,
        0.17,
        d * 0.66,
        color,
        0.012,
      ).material = finish(color);
    for (let i = 0; i < 7; i++)
      box(
        g,
        0,
        top + 0.055,
        -d * 0.44 + i * d * 0.077,
        w - 0.055,
        0.008,
        0.023,
        i % 2 ? ivory : "#709991",
        0.002,
      );
    return true;
  }
  if (kind === "bath" || kind === "tub") {
    // A continuous hollow ceramic profile, stretched into a rounded oval basin.
    const m = lathe(
      g,
      [
        [0, 0.04],
        [0.65, 0.04],
        [0.85, 0.09],
        [0.96, top * 0.7],
        [1, top - 0.04],
        [0.99, top],
        [0.84, top + 0.006],
        [0.81, top - 0.05],
        [0.69, 0.18],
        [0, 0.15],
      ],
      ivory,
      48,
    );
    m.scale.set(w / 2, 1, d / 2);
    m.material = material(ivory, 0.26);
    const water = cylinder(g, 0, 0.2, 0, 0.62, 0.012, "#73b5be");
    water.scale.set(w / 2, 1, d / 2);
    water.material = material("#73b5be", 0.15, 0.2);
    faucet(g, 0, top, -d * 0.36);
    cylinder(g, 0, 0.207, d * 0.18, 0.023, 0.006, chrome).material = material(
      chrome,
      0.24,
      0.75,
    );
    return true;
  }
  if (kind === "sink" || kind === "vanity") {
    timber(g, 0, top * 0.43, 0, w, top * 0.86, d);
    box(g, 0, top - 0.04, 0, w, 0.08, d, ivory, 0.025).material = material(
      ivory,
      0.25,
    );
    const bowl = lathe(
      g,
      [
        [0, 0],
        [0.62, 0.015],
        [0.94, 0.09],
        [1, 0.12],
        [0.88, 0.13],
        [0.79, 0.075],
        [0.5, 0.04],
        [0, 0.035],
      ],
      ivory,
    );
    bowl.position.y = top;
    bowl.scale.set(w * 0.36, 1, d * 0.35);
    bowl.material = material(ivory, 0.23);
    cylinder(g, 0, top + 0.04, 0, 0.022, 0.008, chrome).material = material(
      chrome,
      0.24,
      0.75,
    );
    faucet(g, 0, top, -d * 0.3);
    for (const side of [-1, 1]) {
      box(
        g,
        side * w * 0.245,
        top * 0.44,
        d / 2 + 0.009,
        w * 0.45,
        top * 0.7,
        0.02,
        "#72a69c",
        0.008,
      );
      box(
        g,
        side * 0.055,
        top * 0.68,
        d / 2 + 0.03,
        0.035,
        0.13,
        0.025,
        chrome,
        0.008,
      ).material = material(chrome, 0.24, 0.75);
    }
    return true;
  }
  if (kind === "toilet") {
    const body = lathe(
      g,
      [
        [0, 0],
        [0.7, 0],
        [0.65, 0.08],
        [0.54, top * 0.3],
        [0.93, top * 0.47],
        [1, top * 0.58],
        [0.76, top * 0.61],
        [0.56, top * 0.44],
        [0, top * 0.4],
      ],
      ivory,
    );
    body.scale.set(w * 0.48, 1, d * 0.47);
    body.position.z = d * 0.08;
    body.material = material(ivory, 0.2);
    const seat = ring(g, w * 0.4, 0.035, ivory);
    seat.material = material(ivory, 0.2);
    seat.rotation.x = Math.PI / 2;
    seat.scale.y = (d * 0.52) / (w * 0.4);
    seat.position.set(0, top * 0.61, d * 0.08);
    box(
      g,
      0,
      top * 0.72,
      -d * 0.32,
      w * 0.88,
      top * 0.53,
      d * 0.26,
      ivory,
      0.05,
    ).material = material(ivory, 0.2);
    box(g, 0, top, -d * 0.32, w * 0.94, 0.04, d * 0.3, ivory, 0.015).material =
      material(ivory, 0.2);
    const flush = cylinder(
      g,
      w * 0.3,
      top * 0.89,
      -d * 0.16,
      0.026,
      0.04,
      chrome,
    );
    flush.rotation.x = Math.PI / 2;
    flush.material = material(chrome, 0.24, 0.75);
    return true;
  }
  if (kind === "fridge" || kind === "washer") {
    box(g, 0, top / 2, 0, w, top, d, ivory, 0.05).material = material(
      ivory,
      0.34,
      0.15,
    );
    if (kind === "fridge") {
      for (const [cy, h] of [
        [top * 0.37, top * 0.69],
        [top * 0.86, top * 0.24],
      ]) {
        box(g, 0, cy, d / 2 + 0.012, w - 0.045, h, 0.045, "#fff1d8", 0.022);
        beam(
          g,
          [-w * 0.31, cy - h * 0.29, d / 2 + 0.067],
          [-w * 0.31, cy + h * 0.22, d / 2 + 0.067],
          0.018,
          chrome,
        );
      }
      for (let i = 0; i < 5; i++)
        box(
          g,
          -w * 0.32 + i * w * 0.16,
          0.05,
          d / 2 + 0.009,
          w * 0.09,
          0.018,
          0.01,
          dark,
          0,
        );
      for (let i = 0; i < 3; i++) {
        const magnet = box(
          g,
          w * 0.12 + i * 0.045,
          top * 0.59 + i * 0.06,
          d / 2 + 0.041,
          0.075,
          0.075,
          0.015,
          ["#e27861", "#68ada4", "#e6bd67"][i],
          0.005,
        );
        magnet.rotation.z = i * 0.3;
      }
    } else {
      box(
        g,
        0,
        top * 0.87,
        d / 2 + 0.014,
        w * 0.92,
        top * 0.18,
        0.028,
        "#bfc9c5",
        0.009,
      );
      const rim = ring(g, w * 0.29, 0.034, chrome);
      rim.material = material(chrome, 0.24, 0.75);
      rim.position.set(0, top * 0.43, d / 2 + 0.044);
      const glass = ellipsoid(
        g,
        0,
        top * 0.43,
        d / 2 + 0.032,
        w * 0.5,
        w * 0.5,
        0.05,
        "#3b6275",
      );
      glass.material = material("#3b6275", 0.14, 0.25);
      ring(g, w * 0.215, 0.014, dark).position.set(
        0,
        top * 0.43,
        d / 2 + 0.055,
      );
      box(
        g,
        w * 0.25,
        top * 0.43,
        d / 2 + 0.08,
        0.04,
        0.12,
        0.035,
        ivory,
        0.01,
      );
      cylinder(
        g,
        w * 0.28,
        top * 0.87,
        d / 2 + 0.055,
        0.038,
        0.035,
        chrome,
      ).rotation.x = Math.PI / 2;
      box(
        g,
        -w * 0.17,
        top * 0.87,
        d / 2 + 0.034,
        w * 0.35,
        0.055,
        0.014,
        dark,
        0.005,
      );
    }
    return true;
  }
  if (kind === "shelf" || kind === "dresser") {
    timber(g, 0, top / 2, -d / 2 + 0.025, w, top, 0.05);
    for (const side of [-1, 1])
      timber(g, side * (w / 2 - 0.027), top / 2, 0, 0.055, top, d);
    timber(g, 0, top - 0.025, 0, w, 0.05, d);
    const count = kind === "shelf" ? 4 : 3;
    for (let i = 0; i < count; i++) {
      const y = (i * top) / count + 0.04;
      timber(g, 0, y, 0, w, 0.055, d);
      if (kind === "shelf") {
        for (let k = 0; k < 6; k++) {
          const h = (top / count) * (0.48 + ((k + i) % 3) * 0.1),
            bw = w * 0.1,
            depth = d * 0.65,
            x = -w * 0.36 + k * w * 0.137,
            lean = k === 5 ? -0.14 : 0;
          const book = new T.Group();
          // Pivot the whole book, including its spine label, and rest its
          // lowest cover corner on the shelf instead of sinking through it.
          book.position.set(
            x,
            y + 0.028 + (bw * Math.abs(Math.sin(lean))) / 2,
            d * 0.04,
          );
          book.rotation.z = lean;
          g.add(book);
          box(
            book,
            0,
            h / 2,
            0,
            bw,
            h,
            depth,
            ["#649f99", "#dda449", "#b46d78", "#717e9e", "#c8b696", "#967a9e"][
              (k + i * 2) % 6
            ],
            0.005,
          );
          box(
            book,
            0,
            h - 0.002,
            -0.003,
            bw - 0.014,
            0.006,
            depth - 0.025,
            ivory,
            0,
          );
          box(
            book,
            0,
            h * 0.75,
            depth / 2 + 0.002,
            bw * 0.75,
            0.014,
            0.006,
            ivory,
            0,
          );
        }
      } else {
        box(
          g,
          0,
          y + (top / count) * 0.43,
          d / 2 - 0.025,
          w - 0.075,
          top / count - 0.065,
          0.045,
          wood,
          0.012,
        ).material = finish(wood, "wood");
        for (const x of [-w * 0.25, w * 0.25])
          beam(
            g,
            [x - 0.05, y + (top / count) * 0.55, d / 2 + 0.012],
            [x + 0.05, y + (top / count) * 0.55, d / 2 + 0.012],
            0.012,
            chrome,
          );
      }
    }
    return true;
  }
  return false;
}

export function chargingDock(g: T.Object3D) {
  box(g, 0, 0.013, 0, 0.91, 0.026, 0.94, "#344c52", 0.025);
  // The tower's rear remains within the existing wall-side dock footprint.
  box(g, 0, 0.36, 0.39, 0.68, 0.72, 0.2, dark, 0.065);
  box(g, 0, 0.746, 0.39, 0.7, 0.08, 0.22, "#617c7c", 0.025);
  box(g, 0, 0.4, 0.279, 0.54, 0.44, 0.025, "#5f797a", 0.025);
  box(g, 0, 0.37, 0.26, 0.43, 0.25, 0.019, "#243842", 0.014);
  box(g, 0, 0.58, 0.259, 0.13, 0.045, 0.02, "#8be5b1", 0.01).material =
    material("#8be5b1", 0.3, 0.25);
  for (const x of [-0.23, 0.23]) {
    box(g, x, 0.12, 0.262, 0.08, 0.11, 0.025, "#bc9f60", 0.006);
    box(g, x, 0.031, -0.15, 0.036, 0.008, 0.32, "#92d9b0", 0.005);
  }
  for (let i = 0; i < 5; i++)
    box(g, -0.15 + i * 0.075, 0.68, 0.279, 0.043, 0.013, 0.015, dark, 0.003);
  for (const side of [-1, 1])
    box(g, side * 0.4, 0.032, 0, 0.025, 0.012, 0.8, "#bee88a", 0.005);
  const target = ring(g, 0.22, 0.009, "#a6dcb1");
  target.rotation.x = Math.PI / 2;
  target.position.set(0, 0.033, -0.14);
  box(g, 0, 0.768, 0.39, 0.19, 0.012, 0.08, dark, 0.02);
}

export function mug(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  color = "#cc8263",
) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  lathe(
    g,
    [
      [0, 0.004],
      [0.048, 0.004],
      [0.063, 0.014],
      [0.063, 0.135],
      [0.054, 0.141],
      [0.049, 0.126],
      [0.048, 0.027],
      [0, 0.027],
    ],
    color,
    20,
  ).material = material(color, 0.3);
  const handle = ring(g, 0.041, 0.011, color, Math.PI * 1.55);
  handle.position.set(0.061, 0.078, 0);
  handle.rotation.z = -Math.PI * 0.77;
  cylinder(g, 0, 0.122, 0, 0.048, 0.006, "#493f35");
}
export function lamp(parent: T.Object3D, x: number, y: number, z: number) {
  const g = new T.Group();
  g.position.set(x, y, z);
  parent.add(g);
  lathe(
    g,
    [
      [0, 0],
      [0.13, 0],
      [0.14, 0.012],
      [0.1, 0.03],
      [0.025, 0.05],
      [0.025, 0.25],
      [0, 0.25],
    ],
    "#6e837e",
  );
  lathe(
    g,
    [
      [0.18, 0.23],
      [0.19, 0.25],
      [0.125, 0.47],
      [0.115, 0.474],
      [0.178, 0.25],
    ],
    "#e6c18b",
  );
  const hem = ring(g, 0.183, 0.007, "#b0926a");
  hem.rotation.x = Math.PI / 2;
  hem.position.y = 0.245;
  for (let i = 0; i < 12; i++) {
    const a = (i * Math.PI) / 6;
    beam(
      g,
      [Math.sin(a) * 0.182, 0.25, Math.cos(a) * 0.182],
      [Math.sin(a) * 0.12, 0.468, Math.cos(a) * 0.12],
      0.003,
      "#f2dba6",
    );
  }
  ellipsoid(g, 0, 0.34, 0, 0.075, 0.11, 0.075, "#fff3c2");
}
export function television(
  parent: T.Object3D,
  x: number,
  y: number,
  z: number,
  scale = 1,
) {
  const g = new T.Group();
  g.position.set(x, y, z);
  g.scale.setScalar(scale);
  parent.add(g);
  box(g, 0, 0.031, 0, 0.43, 0.062, 0.36, "#a4a69c", 0.02);
  box(g, 0, 0.3, -0.025, 0.7, 0.51, 0.48, "#b8b9ab", 0.055);
  box(g, 0, 0.32, 0.227, 0.67, 0.48, 0.072, "#d9d7bf", 0.045);
  box(g, -0.025, 0.331, 0.272, 0.53, 0.364, 0.035, dark, 0.043);
  box(g, -0.025, 0.332, 0.294, 0.478, 0.309, 0.025, "#497d87", 0.045).material =
    material("#497d87", 0.17, 0.3);
  for (let i = 0; i < 12; i++)
    box(
      g,
      -0.025,
      0.199 + i * 0.024,
      0.308,
      0.422,
      0.005,
      0.003,
      "#6dafa6",
      0.002,
    );
  for (let i = 0; i < 6; i++)
    box(
      g,
      0.279,
      0.222 + i * 0.033,
      0.269,
      0.021,
      0.013,
      0.012,
      "#687676",
      0.003,
    );
  cylinder(g, 0.268, 0.115, 0.272, 0.023, 0.024, chrome).rotation.x =
    Math.PI / 2;
  box(g, -0.1, 0.105, 0.267, 0.26, 0.012, 0.01, "#879891", 0.004);
  for (const side of [-1, 1])
    for (let i = 0; i < 5; i++)
      box(
        g,
        side * 0.351,
        0.2 + i * 0.048,
        -0.07,
        0.008,
        0.017,
        0.17,
        "#7e8c8a",
        0.003,
      );
}
