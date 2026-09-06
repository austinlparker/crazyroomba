import { afterEach, expect, it, vi } from "vitest";
import { PerspectiveCamera, Scene, Vector2, type WebGLRenderer } from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { createPostprocessing } from "./postprocessing";

afterEach(() => vi.restoreAllMocks());

it("keeps actual effect targets aligned with viewport size and display density", () => {
  let ratio = 1;
  const renderer = {
    getPixelRatio: () => ratio,
    getSize: (target: Vector2) => target.set(800, 600),
  } as WebGLRenderer;
  const sizes = vi.spyOn(EffectComposer.prototype, "setSize");
  const ratios = vi.spyOn(EffectComposer.prototype, "setPixelRatio");
  const post = createPostprocessing(
    renderer,
    new Scene(),
    new PerspectiveCamera(),
  );
  try {
    post.resize(800, 600);
    const composer = sizes.mock.contexts[0] as EffectComposer;
    expect(composer.renderTarget1.width).toBe(800);
    expect(composer.renderTarget2.height).toBe(600);

    ratio = 1.75;
    post.resize(1000, 700);
    expect(composer.renderTarget1.width).toBe(1750);
    expect(composer.renderTarget2.height).toBe(1225);
    expect(ratios).toHaveBeenCalledTimes(1);

    post.resize(700, 1000);
    expect(composer.renderTarget1.width).toBe(1225);
    expect(composer.renderTarget2.height).toBe(1750);
    expect(ratios).toHaveBeenCalledTimes(1);

    ratio = 1;
    post.resize(700, 1000);
    expect(composer.renderTarget1.width).toBe(700);
    expect(composer.renderTarget2.height).toBe(1000);
    expect(ratios).toHaveBeenCalledTimes(2);
  } finally {
    post.dispose();
  }
});
