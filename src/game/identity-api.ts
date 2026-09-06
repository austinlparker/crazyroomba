import { request, type AccountProfile } from "./api";
export const exchangeAccount = (token: string) =>
  request<{ profile: AccountProfile }>(
    "/api/session",
    {},
    {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
    },
  );
export const endAccount = () =>
  request("/api/session", undefined, { method: "DELETE" });
export const getAuthConfig = () =>
  request<{
    audience: string;
    legacyAudience?: string;
    lxm: string;
    scope: string;
  }>("/api/auth-config");
