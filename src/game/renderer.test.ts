import { afterEach, expect, it, vi } from "vitest";
import { PerspectiveCamera } from "three";
import { GameRenderer } from "./renderer";

afterEach(() => vi.unstubAllGlobals());

it("resizes for a changed display density while honoring the low-quality cap", () => {
  vi.stubGlobal("innerWidth", 900);
  vi.stubGlobal("innerHeight", 600);
  vi.stubGlobal("devicePixelRatio", 2);
  let ratio = 1;
  const renderer = {
    getPixelRatio: () => ratio,
    setPixelRatio: vi.fn((value: number) => {
      ratio = value;
    }),
    setSize: vi.fn(),
  };
  const post = { resize: vi.fn() };
  const view = {
    renderer,
    post,
    camera: new PerspectiveCamera(),
    low: false,
    dirty: false,
  };
  const resize = () =>
    GameRenderer.prototype.resize.call(view as unknown as GameRenderer);
  resize();
  expect(ratio).toBe(1.75);
  expect(view.camera.aspect).toBe(1.5);
  expect(view.dirty).toBe(true);
  expect(post.resize).toHaveBeenLastCalledWith(900, 600);
  resize();
  expect(renderer.setPixelRatio).toHaveBeenCalledTimes(1);
  view.low = true;
  resize();
  expect(ratio).toBe(1);
  vi.stubGlobal("devicePixelRatio", 0.8);
  resize();
  expect(ratio).toBe(0.8);
  vi.stubGlobal("innerWidth", 0);
  vi.stubGlobal("innerHeight", 0);
  resize();
  expect(renderer.setSize).toHaveBeenLastCalledWith(1, 1);
  expect(view.camera.projectionMatrix.elements.every(Number.isFinite)).toBe(
    true,
  );
});

it("uses a changed system motion preference on the next frame without a reload", () => {
  const preference = { matches: false };
  const view = Object.create(GameRenderer.prototype) as GameRenderer;
  Object.assign(view, { motionPreference: preference });
  expect(view.reducedMotion).toBe(false);
  preference.matches = true;
  expect(view.reducedMotion).toBe(true);
});
