# BATTLESTATION scanner. It only READS things so the game can copy them:
# taskbar pins, open apps, Start menu apps, desktop shortcuts, wallpaper, theme colors,
# installed Steam / Epic games (+ covers), and your PC parts. It writes ONE file
# (battlestation-mypc.js) and sends nothing anywhere.
$ErrorActionPreference = 'SilentlyContinue'
$ProgressPreference = 'SilentlyContinue'
$Host.UI.RawUI.WindowTitle = 'BATTLESTATION scanner'
Write-Host ''
Write-Host '  BATTLESTATION scanner' -ForegroundColor Cyan
Write-Host '  Reading your taskbar, apps, games, wallpaper and parts. Nothing gets changed or uploaded.'
Write-Host ''
Add-Type -AssemblyName System.Drawing

$cs = @'
using System;
using System.Runtime.InteropServices;
public static class BsIcon {
  [ComImport, Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
  interface IShellItemImageFactory { [PreserveSig] int GetImage(SIZE size, int flags, out IntPtr phbm); }
  [StructLayout(LayoutKind.Sequential)] struct SIZE { public int cx; public int cy; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAP { public int bmType; public int bmWidth; public int bmHeight; public int bmWidthBytes; public ushort bmPlanes; public ushort bmBitsPixel; public IntPtr bmBits; }
  [StructLayout(LayoutKind.Sequential)] struct BITMAPINFOHEADER { public uint biSize; public int biWidth; public int biHeight; public ushort biPlanes; public ushort biBitCount; public uint biCompression; public uint biSizeImage; public int biXPelsPerMeter; public int biYPelsPerMeter; public uint biClrUsed; public uint biClrImportant; }
  [StructLayout(LayoutKind.Sequential)] struct DIBSECTION { public BITMAP dsBm; public BITMAPINFOHEADER dsBmih; public uint ds0; public uint ds1; public uint ds2; public IntPtr dshSection; public uint dsOffset; }
  [DllImport("shell32.dll", CharSet = CharSet.Unicode)]
  static extern int SHCreateItemFromParsingName(string path, IntPtr pbc, ref Guid riid, [MarshalAs(UnmanagedType.Interface)] out IShellItemImageFactory ppv);
  [DllImport("gdi32.dll")] static extern int GetObject(IntPtr h, int c, ref DIBSECTION b);
  [DllImport("gdi32.dll")] static extern bool DeleteObject(IntPtr h);
  // Returns BGRA pixels (top-down) of the shell icon for any path or shell:AppsFolder\AUMID.
  public static byte[] Get(string path, int size, int flags, out int w, out int h) {
    w = 0; h = 0;
    Guid iid = new Guid("bcc18b79-ba16-442f-80c4-8a59c30c463b");
    IShellItemImageFactory f;
    if (SHCreateItemFromParsingName(path, IntPtr.Zero, ref iid, out f) != 0 || f == null) return null;
    SIZE s; s.cx = size; s.cy = size;
    IntPtr hbm;
    if (f.GetImage(s, flags, out hbm) != 0 || hbm == IntPtr.Zero) return null;
    try {
      DIBSECTION ds = new DIBSECTION();
      GetObject(hbm, Marshal.SizeOf(typeof(DIBSECTION)), ref ds);
      BITMAP b = ds.dsBm;
      if (b.bmBits == IntPtr.Zero || b.bmBitsPixel != 32) return null;
      bool bottomUp = ds.dsBmih.biHeight > 0;
      w = b.bmWidth; h = Math.Abs(b.bmHeight);
      byte[] raw = new byte[b.bmWidthBytes * h];
      Marshal.Copy(b.bmBits, raw, 0, raw.Length);
      // bottom-up DIBs store the last row first: flip so row 0 is the top
      byte[] o = new byte[w * h * 4];
      for (int y = 0; y < h; y++) Array.Copy(raw, (bottomUp ? h - 1 - y : y) * b.bmWidthBytes, o, y * w * 4, w * 4);
      // un-premultiply alpha
      for (int i = 0; i < o.Length; i += 4) {
        int a = o[i + 3];
        if (a > 0 && a < 255) { o[i] = (byte)Math.Min(255, o[i] * 255 / a); o[i + 1] = (byte)Math.Min(255, o[i + 1] * 255 / a); o[i + 2] = (byte)Math.Min(255, o[i + 2] * 255 / a); }
      }
      return o;
    } finally { DeleteObject(hbm); }
  }
}
'@
$haveShellIcons = $true
try { Add-Type -TypeDefinition $cs -Language CSharp } catch { $haveShellIcons = $false }

function PngB64([System.Drawing.Bitmap]$bmp) {
  $ms = New-Object IO.MemoryStream
  $bmp.Save($ms, [System.Drawing.Imaging.ImageFormat]::Png)
  [Convert]::ToBase64String($ms.ToArray())
}
function JpgB64([System.Drawing.Image]$img, [int]$maxW, [int]$maxH, [int]$q) {
  $s = [Math]::Min(1.0, [Math]::Min($maxW / $img.Width, $maxH / $img.Height))
  $w = [Math]::Max(1, [int]($img.Width * $s)); $h = [Math]::Max(1, [int]($img.Height * $s))
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
  $g.DrawImage($img, 0, 0, $w, $h); $g.Dispose()
  $enc = [System.Drawing.Imaging.ImageCodecInfo]::GetImageEncoders() | Where-Object { $_.MimeType -eq 'image/jpeg' }
  $ep = New-Object System.Drawing.Imaging.EncoderParameters 1
  $ep.Param[0] = New-Object System.Drawing.Imaging.EncoderParameter ([System.Drawing.Imaging.Encoder]::Quality), ([long]$q)
  $ms = New-Object IO.MemoryStream
  $bmp.Save($ms, $enc, $ep); $bmp.Dispose()
  [Convert]::ToBase64String($ms.ToArray())
}
# Icon of a file / shortcut / app as a base64 PNG
function IconOf([string]$path, [int]$size = 48) {
  if (-not $path) { return $null }
  if ($haveShellIcons) {
    try {
      $w = 0; $h = 0
      $px = [BsIcon]::Get($path, $size, 5, [ref]$w, [ref]$h)  # 5 = BIGGERSIZEOK | ICONONLY
      if ($px -and $w -gt 0) {
        $bmp = New-Object System.Drawing.Bitmap $w, $h, ([System.Drawing.Imaging.PixelFormat]::Format32bppArgb)
        $rect = New-Object System.Drawing.Rectangle 0, 0, $w, $h
        $data = $bmp.LockBits($rect, [System.Drawing.Imaging.ImageLockMode]::WriteOnly, $bmp.PixelFormat)
        [Runtime.InteropServices.Marshal]::Copy($px, 0, $data.Scan0, $px.Length)
        $bmp.UnlockBits($data)
        if ($w -ne $size) {
          $sm = New-Object System.Drawing.Bitmap $size, $size
          $g = [System.Drawing.Graphics]::FromImage($sm)
          $g.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
          $g.DrawImage($bmp, 0, 0, $size, $size); $g.Dispose(); $bmp.Dispose(); $bmp = $sm
        }
        $r = PngB64 $bmp; $bmp.Dispose(); return $r
      }
    } catch { }
  }
  try {
    if (Test-Path -LiteralPath $path) {
      $ico = [System.Drawing.Icon]::ExtractAssociatedIcon($path)
      if ($ico) { $b = $ico.ToBitmap(); $r = PngB64 $b; $b.Dispose(); return $r }
    }
  } catch { }
  return $null
}
function RegVal($key, $name) { try { (Get-ItemProperty -LiteralPath $key -Name $name -ErrorAction Stop).$name } catch { $null } }

$shell = New-Object -ComObject WScript.Shell
function LnkTarget([string]$lnk) { try { $s = $shell.CreateShortcut($lnk); return $s.TargetPath } catch { return $null } }

$R = [ordered]@{ v = 1; made = (Get-Date).ToString('o') }

# ---------------------------------------------------------------- you + theme
Write-Host '  - you, your theme and wallpaper'
$full = $null
try { $full = (Get-CimInstance Win32_UserAccount -Filter ("Name='" + $env:USERNAME + "' AND LocalAccount=True")).FullName } catch { }
$R.user = [ordered]@{ name = $env:USERNAME; full = $full }
try {
  $sid = ([Security.Principal.WindowsIdentity]::GetCurrent()).User.Value
  $pic = Get-ChildItem -LiteralPath ("C:\Users\Public\AccountPictures\" + $sid) -File | Where-Object { $_.Extension -match 'jpg|png|jpeg' } | Sort-Object Length -Descending | Select-Object -First 1
  if ($pic) { $img = [System.Drawing.Image]::FromFile($pic.FullName); $R.user.pic = JpgB64 $img 160 160 85; $img.Dispose() }
} catch { }
$build = [int](RegVal 'HKLM:\SOFTWARE\Microsoft\Windows NT\CurrentVersion' 'CurrentBuildNumber')
$personal = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Themes\Personalize'
$adv = 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Advanced'
$al = RegVal $adv 'TaskbarAl'
$accent = RegVal 'HKCU:\Software\Microsoft\Windows\DWM' 'AccentColor'
$accHex = $null
if ($accent -ne $null) { $a = [uint32]('0x{0:X8}' -f $accent); $accHex = '#{0:x2}{1:x2}{2:x2}' -f ($a -band 0xFF), (($a -shr 8) -band 0xFF), (($a -shr 16) -band 0xFF) }
$R.theme = [ordered]@{
  win = $(if ($build -ge 22000) { 11 } else { 10 })
  dark = ((RegVal $personal 'SystemUsesLightTheme') -eq 0)
  appsDark = ((RegVal $personal 'AppsUseLightTheme') -eq 0)
  accent = $accHex
  align = $(if ($build -ge 22000 -and $al -ne 0) { 'center' } else { 'left' })
  clock24 = -not ((Get-Culture).DateTimeFormat.ShortTimePattern -cmatch 'h')
}
$R.computer = $env:COMPUTERNAME

# wallpaper (the real image file, or what Windows made from it)
$wp = RegVal 'HKCU:\Control Panel\Desktop' 'WallPaper'
$cands = @($wp, (Join-Path $env:APPDATA 'Microsoft\Windows\Themes\TranscodedWallpaper'))
foreach ($c in $cands) {
  if ($c -and (Test-Path -LiteralPath $c)) {
    try { $img = [System.Drawing.Image]::FromFile($c); $R.wallpaper = JpgB64 $img 1920 1080 84; $img.Dispose(); break } catch { }
  }
}
$bg = RegVal 'HKCU:\Control Panel\Colors' 'Background'
if ($bg) { $p = $bg -split ' '; if ($p.Count -eq 3) { $R.wallpaperColor = '#{0:x2}{1:x2}{2:x2}' -f [int]$p[0], [int]$p[1], [int]$p[2] } }

# ---------------------------------------------------------------- Start menu apps (name -> app id)
Write-Host '  - Start menu apps'
$startApps = @()
try { $startApps = @(Get-StartApps) } catch { }
$byId = @{}
foreach ($a in $startApps) { if ($a.AppID) { $byId[$a.AppID.ToLower()] = $a.Name } }

# ---------------------------------------------------------------- taskbar pins (in their real order)
Write-Host '  - taskbar'
$pinDir = Join-Path $env:APPDATA 'Microsoft\Internet Explorer\Quick Launch\User Pinned\TaskBar'
$lnks = @(Get-ChildItem -LiteralPath $pinDir -Filter *.lnk)
$fav = RegVal 'HKCU:\Software\Microsoft\Windows\CurrentVersion\Explorer\Taskband' 'Favorites'
$favText = ''
if ($fav) { $favText = [Text.Encoding]::Unicode.GetString([byte[]]$fav) }
$pins = @()
foreach ($l in $lnks) {
  $at = $favText.IndexOf($l.Name)
  if ($at -lt 0) { $at = 100000 + $pins.Count }
  $pins += [pscustomobject]@{ at = $at; name = [IO.Path]::GetFileNameWithoutExtension($l.Name); path = $l.FullName; target = (LnkTarget $l.FullName) }
}
# Store apps pinned on Windows 11 live only inside Favorites as app ids (Name_hash!App)
foreach ($m in [regex]::Matches($favText, '[A-Za-z0-9.\-]+_[a-z0-9]{13}![A-Za-z0-9.\-]+')) {
  $id = $m.Value
  $name = $byId[$id.ToLower()]
  if ($name -and -not ($pins | Where-Object { $_.name -eq $name })) { $pins += [pscustomobject]@{ at = $m.Index; name = $name; aumid = $id } }
}
$R.pins = @($pins | Sort-Object at | ForEach-Object {
  $ic = if ($_.aumid) { IconOf ('shell:AppsFolder\' + $_.aumid) 48 } else { IconOf $_.path 48 }
  [ordered]@{ name = $_.name; target = $_.target; aumid = $_.aumid; icon = $ic }
})

# ---------------------------------------------------------------- open apps (windows on screen right now)
Write-Host '  - open apps'
$seen = @{}
$R.open = @(Get-Process | Where-Object { $_.MainWindowHandle -ne 0 -and $_.MainWindowTitle } | ForEach-Object {
  $n = $_.Description; if (-not $n) { $n = $_.ProcessName }
  if ($seen[$n] -or $_.ProcessName -match '^(TextInputHost|ApplicationFrameHost|SystemSettings|ShellExperienceHost|cmd|powershell|conhost|WindowsTerminal)$') { return }
  $seen[$n] = 1
  $p = $null; try { $p = $_.Path } catch { }
  [ordered]@{ name = $n; title = $_.MainWindowTitle; exe = $_.ProcessName; icon = (IconOf $p 48) }
} | Select-Object -First 16)

# ---------------------------------------------------------------- Start menu (first 150 apps, with icons)
$R.start = @($startApps | Where-Object { $_.Name -notmatch 'uninstall|readme|help|documentation|release notes|website' } | Select-Object -First 150 | ForEach-Object {
  [ordered]@{ name = $_.Name; id = $_.AppID; icon = (IconOf ('shell:AppsFolder\' + $_.AppID) 48) }
})

# ---------------------------------------------------------------- desktop
Write-Host '  - desktop'
$desk = @()
foreach ($d in @([Environment]::GetFolderPath('Desktop'), [Environment]::GetFolderPath('CommonDesktopDirectory'))) {
  if ($d -and (Test-Path -LiteralPath $d)) { $desk += @(Get-ChildItem -LiteralPath $d | Where-Object { $_.Name -ne 'desktop.ini' -and -not $_.Attributes.ToString().Contains('Hidden') }) }
}
$R.desktop = @($desk | Select-Object -First 60 | ForEach-Object {
  $kind = if ($_.PSIsContainer) { 'folder' } elseif ($_.Extension -match '^\.(lnk|url)$') { 'lnk' } else { 'file' }
  $nm = if ($kind -eq 'lnk') { [IO.Path]::GetFileNameWithoutExtension($_.Name) } else { $_.Name }
  $tg = if ($_.Extension -eq '.lnk') { LnkTarget $_.FullName } else { $null }
  [ordered]@{ name = $nm; kind = $kind; ext = $_.Extension.ToLower(); target = $tg; size = $(if ($_.PSIsContainer) { 0 } else { $_.Length }); icon = (IconOf $_.FullName 48) }
})

# ---------------------------------------------------------------- Steam games
Write-Host '  - Steam games'
$steam = RegVal 'HKCU:\Software\Valve\Steam' 'SteamPath'
$R.steam = @()
if ($steam -and (Test-Path -LiteralPath $steam)) {
  $steam = $steam -replace '/', '\'
  $libs = @($steam)
  $vdf = Join-Path $steam 'steamapps\libraryfolders.vdf'
  if (Test-Path -LiteralPath $vdf) { foreach ($m in [regex]::Matches((Get-Content -LiteralPath $vdf -Raw), '"path"\s+"([^"]+)"')) { $libs += ($m.Groups[1].Value -replace '\\\\', '\') } }
  $games = @()
  foreach ($lib in ($libs | Select-Object -Unique)) {
    foreach ($acf in @(Get-ChildItem -LiteralPath (Join-Path $lib 'steamapps') -Filter 'appmanifest_*.acf')) {
      $t = Get-Content -LiteralPath $acf.FullName -Raw
      $id = [regex]::Match($t, '"appid"\s+"(\d+)"').Groups[1].Value
      $nm = [regex]::Match($t, '"name"\s+"([^"]+)"').Groups[1].Value
      if (-not $id -or $id -eq '228980' -or $nm -match 'Proton|Steam Linux Runtime|Steamworks Common|SteamVR') { continue }
      $games += [pscustomobject]@{ appid = $id; name = $nm; size = [int64]([regex]::Match($t, '"SizeOnDisk"\s+"(\d+)"').Groups[1].Value); last = [int64]([regex]::Match($t, '"LastPlayed"\s+"(\d+)"').Groups[1].Value) }
    }
  }
  $cache = Join-Path $steam 'appcache\librarycache'
  $R.steam = @($games | Sort-Object last -Descending | Select-Object -First 80 | ForEach-Object {
    $cover = $null
    $f = @(Get-ChildItem -LiteralPath (Join-Path $cache $_.appid) -Recurse -Filter 'library_600x900*.jpg') + @(Get-ChildItem -LiteralPath $cache -Filter ($_.appid + '_library_600x900*.jpg'))
    $f = @($f | Where-Object { $_ }) | Select-Object -First 1
    if (-not $f) { $f = @(Get-ChildItem -LiteralPath (Join-Path $cache $_.appid) -Recurse -Filter 'header*.jpg') + @(Get-ChildItem -LiteralPath $cache -Filter ($_.appid + '_header.jpg')) | Where-Object { $_ } | Select-Object -First 1 }
    if ($f) { try { $img = [System.Drawing.Image]::FromFile($f.FullName); $cover = JpgB64 $img 200 300 80; $img.Dispose() } catch { } }
    [ordered]@{ appid = $_.appid; name = $_.name; size = $_.size; lastPlayed = $_.last; cover = $cover }
  })
}

# ---------------------------------------------------------------- Epic games
Write-Host '  - Epic games'
$R.epic = @(Get-ChildItem -LiteralPath 'C:\ProgramData\Epic\EpicGamesLauncher\Data\Manifests' -Filter *.item | ForEach-Object {
  try {
    $j = Get-Content -LiteralPath $_.FullName -Raw | ConvertFrom-Json
    if ($j.bIsApplication -eq $false -or -not $j.DisplayName) { return }
    $exe = Join-Path $j.InstallLocation $j.LaunchExecutable
    [ordered]@{ name = $j.DisplayName; appName = $j.AppName; size = [int64]$j.InstallSize; icon = (IconOf $exe 48) }
  } catch { }
} | Select-Object -First 60)

# ---------------------------------------------------------------- parts
Write-Host '  - PC parts'
$cpu = Get-CimInstance Win32_Processor | Select-Object -First 1
$gpus = @(Get-CimInstance Win32_VideoController)
$gpu = $gpus | Where-Object { $_.Name -match 'NVIDIA|AMD|Radeon|Arc' } | Select-Object -First 1
if (-not $gpu) { $gpu = $gpus | Select-Object -First 1 }
$vram = 0
foreach ($k in @(Get-ChildItem 'HKLM:\SYSTEM\CurrentControlSet\Control\Class\{4d36e968-e325-11ce-bfc1-08002be10318}')) {
  $dd = RegVal $k.PSPath 'DriverDesc'
  $q = RegVal $k.PSPath 'HardwareInformation.qwMemorySize'
  if ($dd -and $gpu -and $dd -eq $gpu.Name -and $q) { $vram = [math]::Round([int64]$q / 1GB) }
}
if (-not $vram -and $gpu.AdapterRAM) { $vram = [math]::Round([int64][uint32]$gpu.AdapterRAM / 1GB) }
$sticks = @(Get-CimInstance Win32_PhysicalMemory | ForEach-Object { [ordered]@{ gb = [math]::Round($_.Capacity / 1GB); speed = $_.ConfiguredClockSpeed; maker = ($_.Manufacturer -replace '\s+$', ''); part = ($_.PartNumber -replace '\s+$', '') } })
$board = Get-CimInstance Win32_BaseBoard | Select-Object -First 1
$os = Get-CimInstance Win32_OperatingSystem
$models = @(Get-CimInstance Win32_DiskDrive | ForEach-Object { $_.Model })
$drives = @(Get-CimInstance Win32_LogicalDisk -Filter 'DriveType=3' | ForEach-Object { [ordered]@{ letter = $_.DeviceID; name = $(if ($_.VolumeName) { $_.VolumeName } else { 'Local Disk' }); size = [int64]$_.Size; free = [int64]$_.FreeSpace } })
if ($drives.Count -gt 0 -and $models.Count -gt 0) { $drives[0].model = $models[0] }
$net = 'ethernet'
try { $up = @(Get-NetAdapter -Physical | Where-Object { $_.Status -eq 'Up' }); if ($up.Count -gt 0 -and -not ($up | Where-Object { $_.MediaType -eq '802.3' })) { $net = 'wifi' } } catch { }
$R.hw = [ordered]@{
  cpu = ($cpu.Name -replace '\s+', ' ').Trim(); threads = $cpu.NumberOfLogicalProcessors; cores = $cpu.NumberOfCores
  gpu = $gpu.Name; vramGB = $vram
  ramGB = [math]::Round(($sticks | ForEach-Object { $_.gb } | Measure-Object -Sum).Sum); ramSticks = $sticks.Count; sticks = $sticks
  board = (($board.Manufacturer + ' ' + $board.Product) -replace '\s+', ' ').Trim()
  os = $os.Caption; osBuild = $build; computer = $env:COMPUTERNAME; drives = $drives; net = $net
}

# ---------------------------------------------------------------- write it
$json = $R | ConvertTo-Json -Depth 6 -Compress
$js = 'window.__BATTLESTATION_SCAN__=' + $json + ';'
$outDir = $env:BS_OUT
if (-not $outDir -or -not (Test-Path -LiteralPath $outDir)) { $outDir = Join-Path $env:USERPROFILE 'Downloads' }
$out = Join-Path $outDir 'battlestation-mypc.js'
try { [IO.File]::WriteAllText($out, $js, (New-Object Text.UTF8Encoding $false)) }
catch { $out = Join-Path (Join-Path $env:USERPROFILE 'Downloads') 'battlestation-mypc.js'; [IO.File]::WriteAllText($out, $js, (New-Object Text.UTF8Encoding $false)) }
Write-Host ''
Write-Host ('  Done. Found ' + $R.pins.Count + ' taskbar apps, ' + $R.desktop.Count + ' desktop items, ' + ($R.steam.Count + $R.epic.Count) + ' games.') -ForegroundColor Green
Write-Host ('  Saved: ' + $out)
if ($env:BS_AUTO -eq '1') {
  Write-Host '  Go back to BATTLESTATION: it picks this up by itself in a few seconds.'
} else {
  Write-Host '  Now drag that file onto the BATTLESTATION window (a folder with it just opened).'
  Start-Process explorer.exe ('/select,"' + $out + '"')
}
Write-Host ''
Write-Host '  Press any key to close.'
[void]$Host.UI.RawUI.ReadKey('NoEcho,IncludeKeyDown')
