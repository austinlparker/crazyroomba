import { Keys } from "./simulation";
export class Input {
  private keys = new Set<string>();
  private touch = 0;
  private actionBits = 0;
  private gamepadPause = false;
  private resetTouch = () => {};
  enabled = false;
  constructor(
    private onPause: () => void,
    onCamera: () => void,
  ) {
    window.addEventListener("keydown", (e) => {
      if (
        e.defaultPrevented ||
        e.isComposing ||
        e.metaKey ||
        e.ctrlKey ||
        e.altKey
      )
        return;
      // Escape also dismisses a dialog when a field or volume slider has focus.
      // Typeahead can consume its first Escape before this window listener.
      if (e.code === "Escape") {
        if (!e.repeat) {
          e.preventDefault();
          onPause();
        }
        return;
      }
      if (
        e.target instanceof HTMLElement &&
        (e.target.isContentEditable ||
          e.target.matches("input, textarea, select"))
      )
        return;
      if (!e.repeat && e.code === "KeyP") {
        onPause();
        return;
      }
      if (!this.enabled) return;
      if (!e.repeat && e.code === "KeyC") onCamera();
      if (
        [
          "ArrowUp",
          "ArrowDown",
          "ArrowLeft",
          "ArrowRight",
          "Space",
          "ShiftLeft",
          "ShiftRight",
        ].includes(e.code)
      )
        e.preventDefault();
      this.keys.add(e.code);
    });
    window.addEventListener("keyup", (e) => this.keys.delete(e.code));
    window.addEventListener("blur", () => this.clear());
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) this.clear();
    });
  }
  clear(): void {
    this.resetTouch();
    this.keys.clear();
    this.touch = 0;
    this.actionBits = 0;
  }
  pollGamepad(): void {
    const pad = navigator.getGamepads?.()?.find((p) => p?.connected);
    if (pad?.buttons[9]?.pressed && !this.gamepadPause) this.onPause();
    this.gamepadPause = !!pad?.buttons[9]?.pressed;
  }
  read(): number {
    if (!this.enabled) return 0;
    let b = this.touch | this.actionBits;
    if (this.keys.has("KeyW") || this.keys.has("ArrowUp")) b |= Keys.forward;
    if (this.keys.has("KeyS") || this.keys.has("ArrowDown")) b |= Keys.reverse;
    if (this.keys.has("KeyA") || this.keys.has("ArrowLeft")) b |= Keys.left;
    if (this.keys.has("KeyD") || this.keys.has("ArrowRight")) b |= Keys.right;
    if (this.keys.has("ShiftLeft") || this.keys.has("ShiftRight"))
      b |= Keys.boost;
    if (this.keys.has("KeyE")) b |= Keys.hop;
    if (this.keys.has("Space")) b |= Keys.drift;
    const pad = navigator.getGamepads?.()?.find((p) => p?.connected);
    if (pad) {
      if (pad.axes[1] < -0.25 || pad.buttons[7]?.pressed) b |= Keys.forward;
      if (pad.axes[1] > 0.25 || pad.buttons[6]?.pressed) b |= Keys.reverse;
      if (pad.axes[0] < -0.25) b |= Keys.left;
      if (pad.axes[0] > 0.25) b |= Keys.right;
      if (pad.buttons[0]?.pressed) b |= Keys.boost;
      if (pad.buttons[1]?.pressed) b |= Keys.drift;
      if (pad.buttons[2]?.pressed) b |= Keys.hop;
    }
    return b;
  }
  bindTouch(root: HTMLElement): void {
    // Stop native selection, dragging and long-press menus on game chrome.
    // Editable fields and links retain their ordinary browser interactions.
    for (const type of ["selectstart", "contextmenu", "dragstart"]) {
      document.addEventListener(type, (event) => {
        const el = event.target;
        if (
          !(el instanceof Element) ||
          el.closest('input, textarea, [contenteditable="true"], a')
        )
          return;
        if (el.closest("#app, #modal, #game-canvas")) event.preventDefault();
      });
    }
    const stick = root.querySelector<HTMLElement>("#joystick")!,
      thumb = stick.querySelector<HTMLElement>(".stick-thumb")!;
    let pointer: number | null = null;
    const move = (e: PointerEvent) => {
      if (!this.enabled || pointer !== e.pointerId) return;
      const r = stick.getBoundingClientRect();
      const x = Math.max(
        -1,
        Math.min(1, (e.clientX - r.left - r.width / 2) / 45),
      );
      const y = Math.max(
        -1,
        Math.min(1, (e.clientY - r.top - r.height / 2) / 45),
      );
      this.touch =
        (y < -0.18 ? Keys.forward : y > 0.3 ? Keys.reverse : 0) |
        (x < -0.25 ? Keys.left : x > 0.25 ? Keys.right : 0);
      const length = Math.max(1, Math.hypot(x, y));
      const travel = Math.max(0, (r.width - thumb.offsetWidth) / 2 - 6);
      thumb.style.transform = `translate(${(x / length) * travel}px,${(y / length) * travel}px)`;
      if (this.touch) stick.classList.add("used");
    };
    stick.addEventListener("pointerdown", (e) => {
      if (!this.enabled || pointer !== null) return;
      e.preventDefault();
      pointer = e.pointerId;
      stick.setPointerCapture(e.pointerId);
      stick.classList.add("is-active");
      move(e);
    });
    stick.addEventListener("pointermove", move);
    const stop = (e?: PointerEvent) => {
      if (e && e.pointerId !== pointer) return;
      const previous = pointer;
      pointer = null;
      this.touch = 0;
      thumb.style.transform = "";
      stick.classList.remove("is-active");
      if (previous !== null && stick.hasPointerCapture(previous))
        stick.releasePointerCapture(previous);
    };
    stick.addEventListener("pointerup", stop);
    stick.addEventListener("pointercancel", stop);
    stick.addEventListener("lostpointercapture", stop);
    const resetActions: (() => void)[] = [];
    root.querySelectorAll<HTMLElement>("[data-control]").forEach((el) => {
      let held: number | null = null;
      const bit =
        el.dataset.control === "boost"
          ? Keys.boost
          : el.dataset.control === "hop"
            ? Keys.hop
            : Keys.drift;
      el.addEventListener("pointerdown", (e) => {
        if (!this.enabled || held !== null) return;
        e.preventDefault();
        held = e.pointerId;
        el.setPointerCapture(e.pointerId);
        this.actionBits |= bit;
        el.classList.add("is-active");
      });
      const reset = (e?: PointerEvent) => {
        if (e && e.pointerId !== held) return;
        const previous = held;
        held = null;
        this.actionBits &= ~bit;
        el.classList.remove("is-active");
        if (previous !== null && el.hasPointerCapture(previous))
          el.releasePointerCapture(previous);
      };
      el.addEventListener("pointerup", reset);
      el.addEventListener("pointercancel", reset);
      el.addEventListener("lostpointercapture", reset);
      resetActions.push(reset);
    });
    this.resetTouch = () => {
      stop();
      resetActions.forEach((reset) => reset());
    };
  }
}
