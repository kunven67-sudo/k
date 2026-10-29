#!/usr/bin/env python3
"""BroDub: turns the foreign voices in a video into English, in each character's own voice.

1. Split the voices from the music + sounds (Demucs), so the AI only hears people talking.
2. Hear every line and when it's said (faster-whisper, with word timings).
3. Translate the lines into casual spoken English that fits the time (Qwen3 on a GPU).
4. Find out who's talking: lines with the same voice become one character.
5. Say each line in English with that character's voice (Chatterbox voice cloning).
6. Fit each English line into its time slot, cut the original voice there, and mix it over the
   untouched music. Laughs, screams and songs keep the original voice.

    python brodub.py episode.mp4                # -> "episode (English dub).mp4" next to it
    python brodub.py a.mp4 b.mkv --out-dir done/
"""
import argparse
import gc
import json
import os
import re
import shutil
import subprocess
import sys
import tempfile
import time
from pathlib import Path

import numpy as np

SR = 44100  # mixing rate
ASR_SR = 16000
CHARS_PER_SEC = 14.0  # how fast the English voice talks, roughly (used to keep lines short)
SONG = re.compile(r"[♪♫♬]")
# Language-free sounds: the original voice stays for these (real dubs keep the grunts too).
GRUNT = re.compile(r"^(?:(?:a+h*|o+h*|u+h*|uh+|um+|hm+|mm+|huh|eh+|ugh+|ha+|ha(?:ha)+|heh|hehe|whoa|wow|ooh|aah|hah|tch|ow+|ah-?ha)[\s,.!?~…-]*)+$", re.I)
# Everyday anime phrases a small translator gets too literal.
JA_TIPS = (
    "しょうがない/仕方ない = oh well / fine, whatever; 言い訳 = (making) excuses; よろしく = nice to meet you / count on "
    "you; お疲れ = good work; なるほど = I see; まさか = no way; うそ = no way / you're kidding; やばい = oh crap / "
    "awesome; すごい = amazing; ちょっと待って = hold on; 大丈夫 = you okay? / I'm fine; バカ = idiot; うるさい = shut up; "
    "いただきます = let's eat; ただいま/おかえり = I'm home / welcome back; 行ってきます = I'm heading out; 頑張って = "
    "you got this; ごめん = sorry; ありがとう = thanks; 何で = why; 何だと = what did you say; くそ = damn; "
    "せんぱい/先輩 = senpai; ～さん/くん/ちゃん/様 = keep as -san/-kun/-chan/-sama"
)
LANG_NAMES = {
    "ja": "Japanese", "ko": "Korean", "zh": "Chinese", "es": "Spanish", "pt": "Portuguese", "fr": "French",
    "de": "German", "it": "Italian", "ru": "Russian", "th": "Thai", "vi": "Vietnamese", "id": "Indonesian",
    "tl": "Tagalog", "hi": "Hindi", "ar": "Arabic", "tr": "Turkish", "pl": "Polish", "nl": "Dutch",
}


def say(msg):
    print(msg, flush=True)


def free_gpu():
    gc.collect()
    try:
        import torch
        if torch.cuda.is_available():
            torch.cuda.empty_cache()
    except ImportError:
        pass


def ffmpeg(*args):
    subprocess.run(["ffmpeg", "-hide_banner", "-loglevel", "error", "-y", *args], check=True)


def load_audio(path, sr, mono):
    """Any audio/video file -> float32 samples (frames x channels, or 1-D when mono)."""
    ch = 1 if mono else 2
    raw = subprocess.run(
        ["ffmpeg", "-hide_banner", "-loglevel", "error", "-i", str(path), "-vn", "-ac", str(ch),
         "-ar", str(sr), "-f", "f32le", "-"],
        check=True, capture_output=True,
    ).stdout
    a = np.frombuffer(raw, dtype=np.float32).copy()
    return a if mono else a.reshape(-1, 2)


