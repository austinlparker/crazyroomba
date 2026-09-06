import * as T from "three";
import { createDust, createRobot, clearModelCache, applySkin } from "./models";
import { Simulation, type GameEvent } from "./simulation";
import type { Level } from "./navigation";
import type { StageVisual } from "./stages/visual-types";
import type { SkinId } from "./progression";
import { stairMotion, nearbyStair } from "./stair-motion";
import { ImpactMotion } from "./impact-motion";
import { createResident, animateResident } from "./household-models";
import {
  cameraPose,
  cameraFov,
  angleDelta,
  interpolatePose,
  cameraDepthRange,
  type CameraMode,
} from "./camera";
import type { createPostprocessing } from "./postprocessing";

export class GameRenderer {
  readonly renderer: T.WebGLRenderer;
  readonly scene = new T.Scene();
  readonly camera = new T.PerspectiveCamera(68, 1, 0.025, 260);
  readonly robot = createRobot();
  readonly dust: T.InstancedMesh[] = [];
  private dustMatrix = new T.Matrix4();
  private dustPosition = new T.Vector3();
  private dustRotation = new T.Quaternion();
  private dustScale = new T.Vector3(0.55, 0.44, 0.55);
  private axisY = new T.Vector3(0, 1, 0);
  residents: T.Group[] = [];
  private post: ReturnType<typeof createPostprocessing> | null = null;
  private postEpoch = 0;
  private world: T.Group | null = null;
  private backdrop: T.Group | undefined;
  private extent = 10;
  private orbit = 0.7;
  private orbitTarget = 0.7;
  private hemi: T.HemisphereLight;
  private ground: T.Mesh;
  private look = new T.Vector3();
  private sun: T.DirectionalLight;
  private sunOffset = new T.Vector3();
  private shadowExtent = 0;
  private ring: T.Mesh;
  private particles: {
    p: T.Vector3;
    v: T.Vector3;
    life: number;
    color: T.Color;
  }[] = [];
  private freeParticles: typeof this.particles = [];
  private trailTime = 0;
  private cameraPosition = new T.Vector3();
  private cameraTarget = new T.Vector3();
  dirty = true;
  private animateWorld: ((time: number, dt: number) => void) | undefined;
  private particleGeo = new T.BufferGeometry();
  private particlePositions = new Float32Array(240 * 3);
  private particleColors = new Float32Array(240 * 3);
  private low = false;
  cameraMode: CameraMode = "chase";
  private snapCamera = true;
  private chaseYaw = 0;
  private chassisPitch = 0;
  private chassisRoll = 0;
  private impactMotion = new ImpactMotion();
  private motionPreference = matchMedia("(prefers-reduced-motion: reduce)");
  get reducedMotion(): boolean {
    return this.motionPreference.matches;
  }
  constructor(
    readonly canvas: HTMLCanvasElement,
    public level: Level,
    visual: StageVisual,
  ) {
    this.renderer = new T.WebGLRenderer({
      canvas,
      antialias: true,
      alpha: false,
      powerPreference: "high-performance",
    });
    this.renderer.shadowMap.enabled = true;
    this.renderer.shadowMap.autoUpdate = false;
    this.renderer.shadowMap.type = T.PCFShadowMap;
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.scene.background = new T.Color("#222b46");
    this.scene.fog = new T.Fog("#222b46", 75, 130);
    this.hemi = new T.HemisphereLight("#fff0d6", "#53618e", 1.75);
    this.scene.add(this.hemi);
    this.sun = new T.DirectionalLight("#fff0ce", 2.4);
    this.sun.position.set(-6, 20, 4);
    this.sun.castShadow = true;
    this.sun.shadow.mapSize.set(1024, 1024);
    Object.assign(this.sun.shadow.camera, {
      left: -10,
      right: 10,
      top: 11,
      bottom: -11,
      near: 1,
      far: 45,
    });
    this.sun.shadow.normalBias = 0.018;
    this.sun.shadow.bias = -0.0003;
    this.sun.shadow.radius = 3;
    this.scene.add(this.sun, this.sun.target);
    const fill = new T.DirectionalLight("#c5e7dd", 0.65);
    fill.position.set(12, 10, -5);
    this.scene.add(fill);
    this.ground = new T.Mesh(
      new T.PlaneGeometry(200, 200),
      new T.MeshStandardMaterial({ color: "#222a3b", roughness: 1 }),
    );
    this.ground.rotation.x = -Math.PI / 2;
    this.ground.position.y = -0.64;
    this.ground.receiveShadow = true;
    this.scene.add(this.ground);
    this.scene.add(this.robot);
    const template = createDust();
    for (const child of template.children) {
      if (!(child instanceof T.Mesh)) continue;
      const mesh = new T.InstancedMesh(child.geometry, child.material, 64);
      mesh.instanceMatrix.setUsage(T.DynamicDrawUsage);
      mesh.frustumCulled = false;
      mesh.castShadow = false;
      this.dust.push(mesh);
      this.scene.add(mesh);
    }
    const ringMat = new T.MeshBasicMaterial({
      color: "#d9ff8f",
      transparent: true,
      opacity: 0.75,
      side: T.DoubleSide,
      depthWrite: false,
    });
    this.ring = new T.Mesh(new T.RingGeometry(0.36, 0.39, 64), ringMat);
    this.ring.rotation.x = -Math.PI / 2;
    this.ring.position.set(level.DOCK.x, 0.045, level.DOCK.z);
    this.scene.add(this.ring);
    this.particleGeo.setAttribute(
      "position",
      new T.BufferAttribute(this.particlePositions, 3),
    );
    this.particleGeo.setAttribute(
      "color",
      new T.BufferAttribute(this.particleColors, 3),
    );
    const sparkMaterial = new T.PointsMaterial({
      size: 0.025,
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    sparkMaterial.onBeforeCompile = (shader) => {
      shader.vertexShader = shader.vertexShader.replace(
        "#include <fog_vertex>",
        "#include <fog_vertex>\ngl_PointSize = min(gl_PointSize, 18.0);",
      );
      shader.fragmentShader = shader.fragmentShader.replace(
        "#include <color_fragment>",
        "#include <color_fragment>\nvec2 spark = gl_PointCoord - .5; diffuseColor.a *= (1.0 - smoothstep(.015, .25, dot(spark, spark)));",
      );
    };
    const points = new T.Points(this.particleGeo, sparkMaterial);
    points.frustumCulled = false;
    this.scene.add(points);
    this.setStage(level, visual);
    this.camera.position.set(25, 27, 31);
    this.look.set(0, 0, 0);
    this.resize();
  }
  setStage(level: Level, visual: StageVisual): void {
    if (this.world) {
      this.world.removeFromParent();
      disposeScene(this.world);
    }
    this.level = level;
    this.animateWorld = visual.animate;
    this.dirty = true;
    this.world = visual.group;
    this.backdrop = visual.backdrop;
    this.ground.visible = !visual.hideGround;
    this.extent = visual.extent;
    this.residents = level.routines.map((r) => createResident(r.id));
    if (this.residents.length) this.world.add(...this.residents);
    this.scene.add(this.world);
    this.scene.background = new T.Color(visual.background);
    this.scene.fog = new T.Fog(visual.background, 65, 140);
    (this.ground.material as T.MeshStandardMaterial).color.set(visual.ground);
    this.hemi.color.set(visual.ambient);
    this.sun.color.set(visual.sun);
    this.sun.position
      .set(-0.65, visual.sunElevation ?? 0.55, -0.45)
      .normalize()
      .multiplyScalar(Math.max(30, visual.extent * 1.8));
    this.sunOffset.copy(this.sun.position);
    this.shadowExtent = visual.extent;
    Object.assign(this.sun.shadow.camera, {
      left: -visual.extent,
      right: visual.extent,
      top: visual.extent,
      bottom: -visual.extent,
      far: Math.max(65, visual.extent * 4),
    });
    this.sun.shadow.camera.updateProjectionMatrix();
    this.ring.position.set(level.DOCK.x, level.DOCK.y + 0.045, level.DOCK.z);
    this.freeParticles.push(...this.particles);
    this.particles.length = 0;
    this.particleGeo.setDrawRange(0, 0);
    this.snapCamera = true;
    this.impactMotion.reset();
    this.renderer.renderLists.dispose();
    clearModelCache();
  }
  rotatePreview(direction: number): void {
    this.orbitTarget += direction * Math.PI * 0.42;
  }
  skin(id: SkinId): void {
    applySkin(this.robot, id);
  }
  quality(low: boolean): void {
    this.low = low;
    this.renderer.shadowMap.enabled = !low;
    const epoch = ++this.postEpoch;
    if (low) {
      this.post?.dispose();
      this.post = null;
    } else if (!this.post)
      void import("./postprocessing")
        .then(({ createPostprocessing }) => {
          if (epoch !== this.postEpoch || this.low) return;
          this.post = createPostprocessing(
            this.renderer,
            this.scene,
            this.camera,
          );
          this.post.resize(innerWidth, innerHeight);
        })
        .catch(() => {
          /* The direct renderer remains usable if the effect chunk fails. */
        });
    this.resize();
  }
  resize(): void {
    this.dirty = true;
    const w = Math.max(1, innerWidth),
      h = Math.max(1, innerHeight),
      ratio = Math.min(devicePixelRatio, this.low ? 1 : 1.75);
    if (this.renderer.getPixelRatio() !== ratio)
      this.renderer.setPixelRatio(ratio);
    this.renderer.setSize(w, h);
    this.post?.resize(w, h);
    this.camera.aspect = w / h;
    this.camera.updateProjectionMatrix();
  }
  burst(event: GameEvent): void {
    if (event.kind === "chain-lost") return;
    this.impactMotion.hit(event);
    const color = new T.Color(
      event.kind === "deposit"
        ? "#c8ff70"
        : event.kind === "bump"
          ? "#fff3c8"
          : "#edc366",
    );
    const count =
      event.value === 0 && event.kind === "pickup"
        ? 3
        : event.kind === "deposit"
          ? 36
          : event.kind === "bump"
            ? Math.round(3 + Math.min(event.value, 5) * 2)
            : 10;
    for (let i = 0; i < count && this.particles.length < 220; i++) {
      const p = this.freeParticles.pop() ?? {
        p: new T.Vector3(),
        v: new T.Vector3(),
        life: 0,
        color: new T.Color(),
      };
      const angle = Math.random() * Math.PI * 2,
        speed = 0.2 + Math.random() * 0.65;
      p.p.set(event.x, (event.y ?? 0) + 0.12, event.z);
      p.v.set(
        Math.sin(angle) * speed,
        0.3 + Math.random() * 0.65,
        Math.cos(angle) * speed,
      );
      p.life = 0.5 + Math.random() * 0.5;
      p.color.copy(color);
      this.particles.push(p);
    }
  }
  setCamera(mode: CameraMode): void {
    this.dirty = true;
    this.cameraMode = mode;
    this.snapCamera = true;
  }
  render(
    sim: Simulation,
    dt: number,
    time: number,
    menu: boolean,
    intro = 1,
    alpha = 1,
  ): void {
    const backdropChanged = this.backdrop && this.backdrop.visible === menu;
    this.renderer.shadowMap.needsUpdate =
      this.dirty || !menu || !!backdropChanged;
    this.dirty = false;
    // Keep outdoor shadows sharp as the stage grows; the sunlight direction stays fixed.
    const follow = this.level.outdoor && !menu;
    const extent = follow ? 12 : this.extent;
    if (extent !== this.shadowExtent) {
      this.shadowExtent = extent;
      Object.assign(this.sun.shadow.camera, {
        left: -extent,
        right: extent,
        top: extent,
        bottom: -extent,
      });
      this.sun.shadow.camera.updateProjectionMatrix();
    }
    const texel = (extent * 2) / this.sun.shadow.mapSize.x;
    this.sun.target.position.set(
      follow ? Math.round(sim.x / texel) * texel : 0,
      0,
      follow ? Math.round(sim.z / texel) * texel : 0,
    );
    this.sun.position.copy(this.sunOffset).add(this.sun.target.position);
    this.animateWorld?.(this.reducedMotion ? 0 : time, dt);
    if (this.backdrop) this.backdrop.visible = !menu;
    this.robot.visible =
      menu ||
      (intro < 0.9 && !this.reducedMotion) ||
      this.cameraMode !== "first-person";
    const driver = interpolatePose(sim.previous, sim, menu ? 1 : alpha);
    const motion = sim.grounded
      ? stairMotion(
          { ...driver, speed: sim.speed, boosting: sim.boosting },
          this.reducedMotion,
          this.level,
        )
      : {
          y: driver.y,
          pitch:
            -Math.atan2(sim.vy, Math.max(2, Math.hypot(sim.vx, sim.vz))) * 0.4,
          roll: 0,
        };
    const suspension = this.snapCamera ? 1 : 1 - Math.exp(-dt * 18);
    this.chassisPitch += (motion.pitch - this.chassisPitch) * suspension;
    this.chassisRoll += (motion.roll - this.chassisRoll) * suspension;
    if (menu) this.impactMotion.reset();
    const impact = this.impactMotion.pose(dt, driver.angle, this.reducedMotion);
    this.robot.position.set(driver.x, motion.y + 0.012 + impact.lift, driver.z);
    this.robot.rotation.order = "YXZ";
    this.robot.rotation.set(
      this.chassisPitch + impact.pitch,
      driver.angle,
      this.chassisRoll + impact.roll,
    );
    const ramp = sim.grounded ? nearbyStair(driver, this.level) : undefined;
    for (const mesh of this.residents) {
      const actor = sim.residents.find((a) => a.id === mesh.name);
      mesh.visible = !!actor;
      if (actor)
        animateResident(mesh, actor, this.reducedMotion, menu ? 0 : time);
    }
    this.robot.getObjectByName("brush")!.rotation.y = this.reducedMotion
      ? 0
      : time * (sim.boosting ? 40 : 18);
    for (let i = 0; i < sim.dust.length; i++) {
      const d = sim.dust[i];
      this.dustPosition.set(
        d.x,
        d.y +
          (this.reducedMotion ? 0.008 : 0.015 + Math.sin(time * 3 + i) * 0.008),
        d.z,
      );
      this.dustRotation.setFromAxisAngle(
        this.axisY,
        menu
          ? this.reducedMotion
            ? i
            : time * 0.3 + i
          : Math.atan2(sim.x - d.x, sim.z - d.z),
      );
      this.dustScale.set(
        d.active ? 0.55 : 0,
        d.active ? 0.44 : 0,
        d.active ? 0.55 : 0,
      );
      this.dustMatrix.compose(
        this.dustPosition,
        this.dustRotation,
        this.dustScale,
      );
      for (const m of this.dust) m.setMatrixAt(i, this.dustMatrix);
    }
    for (const m of this.dust) {
      m.count = sim.dust.length;
      m.instanceMatrix.needsUpdate = true;
    }
    const pulse = this.reducedMotion ? 1 : 1 + Math.sin(time * 3) * 0.05;
    this.ring.scale.setScalar(pulse);
    this.trailTime += dt;
    if (
      sim.boosting &&
      Math.hypot(sim.vx, sim.vz) > 0.4 &&
      !menu &&
      !this.reducedMotion &&
      this.trailTime > 0.035
    ) {
      this.trailTime = 0;
      this.burst({
        kind: "pickup",
        x: sim.x - Math.sin(sim.angle) * 0.18,
        y: sim.y,
        z: sim.z - Math.cos(sim.angle) * 0.18,
        value: 0,
      });
    }
    let live = 0;
    for (const p of this.particles) {
      p.life -= dt;
      if (p.life <= 0) {
        this.freeParticles.push(p);
        continue;
      }
      p.v.y -= dt * 4;
      p.p.addScaledVector(p.v, dt);
      this.particles[live] = p;
      p.p.toArray(this.particlePositions, live * 3);
      const fade = Math.min(1, p.life * 2);
      this.particleColors[live * 3] = p.color.r * fade;
      this.particleColors[live * 3 + 1] = p.color.g * fade;
      this.particleColors[live * 3 + 2] = p.color.b * fade;
      live++;
    }
    this.particles.length = live;
    this.particleGeo.setDrawRange(0, this.particles.length);
    this.particleGeo.attributes.position.needsUpdate = true;
    this.particleGeo.attributes.color.needsUpdate = true;
    const pos = this.cameraPosition,
      target = this.cameraTarget;
    if (menu) {
      const wide =
        innerWidth > 850 || (innerWidth > innerHeight && innerWidth >= 650);
      if (!this.reducedMotion) this.orbitTarget += dt * 0.035;
      this.orbit +=
        (this.orbitTarget - this.orbit) *
        (this.reducedMotion ? 1 : 1 - Math.exp(-dt * 3));
      const size =
        this.extent * (wide ? 1 : Math.max(1.05, 0.94 / this.camera.aspect));
      const centerX = (this.level.BOUNDS.minX + this.level.BOUNDS.maxX) / 2,
        centerZ = (this.level.BOUNDS.minZ + this.level.BOUNDS.maxZ) / 2;
      pos.set(
        centerX + Math.sin(this.orbit) * size * 1.3,
        size * 1.15,
        centerZ + Math.cos(this.orbit) * size * 1.3,
      );
      target.set(centerX, 1, centerZ);
      this.camera.setViewOffset(
        innerWidth,
        innerHeight,
        wide ? -innerWidth * 0.18 : 0,
        wide ? -innerHeight * 0.01 : innerHeight * 0.19,
        innerWidth,
        innerHeight,
      );
      this.camera.fov = 43;
      this.snapCamera = true;
    } else {
      this.camera.clearViewOffset();
      const heading =
        !sim.grounded &&
        this.cameraMode === "chase" &&
        Math.hypot(sim.vx, sim.vz) > 1
          ? Math.atan2(sim.vx, sim.vz)
          : driver.angle;
      this.chaseYaw +=
        angleDelta(this.chaseYaw, heading) *
        (this.snapCamera || this.cameraMode === "first-person"
          ? 1
          : 1 - Math.exp(-dt * 10));
      // Follow a single interpolated rig: position and aim share the same yaw.
      const pose = cameraPose(
        { ...driver, angle: this.chaseYaw },
        this.cameraMode,
        this.level,
      );
      pos.set(pose.position.x, pose.position.y, pose.position.z);
      target.set(pose.target.x, pose.target.y, pose.target.z);
      if (this.cameraMode === "chase" && !ramp)
        target.y -= Math.max(0, 1 - this.camera.aspect / 0.85) * 0.75;
      if (intro < 1 && !this.reducedMotion) {
        // A short floor-level dolly enters the dock bay, settling before controls unlock.
        const t = Math.max(0, Math.min(1, intro / 0.9));
        const ease = t * t * (3 - 2 * t);
        const opening = new T.Vector3(
          this.level.DOCK.x + Math.sin(this.level.DOCK_FACING) * 0.3,
          1.15,
          this.level.DOCK.z + 0.25,
        );
        pos.lerpVectors(opening, pos, ease);
        target.lerpVectors(
          new T.Vector3(sim.x, 0.15, sim.z - 0.25),
          target,
          ease,
        );
      }
      this.camera.fov = cameraFov(
        this.camera.fov,
        this.cameraMode,
        this.camera.aspect,
        sim.boosting,
        dt,
        this.snapCamera,
        this.reducedMotion,
      );
      this.snapCamera = false;
    }
    if (menu) {
      const smoothing = this.reducedMotion ? 1 : 1 - Math.exp(-dt * 2);
      this.camera.position.lerp(pos, smoothing);
      this.look.lerp(target, smoothing);
    } else {
      this.camera.position.copy(pos);
      this.look.copy(target);
    }
    this.camera.lookAt(this.look);
    const depth = cameraDepthRange(
      menu,
      this.camera.position.distanceTo(this.look),
      this.extent,
    );
    this.camera.near = depth.near;
    this.camera.far = depth.far;
    this.camera.updateProjectionMatrix();
    if (this.post && !this.low) this.post.render();
    else this.renderer.render(this.scene, this.camera);
  }
}

export function disposeScene(root: T.Object3D): void {
  const geometries = new Set<T.BufferGeometry>(),
    materials = new Set<T.Material>(),
    textures = new Set<T.Texture>();
  root.traverse((o) => {
    if (o instanceof T.Mesh || o instanceof T.Points) {
      geometries.add(o.geometry);
      for (const m of Array.isArray(o.material) ? o.material : [o.material])
        materials.add(m);
    }
  });
  for (const m of materials) {
    for (const value of Object.values(m))
      if (value instanceof T.Texture) textures.add(value);
    m.dispose();
  }
  for (const t of textures) t.dispose();
  for (const g of geometries) g.dispose();
  root.clear();
}
