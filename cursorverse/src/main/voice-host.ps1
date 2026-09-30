# CursorVerse voice host. Runs Windows' offline speech recognizer with a fixed
# phrase list (fast + accurate) and prints JSON lines to stdout.
# stdin: first line = {"phrases":[...],"autostart":true}; later lines: start | stop | quit
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

$speechDll = [System.Speech.Recognition.SpeechRecognitionEngine].Assembly.Location
Add-Type -ReferencedAssemblies $speechDll -TypeDefinition @'
using System;
using System.Globalization;
using System.Speech.Recognition;
using System.Text;

public static class CvVoice {
  static readonly object Gate = new object();
  static DateTime lastLevel = DateTime.MinValue;

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
      sb.Append("{\"type\":\"result\",\"text\":\"").Append(Esc(r.Text)).Append("\",\"confidence\":").Append(Num(r.Confidence)).Append(",\"words\":[");
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
}
'@

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
$engine.LoadGrammar((New-Object System.Speech.Recognition.Grammar($builder)))

# Short silence windows = the result arrives right after you stop talking.
$engine.EndSilenceTimeout = [TimeSpan]::FromMilliseconds([int]$config.endSilenceMs)
$engine.EndSilenceTimeoutAmbiguous = [TimeSpan]::FromMilliseconds([int]$config.endSilenceMs + 150)
$engine.InitialSilenceTimeout = [TimeSpan]::Zero
$engine.BabbleTimeout = [TimeSpan]::Zero
[CvVoice]::Hook($engine)

$running = $false
function Out($obj) { [CvVoice]::Send(($obj | ConvertTo-Json -Compress)) }
function StartRec { if (-not $script:running) { $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple); $script:running = $true; Out @{ type = 'state'; listening = $true } } }
function StopRec { if ($script:running) { $engine.RecognizeAsyncStop(); $script:running = $false; Out @{ type = 'state'; listening = $false } } }

Out @{ type = 'ready'; culture = $info.Culture.Name; recognizer = $info.Description; phrases = $config.phrases.Count }
if ($config.autostart) { StartRec }

# Speech events run on their own threads now, so this loop can just wait for stdin.
while ($true) {
  $line = [Console]::In.ReadLine()
  if ($null -eq $line -or $line -eq 'quit') { break }
  if ($line -eq 'start') { StartRec }
  elseif ($line -eq 'stop') { StopRec }
}
try { $engine.RecognizeAsyncCancel() } catch {}
$engine.Dispose()