def write_wav(path, audio, sr):
    import soundfile as sf
    sf.write(str(path), audio, sr, subtype="FLOAT")


def rms_db(x):
    if len(x) == 0:
        return -120.0
    return float(20 * np.log10(np.sqrt(np.mean(np.square(x, dtype=np.float64))) + 1e-9))


def has_rubberband():
    out = subprocess.run(["ffmpeg", "-hide_banner", "-filters"], capture_output=True, text=True).stdout
    return " rubberband " in out


# ---------------------------------------------------------------- 1. voices away from the music

def split_voices(src_wav, work, device):
    model = "htdemucs_ft" if device == "cuda" else "htdemucs"
    from demucs.separate import main as demucs_main
    demucs_main(["--two-stems", "vocals", "-n", model, "-d", device, "--float32", "-o", str(work / "sep"), str(src_wav)])
    out = work / "sep" / model / src_wav.stem
    return out / "vocals.wav", out / "no_vocals.wav"


# ---------------------------------------------------------------- 2. hear the lines

def hear_lines(vocals16, device, model_name, lang):
    from faster_whisper import WhisperModel
    model = WhisperModel(model_name, device=device, compute_type="float16" if device == "cuda" else "int8")
    segments, info = model.transcribe(
        vocals16, language=lang, task="transcribe", beam_size=5, word_timestamps=True,
        vad_filter=True, vad_parameters={"min_silence_duration_ms": 350},
        condition_on_previous_text=False, language_detection_segments=8,
    )
    lines = []
    for seg in segments:
        unsure = seg.no_speech_prob > 0.6 and seg.avg_logprob < -1.0
        cur = []
        for w in seg.words or []:
            ends = cur[-1].word.strip()[-1:] if cur else ""
            if cur and (w.start - cur[-1].end > 0.55 or (ends and ends in "。！？!?." and cur[-1].end - cur[0].start > 1.0)
                        or w.end - cur[0].start > 12):
                lines.append(_line(cur, unsure, seg.text))
                cur = []
            cur.append(w)
        if cur:
            lines.append(_line(cur, unsure, seg.text))
    lines = [ln for ln in lines if ln["text"] and ln["end"] - ln["start"] >= 0.25]
    del model
    free_gpu()
    return lines, info.language


def measure_lines(lines, vocals16, music16):
    for ln in lines:
        a, b = int(ln["start"] * ASR_SR), int(ln["end"] * ASR_SR)
        ln["voice_db"] = rms_db(vocals16[a:b])
        ln["clean"] = ln["voice_db"] - rms_db(music16[a:b])  # how far the voice is above the music


def mark_songs(lines):
    """Opening/ending songs: the singing is about as loud as the music (talking sits well above it) and it
    goes on and on. Those keep the original singer."""
    loud = [ln for ln in lines if ln["clean"] < 4]
    for ln in loud:
        mid = (ln["start"] + ln["end"]) / 2
        near = [o for o in loud if abs((o["start"] + o["end"]) / 2 - mid) < 15]
        sung = sum(min(o["end"], mid + 15) - max(o["start"], mid - 15) for o in near)
        if len(near) >= 4 and sung > 30 * 0.6:
            ln["song"] = True


def _line(words, unsure, seg_text):
    text = "".join(w.word for w in words).strip()
    return {
        "start": float(words[0].start), "end": float(words[-1].end), "text": text,
        "song": bool(SONG.search(seg_text)) or not re.search(r"\w", text), "unsure": unsure,
    }


# ---------------------------------------------------------------- 3. translate

