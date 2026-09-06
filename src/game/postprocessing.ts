import { Vector2, type WebGLRenderer, type Scene, type Camera } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
export function createPostprocessing(
  renderer: WebGLRenderer,
  scene: Scene,
  camera: Camera,
) {
  const composer = new EffectComposer(renderer);
  let pixelRatio = renderer.getPixelRatio();
  const render = new RenderPass(scene, camera),
    bloom = new UnrealBloomPass(new Vector2(1, 1), 0.035, 0.25, 2.5),
    output = new OutputPass();
  composer.addPass(render);
  composer.addPass(bloom);
  composer.addPass(output);
  return {
    render: () => composer.render(),
    resize: (w: number, h: number) => {
      const ratio = renderer.getPixelRatio();
      if (pixelRatio !== ratio) {
        pixelRatio = ratio;
        composer.setPixelRatio(ratio);
      }
      composer.setSize(w, h);
    },
    dispose: () => {
      bloom.dispose();
      output.dispose();
      composer.dispose();
    },
  };
}
