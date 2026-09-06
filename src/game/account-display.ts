import { escapeHtml as escape } from "./html";
import type { AccountProfile } from "./api";
export const accountHandle = (profile: AccountProfile) =>
  profile.handle.startsWith("did:") ? profile.handle : `@${profile.handle}`;
export function accountBadge(profile: AccountProfile): string {
  const label = profile.displayName || profile.handle;
  const avatar = profile.avatar?.startsWith("https://") ? profile.avatar : null;
  return `<span class="account-avatar" aria-hidden="true">${escape(Array.from(label.replace(/^@/, ""))[0]?.toUpperCase() || "R")}${avatar ? `<img src="${escape(avatar)}" alt="" referrerpolicy="no-referrer" loading="lazy"/>` : ""}</span><span class="account-label"><b>${escape(label)}</b><small>${escape(accountHandle(profile))}</small></span>`;
}
