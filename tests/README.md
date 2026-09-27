# Browser smoke checks

These development-only checks require Node.js, Playwright, Microsoft Edge, and FFmpeg. None are required to run or deploy the app.

On Windows PowerShell, generate the tiny fixtures:

```powershell
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=red:s=320x180:r=24:d=2 -c:v libvpx -y "$env:TEMP/VideoCompareMa-red.webm"
ffmpeg -hide_banner -loglevel error -f lavfi -i color=c=blue:s=320x180:r=24:d=3 -c:v libvpx -y "$env:TEMP/VideoCompareMa-blue.webm"
node tests/smoke.cjs
```

Playwright must be available to Node. Alternatively set `PLAYWRIGHT_MODULE` to the absolute path of an existing Playwright package. The test opens local files in headless Edge, verifies actual canvas pixels and playback behavior, and saves desktop/mobile screenshots in this directory. On another operating system, provide `TEMP` and choose an installed browser channel in `smoke.cjs`.
