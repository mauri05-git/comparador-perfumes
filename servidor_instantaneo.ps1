param(
    [int]$Port = 5173,
    [string]$Root = "$PSScriptRoot\frontend\dist"
)

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)
try {
    $listener.Start()
} catch {
    Write-Host "El puerto $Port ya esta en uso (PerfumeScan ya esta corriendo)." -ForegroundColor Yellow
    Start-Process "http://localhost:$Port"
    exit 0
}

Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  PerfumeScan activo en: http://localhost:$Port" -ForegroundColor Green
Write-Host "  (No cierres esta ventana mientras uses la aplicacion)" -ForegroundColor Gray
Write-Host "========================================================" -ForegroundColor Cyan

Start-Process "http://localhost:$Port"

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".json" = "application/json; charset=utf-8"
    ".svg"  = "image/svg+xml"
    ".png"  = "image/png"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".webp" = "image/webp"
    ".ico"  = "image/x-icon"
}

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $reqUrl = $context.Request.Url.LocalPath
        if ($reqUrl -eq "/" -or [string]::IsNullOrWhiteSpace($reqUrl)) {
            $reqUrl = "/index.html"
        }
        $relativePath = $reqUrl.TrimStart('/').Replace('/', '\')
        $filePath = Join-Path $Root $relativePath

        if (-not (Test-Path $filePath -PathType Leaf)) {
            $filePath = Join-Path $Root "index.html"
        }

        if (Test-Path $filePath -PathType Leaf) {
            $ext = [System.IO.Path]::GetExtension($filePath).ToLower()
            $contentType = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
            $bytes = [System.IO.File]::ReadAllBytes($filePath)
            $context.Response.ContentType = $contentType
            $context.Response.ContentLength64 = $bytes.Length
            $context.Response.StatusCode = 200
            $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
        } else {
            $context.Response.StatusCode = 404
        }
        $context.Response.OutputStream.Close()
    } catch {
        break
    }
}
