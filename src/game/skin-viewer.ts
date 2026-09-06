import * as T from "three";
import { createRobot, applySkin, clearModelCache } from "./models";
import { disposeScene } from "./renderer";
import type { SkinId } from "./progression";

/** The garage owns this small second renderer only while its dialog is open. */
export class SkinViewer {
  private renderer: T.WebGLRenderer;
  private scene = new T.Scene();
  private camera = new T.PerspectiveCamera(36, 1, 0.01, 10);
  private robot = createRobot();
  private raf = 0;
  private last = 0;
  private observer: ResizeObserver;
  private reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
  constructor(
    private canvas: HTMLCanvasElement,
    id: SkinId,
  ) {
    clearModelCache();
    this.renderer = new T.WebGLRenderer({
      canvas,
      alpha: true,
      antialias: true,
    });
    this.renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
    this.renderer.toneMapping = T.ACESFilmicToneMapping;
    this.camera.position.set(0.38, 0.38, 0.54);
    this.camera.lookAt(0, 0.04, 0);
    this.scene.add(new T.HemisphereLight("#fff4d6", "#41547e", 3), this.robot);
    const light = new T.DirectionalLight("#ffffff", 3);
    light.position.set(-1, 2, 1);
    this.scene.add(light);
    this.setSkin(id);
    this.observer = new ResizeObserver(() => this.resize());
    this.observer.observe(canvas);
    this.resize();
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  setSkin(id: SkinId) {
    applySkin(this.robot, id);
  }
  private resize() {
    const { width, height } = this.canvas.getBoundingClientRect();
    if (!width || !height) return;
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.updateProjectionMatrix();
  }
  private frame(t: number) {
    if (!document.hidden && t - this.last >= 1000 / 30) {
      this.last = t;
      if (!this.reduced) this.robot.rotation.y = t * 0.0004;
      this.renderer.render(this.scene, this.camera);
    }
    this.raf = requestAnimationFrame((t) => this.frame(t));
  }
  dispose() {
    cancelAnimationFrame(this.raf);
    this.observer.disconnect();
    disposeScene(this.scene);
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