class Translator:
    def __init__(self, model_name, device, src_lang):
        import torch
        from transformers import AutoModelForCausalLM, AutoTokenizer
        self.torch = torch
        self.tok = AutoTokenizer.from_pretrained(model_name)
        dtype = torch.float16 if device == "cuda" else torch.bfloat16
        self.model = AutoModelForCausalLM.from_pretrained(model_name, dtype=dtype).to(device).eval()
        self.device = device
        self.lang = LANG_NAMES.get(src_lang, src_lang)
        self.src = src_lang
        self.cast = ""

    def find_names(self, texts):
        """Character names in the whole episode, written in English, so every line spells them the same."""
        text = "\n".join(texts)[:12000]
        system = (
            f"These lines come from a speech recognizer listening to a {self.lang} show (punctuation can be missing). "
            "List the names of the people/characters that appear, written the usual English way (like Kenta, Yui). "
            "Reply with only the names separated by commas, or 'none'."
        )
        names = self._ask(system, text, 60)
        self.cast = "" if names.lower().startswith("none") else names

    def _ask(self, system, user, max_new):
        msgs = [{"role": "system", "content": system}, {"role": "user", "content": user}]
        prompt = self.tok.apply_chat_template(msgs, tokenize=False, add_generation_prompt=True, enable_thinking=False)
        ids = self.tok(prompt, return_tensors="pt").to(self.device)
        with self.torch.inference_mode():
            out = self.model.generate(**ids, max_new_tokens=max_new, do_sample=False, repetition_penalty=1.05)
        text = self.tok.decode(out[0][ids["input_ids"].shape[1]:], skip_special_tokens=True)
        return clean_reply(text)

    def line(self, before, text, after, secs):
        context = "".join(f"{b['text']}  =>  {b.get('english', '')}\n" for b in before)
        nxt = f"\nNext lines (don't translate them): {after}" if after else ""
        system = (
            f"You translate {self.lang} anime dialogue into English for a dub. Write what an English voice actor "
            "would say: natural, casual spoken English with the same feeling (yelling stays yelling). Keep names "
            "as they are. Match the length of the original so it fits the mouth movements. Reply with only the "
            "English line, no quotes, no notes. The lines come from a speech recognizer, so punctuation can be "
            "missing: work out who is being talked to from the meaning. Translate the meaning, not word by word."
            + (f" Names in this show: {self.cast}." if self.cast else "")
            + (f" Phrases: {JA_TIPS}." if self.src == "ja" else "")
        )
        user = f"Earlier lines:\n{context or '(none)'}{nxt}\n\nTranslate this line ({secs:.1f} seconds long):\n{text}"
        return self._ask(system, user, 80)

    def shorter(self, english, words):
        system = "You shorten English dub lines. Keep the meaning and the feeling. Reply with only the new line."
        return self._ask(system, f"Say this in at most {words} words:\n{english}", 60)

    def close(self):
        del self.model
        free_gpu()


def clean_reply(text):
    text = text.strip().split("\n")[0].strip()
    text = re.sub(r"^(english|translation|dub)\s*:\s*", "", text, flags=re.I)
    return text.strip().strip('"“”「」『』').strip()


def translate_lines(lines, src, device, llm, whisper_name, vocals16):
    todo = [ln for ln in lines if not ln["song"]]
    tr = None
    if llm != "none":
        try:
            tr = Translator(llm, device, src)
        except Exception as e:  # out of memory, no download, ...: Whisper's translator does it all
            say(f"   (the translator AI didn't load: {e.__class__.__name__}, using Whisper's instead)")
    if tr is not None:
        t0 = time.time()
        tr.find_names([ln["text"] for ln in todo])
        if tr.cast:
            say(f"   names: {tr.cast}")
        for i, ln in enumerate(todo):
            after = " / ".join(o["text"] for o in todo[i + 1:i + 3])
            ln["english"] = tr.line(todo[max(0, i - 4):i], ln["text"], after, ln["end"] - ln["start"])
            room = room_for(ln, lines)
            if len(ln["english"]) / CHARS_PER_SEC > room * 1.4:
                short = tr.shorter(ln["english"], max(2, int(room * CHARS_PER_SEC / 5.5)))
                if re.search(r"[A-Za-z]", short) and len(short) < len(ln["english"]):
                    ln["english"] = short
            if i % 20 == 0:
                say(f"   {i + 1}/{len(todo)}  {ln['text']}  ->  {ln['english']}")
        tr.close()
        say(f"   translated {len(todo)} lines in {time.time() - t0:.0f} s")
    # Whisper's own translator, straight from the voice: for everything when there's no translator AI,
    # else only for lines where it gave back junk.
    left = [ln for ln in todo if not re.search(r"[A-Za-z]", ln.get("english", ""))]
    if not left:
        return
    from faster_whisper import WhisperModel
    model = WhisperModel(whisper_name, device=device, compute_type="float16" if device == "cuda" else "int8")
    for ln in left:
        a, b = int(ln["start"] * ASR_SR), int(ln["end"] * ASR_SR)
        segs, _ = model.transcribe(vocals16[a:b], language=src, task="translate", beam_size=5)
        ln["english"] = " ".join(s.text.strip() for s in segs).strip()
    del model
    free_gpu()


