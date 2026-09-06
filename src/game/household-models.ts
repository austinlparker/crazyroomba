import * as T from "three";
import {
  box,
  cylinder,
  ellipsoid,
  sphere,
  ring,
  beam,
  lathe,
  material,
  mergeStatic,
  finish,
} from "./models";
import { ROUTINES, type Resident } from "./household";
function contactShadow(): T.MeshBasicMaterial {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 64;
  const c = canvas.getContext("2d")!,
    gradient = c.createRadialGradient(32, 32, 5, 32, 32, 32);
  gradient.addColorStop(0, "rgba(25,20,30,.35)");
  gradient.addColorStop(1, "rgba(25,20,30,0)");
  c.fillStyle = gradient;
  c.fillRect(0, 0, 64, 64);
  return new T.MeshBasicMaterial({
    map: new T.CanvasTexture(canvas),
    transparent: true,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -1,
    polygonOffsetUnits: -1,
  });
}
export function createResident(id: string): T.Group {
  const r = ROUTINES.find((r) => r.id === id)!,
    g = new T.Group();
  g.name = id;
  const shadow = new T.Mesh(
    new T.PlaneGeometry(r.radius * 2.4, r.radius * 3),
    contactShadow(),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.008;
  shadow.userData.cameraIgnore = true;
  g.add(shadow);
  const torso = new T.Group();
  g.add(torso);
  const head = new T.Group();
  head.name = "head";
  g.add(head);
  if (r.kind === "person") {
    const skin = "#d7a27e",
      trousers = "#3e5777",
      shoes = "#e8d9bd",
      hair = "#463332";
    // Rounded shoulders, a shaped waist, cuffed jeans and stitched sneakers.
    const shirt = lathe(
      torso,
      [
        [0, 0.83],
        [0.16, 0.83],
        [0.18, 0.91],
        [0.205, 1.2],
        [0.17, 1.3],
        [0.07, 1.36],
        [0, 1.36],
      ],
      r.color,
      20,
    );
    shirt.scale.z = 0.68;
    shirt.material = finish(r.color);
    ellipsoid(torso, 0, 0.82, 0, 0.37, 0.21, 0.24, trousers);
    box(torso, 0, 0.864, 0.126, 0.32, 0.027, 0.022, "#4c3e43", 0.005);
    box(torso, 0, 0.864, 0.143, 0.047, 0.037, 0.012, "#bdac85", 0.004);
    const collar = ring(torso, 0.073, 0.016, shoes);
    collar.rotation.x = Math.PI / 2;
    collar.scale.y = 0.8;
    collar.position.set(0, 1.328, 0);
    cylinder(torso, 0, 1.39, 0, 0.052, 0.13, skin);
    box(torso, -0.092, 1.19, 0.139, 0.095, 0.095, 0.015, "#d9957b", 0.009);
    for (const side of [-1, 1]) {
      const leg = new T.Group();
      leg.name = `leg${side}`;
      leg.position.set(side * 0.105, 0.79, 0);
      g.add(leg);
      ellipsoid(leg, 0, -0.18, 0, 0.157, 0.41, 0.18, trousers);
      ellipsoid(leg, 0, -0.49, 0.012, 0.14, 0.35, 0.155, trousers);
      box(leg, 0, -0.626, 0.016, 0.147, 0.065, 0.165, "#71879b", 0.012);
      box(leg, 0, -0.712, 0.04, 0.164, 0.11, 0.255, shoes, 0.035);
      box(leg, 0, -0.758, 0.042, 0.169, 0.027, 0.268, "#c7bfa8", 0.01);
      box(leg, side * 0.078, -0.701, 0.04, 0.012, 0.038, 0.13, r.color, 0.005);
      for (let i = 0; i < 3; i++)
        box(
          leg,
          0,
          -0.65,
          0.034 + i * 0.026,
          0.085,
          0.009,
          0.008,
          "#fcf0d9",
          0.003,
        );
      mergeStatic(leg);
      const arm = new T.Group();
      arm.name = `arm${side}`;
      arm.position.set(side * 0.22, 1.27, 0);
      g.add(arm);
      ellipsoid(
        arm,
        side * 0.006,
        -0.1,
        0,
        0.155,
        0.27,
        0.19,
        r.color,
      ).material = finish(r.color);
      ellipsoid(arm, side * 0.01, -0.28, 0.015, 0.104, 0.22, 0.115, skin);
      ellipsoid(arm, side * 0.01, -0.423, 0.042, 0.096, 0.12, 0.11, skin);
      if (side === 1) {
        const watch = cylinder(arm, 0.01, -0.357, 0.029, 0.059, 0.028, dark);
        watch.material = material(dark, 0.35, 0.2);
      }
      mergeStatic(arm);
    }
    head.position.set(0, 1.55, 0);
    ellipsoid(head, 0, 0, 0, 0.267, 0.31, 0.26, skin);
    ellipsoid(head, 0, -0.068, 0.056, 0.21, 0.14, 0.22, skin);
    for (const side of [-1, 1]) {
      ellipsoid(head, side * 0.135, -0.005, 0, 0.047, 0.072, 0.053, skin);
      ellipsoid(
        head,
        side * 0.048,
        0.022,
        0.12,
        0.045,
        0.035,
        0.016,
        "#fff2df",
      );
      sphere(head, side * 0.048, 0.02, 0.13, 0.012, dark);
      box(
        head,
        side * 0.05,
        0.056,
        0.119,
        0.058,
        0.015,
        0.016,
        hair,
        0.007,
      ).rotation.z = side * 0.08;
    }
    ellipsoid(head, 0, -0.017, 0.143, 0.04, 0.057, 0.054, skin);
    ellipsoid(head, 0, -0.079, 0.131, 0.064, 0.013, 0.009, "#88544b");
    ellipsoid(head, 0, 0.102, -0.027, 0.285, 0.15, 0.267, hair);
    for (let i = 0; i < 4; i++) {
      const tuft = ellipsoid(
        head,
        -0.094 + i * 0.049,
        0.104,
        0.08,
        0.096,
        0.103,
        0.16,
        hair,
      );
      tuft.rotation.z = -0.3;
    }
  } else {
    const cat = r.kind === "cat",
      h = cat ? 0.21 : 0.33,
      length = cat ? 0.35 : 0.47,
      fur = r.color,
      cream = "#e5caa1",
      patch = cat ? "#985731" : "#775039";
    ellipsoid(
      torso,
      0,
      h,
      0,
      cat ? 0.22 : 0.32,
      cat ? 0.22 : 0.31,
      length,
      fur,
    );
    ellipsoid(
      torso,
      0,
      h - 0.042,
      0.052,
      cat ? 0.19 : 0.255,
      cat ? 0.16 : 0.24,
      length * 0.67,
      cream,
    );
    ellipsoid(
      torso,
      0,
      h + 0.045,
      -length * 0.25,
      cat ? 0.19 : 0.27,
      cat ? 0.19 : 0.24,
      length * 0.45,
      fur,
    );
    for (const side of [-1, 1])
      for (const end of [-1, 1]) {
        const leg = new T.Group();
        leg.name = `leg${side}:${end}`;
        leg.position.set(side * (cat ? 0.075 : 0.103), h, end * length * 0.33);
        g.add(leg);
        ellipsoid(
          leg,
          0,
          -h * 0.35,
          0,
          cat ? 0.065 : 0.09,
          h * 0.72,
          cat ? 0.072 : 0.106,
          fur,
        );
        ellipsoid(
          leg,
          0,
          -h * 0.74,
          0.01,
          cat ? 0.046 : 0.064,
          h * 0.49,
          cat ? 0.057 : 0.08,
          cream,
        );
        ellipsoid(
          leg,
          0,
          -h + 0.026,
          0.023,
          cat ? 0.066 : 0.093,
          0.052,
          cat ? 0.094 : 0.13,
          cream,
        );
        for (const dx of [-0.012, 0.012])
          box(
            leg,
            dx,
            -h + 0.027,
            cat ? 0.062 : 0.077,
            0.006,
            0.018,
            0.006,
            patch,
            0.002,
          );
        mergeStatic(leg);
      }
    head.position.set(0, h + (cat ? 0.053 : 0.085), length * 0.45);
    ellipsoid(
      head,
      0,
      0,
      0,
      cat ? 0.19 : 0.255,
      cat ? 0.185 : 0.24,
      cat ? 0.178 : 0.22,
      fur,
    );
    for (const side of [-1, 1]) {
      if (cat) {
        const ear = new T.Mesh(
          new T.ConeGeometry(0.053, 0.113, 4),
          material(fur),
        );
        ear.position.set(side * 0.061, 0.108, -0.012);
        ear.rotation.z = -side * 0.18;
        ear.castShadow = true;
        head.add(ear);
        const inner = new T.Mesh(
          new T.ConeGeometry(0.03, 0.07, 3),
          material("#d59385"),
        );
        inner.position.set(side * 0.064, 0.114, 0.018);
        inner.rotation.z = -side * 0.18;
        head.add(inner);
      } else {
        const ear = ellipsoid(
          head,
          side * 0.127,
          0.009,
          -0.024,
          0.11,
          0.228,
          0.075,
          patch,
        );
        ear.rotation.z = side * 0.22;
      }
      ellipsoid(
        head,
        side * (cat ? 0.042 : 0.054),
        0.022,
        cat ? 0.083 : 0.099,
        cat ? 0.049 : 0.06,
        0.045,
        0.017,
        cat ? "#94b67a" : "#eee0c3",
      );
      ellipsoid(
        head,
        side * (cat ? 0.042 : 0.054),
        0.025,
        cat ? 0.094 : 0.11,
        cat ? 0.014 : 0.023,
        0.034,
        0.012,
        dark,
      );
      sphere(
        head,
        side * (cat ? 0.039 : 0.05),
        0.033,
        cat ? 0.103 : 0.119,
        0.007,
        "#fff9de",
      );
      ellipsoid(
        head,
        side * (cat ? 0.027 : 0.039),
        -0.038,
        cat ? 0.094 : 0.119,
        cat ? 0.065 : 0.095,
        cat ? 0.044 : 0.071,
        cat ? 0.058 : 0.104,
        cream,
      );
      if (cat)
        for (let i = 0; i < 2; i++)
          beam(
            head,
            [side * 0.038, -0.026 - i * 0.012, 0.118],
            [side * 0.139, -0.022 - i * 0.023, 0.095],
            0.0028,
            cream,
          );
    }
    ellipsoid(
      head,
      0,
      -0.021,
      cat ? 0.127 : 0.175,
      cat ? 0.025 : 0.047,
      0.027,
      0.025,
      dark,
    );
    if (!cat) ellipsoid(head, 0, -0.075, 0.163, 0.031, 0.035, 0.027, "#d68987");
    const collar = ring(
      torso,
      cat ? 0.097 : 0.133,
      cat ? 0.012 : 0.018,
      cat ? "#549caa" : "#c96555",
    );
    collar.position.set(0, h + 0.017, length * 0.32);
    sphere(torso, 0, h - 0.074, length * 0.37, cat ? 0.017 : 0.023, "#dcc17a");
    const tail = new T.Group();
    tail.name = "tail";
    tail.position.set(0, h, -length * 0.45);
    g.add(tail);
    for (let i = 0; i < 6; i++) {
      const y = cat ? i * 0.036 : i * 0.016,
        z = -i * 0.028;
      ellipsoid(
        tail,
        cat ? Math.sin(i * 0.32) * 0.04 : 0,
        y,
        z,
        cat ? 0.046 : 0.064,
        0.068,
        0.07,
        i > 3 ? patch : fur,
      );
    }
    mergeStatic(tail);
    if (cat)
      for (let i = 0; i < 4; i++) {
        const stripe = ring(torso, 0.104, 0.011, patch, Math.PI * 0.8);
        stripe.rotation.set(Math.PI / 2, 0, 0.3);
        stripe.scale.set(0.9, 1.15, 1);
        stripe.position.set(0, h + 0.018, -0.115 + i * 0.064);
      }
  }
  mergeStatic(torso);
  mergeStatic(head);
  if (r.kind === "cat") g.scale.y = 0.86;
  return g;
}
const dark = "#293447";
export function animateResident(
  g: T.Group,
  a: Resident,
  reduced: boolean,
  time = 0,
): void {
  g.position.set(a.x, a.y, a.z);
  g.rotation.y = a.angle;
  const phase = a.travel * (a.kind === "person" ? 10 : 17),
    swing = a.moving ? Math.sin(phase) * 0.4 : 0;
  for (const side of [-1, 1]) {
    if (a.kind === "person") {
      g.getObjectByName(`leg${side}`)!.rotation.x = swing * side;
      g.getObjectByName(`arm${side}`)!.rotation.x = -swing * side * 0.7;
    } else
      for (const end of [-1, 1])
        g.getObjectByName(`leg${side}:${end}`)!.rotation.x = swing * side * end;
  }
  const head = g.getObjectByName("head");
  if (head) {
    head.rotation.y = reduced
      ? 0
      : Math.sin(time * 0.8) * (a.moving ? 0.055 : 0.16);
    head.rotation.x =
      reduced || a.moving || a.kind === "person"
        ? 0
        : 0.1 + Math.sin(time * 2) * 0.055;
  }
  const tail = g.getObjectByName("tail");
  if (tail)
    tail.rotation.z = reduced
      ? 0
      : Math.sin(time * (a.kind === "dog" ? 8 : 2.5)) * 0.3;
  if (a.kind === "person") {
    // Keep the lowest sole on the floor as the legs swing around their hips.
    g.position.y -=
      0.79 - 0.772 * Math.cos(swing) - 0.177 * Math.abs(Math.sin(swing));
  } else if (!reduced && a.moving)
    g.position.y += Math.abs(Math.sin(phase)) * 0.009;
}
