# Gameplay and presentation polish · 2.5

Subsequent model improvements and current measurements are recorded in [the model overhaul](MODEL_PASS.md). The figures below describe the preceding gameplay polish.

The pass focused on three weaknesses: driving had little payoff beyond collecting dust, the outdoor stages looked sparse, and the previous responsive/resource checks were unfinished.

## Implemented

1. **Skill rewards.** Full-bin deliveries within 30 seconds build a chain from 1× to 2×, on top of the existing full-bin bonus. Partial deliveries, hard collisions and timeout break it. Clean passes near residents award 75 points and boost charge; parking, collisions and immediate repeated passes do not. Drifting recharges boost faster. The browser and Worker share these fixed-tick rules under ruleset 2.5.0.
2. **Progress and guidance.** Each stage has three score medals. The score card shows the next target, cargo shows the delivery-chain window, and a return arrow points to the dock or the correct floor transition. On a ramp it points downhill, rather than back toward the upper entrance. Results retain new-best and skin-unlock messages when reopened.
3. **Stage detail.** Apartment gains a woven rug, bedding detail and curtains; an uncollidable floor prop was removed. Cul-de-sac gains gabled houses, porches, siding, shutters, fences and vehicle details. Its road uses one continuous surface. Moonbase gains habitat/rover/rocket detail, tracks, a landing circle, a technical deck finish, painted Earth and an animated visitor. Moon pickups are now 34 on the ground and six on the small upper deck.
4. **Skins.** All six liveries have painted patterns and coordinated shell colors. A lazy 3D garage preview allows inspecting locked skins; unlock progress and Equip stay visible while browsing. The preview owns and releases its own small renderer. Cosmetic dimensions and physics remain unchanged.
5. **Rendering.** Dust transforms are computed once per pickup, particles reuse a bounded pool, boost trails emit at a controlled rate, and menu shadows are cached. Menus draw at 30 Hz; covered/paused scenes stop redrawing until invalidated. Hidden tabs skip rendering. The phone camera frames the stage above the controls and fits its width.

## Validation

- 208 tests pass; both TypeScript targets, production build and manifest/bundle guards pass.
- The real 90-second local daily API test passes with 2.5.0, including server-derived scores, duplicate rejection and concurrent ticket limits. The local score fixture was removed.
- Cloudflare dry run passes: Worker 54.38 KiB / 14.67 KiB gzip. No production deployment.
- Initial Apartment + engine + high-quality effects + HTML/CSS: **173.0 KiB gzip**, approximately 3 KiB above 2.4, below the unchanged 185 KiB budget. The garage adds 0.70 KiB on demand. Other stage JavaScript remains separate: House 11.3 KiB, Cul-de-sac 3.1 KiB, Moonbase 3.5 KiB.
- Desktop, 390 × 844 portrait and 844 × 390 landscape menu checks completed. Portrait document width is exactly 390px; the skin dialog is 360px wide with no horizontal overflow. Its grid scrolls independently of the preview and Equip control. Landscape retains a scrollable menu rather than shrinking labels.
- Seeded progress on the isolated QA origin verified locked preview, unlock, Hot Rod equip, persisted selection, actual game-robot material changes, and stage-clear reward retention. Closing the garage removed the viewer and released its WebGL context.
- Final console review caught and fixed an empty-resident scene attachment on Moonbase. A fresh browser session rendered all four stages twice and opened/closed the garage without console errors.
- A live Moonbase boost drive covered 4.66 m before contacting the antenna base. In a 240-frame desktop sample, median frame spacing was 16.7 ms; the JavaScript render call measured 1.4 ms median and 1.8 ms at the 95th percentile. These are observations on this Mac, not a cross-device GPU benchmark.

Repeated stage loads returned to identical resource counts. Draw-call measurements include rendering passes and compare the first menu draw with the following cached draw:

| Stage       | Geometries | Textures | First draw | Cached draw |
| ----------- | ---------: | -------: | ---------: | ----------: |
| Apartment   |         83 |       23 |        164 |          97 |
| House Party |        248 |       68 |        456 |         263 |
| Cul-de-sac  |        122 |       20 |        235 |         136 |
| Moonbase    |         78 |       19 |        143 |          92 |

Physical phones/gamepads, Safari/Firefox, real provider OAuth and production deployment remain untested. The existing D1 leaderboard and login-only AT OAuth boundary remain in place; the proposed DO/social backend is separate work.
