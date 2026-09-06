/** Escape text or a quoted attribute value before interpolating it into HTML. */
export const escapeHtml = (value: unknown): string =>
  String(value).replace(
    /[&<>"']/g,
    (character) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        character
      ]!,
  );

export const formatNumber = (value: number): string =>
  value.toLocaleString("en-US");
