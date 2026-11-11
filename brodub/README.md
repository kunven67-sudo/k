# 🎙️ BroDub

Turns the foreign voices in a video into English, **in each character's own voice**. Music, sound effects,
laughs and songs stay untouched. Runs on Google Colab's free GPU, so nothing to install.

**[▶ Open BroDub in Google Colab](https://colab.research.google.com/github/kunven67-sudo/k/blob/claude/upbeat-goodall-8brqg3/brodub/BroDub.ipynb)**

- **Google Drive** (default, best on a phone): press ▶ → tap Allow → put the video in Google Drive > `BroDub` →
  go use any other app. About 20-30 min later the English one is in `BroDub/English` and your phone pings you.
  BroDub waits up to an hour for the video to finish uploading, and skips videos that already have an English one.
- **Pick from this phone/PC**: switch the dropdown, press ▶, pick a video and stay on the tab until it's uploaded.
  The English one downloads when it's done.

## What it does

1. **Voices out of the music** (Demucs `htdemucs_ft`): the AI only ever hears people talking, so the cloned voices
   come out clean instead of muddy.
2. **Hears every line** (faster-whisper `large-v3`, word timings).
3. **Translates** (Qwen3-4B-Instruct): spoken-style English, about as long as the original so it fits the mouths.
   It finds the characters' names first, so they're spelled the same all episode.
4. **Who's talking**: lines with the same voice are grouped into one character (Chatterbox voice encoder).
5. **English in their voice** (Chatterbox): each character gets ~10 s of their clearest lines as the voice sample.
   Louder lines (yelling) get more feeling.
6. **Fits + mixes**: each English line is sped up a little if it's too long (Rubber Band, keeps the voice natural),
   matched to the original loudness and laid over the music. The original voice is cut only where English replaces it.

The finished `.mp4` has the English track (default), the original track, and English subtitles you can turn on.

## Run it on your own computer (needs an NVIDIA GPU with 8 GB+)

```bash
uv venv -p 3.12 bd && uv pip install -p bd/bin/python torch==2.6.0 torchaudio==2.6.0 \
  chatterbox-tts==0.1.7 faster-whisper==1.2.1 ctranslate2==4.5.0 demucs==4.1.0
bd/bin/python brodub.py episode.mp4          # -> "episode (English dub).mp4"
```

Options: `--lang ja` (skip language detection), `--llm none` (Whisper translates instead), `--max-seconds 60`
(quick test), `--keep-work` (keep the in-between files). After changing `brodub.py`, run `python make_notebook.py`
to rebuild `BroDub.ipynb`.
