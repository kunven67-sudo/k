## CursorVerse 1.0.3

- 🎤 **Fixed:** "Pause while another app uses the mic" counted CursorVerse's own listener as another app, so voice never worked with that setting on. CursorVerse now recognizes itself 3 ways:
  - by its exact file paths
  - by what starts using the mic the moment voice starts listening
  - by name
- 🎤 **New:** if voice ever pauses for the wrong app, click **"Ignore <app>"** on the Voice page and that app never pauses voice again.
