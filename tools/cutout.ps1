# 단색 배경 이미지를 투명 PNG 로 변환 (가장자리에서 번져 들어가며 배경색만 제거 → 여백 잘라내기 → 축소)
# 1) 한 장에 한 명:  powershell -ExecutionPolicy Bypass -File tools\cutout.ps1
#      assets\raw\<id>.png → assets\chars\<id>.png
# 2) 한 장에 여러 명(시트):  ... -File tools\cutout.ps1 -Sheet assets\raw\sheet.png -Names minji,doosan,youngmin,...
#      왼쪽 위 → 오른쪽 아래 순서로 이름을 붙입니다. 건너뛸 칸은 이름을 '-' 로.
param([string]$In = "$PSScriptRoot\..\assets\raw", [string]$Out = "$PSScriptRoot\..\assets\chars", [int]$Tol = 70, [int]$MaxH = 640, [string]$Sheet = '', [string[]]$Names = @())
Add-Type -AssemblyName System.Drawing
Add-Type -ReferencedAssemblies System.Drawing -TypeDefinition @"
using System; using System.Collections.Generic; using System.Drawing; using System.Drawing.Imaging; using System.Linq; using System.Runtime.InteropServices;
public static class Cutout {
  static byte[] Load(Bitmap src, out int w, out int h) {
    w = src.Width; h = src.Height; var bmp = new Bitmap(w, h, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(bmp)) { g.Clear(Color.White); g.DrawImage(src, 0, 0, w, h); }
    var d = bmp.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb); byte[] px = new byte[w * h * 4]; Marshal.Copy(d.Scan0, px, 0, px.Length); bmp.UnlockBits(d); bmp.Dispose(); return px;
  }
  // 가장자리에서 시작하는 flood fill 로 배경만 투명화 (캐릭터 안쪽의 같은 색은 보존)
  static void Key(byte[] px, int w, int h, int tol) {
    int[] cs = { 0, w - 1, (h - 1) * w, (h - 1) * w + w - 1 }; double kb = 0, kg = 0, kr = 0; foreach (int c in cs) { kb += px[c * 4]; kg += px[c * 4 + 1]; kr += px[c * 4 + 2]; } kb /= 4; kg /= 4; kr /= 4;
    Func<int, double> dist = i => Math.Sqrt(Math.Pow(px[i * 4] - kb, 2) + Math.Pow(px[i * 4 + 1] - kg, 2) + Math.Pow(px[i * 4 + 2] - kr, 2));
    bool[] bg = new bool[w * h]; var q = new Queue<int>(); Action<int> push = i => { if (!bg[i] && dist(i) < tol) { bg[i] = true; q.Enqueue(i); } };
    for (int x = 0; x < w; x++) { push(x); push((h - 1) * w + x); } for (int y = 0; y < h; y++) { push(y * w); push(y * w + w - 1); }
    while (q.Count > 0) { int i = q.Dequeue(), x = i % w, y = i / w; if (x > 0) push(i - 1); if (x < w - 1) push(i + 1); if (y > 0) push(i - w); if (y < h - 1) push(i + w); }
    for (int i = 0; i < w * h; i++) {
      if (bg[i]) { px[i * 4 + 3] = 0; continue; }
      int x = i % w, y = i / w; bool edge = (x > 0 && bg[i - 1]) || (x < w - 1 && bg[i + 1]) || (y > 0 && bg[i - w]) || (y < h - 1 && bg[i + w]); if (!edge) continue;
      double a = Math.Min(1.0, Math.Max(0.0, (dist(i) - tol * 0.5) / (tol * 1.2))); px[i * 4 + 3] = (byte)(255 * a);
      if (a < 1) { double m = 1 - a, aa = Math.Max(0.05, a); px[i * 4] = (byte)Math.Max(0, Math.Min(255, (px[i * 4] - kb * m) / aa)); px[i * 4 + 1] = (byte)Math.Max(0, Math.Min(255, (px[i * 4 + 1] - kg * m) / aa)); px[i * 4 + 2] = (byte)Math.Max(0, Math.Min(255, (px[i * 4 + 2] - kr * m) / aa)); }
    }
  }
  static Bitmap Crop(byte[] px, int w, int h, int[] label, HashSet<int> keep, int x0, int y0, int x1, int y1, int maxH) {
    int cw = x1 - x0 + 1, ch = y1 - y0 + 1; byte[] o = new byte[cw * ch * 4];
    for (int y = 0; y < ch; y++) for (int x = 0; x < cw; x++) { int si = (y + y0) * w + x + x0; if (label != null && !keep.Contains(label[si])) continue; Buffer.BlockCopy(px, si * 4, o, (y * cw + x) * 4, 4); }
    var full = new Bitmap(cw, ch, PixelFormat.Format32bppArgb); var d = full.LockBits(new Rectangle(0, 0, cw, ch), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb); Marshal.Copy(o, 0, d.Scan0, o.Length); full.UnlockBits(d);
    double s = Math.Min(1.0, (double)maxH / ch); if (s >= 1) return full; int ow = Math.Max(1, (int)(cw * s)), oh = Math.Max(1, (int)(ch * s)); var outB = new Bitmap(ow, oh, PixelFormat.Format32bppArgb);
    using (var g = Graphics.FromImage(outB)) { g.InterpolationMode = System.Drawing.Drawing2D.InterpolationMode.HighQualityBicubic; g.PixelOffsetMode = System.Drawing.Drawing2D.PixelOffsetMode.HighQuality; g.DrawImage(full, new Rectangle(0, 0, ow, oh), new Rectangle(0, 0, cw, ch), GraphicsUnit.Pixel); } full.Dispose(); return outB;
  }
  public static Bitmap Run(Bitmap src, int tol, int maxH) {
    int w, h; byte[] px = Load(src, out w, out h); Key(px, w, h, tol); int x0 = w, y0 = h, x1 = 0, y1 = 0;
    for (int i = 0; i < w * h; i++) if (px[i * 4 + 3] > 8) { int x = i % w, y = i / w; if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
    if (x1 <= x0) { x0 = 0; y0 = 0; x1 = w - 1; y1 = h - 1; } return Crop(px, w, h, null, null, x0, y0, x1, y1, maxH);
  }
  class Comp { public int id, area, x0, y0, x1, y1; public HashSet<int> ids = new HashSet<int>(); public double cx { get { return (x0 + x1) / 2.0; } } public double cy { get { return (y0 + y1) / 2.0; } } }
  // 시트 분리: 덩어리(연결 요소)를 찾아 큰 것 = 캐릭터, 가까운 작은 조각(소품)은 합침. 위→아래, 왼→오 순서로 반환
  public static List<Bitmap> Split(Bitmap src, int tol, int maxH, int count) {
    int w, h; byte[] px = Load(src, out w, out h); Key(px, w, h, tol); int[] label = new int[w * h]; var comps = new List<Comp>(); var st = new Stack<int>();
    for (int s = 0; s < w * h; s++) { if (label[s] != 0 || px[s * 4 + 3] < 60) continue; var c = new Comp { id = comps.Count + 1, x0 = w, y0 = h }; label[s] = c.id; st.Push(s);
      while (st.Count > 0) { int i = st.Pop(), x = i % w, y = i / w; c.area++; if (x < c.x0) c.x0 = x; if (x > c.x1) c.x1 = x; if (y < c.y0) c.y0 = y; if (y > c.y1) c.y1 = y;
        for (int dy = -1; dy <= 1; dy++) for (int dx = -1; dx <= 1; dx++) { int nx = x + dx, ny = y + dy; if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue; int n = ny * w + nx; if (label[n] == 0 && px[n * 4 + 3] >= 60) { label[n] = c.id; st.Push(n); } } }
      c.ids.Add(c.id); comps.Add(c); }
    var big = comps.OrderByDescending(c => c.area).ToList(); if (count <= 0) { double top = big.Count > 0 ? big[0].area : 0; count = big.Count(c => c.area > top * 0.3); }
    var mains = big.Take(count).ToList(); int pad = Math.Max(6, w / 120);
    foreach (var c in big.Skip(count)) { if (c.area < 12) continue; Comp best = null; double bd = 1e18; foreach (var m in mains) { bool near = c.x1 >= m.x0 - pad && c.x0 <= m.x1 + pad && c.y1 >= m.y0 - pad && c.y0 <= m.y1 + pad; if (!near) continue; double d = Math.Pow(c.cx - m.cx, 2) + Math.Pow(c.cy - m.cy, 2); if (d < bd) { bd = d; best = m; } }
      if (best != null) { best.ids.Add(c.id); best.x0 = Math.Min(best.x0, c.x0); best.y0 = Math.Min(best.y0, c.y0); best.x1 = Math.Max(best.x1, c.x1); best.y1 = Math.Max(best.y1, c.y1); } }
    double avgH = mains.Count > 0 ? mains.Average(m => m.y1 - m.y0) : 1; var rows = new List<List<Comp>>();
    foreach (var m in mains.OrderBy(m => m.cy)) { var row = rows.LastOrDefault(); if (row == null || m.cy - row.Average(r => r.cy) > avgH * 0.5) { row = new List<Comp>(); rows.Add(row); } row.Add(m); }
    var res = new List<Bitmap>(); foreach (var row in rows) foreach (var m in row.OrderBy(r => r.cx)) res.Add(Crop(px, w, h, label, m.ids, m.x0, m.y0, m.x1, m.y1, maxH)); return res;
  }
}
"@
New-Item -ItemType Directory -Force $Out | Out-Null
$Names = @($Names | ForEach-Object { $_ -split ',' } | ForEach-Object { $_.Trim() } | Where-Object { $_ })
if ($Sheet) {
  $src = [System.Drawing.Bitmap]::FromFile((Resolve-Path $Sheet)); $parts = [Cutout]::Split($src, $Tol, $MaxH, $Names.Count); $src.Dispose()
  Write-Host ("found {0} characters" -f $parts.Count)
  for ($i = 0; $i -lt $parts.Count; $i++) { $n = if ($i -lt $Names.Count) { $Names[$i] } else { "char$($i + 1)" }; if ($n -ne '-') { $dst = Join-Path $Out ($n + '.png'); $parts[$i].Save($dst, [System.Drawing.Imaging.ImageFormat]::Png); Write-Host ("#{0} -> {1} ({2}x{3})" -f ($i + 1), $dst, $parts[$i].Width, $parts[$i].Height) }; $parts[$i].Dispose() }
} else {
  Get-ChildItem $In -File | Where-Object { $_.Extension -match '\.(png|jpe?g|bmp)$' -and $_.BaseName -notmatch '^sheet' } | ForEach-Object {
    $src = [System.Drawing.Bitmap]::FromFile($_.FullName); $res = [Cutout]::Run($src, $Tol, $MaxH); $src.Dispose()
    $dst = Join-Path $Out ($_.BaseName + '.png'); $res.Save($dst, [System.Drawing.Imaging.ImageFormat]::Png); Write-Host ("{0} -> {1} ({2}x{3})" -f $_.Name, $dst, $res.Width, $res.Height); $res.Dispose()
  }
}
