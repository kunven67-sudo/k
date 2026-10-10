# Auto Try Again 😴

Clicks the **Try again** button for you once the reset time on the page has passed.

1. Open the page with the "Try again" button in a **desktop browser** (Chrome/Edge/Firefox).
2. Press **F12** → **Console** tab.
3. Paste everything from `auto-try-again.js` and press **Enter**.
4. A little black box shows up bottom-right showing what it's doing. Leave the tab open and the computer awake.

- It reads times like "resets at 1 PM" and waits until then (+30s), then clicks.
- If it can't find a time, it clicks at most once every 5 minutes.
- It stops itself after 50 clicks. Click the black box to stop it early.
