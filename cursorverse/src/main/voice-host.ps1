# CursorVerse voice host. Runs Windows' offline speech recognizer with a fixed
# phrase list (fast + accurate) and prints JSON lines to stdout.
# stdin: first line = {"phrases":[...],"autostart":true}; later lines: start | stop | quit
$ErrorActionPreference = 'Stop'
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
} catch {
  Send @{ type = 'error'; code = 'no-speech'; message = $_.Exception.Message }
  exit 2
}

try {
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

$config = [Console]::In.ReadLine() | ConvertFrom-Json
$engine = New-Object System.Speech.Recognition.SpeechRecognitionEngine($info)
try {
  $engine.SetInputToDefaultAudioDevice()
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

Register-ObjectEvent -InputObject $engine -EventName SpeechRecognized -SourceIdentifier cvRec | Out-Null
Register-ObjectEvent -InputObject $engine -EventName AudioLevelUpdated -SourceIdentifier cvLevel | Out-Null

$running = $false
function StartRec { if (-not $script:running) { $engine.RecognizeAsync([System.Speech.Recognition.RecognizeMode]::Multiple); $script:running = $true; Send @{ type = 'state'; listening = $true } } }
function StopRec { if ($script:running) { $engine.RecognizeAsyncStop(); $script:running = $false; Send @{ type = 'state'; listening = $false } } }

Send @{ type = 'ready'; culture = $info.Culture.Name; recognizer = $info.Description; phrases = $config.phrases.Count }
if ($config.autostart) { StartRec }

$lineTask = [Console]::In.ReadLineAsync()
$lastLevel = [DateTime]::MinValue
# Wait-Event only takes whole seconds, so poll the event queue with a short sleep
# instead: results arrive within ~15 ms and the loop stays near 0% CPU.
while ($true) {
  foreach ($ev in @(Get-Event)) {
    if ($ev.SourceIdentifier -eq 'cvRec') {
      $r = $ev.SourceEventArgs.Result
      Send @{ type = 'result'; text = $r.Text; confidence = [Math]::Round($r.Confidence, 3) }
    } elseif ($ev.SourceIdentifier -eq 'cvLevel') {
      $now = [DateTime]::UtcNow
      if (($now - $lastLevel).TotalMilliseconds -ge 120) {
        $lastLevel = $now
        Send @{ type = 'level'; level = $ev.SourceEventArgs.AudioLevel }
      }
    }
    Remove-Event -EventIdentifier $ev.EventIdentifier
  }
  if ($lineTask.IsCompleted) {
    $line = $lineTask.Result
    if ($null -eq $line -or $line -eq 'quit') { break }
    if ($line -eq 'start') { StartRec }
    elseif ($line -eq 'stop') { StopRec }
    $lineTask = [Console]::In.ReadLineAsync()
  } else {
    Start-Sleep -Milliseconds 15
  }
}
try { $engine.RecognizeAsyncCancel() } catch {}
$engine.Dispose()
