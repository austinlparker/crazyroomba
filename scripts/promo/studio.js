import * as T from "three";
import { createRobot, applySkin } from "/src/game/models.ts";
import { SKINS } from "/src/game/progression.ts";

// Original promo set: illuminated turntable, loudspeaker stacks, six robot plinths,
// and an oversized DUST FM cassette. These props never enter the playable world.
export class PromoStudio {
  constructor(renderer) {
    this.renderer = renderer;
    this.scene = new T.Scene();
    this.scene.background = new T.Color("#091011");
    this.scene.fog = new T.Fog("#091011", 8, 19);
    this.camera = new T.PerspectiveCamera(
      46,
      innerWidth / innerHeight,
      0.03,
      60,
    );
    this.scene.add(new T.HemisphereLight("#d1fcff", "#353117", 2.6));
    for (const [x, y, z, color, power] of [
      [-3, 5, 4, "#ffefd0", 6],
      [3, 2, -2, "#4ffff0", 5],
      [-3, 1, -3, "#ff6b28", 5],
    ]) {
      const light = new T.DirectionalLight(color, power);
      light.position.set(x, y, z);
      this.scene.add(light);
    }
    this.materials = {};
    const floor = this.mesh(new T.PlaneGeometry(80, 80), "#101d20", 0.5, 0.4);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.08;
    this.deck = new T.Group();
    this.scene.add(this.deck);
    this.cylinder(this.deck, 1.4, 0.14, 0, 0, 0, "#253138");
    this.cylinder(this.deck, 1.32, 0.035, 0, 0.086, 0, "#101619");
    for (let i = 0; i < 48; i++) {
      const a = (i / 48) * Math.PI * 2;
      const m = this.box(
        this.deck,
        0.055,
        0.025,
        0.17,
        Math.sin(a) * 1.23,
        0.115,
        Math.cos(a) * 1.23,
        i % 4 === 0 ? "#ffe52b" : "#657176",
      );
      m.rotation.y = a;
    }
    this.rings = [];
    for (const [r, c] of [
      [1.38, "#ffe52b"],
      [1.52, "#48e5d2"],
      [2.9, "#265052"],
      [4.2, "#224449"],
    ]) {
      const ring = this.mesh(
        new T.TorusGeometry(r, 0.011, 8, 128),
        c,
        0.2,
        0.1,
        true,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.07;
      this.rings.push(ring);
    }
    this.hero = createRobot();
    applySkin(this.hero, "taxi");
    this.hero.scale.multiplyScalar(3.5);
    this.hero.position.y = 0.06;
    this.deck.add(this.hero);
    this.satellites = [];
    SKINS.forEach((skin, i) => {
      const group = new T.Group();
      this.scene.add(group);
      const robot = createRobot();
      applySkin(robot, skin.id);
      robot.scale.multiplyScalar(2.5);
      robot.position.y = 0.09;
      group.add(robot);
      this.cylinder(group, 0.53, 0.09, 0, 0.025, 0, "#273438");
      const ring = this.mesh(
        new T.TorusGeometry(0.51, 0.008, 6, 48),
        skin.color,
        0.2,
        0.1,
        true,
        group,
      );
      ring.rotation.x = Math.PI / 2;
      ring.position.y = 0.08;
      this.satellites.push({ group, robot });
    });
    this.speakers = [];
    for (const side of [-1, 1]) {
      const stack = new T.Group();
      stack.position.set(side * 1.8, 0.54, -1);
      stack.rotation.y = -side * 0.25;
      this.scene.add(stack);
      this.box(stack, 0.72, 1.2, 0.43, 0, 0, 0, "#18272d");
      this.box(stack, 0.66, 1.1, 0.025, 0, 0, 0.23, "#111719");
      for (const y of [-0.25, 0.25]) {
        const cone = this.mesh(
          new T.ConeGeometry(0.24, 0.075, 48),
          "#425155",
          0.55,
          0.4,
          false,
          stack,
        );
        cone.rotation.x = Math.PI / 2;
        cone.position.set(0, y, 0.29);
        const rim = this.mesh(
          new T.TorusGeometry(0.24, 0.023, 8, 48),
          "#ffe52b",
          0.25,
          0.3,
          false,
          stack,
        );
        rim.position.set(0, y, 0.27);
        const center = this.mesh(
          new T.SphereGeometry(0.087, 20, 12),
          "#111919",
          0.2,
          0.6,
          false,
          stack,
        );
        center.scale.z = 0.4;
        center.position.set(0, y, 0.28);
        this.speakers.push(cone);
      }
    }
    this.cassette = new T.Group();
    this.scene.add(this.cassette);
    this.box(this.cassette, 1.3, 0.78, 0.13, 0, 0, 0, "#ffb91e");
    this.box(this.cassette, 1.16, 0.55, 0.015, 0, 0.04, 0.079, "#e8ebd6");
    this.box(this.cassette, 0.83, 0.19, 0.018, 0, -0.015, 0.094, "#14272d");
    for (const x of [-0.3, 0.3]) {
      const reel = this.mesh(
        new T.TorusGeometry(0.096, 0.021, 8, 32),
        "#d6ddd5",
        0.25,
        0.4,
        false,
        this.cassette,
      );
      reel.position.set(x, -0.015, 0.112);
      for (let k = 0; k < 6; k++) {
        const a = (k / 6) * Math.PI * 2;
        const tooth = this.box(
          this.cassette,
          0.014,
          0.047,
          0.018,
          x + Math.cos(a) * 0.07,
          -0.015 + Math.sin(a) * 0.07,
          0.115,
          "#929e93",
        );
        tooth.rotation.z = a - Math.PI / 2;
      }
    }
    for (const x of [-0.55, 0.55])
      for (const y of [-0.29, 0.29]) {
        const screw = this.mesh(
          new T.SphereGeometry(0.022, 8, 6),
          "#667b80",
          0.1,
          0.8,
          false,
          this.cassette,
        );
        screw.scale.z = 0.3;
        screw.position.set(x, y, 0.08);
      }
    const label = document.createElement("canvas");
    label.width = 768;
    label.height = 128;
    const c = label.getContext("2d");
    c.fillStyle = "#e8ebd6";
    c.fillRect(0, 0, 768, 128);
    c.fillStyle = "#14272d";
    c.font = "900 78px Arial";
    c.textAlign = "center";
    c.fillText("DUST FM  /  SIDE A", 384, 92);
    const tex = new T.CanvasTexture(label);
    tex.colorSpace = T.SRGBColorSpace;
    const plane = new T.Mesh(
      new T.PlaneGeometry(1.08, 0.17),
      new T.MeshBasicMaterial({ map: tex }),
    );
    plane.position.set(0, 0.22, 0.091);
    this.cassette.add(plane);
    this.cassette.position.set(-0.15, 0.3, 1.0);
    this.cassette.scale.setScalar(0.35);
  }
  material(color, roughness, metalness, glow) {
    const key = [color, roughness, metalness, glow].join(":");
    return (this.materials[key] ??= new T.MeshStandardMaterial({
      color,
      roughness,
      metalness,
      emissive: glow ? color : "#000000",
      emissiveIntensity: glow ? 1.3 : 0,
    }));
  }
  mesh(
    geo,
    color,
    roughness = 0.5,
    metalness = 0.2,
    glow = false,
    parent = this.scene,
  ) {
    const m = new T.Mesh(geo, this.material(color, roughness, metalness, glow));
    parent.add(m);
    return m;
  }
  box(parent, w, h, d, x, y, z, color) {
    const m = this.mesh(
      new T.BoxGeometry(w, h, d),
      color,
      0.35,
      0.45,
      false,
      parent,
    );
    m.position.set(x, y, z);
    return m;
  }
  cylinder(parent, r, h, x, y, z, color) {
    const m = this.mesh(
      new T.CylinderGeometry(r, r, h, 96),
      color,
      0.32,
      0.6,
      false,
      parent,
    );
    m.position.set(x, y, z);
    return m;
  }
  render(id, t, time, duration) {
    const lineup = id === "skins";
    this.hero.visible = true;
    const skinIndex = Math.min(5, Math.floor(t / (duration / 6)));
    applySkin(this.hero, lineup ? SKINS[skinIndex].id : "taxi");
    this.deck.rotation.y = id === "hook" ? -1 + t * 0.7 : time * 0.28;
    const brush = this.hero.getObjectByName("brush");
    if (brush) brush.rotation.y = time * 14;
    this.satellites.forEach(({ group, robot }, i) => {
      group.visible = false;
      const a = ((i - 1) * Math.PI) / 3 + t * 0.6;
      group.position.set(
        Math.sin(a) * 1.25,
        0.15 + Math.sin(time * 3 + i) * 0.035,
        Math.cos(a) * 1.25,
      );
      robot.rotation.y = -a + Math.PI * 0.1;
      group.scale.setScalar(
        i === Math.min(5, Math.floor(t / 0.5)) ? 1.0 : 0.76,
      );
    });
    this.cassette.visible = false;
    this.cassette.rotation.set(-0.12, -0.45 + Math.sin(t) * 0.15, -0.18);
    this.cassette.position.y = 0.3 + Math.sin(t * 2) * 0.01;
    this.speakers.forEach((cone, i) => {
      cone.scale.setScalar(
        1 +
          Math.pow(Math.max(0, Math.sin((time * Math.PI * 2 * 164) / 60)), 8) *
            0.05,
      );
    });
    const progress = Math.min(1, t / duration);
    let name,
      dist,
      a,
      height,
      aim = 0.35;
    if (id === "hook" && t < 0.7) {
      const p = t / 0.7;
      name = "macro slide";
      dist = 2.9 - p * 0.3;
      a = -0.4 + p * 0.42;
      height = 1.9 - p * 0.15;
      this.camera.fov = 44 - p * 3;
    } else if (id === "hook") {
      const p = (t - 0.7) / (duration - 0.7);
      name = "hero reveal";
      dist = 3.8 - p * 0.45;
      a = 0.35 - p * 0.45;
      height = 1.45 + p * 0.2;
      this.camera.fov = 46;
    } else if (lineup) {
      const p = (t % (duration / 6)) / (duration / 6);
      name = `skin match cut ${skinIndex + 1}`;
      dist = 3.65 - p * 0.22;
      a = [-0.3, 0.22, -0.13, 0.35, -0.25, 0.05][skinIndex] + p * 0.1;
      height = 1.75 - p * 0.15;
      this.camera.fov = 44 - p;
      this.deck.rotation.y = -0.45 + p * 0.3;
    } else {
      name = "closing dolly";
      dist = 3.85 - progress * 0.3;
      a = -0.28 + progress * 0.16;
      height = 1.65;
      this.camera.fov = 46;
    }
    this.camera.position.set(Math.sin(a) * dist, height, Math.cos(a) * dist);
    this.camera.lookAt(0, aim, 0);
    this.camera.updateProjectionMatrix();
    this.renderer.setRenderTarget(null);
    this.renderer.render(this.scene, this.camera);
    return name;
  }
}
