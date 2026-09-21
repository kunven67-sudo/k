// Ending selection (pure function of the run's stats) + the full-screen end-card presentation.
// All five endings are original text/scenarios inspired only by the general "hunting game
// with a judgmental dog" trope - no reused names, dialogue, or antagonist design from any
// specific existing game.
import { unlock } from './achievements.js';
import { playTVShutoff, playGlitchWhoosh } from './audio.js';
import { triggerDomGlitch } from './utils.js';

const GOOD_RATIO = 0.6;

export function determineEnding(stats) {
  if (stats.dogShot) return 'some_things';
  if (stats.pacifist) return 'quiet_route';
  const perfect = stats.misses === 0 && stats.totalShots > 0 && stats.ducksHit === stats.ducksTotal;
  if (perfect && stats.confrontationOutcome === 'stood') return 'through_the_screen';
  const ratio = stats.ducksTotal > 0 ? stats.ducksHit / stats.ducksTotal : 0;
  if (ratio >= GOOD_RATIO && stats.confrontationOutcome === 'stood') return 'steady_hands';
  return 'static_cling';
}

const ENDINGS = {
  static_cling: {
    achievement: 'static_cling',
    title: 'Static Cling',
    theme: 'ending-neutral',
    body: (s) => `You made it through all five rounds with the TV buzzing quietly behind you. ${
      s.confrontationOutcome === 'fled'
        ? 'You backed away from that last strange moment before you could think too hard about it.'
        : "It wasn't your best round, but it wasn't nothing either."
    } Downstairs, Mom asks how it went. "Fine," you say. "Weird, but fine." She doesn't ask what you mean by that.`,
  },
  steady_hands: {
    achievement: 'steady_hands',
    title: 'Steady Hands',
    theme: 'ending-good',
    body: (s) => `Final score: ${s.score}. You held your ground when the room went quiet and the dog stopped moving, and somehow that mattered more than the score did. Mom whoops from the doorway - she'd been watching the whole time. "That's my kid," she says, and for once you actually believe her.`,
  },
  through_the_screen: {
    achievement: 'through_the_screen',
    title: 'Through the Screen',
    theme: 'ending-perfect',
    body: () => `Not one duck got past you. Not a single miss. When you held your ground and the dog finally sat down, the picture didn't just flicker - it opened. You step forward without quite meaning to, and the carpet under your sneakers is suddenly your own bedroom carpet. The television, behind you now, is quietly playing a rerun of a couch that is, somehow, also the couch you're sitting on. Mom knocks. "You've been staring at that screen for an hour. You okay?" You have never been more okay.`,
  },
  quiet_route: {
    achievement: 'quiet_route',
    title: 'The Quiet Route',
    theme: 'ending-peace',
    body: () => `You never once pulled the trigger. The ducks circled, drifted, and eventually flew off toward wherever it is cartoon ducks go. The dog wanders over and flops down beside you like you've done this a hundred times before. You sit there a while, the two of you, watching a sky that isn't really a sky. Some games you don't have to win. You just have to show up.`,
  },
  some_things: {
    achievement: 'some_things',
    title: "Some Things You Don't Do",
    theme: 'ending-dark',
    body: () => `The dog looks at you like it can't quite believe you just did that. Honestly? Neither can you. The picture buckles into static, color bleeding out through the edges of the screen, and then - nothing. Black. Somewhere far away you can hear Mom calling that dinner's ready. You reach over and turn the console off yourself, this time. Some things you just don't do. You know that now.`,
  },
};

function hideEnding() {
  const overlay = document.getElementById('ending-overlay');
  overlay.classList.remove('show');
  setTimeout(() => overlay.classList.add('hidden'), 300);
}

export function showEnding(endingId, stats, { onMenu, onPlayAgain }) {
  const def = ENDINGS[endingId] || ENDINGS.static_cling;
  unlock(def.achievement);

  const overlay = document.getElementById('ending-overlay');
  overlay.className = `fullscreen-overlay ending-overlay ${def.theme}`;
  overlay.innerHTML = `
    <div class="ending-card">
      <h1>${def.title}</h1>
      <p class="ending-body">${def.body(stats)}</p>
      <p class="ending-stats">Score ${stats.score} &middot; Ducks ${stats.ducksHit}/${stats.ducksTotal} &middot; Shots fired ${stats.totalShots}</p>
      <div class="ending-buttons">
        <button id="ending-menu-btn" class="menu-btn">Return to Main Menu</button>
        <button id="ending-again-btn" class="menu-btn primary">Play Again</button>
      </div>
    </div>`;
  overlay.classList.remove('hidden');
  requestAnimationFrame(() => overlay.classList.add('show'));

  if (endingId === 'some_things') playTVShutoff(); else playGlitchWhoosh();
  triggerDomGlitch(400);

  document.getElementById('ending-menu-btn').addEventListener('click', () => { hideEnding(); onMenu(); });
  document.getElementById('ending-again-btn').addEventListener('click', () => { hideEnding(); onPlayAgain(); });
}
