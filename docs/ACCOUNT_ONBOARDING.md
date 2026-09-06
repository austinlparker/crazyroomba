# Account onboarding

Reviewed September 6, 2026. The game uses a compact **@ Sign in** entry, an explicit **Sign in with AT Protocol** heading, and a reminder that an existing Bluesky account works. The @ is a typographic cue, not an assertion of an official network logo.

## Current ecosystem patterns

- [Leaflet](https://leaflet.pub/) currently labels its login “Log in with Atmosphere account,” with a “What's the Atmosphere?” explanation, a Sign Up tab, and a Bluesky signup entry. Its explanation connects the account to familiar apps.
- [pckt](https://pckt.blog/atproto/identify) leads with a handle, offers account creation, and explains that users can bring a name from another space.
- [recipe.exchange](https://recipe.exchange/signup-explained) explicitly says “Sign in with AT Protocol,” explains account reuse, and walks newcomers through creating an account and returning with a handle.
- Devin Ivy's [Atmospheric Login Diary, June 17, 2026](https://pckt.blog/b/divyzone/atmospheric-login-diary-1-on-the-button-ysue174) discusses recognizable buttons and shared account pickers as work in progress. This is design direction, not a finalized universal button specification or a shipped FedCM dependency.

The resulting choice combines an explicit protocol name with familiar Bluesky account recognition. “Atmosphere” appears in the signup explanation, where there is room to explain it. The game remains playable without signing in.

## Signup and permissions

“New here? Sign up” opens a short guide in the account dialog. “Continue to Bluesky” calls the existing browser OAuth SDK with `https://bsky.social` as the provider, without a handle. The provider offers account creation and returns through the game's existing OAuth callback. This follows the official [provider account-creation flow](https://atproto.com/blog/network-account-management) and [account-management guidance](https://atproto.com/guides/account-management). Existing accounts from other AT Protocol providers still use ordinary handle resolution.

Signup requests exactly the existing `atproto` plus service-scoped game-login RPC permission. No repository, email, or private-message access is added. The same pending-Daily preservation and DID checks apply to either redirect path; creating another account does not transfer a ranked run to that account.

The “How we use your account” disclosure is available on sign-in, signup, and connected-account screens. It explains the use of public profile information for identity, public follows for Following/Mutuals boards, game-hosted ranked scores, browser-local progress/settings, and provider-owned password handling. The game does not publish account posts or read private messages.

## Verification

Unit coverage checks that signup uses the expected provider and unchanged permission, remains retryable after provider failure, and does not authenticate a guest before callback verification. Existing handle sign-in, custom domains, session verification, and logout checks remain in place. Browser verification checks the real provider landing page without creating an account or approving a grant.
