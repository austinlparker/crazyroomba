import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { Input } from "./input";
import { Keys } from "./simulation";

class Control {
  isContentEditable = false;
  constructor(private tag = "button") {}
  matches(selector: string) {
    return selector.split(/,\s*/).includes(this.tag);
  }
}

let host: EventTarget;
beforeEach(() => {
  host = new EventTarget();
  vi.stubGlobal("window", host);
  vi.stubGlobal("document", new EventTarget());
  vi.stubGlobal("HTMLElement", Control);
  vi.stubGlobal("navigator", { getGamepads: () => [] });
});
afterEach(() => vi.unstubAllGlobals());

function key(code: string, target = new Control(), options = {}) {
  const event = new Event("keydown", { cancelable: true });
  for (const [name, value] of Object.entries({
    code,
    target,
    repeat: false,
    ...options,
  }))
    Object.defineProperty(event, name, { value });
  host.dispatchEvent(event);
  return event;
}

describe("keyboard input around dialogs", () => {
  it.each(["input", "textarea", "select"])(
    "allows Escape from a %s but leaves its letters and arrows alone",
    (tag) => {
      const pause = vi.fn(),
        camera = vi.fn(),
        input = new Input(pause, camera),
        field = new Control(tag);
      input.enabled = true;
      for (const code of ["KeyW", "ArrowUp", "KeyC", "KeyP"])
        expect(key(code, field).defaultPrevented).toBe(false);
      expect(input.read()).toBe(0);
      expect(camera).not.toHaveBeenCalled();
      expect(pause).not.toHaveBeenCalled();
      expect(key("Escape", field).defaultPrevented).toBe(true);
      expect(pause).toHaveBeenCalledOnce();
    },
  );

  it("leaves contenteditable, composing and modified shortcuts alone", () => {
    const pause = vi.fn(),
      camera = vi.fn(),
      input = new Input(pause, camera),
      field = new Control("div");
    field.isContentEditable = true;
    input.enabled = true;
    key("KeyP", field);
    key("KeyW", field);
    for (const option of ["isComposing", "metaKey", "ctrlKey", "altKey"])
      for (const code of ["Escape", "KeyC", "KeyW"])
        key(code, new Control(), { [option]: true });
    expect(input.read()).toBe(0);
    expect(pause).not.toHaveBeenCalled();
    expect(camera).not.toHaveBeenCalled();
  });

  it("lets autocomplete consume Escape before dismissing its dialog", () => {
    const pause = vi.fn();
    host.addEventListener("keydown", (event) => event.preventDefault());
    new Input(pause, vi.fn());
    key("Escape", new Control("input"));
    expect(pause).not.toHaveBeenCalled();
  });

  it("does not carry menu keys into a run or change its camera", () => {
    const camera = vi.fn(),
      input = new Input(vi.fn(), camera);
    key("KeyW");
    key("KeyC");
    input.enabled = true;
    expect(input.read()).toBe(0);
    expect(camera).not.toHaveBeenCalled();
    key("KeyW");
    key("KeyC");
    expect(input.read()).toBe(Keys.forward);
    expect(camera).toHaveBeenCalledOnce();
  });

  it("toggles pause once per keypress and clears held movement on blur", () => {
    const pause = vi.fn(),
      input = new Input(pause, vi.fn());
    input.enabled = true;
    key("Escape");
    key("Escape", new Control(), { repeat: true });
    expect(pause).toHaveBeenCalledOnce();
    key("KeyW");
    expect(input.read()).toBe(Keys.forward);
    host.dispatchEvent(new Event("blur"));
    expect(input.read()).toBe(0);
  });
});
