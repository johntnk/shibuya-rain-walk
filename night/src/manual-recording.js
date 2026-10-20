// Record the live canvas and Shibuya's audio bus. This never drives the character,
// requests a microphone, or disconnects the speakers. The automated tour stays separate.
const FORMATS = [
  'video/mp4;codecs=avc1.42001f,mp4a.40.2',
  'video/mp4;codecs=avc1,mp4a.40.2',
  'video/webm;codecs=vp8,opus',
  'video/webm',
];
const MAX_BYTES = 512 * 1024 * 1024;
const MAX_MS = 15 * 60 * 1000;

const duration = ms => {
  const s = Math.floor(ms / 1000);
  return `${Math.floor(s / 60).toString().padStart(2, '0')}:${(s % 60).toString().padStart(2, '0')}`;
};
const filename = (date, ext) => {
  const p = n => String(n).padStart(2, '0');
  return `涩谷_${date.getFullYear()}-${p(date.getMonth() + 1)}-${p(date.getDate())}_${p(date.getHours())}-${p(date.getMinutes())}-${p(date.getSeconds())}.${ext}`;
};

export function mountManualRecording({ canvas, audio, ready, startAudio, showResult = () => {} }) {
  const toggle = document.getElementById('record-toggle');
  const note = document.getElementById('record-note');
  const dock = document.getElementById('record-dock');
  const status = document.getElementById('record-status');
  const stopButton = document.getElementById('record-stop');
  const result = document.getElementById('record-result');
  const download = document.getElementById('record-download');
  const supported = typeof MediaRecorder !== 'undefined' && typeof canvas.captureStream === 'function';
  let state = 'idle', session = null, resultURL = null, ticker = null;
  let noteText = '只录画面和涩谷声音，不录麦克风。漫游时按 R 开始，再按 R 停止并保存。';

  function ui() {
    const busy = state !== 'idle';
    toggle.disabled = !supported || !ready() || state === 'starting' || state === 'stopping';
    toggle.textContent = state === 'recording' ? '停止并保存 · R' : state === 'starting' ? '正在准备录制…' : state === 'stopping' ? '正在生成视频…' : '开始录制 · R';
    dock.hidden = !busy;
    stopButton.disabled = state !== 'recording';
    note.textContent = !supported ? '当前浏览器不支持网页录制，请用新版 Chrome 或 Safari 打开涩谷。' : noteText;
    if (session && state === 'recording') {
      const muted = audio.muted ? ' · 当前静音' : ' · 含涩谷声音';
      status.textContent = `● 录制中 ${duration(performance.now() - session.started)}${muted} · R 停止`;
    } else status.textContent = state === 'starting' ? '正在准备录制…' : '正在生成视频…';
  }

  function release(s) {
    // Disconnect only our extra output; the city's normal speaker path is untouched.
    if (s.destination) {
      try { audio.master.disconnect(s.destination); } catch {}
      for (const track of s.destination.stream.getTracks()) track.stop();
      s.destination.disconnect();
    }
    for (const track of s.capture?.getTracks() || []) track.stop();
    clearInterval(ticker); ticker = null;
  }

  function finish(s) {
    if (session !== s) return;
    state = 'stopping';
    if (!s.stopped) s.stopped = performance.now();
    release(s);
    const mime = s.recorder?.mimeType || s.chunks[0]?.type || 'video/webm';
    const blob = new Blob(s.chunks, { type: mime });
    s.chunks.length = 0;
    session = null; state = 'idle';
    if (!blob.size) {
      noteText = s.error || '没有生成有效视频，请重新开始录制。'; ui(); showResult(); return;
    }
    const ext = mime.startsWith('video/mp4') ? 'mp4' : 'webm';
    const nextURL = URL.createObjectURL(blob);
    if (resultURL) URL.revokeObjectURL(resultURL);
    resultURL = nextURL;
    download.href = resultURL;
    download.download = filename(s.date, ext);
    download.textContent = `保存刚录好的视频（${ext.toUpperCase()} · ${(blob.size / 1048576).toFixed(1)} MB）`;
    result.hidden = false;
    noteText = `${s.reason || '录制完成'}，已生成 ${duration(s.stopped - s.started)} 视频。${s.error ? '录制中断，已保留收到的片段。' : ''}若未自动下载，请点击下方保存。`;
    ui();
    showResult();
    // Keep the visible link and Blob alive for a retry if the browser blocks auto-download.
    download.click();
  }

  function stop(reason = '') {
    if (state !== 'recording' || !session) return;
    const s = session;
    state = 'stopping'; s.stopped = performance.now(); s.reason = reason;
    if (document.pointerLockElement) document.exitPointerLock();
    ui();
    if (s.recorder.state === 'inactive') finish(s);
    else {
      try { s.recorder.stop(); }
      catch (e) { s.error = e.message; finish(s); }
    }
  }

  async function start() {
    if (state !== 'idle' || !supported || !ready()) return;
    state = 'starting';
    const s = session = { capture: null, destination: null, recorder: null, chunks: [], bytes: 0, date: new Date(), started: 0, stopped: 0 };
    noteText = '正在准备画面和涩谷声音…'; ui();
    try {
      startAudio();
      if (!audio.ctx || !audio.master) throw new Error('涩谷声音尚未准备好，请进入涩谷后再录制；若使用了 mute=1，请关闭该参数。');
      if (audio.muted) throw new Error('请先进入涩谷，按 M 打开声音，再按 R 录制。');
      await audio.ctx.resume();
      if (audio.ctx.state !== 'running') throw new Error('声音未能启动，请进入涩谷后按 R 录制。');
      if (document.hidden) throw new Error('请回到涩谷页面，再开始录制。');
      s.capture = canvas.captureStream(30);
      if (!s.capture.getVideoTracks().length) throw new Error('无法读取涩谷画面，请刷新后重试。');
      s.destination = audio.ctx.createMediaStreamDestination();
      audio.master.connect(s.destination);
      const stream = new MediaStream([...s.capture.getVideoTracks(), ...s.destination.stream.getAudioTracks()]);
      // isTypeSupported is a hint; try the next format if construction/start fails.
      for (const mimeType of FORMATS.filter(type => MediaRecorder.isTypeSupported(type))) {
        try {
          const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8000000, audioBitsPerSecond: 192000 });
          recorder.ondataavailable = e => {
            if (session !== s || !e.data.size) return;
            s.chunks.push(e.data); s.bytes += e.data.size;
            if (s.bytes >= MAX_BYTES) stop('本段已达到容量上限，自动结束');
          };
          recorder.onstop = () => finish(s);
          recorder.onerror = e => {
            if (session !== s) return;
            s.error = e.error?.message || '录制发生错误';
            // An error is followed by final dataavailable and stop events. Let those
            // finish the file, rather than discarding its last chunk here.
            if (!s.stopped) s.stopped = performance.now();
            state = 'stopping';
            if (document.pointerLockElement) document.exitPointerLock();
            ui();
          };
          recorder.start(1000);
          s.recorder = recorder;
          break;
        } catch { /* Try a browser-supported alternative. */ }
      }
      if (!s.recorder) throw new Error('当前浏览器无法录制视频，请用新版 Chrome 或 Safari 重试。');
      s.started = performance.now();
      s.width = canvas.width; s.height = canvas.height;
      state = 'recording';
      noteText = '正在录制画面和涩谷声音。可自由漫游或乘扶梯，按 R 停止并保存；按 M 静音也会让视频静音。';
      ticker = setInterval(() => {
        if (state !== 'recording') return;
        if (performance.now() - s.started >= MAX_MS) stop('本段已满 15 分钟，自动结束');
        else if (canvas.width !== s.width || canvas.height !== s.height) stop('画面尺寸改变，本段已自动结束');
        else ui();
      }, 250);
      for (const track of stream.getTracks()) track.addEventListener('ended', () => stop('录制来源已停止，本段已结束'), { once: true });
      ui();
    } catch (e) {
      release(s); session = null; state = 'idle';
      noteText = `未开始录制：${e.message}`; ui();
      if (document.pointerLockElement) document.exitPointerLock();
      showResult();
    }
  }

  toggle.addEventListener('click', () => state === 'recording' ? stop() : start());
  stopButton.addEventListener('click', () => stop());
  window.addEventListener('keydown', e => {
    if (e.code !== 'KeyR' || e.repeat || e.isComposing || e.metaKey || e.ctrlKey || e.altKey || e.shiftKey) return;
    if (e.target?.closest?.('input, textarea, select, [contenteditable="true"]')) return;
    e.preventDefault();
    if (state === 'recording') stop(); else if (state === 'idle') start();
  });
  // Background tabs can stop rendering while audio continues. End the clip before
  // it turns into frozen video with sound, and offer it when the player returns.
  document.addEventListener('visibilitychange', () => { if (document.hidden) stop('页面进入后台，本段已自动结束'); });
  canvas.addEventListener('webglcontextlost', () => stop('画面暂时中断，本段已结束'));
  window.addEventListener('beforeunload', e => {
    if (state === 'idle') return;
    e.preventDefault(); e.returnValue = '';
  });
  const readyTimer = setInterval(() => {
    if (state === 'idle') ui();
    if (ready()) clearInterval(readyTimer);
  }, 500);
  ui();
  return { get busy() { return state !== 'idle'; } };
}
