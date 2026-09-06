import { getAuthConfig, exchangeAccount, endAccount } from "./identity-api";
import { accountBadge } from "./account-display";
import {
  BrowserOAuthClient,
  type OAuthSession,
} from "@atproto/oauth-client-browser";
import { attachHandleTypeahead } from "./handle-typeahead";
import { getAccount, type AccountProfile } from "./api";
import "./identity.css";

export const ACCOUNT_HINT = "crazy-roomba-account";
const accountUse = `<details class="account-use"><summary>How we use your account</summary><ul><li><strong>Your public profile</strong> identifies you on Daily leaderboards.</li><li><strong>Your public follows</strong> let you compare scores with people you follow and mutuals.</li></ul><p>Crazy Roomba stores your ranked scores. Unlocks, settings, and local run history stay in this browser.</p><p>Your password stays with your account provider. We don’t post to your account or read your private messages.</p></details>`;

export class Identity {
  private client: BrowserOAuthClient | null = null;
  session: OAuthSession | null = null;
  profile: AccountProfile | null = null;
  verified = false;
  connectionError = "";
  onChange = () => {};
  private config: Awaited<ReturnType<typeof getAuthConfig>> | null = null;
  private ready: Promise<void> | null = null;
  attachTypeahead = attachHandleTypeahead;
  get handle() {
    return this.profile?.handle || this.session?.sub || "";
  }
  invalidate(): void {
    this.verified = false;
    this.onChange();
  }
  init(): Promise<void> {
    return (this.ready ??= this.initialize());
  }
  private remember(connected: boolean) {
    try {
      if (connected) localStorage.setItem(ACCOUNT_HINT, "1");
      else localStorage.removeItem(ACCOUNT_HINT);
    } catch {
      /* The OAuth SDK still owns its session storage. */
    }
  }
  private async initialize(): Promise<void> {
    this.config = await getAuthConfig();
    const local = ["127.0.0.1", "localhost", "[::1]"].includes(
      location.hostname,
    );
    const clientId = local
      ? `http://localhost?redirect_uri=${encodeURIComponent(`${location.origin.replace("localhost", "127.0.0.1")}/`)}&scope=${encodeURIComponent(this.config.scope)}`
      : `${location.origin}/client-metadata.json`;
    this.client = await BrowserOAuthClient.load({
      clientId,
      handleResolver: "https://bsky.social",
      onSessionDeleted: (sub) => {
        if (this.session?.sub !== sub) return;
        this.session = null;
        this.profile = null;
        this.verified = false;
        this.remember(false);
        this.onChange();
        void endAccount().catch(() => {});
      },
    });
    const result = await this.client.init();
    if (result) {
      this.session = result.session;
      this.remember(true);
      this.profile = {
        did: this.session.sub,
        handle: this.session.sub,
        displayName: "",
        avatar: null,
      };
      await this.loadPublicProfile();
      try {
        await this.ensureSession();
      } catch (e) {
        this.connectionError =
          e instanceof Error ? e.message : "Reconnect to post scores.";
      }
    } else {
      const { profile } = await getAccount();
      this.profile = profile;
      this.verified = !!profile;
      this.remember(!!profile);
    }
    this.onChange();
  }
  private async loadPublicProfile() {
    try {
      const response = await fetch(
        `https://public.api.bsky.app/xrpc/app.bsky.actor.getProfile?actor=${encodeURIComponent(this.session!.sub)}`,
        {
          credentials: "omit",
          referrerPolicy: "no-referrer",
          signal: AbortSignal.timeout(5000),
        },
      );
      if (!response.ok) return;
      const p = await response.json();
      if (p.did !== this.session!.sub) return;
      this.profile = {
        did: p.did,
        handle:
          typeof p.handle === "string" && !p.handle.endsWith(".invalid")
            ? p.handle
            : p.did,
        displayName:
          typeof p.displayName === "string" ? p.displayName.slice(0, 100) : "",
        avatar:
          typeof p.avatar === "string" && /^https:\/\//.test(p.avatar)
            ? p.avatar
            : null,
      };
    } catch {
      /* A DID and generated avatar still identify an unindexed account. */
    }
  }
  async ensureSession(): Promise<AccountProfile> {
    const existing = await getAccount();
    if (
      existing.profile &&
      (!this.session || existing.profile.did === this.session.sub)
    ) {
      this.profile = existing.profile;
      this.verified = true;
      this.connectionError = "";
      this.onChange();
      return existing.profile;
    }
    this.invalidate();
    if (!this.session || !this.config)
      throw new Error("Sign in to post a score.");
    const params = new URLSearchParams({
      aud: this.config.audience,
      lxm: this.config.lxm,
    });
    const response = await this.session.fetchHandler(
      `/xrpc/com.atproto.server.getServiceAuth?${params}`,
      { signal: AbortSignal.timeout(12000) },
    );
    if (!response.ok) {
      this.connectionError =
        response.status === 401 || response.status === 403
          ? "Reconnect your account to post scores."
          : "Account verification unavailable. Try again.";
      this.onChange();
      throw new Error(this.connectionError);
    }
    const { token } = await response.json();
    if (typeof token !== "string")
      throw new Error("Your provider did not return an identity proof.");
    const { profile } = await exchangeAccount(token);
    if (profile.did !== this.session.sub)
      throw new Error("The connected account changed. Sign in again.");
    this.profile = profile;
    this.verified = true;
    this.connectionError = "";
    this.onChange();
    return profile;
  }
  panel(signup = false): { title: string; body: string } {
    const profile = this.profile;
    if (!profile && signup)
      return {
        title: "SIGN UP",
        body: `<div class="identity-panel"><div class="identity-heading"><span class="identity-mark" aria-hidden="true">@</span><div><h3>Join the Atmosphere</h3><p>One account for apps like Bluesky and Crazy Roomba, connected by AT Protocol.</p></div></div><ol class="signup-steps"><li>Continue to Bluesky’s account host and choose <strong>Create a new account</strong>.</li><li>Choose your handle, finish signup, and approve Crazy Roomba to return here.</li></ol><button class="primary wide identity-continue" data-action="signup">CONTINUE TO BLUESKY ↗</button><p class="identity-note">Bluesky hosts the new account. Already have an account there or with another AT Protocol provider? Use your existing handle.</p><button class="secondary wide" data-action="account">I already have an account</button>${accountUse}<p class="identity-optional">Just want to play? No account needed.</p></div>`,
      };
    return {
      title: profile ? "YOUR ACCOUNT" : "SIGN IN",
      body: profile
        ? `<div class="account-summary account-card">${accountBadge(profile)}</div>${this.verified ? "" : '<button class="primary wide" data-action="reconnect">RECONNECT</button>'}<button class="secondary wide" data-action="logout">Sign out</button>${accountUse}`
        : `<div class="identity-panel"><div class="identity-heading"><span class="identity-mark" aria-hidden="true">@</span><div><h3>Sign in with AT Protocol</h3><p>Your Bluesky account works here, too.</p></div></div><p class="identity-intro">Post Daily scores and compare with friends.</p><label class="field-label" for="handle">Your handle</label><input id="handle" aria-describedby="handle-help" autocomplete="off" autocapitalize="none" spellcheck="false" maxlength="253" placeholder="you.bsky.social"/><p class="identity-note" id="handle-help">Use your full handle, such as you.bsky.social or your own domain. You’ll sign in with your account provider.</p><button class="primary wide" data-action="login">SIGN IN ↗</button><button class="secondary wide" data-action="signup-info">New here? Sign up</button>${accountUse}<p class="identity-optional">Just want to play? No account needed.</p></div>`,
    };
  }
  async signup(): Promise<void> {
    await this.init();
    // A provider URL starts account creation without a handle. The provider
    // returns through the same OAuth callback with the same narrow permission.
    await this.client!.signInRedirect("https://bsky.social", {
      scope: this.config!.scope,
    });
  }
  async login(handle: string): Promise<void> {
    await this.init();
    if (!handle.trim()) throw new Error("Enter your AT Protocol handle.");
    await this.client!.signInRedirect(handle.trim().replace(/^@/, ""), {
      scope: this.config!.scope,
    });
  }
  async logout(): Promise<void> {
    // Revoke the game cookie first; a failed network request must not pretend
    // that an authenticated browser has been signed out of the leaderboard.
    await endAccount();
    this.verified = false;
    const session = this.session;
    this.session = null;
    this.profile = null;
    this.remember(false);
    this.onChange();
    try {
      await session?.signOut();
    } finally {
      this.ready = null;
      this.client = null;
    }
  }
}
