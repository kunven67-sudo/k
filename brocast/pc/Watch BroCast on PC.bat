<# : batch portion
@echo off
title BroCast on PC
set "BROCAST_BAT=%~f0"
powershell -NoProfile -ExecutionPolicy Bypass -Command "iex ([IO.File]::ReadAllText($env:BROCAST_BAT))"
exit /b
#>

# Finds the phone that's running BroCast on this Wi-Fi and opens it in Edge, full screen, with sound
# and the English voice allowed to start by themselves. Remembers the phone for next time.

$ErrorActionPreference = 'SilentlyContinue'
$port = 8080
$dir = Join-Path $env:LOCALAPPDATA 'BroCast'
New-Item -ItemType Directory -Force -Path $dir | Out-Null
$savedFile = Join-Path $dir 'phone.txt'

function Test-Phone([string]$ip) {
    try {
        $req = [System.Net.HttpWebRequest]::Create("http://${ip}:$port/status")
        $req.Timeout = 1500
        $req.ReadWriteTimeout = 1500
        $req.Proxy = $null
        $resp = $req.GetResponse()
        $reader = New-Object System.IO.StreamReader($resp.GetResponseStream())
        $text = $reader.ReadToEnd()
        $resp.Close()
        return ($text -like '*"app":"BroCast"*')
    } catch {
        return $false
    }
}

# The first three parts of this PC's Wi-Fi / network addresses (like 192.168.1).
function Get-Networks {
    $nets = @()
    foreach ($nic in [System.Net.NetworkInformation.NetworkInterface]::GetAllNetworkInterfaces()) {
        if ($nic.OperationalStatus -ne 'Up') { continue }
        if ($nic.NetworkInterfaceType -eq 'Loopback') { continue }
        foreach ($ua in $nic.GetIPProperties().UnicastAddresses) {
            if ($ua.Address.AddressFamily -ne 'InterNetwork') { continue }
            $s = $ua.Address.ToString()
            if ($s.StartsWith('127.') -or $s.StartsWith('169.254.')) { continue }
            $p = $s.Split('.')
            $nets += ($p[0] + '.' + $p[1] + '.' + $p[2])
        }
    }
    return ($nets | Select-Object -Unique)
}

# Knocks on every address of each network at once; the ones that answer get asked "are you BroCast?".
function Find-Phone {
    foreach ($net in Get-Networks) {
        $ips = @()
        $clients = @()
        $tasks = @()
        for ($i = 1; $i -le 254; $i++) {
            $ip = "$net.$i"
            $c = New-Object System.Net.Sockets.TcpClient
            $ips += $ip
            $clients += $c
            $tasks += $c.ConnectAsync($ip, $port)
        }
        try {
            [void][System.Threading.Tasks.Task]::WaitAll([System.Threading.Tasks.Task[]]$tasks, 1500)
        } catch {
            # Some addresses said no right away: fine, the others are checked below.
        }
        $open = @()
        for ($i = 0; $i -lt $clients.Count; $i++) {
            if ($clients[$i].Connected) { $open += $ips[$i] }
            $clients[$i].Close()
        }
        foreach ($ip in $open) {
            if (Test-Phone $ip) { return $ip }
        }
    }
    return $null
}

function Open-Edge([string]$url) {
    $candidates = @()
    if (${env:ProgramFiles(x86)}) { $candidates += (Join-Path ${env:ProgramFiles(x86)} 'Microsoft\Edge\Application\msedge.exe') }
    if ($env:ProgramFiles) { $candidates += (Join-Path $env:ProgramFiles 'Microsoft\Edge\Application\msedge.exe') }
    if ($env:LOCALAPPDATA) { $candidates += (Join-Path $env:LOCALAPPDATA 'Microsoft\Edge\Application\msedge.exe') }
    $edge = $null
    foreach ($e in $candidates) { if (Test-Path -LiteralPath $e) { $edge = $e; break } }
    # Its own Edge window (own settings folder), so the flags below always apply.
    $profileDir = Join-Path $dir 'edge'
    $edgeArgs = "--app=$url --start-fullscreen --autoplay-policy=no-user-gesture-required " +
        "--user-data-dir=`"$profileDir`" --no-first-run --no-default-browser-check"
    if ($edge) {
        Start-Process -FilePath $edge -ArgumentList $edgeArgs
    } else {
        Start-Process $url
    }
}

Write-Host ''
Write-Host '  BroCast on PC' -ForegroundColor Magenta
Write-Host '  Looking for your phone...'

$ip = $null
if (Test-Path -LiteralPath $savedFile) {
    $last = (Get-Content -LiteralPath $savedFile -Raw)
    if ($last) {
        $last = $last.Trim()
        if (Test-Phone $last) { $ip = $last }
    }
}

$deadline = (Get-Date).AddMinutes(3)
$told = $false
while (-not $ip -and (Get-Date) -lt $deadline) {
    $ip = Find-Phone
    if (-not $ip) {
        if (-not $told) {
            Write-Host ''
            Write-Host '  Open BroCast 2 on your phone (same Wi-Fi as this PC).' -ForegroundColor Yellow
            Write-Host '  This window keeps looking and opens it by itself.' -ForegroundColor Yellow
            $told = $true
        }
        Start-Sleep -Seconds 2
    }
}

if (-not $ip) {
    Add-Type -AssemblyName System.Windows.Forms
    [void][System.Windows.Forms.MessageBox]::Show(
        "Couldn't find your phone.`n`nOpen BroCast 2 on your phone, make sure it says LIVE and that the phone is on the same Wi-Fi as this PC, then open this file again.",
        'BroCast on PC')
    exit
}

Set-Content -LiteralPath $savedFile -Value $ip
Write-Host ''
Write-Host "  Found it! Opening your phone's screen..." -ForegroundColor Green
Open-Edge "http://${ip}:$port/"
Start-Sleep -Seconds 2
