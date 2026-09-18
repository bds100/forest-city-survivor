# 단색 배경 이미지를 투명 PNG 로 변환 (가장자리에서 번져 들어가며 배경색만 제거 → 여백 잘라내기 → 축소)
# 사용: powershell -ExecutionPolicy Bypass -File tools\cutout.ps1            (assets\raw\*.png|jpg → assets\chars\*.png)
param([string]$In = "$PSScriptRoot\..\assets\raw", [string]$Out = "$PSScriptRoot\..\assets\chars", [int]$Tol = 70, [int]$MaxH = 640)
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Runtime.InteropServices;
public static class Cutout {
  public static Bitmap Run(Bitmap src, int tol, int maxH) {
    int w = src.Width, h = src.Height; var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) g.DrawImage(src, 0, 0, w, h);
    var data = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadWrite, PixelFormat.Format32bppArgb);
    byte[] px = new byte[w * h * 4]; Marshal.Copy(data.Scan0, px, 0, px.Length);
    // 배경색 = 네 모서리 평균
    int[] cs = { 0, (w - 1), (h - 1) * w, (h - 1) * w + w - 1 }; double kb = 0, kg = 0, kr = 0; foreach (int c in cs) { kb += px[c * 4]; kg += px[c * 4 + 1]; kr += px[c * 4 + 2]; } kb /= 4; kg /= 4; kr /= 4;
    Func<int, double> dist = i => Math.Sqrt(Math.Pow(px[i * 4] - kb, 2) + Math.Pow(px[i * 4 + 1] - kg, 2) + Math.Pow(px[i * 4 + 2] - kr, 2));
    bool[] bg = new bool[w * h]; var q = new Queue<int>();
    Action<int> push = i => { if (!bg[i] && dist(i) < tol) { bg[i] = true; q.Enqueue(i); } };
    for (int x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (int y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (q.Count > 0) { int i = q.Dequeue(), x = i % w, y = i / w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
    int minX = w, minY = h, maxX = 0, maxY = 0;
    for (int i = 0; i < w * h; i++) {
      if (bg[i]) { px[i * 4 + 3] = 0; continue; }
      int x = i % w, y = i / w; bool edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]);
      if (edge) { double d = dist(i); double a = Math.Min(1.0, Math.Max(0.0, (d - tol * 0.5) / (tol * 1.2))); px[i * 4 + 3] = (byte)(255 * a);
        if (a < 1) { double m = 1 - a; px[i * 4] = (byte)Math.Max(0, Math.Min(255, (px[i * 4] - kb * m) / Math.Max(0.05, a))); px[i * 4 + 1] = (byte)Math.Max(0, Math.Min(255, (px[i * 4 + 1] - kg * m) / Math.Max(0.05, a))); px[i * 4 + 2] = (byte)Math.Max(0, Math.Min(255, (px[i * 4 + 2] - kr * m) / Math.Max(0.05, a))); } }
      if (px[i * 4 + 3] > 8) { if (x < minX) minX = x; if (x > maxX) maxX = x; if (y < minY) minY = y; if (y > maxY) maxY = y; }
    }
    Marshal.Copy(px, 0, data.Scan0, px.Length); bmp.UnlockBits(data);
    if (maxX <= minX || maxY <= minY) return bmp;
    int cw = maxX - minX + 1, chh = maxY - minY + 1; double s = Math.Min(1.0, (double)maxH / chh); int ow = Math.Max(1, (int)(cw * s)), oh = Math.Max(1, (int)(chh * s));
    var outB = new Bitmap(ow, oh, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(outB)) { g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality; g.DrawImage(bmp, new Rectangle(0, 0, ow, oh), new Rectangle(minX, minY, cw, chh), GraphicsUnit.Pixel); }
    bmp.Dispose(); return outB;
  }
}
"@
New-Item -ItemType Directory -Force $Out | Out-Null
Get-ChildItem $In -File | Where-Object { $_.Extension -match '\.(png|jpe?g|bmp)$' } | ForEach-Object {
  $src = [System.Drawing.Bitmap]::FromFile($_.FullName)
  $res = [Cutout]::Run($src, $Tol, $MaxH); $src.Dispose()
  $dst = Join-Path $Out ($_.BaseName + '.png'); $res.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png)
  Write-Host ("{0} -> {1} ({2}x{3})" -f $_.Name, $dst, $res.Width, $res.Height); $res.Dispose()
}
