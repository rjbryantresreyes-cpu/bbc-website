param(
  [int]$Port = 8765,
  [string]$Root = "G:\Shared drives\BBC Drive\BBC WEBSITE HTML"
)

Add-Type -AssemblyName System.Web

$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add("http://localhost:$Port/")
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://localhost:$Port/"

$mime = @{
  ".html"="text/html; charset=utf-8"; ".htm"="text/html; charset=utf-8"
  ".css"="text/css; charset=utf-8"; ".js"="application/javascript; charset=utf-8"
  ".json"="application/json"; ".svg"="image/svg+xml"
  ".png"="image/png"; ".jpg"="image/jpeg"; ".jpeg"="image/jpeg"
  ".gif"="image/gif"; ".webp"="image/webp"; ".ico"="image/x-icon"
  ".woff"="font/woff"; ".woff2"="font/woff2"; ".ttf"="font/ttf"
  ".mp4"="video/mp4"; ".webm"="video/webm"; ".txt"="text/plain; charset=utf-8"
  ".pdf"="application/pdf"
}

while ($listener.IsListening) {
  try {
    $ctx = $listener.GetContext()
    $req = $ctx.Request
    $res = $ctx.Response

    $rel = [System.Web.HttpUtility]::UrlDecode($req.Url.AbsolutePath).TrimStart('/')
    if ([string]::IsNullOrWhiteSpace($rel)) { $rel = "index.html" }

    $candidate = Join-Path $Root $rel

    if ((Test-Path $candidate -PathType Container)) {
      $candidate = Join-Path $candidate "index.html"
    }

    if (-not (Test-Path $candidate -PathType Leaf)) {
      $alt = "$candidate.html"
      if (Test-Path $alt -PathType Leaf) { $candidate = $alt }
    }

    if (Test-Path $candidate -PathType Leaf) {
      $ext = [System.IO.Path]::GetExtension($candidate).ToLower()
      $ct = $mime[$ext]; if (-not $ct) { $ct = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($candidate)
      $res.ContentType = $ct
      $res.ContentLength64 = $bytes.Length
      $res.OutputStream.Write($bytes, 0, $bytes.Length)
    } else {
      $res.StatusCode = 404
      $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rel")
      $res.ContentType = "text/plain; charset=utf-8"
      $res.OutputStream.Write($msg, 0, $msg.Length)
    }

    $res.OutputStream.Close()
  } catch {
    Write-Host "Error: $_"
  }
}