def room_for(ln, lines):
    """Seconds the English may use: until the next line starts, but not much longer than the original."""
    nxt = [o["start"] for o in lines if o["start"] > ln["start"] + 0.05]
    until_next = (min(nxt) - ln["start"] - 0.08) if nxt else 1e9
    dur = ln["end"] - ln["start"]
    return max(dur, min(until_next, max(dur * 1.25, dur + 0.4)))


# ---------------------------------------------------------------- 4. who's talking

def find_characters(lines, vocals16, ve):
    from sklearn.cluster import AgglomerativeClustering
    idx = [i for i, ln in enumerate(lines) if ln.get("dub") and ln["end"] - ln["start"] >= 0.6]
    clips = [vocals16[int(lines[i]["start"] * ASR_SR):int(lines[i]["end"] * ASR_SR)] for i in idx]
    emb = np.zeros((0, 256), np.float32)
    if clips:
        emb = ve.embeds_from_wavs(clips, sample_rate=ASR_SR)
        emb = emb / (np.linalg.norm(emb, axis=1, keepdims=True) + 1e-9)
    if len(idx) >= 2:
        labels = AgglomerativeClustering(n_clusters=None, metric="cosine", linkage="average",
                                         distance_threshold=0.32).fit(emb).labels_
    else:
        labels = np.zeros(len(idx), int)
    for i, lab in zip(idx, labels):
        lines[i]["who"] = int(lab)
    names = sorted(set(int(x) for x in labels))
    cents = {k: emb[labels == k].mean(0) for k in names}
    # Short lines: the closest-sounding character (if it can be heard at all), else the last speaker.
    last = names[0] if names else 0
    for ln in lines:
        if not ln.get("dub"):
            continue
        if "who" not in ln:
            clip = vocals16[int(ln["start"] * ASR_SR):int(ln["end"] * ASR_SR)]
            guess = None
            if cents and len(clip) > ASR_SR * 0.25:
                try:
                    e = ve.embeds_from_wavs([clip], sample_rate=ASR_SR)[0]
                    guess = max(cents, key=lambda k: float(np.dot(cents[k], e)))
                except Exception:
                    guess = None
            ln["who"] = guess if guess is not None else last
        last = ln["who"]
    return sorted(set(ln["who"] for ln in lines if ln.get("dub")))


def voice_sample(lines, who, vocals16, path):
    """About 10 s of this character's clearest talking (the AI copies the voice from it)."""
    mine = [ln for ln in lines if ln.get("dub") and ln["who"] == who]
    good = sorted(mine, key=lambda ln: (ln["end"] - ln["start"] >= 1.0, ln["clean"]), reverse=True)
    parts, total = [], 0.0
    gap = np.zeros(int(ASR_SR * 0.15), np.float32)
    for ln in good:
        a, b = int(ln["start"] * ASR_SR), int((ln["end"] + 0.05) * ASR_SR)
        clip = vocals16[a:b]
        parts += [clip, gap]
        total += len(clip) / ASR_SR
        if total >= 10:
            break
    audio = np.concatenate(parts) if parts else np.zeros(ASR_SR, np.float32)
    audio = audio * (10 ** ((-20 - rms_db(audio)) / 20))
    write_wav(path, np.clip(audio, -1, 1), ASR_SR)


