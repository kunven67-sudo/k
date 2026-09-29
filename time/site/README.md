# TIME: website with the online leaderboard

Put this folder on Netlify (the same site as time133.netlify.app):

1. Push this folder to a GitHub repo, or drag it into Netlify with the Netlify CLI (`netlify deploy --prod`).
   The Netlify drag-and-drop page does **not** run functions, so it has to be Git or the CLI.
2. Netlify finds `netlify/functions/time-board.mjs` on its own and installs `package.json`.
   The leaderboard is saved with Netlify Blobs, so there is nothing else to set up.
3. Open the site. The first time someone presses Play, the game asks for their name.

- `index.html` is the game.
- `netlify/functions/time-board.mjs` is the leaderboard. It checks names again on the server (no bad words, 3 to 16 characters, one name per player, and "Bro" and "bro" count as the same name). It also refuses made-up play time.

If TIME is opened as a file, or on a site without the function, the name and stats are saved on that device only.

## The owner tag

The first player to pick a name on the online board is the owner: their name shows up red and glitchy with an OWNER tag, only for them.
To choose the owner yourself instead, add an environment variable in Netlify (Site settings → Environment variables): `TIME_OWNER` = your name.
