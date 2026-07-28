import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { useTheme } from '../context/ThemeContext';
import { markSiteReady } from '../utils/siteReady';
import './Loader.scss';

/* ==========================================================
   Frame sequence config — see public/loader/manifest.json.
   Frames are alpha-keyed stills from public/assets/loader_intro.mp4
   (segment 6.2s–10.0s: exploded lens -> fully assembled body).
   ========================================================== */
const SOURCE_FRAME_COUNT = 73;
const FRAME_PATH_DESKTOP = '/loader/desktop';
const FRAME_PATH_MOBILE = '/loader/mobile';
/* The lockup keyed out of the video is white-on-transparent, so it
   vanished on the warm-white loader. The light theme swaps in the
   black wordmark, which is the same lettering as vector art. */
const LOGO_DARK = '/loader/logo-lockup.png';
const LOGO_LIGHT = '/assets/logo_isotype_1.svg';

const SEQUENCE_DURATION = 2.2; // seconds of assembly playback
const LERP_FACTOR = 0.28;      // frame smoothing toward the time-driven target
const MOBILE_QUERY = '(max-width: 640px)';
const REDUCED_QUERY = '(prefers-reduced-motion: reduce)';

/* Playback is gated on a real buffer rather than a strided sample of
   the sequence. The old build started as soon as every 6th frame had
   landed, so the playhead kept arriving at frames that were still in
   flight — and because drawFrame() skips when the nearest loaded frame
   is the one already on screen, those turned into outright freezes
   (measured: a 1.66s stall mid-assembly on an unthrottled connection).
   Frames now load in playback order, and the head is never allowed to
   outrun what has decoded. */
const PREBUFFER_RATIO = 1.0;   // buffer ALL frames before animating
const PREBUFFER_TIMEOUT = 8000; // ms; start anyway rather than stall forever
const FETCH_CONCURRENCY = 12;

const STATUS_STEPS = [
  { at: 0, label: 'CALIBRATING OPTICS' },
  { at: 0.22, label: 'SEATING ELEMENTS' },
  { at: 0.46, label: 'ALIGNING BARREL' },
  { at: 0.7, label: 'LOCKING MOUNT' },
  { at: 0.92, label: 'READY' }
];

const framePath = (index, mobile) =>
  `${mobile ? FRAME_PATH_MOBILE : FRAME_PATH_DESKTOP}/frame-${String(index + 1).padStart(4, '0')}.webp`;

/* The full desktop sequence is 1.75 MB. On a constrained link that
   cannot arrive before the loader has outstayed its welcome, so the
   sequence is thinned rather than the visitor being made to wait: a
   stride of 3 over the smaller mobile renders is ~0.24 MB and still
   reads as a continuous assembly once smoothed. */
const readConnection = () => {
  const c =
    typeof navigator !== 'undefined' &&
    (navigator.connection || navigator.mozConnection || navigator.webkitConnection);
  if (!c) return { slow: false, verySlow: false };
  const type = c.effectiveType || '';
  return {
    slow: Boolean(c.saveData) || type === '3g',
    verySlow: type === '2g' || type === 'slow-2g'
  };
};

const buildPlaylist = (stride) => {
  const list = [];
  for (let i = 0; i < SOURCE_FRAME_COUNT; i += stride) list.push(i);
  if (list[list.length - 1] !== SOURCE_FRAME_COUNT - 1) list.push(SOURCE_FRAME_COUNT - 1);
  return list;
};

