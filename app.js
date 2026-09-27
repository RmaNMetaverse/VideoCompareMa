'use strict';
const $ = id => document.getElementById(id);
const videos = [$('video-a'), $('video-b')];
const canvas = $('canvas'), ctx = canvas.getContext('2d');
const layers = [document.createElement('canvas'), document.createElement('canvas')];
const contexts = layers.map(c => c.getContext('2d', {willReadFrequently: true}));
const urls = [null, null], loaded = [false, false], generations = [0, 0];
let playing = false, position = 0.5, playGeneration = 0;
const ready = () => loaded.every(Boolean);
const limit = () => ready() ? Math.min(...videos.map(v => v.duration)) : 0;
const format = t => `${String(Math.floor(t / 60)).padStart(2, '0')}:${(t % 60).toFixed(3).padStart(6, '0')}`;
function pause() {
  playGeneration++;
  playing = false;
  videos.forEach(v => v.pause());
  $('play').textContent = '▶'; $('play').setAttribute('aria-label', 'Play');
}
function seek(t) {
  if (!ready()) return;
  t = Math.max(0, Math.min(limit(), t));
  videos.forEach(v => { v.currentTime = t; });
  $('seek').value = t; $('time').textContent = format(t);
}
async function play() {
  if (!ready()) return;
  if (playing) { pause(); return; }
  if (videos[0].currentTime >= limit() - 0.02) seek(0);
  const token = ++playGeneration;
  try {
    await Promise.all(videos.map(v => v.play()));
    if (token !== playGeneration) { if (!playing) videos.forEach(v => v.pause()); return; }
    playing = true; $('play').textContent = 'Ⅱ'; $('play').setAttribute('aria-label', 'Pause');
  } catch (e) { if (token === playGeneration) { pause(); $('status').textContent = `Playback failed: ${e.message}`; } }
}
function updateReady() {
  const ok = ready();
  ['seek', 'play', 'restart'].forEach(id => $(id).disabled = !ok);
  $('empty').hidden = ok;
  $('seek').max = limit() || 1; $('duration').textContent = format(limit());
  if (ok) $('status').textContent = 'Ready. Playback ends at the shorter video.';
}
function loadFile(file, i) {
  if (!file || !file.type.startsWith('video/')) { $('status').textContent = 'Please drop a video file onto Video A or Video B.'; return; }
  const video = videos[i];
  const letter = i ? 'b' : 'a';
  pause(); const generation = ++generations[i]; loaded[i] = false; updateReady();
  if (urls[i]) URL.revokeObjectURL(urls[i]);
  $('name-' + letter).textContent = file.name;
  $('info-' + letter).textContent = 'Loading...';
  video.onloadeddata = () => {
    if (generation !== generations[i]) return;
    if (!Number.isFinite(video.duration) || !video.duration || !video.videoWidth) { video.onerror(); return; }
    loaded[i] = true;
    $('info-' + letter).textContent = `${video.videoWidth} × ${video.videoHeight} · ${format(video.duration)} · ${(file.size / 1048576).toFixed(1)} MB`;
    updateReady(); if (ready()) seek(0);
  };
  video.onerror = () => {
    if (generation !== generations[i]) return;
    pause(); loaded[i] = false; updateReady();
    $('info-' + letter).textContent = 'Unable to decode this file';
    $('status').textContent = `Video ${letter.toUpperCase()} cannot be decoded. Try an MP4 with H.264 video or a browser-supported WebM.`;
  };
  urls[i] = URL.createObjectURL(file); video.src = urls[i]; video.load();
}
videos.forEach((video, i) => {
  video.muted = true;
  const letter = i ? 'b' : 'a';
  $(`file-${letter}`).addEventListener('change', e => loadFile(e.target.files[0], i));
  video.addEventListener('ended', () => { if (playing && ready()) { pause(); if ($('loop').checked) { seek(0); play(); } } });
});
const sources = $('sources');
let dragDepth = 0;
document.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
document.addEventListener('drop', e => { if (e.dataTransfer.types.includes('Files')) e.preventDefault(); });
sources.addEventListener('dragenter', e => { if (!e.dataTransfer.types.includes('Files')) return; e.preventDefault(); dragDepth++; sources.classList.add('drop-active'); });
sources.addEventListener('dragover', e => { if (e.dataTransfer.types.includes('Files')) { e.preventDefault(); e.dataTransfer.dropEffect = 'copy'; } });
sources.addEventListener('dragleave', e => { if (!e.dataTransfer.types.includes('Files')) return; dragDepth--; if (dragDepth <= 0) { dragDepth = 0; sources.classList.remove('drop-active'); } });
sources.addEventListener('drop', e => {
  if (!e.dataTransfer.files.length) return;
  e.preventDefault(); dragDepth = 0; sources.classList.remove('drop-active');
  const slot = e.target.closest('.source')?.dataset.slot;
  loadFile(e.dataTransfer.files[0], slot === 'b' ? 1 : 0);
});
function fit(context, video, x, y, w, h) {
  const scale = Math.min(w / video.videoWidth, h / video.videoHeight);
  const vw = video.videoWidth * scale, vh = video.videoHeight * scale;
  context.drawImage(video, x + (w - vw) / 2, y + (h - vh) / 2, vw, vh);
}
function divider() {
  const vertical = $('axis').value === 'y';
  $('divider').classList.toggle('y', vertical);
  $('divider').style.left = vertical ? '0' : `${position * 100}%`;
  $('divider').style.top = vertical ? `${position * 100}%` : '0';
  $('divider').setAttribute('aria-valuenow', Math.round(position * 100));
  $('divider').setAttribute('aria-orientation', vertical ? 'vertical' : 'horizontal');
}
function settings() {
  const mode = $('mode').value;
  $('axis-setting').hidden = mode !== 'wipe'; $('divider').hidden = mode !== 'wipe' || !ready();
  $('opacity-setting').hidden = mode !== 'opacity'; $('gain-setting').hidden = mode !== 'difference';
  divider();
}
function render() {
  const w = Math.max(1, Math.round(canvas.clientWidth * Math.min(devicePixelRatio, 2)));
  const h = Math.max(1, Math.round(canvas.clientHeight * Math.min(devicePixelRatio, 2)));
  if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
  // Preserve the last complete composite while browser decoders seek to a new frame.
  if (ready() && videos.every(v => v.readyState >= 2 && !v.seeking)) {
    ctx.fillStyle = '#090a0b'; ctx.fillRect(0, 0, w, h);
    const mode = $('mode').value;
    if (mode === 'horizontal' || mode === 'vertical') {
      const horizontal = mode === 'horizontal';
      videos.forEach((v, i) => {
        const x = horizontal ? i * w / 2 : 0, y = horizontal ? 0 : i * h / 2;
        fit(ctx, v, x, y, horizontal ? w / 2 : w, horizontal ? h : h / 2);
        ctx.fillStyle = i ? '#e8a1bc' : '#57d5b0'; ctx.font = `${Math.round(15 * Math.min(devicePixelRatio, 2))}px system-ui`;
        ctx.fillText(i ? 'B' : 'A', x + 14, y + 25);
      });
    } else {
      layers.forEach((layer, i) => {
        if (layer.width !== w || layer.height !== h) { layer.width = w; layer.height = h; }
        const c = contexts[i]; c.fillStyle = '#000'; c.fillRect(0, 0, w, h); fit(c, videos[i], 0, 0, w, h);
      });
      ctx.drawImage(layers[0], 0, 0);
      if (mode === 'wipe') {
        ctx.save(); ctx.beginPath();
        if ($('axis').value === 'x') ctx.rect(w * position, 0, w * (1 - position), h);
        else ctx.rect(0, h * position, w, h * (1 - position));
        ctx.clip(); ctx.drawImage(layers[1], 0, 0); ctx.restore();
      } else if (mode === 'opacity') {
        ctx.globalAlpha = Number($('opacity').value) / 100; ctx.drawImage(layers[1], 0, 0); ctx.globalAlpha = 1;
      } else {
        ctx.globalCompositeOperation = 'difference'; ctx.drawImage(layers[1], 0, 0); ctx.globalCompositeOperation = 'source-over';
        const gain = Number($('gain').value);
        if (gain > 1) { const pixels = ctx.getImageData(0, 0, w, h); for (let j = 0; j < pixels.data.length; j += 4) { for (let k = 0; k < 3; k++) pixels.data[j + k] *= gain; } ctx.putImageData(pixels, 0, 0); }
      }
    }
    if (playing) {
      if (videos.some(v => v.currentTime >= limit() - 0.01)) { pause(); seek(limit()); if ($('loop').checked) { seek(0); play(); } }
      else if (!videos.some(v => v.seeking) && videos.every(v => v.readyState >= 3) && Math.abs(videos[0].currentTime - videos[1].currentTime) > 0.08) videos[1].currentTime = videos[0].currentTime;
    }
    $('seek').value = videos[0].currentTime; $('time').textContent = format(videos[0].currentTime);
  }
  $('divider').hidden = $('mode').value !== 'wipe' || !ready();
  requestAnimationFrame(render);
}
$('play').onclick = play; $('restart').onclick = () => { pause(); seek(0); };
$('seek').addEventListener('input', e => { pause(); seek(Number(e.target.value)); });
$('speed').onchange = () => videos.forEach(v => v.playbackRate = Number($('speed').value));
$('audio').onchange = () => videos.forEach((v, i) => v.muted = $('audio').value !== (i ? 'b' : 'a'));
$('mode').onchange = settings; $('axis').onchange = settings;
$('opacity').oninput = () => $('opacity-value').textContent = `${$('opacity').value}%`;
$('fullscreen').onclick = async () => { try { if (document.fullscreenElement) await document.exitFullscreen(); else await $('viewer').requestFullscreen(); } catch { $('status').textContent = 'Full screen is unavailable in this browser.'; } };
function move(e) { const r = canvas.getBoundingClientRect(); position = Math.max(0, Math.min(1, $('axis').value === 'x' ? (e.clientX - r.left) / r.width : (e.clientY - r.top) / r.height)); divider(); }
$('divider').onpointerdown = e => { $('divider').setPointerCapture(e.pointerId); move(e); };
$('divider').onpointermove = e => { if ($('divider').hasPointerCapture(e.pointerId)) move(e); };
$('divider').onkeydown = e => { if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Home','End'].includes(e.key)) { e.preventDefault(); position = e.key === 'Home' ? 0 : e.key === 'End' ? 1 : Math.max(0, Math.min(1, position + (['ArrowLeft','ArrowUp'].includes(e.key) ? -0.01 : 0.01))); divider(); } };
document.addEventListener('keydown', e => { if (e.code === 'Space' && !['INPUT','SELECT','BUTTON'].includes(e.target.tagName) && e.target !== $('divider')) { e.preventDefault(); play(); } });
window.addEventListener('beforeunload', () => urls.filter(Boolean).forEach(url => URL.revokeObjectURL(url)));
settings(); render();
