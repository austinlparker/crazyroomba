import * as T from "three";
import {
  box,
  cylinder,
  sphere,
  material,
  lathe,
  ring,
  beam,
  ellipsoid,
  mergeStatic,
} from "../models";
import type { Furniture } from "../level-types";

export function lunarObject(parent: T.Group, o: Furniture) {
  const g = new T.Group();
  g.position.set(o.x, o.floor * 2.8, o.z);
  parent.add(g);
  const { w, d } = o,
    white = "#dce2e0",
    steel = "#7c92a6",
    dark = "#31455e",
    orange = "#da945d",
    glass = "#69c3d3";
  if (o.kind === "rock") {
    // Match the solid basalt obstacles in the playable stage and model gallery.
    const stone = new T.Mesh(
      new T.DodecahedronGeometry(1, 0),
      material("#606e84"),
    );
    stone.geometry.computeBoundingBox();
    const low = stone.geometry.boundingBox!.min.y,
      high = stone.geometry.boundingBox!.max.y;
    const p = stone.geometry.getAttribute("position");
    for (let i = 0; i < p.count; i++)
      p.setXYZ(
        i,
        (p.getX(i) * o.w) / 2,
        ((p.getY(i) - low) * o.top) / (high - low),
        (p.getZ(i) * o.d) / 2,
      );
    stone.geometry.computeVertexNormals();
    stone.geometry.computeBoundingBox();
    stone.castShadow = stone.receiveShadow = true;
    g.add(stone);
  } else if (o.kind === "habitat") {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        box(
          g,
          sx * (w / 2 - 0.1),
          o.bottom / 2,
          sz * (d / 2 - 0.1),
          0.09,
          o.bottom,
          0.09,
          steel,
          0.006,
        );
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        beam(
          g,
          [sx * (w / 2 - 0.1), o.bottom, sz * (d / 2 - 0.1)],
          [sx * w * 0.35, 1.12, sz * d * 0.31],
          0.045,
          steel,
        );
    const body = lathe(
      g,
      [
        [0, -w / 2],
        [0.63, -w / 2],
        [1.08, -w / 2 + 0.14],
        [1.24, -w / 2 + 0.38],
        [1.24, w / 2 - 0.38],
        [1.08, w / 2 - 0.14],
        [0.63, w / 2],
        [0, w / 2],
      ],
      white,
      32,
    );
    body.rotation.z = Math.PI / 2;
    body.position.y = 1.73;
    body.scale.z = d / 2 / 1.24;
    body.material = material(white, 0.42, 0.15);
    for (const x of [-w * 0.38, 0, w * 0.38]) {
      const rib = ring(g, 1.248, 0.045, steel);
      rib.rotation.y = Math.PI / 2;
      rib.scale.x = d / 2 / 1.248;
      rib.position.set(x, 1.73, 0);
    }
    for (const side of [-1, 1]) {
      const port = new T.Group();
      port.position.set(side * w * 0.3, 1.9, d / 2 + 0.01);
      g.add(port);
      ring(port, 0.32, 0.05, steel);
      const lens = cylinder(port, 0, 0, -0.006, 0.285, 0.05, glass);
      lens.rotation.x = Math.PI / 2;
      lens.material = material(glass, 0.16, 0.45);
      for (let i = 0; i < 6; i++)
        sphere(
          port,
          Math.sin((i * Math.PI) / 3) * 0.32,
          Math.cos((i * Math.PI) / 3) * 0.32,
          0.045,
          0.018,
          white,
        );
      box(g, side * w * 0.29, 1.14, d * 0.43, 0.8, 0.1, 0.12, orange, 0.015);
    }
    box(g, 0, 1.2, d / 2 + 0.06, 0.93, 1.45, 0.16, steel, 0.13);
    box(g, 0, 1.22, d / 2 + 0.151, 0.74, 1.21, 0.036, dark, 0.1);
    box(g, 0, 1.58, d / 2 + 0.179, 0.44, 0.26, 0.028, glass, 0.05);
    for (const side of [-1, 1])
      beam(
        g,
        [side * 0.3, 0.93, d / 2 + 0.2],
        [side * 0.3, 1.35, d / 2 + 0.2],
        0.025,
        white,
      );
    box(g, 0, 2.99, 0, 2.4, 0.12, 1.25, steel, 0.03);
    for (let i = 0; i < 9; i++)
      box(g, -1.02 + i * 0.255, 3.06, 0, 0.025, 0.026, 1.15, dark, 0.003);
  } else if (o.kind === "antenna") {
    box(g, 0, 0.2, 0, w, 0.4, d, steel, 0.06);
    cylinder(g, 0, 1.86, 0, 0.09, 3.32, white);
    for (const side of [-1, 1])
      beam(g, [side * 0.58, 0.35, 0], [0, 1.65, 0], 0.04, steel);
    const dish = new T.Group();
    dish.position.set(0, 3.72, 0);
    dish.rotation.z = -0.55;
    g.add(dish);
    const profile: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const r = i * 0.1;
      profile.push([r, 0.34 * r * r]);
    }
    const bowl = lathe(dish, profile, white, 40);
    bowl.material = new T.MeshStandardMaterial({
      color: white,
      roughness: 0.4,
      metalness: 0.35,
      side: T.DoubleSide,
    });
    const rim = ring(dish, 1.2, 0.029, steel);
    rim.rotation.x = Math.PI / 2;
    rim.position.y = 0.49;
    for (let i = 0; i < 3; i++) {
      const a = (i * Math.PI * 2) / 3;
      beam(
        dish,
        [Math.sin(a) * 1.05, 0.38, Math.cos(a) * 1.05],
        [0, 1.05, 0],
        0.022,
        steel,
      );
    }
    cylinder(dish, 0, 1.04, 0, 0.073, 0.18, orange);
    cylinder(g, 0.15, 3.54, 0, 0.18, 0.33, dark).rotation.z = Math.PI / 2;
  } else if (o.kind === "rocket") {
    lathe(
      g,
      [
        [0, 0.17],
        [0.4, 0.17],
        [0.56, 0.35],
        [0.59, 0.7],
        [0.59, 2.66],
        [0.55, 2.94],
        [0.43, 3.22],
        [0.23, 3.54],
        [0, 3.8],
      ],
      white,
      40,
    ).material = material(white, 0.31, 0.3);
    for (const y of [0.72, 2.55]) cylinder(g, 0, y, 0, 0.6, 0.12, orange);
    const port = ring(g, 0.18, 0.037, dark);
    port.position.set(0, 2.12, 0.561);
    cylinder(g, 0, 2.12, 0.573, 0.15, 0.045, glass).rotation.x = Math.PI / 2;
    lathe(
      g,
      [
        [0.33, 0.025],
        [0.31, 0.08],
        [0.21, 0.28],
        [0.22, 0.37],
      ],
      dark,
    );
    for (let i = 0; i < 4; i++) {
      const fin = new T.Group();
      fin.rotation.y = (i * Math.PI) / 2;
      g.add(fin);
      const v: number[] = [];
      const a = [0.46, 0.25],
        b = [0.69, 0.05],
        c = [0.53, 1.16];
      for (const z of [-0.045, 0.045])
        v.push(a[0], a[1], z, b[0], b[1], z, c[0], c[1], z);
      const geo = new T.BufferGeometry();
      geo.setAttribute("position", new T.Float32BufferAttribute(v, 3));
      geo.setIndex([
        0, 2, 1, 3, 4, 5, 0, 1, 4, 0, 4, 3, 1, 2, 5, 1, 5, 4, 2, 0, 3, 2, 3, 5,
      ]);
      geo.computeVertexNormals();
      fin.add(
        new T.Mesh(
          geo,
          new T.MeshStandardMaterial({ color: orange, side: T.DoubleSide }),
        ),
      );
      box(fin, 0.56, 0.08, 0, 0.25, 0.09, 0.19, dark, 0.015);
    }
  } else if (o.kind === "rover") {
    box(g, 0, 0.72, 0, w * 0.83, 0.54, d * 0.86, "#c2a66e", 0.06).material =
      material("#c2a66e", 0.37, 0.5);
    box(g, 0, 1.035, -0.05, w * 0.91, 0.11, d * 0.92, white, 0.025);
    for (const side of [-1, 1]) {
      beam(
        g,
        [side * 0.77, 0.59, -0.86],
        [side * 0.77, 0.44, 0.86],
        0.043,
        steel,
      );
      for (const z of [-0.91, 0, 0.91]) {
        const wheel = new T.Group();
        wheel.position.set(side * 0.82, 0.3, z);
        wheel.rotation.z = Math.PI / 2;
        g.add(wheel);
        lathe(
          wheel,
          [
            [0, -0.075],
            [0.23, -0.075],
            [0.29, -0.05],
            [0.3, 0.045],
            [0.25, 0.09],
            [0, 0.09],
          ],
          dark,
          20,
        );
        for (const sy of [-1, 1])
          cylinder(wheel, 0, sy * 0.095, 0, 0.14, 0.014, steel);
        for (let i = 0; i < 12; i++) {
          const a = (i * Math.PI) / 6;
          box(
            wheel,
            Math.sin(a) * 0.293,
            0,
            Math.cos(a) * 0.293,
            0.027,
            0.15,
            0.025,
            steel,
            0.003,
          ).rotation.y = a;
        }
      }
      box(g, side * 0.65, 1.22, -0.67, 0.055, 0.36, 0.055, steel, 0.008);
      beam(
        g,
        [side * 0.65, 1.39, -1.04],
        [side * 0.65, 1.39, -0.35],
        0.018,
        steel,
      );
      box(g, side * 0.7, 0.78, 0.95, 0.13, 0.16, 0.08, glass, 0.02);
    }
    box(g, 0, 1.19, -0.72, 0.94, 0.29, 0.58, dark, 0.015);
    for (let i = 0; i < 4; i++)
      box(
        g,
        -0.35 + i * 0.23,
        1.36,
        -0.72,
        0.13,
        0.035,
        0.43,
        "#dabd7e",
        0.009,
      );
    cylinder(g, 0, 1.55, 0.54, 0.04, 1, steel);
    box(g, 0, 2.03, 0.54, 0.49, 0.18, 0.18, white, 0.025);
    for (const side of [-1, 1])
      cylinder(g, side * 0.14, 2.03, 0.65, 0.058, 0.045, dark).rotation.x =
        Math.PI / 2;
    beam(g, [0.59, 1.06, -0.94], [0.59, 2.35, -0.94], 0.012, white);
  } else if (o.kind === "solar") {
    for (const sx of [-1, 1])
      for (const sz of [-1, 1])
        box(
          g,
          sx * (w / 2 - 0.1),
          o.bottom / 2,
          sz * (d / 2 - 0.1),
          0.09,
          o.bottom,
          0.09,
          steel,
          0.005,
        );
    box(g, 0, 0.718, 0, w, 0.135, d, steel, 0.016);
    box(g, 0, 0.792, 0, w - 0.08, 0.018, d - 0.08, "#273e65", 0.006);
    for (let i = 0; i < 6; i++)
      for (let j = 0; j < 7; j++) {
        box(
          g,
          -w / 2 + 0.25 + (i * (w - 0.5)) / 5,
          0.806,
          -d / 2 + 0.24 + (j * (d - 0.48)) / 6,
          (w - 0.16) / 6 - 0.018,
          0.009,
          (d - 0.16) / 7 - 0.018,
          (i + j) % 3 ? "#354e80" : "#446793",
          0.01,
        );
      }
    for (let i = 0; i < 6; i++)
      box(
        g,
        -w / 2 + 0.25 + (i * (w - 0.5)) / 5,
        0.816,
        0,
        0.009,
        0.005,
        d - 0.13,
        "#96b9ce",
        0,
      );
  } else {
    box(g, 0, (o.bottom + o.top) / 2, 0, w, o.top - o.bottom, d, dark, 0.035);
    for (const side of [-1, 1]) {
      box(
        g,
        side * (w / 2 - 0.03),
        o.top / 2,
        0,
        0.09,
        o.top,
        d,
        "#526e86",
        0.01,
      );
      for (let i = 0; i < 4; i++)
        box(
          g,
          -w * 0.37 + i * w * 0.25,
          o.top * 0.5,
          side * (d / 2 + 0.009),
          w * 0.22,
          o.top * 0.7,
          0.025,
          "#526e86",
          0.025,
        );
    }
  }
}

