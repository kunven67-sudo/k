# CursorVerse voice host. Runs Windows' offline speech recognizer with a fixed
# phrase list (fast + accurate) and prints JSON lines to stdout.
# stdin: first line = config JSON; later lines: start | stop | quit
#   config: { phrases: [...], autostart, endSilenceMs, ignoreTalk, talkWeight, inputWav }
#
# Speech events are handled in a small C# class. PowerShell's own event queue was
# too slow for the dozens of audio-level events per second, so recognition
# results got stuck behind them and showed up a minute late.
$ErrorActionPreference = 'Stop'
$ProgressPreference = 'SilentlyContinue'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::InputEncoding = [System.Text.Encoding]::UTF8

function Send($obj) {
  [Console]::Out.WriteLine(($obj | ConvertTo-Json -Compress))
  [Console]::Out.Flush()
}

# Anything unexpected is reported to the app as a readable error, then we stop.
trap {
  Send @{ type = 'error'; code = 'crash'; message = $_.Exception.Message }
  exit 5
}

try {
  Add-Type -AssemblyName System.Speech
  $recognizers = [System.Speech.Recognition.SpeechRecognitionEngine]::InstalledRecognizers()
} catch {
  Send @{ type = 'error'; code = 'no-speech'; message = $_.Exception.Message }
  exit 2
}
if ($recognizers.Count -eq 0) {
  Send @{ type = 'error'; code = 'no-recognizer'; message = 'No speech recognizer is installed.' }
  exit 3
}
$info = $recognizers | Where-Object { $_.Culture.Name -like 'en-*' } | Select-Object -First 1
if (-not $info) { $info = $recognizers[0] }

$source = @'
using System;
using System.Collections.Generic;
using System.Globalization;
using System.Speech.Recognition;
using System.Text;
using System.Threading;
using Microsoft.Win32;

public static class CvVoice {
  static readonly object Gate = new object();
  static DateTime lastLevel = DateTime.MinValue;
  static Timer micTimer;
  static string lastMic = null;

  public static void Send(string json) {
    lock (Gate) { Console.Out.WriteLine(json); Console.Out.Flush(); }
  }

  static string Esc(string s) {
    var sb = new StringBuilder();
    foreach (char c in s ?? "") {
      if (c == '"' || c == '\\') sb.Append('\\').Append(c);
      else if (c < 32) sb.Append("\\u").Append(((int)c).ToString("x4"));
      else sb.Append(c);
    }
    return sb.ToString();
  }

  static string Num(float f) { return f.ToString("0.###", CultureInfo.InvariantCulture); }

  public static void Hook(SpeechRecognitionEngine e) {
    e.SpeechRecognized += (s, a) => {
      var r = a.Result;
      var sb = new StringBuilder();
      string grammar = r.Grammar != null ? r.Grammar.Name : "";
      sb.Append("{\"type\":\"result\",\"text\":\"").Append(Esc(r.Text))
        .Append("\",\"grammar\":\"").Append(Esc(grammar))
        .Append("\",\"confidence\":").Append(Num(r.Confidence)).Append(",\"words\":[");
      for (int i = 0; i < r.Words.Count; i++) {
        if (i > 0) sb.Append(',');
        sb.Append("{\"t\":\"").Append(Esc(r.Words[i].Text)).Append("\",\"c\":").Append(Num(r.Words[i].Confidence)).Append('}');
      }
      sb.Append("]}");
      Send(sb.ToString());
    };
    e.AudioLevelUpdated += (s, a) => {
      var now = DateTime.UtcNow;
      if ((now - lastLevel).TotalMilliseconds < 120) return;
      lastLevel = now;
      Send("{\"type\":\"level\",\"level\":" + a.AudioLevel + "}");
    };
    e.RecognizeCompleted += (s, a) => Send("{\"type\":\"completed\"}");
  }

  // Windows records which apps are using the microphone right now (that is what
  // lights up the mic icon in the taskbar). An app is using it while its
  // LastUsedTimeStop is 0. We skip ourselves (powershell.exe hosts this).
  public static void WatchMic() {
    micTimer = new Timer(_ => {
      try {
        var apps = new List<string>();
        const string root = @"Software\Microsoft\Windows\CurrentVersion\CapabilityAccessManager\ConsentStore\microphone";
        using (var key = Registry.CurrentUser.OpenSubKey(root)) {
          if (key != null) {
            Collect(key, apps, false);
            using (var np = key.OpenSubKey("NonPackaged")) { if (np != null) Collect(np, apps, true); }
          }
        }
        apps.Sort();
        string now = string.Join("|", apps.ToArray());
        if (now == lastMic) return;
        lastMic = now;
        var sb = new StringBuilder("{\"type\":\"mic\",\"apps\":[");
        for (int i = 0; i < apps.Count; i++) { if (i > 0) sb.Append(','); sb.Append('"').Append(Esc(apps[i])).Append('"'); }
        sb.Append("]}");
        Send(sb.ToString());
      } catch { }
    }, null, 0, 1000);
  }