const Loader = () => {
  const { theme } = useTheme();
  const isLight = theme === 'light';
  const rootRef = useRef(null);
  const canvasRef = useRef(null);
  const statusLabelRef = useRef(null);
  const statusPercentRef = useRef(null);
  const progressFillRef = useRef(null);

  useEffect(() => {
    const root = rootRef.current;
    const canvas = canvasRef.current;
    if (!root || !canvas) return undefined;

    const ctx = canvas.getContext('2d');
    const reduced = window.matchMedia(REDUCED_QUERY).matches;
    const link = readConnection();
    const useMobile =
      window.matchMedia(MOBILE_QUERY).matches || link.slow || link.verySlow;
    let stride = 1;
    if (link.verySlow) stride = 4;
    else if (link.slow) stride = 3;

    const playlist = buildPlaylist(stride);
    const FRAME_COUNT = playlist.length;

    document.body.classList.add('is-loading');

    /* ---------- frame store ---------- */
    const images = new Array(FRAME_COUNT);
    const loaded = new Array(FRAME_COUNT).fill(false);
    const promises = new Array(FRAME_COUNT);

    let disposed = false;
    let rafId = 0;
    let lastDrawn = -1;
    let currentFrame = 0;
    let targetFrame = 0;
    let pageVisible = !document.hidden;

    let decodedCount = 0;
    let bufferedHead = -1; // highest index with every frame before it decoded

    const advanceHead = () => {
      while (bufferedHead + 1 < FRAME_COUNT && loaded[bufferedHead + 1]) {
        bufferedHead += 1;
      }
    };

    /* decode() rather than onload alone: onload only means the bytes
       arrived, so the first paint of each frame could still block the
       compositor on decoding a 900px image with alpha. */
    const loadFrame = (index) => {
      if (promises[index]) return promises[index];
      promises[index] = new Promise((resolve) => {
        const img = new Image();
        img.decoding = 'async';
        const settle = () => {
          images[index] = img;
          loaded[index] = true;
          decodedCount += 1;
          advanceHead();
          resolve(index);
        };
        img.onload = () => {
          if (img.decode) img.decode().then(settle, settle);
          else settle();
        };
        img.onerror = () => resolve(-1);
        img.src = framePath(playlist[index], useMobile);
      });
      return promises[index];
    };

    /* Sliding window in playback order. Sequential order is what makes
       the buffer build ahead of the playhead; the previous strided
       order guaranteed holes exactly where the head was about to be. */
    const loadAll = async () => {
      let next = 0;
      const worker = async () => {
        while (!disposed && next < FRAME_COUNT) {
          const index = next;
          next += 1;
          // eslint-disable-next-line no-await-in-loop
          await loadFrame(index);
        }
      };
      await Promise.all(
        Array.from({ length: Math.min(FETCH_CONCURRENCY, FRAME_COUNT) }, worker)
      );
    };

    /* Nearest already-decoded frame — prevents blank flashes while
       the remaining batches are still streaming in. */
    const nearestLoaded = (index) => {
      if (loaded[index]) return index;
      for (let d = 1; d < FRAME_COUNT; d += 1) {
        if (index - d >= 0 && loaded[index - d]) return index - d;
        if (index + d < FRAME_COUNT && loaded[index + d]) return index + d;
      }
      return -1;
    };

    const resizeCanvas = () => {
      const dpr = Math.min(window.devicePixelRatio || 1, 2);
      const w = Math.round(canvas.clientWidth * dpr);
      const h = Math.round(canvas.clientHeight * dpr);
      if (w > 0 && h > 0 && (canvas.width !== w || canvas.height !== h)) {
        canvas.width = w;
        canvas.height = h;
        lastDrawn = -1;
      }
    };

    /* Frames carry alpha, so the canvas is CLEARED rather than filled —
       the ember atmosphere behind it stays visible through the cutout. */
    const drawFrame = (index) => {
      const resolved = nearestLoaded(Math.max(0, Math.min(FRAME_COUNT - 1, index)));
      if (resolved < 0 || resolved === lastDrawn) return;
      const image = images[resolved];
      if (!image || !image.naturalWidth) return;

      const { width, height } = canvas;
      ctx.clearRect(0, 0, width, height);

      const scale = Math.min(width / image.naturalWidth, height / image.naturalHeight);
      const dw = image.naturalWidth * scale;
      const dh = image.naturalHeight * scale;
      ctx.drawImage(image, (width - dw) / 2, (height - dh) / 2, dw, dh);
      lastDrawn = resolved;
    };

    /* One monotonic readout: the download drives it until the assembly
       takes over, so the bar never jumps backwards when playback opens. */
    let shownProgress = 0;
    const setStatus = (raw) => {
      const progress = Math.max(shownProgress, Math.min(1, raw));
      shownProgress = progress;
      if (statusPercentRef.current) {
        statusPercentRef.current.textContent = `${Math.round(progress * 100)}%`;
      }
      if (progressFillRef.current) {
        progressFillRef.current.style.transform = `scaleX(${progress})`;
      }
      if (statusLabelRef.current) {
        let label = STATUS_STEPS[0].label;
        for (const step of STATUS_STEPS) if (progress >= step.at) label = step.label;
        if (statusLabelRef.current.textContent !== label) {
          statusLabelRef.current.textContent = label;
        }
      }
    };

    /* ---------- outro: logo reveal + loader fade out ---------- */
    let outroStarted = false;
    const runOutro = () => {
      if (outroStarted || disposed) return;
      outroStarted = true;

      gsap
        .timeline({
          onComplete: () => {
            document.body.classList.remove('is-loading');
            if (rootRef.current) rootRef.current.style.display = 'none';
            // Releases every gated <video> on the site. See utils/siteReady.
            markSiteReady();
          }
        })
        .to('.loader-stage', { scale: 0.92, opacity: 0, duration: 0.45, ease: 'power3.inOut' })
        .to('.loader-status', { opacity: 0, duration: 0.25 }, '<')
        .to('.loader-progress-bar', { opacity: 0, duration: 0.25 }, '<')
        .fromTo(
          '.loader-lockup',
          { opacity: 0, y: 18, clipPath: 'inset(0 100% 0 0)' },
          { opacity: 1, y: 0, clipPath: 'inset(0 0% 0 0)', duration: 0.7, ease: 'power3.out' },
          '-=0.2'
        )
        .to({}, { duration: 0.45 })
        .to('.vyewfinder-loader', { opacity: 0, duration: 0.55, ease: 'power2.inOut' });
    };

    /* ---------- reduced motion: hold one composed frame ---------- */
    if (reduced) {
      resizeCanvas();
      const finalIndex = FRAME_COUNT - 1;
      setStatus(1);
      loadFrame(finalIndex).then(() => {
        if (disposed) return;
        resizeCanvas();
        drawFrame(finalIndex);
        gsap.delayedCall(0.35, runOutro);
      });
      const onResizeReduced = () => {
        resizeCanvas();
        drawFrame(finalIndex);
      };
      window.addEventListener('resize', onResizeReduced);
      return () => {
        disposed = true;
        markSiteReady();
        window.removeEventListener('resize', onResizeReduced);
        gsap.killTweensOf('*');
        document.body.classList.remove('is-loading');
      };
    }

    /* ---------- animated path ---------- */
    resizeCanvas();

    /* Hide the camera stage while buffering — the user sees only the
       atmosphere + progress bar. Once every frame is decoded the stage
       fades in and the assembly plays with zero stutter. */
    const stageEl = root.querySelector('.loader-stage');
    if (stageEl) stageEl.style.opacity = '0';

    const progress = { value: 0 };
    let playback = null;

    const tick = () => {
      if (disposed) return;
      if (pageVisible) {
        const reachable = bufferedHead < 0 ? 0 : Math.min(targetFrame, bufferedHead);
        currentFrame += (reachable - currentFrame) * LERP_FACTOR;
        if (Math.abs(reachable - currentFrame) < 0.01) currentFrame = reachable;
        drawFrame(Math.round(currentFrame));
      }
      rafId = requestAnimationFrame(tick);
    };

    const startPlayback = () => {
      if (disposed || playback) return;
      /* Fade in the camera stage now that every frame is ready */
      if (stageEl) {
        gsap.to(stageEl, { opacity: 1, duration: 0.4, ease: 'power2.out' });
      }
      playback = gsap.to(progress, {
        value: 1,
        duration: SEQUENCE_DURATION,
        ease: 'power1.inOut',
        onUpdate: () => {
          targetFrame = progress.value * (FRAME_COUNT - 1);
          setStatus(progress.value);
        },
        onComplete: () => gsap.delayedCall(0.1, runOutro)
      });
    };

    const onResize = () => {
      resizeCanvas();
      drawFrame(Math.round(currentFrame));
    };
    const onVisibility = () => {
      pageVisible = !document.hidden;
    };

    window.addEventListener('resize', onResize);
    document.addEventListener('visibilitychange', onVisibility);
    rafId = requestAnimationFrame(tick);
    setStatus(0);

    /* Pre-paint frame 0 (hidden) so the canvas is primed. */
    loadFrame(0).then(() => {
      if (!disposed) drawFrame(0);
    });

    /* Report genuine download progress while buffering. */
    const bufferTarget = Math.ceil(FRAME_COUNT * PREBUFFER_RATIO);
    const progressPoll = setInterval(() => {
      if (playback) return;
      setStatus((decodedCount / FRAME_COUNT) * PREBUFFER_RATIO);
    }, 80);

    const openPlayback = () => {
      clearInterval(progressPoll);
      /* If the patience budget expired with barely anything decoded,
         the link cannot carry the sequence — go straight to outro. */
      if (bufferedHead < 2) {
        if (stageEl) stageEl.style.opacity = '1';
        runOutro();
        return;
      }
      /* All frames are decoded — start immediately (the fade-in of
         the stage happens inside startPlayback). */
      startPlayback();
    };

    /* Whichever comes first: enough buffer, or the patience budget. */
    const prebufferDeadline = setTimeout(openPlayback, PREBUFFER_TIMEOUT);
    const bufferWatch = setInterval(() => {
      if (disposed || playback) return;
      if (bufferedHead + 1 >= bufferTarget) {
        clearInterval(bufferWatch);
        clearTimeout(prebufferDeadline);
        openPlayback();
      }
    }, 60);

    /* Never let an asset failure strand the visitor on the loader. */
    loadAll().catch(openPlayback);

    /* Hard stop: the site must become reachable even if frames stall. */
    const failSafe = setTimeout(runOutro, link.verySlow ? 6000 : 9000);

    return () => {
      disposed = true;
      clearTimeout(failSafe);
      clearTimeout(prebufferDeadline);
      clearInterval(progressPoll);
      clearInterval(bufferWatch);
      cancelAnimationFrame(rafId);
      window.removeEventListener('resize', onResize);
      document.removeEventListener('visibilitychange', onVisibility);
      if (playback) playback.kill();
      document.body.classList.remove('is-loading');
      // Unmounting must never leave the gated media stranded.
      markSiteReady();
    };
  }, []);

  return (
    <div ref={rootRef} id="vyewfinder-loader" className="vyewfinder-loader">
      <div className="loader-atmosphere" aria-hidden="true">
        <span className="loader-watermark">VYEWFINDER</span>
        <div className="loader-ember-glow" />
        <div className="loader-grain" />
      </div>

      <div className="loader-content">
        <div className="loader-stage">
          <canvas ref={canvasRef} className="loader-canvas" aria-hidden="true" />
        </div>

        <img
          className={`loader-lockup ${isLight ? 'loader-lockup--vector' : ''}`}
          src={isLight ? LOGO_LIGHT : LOGO_DARK}
          alt="Vyewfinder Films"
        />

        <div className="loader-status">
          <span ref={statusLabelRef} className="loader-status-label" />
          <span ref={statusPercentRef} className="loader-status-percent" />
        </div>
        <div className="loader-progress-bar" aria-hidden="true">
          <div ref={progressFillRef} className="loader-progress-fill" />
        </div>
      </div>
    </div>
  );
};

export default Loader;