export function lunarHardware(g: T.Group) {
  // Painted landing circle and rover tracks add scale without raised collision surfaces.
  const ring = new T.Mesh(
    new T.RingGeometry(2.7, 2.76, 64),
    new T.MeshBasicMaterial({ color: "#cad0d8", side: T.DoubleSide }),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.set(-6, 0.009, 6.8);
  g.add(ring);
  for (let i = 0; i < 32; i++)
    for (const side of [-1, 1]) {
      const z = 2.8 + i * 0.18,
        x = -2 + side * 0.85 + Math.sin(i * 0.035) * 1.4;
      box(g, x, 0.005, z, 0.28, 0.004, 0.06, "#737e97", 0).rotation.y = -0.15;
    }
}

export function earth(g: T.Group) {
  const c = document.createElement("canvas");
  c.width = 512;
  c.height = 256;
  const x = c.getContext("2d")!;
  x.fillStyle = "#398ac4";
  x.fillRect(0, 0, 512, 256);
  x.fillStyle = "#83b987";
  const continents = [
    [
      [30, 48],
      [65, 26],
      [111, 30],
      [146, 59],
      [110, 98],
      [77, 102],
      [58, 74],
    ],
    [
      [109, 103],
      [143, 109],
      [159, 142],
      [139, 190],
      [117, 220],
      [112, 160],
    ],
    [
      [238, 44],
      [283, 31],
      [350, 41],
      [435, 29],
      [475, 77],
      [417, 105],
      [367, 118],
      [325, 85],
      [294, 107],
      [261, 78],
    ],
    [
      [252, 96],
      [298, 101],
      [321, 139],
      [289, 193],
      [257, 164],
      [237, 128],
    ],
    [
      [407, 167],
      [449, 157],
      [479, 184],
      [440, 202],
      [416, 189],
    ],
  ];
  for (const p of continents) {
    x.beginPath();
    p.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b)));
    x.closePath();
    x.fill();
  }
  // Fine cloud streaks break up the continent shapes without a texture download.
  x.fillStyle = "#e2f2ed";
  for (let i = 0; i < 1600; i++) {
    const px = (i * 137.507) % 512,
      py = 20 + ((i * 73.119) % 218);
    const band = Math.sin(px * 0.035 + py * 0.07) + Math.cos(py * 0.15);
    if (band < 0.2) continue;
    x.globalAlpha = 0.08 + (i % 5) * 0.018;
    x.beginPath();
    x.ellipse(px, py, 3 + (i % 8), 0.6 + (i % 4) * 0.4, -0.3, 0, Math.PI * 2);
    x.fill();
  }
  x.globalAlpha = 1;
  x.fillStyle = "#dcedf0";
  x.fillRect(0, 0, 512, 12);
  x.fillRect(0, 245, 512, 11);
  const t = new T.CanvasTexture(c);
  t.colorSpace = T.SRGBColorSpace;
  const globe = new T.Mesh(
    new T.SphereGeometry(6, 32, 24),
    new T.ShaderMaterial({
      uniforms: { globeMap: { value: t } },
      vertexShader: `varying vec2 uvMap; varying vec3 worldNormal; varying vec3 worldPosition;
        void main(){uvMap=uv;worldNormal=mat3(modelMatrix)*normal;vec4 p=modelMatrix*vec4(position,1.);worldPosition=p.xyz;gl_Position=projectionMatrix*viewMatrix*p;}`,
      fragmentShader: `uniform sampler2D globeMap;varying vec2 uvMap;varying vec3 worldNormal;varying vec3 worldPosition;
        void main(){vec3 n=normalize(worldNormal);vec3 v=normalize(cameraPosition-worldPosition);
        float light=smoothstep(-.12,.8,dot(n,normalize(vec3(-.45,.55,1.))));
        vec3 c=texture2D(globeMap,uvMap).rgb*(.035+light*.96);
        float rim=pow(1.-max(dot(n,v),0.),3.);c+=vec3(.035,.17,.45)*rim*(.2+.8*light);
        gl_FragColor=vec4(c,1.);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        }`,
    }),
  );
  const atmosphere = new T.Mesh(
    new T.SphereGeometry(6.1, 32, 24),
    new T.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: T.AdditiveBlending,
      vertexShader: `varying vec3 n;varying vec3 v;void main(){vec4 p=modelViewMatrix*vec4(position,1.);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}`,
      fragmentShader: `varying vec3 n;varying vec3 v;void main(){float rim=pow(1.-max(dot(normalize(n),normalize(v)),0.),4.);gl_FragColor=vec4(.13,.42,.9,rim*.38);}`,
    }),
  );
  globe.add(atmosphere);
  globe.position.set(-81, 51, -105);
  globe.scale.setScalar(3);
  g.add(globe);
  return globe;
}