  static void Collect(RegistryKey parent, List<string> apps, bool nonPackaged) {
    foreach (var name in parent.GetSubKeyNames()) {
      if (name == "NonPackaged") continue;
      string lower = name.ToLowerInvariant();
      if (lower.Contains("powershell.exe") || lower.Contains("cursorverse")) continue;
      using (var k = parent.OpenSubKey(name)) {
        if (k == null) continue;
        object start = k.GetValue("LastUsedTimeStart");
        object stop = k.GetValue("LastUsedTimeStop");
        if (start == null || stop == null) continue;
        if (Convert.ToInt64(start) == 0 || Convert.ToInt64(stop) != 0) continue;
        string label = name;
        if (nonPackaged) {
          label = name.Substring(name.LastIndexOf('#') + 1);
          if (label.EndsWith(".exe", StringComparison.OrdinalIgnoreCase)) label = label.Substring(0, label.Length - 4);
        } else {
          int us = label.IndexOf('_');
          if (us > 0) label = label.Substring(0, us);
          int dot = label.LastIndexOf('.');
          if (dot >= 0) label = label.Substring(dot + 1);
        }
        if (!apps.Contains(label)) apps.Add(label);
      }
    }
  }
}
'@

# Compiling the C# takes a second or two, so keep the compiled DLL and reuse it.
$speechDll = [System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location
$sha = [System.Security.Cryptography.SHA1]::Create()
$hash = ([BitConverter]::ToString($sha.ComputeHash([System.Text.Encoding]::UTF8.GetBytes($source)))).Replace('-', '').Substring(0, 12)
$dll = Join-Path $env:TEMP "cursorverse-voice-$hash.dll"
$loaded = $false
try {
  if (-not (Test-Path $dll)) {
    Add-Type -ReferencedAssemblies $speechDll -TypeDefinition $source -OutputAssembly $dll -OutputType Library
  }
  Add-Type -Path $dll
  $loaded = $true
} catch { }
if (-not $loaded -and -not ('CvVoice' -as [type])) {
  Add-Type -ReferencedAssemblies $speechDll -TypeDefinition $source
}

$config = [Console]::In.ReadLine() | ConvertFrom-Json
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
try {
  if ($config.inputWav) { $engine.SetInputToWaveFile([string]$config.inputWav) }
  else { $engine.SetInputToDefaultAudioDevice() }
} catch {
  Send @{ type = 'error'; code = 'no-mic'; message = $_.Exception.Message }
  exit 4
}

$choices = New-Object System.Speech.Recognition.Choices
foreach ($p in $config.phrases) { [void]$choices.Add([string]$p) }
$builder = New-Object System.Speech.Recognition.GrammarBuilder
$builder.Culture = $info.Culture
$builder.Append($choices)
$commands = New-Object System.Speech.Recognition.Grammar($builder)
$commands.Name = 'commands'
$engine.LoadGrammar($commands)

# Normal talking: a dictation grammar competes with the commands, so full
# sentences land there (and get ignored) instead of being squeezed into the
# closest command.
$talk = $false
if ($config.ignoreTalk) {
  try {
    $dict = New-Object System.Speech.Recognition.DictationGrammar
    $dict.Name = 'talk'
    $w = [double]$config.talkWeight
    if ($w -gt 0 -and $w -le 1) { $dict.Weight = [float]$w }
    $engine.LoadGrammar($dict)
    $talk = $true
  } catch { }
}

# Short silence windows = the result arrives right after you stop talking.
$engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds([int]$config.endSilenceMs)
$engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds([int]$config.endSilenceMs + 150)
$engine.InitialSilenceTimeout = [TimeSpan]::Zero
$engine.BabbleTimeout = [TimeSpan]::Zero
[CvVoice]::Hook($engine)
if (-not $config.inputWav) { [CvVoice]::WatchMic() }

$running = $false
function Out($obj) { [CvVoice]::Send(($obj | ConvertTo-Json -Compress)) }
function StartRec { if (-not $script:running) { $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple); $script:running = $true; Out @{ type = 'state'; listening = $true } } }
function StopRec { if ($script:running) { $engine.RecognizeAsyncStop(); $script:running = $false; Out @{ type = 'state'; listening = $false } } }

Out @{ type = 'ready'; culture = $info.Culture.Name; recognizer = $info.Description; phrases = $config.phrases.Count; talkFilter = $talk }
if ($config.autostart) { StartRec }

# Speech events run on their own threads, so this loop can just wait for stdin.
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq 'quit') { break }
  if ($line -eq 'start') { StartRec }
  elseif ($line -eq 'stop') { StopRec }
}
try { $engine.RecognizeAsyncCancel() } catch {}
$engine.Dispose()
