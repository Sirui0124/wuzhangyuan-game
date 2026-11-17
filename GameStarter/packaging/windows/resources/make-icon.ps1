# Assemble Windows icon frames from the high-resolution lamp artwork.
# icon.png is the user-selected 1024px raster master (2026-11-02).
$ErrorActionPreference = 'Stop'
Add-Type -AssemblyName System.Drawing
$master = [System.Drawing.Image]::FromFile((Join-Path $PSScriptRoot 'icon.png'))
$frames = @()
try {
  foreach ($size in @(16,20,24,32,40,48,64,96,128,256)) {
    $bitmap = [System.Drawing.Bitmap]::new($size, $size)
    $graphics = [System.Drawing.Graphics]::FromImage($bitmap)
    try {
      $graphics.Clear([System.Drawing.Color]::Transparent)
      $graphics.CompositingQuality = [System.Drawing.Drawing2D.CompositingQuality]::HighQuality
      $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
      $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
      $graphics.DrawImage($master, [System.Drawing.Rectangle]::new(0,0,$size,$size))
      $stream = [System.IO.MemoryStream]::new()
      try { $bitmap.Save($stream, [System.Drawing.Imaging.ImageFormat]::Png); $frames += @{size=$size;data=$stream.ToArray()} }
      finally { $stream.Dispose() }
    } finally { $graphics.Dispose(); $bitmap.Dispose() }
  }
  $icoStream = [System.IO.MemoryStream]::new()
  $writer = [System.IO.BinaryWriter]::new($icoStream)
  try {
    $writer.Write([uint16]0); $writer.Write([uint16]1); $writer.Write([uint16]$frames.Count)
    $offset = 6 + 16 * $frames.Count
    foreach ($frame in $frames) {
      $dimension = if ($frame.size -eq 256) {0} else {$frame.size}
      $writer.Write([byte]$dimension); $writer.Write([byte]$dimension)
      $writer.Write([byte]0); $writer.Write([byte]0)
      $writer.Write([uint16]1); $writer.Write([uint16]32)
      $writer.Write([uint32]$frame.data.Length); $writer.Write([uint32]$offset)
      $offset += $frame.data.Length
    }
    foreach ($frame in $frames) { $writer.Write([byte[]]$frame.data) }
    [System.IO.File]::WriteAllBytes((Join-Path $PSScriptRoot 'icon.ico'), $icoStream.ToArray())
  } finally { $writer.Dispose(); $icoStream.Dispose() }
} finally { $master.Dispose() }
Write-Output 'Generated lamp icon: 16, 20, 24, 32, 40, 48, 64, 96, 128 and 256 pixels.'
