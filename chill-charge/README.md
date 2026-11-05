# Chill Charge

Android app that helps your phone charge faster while you keep using it, with lo-fi music.

- **Close background apps** (Android 13 and older; Android 14+ freezes them by itself)
- **Dim screen + sleep fast**: sets brightness to what you pick and screen sleep to 15 s (you allow "Modify system settings" once)
- **Battery saver**: shows if it's on, one tap opens the setting (Android doesn't let apps flip it)
- Shows live charging power (W), heat, and time to full
- Unplug and brightness + sleep time go back to how they were (small notification while boost is on)

- **More tricks**: lock screen now, black mode, 20 s charger test, send phone info (copies it + opens Claude)
- **Claude mode**: while the Claude app is open, music + boost keep going (needs Usage access)
- **EMPIRE** tab (Power Empire): real watts x multiplier = game watts. 12 buildings (hand crank -> black hole engine),
  69 upgrades, Power Bank (charging fills it, unplugged it runs the empire), 14 timed Research in 3 lanes.
  The save lives in the app (Game.java) and is paid from the battery mAh counter, so charging while closed counts.
- **PC link**: tiny web server on port 8080 (MiniHttp + LinkService). Same Wi-Fi, open the address + key it shows,
  lock the phone: the PC shows live charging and plays the same empire.

Build: `bash build.sh` (see the top of the file for the SDK download).

Music (CC0, OpenGameArt.org "Relaxing Lo-Fi Songs" + "Since 2 A.M."). Font: Space Grotesk (SIL OFL).