# ---------------------------------------------------------------- 5. English voices

def speak_lines(lines, chars, vocals16, work, tts):
    import torch
    by_who = {}
    for ln in lines:
        if ln.get("dub"):
            by_who.setdefault(ln["who"], []).append(ln)
    done, total, t0 = 0, sum(len(v) for v in by_who.values()), time.time()
    for who in chars:
        ref = work / f"voice_{who}.wav"
        voice_sample(lines, who, vocals16, ref)
        tts.prepare_conditionals(str(ref), exaggeration=0.5)
        mine = by_who.get(who, [])
        loud = np.median([ln["voice_db"] for ln in mine]) if mine else -20
        for ln in mine:
            # Louder than this character usually talks = more feeling (yelling), quieter = calmer.
            ex = float(np.clip(0.5 + (ln["voice_db"] - loud) / 14, 0.3, 0.95))
            want = len(ln["english"]) / CHARS_PER_SEC
            best = None
            for attempt in range(3):
                torch.manual_seed(1234 + done * 7 + attempt)
                wav = tts.generate(ln["english"], exaggeration=ex, cfg_weight=0.5 if ex < 0.7 else 0.35,
                                   temperature=0.75 - 0.1 * attempt)
                y = wav.squeeze(0).cpu().numpy().astype(np.float32)
                secs = len(y) / tts.sr
                ok = 0.25 < secs < want * 2.2 + 1.5  # way too long = the AI rambled
                if best is None or abs(secs - want) < abs(best[1] - want):
                    best = (y, secs)
                if ok:
                    break
            ln["_voice"] = best[0]
            done += 1
            if done % 10 == 0 or done == total:
                left = (time.time() - t0) / done * (total - done)
                say(f"   {done}/{total} lines spoken  (about {left / 60:.0f} min left)")


# ---------------------------------------------------------------- 6. fit + mix

