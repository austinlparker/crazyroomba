export const icons = {
  robot:
    '<svg viewBox="0 0 32 32" fill="none"><path d="M7 22H3m26 0h-4M16 4v4" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"/><rect x="5" y="9" width="22" height="17" rx="8" fill="currentColor"/><path d="M10 16h12" stroke="var(--paper)" stroke-width="4" stroke-linecap="round"/><circle cx="12" cy="16" r="1" fill="currentColor"/><circle cx="20" cy="16" r="1" fill="currentColor"/></svg>',
  arrow:
    '<svg viewBox="0 0 24 24" fill="none"><path d="M4 12h15m-6-6 6 6-6 6" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  cup: '<svg viewBox="0 0 24 24" fill="none"><path d="M8 4h8v7a4 4 0 0 1-8 0V4Zm0 2H4v3a4 4 0 0 0 4 4m8-7h4v3a4 4 0 0 1-4 4m-4 2v5m-4 0h8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  bolt: '<svg viewBox="0 0 24 24" fill="none"><path d="m14 2-9 12h6l-1 8 9-12h-6l1-8Z" fill="currentColor"/></svg>',
  sound:
    '<svg viewBox="0 0 24 24" fill="none"><path d="m11 5-5 4H3v6h3l5 4V5Zm4 3a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>',
  gear: '<svg viewBox="0 0 24 24" fill="none"><path d="m9 3-1 3-3 1-2 4 2 2v4l4 3 3-1 3 1 4-3v-4l2-2-2-4-3-1-1-3H9Z" stroke="currentColor" stroke-width="1.5"/><circle cx="12" cy="12" r="3" stroke="currentColor" stroke-width="1.5"/></svg>',
};

export function appShell(): string {
  return `
      <header class="topbar" id="topbar"><button class="brand" data-action="home" aria-label="Home"><span class="brand-icon">${icons.robot}</span></button><nav aria-label="Main navigation"><button data-action="board" aria-label="Leaderboard">${icons.cup}<span>Leaderboard</span></button><button data-action="profile" aria-label="Your stats">${icons.robot}<span>Stats</span></button><button class="account-button" data-action="account" aria-label="Sign in with AT Protocol"><b aria-hidden="true">@</b> Sign in</button></nav></header>
      <main id="menu" class="menu"><section class="hero">
        <h1>CRAZY<br><span>ROOMBA</span></h1>
        <div class="stage-select" aria-label="Stage selector"><button class="stage-arrow" data-action="stage-prev" aria-label="Previous stage">${icons.arrow}</button><div class="stage-info" aria-live="polite"><h2 class="stage-title" id="stage-title"></h2><p class="stage-status" id="stage-status"></p><div class="stage-dots" id="stage-dots" aria-hidden="true"></div></div><button class="stage-arrow" data-action="stage-next" aria-label="Next stage">${icons.arrow}</button></div>
        <div class="mode-switch" role="group" aria-label="Game mode"><button class="selected" data-mode="arcade" aria-pressed="true">Arcade</button><button data-mode="daily" aria-pressed="false">Daily</button><button data-mode="freeroam" aria-pressed="false">Free roam</button></div>
        <div class="mode-detail"><span id="mode-description">60s + time bonuses</span></div>
        <button class="primary start-button" data-action="start"><span>PLAY</span>${icons.arrow}</button>
        <div class="menu-actions"><button class="tutorial-link" data-action="tutorial">▷ Tutorial</button><button class="garage-button" data-action="skins">Skins</button></div>
      </section></main>
      <footer id="footer"><div><button class="icon-button" data-action="sound" aria-label="Sound + voice">${icons.sound}</button><button class="icon-button" data-action="music" aria-label="Music" title="Music">♫</button><button class="icon-button" data-action="settings" aria-label="Settings">${icons.gear}</button></div></footer>
      <section class="hud hidden" id="hud" aria-label="Game dashboard">
        <div class="hud-top"><div class="score-card"><span id="hud-mode">ARCADE SHIFT</span><strong id="score">0</strong><small id="score-goal">POINTS</small><div class="score-goal-track"><i id="score-goal-fill"></i></div></div><div class="timer-card"><span id="timer-label">TIME</span><strong id="timer">60<span>.0</span></strong></div><div class="hud-actions"><button class="round-button" data-action="pause" aria-label="Pause game">Ⅱ</button><button class="round-button camera-button" data-action="camera" aria-label="Change camera">◈</button></div></div>
        <div class="haul-meter" id="haul-meter" role="group" aria-label="Dust bin and delivery combo">
          <div class="haul-load"><div class="haul-heading"><span id="cargo-label">DUST BIN</span><strong id="cargo-count">0 / 5</strong></div><div class="cargo-slots" id="cargo-slots" aria-hidden="true">${"<i></i>".repeat(5)}</div></div>
          <div class="haul-bonus" id="combo"><strong id="combo-value">2×</strong><span id="combo-label">FULL BIN</span></div>
          <div class="combo-meter" id="combo-meter" role="progressbar" aria-label="Time left to continue combo" aria-valuemin="0" aria-valuemax="30"><i id="combo-fill"></i></div>
          <div class="haul-route hidden" id="objective"><span class="dock-arrow hidden" id="dock-arrow" aria-hidden="true">➤</span><span id="objective-text"></span></div>
        </div>
        <div class="tutorial-card hidden" id="tutorial-card" role="status"></div>
        <div class="boost-card"><div>${icons.bolt}<strong id="speed">0</strong><span>KM/H</span></div><div class="boost-track"><span id="boost-fill"></span></div><small id="boost-label">SHIFT TO BOOST</small></div>
        <div class="keyboard-help"><span><kbd>W A S D</kbd> Drive</span><span><kbd>SHIFT</kbd> Boost</span><span><kbd>SPACE</kbd> Drift</span><span><kbd>E</kbd> Hop</span><button data-action="camera"><kbd>C</kbd> Camera</button><span><kbd>ESC</kbd> Pause</span></div>
        <div class="touch-controls" id="touch-controls"><div id="joystick" role="group" aria-label="Movement stick: drag up to drive, down to reverse, left or right to steer"><span class="stick-hint" aria-hidden="true">DRAG TO DRIVE</span><svg class="stick-directions" viewBox="0 0 128 128" aria-hidden="true"><path d="m64 9 8 10H56ZM119 64l-10 8V56ZM64 119l-8-10h16ZM9 64l10-8v16Z"/></svg><span class="stick-thumb" aria-hidden="true"><i></i></span></div><div><button data-control="hop">HOP</button><button data-control="drift">DRIFT</button><button data-control="boost" class="touch-boost" aria-label="Boost, 100% energy"><svg class="boost-ring" viewBox="0 0 88 88" aria-hidden="true"><circle class="boost-ring-track" cx="44" cy="44" r="40"/><circle id="touch-boost-fill" cx="44" cy="44" r="40" pathLength="100"/></svg>${icons.bolt}<span>BOOST</span></button></div></div>
      </section><div class="countdown hidden" id="countdown" aria-live="polite"></div><div class="toast" id="toast" role="status"></div>`;
}
