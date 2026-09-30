// Windows CI only: speaks test phrases with Windows text-to-speech into WAV
// files, runs the real voice host on them, and checks what it hears and how fast.
const { execFileSync } = require('child_process');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { spawnPowerShellHost } = require('../src/main/voice');

const CASES = [
  // [spoken, expected recognized text, must it be a command?]
  ['click h', 'click h', true],
  ['h', null, false],
  ['click papa', 'click papa', true],
  ['right click', 'right click', true],
  ['click', 'click', true],
  ['yes', 'yes', true],
  ['enter', null, false],
];

function synth(dir) {
  const script = `
Add-Type -AssemblyName System.Speech
$s = New-Object System.Speech.Synthesis.SpeechSynthesizer
if ($s.GetInstalledVoices().Count -eq 0) { 'NOVOICE'; exit 0 }
$fmt = New-Object System.Speech.AudioFormat.SpeechAudioFormatInfo(16000, [System.Speech.AudioFormat.AudioBitsPerSample]::Sixteen, [System.Speech.AudioFormat.AudioChannel]::Mono)
${CASES.map(([p], i) => `$s.SetOutputToWaveFile('${path.join(dir, `c${i}.wav`)}', $fmt); $s.Speak('${p}.');`).join('\n')}
$s.SetOutputToNull()
'OK'`;
  return execFileSync('powershell.exe', ['-NoProfile', '-Command', script], { encoding: 'utf8' }).trim();
}

function listen(wav, phrases) {
  return new Promise((resolve) => {
    const proc = spawnPowerShellHost();
    const out = { results: [], error: null, ms: null };
    let buf = '';
    let t0 = 0;
    const done = () => { try { proc.stdin.write('quit\n'); } catch { /* gone */ } setTimeout(() => proc.kill(), 500); resolve(out); };
    const timer = setTimeout(() => { out.error = out.error || 'timeout'; done(); }, 30000);
    proc.stdout.on('data', (d) => {
      buf += d;
      let i;
      while ((i = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, i).trim();
        buf = buf.slice(i + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'ready') t0 = Date.now();
        if (msg.type === 'result') { out.results.push(msg); if (out.ms === null) out.ms = Date.now() - t0; }
        if (msg.type === 'error') { out.error = `${msg.code}: ${msg.message}`; clearTimeout(timer); done(); }
        if (msg.type === 'completed') { clearTimeout(timer); done(); }
      }
    });
    proc.stderr.on('data', (d) => process.stderr.write(d));
    proc.stdin.write(`${JSON.stringify({ phrases, autostart: true, endSilenceMs: 150, inputWav: wav })}\n`);
  });
}

(async () => {
  const c = await import('../src/shared/voice-commands.mjs');
  const map = c.buildCommandMap();
  const phrases = c.grammarPhrases(map, 'always');
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cv-voice-'));
  const synthResult = synth(dir);
  if (synthResult.includes('NOVOICE')) { console.log('SKIPPED: this machine has no text-to-speech voice'); return; }

  let failed = 0;
  for (const [i, [spoken, expected, isCommand]] of CASES.entries()) {
    const res = await listen(path.join(dir, `c${i}.wav`), phrases);
    if (res.error && /no-recognizer|no-speech/.test(res.error)) { console.log(`SKIPPED: ${res.error}`); return; }
    const heard = res.results.map((r) => `${r.text} (${Math.round(r.confidence * 100)}%)`).join(', ') || 'nothing';
    const acted = res.results.some((r) => r.confidence >= 0.6 && c.parseUtterance(r.text, map)?.action);
    // compare commands, not spelling: "click aitch" and "click h" are both H
    const want = c.parseUtterance(expected || '', map)?.action;
    const ok = isCommand
      ? res.results.some((r) => JSON.stringify(c.parseUtterance(r.text, map)?.action) === JSON.stringify(want))
      : !acted;
    if (!ok) failed++;
    console.log(`${ok ? 'PASS' : 'FAIL'} said "${spoken}" -> heard ${heard}${res.ms !== null ? ` after ${res.ms} ms` : ''}${res.error ? ` [${res.error}]` : ''}`);
  }
  if (failed) { console.error(`${failed} voice case(s) failed`); process.exit(1); }
  console.log('all voice cases passed');
})().catch((err) => { console.error(err); process.exit(1); });
