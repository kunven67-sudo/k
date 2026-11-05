# Chill Charge

Android app that helps your phone charge faster while you keep using it, with lo-fi music.

- **Close background apps** (Android 13 and older; Android 14+ freezes them by itself)
- **Dim screen + sleep fast**: sets brightness to what you pick and screen sleep to 15 s (you allow "Modify system settings" once)
- **Battery saver**: shows if it's on, one tap opens the setting (Android doesn't let apps flip it)
- Shows live charging power (W), heat, and time to full
- Unplug and brightness + sleep time go back to how they were (small notification while boost is on)

- **More tricks**: lock screen now, black mode, 20 s charger test, send phone info (copies it + opens Claude)
- **Claude mode**: while the Claude app is open, music + boost + reactor keep going (needs Usage access)
- **REACTOR** tab: your real charging (Wh) fills a nuclear core. Push it past the limit for a meltdown;
  4 tiers (0.3 / 1.5 / 4 / 10 Wh), bigger charge = bigger blast

Build: `bash build.sh` (see the top of the file for the SDK download).

Music (CC0, OpenGameArt.org "Relaxing Lo-Fi Songs" + "Since 2 A.M."). Sounds (CC0, OpenGameArt.org): sirens-and-alarm-noise,
alarm-2, chunky-explosion, rumble-fx. Reactor photo: "Advanced Test Reactor" by Argonne National Laboratory, CC BY-SA 2.0
(Wikimedia Commons). Blast: Ivy Mike test footage, US government, public domain (Wikimedia Commons). Font: Space Grotesk (SIL OFL).