export function visitor(g: T.Group) {
  const u = new T.Group();
  u.name = "moon-visitor";
  g.add(u);
  lathe(
    u,
    [
      [0, -0.19],
      [0.42, -0.19],
      [0.83, -0.11],
      [1.15, -0.02],
      [1.18, 0.02],
      [0.92, 0.13],
      [0.45, 0.2],
      [0, 0.2],
    ],
    "#9aadc4",
    48,
  ).material = material("#9aadc4", 0.28, 0.7);
  const dome = ellipsoid(u, 0, 0.26, 0, 1.02, 0.63, 1.02, "#67bdcc");
  dome.material = material("#67bdcc", 0.13, 0.4);
  const rim = ring(u, 0.52, 0.035, "#cfddd8");
  rim.rotation.x = Math.PI / 2;
  rim.position.y = 0.19;
  cylinder(u, 0, -0.17, 0, 0.34, 0.07, "#475c76");
  const engine = ring(u, 0.26, 0.03, "#72e3d4");
  engine.rotation.x = Math.PI / 2;
  engine.position.y = -0.212;
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4,
      light = sphere(
        u,
        Math.sin(a) * 0.87,
        -0.03,
        Math.cos(a) * 0.87,
        0.065,
        "#eec776",
      );
    light.material = material("#eec776").clone();
    (light.material as T.MeshStandardMaterial).emissive.set("#e9bd72");
  }
  mergeStatic(u);
  u.traverse((o) => {
    if (o instanceof T.Mesh) o.castShadow = false;
  });
  return u;
}
