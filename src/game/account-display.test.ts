import { expect, it } from "vitest";
import { accountBadge, accountHandle } from "./account-display";
const profile = {
  did: "did:plc:test",
  handle: "alice.test",
  displayName: "Alice",
  avatar: null,
};
it("escapes public profile names and rejects non-HTTPS avatar sources", () => {
  const html = accountBadge({
    ...profile,
    displayName: '<script>alert("hi")</script>',
    avatar: "javascript:alert(1)",
  });
  expect(html).toContain("&lt;script&gt;");
  expect(html).not.toContain("<script>");
  expect(html).not.toContain("<img");
});
it("keeps an initials fallback underneath a decorative profile image", () => {
  const html = accountBadge({
    ...profile,
    avatar: "https://cdn.bsky.app/a.jpg",
  });
  expect(html).toContain('aria-hidden="true">A<img');
  expect(html).toContain('alt=""');
  expect(html).toContain("@alice.test");
});
it("shows a DID fallback without pretending it is a handle", () => {
  expect(accountHandle({ ...profile, handle: profile.did })).toBe(profile.did);
});
