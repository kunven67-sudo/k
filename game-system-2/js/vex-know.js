/* Game System 2.0 — what VEX knows about Game System, by heart (no AI needed).
   "what is quality?", "how do I back up?", "where do screenshots go?" get a real answer right away,
   with a "Show me" that opens the right place. The AI also gets these facts, so its answers are right too. */
(function () {
  'use strict';

  function setting(sec) {
    return function () {
      App.go('settings');
      setTimeout(function () { var s = document.getElementById('set-' + sec); if (s) s.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, 250);
    };
  }
  function view(v) { return function () { App.go(v); }; }
  function app(id) { return function () { if (D.get(id)) Player.launch(id); }; }
  function mb(q) { try { return Capture.mbPerMin(q); } catch (e) { return '?'; } }
  function key(k, fallback) { return D.settings[k] || fallback; }

  /* keys: words or phrases that point to the topic (more words = a stronger match) */
  var TOPICS = [
    { keys: ['quality', 'recording quality', 'video quality', 'resolution', 'blurry recording', 'mb per minute', 'mb a minute', 'low medium high ultra'],
      say: function () { return 'Quality is how sharp and smooth your recordings look: Low, Medium (the normal one), High or Ultra. Higher looks better but makes bigger files: Medium is about ' + mb('med') + ' MB a minute, Ultra about ' + mb('ultra') + '. Change it in Settings → Screenshots & recording → Quality.'; },
      go: setting('capture') },
    { keys: ['max length', 'recording length', 'how long can i record', 'stops recording', 'stopped recording by itself'],
      say: function () { return 'Max length is how long a recording can go before it stops by itself (' + (D.settings.recMax == null ? 10 : D.settings.recMax) + ' minutes right now). Change it in Settings → Screenshots & recording.'; },
      go: setting('capture') },
    { keys: ['sound in recordings', 'record my voice', 'microphone', 'mic', 'hear yourself', 'record with mic', 'no sound in recording', 'recording sound'],
      say: 'In Settings → Screenshots & recording, pick Game (only the game\'s sound), Game + mic (your voice too) or None. With the mic on, "Hear yourself" plays your mic back to you, so use headphones or it echoes.',
      go: setting('capture') },
    { keys: ['screenshot', 'screenshots', 'screen shot', 'screenshot key', 'camera button', 'floating camera', 'take a picture of the game'],
      say: function () { return 'Press your screenshot key' + (D.settings.shotKey ? ' (' + D.settings.shotKey + ')' : ' (pick one in Settings → Screenshots & recording, like F8)') + ' anytime, even in a game. Or use the quick menu, the floating camera button, a controller\'s View button, or just tell me "take a screenshot". They all go to the Gallery app.'; },
      go: setting('capture') },
    { keys: ['recording', 'recordings', 'record key', 'video of my game', 'record a video', 'record video', 'record my game', 'record the game', 'how do i record', 'screen record', 'rec timer'],
      say: function () { return 'Press your record key' + (D.settings.recKey ? ' (' + D.settings.recKey + ')' : ' (pick one in Settings → Screenshots & recording, like F9)') + ' once to start and again to stop. A REC timer shows while it records. You can also hold the floating camera button, hold a controller\'s View button, or tell me "record this". Videos go to the Gallery.'; },
      go: setting('capture') },
    { keys: ['gallery', 'where do screenshots go', 'where are my screenshots', 'where are my recordings', 'my pictures', 'photos'],
      say: 'The Gallery app has all your screenshots, recordings and drawings, newest first. You can filter by game, rename, download, delete, or use a picture as a game cover.',
      go: app('gs2-gallery') },
    { keys: ['video app', 'videos', 'youtube', 'watch videos', 'mini player', 'picture in picture'],
      say: 'The Video app plays your recordings, your own video files and YouTube links. It remembers where you stopped, and the mini player floats over your games.',
      go: app('gs2-video') },
    { keys: ['menu music', 'background music'],
      say: 'Menu music is chill music in the menus that matches your theme. Turn it on in Settings → Sound. It stops by itself when you play a game or use the Music app.',
      go: setting('sound') },
    { keys: ['music app', 'music', 'songs', 'add songs', 'my songs', 'playlist'],
      say: 'The Music app plays your own songs: open it from Apps and drop music files in. It keeps playing while you play games, and I can control it ("next song", "pause the music").',
      go: app('gs2-music') },
    { keys: ['timer', 'timers', 'alarm', 'alarms', 'stopwatch', 'countdown'],
      say: 'The Timer app has timers, a stopwatch and alarms. Timers ring over your games even when the app is closed. Or just tell me "timer 10 minutes" or "alarm 7:30 on school days".',
      go: app('gs2-timer') },
    { keys: ['code app', 'coding', 'learn to code', 'playground', 'html css javascript', 'make my own game', 'save as game', 'save as app'],
      say: 'The Code app is where you write HTML, CSS and JavaScript and see it work live. It has examples and lessons, and "Save as game" puts what you made in your Library. Or tell me "make a game about…" and I\'ll make one.',
      go: app('gs2-code') },
    { keys: ['edit code', 'code editor', 'change the code', 'editor', 'glue on the rest', 'cut off code'],
      say: 'In Pro mode, right-click a game → Edit code. It shows mistakes with red lines, notices when an AI\'s code got cut off, and "Glue on the rest" joins code an AI sent in two parts.' },
    { keys: ['notes', 'notes app'], say: 'The Notes app is for quick notes. They save by themselves.', go: app('gs2-notes') },
    { keys: ['calculator'], say: 'The Calculator app is in Apps. It opens in a window, so you can use it next to a game.', go: app('gs2-calculator') },
    { keys: ['drawing', 'draw', 'paint'], say: 'The Drawing app lets you draw, then save it to the Gallery or use it as a game picture or your profile picture.', go: app('gs2-drawing') },

    { keys: ['save', 'saves', 'saving', 'progress', 'continue', 'resume', 'where i left off', 'save kit', 'lost my progress', 'pc turned off'],
      say: 'Games with the Save Kit continue exactly where you left off, even after your PC turns off. Other games save their own way (like high scores) and start at their title screen. Press "Make it continue" on a game to upgrade it with an AI.',
      go: view('saves') },
    { keys: ['make it continue', 'upgrade a game', 'upgrade'],
      say: 'Pick a game and press "Make it continue". It copies a message for an AI with the game\'s code; paste the AI\'s answer back and the game continues where you left off from then on. A backup is kept, so you can undo it.' },
    { keys: ['private saves', 'shared saves', 'old saves'],
      say: 'Private saves keeps each game\'s saves in its own box, so games can\'t mess each other up. Games from your old Game System have it off, so they keep the saves they already had. It\'s in a game\'s Details & more (Pro mode).' },
    { keys: ['saves page', 'saves tab', 'saves manager', 'delete a save', 'export save', 'wipe saves', 'move saves'],
      say: 'The Saves tab shows every game\'s saves. You can back them up, move them to another game, or wipe them.',
      go: view('saves') },
    { keys: ['backup', 'backups', 'back up', 'restore', 'lose my games', 'save everything', 'move to another computer'],
      say: 'Settings → Backups & data → "Back up everything" makes one .zip with all your games, saves, trophies, settings and Gallery. "Restore a backup" brings it all back, even on another PC or your phone.',
      go: setting('data') },
    { keys: ['website folder', 'netlify', 'build website', 'put games online', 'any computer', 'other computers'],
      say: 'Settings → Website folder builds one folder with Game System and all your games. Drag it onto your Netlify site and your games work on any computer.',
      go: setting('website') },
    { keys: ['updates', 'update game system', 'new version', 'check for updates', 'update ready', 'how do i update'],
      say: 'Game System checks for updates by itself when you open it and shows "Update ready → Reload now". To check right now: Settings → App → Check for updates. Your games and saves stay.',
      go: setting('app') },
    { keys: ['install game system', 'install as app', 'install as an app', 'install the app', 'install it', 'app window', 'desktop app', 'own window'],
      say: 'In Chrome or Edge, click the install icon in the address bar (or ⋮ → Install). Then Game System opens in its own window like a real console.',
      go: setting('app') },
    { keys: ['theme', 'themes', 'colors', 'make a theme', 'own theme', 'neon', 'hacker', 'lava', 'ice', 'galaxy', 'prism', 'gold theme'],
      say: function () {
        var now = '';
        try { var th = Themes.current(); if (th && th.name) now = 'You\'re using ' + th.name + ' right now. '; } catch (e) { /* ignore */ }
        return now + 'Themes change the colors, background, fonts, sounds and the title screen. Pick one in Settings → Look, or make your own from words or a picture. Some bonus themes unlock at higher levels.';
      },
      go: setting('look') },
    { keys: ['moving background', 'background', 'lag', 'laggy', 'lagging', 'slow', 'slow pc', 'choppy', 'low fps', 'battery', 'scanlines', 'less motion', 'animations'],
      say: 'Settings → Look → Moving background: Full, Calm (saves battery) or Off (fastest for slow PCs). "Less motion" turns off most animations.',
      go: setting('look') },
    { keys: ['trophy', 'trophies', 'achievement', 'achievements', 'level', 'levels', 'points', 'xp', 'rewards', 'level up', 'trophy room'],
      say: 'You earn trophies by playing, collecting games and finding secrets. Trophies give points, points give levels, and levels unlock rewards like bonus themes, badge frames and orb colors for me. The trophy room is in Stats.',
      go: function () { Trophies.open(); } },
    { keys: ['profile', 'profile picture', 'avatar', 'my picture', 'change my name', 'my name'],
      say: 'Click your name at the top right: change your picture (upload one, make one with the AI, or draw one), your name, and see your level and trophies.',
      go: function () { Trophies.profile(); } },
    { keys: ['folder', 'folders', 'organize', 'sort games'],
      say: 'Drop one game on top of another to make a folder, like on a phone. Click a folder to open it, and drag things out to take them out. Or tell me "sort my games into folders".',
      go: view('library') },
    { keys: ['order', 'rearrange', 'drag', 'move games around', 'own order'],
      say: 'Drag games to put them in your own order (on a phone: hold, then drag). "More → Arrange" can sort them by name, most played and more.',
      go: view('library') },
    { keys: ['small icons', 'big cards', 'list view', 'size slider', 'how things look', 'bigger tiles', 'smaller tiles'],
      say: 'The buttons at the top of Home, Library and Apps switch between small icons, big cards and a list, and the slider changes the size. Each screen remembers its own look.' },
    { keys: ['home layout', 'home screen', 'rows', 'dashboard'],
      say: 'Settings → Home & Library → Home layout: the Console dashboard (rows you can drag), All games, or a list with details.',
      go: setting('home') },
    { keys: ['simple mode', 'pro mode', 'simple or pro', 'advanced settings', 'hidden settings'],
      say: 'Simple mode hides the code editor, the error console, raw save data and advanced settings. Pro shows everything. Switch it in Settings → Simple or Pro.',
      go: setting('mode') },
    { keys: ['quick menu', 'f2', 'menu while playing', 'pause menu', 'exit a game', 'quit a game', 'leave a game', 'get out of a game', 'close a game'],
      say: function () { return 'Press ' + key('hotkey', 'F2') + ' while playing (or move your mouse to the top edge, or tap the menu button on a phone). It has save, fullscreen, screenshot, record, errors, edit code, restart and quit.'; } },
    { keys: ['fullscreen', 'full screen'],
      say: function () { return 'In a game, open the quick menu (' + key('hotkey', 'F2') + ') → Fullscreen. Esc leaves fullscreen.'; } },
    { keys: ['error', 'errors', 'broken game', 'red badge', 'console', 'not working', 'game broken', 'crash', 'crashed', 'bug', 'bugs'],
      say: function () { return 'If a game breaks, a red badge shows in the quick menu (' + key('hotkey', 'F2') + '). "Copy errors for AI" gives you text to paste to an AI so it can fix it. Or just tell me "fix" and the game\'s name, and I\'ll fix it with a backup.'; } },
    { keys: ['add a game', 'add games', 'import', 'zip', 'html file', 'upload', 'put a game in', 'paste code'],
      say: 'Click Add: pick .html files, a .zip, a whole folder, paste code from an AI, or add a link. If a game has pictures or sounds in other files, add the whole folder or the zip.',
      go: function () { var b = document.getElementById('btn-add'); if (b) b.click(); } },
    { keys: ['ai games', 'rules for ai', 'chatgpt game', 'make games with ai', 'ai made game'],
      say: 'Settings → AI games has the rules to give an AI so its games work great here (one file, saves, continue where you left off). Or just tell me "make a game about…".',
      go: setting('ai') },
    { keys: ['apps', 'game or app', 'move to apps', 'website app', 'apps tab'],
      say: 'Apps open in windows over everything (Music, Notes, Timer…), and games open full screen. Right-click anything → Move to Apps or Move to Games.',
      go: view('apps') },
    { keys: ['window', 'windows', 'minimize', 'taskbar', 'maximize', 'resize'],
      say: 'Apps open in windows: drag the top bar to move, drag a corner to resize, or use the buttons to maximize or minimize to the taskbar at the bottom.' },
    { keys: ['cover', 'covers', 'game picture', 'picture maker', 'thumbnail', 'icon', 'use as cover'],
      say: 'Right-click a game → Details & more → picture: free AI pictures, neon letters, icon art, your own picture, or a screenshot ("Use as cover" right after you take one).' },
    { keys: ['controller', 'gamepad', 'xbox', 'playstation', 'ps5 controller', 'joystick'],
      say: 'Controllers work in the menus: move with the stick or D-pad, A to pick, B to go back, Start switches app windows, View = screenshot (hold = record), and hold Y to talk to me.' },
    { keys: ['keys', 'shortcuts', 'hotkeys', 'keyboard', 'keybinds'],
      say: function () { return 'Your keys: quick menu ' + key('hotkey', 'F2') + ', screenshot ' + key('shotKey', '(not set)') + ', record ' + key('recKey', '(not set)') + ', talk to me ' + key('vexTalkKey', '(not set)') + ', my chat ' + key('vexChatKey', '(not set)') + '. Pick your own in Settings → Screenshots & recording and Settings → VEX.'; } },
    { keys: ['phone', 'android', 'iphone', 'mobile', 'on my phone', 'pc to phone'],
      say: 'Open your Game System website in Chrome on your phone and install it (⋮ → Install app). To bring your stuff over from your PC: make a backup on the PC (Settings → Backups & data), put the file on your phone, and restore it there.' },
    { keys: ['storage', 'disk space', 'how much space', 'out of space', 'storage full', 'gigabyte', 'gigabytes', 'big game', 'big games', 'megabytes', 'too big'],
      say: 'Games are saved inside your browser on this device, not online. Chrome lets a website use a big part of your free disk space, so even big games fit. Settings → Backups & data shows how much you use.',
      go: setting('data') },
    { keys: ['github', 'git hub'],
      say: 'Game System doesn\'t need GitHub: your games live in your browser on this device. Got a game on GitHub? Open it there, press the green Code button → Download ZIP, then Add the zip here. Want your games online for any computer? Use Settings → Website folder and drag it onto Netlify. (Windows .exe games can\'t run in a website.)',
      go: setting('website') },
    { keys: ['delete a game', 'remove a game', 'uninstall', 'delete game'],
      say: 'Right-click the game → Delete (it asks first). Or tell me "delete" and the name.' },
    { keys: ['delete everything', 'reset everything', 'wipe everything', 'start fresh', 'danger zone'],
      say: 'Settings → Danger zone → Delete EVERYTHING removes all games, saves, stats and settings. Make a backup first!',
      go: setting('danger') },
    { keys: ['bell', 'notifications', 'notification'],
      say: 'The bell at the top tells you stuff, like when an update is ready or it\'s time for a backup. A dot means something new.' },
    { keys: ['wake word', 'hey vex', 'say vex', 'listen', 'listening', 'talk to you', 'hold to talk', 'voice'],
      say: 'Settings → VEX: turn on "Listen for its name" and allow the mic (Chrome or Edge), then just say "VEX". Or set a hold-to-talk key, hold the mic button in my chat, or hold Y on a controller.',
      go: setting('vex') },
    { keys: ['free ai', 'ai key', 'api key', 'own key', 'smarter', 'brain', 'gemini', 'openai', 'claude', 'chatgpt', 'free key', 'get a key'],
      say: 'Simple stuff works without any AI. For other questions I use a free AI, which is sometimes busy or down. For a smarter me that works every time, add a free Google Gemini key: go to aistudio.google.com, sign in with Google, press "Get API key" → "Create API key", copy it, then Settings → VEX → Brain → My own key → Google Gemini → paste → Save.',
      go: setting('vex') },
    { keys: ['old game system', 'old games', 'my old stuff', 'old app'],
      say: 'Add → "Import my old games" brings over your old Game System\'s games and their saves (same website, same browser). Or tell me "bring over my old games".' },
    { keys: ['stats', 'play time', 'playtime', 'statistics', 'streak', 'most played'],
      say: 'The Stats tab shows your total play time, the last 14 days, your playing streak, your most played games and the trophy room.',
      go: view('stats') },
    { keys: ['search', 'find a game'],
      say: 'Use the search box in the Library, or the magnifying glass at the top. Or tell me "find" and the name.' },
    { keys: ['favorite', 'favorites', 'favourite', 'favourites'],
      say: 'Right-click a game → Favorite. Favorites get their own filter in the Library. Or tell me "favorite" and the name.' },
    { keys: ['offline', 'no internet', 'wifi', 'wi-fi', 'internet'],
      say: 'Your games work without internet once Game System is installed or open. Only AI stuff, YouTube and website games need internet.' },
    { keys: ['press any key', 'title screen', 'start screen'],
      say: 'That\'s the console-style "press any key" screen when you open Game System. You can turn it off in Settings → Start-up & games.',
      go: setting('startup') },
    { keys: ['auto save', 'autosave', 'auto-save', 'how often does it save'],
      say: 'Settings → Start-up & games → Auto-save games: how often games with the Save Kit save. They also save when you close them.',
      go: setting('startup') },
    { keys: ['new game', 'start over', 'restart a game', 'reset a game'],
      say: 'On Home, pick the game and press New game. It starts fresh and deletes that game\'s Save Kit progress, so it asks first.' },
    { keys: ['make a game', 'create a game', 'make games', 'make an app'],
      say: 'Just tell me "make a game about…" (like "make a game where you dodge lava") and I\'ll make it and put it in your Library. Or build one yourself in the Code app.' },
    { keys: ['vex helper', 'who is vex', 'what is vex'],
      say: 'I\'m VEX, your helper. I open games, set timers, control music, take screenshots, sort folders, make and fix games, and answer questions about Game System. Say "help" for the list.' }
  ];
  /* words that don't tell us the topic */
  var STOP = /\b(what|whats|what's|is|are|the|a|an|how|do|does|did|i|you|me|my|can|could|to|in|of|it|its|it's|about|explain|mean|means|meaning|where|there|this|that|for|with|on|get|use|work|works|thing|things|game system|please|tell|vex|hey|yo|bro|why|which|when|should|would|will|be|go|goes|find|show|make|set|turn|have|has)\b/g;

  function norm(t) { return VexBrain.norm(t); }
  function wordIn(text, w) { return new RegExp('(^| )' + w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '(s|es)?( |$)').test(text); }
  /* the best topic for a question: { topic, score } or null */
  function match(q) {
    var text = ' ' + norm(q).replace(/[?!.,]/g, ' ').replace(/\s+/g, ' ').trim() + ' ';
    var left = text.replace(STOP, ' ').replace(/\s+/g, ' ').trim();
    if (!left) return null;
    var best = null, second = 0;
    TOPICS.forEach(function (tp) {
      var s = 0;
      tp.keys.forEach(function (k) {
        if (wordIn(text.trim(), k)) s = Math.max(s, 2 + 2 * (k.split(' ').length - 1) + (k.length > 6 ? 1 : 0));
      });
      if (!s) return;
      if (!best || s > best.score) { second = best ? best.score : 0; best = { topic: tp, score: s }; } else if (s > second) second = s;
    });
    if (!best) return null;
    best.sure = best.score >= 3 || best.score > second;
    return best;
  }
  function textOf(tp) { return typeof tp.say === 'function' ? tp.say() : tp.say; }

  /* everything, short, for the AI to read */
  function facts() {
    return TOPICS.map(function (tp) { try { return '- ' + textOf(tp); } catch (e) { return ''; } }).filter(Boolean).join('\n');
  }

  window.VexKnow = {
    match: match,
    answer: function (q) {
      var m = match(q);
      if (!m) return null;
      return { text: textOf(m.topic), go: m.topic.go || null, sure: m.sure, score: m.score };
    },
    facts: facts,
    TOPICS: TOPICS
  };
})();