def fit_line(y, tts_sr, room, use_rb):
    import librosa
    y, _ = librosa.effects.trim(y, top_db=40)
    y = librosa.resample(y, orig_sr=tts_sr, target_sr=SR)
    secs = len(y) / SR
    if secs > room > 0:
        rate = min(secs / room, 1.35)
        if rate > 1.02:
            y = stretch(y, rate, use_rb)
    fade = min(len(y) // 4, int(SR * 0.012))
    if fade > 0:
        ramp = np.linspace(0, 1, fade, dtype=np.float32)
        y[:fade] *= ramp
        y[-fade:] *= ramp[::-1]
    return y


def stretch(y, rate, use_rb):
    with tempfile.TemporaryDirectory() as d:
        a, b = Path(d) / "a.wav", Path(d) / "b.wav"
        write_wav(a, y, SR)
        filt = f"rubberband=tempo={rate:.4f}:formant=preserved" if use_rb else f"atempo={rate:.4f}"
        ffmpeg("-i", str(a), "-af", filt, "-ar", str(SR), "-ac", "1", str(b))
        return load_audio(b, SR, mono=True)


def mix(lines, vocals, music, use_rb, tts_sr):
    n = max(len(vocals), len(music))
    vocals = np.pad(vocals, ((0, n - len(vocals)), (0, 0)))
    music = np.pad(music, ((0, n - len(music)), (0, 0)))
    keep = np.ones(n, np.float32)
    english = np.zeros(n, np.float32)
    ramp = int(SR * 0.03)
    for ln in lines:
        if "_voice" not in ln:
            continue
        y = fit_line(ln.pop("_voice"), tts_sr, room_for(ln, lines), use_rb)
        a = int(ln["start"] * SR)
        orig = vocals[a:int(ln["end"] * SR)].mean(1)
        gain = 10 ** (np.clip(rms_db(orig) - rms_db(y), -12, 12) / 20)
        b = min(n, a + len(y))
        english[a:b] += y[:b - a] * gain
        ln["english_end"] = b / SR
        # Cut the original voice under the line (a bit wider: word timings end early).
        ca, cb = max(0, int((ln["start"] - 0.06) * SR)), min(n, int(max(ln["end"] + 0.12, b / SR) * SR))
        keep[ca:cb] = 0
    # Smooth the cuts so they don't click.
    edges = np.flatnonzero(np.diff(keep) != 0)
    smooth = keep.copy()
    for e in edges:
        lo, hi = max(0, e - ramp), min(n, e + ramp)
        smooth[lo:hi] = np.minimum(smooth[lo:hi], np.linspace(keep[lo], keep[hi - 1], hi - lo))
    out = music + vocals * smooth[:, None] + english[:, None]
    # Soft limiter: no clipping when the English is louder than the original.
    over = np.abs(out) > 0.8
    out[over] = np.sign(out[over]) * (0.8 + 0.15 * np.tanh((np.abs(out[over]) - 0.8) / 0.15))
    return out.astype(np.float32)


def srt_time(t):
    ms = int(round(t * 1000))
    return f"{ms // 3600000:02d}:{ms // 60000 % 60:02d}:{ms // 1000 % 60:02d},{ms % 1000:03d}"


def write_srt(lines, path):
    rows = [ln for ln in lines if ln.get("english")]
    with open(path, "w", encoding="utf-8") as f:
        for i, ln in enumerate(rows, 1):
            end = max(ln["end"], ln.get("english_end", ln["end"]))
            f.write(f"{i}\n{srt_time(ln['start'])} --> {srt_time(end)}\n{ln['english']}\n\n")


def put_together(src, mix_wav, srt, out):
    subs = srt.stat().st_size > 0
    common = ["-map", "1:a:0", "-map", "0:a:0?", *(["-map", "2:s:0", "-c:s", "mov_text"] if subs else []),
              "-c:a", "aac", "-b:a", "192k",
              "-metadata:s:a:0", "language=eng", "-metadata:s:a:0", "title=English dub",
              "-metadata:s:a:1", "title=Original", "-disposition:a:0", "default", "-disposition:a:1", "0",
              *(["-metadata:s:s:0", "language=eng", "-disposition:s:0", "0"] if subs else []),
              "-movflags", "+faststart", str(out)]
    inputs = ["-i", str(src), "-i", str(mix_wav), *(["-i", str(srt)] if subs else [])]
    try:
        ffmpeg(*inputs, "-map", "0:v:0", "-c:v", "copy", *common)
    except subprocess.CalledProcessError:  # a video kind mp4 can't hold as-is: re-make the picture
        ffmpeg(*inputs, "-map", "0:v:0", "-c:v", "libx264", "-crf", "18", "-preset", "fast", "-pix_fmt", "yuv420p", *common)


# ---------------------------------------------------------------- main

def dub(src, out, args, tts_cache):
    t_start = time.time()
    device = args.device
    work = Path(tempfile.mkdtemp(prefix="brodub-", dir=args.work))
    say(f"\n🎬 {src.name}")
    orig = work / "orig.wav"
    cut = ["-t", str(args.max_seconds)] if args.max_seconds else []
    ffmpeg("-i", str(src), *cut, "-vn", "-ac", "2", "-ar", str(SR), "-c:a", "pcm_f32le", str(orig))

    say("1/6 Taking the voices out of the music...")
    voc_path, mus_path = split_voices(orig, work, device)
    free_gpu()
    vocals, music = load_audio(voc_path, SR, mono=False), load_audio(mus_path, SR, mono=False)
    vocals16, music16 = load_audio(voc_path, ASR_SR, mono=True), load_audio(mus_path, ASR_SR, mono=True)

    say("2/6 Listening to every line...")
    lines, lang = hear_lines(vocals16, device, args.whisper, args.lang)
    measure_lines(lines, vocals16, music16)
    mark_songs(lines)
    songs = sum(ln["song"] for ln in lines)
    say(f"   heard {len(lines)} lines in {LANG_NAMES.get(lang, lang)}" + (f" ({songs} sung, those stay as they are)" if songs else ""))
    if lang == "en":
        say("   it's already English: nothing to dub, skipping this one")
        shutil.rmtree(work, ignore_errors=True)
        return None

    say("3/6 Translating...")
    translate_lines(lines, lang, device, args.llm, args.whisper, vocals16)
    for ln in lines:
        e = ln.get("english", "")
        ln["dub"] = bool(e) and not ln["song"] and not ln["unsure"] and not GRUNT.match(e) and bool(re.search(r"[A-Za-z]", e))

    say("4/6 Finding who's talking...")
    if "tts" not in tts_cache:
        from chatterbox.tts import ChatterboxTTS
        tts_cache["tts"] = ChatterboxTTS.from_pretrained(device=device)
    tts = tts_cache["tts"]
    chars = find_characters(lines, vocals16, tts.ve)
    say(f"   {len(chars)} different voices")

    say("5/6 Saying it in English with their voices...")
    speak_lines(lines, chars, vocals16, work, tts)

    say("6/6 Putting it back together...")
    mixed = mix(lines, vocals, music, has_rubberband(), tts.sr)
    mix_wav, srt = work / "mix.wav", work / "english.srt"
    write_wav(mix_wav, mixed, SR)
    write_srt(lines, srt)
    put_together(src, mix_wav, srt, out)
    shutil.copy(srt, out.with_suffix(".srt"))
    with open(work / "lines.json", "w", encoding="utf-8") as f:
        json.dump(lines, f, ensure_ascii=False, indent=1)
    dubbed = sum(1 for ln in lines if ln.get("dub"))
    say(f"✅ {out.name}: {dubbed} lines in English, {len(chars)} voices, took {(time.time() - t_start) / 60:.1f} min")
    if not args.keep_work:
        shutil.rmtree(work, ignore_errors=True)
    return out


def main():
    p = argparse.ArgumentParser(description="BroDub: dub a video's voices into English, keeping each character's voice.")
    p.add_argument("videos", nargs="+", type=Path)
    p.add_argument("--out-dir", type=Path, help="where the English videos go (default: next to each video)")
    p.add_argument("--lang", default=None, help="language spoken in the video, like ja (default: figure it out)")
    p.add_argument("--whisper", default=None, help="speech model (default: large-v3 on a GPU, small without)")
    p.add_argument("--llm", default="Qwen/Qwen3-4B-Instruct-2507", help="translator model, or 'none' for Whisper's")
    p.add_argument("--device", default=None, help="cuda or cpu (default: cuda if there is one)")
    p.add_argument("--work", default=None, help="folder for the in-between files")
    p.add_argument("--keep-work", action="store_true", help="keep the in-between files (for fixing bugs)")
    p.add_argument("--max-seconds", type=float, default=0, help="only do the first N seconds (quick test)")
    args = p.parse_args()

    import torch
    if args.device is None:
        args.device = "cuda" if torch.cuda.is_available() else "cpu"
    if args.whisper is None:
        args.whisper = "large-v3" if args.device == "cuda" else "small"
    if args.device == "cpu":
        say("⚠️ No GPU: this works, but it's slow (hours for one episode).")
    tts_cache, made = {}, []
    for src in args.videos:
        if not src.exists():
            say(f"❌ can't find {src}")
            continue
        folder = args.out_dir or src.parent
        folder.mkdir(parents=True, exist_ok=True)
        out = folder / f"{src.stem} (English dub).mp4"
        try:
            r = dub(src, out, args, tts_cache)
            if r:
                made.append(r)
        except subprocess.CalledProcessError as e:
            say(f"❌ {src.name}: couldn't read or write the video ({e.cmd[0]} failed). Is it a real video file?")
    if not made:
        sys.exit(1)


if __name__ == "__main__":
    main()
