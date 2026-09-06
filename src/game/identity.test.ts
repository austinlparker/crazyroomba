import { beforeEach, afterEach, describe, expect, it, vi } from "vitest";
const mocks = vi.hoisted(() => ({
  load: vi.fn(),
  init: vi.fn(),
  redirect: vi.fn(),
  proof: vi.fn(),
  signOut: vi.fn(),
  account: vi.fn(),
  config: vi.fn(),
  exchange: vi.fn(),
  logout: vi.fn(),
}));
vi.mock("@atproto/oauth-client-browser", () => ({
  BrowserOAuthClient: { load: mocks.load },
}));
vi.mock("./api", () => ({ getAccount: mocks.account }));
vi.mock("./identity-api", () => ({
  getAuthConfig: mocks.config,
  exchangeAccount: mocks.exchange,
  endAccount: mocks.logout,
}));
import { Identity, ACCOUNT_HINT } from "./identity";
const profile = {
  did: "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
  handle: "alice.test",
  displayName: "Alice",
  avatar: "https://cdn.bsky.app/avatar/test.jpg",
};
const config = {
  audience: "did:web:game.test#crazy_roomba",
  lxm: "io.github.austinlparker.crazyroombaLogin",
  scope:
    "atproto rpc:io.github.austinlparker.crazyroombaLogin?aud=did%3Aweb%3Agame.test%23crazy_roomba",
};
let store: Map<string, string>;
beforeEach(() => {
  vi.resetAllMocks();
  store = new Map();
  vi.stubGlobal("location", {
    hostname: "game.test",
    origin: "https://game.test",
  });
  vi.stubGlobal("localStorage", {
    getItem: (k: string) => store.get(k) || null,
    setItem: (k: string, v: string) => store.set(k, v),
    removeItem: (k: string) => store.delete(k),
  });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json(profile)));
  mocks.load.mockResolvedValue({
    init: mocks.init,
    signInRedirect: mocks.redirect,
  });
  mocks.init.mockResolvedValue({
    session: {
      sub: profile.did,
      fetchHandler: mocks.proof,
      signOut: mocks.signOut,
    },
  });
  mocks.config.mockResolvedValue(config);
  mocks.account.mockResolvedValue({ profile: null });
  mocks.proof.mockImplementation(async () =>
    Response.json({ token: "signed-game-proof" }),
  );
  mocks.exchange.mockResolvedValue({ profile });
  mocks.logout.mockResolvedValue({ profile: null });
});
afterEach(() => vi.unstubAllGlobals());
describe("verified game identity", () => {
  it("starts signup at the account host with only the existing game permission", async () => {
    mocks.init.mockResolvedValue(null);
    const identity = new Identity();
    await identity.signup();
    expect(mocks.redirect).toHaveBeenCalledWith("https://bsky.social", {
      scope: config.scope,
    });
    expect(mocks.exchange).not.toHaveBeenCalled();
    expect(identity.profile).toBeNull();
    expect(identity.verified).toBe(false);
  });
  it("keeps signup retryable when the provider is unavailable", async () => {
    mocks.init.mockResolvedValue(null);
    mocks.redirect.mockRejectedValueOnce(new Error("Provider unavailable"));
    const identity = new Identity();
    await expect(identity.signup()).rejects.toThrow("Provider unavailable");
    expect(identity.verified).toBe(false);
    await identity.signup();
    expect(mocks.load).toHaveBeenCalledOnce();
    expect(mocks.redirect).toHaveBeenCalledTimes(2);
  });
  it("requires a handle for sign-in and preserves custom domain support", async () => {
    mocks.init.mockResolvedValue(null);
    const identity = new Identity();
    await expect(identity.login("  ")).rejects.toThrow(
      "Enter your AT Protocol handle",
    );
    expect(mocks.redirect).not.toHaveBeenCalled();
    await identity.login("  @alice.example.com  ");
    expect(mocks.redirect).toHaveBeenCalledWith("alice.example.com", {
      scope: config.scope,
    });
  });
  it("restores the OAuth profile and exchanges only a service-scoped proof", async () => {
    const identity = new Identity();
    await identity.init();
    expect(identity.profile).toEqual(profile);
    expect(identity.verified).toBe(true);
    expect(mocks.proof.mock.calls[0][0]).toBe(
      `/xrpc/com.atproto.server.getServiceAuth?${new URLSearchParams({ aud: config.audience, lxm: config.lxm })}`,
    );
    expect(mocks.exchange).toHaveBeenCalledWith("signed-game-proof");
    expect(store.get(ACCOUNT_HINT)).toBe("1");
  });
  it("keeps the avatar visible when an old OAuth grant needs reconnecting", async () => {
    mocks.proof.mockImplementation(
      async () => new Response("", { status: 403 }),
    );
    const identity = new Identity();
    await identity.init();
    expect(identity.profile).toEqual(profile);
    expect(identity.verified).toBe(false);
    expect(identity.connectionError).toMatch(/Reconnect/);
    await identity.login("@alice.test");
    expect(mocks.redirect).toHaveBeenCalledWith("alice.test", {
      scope: config.scope,
    });
    expect(mocks.exchange).not.toHaveBeenCalled();
  });
  it("does not adopt another DID's public profile", async () => {
    vi.mocked(fetch).mockResolvedValue(
      Response.json({ ...profile, did: "did:plc:other" }),
    );
    mocks.proof.mockImplementation(
      async () => new Response("", { status: 403 }),
    );
    const identity = new Identity();
    await identity.init();
    expect(identity.profile?.did).toBe(profile.did);
    expect(identity.profile?.avatar).toBeNull();
    expect(identity.handle).toBe(profile.did);
  });
  it("uses an existing server session without making another proof", async () => {
    mocks.account.mockResolvedValue({ profile });
    const identity = new Identity();
    await identity.init();
    expect(identity.verified).toBe(true);
    expect(mocks.proof).not.toHaveBeenCalled();
  });
  it("invalidates a cookie-only account after expiration and notifies the UI", async () => {
    mocks.init.mockResolvedValue(null);
    mocks.account.mockResolvedValueOnce({ profile });
    const identity = new Identity();
    await identity.init();
    const changed = vi.fn();
    identity.onChange = changed;
    await expect(identity.ensureSession()).rejects.toThrow("Sign in");
    expect(identity.verified).toBe(false);
    expect(changed).toHaveBeenCalled();
  });
  it("does not reuse a cookie that belongs to a different OAuth account", async () => {
    mocks.account.mockResolvedValue({
      profile: { ...profile, did: "did:plc:other" },
    });
    const identity = new Identity();
    await identity.init();
    expect(mocks.exchange).toHaveBeenCalledOnce();
    expect(identity.profile?.did).toBe(profile.did);
  });
  it("revokes the server session before clearing the signed-in state", async () => {
    const identity = new Identity();
    await identity.init();
    await identity.logout();
    expect(identity.profile).toBeNull();
    expect(identity.verified).toBe(false);
    expect(store.has(ACCOUNT_HINT)).toBe(false);
    expect(mocks.logout.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.signOut.mock.invocationCallOrder[0],
    );
  });
  it("does not pretend to sign out when cookie revocation fails", async () => {
    const identity = new Identity();
    await identity.init();
    mocks.logout.mockRejectedValue(new Error("Network unavailable"));
    await expect(identity.logout()).rejects.toThrow("Network unavailable");
    expect(identity.verified).toBe(true);
    expect(mocks.signOut).not.toHaveBeenCalled();
  });
  it("ignores a different account's session deletion notification", async () => {
    const identity = new Identity();
    await identity.init();
    mocks.load.mock.calls[0][0].onSessionDeleted("did:plc:other");
    expect(identity.profile).toEqual(profile);
    expect(identity.verified).toBe(true);
  });
});
