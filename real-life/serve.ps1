# REAL LIFE local server (Windows). Browsers block 3D games opened straight from a folder,
# so this serves the game at http://localhost:8766 and opens it. Close this window to stop.
$port = 8766
$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$types = @{ '.html'='text/html'; '.js'='text/javascript'; '.mjs'='text/javascript'; '.css'='text/css'; '.json'='application/json';
  '.glb'='model/gltf-binary'; '.gltf'='model/gltf+json'; '.png'='image/png'; '.jpg'='image/jpeg'; '.svg'='image/svg+xml';
  '.wasm'='application/wasm'; '.bin'='application/octet-stream'; '.woff2'='font/woff2'; '.md'='text/plain' }
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$port/")
try { $listener.Start() } catch { Write-Host "Port $port is busy. REAL LIFE might already be running."; Start-Process "http://localhost:$port/"; exit }
Write-Host "REAL LIFE is running at http://localhost:$port/  (close this window to stop)"
Start-Process "http://localhost:$port/"
while ($listener.IsListening) {
  $ctx = $listener.GetContext()
  $path = [Uri]::UnescapeDataString($ctx.Request.Url.AbsolutePath.TrimStart('/'))
  if ($path -eq '') { $path = 'index.html' }
  $file = Join-Path $root $path
  $res = $ctx.Response
  if ((Test-Path $file -PathType Leaf) -and ([IO.Path]::GetFullPath($file).StartsWith($root))) {
    $ext = [IO.Path]::GetExtension($file).ToLower()
    $res.ContentType = $(if ($types.ContainsKey($ext)) { $types[$ext] } else { 'application/octet-stream' })
    $bytes = [IO.File]::ReadAllBytes($file)
    $res.ContentLength64 = $bytes.Length
    $res.OutputStream.Write($bytes, 0, $bytes.Length)
  } else { $res.StatusCode = 404 }
  $res.Close()
}
