import { HandleSearch, type ActorSuggestion } from "./handle-search";
import "./handle-typeahead.css";

/** A small accessible combobox, loaded with the account dialog rather than the game. */
export function attachHandleTypeahead(root: HTMLElement): () => void {
  const input = root.querySelector<HTMLInputElement>("#handle")!;
  const list = document.createElement("div");
  list.id = "handle-options";
  list.className = "handle-options";
  list.setAttribute("role", "listbox");
  list.setAttribute("aria-label", "Account suggestions");
  list.hidden = true;
  const status = document.createElement("p");
  status.className = "handle-search-status";
  status.id = "handle-search-status";
  status.setAttribute("role", "status");
  input.after(list, status);
  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-controls", list.id);
  const describedBy = input.getAttribute("aria-describedby");
  input.setAttribute(
    "aria-describedby",
    [describedBy, status.id].filter(Boolean).join(" "),
  );
  input.setAttribute("aria-expanded", "false");
  let actors: ActorSuggestion[] = [];
  let active = -1;
  const hide = () => {
    list.hidden = true;
    active = -1;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
  };
  const select = (index: number) => {
    if (!actors[index]) return;
    input.value = actors[index].handle;
    search.cancel();
    status.textContent = "";
    hide();
    input.focus();
  };
  const search = new HandleSearch((state) => {
    actors = state.actors;
    hide();
    list.replaceChildren();
    input.setAttribute("aria-busy", String(state.status === "loading"));
    status.textContent =
      state.status === "loading"
        ? "Searching…"
        : state.status === "unavailable"
          ? "Suggestions unavailable. Enter your full handle."
          : state.status === "ready" && !actors.length
            ? "No matches. You can enter your full handle."
            : "";
    actors.forEach((actor, index) => {
      const option = document.createElement("button");
      option.type = "button";
      option.tabIndex = -1;
      option.id = `handle-option-${index}`;
      option.setAttribute("role", "option");
      option.setAttribute("aria-selected", "false");
      const avatar = document.createElement("span");
      avatar.className = "account-avatar";
      avatar.setAttribute("aria-hidden", "true");
      avatar.textContent =
        Array.from(
          (actor.displayName || actor.handle).replace(/^@/, ""),
        )[0]?.toUpperCase() || "R";
      if (actor.avatar) {
        const image = document.createElement("img");
        image.alt = "";
        image.width = image.height = 40;
        image.loading = "lazy";
        image.decoding = "async";
        image.referrerPolicy = "no-referrer";
        image.addEventListener("error", () => image.remove(), { once: true });
        image.src = actor.avatar;
        avatar.append(image);
      }
      const label = document.createElement("span");
      label.className = "handle-option-label";
      const name = document.createElement("strong");
      name.textContent = actor.displayName || actor.handle;
      const handle = document.createElement("span");
      handle.textContent = `@${actor.handle}`;
      label.append(name, handle);
      option.append(avatar, label);
      option.addEventListener("pointerdown", (event) => event.preventDefault());
      option.addEventListener("click", () => select(index));
      list.append(option);
    });
    if (actors.length && document.activeElement === input) {
      list.hidden = false;
      input.setAttribute("aria-expanded", "true");
    }
  });
  const onInput = () => search.query(input.value);
  const onBlur = () => {
    search.cancel();
    hide();
    status.textContent = "";
    input.setAttribute("aria-busy", "false");
  };
  const onKey = (event: KeyboardEvent) => {
    if (
      event.key === "Escape" &&
      (!list.hidden || input.getAttribute("aria-busy") === "true")
    ) {
      event.preventDefault();
      event.stopPropagation();
      search.cancel();
      hide();
      status.textContent = "";
      input.setAttribute("aria-busy", "false");
    } else if (
      !list.hidden &&
      (event.key === "ArrowDown" || event.key === "ArrowUp")
    ) {
      event.preventDefault();
      active =
        (active +
          (event.key === "ArrowDown" ? 1 : active < 0 ? 0 : -1) +
          actors.length) %
        actors.length;
      [...list.children].forEach((item, i) =>
        item.setAttribute("aria-selected", String(i === active)),
      );
      const item = list.children[active];
      input.setAttribute("aria-activedescendant", item.id);
      item.scrollIntoView({ block: "nearest" });
    } else if (event.key === "Enter") {
      event.preventDefault();
      if (!list.hidden && active >= 0) select(active);
      else
        root.querySelector<HTMLButtonElement>('[data-action="login"]')?.click();
    }
  };
  input.addEventListener("input", onInput);
  input.addEventListener("focus", onInput);
  input.addEventListener("blur", onBlur);
  input.addEventListener("keydown", onKey);
  return () => {
    search.dispose();
    input.removeEventListener("input", onInput);
    input.removeEventListener("focus", onInput);
    input.removeEventListener("blur", onBlur);
    input.removeEventListener("keydown", onKey);
    if (describedBy) input.setAttribute("aria-describedby", describedBy);
    else input.removeAttribute("aria-describedby");
  };
}
