import * as THREE from "three";
import { CONFIG } from "./config.js";
import { RoomEnvironment } from "three/addons/environments/RoomEnvironment.js";
import { GLTFLoader } from "three/addons/loaders/GLTFLoader.js";
import { mergeGeometries } from "three/addons/utils/BufferGeometryUtils.js";

/* =========================================================
   달빛암 — 3D 온라인 절
   - Three.js 로 절 마당, 대웅전, 석탑, 산신각, 공양간, 산책길
   - Supabase Realtime 으로 같은 법당 사람들 위치·인사 공유
   - Supabase 테이블(wishes)로 소원 연등 공유
   ========================================================= */

const $ = (id) => document.getElementById(id);
const rand = (a, b) => a + Math.random() * (b - a);
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/* ---------- 내 기록 (이 기기에만) ---------- */
const store = {
  get(k, d) { try { const v = JSON.parse(localStorage.getItem(k)); return v ?? d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
const today = new Date().toDateString();
const me = Object.assign({ day: today, look: "0-0-0", pts: 0, coin: null, owned: [], daily: null, nick: "", mok: 0, bow: 0, tap: 0, bead: 0, pray: 0, localWishes: [] }, store.get("sansa3d", {}));
if (me.coin === null || me.coin === undefined) me.coin = me.pts || 0;
if (!Array.isArray(me.owned)) me.owned = [];
if (me.day !== today) { me.day = today; me.mok = 0; me.bow = 0; }
const save = () => store.set("sansa3d", me);
const myKey = store.get("sansa3d-key", null) || (() => { const k = "m" + Math.random().toString(36).slice(2, 10); store.set("sansa3d-key", k); return k; })();

$("siteTitle").textContent = CONFIG.siteName;
/* 휴대폰 웹 · 인스타 앱 안에서 화면이 밀려 위쪽 버튼이 가려지지 않게 */
{
  const SCROLLABLE = ".panel-card,.chat-log,.gate,.wish-list,.actions,.places,.menu-list,.room-names,.look-opts,.pray-lines";
  document.addEventListener("touchmove", (e) => { if (!e.target.closest || !e.target.closest(SCROLLABLE)) e.preventDefault(); }, { passive: false });
  const pin = () => { if (window.scrollX || window.scrollY) window.scrollTo(0, 0); const vv = window.visualViewport; document.documentElement.style.setProperty("--vvt", `${vv ? Math.max(0, vv.offsetTop) : 0}px`); document.documentElement.style.setProperty("--vh", `${vv ? vv.height : window.innerHeight}px`); };
  window.addEventListener("scroll", pin, { passive: true }); window.visualViewport?.addEventListener("resize", pin); window.visualViewport?.addEventListener("scroll", pin); window.addEventListener("orientationchange", () => setTimeout(pin, 300)); pin();
}
document.title = CONFIG.siteName;
$("nickInput").value = me.nick || "";

const sayings = [
  "걱정은 내일의 몫으로 남겨 두어도 괜찮아요.", "천천히 들이쉬고, 길게 내쉬어 보세요.", "오늘 하루도 충분히 애썼어요.",
  "지나간 일은 바람처럼 흘려보내요.", "작은 친절 하나가 큰 복이 됩니다.", "지금 이 순간에 머물러 보세요.",
  "마음이 고요하면 길이 보여요.", "비우면 비로소 채워집니다.", "남과 비교하지 않는 하루가 편안한 하루예요.",
  "화가 날 땐 세 번 숨을 쉬고 말해요.", "내가 나에게 다정해지는 연습을 해요."
];
const say = (t) => { $("saying").textContent = t || sayings[Math.floor(Math.random() * sayings.length)]; };

/* =========================================================
   소리 (모두 브라우저에서 직접 합성 — 음원 파일 없음)
   ========================================================= */
let ctx, master, noiseBuf, softBuf;
const vol = { wind: 0, water: 0, bird: .3, chime: .25, fx: .8 }; // 바람 · 계곡물은 기본으로 꺼 둬요 (휴대폰 스피커에서 잡음처럼 들려서)
function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
    // 바람 · 물소리용 부드러운 잡음 (갈색 잡음, 길게 만들어 반복 티가 안 나게)
    const m = ctx.sampleRate * 9; softBuf = ctx.createBuffer(1, m, ctx.sampleRate);
    const e = softBuf.getChannelData(0); let last = 0; for (let i = 0; i < m; i++) { last = (last + .02 * (Math.random() * 2 - 1)) / 1.02; e[i] = last * 3.2; }
    const fadeN = ctx.sampleRate * .5; for (let i = 0; i < fadeN; i++) { const k = i / fadeN; e[m - fadeN + i] = e[m - fadeN + i] * (1 - k) + e[i] * k; }
  }
  if (ctx.state === "suspended") ctx.resume();
  return ctx;
}
function tone(freq, dur, v, type = "sine", delay = 0) {
  const c = ac(), t = c.currentTime + delay, o = c.createOscillator(), g = c.createGain();
  o.type = type; o.frequency.value = freq;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .01); g.gain.exponentialRampToValueAtTime(.0001, t + dur);
  o.connect(g).connect(master); o.start(t); o.stop(t + dur + .05);
}
/* ---------- 진짜 녹음 파일 (sounds 폴더에 넣으면 자동으로 사용) ----------
   sounds/chant.mp3   염불 (반복 재생)
   sounds/moktak.mp3  목탁 한 번 치는 소리
   sounds/bell.mp3    범종 한 번
   sounds/nature.mp3  산사 자연 소리 (반복 재생)
   sounds 폴더 없이 맨 바깥에 올려도 찾아요.
   파일이 없으면 브라우저가 만든 소리로 대신해요. */
const rec = {}, recTried = {};
async function loadRec(name) {
  if (name in rec) return rec[name];
  if (recTried[name]) return recTried[name];
  recTried[name] = (async () => {
    rec[name] = null;
    for (const path of [`sounds/${name}.mp3`, `${name}.mp3`]) {
      try { const r = await fetch(path); if (!r.ok) continue; rec[name] = await ac().decodeAudioData(await r.arrayBuffer()); break; } catch {}
    }
    return rec[name];
  })();
  return recTried[name];
}
function playRec(name, v = 1, loop = false) {
  const buf = rec[name]; if (!buf) return null;
  const c = ac(), s = c.createBufferSource(), g = c.createGain(); s.buffer = buf; s.loop = loop; g.gain.value = v;
  s.connect(g).connect(master); s.start(); return { s, g };
}
function preloadRecs() { ["moktak", "bell", "pung"].forEach(loadRec); ["chant", "nature", "yebul"].forEach(findSound); }
// 녹음 파일의 한 부분만 잠깐 (풍경처럼 긴 녹음에서 한 번 흔들리는 소리만)
function playRecSlice(name, off, dur, v = 1) {
  const buf = rec[name]; if (!buf) return false;
  const c = ac(), s = c.createBufferSource(), g = c.createGain(), t = c.currentTime; s.buffer = buf;
  g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(v, t + .03); g.gain.setValueAtTime(v, t + dur * .55); g.gain.linearRampToValueAtTime(0, t + dur);
  s.connect(g).connect(master); s.start(t, Math.min(off, buf.duration - dur), dur + .05); return true;
}
const PUNG_ON = [.16, 1.32, 3.16, 4.82, 7.4, 8.54, 9.88, 11.6, 12.9, 14.0]; // 풍경 녹음 속 흔들림 시작점

/* ---------- 휴대폰 소리 문제 해결 ----------
   아이폰은 무음 모드일 때 웹에서 만든 소리를 꺼 버려요.
   입장 버튼을 누를 때 '음악 재생' 모드로 바꾸고, 긴 염불·자연 소리는 <audio>로 틀어서
   무음 스위치와 메모리 문제를 피해요. */
const soundUrl = {};
function findSound(name) {
  if (name in soundUrl) return Promise.resolve(soundUrl[name]);
  return (async () => {
    for (const path of [`sounds/${name}.mp3`, `${name}.mp3`]) {
      try { const r = await fetch(path, { method: "HEAD" }); const ct = r.headers.get("content-type") || ""; if (r.ok && /audio|mpeg|octet/.test(ct)) { soundUrl[name] = path; return path; } } catch {}
    }
    soundUrl[name] = null; return null;
  })();
}
const loopEls = {};
function loopAudio(name, v) {
  const url = soundUrl[name]; if (!url) return null;
  let el = loopEls[name];
  if (!el) { el = new Audio(url); el.loop = true; el.preload = "auto"; el.setAttribute("playsinline", ""); loopEls[name] = el; }
  el.volume = clamp(v, 0, 1); el.play().catch(() => toast("소리가 나지 않으면 무음 모드를 끄고 음량을 올려 주세요"));
  return el;
}
function silentWavUrl() {
  const n = 4410, b = new ArrayBuffer(44 + n * 2), d = new DataView(b), w = (o, t) => [...t].forEach((c, i) => d.setUint8(o + i, c.charCodeAt(0)));
  w(0, "RIFF"); d.setUint32(4, 36 + n * 2, true); w(8, "WAVEfmt "); d.setUint32(16, 16, true); d.setUint16(20, 1, true); d.setUint16(22, 1, true);
  d.setUint32(24, 44100, true); d.setUint32(28, 88200, true); d.setUint16(32, 2, true); d.setUint16(34, 16, true); w(36, "data"); d.setUint32(40, n * 2, true);
  return URL.createObjectURL(new Blob([b], { type: "audio/wav" }));
}
let unlocked = false;
function unlockAudio() {
  if (unlocked) return; unlocked = true;
  try { if (navigator.audioSession) navigator.audioSession.type = "playback"; } catch {}
  try { const el = new Audio(silentWavUrl()); el.loop = true; el.volume = .01; el.setAttribute("playsinline", ""); el.play().catch(() => {}); } catch {}
  ac();
}
document.addEventListener("touchend", unlockAudio, { once: true, passive: true });
document.addEventListener("click", unlockAudio, { once: true });
findSound("chant"); findSound("nature");

const sfx = {
  mok() {
    if (rec.moktak) { playRec("moktak", vol.fx); return; }
    // 나무를 두드리는 소리: 짧은 마찰음 + 속이 빈 나무의 울림
    const c = ac(), t = c.currentTime;
    const n = c.createBufferSource(); n.buffer = noiseBuf; const nf = c.createBiquadFilter(), ng = c.createGain();
    nf.type = "bandpass"; nf.frequency.value = 1500; nf.Q.value = 3;
    ng.gain.setValueAtTime(.5 * vol.fx, t); ng.gain.exponentialRampToValueAtTime(.001, t + .03);
    n.connect(nf).connect(ng).connect(master); n.start(t, rand(0, 1.5)); n.stop(t + .05);
    [[520, .55, .11], [1040 * 1.02, .18, .06], [355, .3, .16]].forEach(([f, v, d]) => {
      const o = c.createOscillator(), g = c.createGain(); o.type = "sine";
      o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + .02);
      g.gain.setValueAtTime(v * vol.fx, t); g.gain.exponentialRampToValueAtTime(.0001, t + d);
      o.connect(g).connect(master); o.start(t); o.stop(t + d + .02);
    });
  },
  bell() {
    if (rec.bell) { playRec("bell", vol.fx); return; }
    // 범종: 낮은 울림이 천천히 커졌다 작아지는 맥놀이
    const c = ac(), t = c.currentTime;
    const th = c.createBufferSource(); th.buffer = noiseBuf; const tf = c.createBiquadFilter(), tg = c.createGain();
    tf.type = "lowpass"; tf.frequency.value = 160; tg.gain.setValueAtTime(.6 * vol.fx, t); tg.gain.exponentialRampToValueAtTime(.001, t + .25);
    th.connect(tf).connect(tg).connect(master); th.start(t); th.stop(t + .3);
    [[64, .32, 14], [64.6, .32, 14], [128.4, .14, 9], [168, .1, 7], [211, .06, 5], [348, .03, 3.5]].forEach(([f, v, d]) => tone(f, d, v * vol.fx));
  },
  soft() { tone(523, 1.2, .07 * vol.fx); tone(784, 1.2, .04 * vol.fx, "sine", .15); },
  bead() { tone(1300, .07, .06 * vol.fx, "triangle"); },
  pung(soft) { if (playRecSlice("pung", PUNG_ON[Math.random() * PUNG_ON.length | 0], soft ? 2.2 : 3.2, (soft ? .45 : 1) * Math.max(vol.fx, .5))) return; const b = rand(1750, 2050); [[b, .16, 3.2], [b * 2.76, .06, 1.8], [b * 5.4, .025, .9], [b * 1.003, .1, 3.4]].forEach(([f, v, d], i) => tone(f, d, v * Math.max(vol.fx, .5), "sine", i ? .005 : 0)); },
  chime() { tone(rand(1700, 2600), 2.2, .12 * vol.chime); tone(rand(2600, 3200), 1.5, .05 * vol.chime, "sine", .03); },
  bird() { const c = ac(), t = c.currentTime, o = c.createOscillator(), g = c.createGain(), b = rand(2400, 3800);
    o.frequency.setValueAtTime(b, t); o.frequency.exponentialRampToValueAtTime(b * 1.4, t + .08); o.frequency.exponentialRampToValueAtTime(b * .9, t + .16);
    g.gain.setValueAtTime(0, t); g.gain.linearRampToValueAtTime(.05 * vol.bird, t + .02); g.gain.exponentialRampToValueAtTime(.0001, t + .2);
    o.connect(g).connect(master); o.start(t); o.stop(t + .25); }
};
const loops = {};
function noiseLoop(kind) {
  const c = ac();
  if (!loops[kind]) {
    if (!vol[kind]) return; // 꺼져 있으면 아예 만들지 않아요
    const s = c.createBufferSource(); s.buffer = softBuf; s.loop = true; s.loopEnd = softBuf.duration - .5;
    const f = c.createBiquadFilter(), g = c.createGain(); g.gain.value = 0;
    if (kind === "wind") { f.type = "lowpass"; f.frequency.value = 300; f.Q.value = .3; const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = .08; lg.gain.value = 120; l.connect(lg).connect(f.frequency); l.start(); }
    else { f.type = "lowpass"; f.frequency.value = 900; f.Q.value = .2; s.playbackRate.value = 1.6; }
    s.connect(f).connect(g).connect(master); s.start(rand(0, 1)); loops[kind] = g;
  }
  loops[kind].gain.setTargetAtTime(vol[kind] * (kind === "wind" ? .35 : .22), c.currentTime, .6);
}
[["vWind", "wind"], ["vWater", "water"], ["vBird", "bird"], ["vChime", "chime"], ["vFx", "fx"]].forEach(([id, k]) => {
  $(id).addEventListener("input", (e) => { vol[k] = e.target.value / 100; if (ctx && (k === "wind" || k === "water")) { noiseLoop(k); if (natureRec) natureRec.volume = clamp(.6 * Math.max(vol.wind, vol.water), 0, 1); } });
});
setInterval(() => {
  if (!ctx || !player) return;
  const nearWalk = zoneOf(player.pos.x, player.pos.z) === "walk";
  if (vol.bird && Math.random() < .3 * vol.bird + (nearWalk ? .25 : .05)) { sfx.bird(); setTimeout(sfx.bird, 170); }
  if (vol.chime && Math.random() < .2 * vol.chime + .05) { if (rec.pung) sfx.pung(true); else sfx.chime(); const p = pungs[Math.random() * pungs.length | 0]; if (p && !p.userData.amp) { p.userData.amp = .22; p.userData.t0 = performance.now(); } }
}, 1500);

let chantTimer = null, chantRec = null, natureRec = null;
function stopChant() {
  if (chantTimer) { clearInterval(chantTimer); chantTimer = null; }
  if (chantRec) { const el = chantRec; let v = el.volume; const fade = setInterval(() => { v -= .08; if (v <= 0) { clearInterval(fade); el.pause(); } else el.volume = v; }, 60); chantRec = null; }
  $("chantBtn").textContent = "염불"; $("chantBtn").classList.remove("on");
}
$("chantBtn").addEventListener("click", () => {
  unlockAudio(); ac();
  if (chantTimer || chantRec) { stopChant(); return; }
  $("chantBtn").textContent = "염불 끄기"; $("chantBtn").classList.add("on");
  // 버튼을 누른 그 순간에 바로 틀어야 휴대폰이 막지 않아요 (파일 주소는 입장할 때 미리 찾아 둬요)
  if (soundUrl.chant) { chantRec = loopAudio("chant", .9 * vol.fx); if (chantRec) return; }
  // 녹음 파일이 없을 때: 염불할 때 치는 목탁 박자만 들려줘요
  let i = 0; const beat = () => { sfx.mok(); i++; };
  beat(); chantTimer = setInterval(beat, 820);
});


/* =========================================================
   3D 장면
   ========================================================= */
const canvas = $("world");
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
const scene = new THREE.Scene();
scene.background = new THREE.Color("#18202c");
scene.fog = new THREE.Fog("#18202c", 28, 70);
const camera = new THREE.PerspectiveCamera(55, 1, .1, 200);

const hemi = new THREE.HemisphereLight("#8fa6c8", "#2a2018", .9); scene.add(hemi);
const moon = new THREE.DirectionalLight("#dfe6ff", .9); moon.position.set(-20, 30, 10); scene.add(moon);

const M = (color, extra = {}) => new THREE.MeshStandardMaterial(Object.assign({ color, roughness: .85 }, extra));
const mat = {
  ground: M("#4b4236"), stone: M("#8d8f93", { roughness: .95 }), darkStone: M("#6c6e72"), wood: M("#5b3a26"), floor: M("#3b2a1e"),
  pillar: M("#7a2a20"), wall: M("#efe6d2"), roofTile: M("#2b313b"), green: M("#3f8f7d"), gold: M("#d9b44a", { metalness: .6, roughness: .35 }),
  mural: M("#5a2018"), leaf: M("#24463a"), leaf2: M("#1f3a2c"), trunk: M("#3a2a1e"), water: M("#2c5266", { roughness: .2, metalness: .1 }),
  cushion: M("#3c3a36"), skin: M("#c4825a", { roughness: .7 }), robe: M("#c9ccd2"), sash: M("#d9b44a", { roughness: .7 }), eye: M("#2a1810"),
  lantern: new THREE.MeshStandardMaterial({ color: "#f2a65a", emissive: "#f28a3a", emissiveIntensity: 1.2 }),
  flame: new THREE.MeshBasicMaterial({ color: "#ffcf73" }), candle: M("#f2e6c8")
};
/* ---------- 재질을 실제처럼: 직접 그린 질감 ---------- */
function canvasTex(w, h, draw, rx = 1, ry = 1) {
  const c = document.createElement("canvas"); c.width = w; c.height = h; draw(c.getContext("2d"), w, h);
  const t = new THREE.CanvasTexture(c); t.colorSpace = THREE.SRGBColorSpace; t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(rx, ry); t.anisotropy = 4; return t;
}
const noise = (x, w, h, base, spread, n = 9000, sz = 3) => { x.fillStyle = base; x.fillRect(0, 0, w, h); for (let i = 0; i < n; i++) { const v = (Math.random() - .5) * spread; x.fillStyle = v > 0 ? `rgba(255,255,255,${v})` : `rgba(0,0,0,${-v})`; x.fillRect(Math.random() * w, Math.random() * h, sz * Math.random() + 1, sz * Math.random() + 1); } };
const TEX = {
  wood: canvasTex(512, 512, (x, w, h) => {
    x.fillStyle = "#4a3020"; x.fillRect(0, 0, w, h);
    for (let p = 0; p < 8; p++) { const y0 = p * 64; x.fillStyle = `hsl(25,${35 + (p % 3) * 5}%,${17 + (p * 7) % 6}%)`; x.fillRect(0, y0, w, 62);
      for (let g = 0; g < 26; g++) { x.strokeStyle = `rgba(0,0,0,${.08 + Math.random() * .12})`; x.lineWidth = 1 + Math.random() * 1.5; x.beginPath(); const yy = y0 + Math.random() * 62; x.moveTo(0, yy); for (let xx = 0; xx <= w; xx += 32) x.lineTo(xx, yy + Math.sin(xx * .02 + g) * 2.5); x.stroke(); }
      x.fillStyle = "rgba(0,0,0,.55)"; x.fillRect(0, y0 + 62, w, 2); x.fillRect((p * 173) % w, y0, 2, 62); }
  }, 3, 3),
  ground: canvasTex(512, 512, (x, w, h) => noise(x, w, h, "#5a4d3c", .22, 14000, 3), 40, 40),
  stone: canvasTex(256, 256, (x, w, h) => { noise(x, w, h, "#8d8f93", .25, 5000, 2); x.strokeStyle = "rgba(0,0,0,.25)"; x.lineWidth = 2; for (let r = 0; r < 4; r++) { x.beginPath(); x.moveTo(0, r * 64); x.lineTo(w, r * 64); x.stroke(); for (let c = 0; c < 3; c++) { const xx = (c * 96 + (r % 2) * 48) % w; x.beginPath(); x.moveTo(xx, r * 64); x.lineTo(xx, r * 64 + 64); x.stroke(); } } }, 2, 1),
  roof: canvasTex(256, 256, (x, w, h) => { x.fillStyle = "#2a3038"; x.fillRect(0, 0, w, h); for (let i = 0; i < 16; i++) { const gr = x.createLinearGradient(i * 16, 0, i * 16 + 16, 0); gr.addColorStop(0, "#1c2128"); gr.addColorStop(.5, "#4a525e"); gr.addColorStop(1, "#1c2128"); x.fillStyle = gr; x.fillRect(i * 16, 0, 16, h); } for (let j = 0; j < 8; j++) { x.fillStyle = "rgba(0,0,0,.35)"; x.fillRect(0, j * 32, w, 3); } }, 6, 2),
  dancheong: canvasTex(512, 64, (x, w, h) => {
    x.fillStyle = "#2f7d6a"; x.fillRect(0, 0, w, h); x.fillStyle = "#c23a2c"; x.fillRect(0, 0, w, 7); x.fillRect(0, h - 7, w, 7);
    for (let i = 0; i < 8; i++) { const cx = 32 + i * 64, cy = h / 2;
      x.fillStyle = "#f3eee3"; x.beginPath(); x.arc(cx, cy, 20, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#c23a2c"; for (let k = 0; k < 8; k++) { x.beginPath(); x.ellipse(cx + Math.cos(k * Math.PI / 4) * 11, cy + Math.sin(k * Math.PI / 4) * 11, 6, 3, k * Math.PI / 4, 0, Math.PI * 2); x.fill(); }
      x.fillStyle = "#e8b84a"; x.beginPath(); x.arc(cx, cy, 5, 0, Math.PI * 2); x.fill();
      x.fillStyle = "#2a4f8a"; x.beginPath(); x.moveTo(cx + 26, 10); x.lineTo(cx + 38, cy); x.lineTo(cx + 26, h - 10); x.lineTo(cx + 32, cy); x.fill(); }
  }, 4, 1),
  pillar: canvasTex(64, 256, (x, w, h) => { noise(x, w, h, "#7a2a20", .18, 1500, 2); for (let i = 0; i < 18; i++) { x.strokeStyle = "rgba(0,0,0,.12)"; x.beginPath(); x.moveTo(Math.random() * w, 0); x.lineTo(Math.random() * w, h); x.stroke(); } }, 1, 1)
};
mat.floor.map = TEX.wood; mat.floor.color.set("#ffffff"); mat.floor.roughness = .6;
mat.wood.map = TEX.wood; mat.wood.color.set("#c8a888");
mat.ground.map = TEX.ground; mat.ground.color.set("#ffffff");
mat.stone.map = TEX.stone; mat.stone.color.set("#ffffff"); mat.darkStone.map = TEX.stone;
mat.roofTile.map = TEX.roof; mat.roofTile.color.set("#ffffff");
mat.green.map = TEX.dancheong; mat.green.color.set("#ffffff");
mat.pillar.map = TEX.pillar; mat.pillar.color.set("#ffffff");
mat.cushion.color.set("#5a2a2a"); mat.cushion.roughness = .95;

/* 금빛이 실제 금속처럼 주변을 비추게 하는 반사 환경 */
const pmrem = new THREE.PMREMGenerator(renderer);
const goldEnv = pmrem.fromScene(new RoomEnvironment(), .04).texture;
// 오래된 금동불 표면: 얼룩진 금빛 + 거칠기 차이 + 미세한 두드림 자국
const goldMaps = (() => {
  const S = 256, mk = (draw, srgb) => { const c = document.createElement("canvas"); c.width = c.height = S; draw(c.getContext("2d")); const t = new THREE.CanvasTexture(c); t.wrapS = t.wrapT = THREE.RepeatWrapping; t.repeat.set(2, 2); if (srgb) t.colorSpace = THREE.SRGBColorSpace; return t; };
  const blot = (x, n, cols, a0, a1, r0, r1) => { for (let i = 0; i < n; i++) { const px = Math.random() * S, py = Math.random() * S, r = r0 + Math.random() * (r1 - r0), c = cols[i % cols.length], a = a0 + Math.random() * (a1 - a0);
    for (const [ox, oy] of [[0, 0], [S, 0], [-S, 0], [0, S], [0, -S]]) { const g = x.createRadialGradient(px + ox, py + oy, 0, px + ox, py + oy, r); g.addColorStop(0, `rgba(${c},${a})`); g.addColorStop(1, `rgba(${c},0)`); x.fillStyle = g; x.fillRect(px + ox - r, py + oy - r, r * 2, r * 2); } } };
  const color = mk((x) => { x.fillStyle = "#e0b45e"; x.fillRect(0, 0, S, S); blot(x, 60, ["120,80,30", "255,225,150", "90,60,25"], .08, .22, 10, 46); for (let i = 0; i < 2500; i++) { x.fillStyle = Math.random() < .5 ? "rgba(80,50,15,.12)" : "rgba(255,235,170,.12)"; x.fillRect(Math.random() * S, Math.random() * S, 1.5, 1.5); } }, true);
  const rough = mk((x) => { x.fillStyle = "rgb(70,70,70)"; x.fillRect(0, 0, S, S); blot(x, 70, ["160,160,160", "40,40,40"], .25, .5, 8, 40); for (let i = 0; i < 3000; i++) { const v = 60 + Math.random() * 80 | 0; x.fillStyle = `rgba(${v},${v},${v},.35)`; x.fillRect(Math.random() * S, Math.random() * S, 2, 2); } });
  const bump = mk((x) => { x.fillStyle = "#808080"; x.fillRect(0, 0, S, S); blot(x, 140, ["255,255,255", "0,0,0"], .05, .14, 3, 12); for (let i = 0; i < 4000; i++) { const v = Math.random() * 255 | 0; x.fillStyle = `rgba(${v},${v},${v},.18)`; x.fillRect(Math.random() * S, Math.random() * S, 1, 1); } });
  return { color, rough, bump };
})();
const GOLD = new THREE.MeshStandardMaterial({ color: "#ffffff", map: goldMaps.color, metalness: 1, roughness: 1, roughnessMap: goldMaps.rough, bumpMap: goldMaps.bump, bumpScale: .6, envMap: goldEnv, envMapIntensity: 1.15 });
const GOLD_DARK = new THREE.MeshStandardMaterial({ color: "#7a5620", map: goldMaps.color, metalness: .85, roughness: .55, envMap: goldEnv, envMapIntensity: .55 });
const HAIR = new THREE.MeshStandardMaterial({ color: "#26314a", metalness: .3, roughness: .55, envMap: goldEnv, envMapIntensity: .5 });
mat.gold = GOLD;

const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
const cyl = (rt, rb, h, m, x, y, z, seg = 12, parent = scene) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); parent.add(o); return o; };

/* 땅과 산 */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat.ground); ground.rotation.x = -Math.PI / 2; scene.add(ground);
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2, r = rand(55, 70);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rand(14, 24), rand(14, 26), 6), M(i % 2 ? "#1d2633" : "#222d3a"));
  m.position.set(Math.cos(a) * r, 5, Math.sin(a) * r); scene.add(m);
}
let starField = null;
const moonBall = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: "#efe6cc" }));
moonBall.position.set(-40, 38, -60); scene.add(moonBall);
// 별
{ const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 500; i++) { const a = rand(0, Math.PI * 2), e = rand(.15, 1.3), r = 90; p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  starField = new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff4d6", size: .35, fog: false, transparent: true })); scene.add(starField); }

/* 길 */
for (let z = -11; z < 40; z += 1.3) box(2.2, .06, 1, mat.darkStone, Math.sin(z * .15) * (z > 10 ? 1.5 : 0), .03, z);
box(30, .04, 22, M("#5a5044"), 0, .02, 0); // 마당 흙

/* 장애물(충돌) 목록 */
const blockers = []; // {x1,x2,z1,z2}
const block = (x1, x2, z1, z2) => blockers.push({ x1, x2, z1, z2 });

/* 전각 만들기 */
const camSolidGroups = []; // 카메라가 뚫고 들어가면 안 되는 건물들
/* ---------- 한옥 지붕: 오목하게 휘고 처마 끝이 살짝 들린 우진각 지붕 ---------- */
const ROOF_TEX = canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = "#2a2f37"; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 8; i++) { const cx = i * 32; const g = x.createLinearGradient(cx, 0, cx + 32, 0); g.addColorStop(0, "#1c2027"); g.addColorStop(.35, "#4a515c"); g.addColorStop(.6, "#3a414b"); g.addColorStop(1, "#1c2027"); x.fillStyle = g; x.fillRect(cx, 0, 32, h); }
  x.fillStyle = "rgba(0,0,0,.35)"; for (let j = 0; j < 8; j++) x.fillRect(0, j * 32 + 28, w, 3);
  for (let i = 0; i < 900; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .05})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
});
const ROOF_TOP = new THREE.MeshStandardMaterial({ map: ROOF_TEX, color: "#b9c0cc", roughness: .7, metalness: .05, side: THREE.DoubleSide });
const EAVE_TEX = canvasTex(256, 64, (x, w, h) => { // 처마 밑: 서까래와 단청
  x.fillStyle = "#3d5e4c"; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 16; i++) { const cx = i * 16 + 8; x.fillStyle = "#6a2a1e"; x.fillRect(cx - 4, 0, 8, h); x.fillStyle = "#e9c46a"; x.fillRect(cx - 4, h - 10, 8, 4); x.fillStyle = "#2f7d6b"; x.fillRect(cx - 4, h - 6, 8, 6); }
});
EAVE_TEX.repeat.set(.25, .35);
const ROOF_UNDER = new THREE.MeshStandardMaterial({ map: EAVE_TEX, emissiveMap: EAVE_TEX, emissive: "#ffffff", emissiveIntensity: .18, roughness: .9, side: THREE.DoubleSide });
const RIDGE_M = new THREE.MeshStandardMaterial({ color: "#23272e", roughness: .7 });
const PUNG_CAP_M = new THREE.MeshStandardMaterial({ color: "#3d434c", roughness: .6 });
const PLASTER_M = new THREE.MeshStandardMaterial({ color: "#e8e2d4", roughness: .9 });
const pungs = []; // 처마 끝 풍경들
function koreanRoof(A, B, H, parent, y0, { lift = .9 } = {}) {
  const R = Math.max(0, A - B), per = 4 * (A + B), N = 160, M = 12;
  const eave = (p) => { let s = p * per; // 둘레를 따라 한 바퀴: 앞(+z) → 오른쪽 → 뒤 → 왼쪽
    if (s < 2 * A) return [-A + s, B]; s -= 2 * A; if (s < 2 * B) return [A, B - s]; s -= 2 * B; if (s < 2 * A) return [A - s, -B]; s -= 2 * A; return [-A, -B + s]; };
  const corner = (ex, ez) => { const dx = A - Math.abs(ex), dz = B - Math.abs(ez), dd = Math.hypot(dx, dz); return Math.max(0, 1 - dd / (Math.min(A, B) * .55)) ** 2; };
  const P = (p, d) => { const [ex, ez] = eave(p), ax = clamp(ex, -R, R), c = corner(ex, ez), fl = 1 + .05 * c * d ** 4;
    return new THREE.Vector3((ax + (ex - ax) * d) * fl, H * (1 - d) ** 1.45 + lift * c * d ** 4, ez * d * fl); };
  const pos = [], uv = [], idx = [];
  for (let i = 0; i <= N; i++) for (let j = 0; j <= M; j++) { const v = P(i / N, j / M); pos.push(v.x, v.y, v.z); uv.push(i / N * per / 1.4, j / M * Math.hypot(H, B) / 1.4); }
  for (let i = 0; i < N; i++) for (let j = 0; j < M; j++) { const a = i * (M + 1) + j, b = a + M + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
  const geo = new THREE.BufferGeometry(); geo.setAttribute("position", new THREE.Float32BufferAttribute(pos, 3)); geo.setAttribute("uv", new THREE.Float32BufferAttribute(uv, 2)); geo.setIndex(idx); geo.computeVertexNormals();
  const g = new THREE.Group(); g.position.y = y0; g.userData.noCam = A > 10; parent.add(g); // 큰 법당 처마 밑에서는 카메라를 당기지 않아요
  g.add(new THREE.Mesh(geo, ROOF_TOP));
  const under = new THREE.Mesh(geo, ROOF_UNDER); under.position.y = -.12; g.add(under);
  // 용마루 (흰 회반죽 띠 위 검은 기와)
  if (R > 0) { const rl = 2 * R + .5; box(rl, .22, .5, PLASTER_M, 0, H + .02, 0, g); box(rl + .2, .26, .42, RIDGE_M, 0, H + .24, 0, g);
    [-1, 1].forEach((sd) => { const o = new THREE.Mesh(new THREE.ConeGeometry(.22, .7, 8), RIDGE_M); o.position.set(sd * (R + .3), H + .55, 0); o.rotation.z = -sd * .5; g.add(o); }); }
  // 내림마루 (네 귀로 내려가는 마루)
  const corners = [[A, B], [A, -B], [-A, -B], [-A, B]];
  corners.forEach(([cx, cz]) => {
    const pts = []; for (let j = 0; j <= 10; j++) { const d = j / 10, ax = clamp(cx, -R, R), fl = 1 + .05 * d ** 4; pts.push(new THREE.Vector3((ax + (cx - ax) * d) * fl, H * (1 - d) ** 1.45 + lift * d ** 4 + .12, cz * d * fl)); }
    g.add(new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts), 20, clamp(Math.min(A, B) * .014, .06, .13), 8), RIDGE_M));
  });
  // 네 귀 끝에 매단 풍경
  return corners.map(([cx, cz]) => { const fl = 1.05; return new THREE.Vector3(cx * fl, y0 + lift - .05, cz * fl); });
}
const PUNG_M = new THREE.MeshStandardMaterial({ color: "#6f7d68", metalness: .7, roughness: .35, side: THREE.DoubleSide });
const PUNG_FISH = new THREE.MeshStandardMaterial({ color: "#c9cdd2", metalness: .7, roughness: .3, side: THREE.DoubleSide });
const pungBellGeo = new THREE.LatheGeometry([[0, -.33], [.15, -.33], [.13, -.3], [.1, -.12], [.07, -.02], [0, 0]].map(([r, y]) => new THREE.Vector2(r, y)), 16);
const fishShape = new THREE.Shape(); fishShape.moveTo(0, 0); fishShape.quadraticCurveTo(.12, .08, .24, 0); fishShape.lineTo(.32, .07); fishShape.lineTo(.32, -.07); fishShape.lineTo(.24, 0); fishShape.quadraticCurveTo(.12, -.08, 0, 0);
const fishGeo = new THREE.ShapeGeometry(fishShape); fishGeo.translate(-.16, 0, 0);
const pungHitM = new THREE.MeshBasicMaterial({ visible: false });
function addPung(parent, at, sc = 1) {
  const g = new THREE.Group(); g.position.copy(at); g.scale.setScalar(sc); parent.add(g);
  const str = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .35, 4), RIDGE_M); str.position.y = -.17; g.add(str);
  const bellM = new THREE.Mesh(pungBellGeo, PUNG_M); bellM.position.y = -.33; g.add(bellM);
  const clap = new THREE.Mesh(new THREE.CylinderGeometry(.006, .006, .35, 4), RIDGE_M); clap.position.y = -.75; g.add(clap);
  const fish = new THREE.Mesh(fishGeo, PUNG_FISH); fish.position.y = -.95; fish.rotation.z = Math.PI / 2; g.add(fish);
  const hit = new THREE.Mesh(new THREE.SphereGeometry(.9, 8, 6), pungHitM); hit.position.y = -.6; hit.userData.pung = g; g.add(hit);
  g.userData = { amp: 0, ph: Math.random() * 6, fish }; pungs.push(g); return g;
}
const COFFER_TEX = canvasTex(256, 256, (x, w, h) => { // 우물천장: 칸마다 연꽃 단청
  x.fillStyle = "#2c5545"; x.fillRect(0, 0, w, h);
  x.fillStyle = "#8a2a20"; x.fillRect(0, 0, w, 14); x.fillRect(0, 0, 14, h);
  x.fillStyle = "#e9c46a"; x.fillRect(14, 14, w - 14, 3); x.fillRect(14, 14, 3, h - 14);
  const c = w / 2 + 7; x.fillStyle = "#1f4236"; x.fillRect(28, 28, w - 42, h - 42);
  for (let k = 0; k < 8; k++) { x.save(); x.translate(c, c); x.rotate(k / 8 * Math.PI * 2); x.fillStyle = "#e88aa4"; x.beginPath(); x.ellipse(0, -52, 20, 40, 0, 0, Math.PI * 2); x.fill(); x.fillStyle = "#f6e3c8"; x.beginPath(); x.ellipse(0, -48, 9, 24, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  for (let k = 0; k < 8; k++) { x.save(); x.translate(c, c); x.rotate((k + .5) / 8 * Math.PI * 2); x.fillStyle = "#3f9a7f"; x.beginPath(); x.ellipse(0, -70, 10, 22, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  x.fillStyle = "#e9c46a"; x.beginPath(); x.arc(c, c, 18, 0, Math.PI * 2); x.fill(); x.fillStyle = "#c0392b"; x.beginPath(); x.arc(c, c, 9, 0, Math.PI * 2); x.fill();
});
const DOOR_TEX = canvasTex(256, 256, (x, w, h) => { // 꽃살문
  x.fillStyle = "#7a4a2a"; x.fillRect(0, 0, w, h);
  [[8, 8, w / 2 - 12, h - 16], [w / 2 + 4, 8, w / 2 - 12, h - 16]].forEach(([px, py, pw, ph]) => {
    x.fillStyle = "#e9dcc0"; x.fillRect(px + 8, py + 10, pw - 16, ph * .62);
    x.strokeStyle = "#8a5a32"; x.lineWidth = 4; x.save(); x.beginPath(); x.rect(px + 8, py + 10, pw - 16, ph * .62); x.clip();
    for (let k = -10; k < 20; k++) { x.beginPath(); x.moveTo(px + k * 14, py); x.lineTo(px + k * 14 + 200, py + 200); x.stroke(); x.beginPath(); x.moveTo(px + k * 14 + 200, py); x.lineTo(px + k * 14, py + 200); x.stroke(); }
    x.restore(); x.fillStyle = "#6a3a1e"; x.fillRect(px + 8, py + 18 + ph * .62, pw - 16, ph * .3);
  });
});
function hall({ w, d, h, x, z, open = false, sign = "" }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g); camSolidGroups.push(g);
  box(w + 1, .5, d + 1, mat.stone, 0, .25, 0, g); // 기단
  box(Math.min(5, w * .4), .25, .7, mat.stone, 0, .125, d / 2 + .85, g); // 앞 계단
  box(w, .05, d, mat.floor, 0, .52, 0, g);
  const cols = Math.max(3, Math.round(w / 3.2));
  const pr = .22 * Math.max(1, h / 5.5); // 높은 전각은 기둥도 굵게
  for (let i = 0; i <= cols; i++) { const px = -w / 2 + (w / cols) * i; [d / 2 - .2, -d / 2 + .2].forEach((pz) => { cyl(pr, pr * 1.18, h, mat.pillar, px, .5 + h / 2, pz, 14, g); box(pr * 2.8, .18, pr * 2.8, mat.stone, px, .59, pz, g); }); }
  box(w, h, .2, mat.mural, 0, .5 + h / 2, -d / 2 + .1, g); // 뒷벽
  box(.2, h, d, mat.wall, -w / 2 + .1, .5 + h / 2, 0, g); box(.2, h, d, mat.wall, w / 2 - .1, .5 + h / 2, 0, g);
  // 벽의 나무 틀 (인방)
  [-1, 1].forEach((sd) => (h > 8 ? [.18, .45, .7, .9] : [.18, .82]).forEach((k) => box(.26, .16, d, mat.wood, sd * (w / 2 - .1), .5 + h * k, 0, g)));
  if (!open) { // 꽃살문
    const dm = new THREE.MeshStandardMaterial({ map: DOOR_TEX.clone(), roughness: .8 }); dm.map.needsUpdate = true; dm.map.repeat.set(cols, 1);
    const door = new THREE.Mesh(new THREE.BoxGeometry(w, h * .82, .15), [mat.wood, mat.wood, mat.wood, mat.wood, dm, mat.wood]); door.position.set(0, .5 + h * .41, d / 2 - .2); g.add(door);
    box(w, h * .18, .15, mat.wall, 0, .5 + h * .91, d / 2 - .2, g);
  }
  // 단청 띠 (가운데는 비워서 안에서 보면 천장이 보이게)
  [[w + .4, d / 2 + .05], [w + .4, -d / 2 - .05]].forEach(([bw, bz]) => box(bw, .35, .3, mat.green, 0, .5 + h + .1, bz, g));
  [w / 2 + .05, -w / 2 - .05].forEach((bx) => box(.3, .35, d + .4, mat.green, bx, .5 + h + .1, 0, g));
  // 우물천장 + 대들보
  const cm = new THREE.MeshStandardMaterial({ map: COFFER_TEX.clone(), roughness: .85 }); cm.map.needsUpdate = true; cm.map.repeat.set(w / 1.8, d / 1.8);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(w - .2, d - .2), cm); ceil.rotation.x = Math.PI / 2; ceil.position.y = .5 + h + .02; g.add(ceil);
  if (open && w > 10) { for (let i = 1; i < cols; i++) { const px = -w / 2 + (w / cols) * i; box(.6, .7, d - .3, mat.green, px, .5 + h - .3, 0, g); }
    // 높은 법당: 위쪽 창방 · 공포 줄과 앞쪽 처마 밑 단청
    [d / 2 - .2, -d / 2 + .2].forEach((pz) => { box(w, .5, .4, mat.green, 0, .5 + h - .9, pz, g); for (let i = 0; i < cols * 3; i++) box(.34, .34, .5, mat.wood, -w / 2 + (i + .5) * (w / (cols * 3)), .5 + h - .45, pz, g); }); }
  // 지붕
  const A = w / 2 + (h > 8 ? 3.2 : 1.7), B = d / 2 + (h > 8 ? 3.2 : 1.7), H = h > 8 ? h * .62 : Math.min(h * .78, 5);
  const ends = koreanRoof(A, B, H, g, .5 + h + .28, { lift: Math.min(h > 8 ? 2.2 : 1.1, .35 + w * .05) });
  ends.forEach((e) => addPung(g, e, clamp(w / 9, 1.2, 2.4)));
  if (sign) { const s = textSprite(sign, { size: 46, color: "#d9b44a", bg: "#2a1612", pad: 18 }); s.material.depthTest = true; g.userData.sign = s; s.position.set(0, .5 + h - (h > 8 ? 1.6 : .2), d / 2 + .05); s.scale.multiplyScalar(h > 8 ? 2.2 : .9); g.add(s); }
  return g;
}

/* 대웅전 (안에 들어갈 수 있음) */
// 넓은 법당: 큰 절에 들어간 것처럼 앞뒤 · 좌우를 넉넉하게
const HALL = { x: 0, z: -26, w: 30, d: 24, h: 12.4 }; // 웅장하게: 예전보다 두 배 높이
const HB = { x1: -15, x2: 15, z1: -38, z2: -14 }; // 법당 안쪽 범위
const hallG = hall({ ...HALL, open: true, sign: "大雄殿" });
block(-15.6, 15.6, -38.6, -37.6); block(-15.6, -14.6, -38.6, -14); block(14.6, 15.6, -38.6, -14);
// 불상: 연꽃 대좌 위에 가부좌로 앉아 선정인을 한 금동 좌상
const BUDDHA_Z = -34.4, BS = 1.9; // 부처님 위치와 크기 (높아진 법당에 맞춰 크게)
const buddhaRoot = new THREE.Group(); buddhaRoot.position.set(0, .55, BUDDHA_Z); buddhaRoot.scale.setScalar(BS); scene.add(buddhaRoot);
const altar = box(5.2, 1, 1.9, mat.wood, 0, .5, 0, buddhaRoot);
box(5.5, .1, 2.1, mat.wood, 0, 1.03, 0, buddhaRoot);
const statue = new THREE.Group(); buddhaRoot.add(statue);
function limb(a, b, r, m, parent) {
  const d = new THREE.Vector3().subVectors(b, a), len = d.length();
  const o = new THREE.Mesh(new THREE.CapsuleGeometry(r, Math.max(.01, len - r * 2), 6, 14), m);
  o.position.copy(a).addScaledVector(d, .5); o.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize()); parent.add(o); return o;
}
function folds(geo, amp, freq) { const p = geo.attributes.position; for (let i = 0; i < p.count; i++) { const x = p.getX(i), y = p.getY(i), z = p.getZ(i), a = Math.atan2(z, x), k = 1 + Math.sin(a * freq + y * 4) * amp; p.setX(i, x * k); p.setZ(i, z * k); } geo.computeVertexNormals(); return geo; }
function buildBuddha(G) {
  const V = (x, y, z) => new THREE.Vector3(x, y, z);
  const tube = (pts, r, m = GOLD, seg = 40) => { const t = new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pts.map(([x, y, z]) => V(x, y, z))), seg, r, 10, false), m); G.add(t); return t; };
  // 연꽃 대좌 (앙련 · 복련 두 겹)
  const base = new THREE.Mesh(new THREE.CylinderGeometry(1.5, 1.7, .32, 8), GOLD_DARK); base.position.y = 1.24; G.add(base);
  [[1.5, 1.32, 1.9, 0, -1], [1.42, 1.42, .95, 0, 1], [1.2, 1.56, .6, Math.PI / 18, 1]].forEach(([r, y, tilt, off, up]) => {
    for (let i = 0; i < 18; i++) { const a = off + i / 18 * Math.PI * 2; const pt = new THREE.Mesh(new THREE.SphereGeometry(1, 16, 10), GOLD);
      pt.scale.set(.28, .4, .09); pt.position.set(Math.sin(a) * r, y + .12 * up, Math.cos(a) * r); pt.rotation.set(0, a, 0); pt.rotateX(tilt * up); G.add(pt);
      const rib = new THREE.Mesh(new THREE.SphereGeometry(1, 8, 6), GOLD_DARK); rib.scale.set(.025, .32, .02); rib.position.copy(pt.position).add(V(Math.sin(a) * .07, .02 * up, Math.cos(a) * .07)); rib.rotation.copy(pt.rotation); G.add(rib); }
  });
  const disc = new THREE.Mesh(new THREE.CylinderGeometry(1.3, 1.34, .12, 48), GOLD); disc.position.y = 1.72; G.add(disc);
  // 결가부좌 다리: 옷자락 주름이 흐르는 무릎
  const lap = new THREE.Mesh(folds(new THREE.SphereGeometry(1, 64, 28), .035, 26), GOLD); lap.scale.set(1.5, .42, .86); lap.position.set(0, 2.0, .2); G.add(lap);
  [-1, 1].forEach((sd) => { const knee = new THREE.Mesh(folds(new THREE.SphereGeometry(.44, 32, 18), .03, 12), GOLD); knee.scale.set(1.15, .7, 1.05); knee.position.set(sd * 1.02, 1.98, .4); G.add(knee); });
  const sole = new THREE.Mesh(new THREE.SphereGeometry(.2, 18, 12), GOLD); sole.scale.set(.8, .45, 1.35); sole.position.set(-.42, 2.3, .46); sole.rotation.set(-.55, -.45, 0); G.add(sole);
  for (let k = 0; k < 5; k++) { const toe = new THREE.Mesh(new THREE.SphereGeometry(.04, 8, 6), GOLD); toe.position.set(-.2 + k * .045, 2.33 - k * .01, .68 - k * .015); G.add(toe); }
  const drape = new THREE.Mesh(folds(new THREE.CylinderGeometry(1.3, 1.5, .48, 64, 1, true), .045, 30), GOLD); drape.position.y = 1.9; G.add(drape);
  // 다리 위로 흘러내린 옷 주름
  for (let k = -4; k <= 4; k++) tube([[k * .2, 2.28, .55], [k * .24, 2.08, .92], [k * .27, 1.86, 1.02]], .025, GOLD, 12);
  // 몸통: 넓은 어깨, 두 어깨를 모두 덮은 통견 가사
  const prof = [[.82, 0], [.88, .25], [.86, .6], [.82, .92], [.8, 1.08], [.74, 1.24], [.5, 1.4], [.25, 1.46], [.02, 1.48]].map(([r, y]) => new THREE.Vector2(r, y));
  const torso = new THREE.Mesh(folds(new THREE.LatheGeometry(prof, 64), .02, 30), GOLD); torso.scale.set(1, 1, .7); torso.position.y = 2.05; G.add(torso);
  // 가슴의 V자 옷깃과 U자 주름
  [-1, 1].forEach((sd) => {
    tube([[sd * .3, 3.48, -.1], [sd * .52, 3.3, .22], [sd * .4, 3.0, .5], [sd * .1, 2.62, .6], [0, 2.5, .6]], .055);
    tube([[sd * .62, 3.2, .2], [sd * .7, 2.8, .44], [sd * .55, 2.45, .58]], .035, GOLD, 16);
  });
  for (let k = 0; k < 3; k++) tube([[-.52 + k * .06, 2.95 - k * .12, .5], [0, 2.7 - k * .14, .62], [.52 - k * .06, 2.95 - k * .12, .5]], .022, GOLD, 16);
  // 안쪽 승각기 띠와 매듭
  const band = new THREE.Mesh(new THREE.TorusGeometry(.62, .035, 8, 40, Math.PI * .5), GOLD_DARK); band.rotation.set(Math.PI / 2 - .1, 0, Math.PI * .25); band.scale.set(1, .66, 1); band.position.set(0, 2.88, 0); G.add(band);
  const knot = new THREE.Mesh(new THREE.SphereGeometry(.06, 10, 8), GOLD); knot.scale.set(1.4, .8, .8); knot.position.set(0, 2.9, .44); G.add(knot);
  // 팔
  const sleeveOf = (a, b, r) => { const s = limb(a, b, r, GOLD, G); s.geometry = folds(s.geometry, .07, 7); return s; };
  // 왼손: 배 앞에서 손바닥을 위로 (선정)
  const shL = V(-.7, 3.24, -.02), elL = V(-.92, 2.52, .16), wrL = V(-.38, 2.3, .5);
  const shoL = new THREE.Mesh(new THREE.SphereGeometry(.27, 22, 16), GOLD); shoL.scale.set(1, .85, .9); shoL.position.copy(shL).add(V(.06, -.04, 0)); G.add(shoL);
  sleeveOf(shL, elL, .23); sleeveOf(elL, wrL, .17);
  // 오른손: 오른 무릎 위로 내려 땅을 가리킴 (항마촉지인 · 통일대불과 같은 손 모양)
  const shR = V(.7, 3.24, -.02), elR = V(1.0, 2.6, .12), wrR = V(1.02, 2.3, .66);
  const shoR = shoL.clone(); shoR.position.copy(shR).add(V(-.06, -.04, 0)); G.add(shoR);
  // 어깨에서 팔로 흘러내리는 가사 자락
  [-1, 1].forEach((sd) => tube([[sd * .25, 3.46, -.12], [sd * .62, 3.38, 0], [sd * .86, 3.05, .05], [sd * .95, 2.62, .1]], .09, GOLD, 24));
  sleeveOf(shR, elR, .23); sleeveOf(elR, wrR, .17);
  // 소매 끝 넓은 옷자락
  [[elL, -1], [elR, 1]].forEach(([el, sd]) => { const s = new THREE.Mesh(folds(new THREE.ConeGeometry(.34, .6, 24, 1, true), .08, 9), GOLD); s.material = GOLD; s.position.copy(el).add(V(sd * .03, -.14, .04)); s.rotation.z = sd * .35; G.add(s); });
  const hand = (fingersDown) => {
    const h = new THREE.Group();
    const palm = new THREE.Mesh(new THREE.SphereGeometry(.15, 18, 12), GOLD); palm.scale.set(1, .42, 1.2); h.add(palm);
    for (let k = 0; k < 4; k++) { const f = new THREE.Mesh(new THREE.CapsuleGeometry(.032, .17 - Math.abs(k - 1.5) * .025, 4, 8), GOLD); f.rotation.x = Math.PI / 2; f.position.set(-.09 + k * .06, 0, .22 - Math.abs(k - 1.5) * .012); h.add(f); }
    const th = new THREE.Mesh(new THREE.CapsuleGeometry(.036, .12, 4, 8), GOLD); th.rotation.set(Math.PI / 2, 0, fingersDown ? .9 : -.9); th.position.set(fingersDown ? -.14 : .14, .02, .06); h.add(th);
    G.add(h); return h;
  };
  const hL = hand(false); hL.position.set(-.08, 2.27, .54); hL.rotation.set(0, Math.PI / 2, 0); hL.scale.setScalar(1.05);
  const hR = hand(true); hR.position.set(1.03, 2.12, .84); hR.rotation.set(Math.PI / 2 - .25, 0, 0); hR.scale.setScalar(1.05);
  // 목의 삼도
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.22, .27, .3, 28), GOLD); neck.position.y = 3.57; G.add(neck);
  [3.5, 3.57, 3.64].forEach((y) => { const r = new THREE.Mesh(new THREE.TorusGeometry(.225, .011, 6, 32), GOLD_DARK); r.rotation.x = Math.PI / 2; r.position.y = y; G.add(r); });
  // 얼굴: 갸름하고 길쭉한 얼굴, 지그시 내려 감은 눈
  const head = new THREE.Group(); head.position.y = 4.05; head.scale.setScalar(1.12); G.add(head);
  const face = new THREE.Mesh(new THREE.SphereGeometry(.45, 48, 36), GOLD); face.scale.set(.9, 1.24, .96); head.add(face);
  const chin = new THREE.Mesh(new THREE.SphereGeometry(.19, 18, 12), GOLD); chin.scale.set(1.1, .7, .8); chin.position.set(0, -.4, .17); head.add(chin);
  [-1, 1].forEach((sd) => {
    const lidUp = new THREE.Mesh(new THREE.SphereGeometry(.09, 16, 10, 0, Math.PI * 2, 0, Math.PI / 2), GOLD); lidUp.scale.set(1.1, .35, .32); lidUp.position.set(sd * .155, -.02, .415); lidUp.rotation.set(.3, sd * .3, 0); head.add(lidUp);
    const lash = new THREE.Mesh(new THREE.TorusGeometry(.09, .009, 6, 20, Math.PI * .85), GOLD_DARK); lash.rotation.set(0, sd * .3, Math.PI + .2); lash.position.set(sd * .155, -.03, .43); head.add(lash);
    const brow = new THREE.Mesh(new THREE.TorusGeometry(.15, .014, 6, 24, Math.PI * .75), GOLD); brow.rotation.set(0, sd * .3, .37); brow.position.set(sd * .16, .1, .4); head.add(brow);
    const ear = new THREE.Mesh(new THREE.CapsuleGeometry(.065, .46, 6, 12), GOLD); ear.scale.set(.45, 1, 1.3); ear.position.set(sd * .41, -.16, -.04); ear.rotation.z = sd * .1; head.add(ear);
    const lobe = new THREE.Mesh(new THREE.SphereGeometry(.07, 10, 8), GOLD); lobe.scale.set(.7, 1.2, 1); lobe.position.set(sd * .43, -.44, -.01); head.add(lobe);
  });
  const nose = new THREE.Mesh(new THREE.SphereGeometry(.072, 16, 12), GOLD); nose.scale.set(.8, 1.7, 1); nose.position.set(0, -.1, .45); head.add(nose);
  const bridge = new THREE.Mesh(new THREE.CapsuleGeometry(.03, .14, 4, 8), GOLD); bridge.position.set(0, .0, .44); head.add(bridge);
  const lips = new THREE.Mesh(new THREE.TorusGeometry(.07, .007, 5, 18, Math.PI * .8), GOLD_DARK); lips.rotation.z = Math.PI * 1.1; lips.position.set(0, -.255, .425); head.add(lips);
  const lipD = new THREE.Mesh(new THREE.SphereGeometry(.045, 12, 8), GOLD); lipD.scale.set(1.4, .55, .6); lipD.position.set(0, -.28, .41); head.add(lipD);
  const lipU = new THREE.Mesh(new THREE.SphereGeometry(.05, 12, 8), GOLD); lipU.scale.set(1.5, .5, .6); lipU.position.set(0, -.235, .42); head.add(lipU);
  const urna = new THREE.Mesh(new THREE.SphereGeometry(.03, 10, 8), GOLD_DARK); urna.position.set(0, .14, .45); head.add(urna);
  // 나발과 큰 육계
  const curls = new THREE.InstancedMesh(new THREE.SphereGeometry(.042, 8, 6), HAIR, 560); let ci = 0; const tmp = new THREE.Object3D();
  const addCurls = (cx, cy, cz, R, sy, n, minY) => { for (let i = 0; i < n && ci < 560; i++) { const y = 1 - (i + .5) / n * 2; if (y < minY) continue; const r = Math.sqrt(1 - y * y), th = i * 2.39996; tmp.position.set(cx + Math.cos(th) * r * R, cy + y * R * sy, cz + Math.sin(th) * r * R); tmp.updateMatrix(); curls.setMatrixAt(ci++, tmp.matrix); } };
  addCurls(0, .02, -.02, .45, 1.18, 820, .4); addCurls(0, .56, -.03, .3, .95, 230, -.25);
  curls.count = ci; head.add(curls);
  const cap = new THREE.Mesh(new THREE.SphereGeometry(.44, 32, 20, 0, Math.PI * 2, 0, Math.PI * .32), HAIR); cap.scale.set(.95, 1.18, .98); cap.position.y = .02; head.add(cap);
  const ush = new THREE.Mesh(new THREE.SphereGeometry(.29, 22, 16), HAIR); ush.scale.y = .92; ush.position.y = .56; head.add(ush);
  const jewel = new THREE.Mesh(new THREE.SphereGeometry(.075, 14, 10), new THREE.MeshStandardMaterial({ color: "#d8402c", roughness: .25, emissive: "#4a0c06" })); jewel.position.set(0, .5, .3); head.add(jewel);
  // 투각 원형 두광 (통일대불처럼 구멍이 뚫린 금속 광배)
  const ht = canvasTex(512, 512, (x, w) => {
    const c = w / 2;
    x.fillStyle = "#b9842f"; x.beginPath(); x.arc(c, c, c - 4, 0, Math.PI * 2); x.fill();
    x.globalCompositeOperation = "destination-out";
    for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; x.save(); x.translate(c + Math.cos(a) * 196, c + Math.sin(a) * 196); x.rotate(a + Math.PI / 2); x.beginPath(); x.moveTo(0, -30); x.quadraticCurveTo(20, 0, 0, 26); x.quadraticCurveTo(-20, 0, 0, -30); x.fill(); x.restore(); }
    for (let k = 0; k < 36; k++) { const a = (k + .5) / 36 * Math.PI * 2; x.beginPath(); x.arc(c + Math.cos(a) * 140, c + Math.sin(a) * 140, 10, 0, Math.PI * 2); x.fill(); }
    for (let k = 0; k < 16; k++) { const a = k / 16 * Math.PI * 2; x.save(); x.translate(c + Math.cos(a) * 90, c + Math.sin(a) * 90); x.rotate(a); x.beginPath(); x.ellipse(0, 0, 22, 9, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
    x.globalCompositeOperation = "source-over";
    x.strokeStyle = "#e9c271"; [[c - 8, 8], [236, 4], [168, 5], [116, 4], [60, 6]].forEach(([r, lw]) => { x.lineWidth = lw; x.beginPath(); x.arc(c, c, r, 0, Math.PI * 2); x.stroke(); });
    x.fillStyle = "#d9ab55"; for (let k = 0; k < 8; k++) { x.save(); x.translate(c, c); x.rotate(k / 8 * Math.PI * 2); x.beginPath(); x.ellipse(0, -34, 12, 24, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
  });
  ht.wrapS = ht.wrapT = THREE.ClampToEdgeWrapping;
  const halo = new THREE.Mesh(new THREE.CircleGeometry(1.25, 64), new THREE.MeshStandardMaterial({ map: ht, transparent: true, alphaTest: .4, side: THREE.DoubleSide, metalness: .9, roughness: .35, envMap: goldEnv, envMapIntensity: 1, bumpMap: goldMaps.bump, bumpScale: .4 }));
  halo.position.set(0, 4.22, -.62); G.add(halo);
  const haloRim = new THREE.Mesh(new THREE.TorusGeometry(1.24, .04, 8, 80), GOLD); haloRim.position.copy(halo.position); G.add(haloRim);
}
buildBuddha(statue);
block(-5, 5, BUDDHA_Z - 2.2, BUDDHA_Z + 1.9);
// 불상을 위에서 비추는 따뜻한 조명 + 뒤에서 윤곽을 살리는 빛
const buddhaSpot = new THREE.SpotLight("#ffd9a0", 260, 30, .5, .6, 1.2); buddhaSpot.position.set(0, 11, BUDDHA_Z + 10); buddhaSpot.target.position.set(0, 5.8, BUDDHA_Z); scene.add(buddhaSpot, buddhaSpot.target);
const buddhaRim = new THREE.PointLight("#ffcf88", 26, 11, 1.5); buddhaRim.position.set(0, 9, BUDDHA_Z - 3); scene.add(buddhaRim);
// buddha.glb 파일이 있으면 그 모델로 바꿔요
fetch("buddha.glb", { method: "HEAD" }).then((r) => {
  if (!r.ok || !(r.headers.get("content-type") || "").match(/gltf|octet|model|binary/)) return;
  new GLTFLoader().load("buddha.glb", (gltf) => {
    const m = gltf.scene; const bb = new THREE.Box3().setFromObject(m), size = bb.getSize(new THREE.Vector3());
    const k = 3.6 / Math.max(size.y, .001); m.scale.setScalar(k);
    const bb2 = new THREE.Box3().setFromObject(m), c = bb2.getCenter(new THREE.Vector3());
    m.position.set(-c.x, 1.08 - bb2.min.y, -c.z);
    m.traverse((o) => { if (o.isMesh && o.material) { o.material.envMap = goldEnv; o.material.envMapIntensity = 1; o.material.needsUpdate = true; } });
    statue.clear(); statue.add(m);
  });
}).catch(() => {});
// 촛대 + 향로
const candles = [];
const ALTAR_F = BUDDHA_Z + 2.4; // 불단 앞
[-4.6, 4.6].forEach((x) => { box(.5, .9, .5, mat.wood, x, 1, ALTAR_F); cyl(.12, .12, .7, mat.candle, x, 1.8, ALTAR_F); const f = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat.flame); f.scale.y = 1.8; f.position.set(x, 2.25, ALTAR_F); scene.add(f); candles.push(f); block(x - .35, x + .35, ALTAR_F - .35, ALTAR_F + .35); });
const hallLight = new THREE.PointLight("#ffb466", 60, 40, 1.4); hallLight.position.set(0, 8, -27); scene.add(hallLight);
[-10, 10].forEach((x) => { const l = new THREE.PointLight("#ffc27a", 22, 22, 1.6); l.position.set(x, 7.5, -30); scene.add(l); });
// 법당 위쪽에 매단 연등 줄
for (let row = 0; row < 3; row++) for (let i = 0; i < 9; i++) { const c = ["#f2a65a", "#e86a5a", "#f2d05a", "#f29ac8"][(i + row) % 4]; const l = new THREE.Mesh(new THREE.SphereGeometry(.38, 12, 10), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .8 })); l.scale.y = 1.25; l.position.set(-12 + i * 3, 9.6 - Math.sin(i / 8 * Math.PI) * .6, -30 + row * 5); scene.add(l); }
box(1.4, .8, .8, mat.wood, 0, .95, ALTAR_F + .6);
cyl(.35, .25, .35, mat.gold, 0, 1.55, ALTAR_F + .6, 12);
const incense = new THREE.Group(); incense.position.set(0, 1.75, ALTAR_F + .6); scene.add(incense);
cyl(.02, .02, .6, M("#8a5a3a"), 0, .3, 0, 6, incense); incense.visible = false;
const smoke = [];
for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: "#dddddd", transparent: true, opacity: 0 })); s.userData.t = i / 10; incense.add(s); smoke.push(s); }
let incenseUntil = 0;
// 방석
const hallSeats = [], cushions = [];
for (let r = 0; r < 6; r++) for (let c = -5; c <= 5; c++) {
  const x = c * 2.3, z = -28.4 + r * 2.0;
  const cu = box(1.15, .14, 1.15, mat.cushion, x, .62, z); cu.userData.seat = { x, z }; cushions.push(cu); hallSeats.push({ x, z });
}
/* 대웅전 뒷벽 탱화: 직접 그린 구름·연꽃 무늬 */
{
  const cv = document.createElement("canvas"); cv.width = 1024; cv.height = 280; const x = cv.getContext("2d");
  const grd = x.createLinearGradient(0, 0, 0, 280); grd.addColorStop(0, "#3a1410"); grd.addColorStop(1, "#5a2018"); x.fillStyle = grd; x.fillRect(0, 0, 1024, 280);
  x.strokeStyle = "rgba(217,180,74,.55)"; x.lineWidth = 3;
  for (let i = 0; i < 26; i++) { const cx = 20 + (i * 997) % 1000, cy = 40 + (i * 613) % 200, r = 14 + (i % 4) * 6; for (let k = 0; k < 3; k++) { x.beginPath(); x.arc(cx + k * r * .9, cy, r * (1 - k * .2), Math.PI, 0); x.stroke(); } }
  x.fillStyle = "rgba(242,160,184,.55)";
  [[140, 210], [880, 210], [300, 70], [720, 70]].forEach(([cx, cy]) => { for (let k = 0; k < 7; k++) { x.save(); x.translate(cx, cy); x.rotate(-Math.PI / 2 + (k - 3) * .32); x.beginPath(); x.ellipse(0, -22, 9, 24, 0, 0, Math.PI * 2); x.fill(); x.restore(); } });
  x.strokeStyle = "rgba(242,200,120,.8)"; x.lineWidth = 6; x.beginPath(); x.arc(512, 150, 118, 0, Math.PI * 2); x.stroke();
  x.strokeStyle = "rgba(242,200,120,.45)"; x.lineWidth = 3; for (let k = 0; k < 24; k++) { const a = k / 24 * Math.PI * 2; x.beginPath(); x.moveTo(512 + Math.cos(a) * 125, 150 + Math.sin(a) * 125); x.lineTo(512 + Math.cos(a) * 150, 150 + Math.sin(a) * 150); x.stroke(); }
  const tex = new THREE.CanvasTexture(cv); tex.colorSpace = THREE.SRGBColorSpace;
  const mural = new THREE.Mesh(new THREE.PlaneGeometry(29.5, 8), new THREE.MeshStandardMaterial({ map: tex, roughness: .9 }));
  mural.position.set(0, 5.2, HB.z1 + .23); scene.add(mural);
}
/* 화강암: 설악산 계조암의 바위 느낌 */
const GRANITE = new THREE.MeshStandardMaterial({ roughness: .95, map: canvasTex(256, 256, (x, w, h) => {
  x.fillStyle = "#8b8578"; x.fillRect(0, 0, w, h);
  for (let i = 0; i < 40; i++) { const g = x.createRadialGradient(Math.random() * w, Math.random() * h, 0, Math.random() * w, Math.random() * h, 60); g.addColorStop(0, "rgba(120,110,95,.25)"); g.addColorStop(1, "rgba(120,110,95,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h); }
  for (let i = 0; i < 5000; i++) { const r = Math.random(); x.fillStyle = r < .35 ? "rgba(40,38,36,.55)" : r < .7 ? "rgba(235,230,220,.5)" : "rgba(190,150,120,.35)"; x.fillRect(Math.random() * w, Math.random() * h, 1 + Math.random() * 2, 1 + Math.random() * 2); }
}, 2, 2) });
GRANITE.bumpMap = GRANITE.map; GRANITE.bumpScale = 1.2;
function rock(r, sx, sy, sz, x, y, z, rot = 0, parent = scene) {
  const g = new THREE.IcosahedronGeometry(r, 2), p = g.attributes.position, sd = Math.random() * 10;
  for (let i = 0; i < p.count; i++) { const vx = p.getX(i), vy = p.getY(i), vz = p.getZ(i); const k = 1 + Math.sin(vx * 2.1 + sd) * Math.cos(vz * 1.7 + sd) * .1 + Math.sin(vy * 3.3 + vx * 1.3 + sd) * .06 + Math.sin(vx * 7 + vz * 5) * .015; p.setXYZ(i, vx * k, Math.max(vy * k, -.55 * r), vz * k); }
  g.computeVertexNormals(); const m = new THREE.Mesh(g, GRANITE); m.scale.set(sx, sy, sz); m.position.set(x, y, z); m.rotation.y = rot; parent.add(m); return m;
}
// 부처님 뒤 석굴: 바위 틈 법당 (계조암 석굴처럼)
[[-3.4, 1.4, .9, 1.3, 1.2], [3.4, 1.4, .95, 1.2, 1.25], [-3.7, 3.4, .85, 1.1, 1], [3.7, 3.5, .9, 1.15, 1.05], [-2.9, 5.2, 1.1, .7, .9], [2.8, 5.2, 1.1, .75, .9], [0, 5.65, 1.6, .5, .85], [-4.6, 2.4, .9, 1.6, .9], [4.6, 2.5, .9, 1.6, .9]].forEach(([x, y, sx, sy, sz], i) => rock(1, sx * 1.2 * BS, sy * 1.2 * BS, sz * 1.3, x * BS, y * BS, BUDDHA_Z - 2, i));
const caveBack = rock(1, 4.2 * BS, 3.2 * BS, .5, 0, 3 * BS, BUDDHA_Z - 3); caveBack.material = GRANITE.clone(); caveBack.material.color.set("#6f6a60");

/* 금빛 꼬마 동자승들 (자세가 여러 가지) */
const dongjaGeoCache = {};
function dongjaGeo(pose) {
  if (dongjaGeoCache[pose]) return dongjaGeoCache[pose];
  const G = new THREE.Group(), up = new THREE.Group(); up.position.y = .3; G.add(up);
  const add = (geo, m, x, y, z, parent = up, sx = 1, sy = 1, sz = 1) => { const o = new THREE.Mesh(geo, m); o.position.set(x, y, z); o.scale.set(sx, sy, sz); parent.add(o); return o; };
  add(new THREE.SphereGeometry(.42, 20, 14), GOLD, 0, .32, 0, up, 1, 1.08, .92);
  add(new THREE.CylinderGeometry(.38, .44, .22, 18), GOLD, 0, .04, 0);
  const sash = add(new THREE.TorusGeometry(.415, .06, 6, 28), GOLD_DARK, 0, .34, 0, up, 1, 1.08, .94); sash.rotation.set(0, Math.PI / 2, .8);
  const head = new THREE.Group(); head.position.y = 1.12; up.add(head);
  add(new THREE.SphereGeometry(.5, 24, 16), GOLD, 0, 0, 0, head, 1, .96, .96);
  [-1, 1].forEach((sd) => { add(new THREE.SphereGeometry(.08, 8, 6), GOLD, sd * .5, -.02, 0, head, .6, 1, 1);
    const eye = add(new THREE.TorusGeometry(.065, .014, 6, 14, Math.PI), GOLD_DARK, sd * .17, -.02, .465, head); eye.rotation.z = Math.PI; });
  const mouth = add(new THREE.TorusGeometry(.07, .014, 6, 14, Math.PI), GOLD_DARK, 0, -.17, .46, head); mouth.rotation.z = Math.PI;
  const arm = (sd, rx, rz) => { const g = new THREE.Group(); g.position.set(sd * .36, .56, .08); up.add(g); add(new THREE.CapsuleGeometry(.1, .24, 4, 8), GOLD, 0, -.18, 0, g); add(new THREE.SphereGeometry(.085, 10, 8), GOLD, 0, -.4, 0, g); g.rotation.set(rx, 0, rz); return g; };
  const legs = () => [-.15, .15].forEach((x) => { add(new THREE.CapsuleGeometry(.1, .14, 4, 8), GOLD, x, .2, 0, G); add(new THREE.SphereGeometry(.11, 10, 8), GOLD, x, .05, .05, G, 1, .6, 1.4); });
  const crossLegs = () => { add(new THREE.SphereGeometry(.5, 18, 10), GOLD, 0, .12, .08, G, 1, .32, .8); up.position.y = .2; };
  const prop = (geo, m, x, y, z) => add(geo, m, x, y, z);
  if (pose === "hap") { legs(); arm(-1, -1.3, .95); arm(1, -1.3, -.95); }
  else if (pose === "sit") { crossLegs(); arm(-1, -.7, .7); arm(1, -.7, -.7); }
  else if (pose === "bow") { add(new THREE.SphereGeometry(.45, 16, 10), GOLD, 0, .14, -.1, G, 1, .35, 1); up.position.set(0, .25, .05); up.rotation.x = .95; arm(-1, -2.4, .3); arm(1, -2.4, -.3); }
  else if (pose === "moktak") { crossLegs(); arm(-1, -1.0, .5); arm(1, -1.4, -.4); prop(new THREE.SphereGeometry(.16, 12, 10), GOLD_DARK, -.08, .38, .5).scale.set(1.2, .9, 1); prop(new THREE.CylinderGeometry(.025, .025, .45, 6), GOLD_DARK, .16, .55, .45).rotation.z = 1; }
  else if (pose === "lotus") { legs(); arm(-1, -1.5, .7); arm(1, -1.5, -.7); for (let k = 0; k < 7; k++) { const pt = prop(new THREE.SphereGeometry(.09, 8, 6), GOLD, Math.cos(k / 7 * 6.28) * .08, .78, .52 + Math.sin(k / 7 * 6.28) * .08); pt.scale.set(.6, 1.4, .6); pt.rotation.set(Math.sin(k) * .5, 0, Math.cos(k / 7 * 6.28) * .5); } }
  else if (pose === "wave") { legs(); arm(-1, -.2, .25); arm(1, 0, -2.6); }
  else if (pose === "read") { crossLegs(); arm(-1, -1.2, .6); arm(1, -1.2, -.6); const bk = prop(new THREE.BoxGeometry(.5, .06, .36), GOLD_DARK, 0, .5, .45); bk.rotation.x = -.7; }
  else if (pose === "bead") { legs(); arm(-1, -1.1, .9); arm(1, -.9, -.6); const bd = prop(new THREE.TorusGeometry(.14, .03, 6, 16), GOLD_DARK, -.02, .42, .44); bd.rotation.x = 1.2; }
  else if (pose === "sleep") { crossLegs(); arm(-1, -.5, .4); arm(1, -.5, -.4); head.rotation.z = .5; head.position.x = .12; }
  G.updateMatrixWorld(true);
  const byMat = new Map();
  G.traverse((o) => { if (!o.isMesh) return; const g = o.geometry.index ? o.geometry.toNonIndexed() : o.geometry.clone(); g.applyMatrix4(o.matrixWorld); for (const k of Object.keys(g.attributes)) if (!["position", "normal", "uv"].includes(k)) g.deleteAttribute(k); (byMat.get(o.material) || byMat.set(o.material, []).get(o.material)).push(g); });
  const out = [...byMat].map(([m, gs]) => [mergeGeometries(gs), m]);
  return (dongjaGeoCache[pose] = out);
}
function placeDongja(pose, x, y, z, s = .4, ry = 0, parent = scene) {
  const g = new THREE.Group(); for (const [geo, m] of dongjaGeo(pose)) g.add(new THREE.Mesh(geo, m));
  g.position.set(x, y, z); g.scale.setScalar(s); g.rotation.y = ry; parent.add(g); return g;
}
{ // 부처님 양옆 3단 계단 단 위에 줄지어 앉은 동자승
  const poses = ["hap", "sit", "lotus", "bead", "read", "moktak", "wave", "hap", "sit"];
  [-1, 1].forEach((sd) => {
    const cx = sd * 12;
    for (let t = 0; t < 3; t++) {
      const h = .45 * (t + 1), z = BUDDHA_Z + .6 - t * .75;
      box(4.6, h, .75, mat.wood, cx, .52 + h / 2, z); box(4.7, .05, .8, mat.wood, cx, .52 + h + .02, z);
      for (let k = 0; k < 5; k++) placeDongja(poses[(t * 5 + k + (sd > 0 ? 3 : 0)) % poses.length], cx - 1.7 + k * .85, .55 + h, z, .38 + (t === 2 ? .04 : 0), 0);
    }
    block(cx - 2.4, cx + 2.4, BUDDHA_Z - 1.4, BUDDHA_Z + 1.0);
  });
  // 불단 위 네 귀퉁이
  [[-2.2, .55, "lotus"], [2.2, .55, "lotus"], [-1.8, .78, "hap"], [1.8, .78, "hap"]].forEach(([x, z, p]) => placeDongja(p, x, 1.08, z, .3, 0, buddhaRoot));
  // 불단 앞에서 절하는 동자승
  [-2.4, 2.4].forEach((x) => { placeDongja("bow", x, .55, ALTAR_F + 1.2, .42, Math.PI); });
  block(-2.8, 2.8, ALTAR_F + .8, ALTAR_F + 1.6);
  // 양쪽 벽을 따라 참선하는 동자승
  [-33, -29.5, -26, -22.5, -19, -15.5].forEach((z, i) => [-1, 1].forEach((sd) => { placeDongja(["sit", "sleep", "moktak", "read", "hap", "bead"][(i + (sd > 0 ? 3 : 0)) % 6], sd * 14.1, .55, z, .42, -sd * Math.PI / 2); block(sd * 14.1 - .35, sd * 14.1 + .35, z - .35, z + .35); }));
}


/* =========================================================
   개인 법당: 칠성각 · 산신각 · 관음전 · 지장전
   들어가면 혼자 앉아 경문을 따라 읽어요 (목탁 박자에 맞춰 한 글자씩)
   ========================================================= */
const ROOMS = {
  sanshin: { name: "산신각", hanja: "山神閣", x: 21, z: -7, light: "#ffb466", wish: "가족의 평안과 넉넉한 살림",
    intro: "산신께 산의 기운을 빌어요. 산왕경을 함께 읽어 보세요.",
    sutra: ["산왕경", ["대산소산 산왕대신", "대악소악 산왕대신", "대각소각 산왕대신", "대축소축 산왕대신", "미산재처 산왕대신", "이십육정 산왕대신", "외악명산 산왕대신", "사해피발 산왕대신", "명당토산 산왕대신", "금궤대덕 산왕대신", "청룡백호 산왕대신", "현무주작 산왕대신", "동서남북 산왕대신", "원산근산 산왕대신", "상방하방 산왕대신", "흉산길산 산왕대신"]],
    jeong: ["나무 만덕고승 성개한적 산왕대신", "산왕대신"] },
  chilseong: { name: "칠성각", hanja: "七星閣", x: 34, z: -8, light: "#9fc4ff", wish: "건강과 장수, 자손의 복",
    intro: "북두칠성께 건강과 복을 빌어요. 칠성경을 함께 읽어 보세요.",
    sutra: ["칠성경", ["북두구진 중천대신", "상조금궐 하부곤륜", "조리강기 통제건곤", "대괴탐랑 거문녹존", "문곡염정 무곡파군", "고상옥황 자미제군", "대주천계 세입미진", "하재불멸 하복부진", "원황정기 내합아신", "천강소지 주야상륜", "속거소인 호도구령", "원견존의 영보장생", "삼태허정 육순곡생", "생아양아 호아신형", "괴작관행 필보표존제", "급급여율령 사바하"]],
    jeong: ["나무 북두대성 칠원성군", "칠원성군"] },
  gwaneum: { name: "관음전", hanja: "觀音殿", x: -34, z: -8, light: "#fff1d6", wish: "마음의 평화와 괴로움에서 벗어나기",
    intro: "관세음보살께 마음의 평화를 빌어요. 반야심경을 함께 읽어 보세요.",
    sutra: ["반야심경", ["마하반야바라밀다심경", "관자재보살 행심반야바라밀다시", "조견오온개공 도일체고액", "사리자 색불이공 공불이색", "색즉시공 공즉시색", "수상행식 역부여시", "사리자 시제법공상", "불생불멸 불구부정 부증불감", "시고 공중무색 무수상행식", "무안이비설신의 무색성향미촉법", "무안계 내지 무의식계", "무무명 역무무명진", "내지 무노사 역무노사진", "무고집멸도 무지역무득", "이무소득고 보리살타", "의반야바라밀다고 심무가애", "무가애고 무유공포", "원리전도몽상 구경열반", "삼세제불 의반야바라밀다고", "득아뇩다라삼먁삼보리", "고지반야바라밀다", "시대신주 시대명주", "시무상주 시무등등주", "능제일체고 진실불허", "고설반야바라밀다주 즉설주왈", "아제아제 바라아제 바라승아제 모지 사바하", "아제아제 바라아제 바라승아제 모지 사바하", "아제아제 바라아제 바라승아제 모지 사바하"]],
    jeong: ["나무 보문시현 원력홍심 대자대비 구고구난 관세음보살", "관세음보살"] },
  jijang: { name: "지장전", hanja: "地藏殿", x: 34, z: -22, light: "#ffc890", wish: "먼저 떠나신 분들의 평안",
    intro: "지장보살께 먼저 떠나신 분들의 평안을 빌어요.",
    sutra: ["지장보살 찬탄", ["지장대성위신력", "항하사겁설난진", "견문첨례일념간", "이익인천무량사", "옴 바라마니다니 사바하", "옴 바라마니다니 사바하", "옴 바라마니다니 사바하"]],
    jeong: ["나무 남방화주 대원본존 지장보살", "지장보살"] }
};
const ROOM_KEYS = Object.keys(ROOMS);
// 새 법당 건물 (산신각은 이미 있어요)
ROOM_KEYS.filter((k) => k !== "sanshin").forEach((k) => { const r = ROOMS[k]; hall({ x: r.x, z: r.z, w: 6.5, d: 5.5, h: 4.5, sign: r.hanja }); block(r.x - 3.5, r.x + 3.5, r.z - 3, r.z + 2.8);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(.16, 10, 8), new THREE.MeshBasicMaterial({ color: r.light })); lamp.scale.y = 1.3; lamp.position.set(r.x + 1.8, 3.6, r.z + 3); scene.add(lamp); });
const roomAt = (x, z) => ROOM_KEYS.find((k) => { const r = ROOMS[k]; return Math.abs(x - r.x) < 4.2 && z > r.z - 3.5 && z < r.z + 5.5; });

/* 법당 안 (멀리 떨어진 곳에 하나 만들어 두고, 들어갈 때마다 꾸밈을 바꿔요) */
const RO = new THREE.Vector3(0, 0, 400);
const roomG = new THREE.Group(); roomG.position.copy(RO); scene.add(roomG);
{
  box(7, .1, 7, mat.floor, 0, .05, 0, roomG);
  box(7, 4, .2, mat.wall, 0, 2, -3.5, roomG); box(.2, 4, 7, mat.wall, -3.5, 2, 0, roomG); box(.2, 4, 7, mat.wall, 3.5, 2, 0, roomG); box(7, 4, .2, mat.wall, 0, 2, 3.5, roomG);
  [-3.4, 3.4].forEach((x) => [-3.4, 3.4].forEach((z) => cyl(.16, .18, 4, mat.pillar, x, 2, z, 10, roomG)));
  [-3.35, 3.35].forEach((x) => [.9, 3.3].forEach((y) => box(.08, .14, 7, mat.wood, x, y, 0, roomG)));
  const cm = new THREE.MeshStandardMaterial({ map: COFFER_TEX.clone(), roughness: .85 }); cm.map.needsUpdate = true; cm.map.repeat.set(4, 4);
  const ceil = new THREE.Mesh(new THREE.PlaneGeometry(7, 7), cm); ceil.rotation.x = Math.PI / 2; ceil.position.y = 4; roomG.add(ceil);
  // 옆 창호 (은은한 빛)
  [-1, 1].forEach((sd) => { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.2, 1.4), new THREE.MeshStandardMaterial({ map: DOOR_TEX, emissive: "#ffe9c4", emissiveMap: DOOR_TEX, emissiveIntensity: .35 })); w.position.set(sd * 3.38, 2.3, -.4); w.rotation.y = -sd * Math.PI / 2; roomG.add(w); });
  box(3.6, .9, 1.1, mat.wood, 0, .45, -2.6, roomG); box(3.8, .06, 1.2, mat.wood, 0, .93, -2.6, roomG); // 불단
  const cu = box(1.1, .14, 1.1, mat.cushion, 0, .17, .6, roomG);
}
const roomTang = new THREE.Mesh(new THREE.PlaneGeometry(4.4, 2.9), new THREE.MeshStandardMaterial({ roughness: .9 })); roomTang.position.set(0, 2.45, -3.38); roomG.add(roomTang);
const tangFrame = box(4.7, 3.2, .06, mat.wood, 0, 2.45, -3.45, roomG); roomTang.position.z = -3.36;
const roomStatue = new THREE.Group(); roomStatue.position.set(0, .96, -2.65); roomG.add(roomStatue);
const roomCandles = [];
[-1.45, 1.45].forEach((x) => { cyl(.08, .08, .5, mat.candle, x, 1.21, -2.4, 8, roomG); const f = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), mat.flame); f.scale.y = 1.8; f.position.set(x, 1.53, -2.4); roomG.add(f); roomCandles.push(f); });
cyl(.22, .16, .22, GOLD, 0, 1.07, -2.15, 12, roomG);
const roomLight = new THREE.PointLight("#ffb466", 12, 12, 1.4); roomLight.position.set(0, 3, .2); roomG.add(roomLight);
const roomStars = new THREE.Group(); roomG.add(roomStars);
{ const g = new THREE.BufferGeometry(), p = []; for (let i = 0; i < 220; i++) p.push(rand(-3.3, 3.3), 3.95, rand(-3.3, 3.3)); g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  roomStars.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff4d6", size: .05, transparent: true, opacity: .9 }))); }
const tangCache = {};
function tangTex(k) {
  if (tangCache[k]) return tangCache[k];
  const t = canvasTex(1024, 680, (x, w, h) => {
    const sky = (a, b) => { const g = x.createLinearGradient(0, 0, 0, h); g.addColorStop(0, a); g.addColorStop(1, b); x.fillStyle = g; x.fillRect(0, 0, w, h); };
    const cloud = (cx, cy, s, col) => { x.strokeStyle = col; x.lineWidth = 5; for (let i = 0; i < 3; i++) { x.beginPath(); x.arc(cx + i * s * .9, cy, s * (1 - i * .18), Math.PI, 0); x.stroke(); } };
    if (k === "chilseong") {
      sky("#0b1530", "#1c2d55");
      for (let i = 0; i < 500; i++) { x.fillStyle = `rgba(255,248,220,${Math.random() * .8})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
      const st = [[250, 230], [380, 260], [500, 280], [620, 250], [690, 380], [860, 360], [890, 220]];
      x.strokeStyle = "rgba(255,226,150,.55)"; x.lineWidth = 3; x.beginPath(); st.forEach(([a, b], i) => (i ? x.lineTo(a, b) : x.moveTo(a, b))); x.lineTo(690, 380); x.stroke();
      st.forEach(([a, b]) => { const g = x.createRadialGradient(a, b, 0, a, b, 34); g.addColorStop(0, "#fffbe6"); g.addColorStop(.3, "rgba(255,230,160,.8)"); g.addColorStop(1, "rgba(255,230,160,0)"); x.fillStyle = g; x.beginPath(); x.arc(a, b, 34, 0, Math.PI * 2); x.fill(); });
      x.fillStyle = "rgba(245,197,66,.9)"; x.font = "bold 64px serif"; x.textAlign = "center"; x.fillText("北 斗 七 星", w / 2, h - 70);
      cloud(120, 560, 40, "rgba(160,190,255,.35)"); cloud(800, 590, 46, "rgba(160,190,255,.35)");
    } else if (k === "sanshin") {
      sky("#cfe0d8", "#e9ddb8");
      x.fillStyle = "#c0392b"; x.beginPath(); x.arc(820, 150, 62, 0, Math.PI * 2); x.fill();
      [["#7fa894", 380, .9], ["#4f7d68", 470, .7], ["#2f5a48", 560, .55]].forEach(([c, base, amp]) => { x.fillStyle = c; x.beginPath(); x.moveTo(0, h); for (let i = 0; i <= w; i += 8) x.lineTo(i, base - Math.abs(Math.sin(i / 140 + amp * 4)) * 180 * amp - Math.sin(i / 37) * 12); x.lineTo(w, h); x.fill(); });
      const pine = (px, py, s) => { x.strokeStyle = "#4a2f1e"; x.lineWidth = 12 * s; x.beginPath(); x.moveTo(px, py); x.quadraticCurveTo(px + 30 * s, py - 120 * s, px - 10 * s, py - 230 * s); x.stroke(); x.fillStyle = "#1f4a35"; [[-50, -200], [40, -170], [-20, -250], [60, -230]].forEach(([a, b]) => { x.beginPath(); x.ellipse(px + a * s, py + b * s, 70 * s, 22 * s, 0, 0, Math.PI * 2); x.fill(); }); };
      pine(180, 640, 1.4); pine(900, 650, 1.1);
      cloud(420, 120, 36, "rgba(255,255,255,.8)"); cloud(560, 210, 30, "rgba(255,255,255,.7)");
      x.fillStyle = "rgba(90,40,20,.85)"; x.font = "bold 60px serif"; x.textAlign = "center"; x.fillText("山 王 大 神", w / 2, h - 50);
    } else if (k === "gwaneum") {
      sky("#e8eff6", "#bcd2e6");
      x.strokeStyle = "rgba(90,130,170,.35)"; x.lineWidth = 3; for (let j = 0; j < 9; j++) { x.beginPath(); for (let i = 0; i <= w; i += 10) x.lineTo(i, 520 + j * 18 + Math.sin(i / 40 + j) * 5); x.stroke(); }
      const g = x.createRadialGradient(w / 2, 300, 20, w / 2, 300, 240); g.addColorStop(0, "rgba(255,250,230,1)"); g.addColorStop(1, "rgba(255,250,230,0)"); x.fillStyle = g; x.beginPath(); x.arc(w / 2, 300, 240, 0, Math.PI * 2); x.fill();
      for (let k2 = 0; k2 < 9; k2++) { x.save(); x.translate(w / 2, 470); x.rotate((k2 - 4) * .3); x.fillStyle = k2 % 2 ? "#f4b6c6" : "#f9d3dd"; x.beginPath(); x.ellipse(0, -90, 38, 100, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
      x.strokeStyle = "#6a8f5a"; x.lineWidth = 4; x.beginPath(); x.moveTo(820, 120); x.quadraticCurveTo(780, 260, 830, 420); x.stroke();
      for (let i = 0; i < 14; i++) { x.fillStyle = "#86b06f"; x.beginPath(); x.ellipse(800 + Math.sin(i) * 20, 150 + i * 20, 22, 6, .6 * Math.sin(i * 2), 0, Math.PI * 2); x.fill(); }
      x.fillStyle = "#f2f6f8"; x.beginPath(); x.ellipse(830, 470, 34, 56, 0, 0, Math.PI * 2); x.fill(); x.fillRect(822, 395, 16, 30);
      x.fillStyle = "rgba(60,80,110,.85)"; x.font = "bold 56px serif"; x.textAlign = "center"; x.fillText("觀 世 音 菩 薩", w / 2, h - 40);
    } else {
      sky("#3a1410", "#6a2a18");
      const g = x.createRadialGradient(w / 2, 280, 10, w / 2, 280, 260); g.addColorStop(0, "rgba(255,220,140,.95)"); g.addColorStop(1, "rgba(255,200,120,0)"); x.fillStyle = g; x.beginPath(); x.arc(w / 2, 280, 260, 0, Math.PI * 2); x.fill();
      x.strokeStyle = "#e9c46a"; x.lineWidth = 10; x.beginPath(); x.moveTo(300, 620); x.lineTo(300, 140); x.stroke();
      [[-34, 120], [34, 120], [-30, 160], [30, 160]].forEach(([a, b]) => { x.lineWidth = 5; x.beginPath(); x.arc(300 + a, b, 20, 0, Math.PI * 2); x.stroke(); });
      x.fillStyle = "#fff3c8"; x.beginPath(); x.arc(w / 2 + 160, 300, 46, 0, Math.PI * 2); x.fill();
      for (let k2 = 0; k2 < 7; k2++) { x.save(); x.translate(w / 2, 560); x.rotate((k2 - 3) * .33); x.fillStyle = "#e88aa4"; x.beginPath(); x.ellipse(0, -70, 30, 80, 0, 0, Math.PI * 2); x.fill(); x.restore(); }
      cloud(140, 120, 36, "rgba(233,196,106,.45)"); cloud(760, 110, 40, "rgba(233,196,106,.45)");
      x.fillStyle = "rgba(245,210,130,.95)"; x.font = "bold 56px serif"; x.textAlign = "center"; x.fillText("地 藏 菩 薩", w / 2, h - 40);
    }
    x.strokeStyle = "#d9b44a"; x.lineWidth = 14; x.strokeRect(7, 7, w - 14, h - 14);
  });
  t.wrapS = t.wrapT = THREE.ClampToEdgeWrapping; t.repeat.set(1, 1); return (tangCache[k] = t);
}
let inRoom = null, roomReturn = null;
let roomBuddha = null;
function setupRoom(k) {
  const r = ROOMS[k];
  roomTang.material.map = tangTex(k); roomTang.material.needsUpdate = true;
  roomLight.color.set(r.light); roomStars.visible = k === "chilseong";
  // 불단 위 작은 금동 부처님 (대웅전 부처님과 같은 모습, 모양만 빌려 와서 가볍게)
  if (!roomBuddha) { roomBuddha = statue.clone(true); roomBuddha.scale.setScalar(.36); roomBuddha.position.set(0, -.4, 0); }
  roomStatue.clear(); roomStatue.add(roomBuddha);
}
// 법당 안에 있는 동안 바깥 세상은 그리지 않아요 (뒤 배경 끊김 · 렉 방지)
const worldHidden = [];
function hideWorld(on) {
  if (on) { scene.children.forEach((o) => { if (o !== roomG && o !== player?.root && o.visible && !o.isLight) { o.visible = false; worldHidden.push(o); } }); scene.fog.near = 6; scene.fog.far = 18; }
  else { worldHidden.forEach((o) => (o.visible = true)); worldHidden.length = 0; scene.fog.near = 28; scene.fog.far = 70; applyTimeOfDay(); }
}
const fade = (fn) => { const f = $("fadeOut"); f.classList.add("on"); setTimeout(() => { fn(); setTimeout(() => f.classList.remove("on"), 60); }, 380); };
function enterRoom(k) {
  if (!player) return; standUp(); stopAutoBow(); pendingSeat = null; autoPath = null;
  fade(() => {
    roomReturn = { x: ROOMS[k].x, z: ROOMS[k].z + 3.6 }; inRoom = k; pray = null; setupRoom(k);
    hideWorld(true); if (player.aura) player.aura.visible = false;
    camTarget.set(RO.x, 1.45, RO.z - 2.6); camera.position.set(RO.x, 2.5, RO.z + 3.15);
    player.pos.set(RO.x, 0, RO.z + .6); player.target.copy(player.pos); player.yaw = Math.PI; player.root.rotation.y = Math.PI; player.y = 0; player.sitting = true;
    camYaw = 0; ZONES.room.name = ROOMS[k].name; ZONES.room.intro = ROOMS[k].intro; zone = "room"; renderActions(); say(ROOMS[k].intro); gain(`visit:${k}`);
    $("prayBox").classList.add("compact"); $("prayBox").hidden = false; renderPray(true); sendPresence();
  });
}
function leaveRoom() {
  stopPray(); const back = roomReturn;
  fade(() => { hideWorld(false); if (player.aura) player.aura.visible = true; inRoom = null; $("prayBox").hidden = true; player.sitting = false; if (back) { player.pos.set(back.x, 0, back.z); player.target.copy(player.pos); player.yaw = 0; camTarget.set(back.x, 1.6, back.z); camera.position.set(back.x, 1.6 + Math.sin(camPitch) * camDist, back.z + Math.cos(camPitch) * camDist); } camYaw = 0; lastMoveTx = 0; sendPresence(); });
}
/* 기도: 경문 → 정근 → 축원 순서로 한 글자씩 목탁 박자에 맞춰 */
let pray = null; // { k, lines, li, ci, timer, rounds, done, total }
const prayKey = () => inRoom || (zone === "peak" ? "chilseong" : null);
function prayLines(k) {
  const r = ROOMS[k], [title, sutra] = r.sutra, [open, name] = r.jeong;
  return [{ t: title, head: true }, ...sutra.map((s) => ({ t: s })), { t: `${r.name} 정근`, head: true }, { t: open }, ...Array(7).fill(0).map(() => ({ t: name })),
    { t: "축원", head: true }, { t: `${me.nick || "불자"}님의 ${r.wish}을 비옵니다` }, { t: "나무 석가모니불 나무 석가모니불 나무 시아본사 석가모니불" }];
}
function renderPray(reset) {
  const k = prayKey(); if (!k) return; if (reset && !pray) { const lines = prayLines(k); pray = { k, lines, li: 0, ci: 0, timer: 0, rounds: 0, done: 0, total: lines.reduce((n, L) => n + (L.head ? 0 : [...L.t].filter((c) => c !== " ").length), 0) }; }
  if (!pray) return;
  const P = pray, box = $("prayLines"); box.innerHTML = "";
  $("prayTitle").textContent = inRoom ? `${ROOMS[k].name} · ${ROOMS[k].sutra[0]}` : "달빛봉 칠성기도 · 칠성경";
  $("prayCount").textContent = P.timer ? `${P.rounds + 1}번째 독송 중 · ${P.li + 1}/${P.lines.length}` : P.rounds ? `${P.rounds}독 마쳤어요` : "기도 시작을 누르면 목탁 박자에 맞춰 한 글자씩 읽어요";
  for (let d = -1; d <= 2; d++) {
    const L = P.lines[P.li + d]; const div = document.createElement("div"); div.className = "pl" + (d === 0 ? " cur" : "") + (L && L.head ? " head" : "");
    if (L) { if (d === 0 && !L.head) { const chars = [...L.t]; let n = 0; chars.forEach((c) => { const s = document.createElement("span"); s.textContent = c; if (c !== " ") { if (n < P.ci) s.className = "done"; else if (n === P.ci && P.timer) s.className = "now"; n++; } div.appendChild(s); }); } else div.textContent = L.t; }
    else div.innerHTML = "&nbsp;";
    box.appendChild(div);
  }
  const btn = $("prayToggle"); btn.textContent = P.timer ? "⏸️ 잠시 멈추기" : P.rounds || P.li ? "🙏 이어서 기도하기" : "🙏 기도 시작";
}
function prayStep() {
  const P = pray; if (!P || !prayKey()) return;
  const L = P.lines[P.li];
  if (!L) { P.rounds++; P.li = 0; P.ci = 0; P.done = 0; if (!inRoom) { dipper.flashAt = performance.now(); dipper.full = true; } gain("pray"); me.pray = (me.pray || 0) + 1; save(); act("pray", { what: P.k });
    sfx.bell(); say(inRoom ? `${ROOMS[P.k].name}에서 ${P.rounds}독을 마쳤어요. 마음이 맑아졌어요.` : `북두칠성이 모두 밝혀졌어요. ${P.rounds}독, 별빛이 가족을 지켜 주길.`); if (P.k === "chilseong") sevenStars.userData.glowUntil = Date.now() + 8000;
    if (player) playAnim(player, "bow"); P.timer = setTimeout(prayStep, 2600); renderPray(); return; }
  if (L.head) { P.li++; P.ci = 0; sfx.soft(); if (player && inRoom) playAnim(player, "bow"); renderPray(); P.timer = setTimeout(prayStep, 900); return; }
  if (P.ci === 0 && player && inRoom && !player.anim) playAnim(player, P.li % 4 === 0 ? "bow" : "pray");
  const syl = [...L.t].filter((c) => c !== " ");
  if (P.ci < syl.length) { prayMok(P.ci === 0); P.ci++; P.done++; renderPray(); P.timer = setTimeout(prayStep, 330); return; }
  P.li++; P.ci = 0; renderPray(); P.timer = setTimeout(prayStep, 520);
}
function prayMok(accent) {
  if (rec.moktak) { playRec("moktak", vol.fx * (accent ? .7 : .45)); return; }
  const c = ac(), t = c.currentTime;
  [[520, accent ? .4 : .26, .1], [355, accent ? .22 : .14, .14]].forEach(([f, v, d]) => { const o = c.createOscillator(), g = c.createGain(); o.frequency.setValueAtTime(f * 1.04, t); o.frequency.exponentialRampToValueAtTime(f, t + .02); g.gain.setValueAtTime(v * vol.fx, t); g.gain.exponentialRampToValueAtTime(.0001, t + d); o.connect(g).connect(master); o.start(t); o.stop(t + d + .02); });
}
function togglePray() {
  const k = prayKey(); if (!k) return; if (!pray || pray.k !== k) { pray = null; renderPray(true); }
  if (pray.timer) { stopPray(); return; }
  $("prayBox").classList.add("compact");
  if (!inRoom) { $("prayBox").hidden = false; dipper.active = true; if (player) { player.yaw = Math.PI; player.target.copy(player.pos); } }
  ac(); pray.timer = setTimeout(prayStep, 200); if (player) playAnim(player, "pray"); renderPray(); renderActions();
  const url = soundUrl[`pray_${k}`]; if (url) loopAudio(`pray_${k}`, .8 * vol.fx); // 직접 녹음한 파일(pray_chilseong.mp3 등)이 있으면 함께 틀어요
}
function stopPray() { if (pray && pray.timer) { clearTimeout(pray.timer); pray.timer = 0; } Object.keys(loopEls).filter((n) => n.startsWith("pray_")).forEach((n) => loopEls[n].pause()); if (pray && pray.k !== prayKey()) pray = null; renderPray(); renderActions(); }
ROOM_KEYS.forEach((k) => findSound(`pray_${k}`));

/* 달빛봉 칠성기도: 기도가 진행되는 만큼 하늘에 북두칠성이 하나씩 떠오르고 선으로 이어져요 */
const dipper = { active: false, shown: 0, flashAt: 0, full: false, stars: [], segs: [], g: new THREE.Group() };
function initDipper() {
  const D = dipper, C = new THREE.Vector3(MOUNT.x - 2.4, 26, MOUNT.z - 34); D.g.position.copy(C); scene.add(D.g);
  // 탐랑 · 거문 · 녹존 · 문곡 · 염정 · 무곡 · 파군 (국자 끝에서 손잡이 끝으로)
  const P2 = [[890, 220], [860, 360], [690, 380], [620, 250], [500, 280], [380, 260], [250, 230]].map(([x, y]) => new THREE.Vector3((x - 570) / 44, -(y - 300) / 44, 0));
  const names = ["탐랑", "거문", "녹존", "문곡", "염정", "무곡", "파군"];
  const starMat = () => new THREE.SpriteMaterial({ map: glowTex, color: "#fff4cf", transparent: true, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false, opacity: 0 });
  P2.forEach((p, i) => { const s = new THREE.Sprite(starMat()); s.position.copy(p); s.scale.setScalar(.01); s.renderOrder = 20; D.g.add(s);
    const core = new THREE.Sprite(starMat()); core.material.color.set("#ffffff"); core.position.copy(p); core.scale.setScalar(.01); core.renderOrder = 21; D.g.add(core);
    const lb = textSprite(names[i], { size: 34, color: "#fff2c4", bg: "rgba(10,16,32,.55)", pad: 10 }); lb.material.fog = false; lb.material.opacity = 0; lb.position.copy(p).add(new THREE.Vector3(0, -1.05, 0)); lb.scale.multiplyScalar(1.5); lb.renderOrder = 22; D.g.add(lb);
    D.stars.push({ s, core, lb }); });
  [[0, 1], [1, 2], [2, 3], [3, 0], [3, 4], [4, 5], [5, 6]].forEach(([a, b]) => { const A2 = P2[a], B2 = P2[b], len = A2.distanceTo(B2);
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1, .07), new THREE.MeshBasicMaterial({ color: "#ffe4a0", transparent: true, opacity: 0, depthWrite: false, depthTest: false, blending: THREE.AdditiveBlending, fog: false }));
    m.geometry.translate(.5, 0, 0); m.position.copy(A2); m.rotation.z = Math.atan2(B2.y - A2.y, B2.x - A2.x); m.scale.x = .001; m.renderOrder = 19; m.userData.len = len; D.g.add(m); D.segs.push(m); });
  D.g.visible = false;
}
const nightCol = new THREE.Color("#070c1a"), dayCol = new THREE.Color();
function updateDipper(dt, now, t) {
  const D = dipper; const want = D.full ? 1 : D.active && pray && pray.k === "chilseong" && !inRoom ? pray.done / Math.max(1, pray.total) : D.active ? D.shown : 0;
  D.shown += (Math.max(want, D.active ? D.shown : 0) - D.shown) * Math.min(1, dt * 2.5);
  if (!D.active) D.shown = Math.max(0, D.shown - dt * .4);
  D.g.visible = D.shown > .002;
  if (!D.g.visible) return;
  const n = D.stars.length, flash = D.flashAt ? Math.max(0, 1 - (now - D.flashAt) / 2500) : 0;
  D.stars.forEach((st, i) => { const k = clamp((D.shown * n - i) / .6, 0, 1), tw = .85 + Math.sin(t * 3 + i * 1.7) * .15;
    st.s.material.opacity = k * .9; st.s.scale.setScalar((k * 2.6 + flash * 3.5) * tw); st.core.material.opacity = k; st.core.scale.setScalar(k * .7 * tw + flash * .9); st.lb.material.opacity = k * .9; });
  // 선은 별이 다 떠오른 순서대로 이어져요 (국자 → 손잡이)
  const segTo = [1, 2, 3, 0, 4, 5, 6];
  D.segs.forEach((m, i) => { const b = segTo[i], start = (b === 0 ? 3 : b) / n, k = clamp((D.shown - start + .03) / (.9 / n), 0, 1);
    m.scale.x = Math.max(.001, m.userData.len * k); m.material.opacity = k * (.75 + flash * .25); });
  // 하늘이 서서히 밤으로
  if (D.active || D.shown > .01) { dayCol.copy(scene.background); scene.background.lerp(nightCol, Math.min(1, dt * .6 * (D.active ? 1 : 0))); scene.fog.color.copy(scene.background); }
}

/* 대웅전 양옆 벽: 아래는 탱화, 가운데는 천불(작은 금빛 불상들), 위는 꽃살 창 */
{
  const WX = HB.x2 - .4, zs = [-33.5, -26, -18.5];
  const nicheTex = canvasTex(256, 256, (x, w, h) => { x.fillStyle = "#4a1610"; x.fillRect(0, 0, w, h); const g = x.createRadialGradient(w / 2, h * .45, 10, w / 2, h * .45, w * .5); g.addColorStop(0, "rgba(255,200,120,.55)"); g.addColorStop(1, "rgba(255,200,120,0)"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    x.strokeStyle = "#d9b44a"; x.lineWidth = 10; x.strokeRect(5, 5, w - 10, h - 10); x.lineWidth = 3; x.beginPath(); x.moveTo(30, h - 22); x.quadraticCurveTo(w / 2, 10, w - 30, h - 22); x.stroke(); });
  const winMat = new THREE.MeshStandardMaterial({ map: DOOR_TEX, emissive: "#ffe6b8", emissiveMap: DOOR_TEX, emissiveIntensity: .45, roughness: .8 });
  const sitParts = dongjaGeo("sit");
  [-1, 1].forEach((sd) => {
    const ry = -sd * Math.PI / 2, X = sd * WX;
    // 탱화 세 폭 (금테 액자)
    ["gwaneum", "chilseong", "jijang"].forEach((k, i) => { const z = zs[i];
      box(.12, 3.6, 5.4, mat.wood, X + sd * .05, 3.1, z);
      const tx = tangTex(sd > 0 ? ["sanshin", "jijang", "gwaneum"][i] : k);
      const tm = new THREE.Mesh(new THREE.PlaneGeometry(5, 3.25), new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: "#ffffff", emissiveIntensity: .35, roughness: .85 })); tm.position.set(X - sd * .02, 3.1, z); tm.rotation.y = ry; scene.add(tm); });
    // 천불: 금빛 작은 불상이 감실마다 (한 번에 그리는 묶음으로 가볍게)
    const cols = 16, rows = 4, z0 = -36.8, z1 = -15.4, y0 = 5.6, dz = (z1 - z0) / (cols - 1), dy = .95;
    const back = new THREE.Mesh(new THREE.PlaneGeometry(z1 - z0 + 1.2, rows * dy + .5), new THREE.MeshStandardMaterial({ map: nicheTex, roughness: .9 }));
    back.material.map = nicheTex.clone(); back.material.map.needsUpdate = true; back.material.map.repeat.set(cols, rows);
    back.material.emissiveMap = back.material.map; back.material.emissive = new THREE.Color("#ffffff"); back.material.emissiveIntensity = .25;
    back.position.set(X - sd * .02, y0 + (rows - 1) * dy / 2, (z0 + z1) / 2); back.rotation.y = ry; scene.add(back);
    const o = new THREE.Object3D();
    sitParts.forEach(([geo, m]) => { const im = new THREE.InstancedMesh(geo, m, cols * rows); let n = 0;
      for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) { o.position.set(X - sd * .28, y0 - .32 + r * dy, z0 + c * dz); o.rotation.set(0, ry, 0); o.scale.setScalar(.36); o.updateMatrix(); im.setMatrixAt(n++, o.matrix); }
      scene.add(im); });
    box(.3, .14, z1 - z0 + 1.4, mat.wood, X - sd * .1, y0 - .45, (z0 + z1) / 2); box(.3, .14, z1 - z0 + 1.4, mat.wood, X - sd * .1, y0 + rows * dy - .25, (z0 + z1) / 2);
    // 꽃살 창 (위쪽에서 은은한 빛)
    for (let i = 0; i < 6; i++) { const w = new THREE.Mesh(new THREE.PlaneGeometry(2.6, 1.6), winMat); w.position.set(X - sd * .02, 10.6, -35.6 + i * 3.9); w.rotation.y = ry; scene.add(w); }
    // 벽 앞 큰 연꽃 등 두 개
    [-30, -22].forEach((z) => { const c = "#f4b6c6", l = new THREE.Mesh(new THREE.SphereGeometry(.55, 14, 10), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .7 })); l.scale.y = .8; l.position.set(X - sd * 1.6, 4.9, z); scene.add(l);
      const st = new THREE.Mesh(new THREE.CylinderGeometry(.04, .04, 4.4, 6), mat.wood); st.position.set(X - sd * 1.6, 2.6, z); scene.add(st); });
  });
}

/* 계조암: 법당 뒤로 솟은 화강암 바위 무리와 그 위의 흔들바위 */
const rockingStone = (() => {
  const C = { x: 0, z: -38 };
  const RZ = -11, RY = 0, K = 2.4; // 높아진 대웅전 뒤로 더 크게 솟게
  [[-10, 4, -36, 6, 5, 4], [-3, 6, -39, 7, 6.5, 4.5], [5, 5.2, -37.5, 6.5, 5.4, 4.2], [12, 3.6, -35.5, 5, 3.8, 3.6], [-15, 2.6, -34.5, 4, 2.8, 3.4], [16, 2.4, -33.8, 3.6, 2.6, 3],
   [0, 10.5, -40.5, 5, 3.4, 3.4], [-7, 9, -40, 3.6, 3, 3], [8.5, 8.6, -39.5, 3.4, 2.6, 3]].forEach(([x, y, z, sx, sy, sz], i) => rock(1, sx * 1.4, sy * K, sz * 1.3, x * 1.3, y * K + RY, z + RZ, i * .7));
  // 흔들바위를 받치는 평평한 너럭바위
  rock(1, 3.6, .9, 3, 9, 9.8 * K, -38.3 + RZ, .3);
  const g = new THREE.Group(); g.position.set(9, 9.8 * K + .85, -38.3 + RZ); g.scale.setScalar(1.5); scene.add(g);
  const stone = rock(1, 1.7, 1.5, 1.45, 0, 1.45, 0, 0, g);
  const sg = textSprite("흔들바위", { size: 34, color: "#f3e6c4", bg: "rgba(40,30,20,.6)", pad: 12 }); sg.material.depthTest = true; sg.position.set(0, 3.6, 0); sg.scale.multiplyScalar(.9); g.add(sg);
  // 바위 틈 소나무
  [[-12, 7.2, -35], [-4.5, 11.8, -38], [11, 6.4, -35], [2, 12.5, -40], [-8.5, 10.6, -39], [14.5, 5, -33.5]].forEach(([x, y, z]) => {
    const t = new THREE.Group(); t.position.set(x * 1.3, y * K + RY, z + RZ); t.scale.setScalar(1.8); scene.add(t);
    const tr = cyl(.12, .2, 1.6, mat.trunk, 0, .8, 0, 6, t); tr.rotation.z = rand(-.25, .25);
    [[1.3, .5, 1.5], [1, .4, 2.0], [.7, .35, 2.4]].forEach(([r, h, yy]) => { const c = new THREE.Mesh(new THREE.CylinderGeometry(r * .9, r, h, 7), mat.leaf2); c.position.set(rand(-.2, .2), yy, rand(-.2, .2)); c.scale.z = .7; t.add(c); });
  });
  return g;
})();

/* 법당 앞 너럭바위: 넓고 평평한 화강암 바닥 */
{ const slab = new THREE.Mesh(new THREE.BoxGeometry(18, .12, 3.4), GRANITE); slab.position.set(0, .06, -12.3); scene.add(slab);
  [-9.4, 9.4].forEach((x) => rock(1, 1.1, .55, .9, x, .25, -12.2, x)); }

/* 공양미: 불단 앞 양옆에 쌀자루가 쌓여요 */
const RICE_SPOTS = (() => { const RZ0 = BUDDHA_Z + 2.5, one = [[2.45, .55, RZ0 + .2], [2.95, .55, RZ0 + .2], [3.45, .55, RZ0 + .2], [2.7, .55, RZ0 - .25], [3.2, .55, RZ0 - .25], [2.95, .9, RZ0 - .02]]; const out = []; one.forEach(([x, y, z]) => { out.push([-x, y, z], [x, y, z]); }); return out; })();
const riceGroup = new THREE.Group(); scene.add(riceGroup);
const riceSack = (() => { const g = new THREE.Group(), cloth = M("#efe8d6", { roughness: .95 }), tie = M("#b5402e", { roughness: .7 });
  const b = new THREE.Mesh(new THREE.SphereGeometry(.24, 16, 12), cloth); b.scale.set(1, .85, .85); b.position.y = .2; g.add(b);
  const nk = new THREE.Mesh(new THREE.CylinderGeometry(.06, .12, .14, 10), cloth); nk.position.y = .42; g.add(nk);
  const tp = new THREE.Mesh(new THREE.ConeGeometry(.09, .1, 10), cloth); tp.position.y = .53; tp.rotation.x = Math.PI; g.add(tp);
  const t = new THREE.Mesh(new THREE.TorusGeometry(.065, .018, 6, 14), tie); t.rotation.x = Math.PI / 2; t.position.y = .46; g.add(t);
  const lb = textSprite("供養米", { size: 30, color: "#7a2a1a", bg: "rgba(0,0,0,0)", pad: 2 }); lb.material.depthTest = true; lb.scale.multiplyScalar(.28); lb.position.set(0, .2, .22); g.add(lb);
  return g; })();
let riceShown = 0;
function addRiceBag(pop) {
  if (riceShown >= RICE_SPOTS.length) { riceGroup.children.forEach((c) => (c.userData.popAt = performance.now())); return; }
  const [x, y, z] = RICE_SPOTS[riceShown++]; const s = riceSack.clone(); s.position.set(x, y, z); s.rotation.y = rand(-.5, .5); if (pop) s.userData.popAt = performance.now(); riceGroup.add(s);
}
block(-3.75, -2.2, BUDDHA_Z + 2.1, BUDDHA_Z + 3); block(2.2, 3.75, BUDDHA_Z + 2.1, BUDDHA_Z + 3);

/* 기와 불사: 법당 앞 너럭바위 위 기와 단에 소원을 적은 기와가 쌓여요 */
const GIWA = { x: -5.2, z: -12.6, cols: 8, rows: 3 };
const giwaGroup = new THREE.Group(); giwaGroup.position.set(GIWA.x, 0, GIWA.z); scene.add(giwaGroup); camSolidGroups.push(giwaGroup);
const giwaTiles = new THREE.Group(); giwaGroup.add(giwaTiles);
for (let r = 0; r < GIWA.rows; r++) { const h = .35 + r * .42; box(4.3, h, .55, mat.wood, 0, h / 2, -r * .55, giwaGroup); }
{ const sg = textSprite("기와 불사 · 소원 기와", { size: 34, color: "#f3e6c4", bg: "#3b2414", pad: 14 }); sg.material.depthTest = true; sg.scale.multiplyScalar(.5); sg.position.set(0, 2.45, -.6); giwaGroup.add(sg);
  [-2.25, 2.25].forEach((x) => { cyl(.06, .07, 2.4, mat.pillar, x, 1.2, -.6, 8, giwaGroup); }); }
block(GIWA.x - 2.3, GIWA.x + 2.3, GIWA.z - 1.5, GIWA.z + .35);
const giwaGeo = new THREE.CylinderGeometry(.22, .24, .5, 18, 1, true, -Math.PI * .4, Math.PI * .8);
function giwaTexture(text, nick) {
  return canvasTex(256, 320, (x, w, h) => {
    const g = x.createLinearGradient(0, 0, w, 0); g.addColorStop(0, "#2a2e33"); g.addColorStop(.5, "#4a5058"); g.addColorStop(1, "#2a2e33"); x.fillStyle = g; x.fillRect(0, 0, w, h);
    for (let i = 0; i < 600; i++) { x.fillStyle = `rgba(255,255,255,${Math.random() * .06})`; x.fillRect(Math.random() * w, Math.random() * h, 2, 2); }
    x.fillStyle = "#f4efe2"; x.textAlign = "center"; x.textBaseline = "middle";
    const chars = [...String(text)], per = chars.length > 14 ? 7 : chars.length > 8 ? 6 : 5, lines = []; for (let i = 0; i < chars.length; i += per) lines.push(chars.slice(i, i + per).join(""));
    const fs = lines.length > 2 ? 34 : 40; x.font = `${fs}px "Gowun Batang","Apple SD Gothic Neo",serif`;
    lines.slice(0, 4).forEach((l, i) => x.fillText(l, w / 2, h * .42 + (i - (Math.min(lines.length, 4) - 1) / 2) * (fs + 8)));
    if (nick) { x.font = `24px "Gowun Dodum",sans-serif`; x.fillStyle = "rgba(244,239,226,.7)"; x.fillText(nick, w / 2, h - 34); }
  });
}
function renderGiwa(list) {
  giwaTiles.children.forEach((t) => { t.material.map && t.material.map.dispose(); t.material.dispose(); }); giwaTiles.clear();
  list.slice(0, GIWA.cols * GIWA.rows).forEach((gw, i) => {
    const r = Math.floor(i / GIWA.cols), c = i % GIWA.cols, h = .35 + r * .42;
    const m = new THREE.Mesh(giwaGeo, (() => { const tx = giwaTexture(gw.text, gw.nick); return new THREE.MeshStandardMaterial({ map: tx, emissiveMap: tx, emissive: "#ffffff", emissiveIntensity: .32, roughness: .55, metalness: .1, side: THREE.DoubleSide }); })());
    m.position.set(-1.85 + c * .53, h + .27, -r * .55 + .02); m.rotation.x = -.18; m.userData.giwa = gw; giwaTiles.add(m);
    if (gw.flashAt) m.userData.popAt = gw.flashAt;
  });
}

/* 석탑 (마당 가운데) */
const PAGODA = { x: 0, z: 0 };
{ let y = 0; [[3, .6], [2.3, 1.2], [2.9, .3], [1.8, 1], [2.4, .25], [1.4, .9], [1.9, .22], [1, .7], [1.4, .2]].forEach(([s, h], i) => { box(s, h, s, i % 2 ? mat.stone : mat.darkStone, 0, y + h / 2, 0); y += h; });
  cyl(.12, .12, 1.4, mat.darkStone, 0, y + .7, 0); block(-1.7, 1.7, -1.7, 1.7); }
const pagodaLamp = new THREE.PointLight("#ffcf8a", 6, 12, 2); pagodaLamp.position.set(0, 1, 5); scene.add(pagodaLamp);

/* 산신각 · 칠성각 (동쪽) */
const SHRINE = { x: 21, z: -7, w: 6.5, d: 5.5, h: 4.5 };
hall({ ...SHRINE, sign: "山神閣" }); block(17.3, 24.7, -10.3, -4);
const shrineCandle = cyl(.1, .1, .5, mat.candle, 21, .8, -3.9); const shrineFlame = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), mat.flame);
shrineFlame.position.set(21, 1.12, -3.9); shrineFlame.scale.y = 1.8; scene.add(shrineFlame); shrineFlame.visible = false;
const shrineLight = new THREE.PointLight("#ffb466", 0, 8, 2); shrineLight.position.set(21, 1.6, -3.4); scene.add(shrineLight);
let candleUntil = 0;
// 칠성 (북두칠성) 별빛
const sevenStars = new THREE.Group(); scene.add(sevenStars);
[[0, 0], [2, .4], [4, .5], [6, 0], [7, -1.6], [9.4, -1.3], [9.8, .6]].forEach(([x, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshBasicMaterial({ color: "#fff3c8", fog: false })); s.position.set(20 + x, 22 + y, -40); sevenStars.add(s); });

/* 공양간 (서쪽) */
const KITCHEN = { x: -21, z: -7, w: 7.5, d: 5.5, h: 4.5 };
hall({ ...KITCHEN, sign: "供養間" }); block(-25.2, -16.8, -10.3, -4);
box(4, .15, 1.2, mat.wood, -21, .8, -2.8); [[-22.8, -3.2], [-19.2, -3.2], [-22.8, -2.4], [-19.2, -2.4]].forEach(([x, z]) => box(.12, .8, .12, mat.wood, x, .4, z));
block(-23.1, -18.9, -3.5, -2.1);
const bowl = new THREE.Group(); bowl.position.set(-21.6, .9, -2.8); scene.add(bowl); bowl.visible = false;
{ const b = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M("#7a5a40")); b.rotation.x = Math.PI; b.position.y = .28; bowl.add(b);
  const food = new THREE.Mesh(new THREE.CircleGeometry(.26, 16), M("#c98a3a")); food.rotation.x = -Math.PI / 2; food.position.y = .27; bowl.add(food); bowl.userData.food = food; }
const tea = new THREE.Group(); tea.position.set(-20.3, .9, -2.8); scene.add(tea); tea.visible = false;
cyl(.15, .11, .2, M("#e8e2d4"), 0, .1, 0, 12, tea);
const steam = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 4), new THREE.MeshBasicMaterial({ color: "#eee", transparent: true, opacity: 0 })); s.userData.t = i / 6; tea.add(s); steam.push(s); }
let teaUntil = 0;
const kitchenLight = new THREE.PointLight("#ffb466", 6, 9, 2); kitchenLight.position.set(-21, 2.2, -3); scene.add(kitchenLight);

/* 카메라 바로 앞을 가리는 나무는 잠깐 숨겨요 */
const camHide = [];

/* 달빛봉: 서쪽에 솟은 산. 둘레길을 따라 정상까지 걸어 올라갈 수 있어요 */
const MOUNT = { x: -28, z: 28, r: 13, h: 9 };
function mh(x, z) {
  const d = Math.hypot(x - MOUNT.x, z - MOUNT.z); if (d >= MOUNT.r) return 0;
  const k = .5 + .5 * Math.cos(Math.PI * d / MOUNT.r);
  return MOUNT.h * k + Math.sin(x * .7) * Math.cos(z * .6) * .35 * k * (1 - k) * 4;
}
const TRAIL = []; // 둘레길: 바깥에서 정상까지 1.3바퀴 돌아 올라가요
for (let i = 0; i <= 64; i++) { const t = i / 64, r = (MOUNT.r - .4) * (1 - t) + 1.3 * t, a = t * Math.PI * 2.2; TRAIL.push({ x: MOUNT.x + Math.cos(a) * r, z: MOUNT.z + Math.sin(a) * r }); }
const mountMesh = (() => {
  const S = MOUNT.r * 2 + 2, g = new THREE.PlaneGeometry(S, S, 72, 72); g.rotateX(-Math.PI / 2);
  const pos = g.attributes.position, col = [], cG = new THREE.Color("#4d6a3a"), cR = new THREE.Color("#8a8778"), cD = new THREE.Color("#3b5530"), c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    const wx = pos.getX(i) + MOUNT.x, wz = pos.getZ(i) + MOUNT.z, y = mh(wx, wz);
    pos.setY(i, y > 0 ? y - .02 : -.08);
    const k = y / MOUNT.h; c.copy(cD).lerp(cG, Math.min(1, k * 3)).lerp(cR, Math.max(0, (k - .55) * 2.2));
    const n = (Math.sin(wx * 2.3) * Math.cos(wz * 1.9)) * .04; col.push(c.r + n, c.g + n, c.b + n);
  }
  g.setAttribute("color", new THREE.Float32BufferAttribute(col, 3)); g.computeVertexNormals();
  const m = new THREE.Mesh(g, new THREE.MeshStandardMaterial({ vertexColors: true, roughness: .95, flatShading: true }));
  m.position.set(MOUNT.x, 0, MOUNT.z); scene.add(m); return m;
})();
{ // 둘레길 디딤돌과 길가 석등
  const stoneM = M("#b8b2a2", { roughness: .9 });
  TRAIL.forEach((p, i) => {
    const st = new THREE.Mesh(new THREE.CylinderGeometry(.42, .46, .08, 8), stoneM); st.position.set(p.x, mh(p.x, p.z) + .03, p.z); st.rotation.y = i; scene.add(st);
    if (i % 9 === 4) { const q = TRAIL[Math.min(i + 1, TRAIL.length - 1)], dx = q.x - p.x, dz = q.z - p.z, l = Math.hypot(dx, dz) || 1;
      const lx = p.x - dz / l * 1.1, lz = p.z + dx / l * 1.1, ly = mh(lx, lz);
      box(.22, .6, .22, mat.stone, lx, ly + .3, lz); box(.36, .26, .36, mat.stone, lx, ly + .72, lz);
      const f = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), mat.flame); f.position.set(lx, ly + .72, lz); scene.add(f); }
  });
  // 산 위 소나무 (길은 비켜서)
  for (let i = 0, n = 0; i < 400 && n < 46; i++) {
    const a = Math.random() * Math.PI * 2, d = rand(3.6, MOUNT.r - .8), x = MOUNT.x + Math.cos(a) * d, z = MOUNT.z + Math.sin(a) * d;
    if (TRAIL.some((p) => Math.hypot(p.x - x, p.z - z) < 1.5)) continue; n++;
    const t = new THREE.Group(); t.position.set(x, mh(x, z) - .05, z); scene.add(t); camHide.push(t);
    cyl(.12, .18, 1.2, mat.trunk, 0, .6, 0, 6, t);
    const c1 = new THREE.Mesh(new THREE.ConeGeometry(.9, 1.8, 7), mat.leaf2); c1.position.y = 1.7; t.add(c1);
    const c2 = new THREE.Mesh(new THREE.ConeGeometry(.65, 1.4, 7), mat.leaf); c2.position.y = 2.5; t.add(c2);
    const s = rand(.8, 1.4); t.scale.set(s, s, s);
  }
  for (let i = 0; i < 16; i++) { const a = Math.random() * Math.PI * 2, d = rand(1.5, MOUNT.r - 1), x = MOUNT.x + Math.cos(a) * d, z = MOUNT.z + Math.sin(a) * d; if (TRAIL.some((p) => Math.hypot(p.x - x, p.z - z) < 1.2)) continue; const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.3, .8)), mat.stone); r.position.set(x, mh(x, z), z); scene.add(r); }
  // 정상 표지석
  const top = mh(MOUNT.x, MOUNT.z);
  const mk = new THREE.Mesh(new THREE.BoxGeometry(.55, 1.1, .3), M("#d8d2c2", { roughness: .8 })); mk.position.set(MOUNT.x, top + .5, MOUNT.z); mk.rotation.y = Math.PI / 2; scene.add(mk);
  const sg = textSprite("달빛봉 정상", { size: 36, color: "#f3e6c4", bg: "#3b2a1a", pad: 14 }); sg.material.depthTest = true; sg.position.set(MOUNT.x, top + 2, MOUNT.z); sg.scale.multiplyScalar(.75); scene.add(sg);
  const far = textSprite("⛰ 달빛봉", { size: 44, color: "#f3e6c4", bg: "rgba(40,30,20,.55)", pad: 14 }); far.position.set(MOUNT.x, top + 4.2, MOUNT.z); far.scale.multiplyScalar(1.3); scene.add(far); mountMesh.userData.far = far;
}

/* 산책길 (남쪽 숲) + 계곡 */
for (let z = 12; z < 44; z += 2.4) for (const side of [-1, 1]) {
  const x = side * rand(4, 8) + Math.sin(z * .15) * 1.5;
  const t = new THREE.Group(); t.position.set(x, 0, z + rand(-.6, .6)); scene.add(t); camHide.push(t);
  cyl(.18, .25, 2, mat.trunk, 0, 1, 0, 6, t);
  const c1 = new THREE.Mesh(new THREE.ConeGeometry(1.6, 3, 7), mat.leaf2); c1.position.y = 3; t.add(c1);
  const c2 = new THREE.Mesh(new THREE.ConeGeometry(1.2, 2.4, 7), mat.leaf); c2.position.y = 4.4; t.add(c2);
  const s = rand(.8, 1.3); t.scale.set(s, s, s); block(x - .4, x + .4, z - .4, z + .4);
}
const stream = new THREE.Mesh(new THREE.PlaneGeometry(3, 40), mat.water); stream.rotation.x = -Math.PI / 2; stream.position.set(11, .05, 26); scene.add(stream);
for (let i = 0; i < 18; i++) { const r = new THREE.Mesh(new THREE.DodecahedronGeometry(rand(.3, .7)), mat.stone); r.position.set(11 + rand(-2.2, 2.2), .1, rand(7, 45)); scene.add(r); }
// 마당 둘레 나무와 석등
[[-12, 6], [12, 6], [-10, -12], [10, -12], [-13, 1], [13, 1]].forEach(([x, z]) => {
  const t = new THREE.Group(); t.position.set(x, 0, z); scene.add(t); camHide.push(t); cyl(.22, .3, 2.4, mat.trunk, 0, 1.2, 0, 6, t);
  const c = new THREE.Mesh(new THREE.SphereGeometry(1.8, 10, 8), mat.leaf); c.position.y = 3.4; t.add(c); block(x - .4, x + .4, z - .4, z + .4); });
[[-4, 4.5], [4, 4.5]].forEach(([x, z]) => { box(.5, 1, .5, mat.stone, x, .5, z); box(.7, .5, .7, mat.stone, x, 1.25, z); const l = new THREE.Mesh(new THREE.SphereGeometry(.15, 8, 6), mat.flame); l.position.set(x, 1.25, z + .36); scene.add(l); block(x - .4, x + .4, z - .4, z + .4); });
// 범종각 (서남쪽)
{ const g = new THREE.Group(); g.position.set(-9, 0, 7); scene.add(g); camSolidGroups.push(g);
  [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([x, z]) => cyl(.15, .18, 3.2, mat.pillar, x, 1.6, z, 8, g));
  box(3.1, .25, 3.1, mat.green, 0, 3.25, 0, g);
  koreanRoof(2.4, 2.4, 1.3, g, 3.35, { lift: .45 }).forEach((e) => addPung(g, e));
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(.55, .8, 1.5, 16), M("#5a5a4a", { metalness: .7, roughness: .4 })); bell.position.y = 2.2; g.add(bell);
  block(-10.6, -7.4, 5.4, 8.6); }

/* 기념품 가게 (마당 동쪽) */
{
  const g = new THREE.Group(); g.position.set(9.5, 0, 3.4); scene.add(g); camSolidGroups.push(g);
  box(3.4, .9, .9, mat.wood, 0, .45, .7, g);
  box(3.6, .08, 1.0, mat.wood, 0, .93, .7, g);
  box(3.4, 2.4, .15, mat.wall, 0, 1.2, -.3, g);
  [[-1.7, 1.1], [1.7, 1.1], [-1.7, -.3], [1.7, -.3]].forEach(([x, z]) => cyl(.07, .08, 2.6, mat.pillar, x, 1.3, z, 8, g));
  const stripe = canvasTex(256, 64, (x, w, h) => { for (let i = 0; i < 8; i++) { x.fillStyle = i % 2 ? "#f3eee3" : "#c23a2c"; x.fillRect(i * 32, 0, 32, h); } x.fillStyle = "#c23a2c"; for (let i = 0; i < 8; i++) { x.beginPath(); x.arc(i * 32 + 16, h, 16, Math.PI, 0); x.fill(); } });
  const awn = new THREE.Mesh(new THREE.PlaneGeometry(3.8, 1.5), new THREE.MeshStandardMaterial({ map: stripe, side: THREE.DoubleSide, roughness: .8 }));
  awn.position.set(0, 2.55, .55); awn.rotation.x = -1.0; g.add(awn);
  box(3.2, .06, .35, mat.wood, 0, 1.55, -.15, g); box(3.2, .06, .35, mat.wood, 0, 2.05, -.15, g);
  for (let i = 0; i < 7; i++) { const mk = new THREE.Mesh(new THREE.SphereGeometry(.11, 12, 8), M("#8a4f22", { roughness: .45 })); mk.scale.set(1.15, .85, 1); mk.position.set(-1.35 + i * .45, 1.68, -.12); g.add(mk); }
  ["#f2a65a", "#e86a5a", "#f2d05a", "#7fc7a0", "#d98ac9", "#7fb0e6"].forEach((c, i) => { const l = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), new THREE.MeshStandardMaterial({ color: c, emissive: c, emissiveIntensity: .6 })); l.scale.y = 1.2; l.position.set(-1.2 + i * .48, 2.2, -.1); g.add(l); });
  for (let i = 0; i < 6; i++) { const b = new THREE.Mesh(new THREE.TorusGeometry(.12, .035, 6, 16), M("#a8643a")); b.rotation.x = Math.PI / 2; b.position.set(-1.2 + i * .48, 1.0, .5); g.add(b); }
  const sign = textSprite("기념품 가게", { size: 40, color: "#f3e6c4", bg: "#5a2a1a", pad: 16 }); sign.material.depthTest = true; sign.position.set(0, 3.1, .9); sign.scale.multiplyScalar(.8); g.add(sign);
  block(7.7, 11.3, 3.0, 4.75);
}

/* 연등 줄 (소원) */
const lanternGroup = new THREE.Group(); scene.add(lanternGroup);
const lanternSlots = [];
for (let row = 0; row < 3; row++) for (let i = 0; i < 14; i++) lanternSlots.push(new THREE.Vector3(-9.1 + i * 1.4, 4.2 - Math.sin((i / 13) * Math.PI) * .6, -8 + row * 5));
for (let row = 0; row < 3; row++) {
  const pts = []; for (let i = 0; i < 14; i++) { const p = lanternSlots[row * 14 + i]; pts.push(p.x, p.y + .45, p.z); }
  const g = new THREE.BufferGeometry(); g.setAttribute("position", new THREE.Float32BufferAttribute(pts, 3));
  scene.add(new THREE.Line(g, new THREE.LineBasicMaterial({ color: "#6b5a48" })));
}
const lanternColors = ["#f2a65a", "#e86a5a", "#f2d05a", "#7fc7a0", "#d98ac9", "#7fb0e6"];
// 연등 종류: 소원 성격에 따라 색이 달라요
const LANTERN_KINDS = {
  gold:   { name: "황금등", emoji: "💰", color: "#f5c542", desc: "재물 · 사업 · 금전운" },
  wisdom: { name: "지혜등", emoji: "📚", color: "#8fc4ff", desc: "합격 · 학업 · 취업 · 승진" },
  health: { name: "건강등", emoji: "🍀", color: "#7fd6a0", desc: "건강 · 가족의 평안" },
  love:   { name: "인연등", emoji: "💗", color: "#f29ac8", desc: "사랑 · 결혼 · 좋은 인연" },
  hope:   { name: "소망등", emoji: "🏮", color: "#f2a65a", desc: "그 밖의 모든 소원" }
};
const KIND_KEYS = Object.keys(LANTERN_KINDS);
const KIND_WORDS = [
  ["gold", /돈|부자|로또|복권|재물|대박|억|월급|연봉|사업|장사|매출|주식|코인|금전|빚|재테크|집\s?사|건물주|부귀|횡재/],
  ["wisdom", /합격|시험|공부|취업|취직|성적|지혜|대학|수능|임용|자격증|승진|면접|학업|논문|졸업|이직/],
  ["health", /건강|아프지|병|수술|회복|장수|무병|낫게|완쾌|평안|무탈/],
  ["love", /사랑|결혼|연애|남자\s?친구|여자\s?친구|남친|여친|인연|짝|좋아하|썸|재회|첫사랑|고백|솔로/]
];
function guessKind(text) { for (const [k, re] of KIND_WORDS) if (re.test(text)) return k; return "hope"; }
const kindOf = (w) => (w && LANTERN_KINDS[w.kind] ? w.kind : null);
// 불빛 번짐 텍스처 (한 번만 만들어 둬요)
const glowTex = (() => {
  const c = document.createElement("canvas"); c.width = c.height = 64; const x = c.getContext("2d");
  const g = x.createRadialGradient(32, 32, 0, 32, 32, 32); g.addColorStop(0, "rgba(255,255,255,1)"); g.addColorStop(.35, "rgba(255,255,255,.45)"); g.addColorStop(1, "rgba(255,255,255,0)");
  x.fillStyle = g; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c);
})();
const lanternGeo = new THREE.SphereGeometry(.32, 12, 10), tasselGeo = new THREE.CylinderGeometry(.02, .02, .3, 4);
function renderLanterns(list) {
  lanternGroup.clear();
  list.slice(0, lanternSlots.length).forEach((w, i) => {
    const k = kindOf(w), color = k ? LANTERN_KINDS[k].color : lanternColors[i % lanternColors.length];
    const lit = !k || !!w.lit; // 예전 연등(종류 없음)은 원래대로 켜 둬요
    const base = new THREE.Color(color);
    const mat = new THREE.MeshStandardMaterial({ color: lit ? base : base.clone().multiplyScalar(.38), emissive: color, emissiveIntensity: lit ? (k === "gold" ? 1.35 : 1.05) : .05 });
    const m = new THREE.Mesh(lanternGeo, mat);
    m.scale.y = 1.2; m.position.copy(lanternSlots[i]); m.userData.wish = w; lanternGroup.add(m);
    const tassel = new THREE.Mesh(tasselGeo, new THREE.MeshBasicMaterial({ color: lit ? color : "#5a4a3a" })); tassel.position.y = -.5; m.add(tassel);
    if (lit) {
      const halo = new THREE.Sprite(new THREE.SpriteMaterial({ map: glowTex, color, transparent: true, opacity: k === "gold" ? .75 : .5, depthWrite: false, blending: THREE.AdditiveBlending }));
      halo.scale.setScalar(k === "gold" ? 1.9 : 1.5); halo.raycast = () => {}; m.add(halo); m.userData.halo = halo;
    }
    if (isMyWish(w) && !lit) { const tag = textSprite("내 연등", { size: 30, color: "#f3e6c4", bg: "rgba(16,21,29,.6)", pad: 10 }); tag.scale.multiplyScalar(.7); tag.position.y = .75; tag.raycast = () => {}; m.add(tag); }
  });
}

/* =========================================================
   동자승
   ========================================================= */
function textSprite(text, { size = 40, color = "#ece6d8", bg = "rgba(16,21,29,.7)", pad = 14 } = {}) {
  const c = document.createElement("canvas"), x = c.getContext("2d");
  const font = `${size}px "Gowun Dodum","Apple SD Gothic Neo",sans-serif`;
  x.font = font; const w = Math.ceil(x.measureText(text).width) + pad * 2, h = size + pad * 1.4;
  c.width = w; c.height = h; x.font = font;
  x.fillStyle = bg; const r = h / 2; x.beginPath(); x.roundRect ? x.roundRect(0, 0, w, h, r) : x.rect(0, 0, w, h); x.fill();
  x.fillStyle = color; x.textBaseline = "middle"; x.textAlign = "center"; x.fillText(text, w / 2, h / 2 + 2);
  const tex = new THREE.CanvasTexture(c); tex.colorSpace = THREE.SRGBColorSpace;
  const s = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, depthTest: false, transparent: true }));
  s.scale.set(w / 110, h / 110, 1); s.renderOrder = 10; return s;
}
/* ---------- 수행 등급 · 공덕 · 매일 미션 ---------- */
const TITLES = [["동자", 0], ["행자", 100], ["수행자", 300], ["스님", 800], ["큰스님", 2000], ["도인", 5000]];
const levelOf = (p) => { let l = 0; TITLES.forEach(([, need], i) => { if (p >= need) l = i; }); return l; };
const labelText = (nick, lv) => `${TITLES[clamp(lv | 0, 0, TITLES.length - 1)][0]} ${nick || "스님"}`;
const PTS = { pung: 1, rice: 5, giwa: 5, emo: 0, mok: 1, bow: 3, incense: 3, bell: 2, tap: 10, pray: 5, candle: 3, meal: 3, tea: 2, greet: 2, wish: 5, bead: 1, chat: 1, visit: 0, climb: 10, yaho: 1 };
const MISSION_POOL = [
  ["mok", 30, "목탁 30번 치기"], ["bow", 30, "절 30번 올리기"], ["tap", 1, "탑돌이 한 바퀴"], ["greet", 3, "합장 인사 3번"],
  ["incense", 1, "향 피우기"], ["tea", 1, "공양간에서 차 마시기"], ["wish", 1, "소원 연등 달기"], ["visit:walk", 1, "산책길 걷기"],
  ["chat", 1, "누군가에게 말 걸기"], ["bead", 108, "염주 한 바퀴 돌리기"], ["pray", 1, "법당이나 달빛봉에서 기도 1독"], ["bell", 3, "범종 3번 치기"], ["visit:peak", 1, "달빛봉 정상 오르기"], ["rice", 1, "부처님께 공양미 올리기"], ["giwa", 1, "기와에 소원 적기"]
];
function todayMissions() {
  let h = 0; for (const ch of today) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  const pool = MISSION_POOL.slice(), out = [];
  while (out.length < 3) { h = (h * 1103515245 + 12345) >>> 0; out.push(pool.splice(h % pool.length, 1)[0]); }
  return out;
}
if (!me.daily || me.daily.day !== today) me.daily = { day: today, c: {}, done: [] };
const MISSIONS = todayMissions();
let lastLevel = levelOf(me.pts);
function gain(kind, n = 1) {
  if (typeof visitAct === "function") visitAct(kind);
  const key = kind; me.daily.c[key] = (me.daily.c[key] || 0) + n;
  const pv = (PTS[kind.split(":")[0]] ?? 0) * n; me.pts += pv; me.coin += pv;
  MISSIONS.forEach(([k, goal, title]) => {
    if (k === key && !me.daily.done.includes(k) && me.daily.c[k] >= goal) {
      me.daily.done.push(k); me.pts += 30; me.coin += 30; toast(`✅ 오늘의 수행 완료: ${title} (+30 공덕 · 🪙30)`); sfx.soft();
      if (me.daily.done.length === MISSIONS.length) setTimeout(() => { toast("🌕 오늘의 수행을 모두 마쳤어요! (+50 공덕 · 🪙50)"); me.pts += 50; me.coin += 50; save(); updateHud(); }, 1200);
    }
  });
  const lv = levelOf(me.pts);
  if (lv > lastLevel) {
    lastLevel = lv; toast(`🎉 ${TITLES[lv][0]}(으)로 올라갔어요!`); sfx.bell();
    if (player) { setLabel(player, labelText(me.nick, lv), true); applyAura(player, lv); bubble(player, `${TITLES[lv][0]} 승급!`); showFront(); trackMe(); }
    renderLookPanel("lookBody");
  }
  save(); updateHud();
}
function updateHud() {
  const lv = levelOf(me.pts), next = TITLES[lv + 1];
  $("hudTitle").textContent = TITLES[lv][0];
  $("hudPts").textContent = me.pts.toLocaleString(); $("hudCoin").textContent = me.coin.toLocaleString();
  const base = TITLES[lv][1], pct = next ? Math.min(100, ((me.pts - base) / (next[1] - base)) * 100) : 100;
  $("hudBar").style.width = pct + "%";
  $("hudMission").textContent = `오늘의 수행 ${me.daily.done.length}/3`;
}
function renderMissionPanel() {
  const lv = levelOf(me.pts), next = TITLES[lv + 1];
  $("missionLevel").textContent = next ? `${TITLES[lv][0]} · 공덕 ${me.pts.toLocaleString()} · ${next[0]}까지 ${(next[1] - me.pts).toLocaleString()}` : `${TITLES[lv][0]} · 공덕 ${me.pts.toLocaleString()} · 최고 등급`;
  const ul = $("missionList"); ul.innerHTML = "";
  MISSIONS.forEach(([k, goal, title]) => {
    const li = document.createElement("li"); const done = me.daily.done.includes(k); const c = Math.min(goal, me.daily.c[k] || 0);
    li.className = done ? "done" : ""; li.innerHTML = `<span>${done ? "✅" : "⬜"} </span>`; li.append(title);
    const sm = document.createElement("small"); sm.textContent = `${c}/${goal}`; li.appendChild(sm); ul.appendChild(li);
  });
  const tl = $("titleList"); tl.innerHTML = "";
  TITLES.forEach(([name, need], i) => { const li = document.createElement("li"); li.className = i <= lv ? "got" : ""; li.textContent = `${name} · ${need.toLocaleString()}`; tl.appendChild(li); });
}

/* ---------- 법복 꾸미기 ---------- */
const LOOKS = {
  robe: [["회색", "#c9ccd2"], ["먹색", "#4a4f5a"], ["연분홍", "#f0c9cf"], ["하늘", "#b9d3ea"], ["연두", "#cfe2b8"], ["미색", "#efe6d2"]],
  sash: [["황금", "#d9b44a"], ["주황", "#e0874a"], ["자주", "#8e3b5c"], ["갈색", "#7a5233"], ["청록", "#3f8f7d"]],
  acc: [["없음", ""], ["목걸이 염주", "beads"], ["털모자", "beanie"], ["삿갓", "hat"], ["연꽃", "lotus"], ["미니 목탁", "moktak"], ["연등", "lantern"], ["꽃 화관", "crown"], ["선글라스", "shades"],
    ["손풍경", "pung"], ["목탁 클리커", "clicker"], ["팔찌 염주", "bracelet"], ["염꾸 염주", "yeomku"]]
};
const ACC_LEVEL = [0, 0, 1, 2, 3, 0, 0, 0, 0, 0, 0, 0, 0];
// 염꾸: 알 색깔과 이니셜
const YK_BEADS = [["백단", "#c89a62"], ["흑단", "#2e2420"], ["옥", "#7fbf9a"], ["자수정", "#9b72c9"], ["장미석", "#f0a6b8"], ["호박", "#e8a33a"], ["청금석", "#3b5fb0"], ["진주", "#f2ede4"], ["산호", "#e8604c"], ["수정", "#cfe8f2"]];
const ykShow = (t) => String(t || "").replace(/\*/g, "♥").replace(/\+/g, "★");
// 십이지신: 자축인묘진사오미신유술해
const ZODIAC = [["자", "子", "🐭", "쥐"], ["축", "丑", "🐮", "소"], ["인", "寅", "🐯", "호랑이"], ["묘", "卯", "🐰", "토끼"], ["진", "辰", "🐲", "용"], ["사", "巳", "🐍", "뱀"], ["오", "午", "🐴", "말"], ["미", "未", "🐑", "양"], ["신", "申", "🐵", "원숭이"], ["유", "酉", "🐔", "닭"], ["술", "戌", "🐶", "개"], ["해", "亥", "🐷", "돼지"]];
const YK_N = 16, YK_ZSLOT = 8; // 알 16개, 십이지 장식은 맨 아래
// 염꾸 설정 문자열: Z + 알 16개 색(숫자) + 띠(0-9,a,b / n=없음) + 표시(g=그림, h=한자) + 이니셜(최대 6자)
const YK_RE = /^Z([0-9]{16})([0-9abn])([gh])([0-9A-Z*+]{0,6})$/, YK_OLD = /^([0-9])([0-9A-Z*+]{1,6})$/;
function ykParse(c) {
  let m = YK_RE.exec(c || ""); if (m) return { cols: [...m[1]].map(Number), z: m[2] === "n" ? -1 : parseInt(m[2], 16), mode: m[3], text: m[4] };
  m = YK_OLD.exec(c || ""); if (m) return { cols: Array(YK_N).fill(+m[1]), z: -1, mode: "g", text: m[2] };
  return null;
}
const ykStr = (k) => `Z${k.cols.join("")}${k.z < 0 ? "n" : k.z.toString(16)}${k.mode}${k.text}`;
function ykLayout(k) { // 맨 위에 이니셜, 맨 아래 십이지, 나머지는 알
  const L = [...k.text], start = (YK_N - Math.floor(L.length / 2)) % YK_N, out = [];
  for (let i = 0; i < YK_N; i++) { const li = (i - start + YK_N) % YK_N;
    if (li < L.length) out.push({ t: "l", ch: L[li] }); else if (i === YK_ZSLOT && k.z >= 0) out.push({ t: "z", z: k.z }); else out.push({ t: "b", c: k.cols[i] }); }
  return out;
}
const zodLabel = (z, mode) => (mode === "h" ? ZODIAC[z][1] : ZODIAC[z][2]);
const SKINS = [["구릿빛", "#c4825a"], ["살구", "#f0c39c"], ["뽀얀", "#f7e2d0"], ["복숭아", "#f2a99a"], ["갈색", "#9a6440"], ["진갈색", "#6b4128"], ["달빛", "#cdd8ee"], ["연두", "#bfdca4"], ["노랑", "#f4d77a"]];
const SHOP = [ // 기념품 가게에서 복전으로 사는 소품 (acc 번호, 값, 설명)
  [5, 150, "🪵", "허리춤에 차는 미니 목탁"], [6, 220, "🏮", "손에 드는 작은 연등"], [7, 300, "🌼", "머리에 쓰는 들꽃 화관"], [8, 500, "😎", "깨달음의 선글라스"],
  [9, 180, "🎐", "손에 드는 풍경. 걸을 때마다 딸랑딸랑"], [10, 120, "🔘", "어디서든 '딸깍' 누르는 목탁 클리커"], [11, 160, "📿", "손목에 차는 단주 팔찌"], [12, 400, "🔤", "염꾸: 알 색과 이니셜을 골라 만드는 나만의 팔찌"]
];
const shopPrice = (i) => (SHOP.find((x) => x[0] === i) || [])[1];
const ownedAcc = (i) => !shopPrice(i) || me.owned.includes(i); // 소품을 쓰려면 필요한 등급 (털모자: 행자, 삿갓: 수행자, 연꽃: 스님)
const looksOk = (l) => typeof l === "string" && /^[0-9]{1,2}(-[0-9]{1,2}){2,4}(-(Z[0-9]{16}[0-9abn][gh][0-9A-Z*+]{0,6}|[0-9][0-9A-Z*+]{1,6}))?$/.test(l);
function lookParts(l) { const parts = (looksOk(l) ? l : "0-0-0").split("-"); const [r, s, a, f = 0, k = 0] = parts.slice(0, 5).map(Number); const c = parts[5] || "";
  return { r: LOOKS.robe[r] ? r : 0, s: LOOKS.sash[s] ? s : 0, a: LOOKS.acc[a] ? a : 0, f: FACES[f] ? f : 0, k: SKINS[k] ? k : 0, c: ykParse(c) ? c : "" }; }
const lookStr = (p) => `${p.r}-${p.s}-${p.a}-${p.f}-${p.k}` + (p.c ? `-${p.c}` : "");
function applyLook(m, l) {
  if (!m || m.look === l) return; m.look = l;
  const p = lookParts(l);
  m.robeMat.color.set(LOOKS.robe[p.r][1]); m.sashMat.color.set(LOOKS.sash[p.s][1]); m.skinMat.color.set(SKINS[p.k][1]);
  buildFace(m, FACES[p.f][1]);
  if (m.acc) { m.head.remove(m.acc); m.body.remove(m.acc); m.armR.remove(m.acc); m.acc = null; }
  const kind = LOOKS.acc[p.a][1]; let g = null;
  if (kind === "beads") {
    g = new THREE.Group(); const n = 18;
    for (let i = 0; i < n; i++) { const a = (i / n) * Math.PI * 2; const b = new THREE.Mesh(new THREE.SphereGeometry(.045, 8, 6), M(i === 0 ? "#3f8f7d" : "#6b3f22")); b.position.set(Math.cos(a) * .3, 0, Math.sin(a) * .27); g.add(b); }
    g.position.set(0, .98, .03); g.rotation.x = .35; m.body.add(g);
  } else if (kind === "hat") {
    g = new THREE.Group();
    const brim = new THREE.Mesh(new THREE.ConeGeometry(.78, .34, 24, 1, true), M("#c9a46a")); brim.material.side = THREE.DoubleSide; g.add(brim);
    const knob = new THREE.Mesh(new THREE.SphereGeometry(.06, 8, 6), M("#8a6a3a")); knob.position.y = .18; g.add(knob);
    g.position.y = .52; m.head.add(g);
  } else if (kind === "lotus") {
    g = new THREE.Group();
    for (let i = 0; i < 7; i++) { const a = (i / 7) * Math.PI * 2; const pt = new THREE.Mesh(new THREE.SphereGeometry(.07, 8, 6), M("#f2a0b8")); pt.scale.set(.7, 1.5, .5); pt.position.set(Math.cos(a) * .07, .05, Math.sin(a) * .07); pt.rotation.set(Math.sin(a) * .6, 0, -Math.cos(a) * .6); g.add(pt); }
    const c = new THREE.Mesh(new THREE.SphereGeometry(.05, 8, 6), M("#f2d05a")); c.position.y = .06; g.add(c);
    g.position.set(.3, .38, .18); m.head.add(g);
  } else if (kind === "beanie") {
    g = new THREE.Group();
    const cap = new THREE.Mesh(new THREE.SphereGeometry(.52, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2.2), M(LOOKS.sash[p.s][1])); g.add(cap);
    const pom = new THREE.Mesh(new THREE.SphereGeometry(.12, 10, 8), M("#f3eee3")); pom.position.y = .52; g.add(pom);
    g.position.y = .06; m.head.add(g);
  } else if (kind === "moktak") {
    g = new THREE.Group();
    const body = new THREE.Mesh(new THREE.SphereGeometry(.13, 16, 12), M("#8a4f22", { roughness: .45 })); body.scale.set(1.15, .85, 1); g.add(body);
    const slit = new THREE.Mesh(new THREE.TorusGeometry(.09, .012, 6, 16, Math.PI), M("#2a1608")); slit.rotation.set(0, 0, Math.PI); slit.position.set(0, 0, .11); g.add(slit);
    const cord = new THREE.Mesh(new THREE.CylinderGeometry(.008, .008, .16, 6), M("#c23a2c")); cord.position.y = .15; g.add(cord);
    g.position.set(.3, .5, .26); m.body.add(g);
  } else if (kind === "lantern") {
    g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .7, 6), M("#6b4a32")); stick.position.y = .35; g.add(stick);
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(.14, 14, 10), new THREE.MeshStandardMaterial({ color: "#f2a65a", emissive: "#f28a3a", emissiveIntensity: 1.3 })); lamp.scale.y = 1.25; lamp.position.y = .85; g.add(lamp);
    const glow = new THREE.PointLight("#ffb466", 1.2, 2.5, 2); glow.position.y = .85; g.add(glow);
    g.position.set(.5, .45, .18); g.rotation.z = -.15; m.body.add(g);
  } else if (kind === "crown") {
    g = new THREE.Group(); const cols = ["#f2d05a", "#f3eee3", "#f2a0b8", "#b9d3ea"];
    for (let i = 0; i < 14; i++) { const a = i / 14 * Math.PI * 2; const f = new THREE.Mesh(new THREE.SphereGeometry(.055, 8, 6), M(cols[i % 4])); f.position.set(Math.cos(a) * .4, 0, Math.sin(a) * .4); g.add(f); const l = new THREE.Mesh(new THREE.SphereGeometry(.04, 6, 4), M("#5f8a4a")); l.scale.set(1.4, .5, .8); l.position.set(Math.cos(a + .2) * .41, -.03, Math.sin(a + .2) * .41); g.add(l); }
    g.position.y = .3; g.rotation.x = -.12; m.head.add(g);
  } else if (kind === "pung") { // 손풍경
    g = new THREE.Group();
    const stick = new THREE.Mesh(new THREE.CylinderGeometry(.012, .012, .5, 6), M("#6b4a32")); stick.position.y = .25; stick.rotation.z = -.5; g.add(stick);
    const pb = new THREE.Group(); pb.position.set(.13, .46, 0); g.add(pb);
    const bl = new THREE.Mesh(pungBellGeo, PUNG_M); bl.scale.setScalar(.6); pb.add(bl);
    const fs = new THREE.Mesh(fishGeo, PUNG_FISH); fs.scale.setScalar(.6); fs.position.y = -.35; fs.rotation.z = Math.PI / 2; pb.add(fs);
    g.userData.swing = pb; g.position.set(.42, .45, .2); m.body.add(g);
  } else if (kind === "clicker") { // 목탁 클리커
    g = new THREE.Group();
    const bd = new THREE.Mesh(new THREE.SphereGeometry(.09, 14, 10), M("#9a5a2a", { roughness: .4 })); bd.scale.set(1.15, .85, 1); g.add(bd);
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(.035, .035, .03, 12), M("#f2d05a")); btn.position.y = .08; g.add(btn); g.userData.btn = btn;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(.04, .008, 6, 12), M("#c9ccd2", { metalness: .7 })); ring.position.set(-.1, .04, 0); g.add(ring);
    g.position.set(0, -.42, .05); m.armR.add(g);
  } else if (kind === "bracelet" || kind === "yeomku") { // 팔찌 염주 · 염꾸
    g = new THREE.Group();
    const k = kind === "yeomku" ? ykParse(p.c) : null, slots = k ? ykLayout(k) : Array(14).fill({ t: "b", c: -1 }), n = slots.length;
    slots.forEach((sl, i) => { const a = i / n * Math.PI * 2; let b;
      if (sl.t === "l") { const tx = canvasTex(64, 64, (x, w, h) => { x.fillStyle = "#f6f1e6"; x.fillRect(0, 0, w, h); x.fillStyle = "#2a1a0c"; x.font = "bold 44px sans-serif"; x.textAlign = "center"; x.textBaseline = "middle"; x.fillText(ykShow(sl.ch), w / 2, h / 2 + 3); });
        b = new THREE.Mesh(new THREE.BoxGeometry(.055, .055, .055), new THREE.MeshStandardMaterial({ map: tx, roughness: .5 })); }
      else if (sl.t === "z") { const tx = canvasTex(128, 128, (x, w, h) => { const g2 = x.createRadialGradient(46, 40, 6, 64, 64, 64); g2.addColorStop(0, "#fff3c4"); g2.addColorStop(1, "#d9a83a"); x.fillStyle = g2; x.fillRect(0, 0, w, h); x.textAlign = "center"; x.textBaseline = "middle";
          if (k.mode === "h") { x.fillStyle = "#5a1e10"; x.font = "bold 78px serif"; } else x.font = "80px 'Apple Color Emoji','Noto Color Emoji','Segoe UI Emoji',sans-serif"; x.fillText(zodLabel(sl.z, k.mode), w / 2, h / 2 + 6); });
        b = new THREE.Mesh(new THREE.SphereGeometry(.052, 16, 12), new THREE.MeshStandardMaterial({ map: tx, roughness: .35, metalness: .2 })); }
      else b = new THREE.Mesh(new THREE.SphereGeometry(.033, 10, 8), M(sl.c < 0 ? "#5a3418" : YK_BEADS[sl.c][1], { roughness: .35 }));
      b.position.set(Math.cos(a) * .12, 0, Math.sin(a) * .12); b.lookAt(0, 0, 0); g.add(b); });
    g.position.set(0, -.27, 0); m.armR.add(g);
  } else if (kind === "shades") {
    g = new THREE.Group(); const dark = new THREE.MeshStandardMaterial({ color: "#111318", metalness: .6, roughness: .2 });
    [-.16, .16].forEach((x) => { const lens = new THREE.Mesh(new THREE.CircleGeometry(.1, 20), dark); lens.scale.y = .78; lens.position.set(x, .03, .485); g.add(lens); });
    const bridge = new THREE.Mesh(new THREE.BoxGeometry(.1, .02, .02), dark); bridge.position.set(0, .06, .488); g.add(bridge);
    m.head.add(g);
  }
  m.acc = g;
}

function makeMonk(nick, isMe) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const robeM = mat.robe.clone(), sashM = mat.sash.clone(), skinM = mat.skin.clone(); const legs = [];
  // 몸통: 동글동글한 승복
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 18), robeM); torso.scale.set(1, 1.08, .92); torso.position.y = .62; body.add(torso);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(.38, .44, .22, 20), robeM); hem.position.y = .34; body.add(hem);
  // 가사: 몸에 감기는 대각선 띠
  const sash = new THREE.Mesh(new THREE.TorusGeometry(.415, .075, 8, 32), sashM);
  sash.position.y = .64; sash.scale.set(1, 1.08, .94); sash.rotation.set(0, Math.PI / 2, .8); body.add(sash);
  // 다리와 신발
  [-.15, .15].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .14, 4, 8), robeM); leg.position.set(x, .2, 0); body.add(leg); legs.push(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), M("#efe8d8")); shoe.scale.set(1, .6, 1.4); shoe.position.set(x, .05, .05); shoe.userData.z0 = .05; body.add(shoe); legs.push(shoe);
  });
  // 팔 (어깨를 축으로 움직여요)
  const arm = (side) => {
    const g = new THREE.Group(); g.position.set(side * .36, .86, 0); body.add(g);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .2, 4, 8), robeM); sleeve.position.y = -.16; g.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), skinM); hand.position.y = -.34; g.add(hand);
    g.rotation.z = side * .3; return g;
  };
  const armL = arm(-1), armR = arm(1);
  // 큰 머리
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.5, 28, 20), skinM); skull.scale.set(1, .96, .96); head.add(skull);
  [-.16, .16].forEach((x) => {
    const ch = new THREE.Mesh(new THREE.CircleGeometry(.065, 14), new THREE.MeshBasicMaterial({ color: "#e0866a", transparent: true, opacity: .55 })); ch.position.set(x * 1.45, -.1, .462); ch.rotation.y = x * .9; head.add(ch);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), skinM); ear.scale.set(.6, 1, 1); ear.position.set(x * 3.1, -.02, 0); head.add(ear);
  });
  const label = textSprite(nick || "스님", { size: 30, color: isMe ? "#f2a65a" : "#ece6d8", pad: 10 }); label.scale.multiplyScalar(.6); label.position.y = 2.25; root.add(label);
  scene.add(root);
  const mm = { root, body, head, armL, armR, legs, sitting: false, label, nick, robeMat: robeM, sashMat: sashM, skinMat: skinM, acc: null, look: null, pos: new THREE.Vector3(), target: new THREE.Vector3(), yaw: 0, anim: null, animT: 0, moving: false, bubble: null, bubbleUntil: 0 };
  buildFace(mm, "smile"); return mm;
}

/* ---------- 함께 수행하는 동자승: 빈 방석에 같은 법복을 입고 앉아 절해요 ---------- */
const npcs = [];
const NPC_MAX = 30;
function buildNpcs() {
  // 앞줄부터 가운데 위주로 자리를 골라요
  const seats = hallSeats.slice().sort((a, b) => (b.z - a.z) * 0 + (a.z - b.z) * -1 + (Math.abs(a.x) - Math.abs(b.x)) * .4).sort((a, b) => (Math.round(a.z) - Math.round(b.z)) || (Math.abs(a.x) - Math.abs(b.x)));
  seats.slice(0, NPC_MAX).forEach((st, i) => {
    const m = makeMonk("", false); m.label.visible = false; buildFace(m, i % 3 ? "calm" : "smile");
    m.pos.set(st.x, 0, st.z); m.target.copy(m.pos); m.sitting = true; m.yaw = Math.PI; m.root.rotation.y = Math.PI; m.seat = st;
    m.nextBow = performance.now() + 2000 + Math.random() * 9000; m.root.visible = false; npcs.push(m);
  });
}
let npcCheck = 0;
function updateNpcs(dt, now) {
  const inHall = zone === "hall" || (player && player.pos.z < -10 && Math.abs(player.pos.x) < 18);
  if (now > npcCheck) {
    npcCheck = now + 500;
    const want = Math.max(6, NPC_MAX - others.size * 2); let shown = 0;
    for (const m of npcs) {
      const taken = (player && Math.hypot(player.pos.x - m.seat.x, player.pos.z - m.seat.z) < .9) || (pendingSeat && pendingSeat.x === m.seat.x && pendingSeat.z === m.seat.z) || [...others.values()].some((o) => Math.hypot(o.monk.pos.x - m.seat.x, o.monk.pos.z - m.seat.z) < .9);
      m.root.visible = inHall && !taken && shown < want; if (m.root.visible) shown++;
    }
  }
  if (!inHall) return;
  for (const m of npcs) {
    if (!m.root.visible) continue;
    if (now > m.nextBow) { playAnim(m, "bow"); m.nextBow = now + 5000 + Math.random() * 7000; }
    animateMonk(m, dt, now);
  }
}
// 내가 절하면 함께 따라 절해요
function npcsBowAlong() { const now = performance.now(); npcs.forEach((m) => { if (m.root.visible && !m.anim) setTimeout(() => playAnim(m, "bow"), 150 + Math.random() * 700); m.nextBow = Math.max(m.nextBow, now + 2500); }); }

/* ---------- 등급 후광: 스님부터 머리 뒤에 빛이 생겨요 ---------- */
function applyAura(m, lv) {
  if (!m || m.auraLv === lv) return; m.auraLv = lv;
  if (m.aura) { m.head.remove(m.aura); m.aura = null; }
  if (lv < 3) return;
  const g = new THREE.Group(); const c = lv >= 5 ? "#ffe9a8" : lv >= 4 ? "#f2c66a" : "#d9b44a";
  const ring = new THREE.Mesh(new THREE.TorusGeometry(.62, lv >= 4 ? .035 : .022, 8, 40), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .9 })); g.add(ring);
  if (lv >= 4) { const disc = new THREE.Mesh(new THREE.CircleGeometry(.6, 32), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .18 })); g.add(disc); }
  if (lv >= 5) { const outer = new THREE.Mesh(new THREE.TorusGeometry(.78, .02, 8, 48), new THREE.MeshBasicMaterial({ color: c, transparent: true, opacity: .6 })); g.add(outer); const l = new THREE.PointLight("#ffd98a", 1.5, 3, 2); g.add(l); }
  g.position.set(0, .05, -.35); m.head.add(g); m.aura = g;
}

/* ---------- 표정 ---------- */
let frontUntil = 0; const showFront = (ms = 3500) => { frontUntil = performance.now() + ms; };
const FACES = [["미소", "smile"], ["평온", "calm"], ["똘망", "round"], ["활짝", "bright"], ["윙크", "wink"], ["졸림", "sleepy"]];
const EMOTES = [["😊", "웃기", "bright"], ["😮", "놀람", "surprised"], ["🥹", "감동", "cry"], ["😴", "꾸벅", "sleepy"], ["😍", "좋아요", "love"], ["😌", "평온", "calm"]];
const MOUTH_RED = new THREE.MeshBasicMaterial({ color: "#5a1e1a" }), TONGUE = new THREE.MeshBasicMaterial({ color: "#e0767a" }), WHITE = new THREE.MeshBasicMaterial({ color: "#ffffff" }), TEAR = new THREE.MeshBasicMaterial({ color: "#8fd0ff", transparent: true, opacity: .9 });
function buildFace(m, kind) {
  if (m.faceG) m.head.remove(m.faceG);
  const g = new THREE.Group(); m.faceG = g; m.head.add(g); m.faceKind = kind;
  const E = mat.eye, Z = .462;
  const arcEye = (x, flip) => { const e = new THREE.Mesh(new THREE.TorusGeometry(.06, .016, 6, 12, Math.PI), E); if (flip) e.rotation.z = Math.PI; e.position.set(x, flip ? .05 : .02, Z); g.add(e); };
  const lineEye = (x, tilt = 0) => { const e = new THREE.Mesh(new THREE.CapsuleGeometry(.014, .09, 4, 6), E); e.rotation.z = Math.PI / 2 + tilt; e.position.set(x, .0, Z); g.add(e); };
  const dotEye = (x, big) => { const e = new THREE.Mesh(new THREE.SphereGeometry(big ? .068 : .055, 14, 10), E); e.scale.set(1, 1.15, .45); e.position.set(x, .03, Z - .005); g.add(e); const hl = new THREE.Mesh(new THREE.SphereGeometry(.018, 8, 6), WHITE); hl.position.set(x + .02, .065, Z + .02); g.add(hl); };
  const smile = (w = .05, frown) => { const mo = new THREE.Mesh(new THREE.TorusGeometry(w, .013, 6, 12, Math.PI), E); if (!frown) mo.rotation.z = Math.PI; mo.position.set(0, frown ? -.17 : -.14, .47); g.add(mo); };
  const openMouth = () => { const mo = new THREE.Mesh(new THREE.CircleGeometry(.075, 18, Math.PI, Math.PI), MOUTH_RED); mo.position.set(0, -.11, .474); g.add(mo); const t = new THREE.Mesh(new THREE.CircleGeometry(.042, 12, Math.PI, Math.PI), TONGUE); t.position.set(0, -.155, .476); g.add(t); };
  const oMouth = (r = .035) => { const mo = new THREE.Mesh(new THREE.CircleGeometry(r, 16), MOUTH_RED); mo.scale.y = 1.25; mo.position.set(0, -.15, .474); g.add(mo); };
  if (kind === "smile") { arcEye(-.16); arcEye(.16); smile(); }
  else if (kind === "calm") { lineEye(-.16); lineEye(.16); smile(.035); }
  else if (kind === "round") { dotEye(-.16); dotEye(.16); smile(); }
  else if (kind === "bright") { arcEye(-.16); arcEye(.16); openMouth(); }
  else if (kind === "wink") { dotEye(-.16); arcEye(.16); smile(.045); const t = new THREE.Mesh(new THREE.CircleGeometry(.025, 10, Math.PI, Math.PI), TONGUE); t.position.set(.02, -.155, .477); g.add(t); }
  else if (kind === "sleepy") { lineEye(-.16, .15); lineEye(.16, -.15); oMouth(.022); }
  else if (kind === "surprised") { dotEye(-.16, true); dotEye(.16, true); oMouth(.045); }
  else if (kind === "cry") { lineEye(-.16, -.3); lineEye(.16, .3); smile(.04, true); [-.18, .18].forEach((x) => { const d = new THREE.Mesh(new THREE.SphereGeometry(.03, 8, 6), TEAR); d.scale.y = 1.6; d.position.set(x, -.08, .45); g.add(d); }); }
  else if (kind === "love") { arcEye(-.16); arcEye(.16); openMouth(); }
}
function emote(m, i, mine) {
  const em = EMOTES[i]; if (!em || !m) return;
  buildFace(m, em[2]); bubble(m, em[0]); clearTimeout(m.emoT);
  if (em[2] === "sleepy") playAnim(m, "nod");
  if (em[2] === "love") { const h = textSprite("💗", { size: 60, bg: "rgba(0,0,0,0)", pad: 4 }); h.position.y = 2.3; m.root.add(h); let t0 = performance.now(); const up = () => { const k = (performance.now() - t0) / 2200; h.position.y = 2.3 + k * 1.2; h.material.opacity = 1 - k; if (k < 1) requestAnimationFrame(up); else m.root.remove(h); }; up(); }
  m.emoT = setTimeout(() => buildFace(m, FACES[lookParts(m.look || "0-0-0").f][1]), 3500);
  if (mine) { act("emo", { what: String(i) }); gain("emo"); showFront(); }
}
function setLabel(m, nick, isMe) { if (m.nick === nick) return; m.root.remove(m.label); m.label.material.map.dispose(); m.label = textSprite(nick || "스님", { size: 30, color: isMe ? "#f2a65a" : "#ece6d8", pad: 10 }); m.label.scale.multiplyScalar(.6); m.label.position.y = 2.25; m.root.add(m.label); m.nick = nick; }
function bubble(m, text) { if (m.bubble) { m.root.remove(m.bubble); m.bubble.material.map.dispose(); } m.bubble = textSprite(text, { size: 30, color: "#2a1a0c", bg: "rgba(243,238,227,.95)", pad: 10 }); m.bubble.scale.multiplyScalar(.65); m.bubble.position.y = 2.65; m.root.add(m.bubble); m.bubbleUntil = performance.now() + 2200; }
function playAnim(m, name) { m.anim = name; m.animT = 0; }
function animateMonk(m, dt, now) {
  // 걷기
  const step = m.moving ? Math.abs(Math.sin(now * .012)) * .06 : 0;
  m.body.position.y = step;
  const fy = floorY(m.pos.x, m.pos.z) + (m.sitting ? .02 : 0); m.y = (m.y ?? fy) + (fy - (m.y ?? fy)) * Math.min(1, dt * 12);
  m.root.position.set(m.pos.x, m.y, m.pos.z);
  let curYaw = m.root.rotation.y, d = m.yaw - curYaw; d = Math.atan2(Math.sin(d), Math.cos(d)); m.root.rotation.y = curYaw + d * Math.min(1, dt * 10);
  // 동작
  let bowX = 0, handsUp = 0;
  if (m.anim) {
    m.animT += dt;
    if (m.anim === "bow") { const p = m.animT / 1.6; bowX = Math.sin(Math.min(p, 1) * Math.PI) * 1.05; handsUp = 1; if (p >= 1) m.anim = null; }
    else if (m.anim === "greet") { const p = m.animT / 1.4; handsUp = 1; bowX = Math.sin(Math.min(p, 1) * Math.PI) * .35; if (p >= 1) m.anim = null; }
    else if (m.anim === "mok") { const p = m.animT / .35; handsUp = .6; m.head.rotation.x = Math.sin(Math.min(p, 1) * Math.PI) * .15; if (p >= 1) { m.anim = null; m.head.rotation.x = 0; } }
    else if (m.anim === "pray") { const p = m.animT / 3; handsUp = 1; bowX = .2; if (p >= 1) m.anim = null; }
  }
  if (m.sitting) { handsUp = Math.max(handsUp, 1); m.body.position.y -= .2; }
  m.legs?.forEach((l) => { l.scale.y = m.sitting ? .25 : 1; l.position.z = m.sitting ? .2 : (l.userData.z0 || 0); });
  m.body.rotation.x = bowX;
  m.body.position.z = Math.sin(bowX) * .25;
  const sw = m.moving && !m.anim ? Math.sin(now * .012) * .5 : 0;
  m.armL.rotation.set(-1.25 * handsUp + sw, 0, -.3 + handsUp * .95);
  m.armR.rotation.set(-1.25 * handsUp - sw, 0, .3 - handsUp * .95);
  if (m.anim === "eat") { const k = (Math.sin(m.animT * 5) + 1) / 2; m.armR.rotation.set(-1.3 - k * 1.0, 0, .55 - k * .25); m.armL.rotation.set(-1.1, 0, -.5); m.head.rotation.x = .1 * k; if (m.animT > 6) { m.anim = null; m.head.rotation.x = 0; const f = m.onEatDone; m.onEatDone = null; f && f(); } }
  if (m.anim === "nod") { m.head.rotation.x = Math.max(0, Math.sin(m.animT * 3)) * .35; if (m.animT > 3) { m.anim = null; m.head.rotation.x = 0; } }
  if (m.bubble && now > m.bubbleUntil) { m.root.remove(m.bubble); m.bubble.material.map.dispose(); m.bubble = null; }
  if (m.acc && m.acc.userData.swing) { const sw2 = m.acc.userData.swing; sw2.rotation.z = Math.sin(now * (m.moving ? .012 : .003)) * (m.moving ? .5 : .12);
    if (m === player && m.moving && now > (m.nextJingle || 0)) { m.nextJingle = now + 900 + Math.random() * 700; tone(rand(2100, 2600), 1.2, .05 * Math.max(vol.fx, .4)); } }
  // 카메라가 가까우면 이름표 · 말풍선을 작게 (화면을 덮지 않게)
  const k = clamp(camera.position.distanceTo(m.root.position) / 9, .38, 1);
  for (const sp of [m.label, m.bubble]) { if (!sp) continue; if (!sp.userData.base) sp.userData.base = sp.scale.clone(); sp.scale.copy(sp.userData.base).multiplyScalar(k); }
}

/* =========================================================
   나 (플레이어)
   ========================================================= */
let player;
const SPAWN = new THREE.Vector3(0, 0, 9);
function blocked(x, z) {
  if (Math.abs(x) > 44 || z < -40 || z > 46) return true;
  for (const b of blockers) if (x > b.x1 - .3 && x < b.x2 + .3 && z > b.z1 - .3 && z < b.z2 + .3) return true;
  return false;
}
function floorY(x, z) { return (x > HB.x1 - .5 && x < HB.x2 + .5 && z > HB.z1 - .5 && z < HB.z2 + .5) ? .55 : mh(x, z); }
function zoneOf(x, z) {
  if (z < -13.5 && Math.abs(x) < 15.5) return "hall";
  const rk = roomAt(x, z); if (rk) return rk === "sanshin" ? "shrine" : rk;
  if (Math.abs(x + 21) < 5 && z < -1 && z > -11) return "kitchen";
  const md = Math.hypot(x - MOUNT.x, z - MOUNT.z);
  if (md < 2.6) return "peak";
  if (md < MOUNT.r - .2) return "mountain";
  if (z > 11) return "walk";
  if (Math.hypot(x - 9.5, z - 5.6) < 2.6) return "shop";
  if (Math.hypot(x - PAGODA.x, z - PAGODA.z) < 6) return "pagoda";
  return "yard";
}
const ZONES = {
  yard: { name: "마당", intro: "마당에 들어왔어요. 가고 싶은 곳을 눌러 걸어가 보세요." },
  hall: { name: "대웅전", intro: "부처님 앞이에요. 목탁을 치고 절을 올려 보세요." },
  pagoda: { name: "석탑", intro: "석탑을 천천히 돌며 소원을 떠올려 보세요." },
  shrine: { name: "산신각", intro: "산신각이에요. 들어가서 산왕경을 함께 읽어 보세요." },
  chilseong: { name: "칠성각", intro: "칠성각이에요. 들어가서 칠성경을 함께 읽어 보세요." },
  gwaneum: { name: "관음전", intro: "관음전이에요. 들어가서 반야심경을 함께 읽어 보세요." },
  jijang: { name: "지장전", intro: "지장전이에요. 먼저 떠나신 분들을 위해 기도해요." },
  room: { name: "법당", intro: "" },
  kitchen: { name: "공양간", intro: "오늘의 공양을 골라 보세요. 차도 한 잔 있어요." },
  walk: { name: "산책길", intro: "물소리 들리는 숲길이에요. 서쪽으로 가면 달빛봉이 있어요." },
  mountain: { name: "산길", intro: "디딤돌을 따라 한 걸음씩 올라가 보세요." },
  peak: { name: "정상", intro: "정상이에요! 달빛암이 한눈에 내려다보여요." },
  shop: { name: "기념품 가게", intro: "수행하며 모은 복전으로 기념품을 골라 보세요." }
};
const GOTO = { shop: [9.5, 6.2], hall: [0, -16.8], pagoda: [0, 3.2], shrine: [21, -2.4], chilseong: [34, -3.2], gwaneum: [-34, -3.2], jijang: [34, -17.2], kitchen: [-21, -1.2], walk: [0, 16], yard: [0, 8], mountain: [TRAIL[0].x + 1.2, TRAIL[0].z] };

/* =========================================================
   카메라 조작
   ========================================================= */
let camYaw = 0, camPitch = .42, camDist = 7.5;
const pointers = new Map(); let downAt = null, pinchStart = 0, distStart = camDist;
const raycaster = new THREE.Raycaster(), ndc = new THREE.Vector2();
canvas.addEventListener("pointerdown", (e) => { canvas.setPointerCapture(e.pointerId); pointers.set(e.pointerId, { x: e.clientX, y: e.clientY }); if (pointers.size === 1) downAt = { x: e.clientX, y: e.clientY, t: performance.now(), moved: 0 }; if (pointers.size === 2) { const [a, b] = [...pointers.values()]; pinchStart = Math.hypot(a.x - b.x, a.y - b.y); distStart = camDist; downAt = null; } });
canvas.addEventListener("pointermove", (e) => {
  const p = pointers.get(e.pointerId); if (!p) return;
  const dx = e.clientX - p.x, dy = e.clientY - p.y; p.x = e.clientX; p.y = e.clientY;
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camDist = clamp(distStart * pinchStart / Math.max(d, 1), 4, 16); return; }
  if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * .006; camPitch = clamp(camPitch + dy * .004, .12, 1.2);
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (downAt && downAt.moved < 10 && performance.now() - downAt.t < 450) tap(e.clientX, e.clientY);
  downAt = null;
};
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); downAt = null; });
canvas.addEventListener("wheel", (e) => { e.preventDefault(); camDist = clamp(camDist + e.deltaY * .01, 4, 16); }, { passive: false });
window.addEventListener("keydown", (e) => {
  if (!player || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase(), f = 2.5;
  const fw = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), rt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  let v = null;
  if (k === "w" || k === "arrowup") v = fw; if (k === "s" || k === "arrowdown") v = fw.clone().negate();
  if (k === "a" || k === "arrowleft") v = rt.clone().negate(); if (k === "d" || k === "arrowright") v = rt;
  if (v) { standUp(); pendingSeat = null; player.target.copy(player.pos).addScaledVector(v, f); autoPath = null; }
});
function tap(cx, cy) {
  const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hitP = raycaster.intersectObjects(pungs.map((p) => p.children[p.children.length - 1]), false)[0];
  if (hitP) { ringPung(hitP.object.userData.pung, true); return; }
  const hitG = raycaster.intersectObjects(giwaTiles.children, false)[0];
  if (hitG) { const gw = hitG.object.userData.giwa; toast(`🏯 기와 소원 · ${gw.text}${gw.nick ? " · " + gw.nick : ""}`); return; }
  const hitL = raycaster.intersectObjects(lanternGroup.children, false)[0];
  if (hitL) {
    const w = hitL.object.userData.wish, k = kindOf(w), kd = k ? LANTERN_KINDS[k] : null;
    const state = !kd ? "" : w.lit ? " · 불 밝힘" : isMyWish(w) ? " · 108배를 올리면 불이 켜져요" : " · 아직 불이 꺼져 있어요";
    toast(`${kd ? kd.emoji + " " + kd.name + " · " : "🏮 "}${w.text}${w.nick ? " · " + w.nick : ""}${state}`);
    return;
  }
  const hitM = raycaster.intersectObjects([...others.values()].map((o) => o.monk.root), true)[0];
  if (hitM) { for (const [key, o] of others) { let n = hitM.object; while (n && n !== o.monk.root) n = n.parent; if (n) { greet(key); return; } } }
  const hitC = raycaster.intersectObjects(cushions, false)[0];
  if (hitC) { const st = hitC.object.userData.seat; standUp(); player.target.set(st.x, 0, st.z); pendingSeat = st; autoPath = null; say("방석으로 가서 앉아요."); return; }
  const hit = raycaster.intersectObjects([mountMesh, ground], false)[0];
  if (hit) { standUp(); player.target.set(hit.point.x, 0, hit.point.z); autoPath = null; pendingSeat = null; }
}

/* =========================================================
   행동 버튼
   ========================================================= */
let autoPath = null; // [{x,z}] 자동 걷기 (탑돌이 등)
let zone = "yard";
const MENU = [
  ["비빔밥", "🍚", "#c98a3a", "나물 다섯 가지에 고추장 한 숟갈", ["#6f8f4a", "#d9534f", "#f2d05a", "#8a5a3a"]],
  ["연잎밥", "🍃", "#c8b48a", "연잎에 싸서 찐 찹쌀밥, 은은한 향", ["#5f8a4a", "#8a5a3a", "#e8dcc0"]],
  ["산채나물밥", "🌿", "#efe6d2", "고사리 · 도라지 · 취나물", ["#6f8f4a", "#a8864a", "#3f6a3a"]],
  ["미역국 한 상", "🥣", "#3d4a2c", "들기름에 볶은 미역국과 흰밥", ["#2f3a22", "#efe6d2"]],
  ["두부조림", "🧈", "#c9823e", "간장에 졸인 노릇한 두부", ["#e8d8b0", "#6f8f4a"]],
  ["연근조림", "🪷", "#7a4a2a", "아삭하고 달큰한 연근", ["#a8743a", "#efe6d2"]],
  ["버섯들깨탕", "🍄", "#d8c8a8", "표고와 느타리, 고소한 들깨", ["#7a5a3a", "#5a4030"]],
  ["새알 팥죽", "🫘", "#6e2a26", "동짓날 먹는 동글동글 새알심", ["#f3eee3", "#f3eee3"]],
  ["감자전", "🥔", "#e2b85a", "바삭하게 부친 감자전", ["#c9922a", "#6f8f4a"]],
  ["약과와 식혜", "🍯", "#a8642a", "후식으로 달콤하게", ["#8a4a1a", "#e8dcc0"]]
];
if (!Array.isArray(me.ate)) me.ate = [];
let pendingMeal = null, eating = null;
const A = (icon, label, fn, hot) => ({ icon, label, fn, hot });
function actionsFor(z) {
  const greetA = A("🙏", "합장", () => greet(null)), beadA = A("📿", "염주", openBeads), wishA = A("🏮", "소원 연등", () => openPanel("wishPanel"));
  if (z === "hall") return [A(player?.sitting ? "🧍" : "🧘", player?.sitting ? "일어나기" : "방석 앉기", doSit, !player?.sitting), A(autoBow ? "⏸️" : "🙇", autoBow ? "멈추기" : "계속 절하기", toggleAutoBow, true), A("🪵", "목탁", doMok), A("🕯️", "향", doIncense), A("🍚", "공양미", doRice), A(loopEls.yebul && !loopEls.yebul.paused ? "⏹️" : "🎐", loopEls.yebul && !loopEls.yebul.paused ? "예불 끄기" : "예불 듣기", toggleYebul), greetA, beadA];
  const giwaA = A("🏯", "기와 소원", openGiwa);
  if (z === "pagoda") return [A("🗼", "탑돌이", doTapdori, true), wishA, giwaA, greetA, beadA];
  if (z === "shrine") return [A("🚪", "산신각 들어가기", () => enterRoom("sanshin"), true), A("🕯️", "초 켜기", doCandle), greetA];
  if (ROOMS[z]) return [A("🚪", `${ROOMS[z].name} 들어가기`, () => enterRoom(z), true), greetA, beadA];
  if (z === "room") return [A(pray && pray.timer ? "⏸️" : "🙏", pray && pray.timer ? "멈추기" : "기도하기", togglePray, true), A("🙇", "절", doBow), A("🪵", "목탁", doMok), A("🚪", "나가기", leaveRoom)];
  if (z === "kitchen") return [A("🍚", "공양 고르기", () => { renderMenu(); openPanel("menuPanel"); }, true), A("🍵", "차 마시기", doTea, true), greetA, beadA];
  if (z === "shop") return [A("🛍️", "가게 둘러보기", openShop, true), greetA, beadA];
  if (z === "walk") return [A("🌊", "계곡 소리", doNature, true), A("⛰️", "달빛봉 오르기", doClimb, true), greetA, beadA];
  if (z === "mountain") return [A(autoPath?.climb ? "⏸️" : "⛰️", autoPath?.climb ? "멈추기" : "정상까지 오르기", doClimb, true), A("🌬️", "바람 소리", doNature), greetA, beadA];
  if (z === "peak") return [A(pray && pray.timer ? "⏸️" : "✨", pray && pray.timer ? "기도 멈추기" : "칠성기도", () => { pray = pray && pray.k === "chilseong" ? pray : null; togglePray(); }, true), A("🌄", "경치 보기", doView), A("⬇️", "내려가기", doDescend), greetA, wishA];
  return [A("🔔", "범종 치기", doBell), A("🎐", "풍경", doPung), greetA, wishA, giwaA, beadA];
}
function renderActions() {
  const box = $("actions"); box.innerHTML = "";
  const list = actionsFor(zone); if (me.owned.includes(10)) list.push(A("🔘", "딸깍", doClick));
  for (const a of list) { const b = document.createElement("button"); b.type = "button"; b.className = "act" + (a.hot ? " hot" : ""); b.innerHTML = `<i>${a.icon}</i>`; b.append(a.label); b.onclick = () => { ac(); a.fn(); }; box.appendChild(b); }
  $("placeTag").textContent = ZONES[zone].name;
  document.querySelectorAll("#places button").forEach((b) => b.classList.toggle("here", b.dataset.z === zone));
}
const placeNames = { hall: "대웅전", pagoda: "석탑", shrine: "산신각", chilseong: "칠성각", gwaneum: "관음전", jijang: "지장전", kitchen: "공양간", walk: "산책길", mountain: "달빛봉", shop: "기념품" };
for (const [z, n] of Object.entries(placeNames)) {
  const b = document.createElement("button"); b.type = "button"; b.dataset.z = z; b.textContent = n;
  b.onclick = () => { if (inRoom) { stopPray(); hideWorld(false); if (player.aura) player.aura.visible = true; inRoom = null; $("prayBox").hidden = true; player.sitting = false; } standUp(); pendingSeat = null; const [x, zz] = GOTO[z]; player.pos.set(x, 0, zz); player.target.set(x, 0, zz); autoPath = null; camYaw = z === "walk" ? Math.PI : z === "mountain" ? Math.PI / 2 : 0; lastMoveTx = 0; sendPresence(); if (z === "hall") enterHallView(); };
  $("places").appendChild(b);
}

// 법당에 들어서면 입구에서 법당 전체가 한눈에 보이게
let hallTipShown = false;
function enterHallView() { camYaw = 0; camPitch = .34; camDist = 8.5; if (!hallTipShown) { hallTipShown = true; setTimeout(() => toast("화면을 끌면 법당 안을 둘러볼 수 있어요. 두 손가락으로 가까이 · 멀리"), 900); } }
function act(name, extra = {}) { sendPresence({ act: name, ...extra }); if (PTS[name] !== undefined) gain(name); }
function doMok() { sfx.mok(); playAnim(player, "mok"); me.mok++; save(); if (me.mok % 10 === 0) say(); bubble(player, `똑 · ${me.mok}`); act("mok"); }
function doBow() {
  if (player.anim === "bow") return;
  sfx.soft(); playAnim(player, "bow"); me.bow++; save(); act("bow"); npcsBowAlong();
  bubble(player, `${me.bow}배`);
  if (me.bow === 108) {
    say("오늘 108배를 모두 마쳤어요. 정말 수고했어요."); sfx.bell(); me.coin += 108; save(); updateHud(); toast("🪙 108배 완료! 복전 108닢을 받았어요. 기념품 가게에 들러 보세요");
    setTimeout(() => lightMyLanterns(true), 1600);
  } else if (me.bow % 12 === 0) say();
  if (!$("wishPanel").hidden) renderMyLantern();
}
/* ---------- 방석에 앉기 · 계속 절하기 ---------- */
let pendingSeat = null, autoBow = null;
function sitDown() { if (!player || player.sitting) return; player.sitting = true; player.yaw = Math.PI; act("sit"); renderActions(); say("방석에 앉았어요. 숨을 고르고 절을 올려 보세요."); }
function standUp() { if (!player) return; stopAutoBow(); if (player.sitting) { player.sitting = false; act("stand"); renderActions(); } }
function nearestFreeSeat() {
  let best = null, bd = 1e9;
  for (const st of hallSeats) {
    if ([...others.values()].some((o) => Math.hypot(o.monk.pos.x - st.x, o.monk.pos.z - st.z) < .5)) continue;
    const d = Math.hypot(player.pos.x - st.x, player.pos.z - st.z); if (d < bd) { bd = d; best = st; }
  }
  return best;
}
function doSit() {
  if (player.sitting) { standUp(); return; }
  const st = nearestFreeSeat(); if (!st) { toast("빈 방석이 없어요"); return; }
  player.target.set(st.x, 0, st.z); pendingSeat = st; autoPath = null;
}
function stopAutoBow() { if (autoBow) { clearInterval(autoBow); autoBow = null; renderActions(); } }
function toggleAutoBow() {
  if (autoBow) { stopAutoBow(); return; }
  doBow(); autoBow = setInterval(() => { if (!player) return stopAutoBow(); doBow(); if (me.bow % 108 === 0) stopAutoBow(); }, 1900);
  renderActions(); say("천천히 절을 올리는 중이에요. 멈추려면 한 번 더 눌러요.");
}

// 풍경: 누르면 흔들리며 맑게 울려요
function ringPung(pg, mine) {
  pg.userData.amp = mine ? .75 : .35; pg.userData.t0 = performance.now(); sfx.pung(); if (mine && !rec.pung) setTimeout(() => sfx.pung(), 380 + Math.random() * 200);
  if (mine) { gain("pung"); if (!ringPung.told) { ringPung.told = true; say("땡그랑— 처마 끝 풍경 소리가 맑게 퍼져요."); } }
}
function doPung() {
  if (!player) return; const wp = new THREE.Vector3(); let best = null, bd = 1e9;
  pungs.forEach((p) => { p.getWorldPosition(wp); const d = Math.hypot(wp.x - player.pos.x, wp.z - player.pos.z); if (d < bd) { bd = d; best = p; } });
  if (!best) return; ringPung(best, true); bubble(player, "땡그랑~ 🎐");
  if (bd > 7) { best.getWorldPosition(wp); toast("가장 가까운 처마의 풍경을 울렸어요. 처마 끝 풍경을 직접 눌러도 돼요"); }
}
// 목탁 클리커: 누를 때마다 딸깍, 몇 번 눌렀는지 세어 줘요
function doClick() {
  me.click = (me.click || 0) + 1; save();
  const c = ac(), t = c.currentTime; [[1900, .12, .03], [950, .08, .05]].forEach(([f, v, d]) => tone(f, d, v * Math.max(vol.fx, .4), "square"));
  if (navigator.vibrate) navigator.vibrate(6);
  if (player) { bubble(player, `딸깍 ${me.click.toLocaleString()}`); const b = player.acc?.userData.btn; if (b) { b.position.y = .06; setTimeout(() => (b.position.y = .08), 90); } }
  if (me.click % 108 === 0) { say(`딸깍 ${me.click}번. 마음이 한결 가벼워졌어요.`); sfx.soft(); }
}
// 선운사 저녁 예불 녹음 (범종 · 목어 · 운판 · 목탁)
function toggleYebul() {
  const el = loopEls.yebul;
  if (el && !el.paused) { el.pause(); renderActions(); return; }
  if (!soundUrl.yebul) { findSound("yebul").then((u) => { if (u) toggleYebul(); else toast("예불 소리를 불러오지 못했어요"); }); return; }
  loopAudio("yebul", .85 * vol.fx); say("저녁 예불 소리예요. 범종 · 목어 · 운판 · 목탁이 차례로 울려요."); renderActions();
}
const RICE_COST = 10;
function doRice() {
  if (me.coin < RICE_COST) { toast(`공양미 한 되는 복전 🪙${RICE_COST}닢이에요. 절하고 목탁 치며 복전을 모아 보세요`); return; }
  me.coin -= RICE_COST; me.rice = (me.rice || 0) + 1; save(); updateHud();
  if (player) { player.yaw = Math.PI; playAnim(player, "pray"); }
  sfx.soft(); addRiceBag(true); act("rice");
  bubble(player, "공양미 한 되 🙏");
  say(me.rice === 1 ? "부처님 앞에 공양미를 올렸어요. 나눔의 마음이 쌓여요." : `공양미를 올렸어요. 지금까지 ${me.rice}되를 시주했어요.`);
  toast(`🍚 공양미 한 되를 올렸어요 (복전 -${RICE_COST} · 공덕 +${PTS.rice})`);
}
function doIncense() { incenseUntil = Date.now() + 90000; act("incense"); say("향 연기가 천천히 피어올라요."); }
function doBell() { const bx = -9, bz = 7; if (player.pos.distanceTo(new THREE.Vector3(bx, 0, bz)) > 5) { player.target.set(bx + 2.4, 0, bz); } sfx.bell(); act("bell"); say(); bubble(player, "데엥…"); }
function doTapdori() {
  if (autoPath) return; const pts = []; const r = 3.4; const start = Math.atan2(player.pos.x - PAGODA.x, player.pos.z - PAGODA.z);
  for (let i = 0; i <= 36; i++) { const a = start + (i / 36) * Math.PI * 2; pts.push({ x: PAGODA.x + Math.sin(a) * r, z: PAGODA.z + Math.cos(a) * r }); }
  autoPath = { pts, i: 0, done() { me.tap++; save(); bubble(player, `탑돌이 ${me.tap}바퀴`); act("tap"); if (me.tap % 3 === 0) say(); } };
  say("시계 방향으로 천천히 탑을 돌아요.");
}
/* ---------- 달빛봉 산타기 ---------- */
function nearestTrail() { let bi = 0, bd = 1e9; TRAIL.forEach((p, i) => { const d = Math.hypot(p.x - player.pos.x, p.z - player.pos.z); if (d < bd) { bd = d; bi = i; } }); return bi; }
function doClimb() {
  if (autoPath?.climb) { autoPath = null; player.target.copy(player.pos); renderActions(); say("잠깐 쉬어 가요. 다시 누르면 이어서 올라가요."); return; }
  standUp(); pendingSeat = null; pendingMeal = null;
  if (zone !== "mountain" && zone !== "peak") { player.pos.set(TRAIL[0].x + 1.2, 0, TRAIL[0].z); player.target.copy(player.pos); camYaw = Math.PI / 2; lastMoveTx = 0; }
  const i0 = zoneOf(player.pos.x, player.pos.z) === "mountain" ? nearestTrail() : 0;
  autoPath = { climb: true, pts: TRAIL.slice(i0), i: 0, done() { renderActions(); } };
  renderActions(); say("디딤돌을 따라 천천히 올라가요. 숨이 차면 멈추기를 눌러요.");
}
function doDescend() {
  standUp(); const pts = TRAIL.slice().reverse(); pts.push({ x: TRAIL[0].x + 1.5, z: TRAIL[0].z });
  autoPath = { climb: true, pts, i: 0, done() { renderActions(); say("조심조심 잘 내려왔어요."); } };
  renderActions(); say("천천히 내려가요.");
}
let lastClimbGain = 0;
function reachPeak() {
  if (Date.now() - lastClimbGain < 60000) return; lastClimbGain = Date.now();
  me.climb = (me.climb || 0) + 1; save(); sfx.bell(); playAnim(player, "greet"); showFront();
  bubble(player, `정상 도착! ${me.climb}번째`); toast(`⛰️ 달빛봉 정상에 올랐어요! (+10 공덕 · 🪙10)`); act("climb");
}
function doYaho() {
  showFront(); bubble(player, "야호~!"); act("yaho");
  [0, .7, 1.4].forEach((d, i) => { tone(523, .28, (.12 / (i + 1)) * vol.fx, "triangle", d); tone(659, .4, (.12 / (i + 1)) * vol.fx, "triangle", d + .25); });
  setTimeout(() => player && bubble(player, "야호~…"), 1300); setTimeout(() => player && bubble(player, "…야호…"), 2400);
}
function doView() {
  camYaw = Math.atan2(MOUNT.x, MOUNT.z); camPitch = .5; camDist = 15; camera.userData.lerp = true;
  say("저 아래 대웅전과 석탑, 연등이 보여요. 두 손가락으로 다시 가까이 볼 수 있어요.");
}
function doPray(kind) { playAnim(player, "pray"); me.pray++; save(); sfx.soft(); act("pray", { what: kind });
  say(kind === "산신" ? "산의 기운이 가족을 지켜 주길 빌었어요." : "별빛 아래 모두 건강하고 오래오래 행복하길 빌었어요.");
  if (kind === "칠성") { sevenStars.userData.glowUntil = Date.now() + 6000; } }
function doCandle() { candleUntil = Date.now() + 120000; act("candle"); bubble(player, "초를 밝혔어요"); }
/* ---------- 기념품 가게 ---------- */
function openShop() { renderShop(); $("ykBox").hidden = true; openPanel("shopPanel"); }
// 염꾸 만들기
let yk = { cols: Array(YK_N).fill(0), z: -1, mode: "g", text: "" }, ykSel = -1;
function openYeomku() {
  const k = ykParse(lookParts(me.look).c) || ykParse(me.yk); if (k) yk = k; ykSel = -1;
  $("ykBox").hidden = false; renderYeomku(); setTimeout(() => $("ykBox").scrollIntoView({ behavior: "smooth", block: "nearest" }), 30);
}
function beadBg(c) { const col = YK_BEADS[c] ? YK_BEADS[c][1] : "#c89a62"; return `radial-gradient(circle at 35% 30%, #fffa, ${col} 42%, #0005)`; }
function renderYeomku() {
  const cbox = $("ykColors"); cbox.innerHTML = "";
  const cur = ykSel >= 0 ? yk.cols[ykSel] : yk.cols.every((c) => c === yk.cols[0]) ? yk.cols[0] : -1;
  YK_BEADS.forEach(([nm, col], i) => { const b = document.createElement("button"); b.type = "button"; b.className = "look-opt" + (i === cur ? " on" : ""); const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = col; b.append(sw, nm);
    b.onclick = () => { if (ykSel >= 0) yk.cols[ykSel] = i; else yk.cols = Array(YK_N).fill(i); sfx.bead(); renderYeomku(); }; cbox.appendChild(b); });
  $("ykHint").textContent = ykSel >= 0 ? `${ykSel + 1}번째 알을 고르는 중이에요. 색을 누르면 이 알만 바뀌어요.` : "알을 누르면 그 알만 색을 바꿀 수 있어요. 아무 알도 안 고르면 전체가 바뀌어요.";
  $("ykAll").hidden = ykSel < 0;
  const zb = $("ykZodiac"); zb.innerHTML = "";
  [[-1, "없음"]].concat(ZODIAC.map((z, i) => [i, `${z[2]} ${z[0]}(${z[1]})`])).forEach(([i, label]) => { const b = document.createElement("button"); b.type = "button"; b.className = "look-opt" + (yk.z === i ? " on" : ""); b.textContent = label; b.onclick = () => { yk.z = i; sfx.bead(); renderYeomku(); }; zb.appendChild(b); });
  document.querySelectorAll("[data-ykmode]").forEach((b) => b.classList.toggle("on", b.dataset.ykmode === yk.mode));
  $("ykInput").value = ykShow(yk.text);
  const pv = $("ykPreview"); pv.innerHTML = ""; const slots = ykLayout(yk);
  slots.forEach((sl, i) => { const a = i / YK_N * Math.PI * 2 - Math.PI / 2, d = document.createElement("span");
    if (sl.t === "l") { d.className = "yk-letter"; d.textContent = ykShow(sl.ch); }
    else if (sl.t === "z") { d.className = "yk-zod" + (yk.mode === "h" ? " hanja" : ""); d.textContent = zodLabel(sl.z, yk.mode); }
    else { d.className = "yk-bead" + (i === ykSel ? " sel" : ""); d.style.background = beadBg(sl.c); d.onclick = () => { ykSel = ykSel === i ? -1 : i; sfx.bead(); renderYeomku(); }; }
    d.style.left = `${50 + Math.cos(a) * 40}%`; d.style.top = `${50 + Math.sin(a) * 40}%`; pv.appendChild(d); });
  const own = me.owned.includes(12); $("ykBuy").textContent = own ? "이대로 착용하기" : `🪙 ${shopPrice(12)} · 만들어서 착용하기`;
}
$("ykInput").addEventListener("input", () => { yk.text = $("ykInput").value.toUpperCase().replace(/♥/g, "*").replace(/★/g, "+").replace(/[^0-9A-Z*+]/g, "").slice(0, 6); renderYeomku(); });
document.querySelectorAll("[data-yk]").forEach((b) => b.addEventListener("click", () => { if (yk.text.length < 6) { yk.text += b.dataset.yk; renderYeomku(); } }));
document.querySelectorAll("[data-ykmode]").forEach((b) => b.addEventListener("click", () => { yk.mode = b.dataset.ykmode; renderYeomku(); }));
$("ykClear").addEventListener("click", () => { yk.text = ""; renderYeomku(); });
$("ykAll").addEventListener("click", () => { yk.cols = Array(YK_N).fill(yk.cols[ykSel]); ykSel = -1; renderYeomku(); });
$("ykBuy").addEventListener("click", () => {
  const plain = !yk.text && yk.z < 0 && yk.cols.every((c) => c === yk.cols[0]);
  if (plain) { toast("이니셜이나 십이지를 넣거나, 알 색을 하나 이상 바꿔 주세요"); return; }
  const price = shopPrice(12), name = [yk.z >= 0 ? ZODIAC[yk.z][3] + "띠" : "", ykShow(yk.text)].filter(Boolean).join(" ") || "알록달록";
  if (!me.owned.includes(12)) { if (me.coin < price) { toast(`복전이 ${price - me.coin}닢 모자라요. 108배를 마치면 108닢을 받아요`); return; } me.coin -= price; me.owned.push(12); sfx.bell(); toast(`📿 나만의 염꾸 '${name}' 완성! 염주 돌리기에서도 이 염주로 돌려요`); }
  const p = lookParts(me.look); p.a = 12; p.c = ykStr(yk); me.look = lookStr(p); me.yk = p.c; me.ykRing = true; save();
  if (player) { applyLook(player, me.look); showFront(); bubble(player, `📿 ${name}`); lastMoveTx = 0; lastTarget = { x: 1e9, z: 1e9 }; sendPresence(); trackMe(); }
  updateHud(); renderShop(); renderActions(); $("ykBox").hidden = false; renderYeomku(); renderLookPanel("lookBody");
});
function renderShop() {
  $("shopCoin").textContent = `내 복전 🪙 ${me.coin.toLocaleString()}`;
  const box = $("shopList"); box.innerHTML = "";
  SHOP.forEach(([ai, price, emo, desc]) => {
    const name = LOOKS.acc[ai][0], own = me.owned.includes(ai), wearing = lookParts(me.look).a === ai;
    const card = document.createElement("div"); card.className = "shop-item";
    card.innerHTML = `<span class="mi-emo">${emo}</span><span class="mi-txt"><b></b><small></small></span>`;
    card.querySelector("b").textContent = name; card.querySelector("small").textContent = desc;
    const btn = document.createElement("button"); btn.type = "button"; btn.className = own ? "ghost-btn mini-btn" : "primary mini-btn";
    btn.textContent = own ? (wearing ? "착용 중" : "착용하기") : `🪙 ${price}`;
    if (ai === 12) { // 염꾸는 먼저 꾸미기 화면으로
      btn.textContent = own ? "꾸미기" : `🪙 ${price} · 만들기`; btn.onclick = () => openYeomku(); card.appendChild(btn); box.appendChild(card); return;
    }
    btn.onclick = () => {
      if (!own) {
        if (me.coin < price) { toast(`복전이 ${price - me.coin}닢 모자라요. 108배를 마치면 108닢을 받아요`); return; }
        me.coin -= price; me.owned.push(ai); sfx.bell(); toast(`🛍️ ${name}을(를) 샀어요!`);
      }
      const p = lookParts(me.look); p.a = ai; me.look = lookStr(p); save();
      if (player) { applyLook(player, me.look); showFront(); lastMoveTx = 0; lastTarget = { x: 1e9, z: 1e9 }; sendPresence(); trackMe(); }
      updateHud(); renderShop(); renderLookPanel("lookBody"); renderActions();
    };
    card.appendChild(btn); box.appendChild(card);
  });
  // 진짜 굿즈
  const real = $("goodsList"); real.innerHTML = "";
  (CONFIG.goods || []).forEach(([emo, name, desc]) => { const d = document.createElement("div"); d.className = "shop-item"; d.innerHTML = `<span class="mi-emo">${emo}</span><span class="mi-txt"><b></b><small></small></span>`; d.querySelector("b").textContent = name; d.querySelector("small").textContent = desc; real.appendChild(d); });
  const link = $("goodsLink");
  if (CONFIG.shopUrl) { link.href = CONFIG.shopUrl; link.textContent = "🛒 진짜 굿즈 보러 가기"; link.classList.remove("disabled"); } else { link.removeAttribute("href"); link.textContent = "진짜 굿즈는 준비 중이에요"; link.classList.add("disabled"); }
  const cp = $("couponBox");
  if (me.bow >= 108 && CONFIG.couponCode) { cp.hidden = false; $("couponCode").textContent = CONFIG.couponCode; } else if (CONFIG.couponCode) { cp.hidden = false; $("couponCode").textContent = `오늘 108배를 마치면 열려요 (${Math.min(me.bow, 108)}/108)`; } else cp.hidden = true;
}

function renderMenu() {
  $("menuCount").textContent = `공양 도감 ${me.ate.length} / ${MENU.length}`;
  const box = $("menuList"); box.innerHTML = "";
  MENU.forEach(([name, emo, , desc], i) => {
    const b = document.createElement("button"); b.type = "button"; b.className = "menu-item" + (me.ate.includes(i) ? " ate" : "");
    b.innerHTML = `<span class="mi-emo">${emo}</span><span class="mi-txt"><b></b><small></small></span>`;
    b.querySelector("b").textContent = name + (me.ate.includes(i) ? " ✓" : ""); b.querySelector("small").textContent = desc;
    b.onclick = () => { $("menuPanel").hidden = true; orderMeal(i); }; box.appendChild(b);
  });
}
function setBowl(i) {
  const [, , color, , tops] = MENU[i]; bowl.visible = true; const food = bowl.userData.food; food.material.color.set(color); food.scale.setScalar(1);
  if (bowl.userData.top) bowl.remove(bowl.userData.top); const tg = new THREE.Group(); bowl.userData.top = tg; bowl.add(tg);
  for (let k = 0; k < 14; k++) { const a = Math.random() * Math.PI * 2, r = Math.random() * .18; const t = new THREE.Mesh(new THREE.SphereGeometry(.035, 6, 5), M(tops[k % tops.length])); t.scale.y = .5; t.position.set(Math.cos(a) * r, .285, Math.sin(a) * r); tg.add(t); }
}
function orderMeal(i) { standUp(); stopAutoBow(); pendingMeal = i; pendingSeat = null; autoPath = null; player.target.set(-21.6, 0, -1.65); say(`${MENU[i][0]}을(를) 받으러 가요.`); }
function startEat(i) {
  setBowl(i); player.yaw = Math.PI; playAnim(player, "eat"); eating = { i, t0: performance.now() };
  bubble(player, `${MENU[i][1]} 잘 먹겠습니다`); act("meal", { what: String(i) });
  say("공양은 먹을 만큼만, 감사한 마음으로 남김없이.");
  player.onEatDone = () => {
    eating = null; bubble(player, "잘 먹었습니다 🙏"); bowl.userData.food.scale.setScalar(.01); if (bowl.userData.top) bowl.userData.top.visible = false;
    if (!me.ate.includes(i)) { me.ate.push(i); me.pts += 10; save(); updateHud(); toast(`📖 공양 도감에 ${MENU[i][0]} 추가! (${me.ate.length}/${MENU.length}, +10 공덕)`); if (me.ate.length === MENU.length) toast("🎉 공양 도감을 모두 채웠어요!"); }
  };
}
function doTea() { tea.visible = true; teaUntil = Date.now() + 60000; act("tea"); say("따뜻한 차 한 모금에 숨을 골라 보세요."); bubble(player, "후―"); }
function doNature() { vol.water = .4; vol.bird = .6; vol.wind = .2; $("vWater").value = 40; $("vBird").value = 60; $("vWind").value = 20; noiseLoop("water"); noiseLoop("wind"); say("물소리와 새소리를 들으며 천천히 걸어 보세요."); }
function greet(toKey) {
  playAnim(player, "greet"); tone(660, .8, .07 * vol.fx); act("greet", { to: toKey || null });
  const o = toKey && others.get(toKey); bubble(player, o ? `${o.nick}님께 합장` : "🙏 합장");
}

/* =========================================================
   패널: 염주 · 소원 · 법당 · 소리
   ========================================================= */
function openPanel(id) { $(id).hidden = false; if (id === "soundPanel") renderStats(); }
document.querySelectorAll("[data-close]").forEach((b) => b.addEventListener("click", () => { b.closest(".panel,.beads-screen").hidden = true; }));
document.querySelectorAll(".panel").forEach((p) => p.addEventListener("click", (e) => { if (e.target === p) p.hidden = true; }));
function renderLookPanel(boxId) {
  const box = $(boxId); if (!box) return; box.innerHTML = "";
  const cur = lookParts(me.look);
  [["face", "표정", "f"], ["skin", "얼굴색", "k"], ["robe", "법복", "r"], ["sash", "가사", "s"], ["acc", "소품", "a"]].forEach(([k, title, key]) => {
    const row = document.createElement("div"); row.className = "look-row";
    const h = document.createElement("small"); h.textContent = title; row.appendChild(h);
    const opts = document.createElement("div"); opts.className = "look-opts";
    (k === "face" ? FACES : k === "skin" ? SKINS : LOOKS[k]).forEach(([name, val], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "look-opt" + (cur[key] === i ? " on" : "");
      if (k !== "acc" && k !== "face") { const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = val; b.appendChild(sw); }
      if (k === "acc" && !ownedAcc(i)) { b.classList.add("locked"); b.append(`🛍️ ${name}`); b.title = "기념품 가게에서 살 수 있어요"; b.onclick = () => toast(`${name}은(는) 기념품 가게에서 🪙${shopPrice(i)}에 살 수 있어요`); opts.appendChild(b); return; }
      const locked = k === "acc" && levelOf(me.pts) < ACC_LEVEL[i];
      b.append(locked ? `🔒 ${name}` : name);
      if (locked) { b.classList.add("locked"); b.title = `${TITLES[ACC_LEVEL[i]][0]}부터 쓸 수 있어요`; b.onclick = () => toast(`${name}은(는) ${TITLES[ACC_LEVEL[i]][0]} 등급부터 쓸 수 있어요`); opts.appendChild(b); return; }
      b.onclick = () => { const p = lookParts(me.look); p[key] = i; if (key === "a" && i === 12 && !p.c) { toast("염꾸는 기념품 가게에서 이니셜을 골라 만들어요"); return; } me.look = lookStr(p); save(); renderActions(); if (player) { showFront(); applyLook(player, me.look); lastMoveTx = 0; lastTarget = { x: 1e9, z: 1e9 }; sendPresence(); trackMe(); } renderLookPanel(boxId); };
      opts.appendChild(b);
    });
    row.appendChild(opts); box.appendChild(row);
  });
}
// 입장 화면에서는 법명만 고르고, 나머지는 안에서 바꿔요
/* ---------- 시처럼 짓는 법명 ---------- */
const NICK_A = ["느린", "맑은", "포근한", "잔잔한", "새벽", "따스한", "조용한", "말랑한", "졸린", "수줍은", "향긋한", "동그란", "반짝", "느긋한"];
const NICK_B = ["연꽃", "구름", "이슬", "풍경", "솔방울", "찻잔", "별빛", "산새", "반딧불", "도토리", "달팽이", "모과", "다람쥐", "보름달"];
const poeticNick = () => { for (;;) { const n = `${NICK_A[Math.floor(Math.random() * NICK_A.length)]} ${NICK_B[Math.floor(Math.random() * NICK_B.length)]}`; if (n.length <= 8) return n; } };
$("nickInput").placeholder = poeticNick();
$("nickDice").onclick = () => { $("nickInput").value = poeticNick(); sfx.bead?.(); };

/* ---------- 촬영 모드: 화면 글자를 숨겨 영상 찍기 좋게 ---------- */
$("recBtn").onclick = () => { document.body.classList.add("rec"); document.querySelectorAll(".panel").forEach((p) => (p.hidden = true)); $("chatPanel").hidden = true; toast("촬영 모드예요. 오른쪽 위 모서리를 두 번 톡톡 누르면 돌아와요"); };
let recTap = 0; $("recExit").onclick = () => { const t = Date.now(); if (t - recTap < 450) document.body.classList.remove("rec"); recTap = t; };
EMOTES.forEach(([e, name], i) => { const b = document.createElement("button"); b.type = "button"; b.className = "emo-opt"; b.innerHTML = `<span>${e}</span><small>${name}</small>`; b.onclick = () => { $("emoBar").hidden = true; emote(player, i, true); }; $("emoBar").appendChild(b); });
$("emoBtn").onclick = () => { $("emoBar").hidden = !$("emoBar").hidden; };
$("hud").onclick = () => { renderMissionPanel(); openPanel("missionPanel"); };
$("chatBtn").onclick = () => { $("chatPanel").hidden = !$("chatPanel").hidden; if (!$("chatPanel").hidden) setTimeout(() => $("chatInput").focus(), 50); };
const QUICK = ["안녕하세요 🙏", "성불하세요", "좋은 밤 되세요 🌙", "같이 108배 해요", "고마워요", "힘내요"];
QUICK.forEach((q) => { const b = document.createElement("button"); b.type = "button"; b.className = "look-opt"; b.textContent = q; b.onclick = () => sendChat(q); $("chatQuick").appendChild(b); });
$("chatSend").onclick = () => { sendChat($("chatInput").value); $("chatInput").value = ""; };
$("chatInput").addEventListener("keydown", (e) => { if (e.key === "Enter" && !e.isComposing) { e.preventDefault(); $("chatSend").click(); } });
$("chatMute").onclick = () => { chatMuted = !chatMuted; $("chatMute").textContent = chatMuted ? "말풍선 켜기" : "말풍선 끄기"; };
$("chatClose").onclick = () => { $("chatPanel").hidden = true; };

/* ---------- 앱으로 설치 (홈 화면에 추가) ---------- */
let installEvt = null;
const isStandalone = () => window.matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
window.addEventListener("beforeinstallprompt", (e) => { e.preventDefault(); installEvt = e; });
if ("serviceWorker" in navigator) window.addEventListener("load", () => navigator.serviceWorker.register("sw.js").catch(() => {}));
if (isStandalone()) $("installBtn").hidden = true;
$("installBtn").onclick = async () => {
  if (installEvt) { installEvt.prompt(); const r = await installEvt.userChoice.catch(() => null); installEvt = null; if (r && r.outcome === "accepted") $("installBtn").hidden = true; return; }
  const ua = navigator.userAgent; const inApp = /Instagram|FBAN|FBAV|KAKAOTALK|NAVER/i.test(ua); const ios = /iPhone|iPad|iPod/i.test(ua);
  $("installHow").innerHTML = "";
  const steps = inApp ? ["오른쪽 위 ⋯ 버튼을 눌러요", ios ? "\"외부 브라우저로 열기\" 또는 Safari로 열기를 눌러요" : "\"다른 브라우저로 열기\"를 눌러요", "열린 화면에서 이 버튼을 한 번 더 눌러 주세요"]
    : ios ? ["Safari 아래쪽 공유 버튼(□↑)을 눌러요", "\"홈 화면에 추가\"를 눌러요", "오른쪽 위 \"추가\"를 누르면 앱처럼 생겨요"]
    : ["브라우저 오른쪽 위 ⋮ 메뉴를 눌러요", "\"홈 화면에 추가\" 또는 \"앱 설치\"를 눌러요"];
  steps.forEach((t) => { const li = document.createElement("li"); li.textContent = t; $("installHow").appendChild(li); });
  openPanel("installPanel");
};
$("lookBtn").onclick = () => { renderLookPanel("lookBody"); $("nickEdit").value = me.nick; openPanel("lookPanel"); };
$("nickSave").onclick = () => {
  const v = $("nickEdit").value.trim().slice(0, 8); if (!v || v === me.nick) return;
  if (BANNED.some((b) => v.includes(b))) { toast("고운 법명으로 지어 주세요"); return; }
  me.nick = v; save(); if (player) { setLabel(player, labelText(v, levelOf(me.pts)), true); bubble(player, `이제 ${v}이에요`); trackMe(); } toast(`법명을 '${v}'(으)로 바꿨어요`);
};
$("nickDice2").onclick = () => { $("nickEdit").value = poeticNick(); sfx.bead?.(); };
$("soundBtn").onclick = () => { ac(); noiseLoop("wind"); noiseLoop("water"); openPanel("soundPanel"); };
function renderStats() { $("stats").innerHTML = ""; [["오늘 목탁", me.mok], ["오늘 108배", me.bow], ["탑돌이", me.tap]].forEach(([k, v]) => { const d = document.createElement("div"); d.innerHTML = `<small>${k}</small><b>${v}</b>`; $("stats").appendChild(d); }); }

const BEADS = 27; let beadOffset = 0;
function drawBeads() {
  const ring = $("beadRing"); ring.innerHTML = "";
  const k = me.ykRing !== false ? ykParse(me.yk) : null; $("beadMine").hidden = !ykParse(me.yk); $("beadMine").textContent = k ? "📿 기본 염주로" : "📿 내 염꾸로";
  ring.classList.toggle("custom", !!k);
  if (k) { // 내가 꾸민 염꾸: 16알을 그대로, 크게
    ykLayout(k).forEach((sl, i) => { const a = ((i + beadOffset) / YK_N) * Math.PI * 2 - Math.PI / 2, b = document.createElement("span");
      if (sl.t === "l") { b.className = "bead yk-letter"; b.textContent = ykShow(sl.ch); }
      else if (sl.t === "z") { b.className = "bead yk-zod" + (k.mode === "h" ? " hanja" : ""); b.textContent = zodLabel(sl.z, k.mode); }
      else { b.className = "bead"; b.style.background = beadBg(sl.c); }
      b.style.left = `${50 + Math.cos(a) * 40}%`; b.style.top = `${50 + Math.sin(a) * 40}%`; ring.appendChild(b); });
  } else for (let i = 0; i < BEADS; i++) {
    const a = ((i + beadOffset) / BEADS) * Math.PI * 2 - Math.PI / 2;
    const b = document.createElement("span"); b.className = "bead" + (i === 0 ? " head" : "");
    b.style.left = `${50 + Math.cos(a) * 40}%`; b.style.top = `${50 + Math.sin(a) * 40}%`; ring.appendChild(b);
  }
  const n = me.bead % 108; $("beadNum").textContent = n === 0 && me.bead > 0 ? 108 : n;
  const round = Math.floor((me.bead - 1) / 108) + 1; $("beadRound").textContent = me.bead === 0 ? "첫 번째 바퀴" : `${["첫", "두", "세", "네", "다섯"][round - 1] || round} 번째 바퀴`;
}
function openBeads() { $("beadPanel").hidden = false; drawBeads(); }
function nextBead() { me.bead++; beadOffset++; gain("bead"); sfx.bead(); drawBeads(); if (navigator.vibrate) navigator.vibrate(8); if (me.bead % 108 === 0) { sfx.soft(); say("염주 한 바퀴, 108번의 마음을 모았어요."); } }
$("beadRing").addEventListener("click", nextBead);
$("beadMine").addEventListener("click", (e) => { e.stopPropagation(); me.ykRing = me.ykRing === false; save(); drawBeads(); });
$("beadRing").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); nextBead(); } });

/* 소원 연등 */
let wishes = [];
let lanternSchemaOld = false; // Supabase 에 kind · lit 칸을 아직 안 만들었으면 true
if (!Array.isArray(me.myWishes)) me.myWishes = []; // 내가 단 연등 [{id, text}]
if (!Array.isArray(me.litWishes)) me.litWishes = []; // 내가 불 밝힌 연등 (id 또는 글)
const wishKey = (w) => (w.id ? "#" + w.id : "t:" + w.text);
function isMyWish(w) {
  if (!w || !Array.isArray(me.myWishes)) return false;
  return me.myWishes.some((m) => (m.id && w.id ? m.id === w.id : m.text === w.text && (!w.nick || w.nick === me.nick)));
}
function applyLocalLit(w) { if (w && (me.litWishes.includes(wishKey(w)) || me.litWishes.includes("t:" + w.text) && isMyWish(w))) w.lit = true; return w; }
function cleanWish(w) { return applyLocalLit({ id: w.id || null, text: String(w.text || "").slice(0, 40), nick: String(w.nick || "").slice(0, 8), kind: KIND_KEYS.includes(w.kind) ? w.kind : null, lit: !!w.lit }); }

// 연등 종류 고르기
let pickedKind = "gold", kindTouched = false;
function renderKindPick() {
  const box = $("kindPick"); box.innerHTML = "";
  for (const k of KIND_KEYS) {
    const d = LANTERN_KINDS[k], b = document.createElement("button");
    b.type = "button"; b.setAttribute("role", "radio"); b.setAttribute("aria-checked", k === pickedKind); b.className = k === pickedKind ? "on" : ""; b.style.setProperty("--kc", d.color);
    b.innerHTML = `<i>${d.emoji}</i>`; b.append(d.name);
    b.onclick = () => { pickedKind = k; kindTouched = true; renderKindPick(); sfx.soft(); };
    box.appendChild(b);
  }
  $("kindDesc").textContent = `${LANTERN_KINDS[pickedKind].emoji} ${LANTERN_KINDS[pickedKind].name}: ${LANTERN_KINDS[pickedKind].desc}`;
}
$("wishInput").addEventListener("input", () => { if (kindTouched) return; const g = guessKind($("wishInput").value); if (g !== pickedKind && $("wishInput").value.trim()) { pickedKind = g; renderKindPick(); } });

// 내 연등 상태 (108배 진행)
function renderMyLantern() {
  const box = $("myLantern"), mine = wishes.filter(isMyWish), off = mine.filter((w) => kindOf(w) && !w.lit);
  if (!mine.length) { box.hidden = true; return; }
  box.hidden = false; box.innerHTML = "";
  const left = document.createElement("div"); left.style.flex = "1";
  if (off.length) {
    const n = Math.min(me.bow, 108);
    left.innerHTML = `<b>🌑 내 연등 ${off.length}개 · 불 꺼짐</b><br><span class="muted">오늘 108배 ${n} / 108</span>`;
    const bar = document.createElement("div"); bar.className = "bar"; bar.innerHTML = `<i style="width:${(n / 108) * 100}%"></i>`; left.appendChild(bar);
    box.appendChild(left);
    const go = document.createElement("button"); go.type = "button"; go.textContent = "🙇 108배 하러 가기";
    go.onclick = () => { $("wishPanel").hidden = true; goPlace("hall"); setTimeout(() => toast("방석에 앉아 '계속 절하기'를 누르면 108배를 올려요"), 400); };
    box.appendChild(go);
  } else {
    left.innerHTML = `<b>✨ 내 연등 ${mine.length}개 모두 불이 켜져 있어요</b>`; box.appendChild(left);
    const go = document.createElement("button"); go.type = "button"; go.textContent = "보러 가기";
    go.onclick = () => { $("wishPanel").hidden = true; goPlace("pagoda"); }; box.appendChild(go);
  }
}
function renderKindStats() {
  const box = $("kindStats"), cnt = {}; box.innerHTML = "";
  wishes.forEach((w) => { const k = kindOf(w); if (k) cnt[k] = (cnt[k] || 0) + 1; });
  const ks = KIND_KEYS.filter((k) => cnt[k]).sort((a, b) => cnt[b] - cnt[a]);
  ks.forEach((k) => { const s = document.createElement("span"); s.textContent = `${LANTERN_KINDS[k].emoji} ${LANTERN_KINDS[k].name} ${cnt[k]}`; box.appendChild(s); });
}
function renderWishList() {
  const ul = $("wishList"); ul.innerHTML = "";
  if (!wishes.length) { const li = document.createElement("li"); li.textContent = "아직 걸린 연등이 없어요. 첫 소원을 달아 보세요."; ul.appendChild(li); }
  wishes.slice(0, 50).forEach((w) => {
    const li = document.createElement("li"), k = kindOf(w);
    if (k) {
      const d = LANTERN_KINDS[k]; li.style.borderLeftColor = d.color;
      const tag = document.createElement("span"); tag.className = "wk"; tag.style.color = d.color; tag.textContent = `${d.emoji} ${d.name}`; li.appendChild(tag);
      if (!w.lit) li.classList.add("off");
    }
    if (isMyWish(w)) li.classList.add("mine");
    li.append(w.text);
    if (w.nick) { const s = document.createElement("small"); s.textContent = w.nick; li.appendChild(s); }
    if (k) { const s = document.createElement("span"); s.className = "lit-tag"; s.textContent = w.lit ? "💡" : "· 불 꺼짐"; li.appendChild(s); }
    ul.appendChild(li);
  });
  renderLanterns(wishes); renderKindStats(); renderMyLantern();
}
function goPlace(z) { const b = document.querySelector(`#places button[data-z="${z}"]`); if (b && player) b.click(); }

// 108배를 마치면 내 연등에 불을 켜요
function lightMyLanterns(fromBow) {
  const off = wishes.filter((w) => isMyWish(w) && kindOf(w) && !w.lit);
  if (!off.length) { if (fromBow) setTimeout(() => toast("🏮 소원 연등을 달면, 다음 108배 때 내 연등에 불이 켜져요", { label: "연등 달기", fn: () => openPanel("wishPanel") }), 600); return false; }
  const now = performance.now();
  off.forEach((w) => { w.lit = true; w.flashAt = now; const key = wishKey(w); if (!me.litWishes.includes(key)) me.litWishes.push(key); });
  me.litWishes = me.litWishes.slice(-80);
  if (!sb) me.localWishes = wishes; // 혼자 수행 모드면 기기에 저장
  save(); renderWishList(); sfx.bell();
  if (sb && !lanternSchemaOld) off.forEach((w) => { if (w.id) sb.rpc("light_wish", { wish_id: w.id }).then(({ error }) => { if (error) lanternSchemaOld = true; }, () => {}); });
  const names = [...new Set(off.map((w) => LANTERN_KINDS[kindOf(w)].name))].join(" · ");
  say(`108배의 공덕으로 ${names}에 불이 밝혀졌어요.`);
  toast(`🏮 내 ${names} ${off.length > 1 ? off.length + "개" : ""}에 불이 켜졌어요!`, zone === "pagoda" || zone === "yard" ? null : { label: "보러 가기", fn: () => goPlace("pagoda") });
  if (navigator.vibrate) navigator.vibrate([30, 60, 30]);
  return true;
}

const BANNED = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "개새", "섹스", "fuck", "닥쳐", "꺼져", "자살", "죽어"];
$("wishBtn").addEventListener("click", async () => {
  const text = $("wishInput").value.trim().slice(0, 40); if (!text) return;
  if (BANNED.some((b) => text.includes(b))) { $("wishNote").textContent = "고운 말로 적어 주세요."; return; }
  $("wishInput").value = ""; sfx.soft();
  const kind = pickedKind, w = { text, nick: me.nick.slice(0, 8), kind };
  const mineRec = { id: null, text }; me.myWishes.unshift(mineRec); me.myWishes = me.myWishes.slice(0, 40); save();
  const kd = LANTERN_KINDS[kind];
  const after = () => {
    gain("wish"); kindTouched = false;
    if (me.bow >= 108) { $("wishNote").textContent = `${kd.name}을 달았어요. 오늘 108배를 이미 마쳐서 바로 불을 밝혀요!`; setTimeout(() => lightMyLanterns(false), 500); }
    else $("wishNote").textContent = `${kd.emoji} ${kd.name}을 달았어요. 대웅전에서 108배를 올리면 불이 켜져요 (오늘 ${me.bow}/108).`;
    renderMyLantern();
  };
  if (sb) {
    let res = lanternSchemaOld ? { error: { message: "kind" } } : await sb.from("wishes").insert(w).select("id").single();
    if (res.error) { // kind · lit 칸이 없는 예전 테이블이면 글만 저장
      lanternSchemaOld = true; res = await sb.from("wishes").insert({ text: w.text, nick: w.nick });
      if (res.error) { me.myWishes.shift(); save(); $("wishNote").textContent = "연등을 걸지 못했어요. 잠시 뒤 다시 시도해 주세요."; return; }
      // 예전 테이블: 색 구분을 내 화면에서라도 보이게
      wishes.unshift(cleanWish({ text: w.text, nick: w.nick, kind })); wishes = wishes.slice(0, 42); renderWishList();
    } else { mineRec.id = res.data?.id || null; save(); const found = wishes.find((x) => !x.id ? false : x.id === mineRec.id); if (!found) { wishes.unshift(cleanWish({ ...w, id: mineRec.id })); wishes = wishes.slice(0, 42); } renderWishList(); }
    after();
  } else { me.localWishes.unshift(cleanWish(w)); me.localWishes = me.localWishes.slice(0, 40); wishes = me.localWishes; save(); renderWishList(); after(); }
});
$("wishInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("wishBtn").click(); });
renderKindPick();

/* 기와 불사 */
let giwas = [], giwaOnline = false;
if (!Array.isArray(me.localGiwa)) me.localGiwa = [];
function openGiwa() { renderGiwaList(); openPanel("giwaPanel"); setTimeout(() => $("giwaInput").focus(), 50); }
function renderGiwaList() {
  const ul = $("giwaList"); ul.innerHTML = "";
  if (!giwas.length) { const li = document.createElement("li"); li.textContent = "아직 올라간 기와가 없어요. 첫 기와에 소원을 적어 보세요."; ul.appendChild(li); }
  giwas.slice(0, 40).forEach((g) => { const li = document.createElement("li"); li.style.borderLeftColor = "#6b7280"; li.textContent = "🏯 " + g.text; if (g.nick) { const s = document.createElement("small"); s.textContent = g.nick; li.appendChild(s); } ul.appendChild(li); });
  renderGiwa(giwas);
}
$("giwaInput").addEventListener("input", () => { $("giwaPreviewText").textContent = $("giwaInput").value.trim() || "소원을 적어 주세요"; });
$("giwaBtn").addEventListener("click", async () => {
  const text = $("giwaInput").value.trim().slice(0, 20); if (!text) return;
  if (BANNED.some((b) => text.includes(b))) { $("giwaNote").textContent = "고운 말로 적어 주세요."; return; }
  $("giwaInput").value = ""; $("giwaPreviewText").textContent = "소원을 적어 주세요"; sfx.soft();
  const g = { text, nick: me.nick.slice(0, 8) };
  if (sb && giwaOnline) {
    const { data, error } = await sb.from("giwa").insert(g).select("id").single();
    if (error) { $("giwaNote").textContent = "기와를 올리지 못했어요. 잠시 뒤 다시 시도해 주세요."; return; }
    if (!giwas.some((x) => x.id === data?.id)) giwas.unshift({ ...g, id: data?.id, flashAt: performance.now() });
  } else { const lg = { ...g, flashAt: performance.now() }; me.localGiwa.unshift({ text: g.text, nick: g.nick }); me.localGiwa = me.localGiwa.slice(0, 30); save(); giwas.unshift(lg); }
  giwas = giwas.slice(0, 40); renderGiwaList(); act("giwa");
  $("giwaNote").textContent = "기와를 올렸어요. 법당 앞 너럭바위 기와 단에서 볼 수 있어요.";
  setTimeout(() => toast("🏯 기와에 소원을 적어 올렸어요", zone === "yard" ? null : { label: "보러 가기", fn: () => { $("giwaPanel").hidden = true; goGiwa(); } }), 300);
});
$("prayToggle").addEventListener("click", () => { ac(); togglePray(); });
$("giwaInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("giwaBtn").click(); });
function goGiwa() { if (!player) return; standUp(); pendingSeat = null; autoPath = null; player.pos.set(GIWA.x, 0, GIWA.z + 2.2); player.target.copy(player.pos); camYaw = 0; lastMoveTx = 0; sendPresence(); }
async function loadGiwa() {
  if (!sb) { giwas = me.localGiwa.slice(); renderGiwaList(); return; }
  const { data, error } = await sb.from("giwa").select("id,text,nick,created_at").order("created_at", { ascending: false }).limit(40);
  if (error) { giwaOnline = false; giwas = me.localGiwa.slice(); $("giwaNote").textContent = "지금은 기와가 이 기기에만 저장돼요."; renderGiwaList(); return; }
  giwaOnline = true; giwas = (data || []).map((g) => ({ id: g.id, text: String(g.text || "").slice(0, 20), nick: String(g.nick || "").slice(0, 8) })); renderGiwaList();
  sb.channel("sansa-giwa").on("postgres_changes", { event: "INSERT", schema: "public", table: "giwa" }, ({ new: g }) => {
    if (giwas.some((x) => x.id === g.id)) return;
    giwas.unshift({ id: g.id, text: String(g.text || "").slice(0, 20), nick: String(g.nick || "").slice(0, 8), flashAt: performance.now() }); giwas = giwas.slice(0, 40); renderGiwaList();
  }).subscribe();
}

/* =========================================================
   실시간 (Supabase)
   ========================================================= */
let sb = null, lobby = null, roomCh = null, roomNo = 1, roomJoinedAt = 0;
const others = new Map(); // key -> {monk, nick, seenAt}
const roomCounts = {};
const ACT = { emo: "", sit: "방석에 앉았어요", stand: "일어났어요", mok: "목탁을 쳤어요", greet: "합장했어요", bow: "절을 올렸어요", incense: "향을 피웠어요", candle: "초를 밝혔어요", pray: "기도를 올렸어요", tap: "탑을 한 바퀴 돌았어요", meal: "공양을 해요", tea: "차를 마셔요", bell: "범종을 울렸어요", climb: "달빛봉 정상에 올랐어요", yaho: "야호를 외쳤어요", rice: "공양미를 올렸어요", giwa: "기와에 소원을 적었어요" };
const online = () => !!sb;

/* 신호 아끼기: 접속 명단(presence)은 들어올 때와 30초마다 한 번만,
   걷기는 목적지가 바뀔 때만, 동작은 그때그때 짧은 메시지(broadcast)로 보내요. */
let lastMoveTx = 0, lastTarget = { x: 1e9, z: 1e9 }, presence = {};
const posPayload = () => { const P = inRoom && roomReturn ? roomReturn : player.pos, T = inRoom && roomReturn ? roomReturn : player.target;
  return { k: myKey, l: me.look, lv: levelOf(me.pts), s: player.sitting && !inRoom ? 1 : 0, x: +P.x.toFixed(2), z: +P.z.toFixed(2), tx: +T.x.toFixed(2), tz: +T.z.toFixed(2) }; };
function trackMe() { if (roomCh && player) roomCh.track({ nick: me.nick.slice(0, 8), ...posPayload(), at: Date.now() }).catch(() => {}); }
setInterval(trackMe, 30000);
setInterval(() => {
  const now = Date.now(); let n = [...others.values()].filter((o) => now - (o.lastBow || 0) < 4500 && zoneOf(o.monk.pos.x, o.monk.pos.z) === "hall").length;
  if (player && player.anim === "bow" || autoBow) n++;
  const el = $("groupBanner"); if (!el) return;
  if (zone !== "hall") { el.hidden = true; return; }
  if (n >= 2) { el.textContent = `🙇 지금 ${n}명이 함께 절하고 있어요`; el.hidden = false; } else el.hidden = true;
}, 1000);
function sendPresence(patch = {}) {
  if (!roomCh || !player) return;
  if (patch.act) { roomCh.send({ type: "broadcast", event: "act", payload: { k: myKey, nick: me.nick.slice(0, 8), act: patch.act, to: patch.to || null, what: patch.what || null, ...posPayload() } }).catch(() => {}); return; }
  const now = Date.now(), t = player.target;
  if (Math.hypot(t.x - lastTarget.x, t.z - lastTarget.z) < .4 || now - lastMoveTx < 450) return;
  lastMoveTx = now; lastTarget = { x: t.x, z: t.z };
  roomCh.send({ type: "broadcast", event: "move", payload: posPayload() }).catch(() => {});
}
function ensureOther(key, p) {
  let o = others.get(key);
  const nick = String(p.nick || o?.nick || "스님").slice(0, 8);
  if (!o) { o = { monk: makeMonk(nick, false), nick }; o.monk.pos.set(clamp(+p.x || 0, -44, 44), 0, clamp(+p.z || 0, -40, 46)); o.monk.target.copy(o.monk.pos); others.set(key, o); }
  if (p.nick) o.nick = nick;
  setLabel(o.monk, labelText(o.nick, Number.isFinite(+p.lv) ? +p.lv : (o.lv ?? 0)), false); if (Number.isFinite(+p.lv)) { o.lv = clamp(+p.lv | 0, 0, 5); applyAura(o.monk, o.lv); }
  if (looksOk(p.l)) applyLook(o.monk, p.l);
  if (p.s !== undefined) { o.monk.sitting = !!p.s; if (o.monk.sitting) o.monk.yaw = Math.PI; }
  return o;
}
function applyMove(o, p) {
  const x = clamp(+p.x || 0, -44, 44), z = clamp(+p.z || 0, -40, 46);
  if (Math.hypot(o.monk.pos.x - x, o.monk.pos.z - z) > 6) o.monk.pos.set(x, 0, z);
  o.monk.target.set(clamp(+p.tx || x, -44, 44), 0, clamp(+p.tz || z, -40, 46));
}
function onRoomSync() {
  const state = roomCh.presenceState(); const keys = new Set();
  for (const [key, metas] of Object.entries(state)) {
    if (key === myKey) continue; const p = metas[metas.length - 1]; if (!p) continue; keys.add(key);
    const isNew = !others.has(key); const o = ensureOther(key, p); if (isNew) applyMove(o, p);
  }
  for (const [key, o] of others) if (!keys.has(key)) { scene.remove(o.monk.root); others.delete(key); }
  if (!$("roomPanel").hidden) renderRooms();
}
/* ---------- 대화 ---------- */
let chatMuted = false, lastChatAt = 0; const chatLog = [];
const cleanChat = (t) => String(t || "").replace(/[\u0000-\u001f]/g, "").slice(0, 40).trim();
function addChat(nick, text, mine) {
  chatLog.push({ nick, text, mine }); if (chatLog.length > 30) chatLog.shift();
  const ul = $("chatLog"); if (!ul) return; ul.innerHTML = "";
  chatLog.forEach((c) => { const li = document.createElement("li"); li.className = c.mine ? "mine" : ""; const b = document.createElement("b"); b.textContent = c.nick; li.appendChild(b); li.append(" " + c.text); ul.appendChild(li); });
  ul.scrollTop = ul.scrollHeight;
}
function sendChat(text) {
  text = cleanChat(text); if (!text || !player) return;
  if (BANNED.some((b) => text.includes(b))) { toast("고운 말로 이야기해 주세요"); return; }
  const now = Date.now(); if (now - lastChatAt < 2000) { toast("조금 천천히 이야기해요"); return; } lastChatAt = now;
  bubble(player, text); addChat(me.nick, text, true); gain("chat");
  if (roomCh) roomCh.send({ type: "broadcast", event: "chat", payload: { k: myKey, nick: me.nick.slice(0, 8), text } }).catch(() => {});
}
function onChat({ payload: p }) {
  if (!p || typeof p.k !== "string" || p.k === myKey) return;
  const text = cleanChat(p.text); if (!text || BANNED.some((b) => text.includes(b))) return;
  const o = others.get(p.k); const nick = String(p.nick || o?.nick || "스님").slice(0, 8);
  addChat(nick, text, false);
  if (chatMuted) return;
  if (o) bubble(o.monk, text);
  if ($("chatPanel").hidden) toast(`💬 ${nick}: ${text}`);
}

function onAct({ payload: p }) {
  if (!p || typeof p.k !== "string" || p.k === myKey || !ACT[p.act]) return;
  const key = p.k, o = ensureOther(key, p); applyMove(o, p); const nick = o.nick;
  if (p.act === "bow") { playAnim(o.monk, "bow"); o.lastBow = Date.now(); }
  if (p.act === "sit") { o.monk.sitting = true; o.monk.yaw = Math.PI; }
  if (p.act === "stand") o.monk.sitting = false;
  if (p.act === "greet") { playAnim(o.monk, "greet"); bubble(o.monk, "🙏"); }
  if (p.act === "pray") playAnim(o.monk, "pray");
  if (p.act === "yaho") bubble(o.monk, "야호~!");
  if (p.act === "climb") { playAnim(o.monk, "greet"); bubble(o.monk, "정상 도착!"); }
  if (p.act === "emo") emote(o.monk, +p.what, false);
  if (p.act === "meal") { const mi = MENU[+p.what]; if (mi) { o.monk.yaw = Math.PI; playAnim(o.monk, "eat"); bubble(o.monk, `${mi[1]} ${mi[0]}`); } }
  if (p.act === "incense") incenseUntil = Math.max(incenseUntil, Date.now() + 60000);
  if (p.act === "candle") candleUntil = Math.max(candleUntil, Date.now() + 90000);
  if (p.act === "rice") { addRiceBag(true); o.monk.yaw = Math.PI; playAnim(o.monk, "pray"); }
  const near = player && o.monk.pos.distanceTo(player.pos) < 14;
  if (p.act === "greet" && p.to === myKey) toast(`${nick}님이 나에게 합장했어요 🙏`, { label: "맞합장", fn: () => greet(key) });
  else if (near && p.act === "greet") toast(`${nick}님이 합장했어요`, { label: "맞합장", fn: () => greet(key) });
  else if (near && !["bow", "mok", "sit", "stand", "emo"].includes(p.act)) toast(`${nick}님이 ${ACT[p.act]}`);
}

async function joinRoom(n) {
  if (roomCh) { await sb.removeChannel(roomCh); roomCh = null; }
  for (const [, o] of others) scene.remove(o.monk.root); others.clear();
  roomNo = n; roomJoinedAt = Date.now(); $("roomLabel").textContent = CONFIG.roomCount > 1 ? `${CONFIG.roomName} ${n}` : CONFIG.roomName;
  roomCh = sb.channel(`sansa-room-${n}`, { config: { presence: { key: myKey }, broadcast: { self: false } } });
  roomCh.on("presence", { event: "sync" }, onRoomSync)
    .on("presence", { event: "join" }, ({ key, newPresences }) => { if (Date.now() - roomJoinedAt > 3000 && key !== myKey && !others.has(key)) { const nm = String(newPresences?.[0]?.nick || "스님").slice(0, 8); toast(`${nm}님이 들어왔어요`); } })
    .on("broadcast", { event: "move" }, ({ payload: p }) => { if (!p || typeof p.k !== "string" || p.k === myKey) return; applyMove(ensureOther(p.k, p), p); })
    .on("broadcast", { event: "act" }, onAct)
    .on("broadcast", { event: "chat" }, onChat);
  roomCh.subscribe((s) => { if (s === "SUBSCRIBED") { trackMe(); lobby && lobby.track({ room: n }).catch(() => {}); } });
}

function countRooms() { if (!lobby) return; const st = lobby.presenceState(); for (let i = 1; i <= CONFIG.roomCount; i++) roomCounts[i] = 0; for (const metas of Object.values(st)) { const r = metas[metas.length - 1]?.room; if (roomCounts[r] !== undefined) roomCounts[r]++; } }
function pickRoom() { countRooms(); for (let i = 1; i <= CONFIG.roomCount; i++) if ((roomCounts[i] || 0) < CONFIG.roomCap) return i; return CONFIG.roomCount; }

/* ---------- 방문 기록: 몇 명이 왔고 얼마나 머물렀는지 (법명 말고는 저장하지 않아요) ---------- */
const visit = { id: null, acts: {}, bow0: 0, timer: 0, off: false };
const uuid = () => (crypto.randomUUID ? crypto.randomUUID() : "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const r = Math.random() * 16 | 0; return (c === "x" ? r : (r & 3) | 8).toString(16); }));
function visitRef() { try { const u = new URL(location.href).searchParams.get("utm_source"); if (u) return u.slice(0, 40); const r = document.referrer ? new URL(document.referrer).hostname.replace(/^www\./, "") : ""; if (/instagram/i.test(navigator.userAgent)) return "instagram"; return r.slice(0, 40); } catch { return ""; } }
async function visitStart() {
  if (!sb || visit.off) return;
  visit.id = uuid(); visit.bow0 = me.bow; visit.acts = {};
  const { error } = await sb.rpc("visit_start", { p_id: visit.id, p_visitor: myKey, p_nick: me.nick.slice(0, 8), p_ref: visitRef(), p_mobile: /Mobi|Android|iPhone/i.test(navigator.userAgent) });
  if (error) { visit.off = true; visit.id = null; return; } // 표를 아직 안 만들었으면 조용히 쉬어요
  clearInterval(visit.timer); visit.timer = setInterval(visitPing, 20000);
}
async function visitPing() {
  if (!sb || !visit.id || document.hidden) return;
  const { data, error } = await sb.rpc("visit_ping", { p_id: visit.id, p_bows: Math.max(0, me.bow - visit.bow0), p_acts: visit.acts });
  if (!error && data === false) visitStart(); // 오래 자리를 비웠다 돌아오면 새 방문으로 세요
}
document.addEventListener("visibilitychange", () => { if (!document.hidden) visitPing(); });
function visitAct(name) { const k = name.split(":")[0]; if (!visit.id || !/^[a-z]+$/.test(k)) return; visit.acts[k] = (visit.acts[k] || 0) + 1; }

async function connect() {
  if (!CONFIG.supabaseUrl || !CONFIG.supabaseAnonKey) { solo(); return; }
  try {
    const { createClient } = await import("@supabase/supabase-js");
    sb = createClient(CONFIG.supabaseUrl, CONFIG.supabaseAnonKey, { realtime: { params: { eventsPerSecond: 5 } } });
  } catch { solo(); return; }
  lobby = sb.channel("sansa-lobby", { config: { presence: { key: myKey } } });
  let started = false;
  const start = () => { if (started) return; started = true; joinRoom(pickRoom()); };
  lobby.on("presence", { event: "sync" }, () => { countRooms(); if (!$("roomPanel").hidden) renderRooms(); start(); });
  lobby.subscribe((s) => { if (s === "SUBSCRIBED") setTimeout(start, 1200); if (s === "CHANNEL_ERROR" || s === "TIMED_OUT") { if (!started) solo("연결이 불안정해 혼자 수행 모드로 열었어요."); } });
  loadGiwa(); visitStart();
  // 소원 연등
  let res = await sb.from("wishes").select("id,text,nick,kind,lit,created_at").order("created_at", { ascending: false }).limit(42);
  if (res.error) { lanternSchemaOld = true; res = await sb.from("wishes").select("text,nick,created_at").order("created_at", { ascending: false }).limit(42); }
  wishes = (res.data || []).map(cleanWish); renderWishList();
  sb.channel("sansa-wishes").on("postgres_changes", { event: "INSERT", schema: "public", table: "wishes" }, ({ new: w }) => {
    const nw = cleanWish(w);
    if (nw.id && wishes.some((x) => x.id === nw.id)) return; // 내가 방금 단 연등은 이미 들어가 있어요
    const pending = wishes.findIndex((x) => !x.id && x.text === nw.text && x.nick === nw.nick);
    if (pending >= 0) { const old = wishes[pending]; nw.kind = nw.kind || old.kind; nw.lit = nw.lit || old.lit; wishes[pending] = nw; } else wishes.unshift(nw);
    wishes = wishes.slice(0, 42); renderWishList();
    if (w.nick !== me.nick) { const kd = LANTERN_KINDS[nw.kind]; toast(`${kd ? kd.emoji + " 새 " + kd.name : "🏮 새 연등"}: ${nw.text.slice(0, 20)}`); }
  }).on("postgres_changes", { event: "UPDATE", schema: "public", table: "wishes" }, ({ new: w }) => {
    const x = wishes.find((v) => v.id && v.id === w.id); if (!x || x.lit || !w.lit) return;
    x.lit = true; x.flashAt = performance.now(); renderWishList();
    if (!isMyWish(x) && kindOf(x)) toast(`✨ ${x.nick || "누군가"}님이 108배를 마치고 ${LANTERN_KINDS[x.kind].name}을 밝혔어요`);
  }).subscribe();
}
function solo(msg) {
  sb = null; giwaOnline = false; giwas = me.localGiwa.slice(); renderGiwaList(); $("roomLabel").textContent = "혼자 수행 중";
  $("wishNote").textContent = "지금은 연등이 이 기기에만 저장돼요.";
  wishes = me.localWishes; renderWishList(); if (msg) toast(msg);
}
function renderRooms() {
  const list = $("roomList"); list.innerHTML = ""; countRooms();
  if (CONFIG.roomCount <= 1) { // 법당이 하나면: 지금 함께 있는 사람 수와 법명을 보여줘요
    const names = [me.nick || "나", ...[...others.values()].map((o) => o.nick || "스님")];
    $("roomTitle").textContent = CONFIG.roomName; $("roomNote").textContent = "지금 달빛암에 함께 있는 사람이에요. 숫자는 실제 접속자 수예요.";
    const head = document.createElement("div"); head.className = "room-now"; head.innerHTML = `<b>${names.length}</b><span>명이 함께 수행하고 있어요</span>`; list.appendChild(head);
    const ul = document.createElement("ul"); ul.className = "room-names";
    names.slice(0, 60).forEach((n, i) => { const li = document.createElement("li"); li.textContent = i === 0 ? `${n} (나)` : n; ul.appendChild(li); });
    if (names.length > 60) { const li = document.createElement("li"); li.textContent = `외 ${names.length - 60}명`; ul.appendChild(li); }
    list.appendChild(ul); return;
  }
  for (let i = 1; i <= CONFIG.roomCount; i++) {
    const n = roomCounts[i] || 0, full = n >= CONFIG.roomCap;
    const b = document.createElement("button"); b.type = "button"; b.className = i === roomNo ? "cur" : ""; b.disabled = full && i !== roomNo;
    b.innerHTML = `<b>${CONFIG.roomName} ${i}</b><small>${n} / ${CONFIG.roomCap}명${full ? " · 만석" : ""}</small>`;
    b.onclick = () => { $("roomPanel").hidden = true; if (i !== roomNo) joinRoom(i); }; list.appendChild(b);
  }
}
$("roomBtn").onclick = () => { if (!online()) { toast("설정 파일에 Supabase 주소를 넣으면 다른 사람과 함께할 수 있어요."); return; } renderRooms(); openPanel("roomPanel"); };

/* =========================================================
   알림
   ========================================================= */
function toast(text, btn) {
  const t = document.createElement("div"); t.className = "toast" + (btn ? "" : " solo");
  const s = document.createElement("span"); s.textContent = text; t.appendChild(s);
  if (btn) { const b = document.createElement("button"); b.type = "button"; b.textContent = btn.label; b.onclick = () => { ac(); btn.fn(); t.remove(); }; t.appendChild(b); }
  const box = $("toasts"); box.appendChild(t); while (box.children.length > 3) box.firstChild.remove(); setTimeout(() => t.remove(), 5100);
}

/* =========================================================
   입장
   ========================================================= */
$("enterBtn").addEventListener("click", enter);
$("nickInput").addEventListener("keydown", (e) => { if (e.key === "Enter") enter(); });
function enter() {
  const nick = $("nickInput").value.trim().slice(0, 8) || $("nickInput").placeholder.replace(/^예: /, "").slice(0, 8);
  me.nick = nick; save();
  $("gate").hidden = true; unlockAudio(); ac(); preloadRecs(); noiseLoop("wind"); noiseLoop("water");
  // 입장 버튼을 누른 순간에 소리 파일을 깨워 둬야 아이폰에서도 나중에 재생돼요
  if (soundUrl.nature) natureRec = loopAudio("nature", .6 * Math.max(vol.wind, vol.water, .3));
  else findSound("nature").then((u) => { if (u) natureRec = loopAudio("nature", .6 * Math.max(vol.wind, vol.water, .3)); });
  if (soundUrl.chant && !loopEls.chant) { const el = new Audio(soundUrl.chant); el.loop = true; el.setAttribute("playsinline", ""); el.muted = true; loopEls.chant = el; el.play().then(() => { el.pause(); el.muted = false; }).catch(() => { el.muted = false; }); }
  { const lp = lookParts(me.look); if (levelOf(me.pts) < ACC_LEVEL[lp.a]) { lp.a = 0; me.look = lookStr(lp); save(); } }
  player = makeMonk(nick, true); applyLook(player, me.look); setLabel(player, labelText(nick, levelOf(me.pts)), true); applyAura(player, levelOf(me.pts)); updateHud(); player.pos.set(SPAWN.x + rand(-3, 3), 0, SPAWN.z + rand(-1, 1.5)); player.target.copy(player.pos); player.yaw = Math.PI;
  zone = zoneOf(player.pos.x, player.pos.z); renderActions(); say(ZONES[zone].intro);
  connect();
}

/* =========================================================
   카메라 충돌
   ========================================================= */
let camMeshes = null; const camRay = new THREE.Raycaster(); const _cd = new THREE.Vector3();
function pullCamera(target, cw) {
  if (!camMeshes) { camMeshes = []; camSolidGroups.forEach((g) => g.traverse((o) => { if (!o.isMesh || o.isSprite) return; const gp = o.geometry.parameters || {}; if (o.geometry.type === "CylinderGeometry" && gp.radiusTop < .3) return; if (o.parent?.userData.noCam || o.material === pungHitM) return; camMeshes.push(o); })); }
  _cd.subVectors(cw, target); const len = _cd.length(); if (len < .5) return;
  camRay.set(target, _cd.divideScalar(len)); camRay.far = len; camRay.near = .2;
  const hit = camRay.intersectObjects(camMeshes, false)[0];
  if (hit) cw.copy(target).addScaledVector(_cd, Math.max(1.2, hit.distance - .35));
}

/* =========================================================
   매 프레임
   ========================================================= */
function resize() { const w = window.innerWidth, h = window.innerHeight; renderer.setSize(w, h, false); camera.aspect = w / h; camera.updateProjectionMatrix(); }
window.addEventListener("resize", resize); resize();
const clock = new THREE.Clock(); const camTarget = new THREE.Vector3(); let lastMoveSent = 0;
function moveMonk(m, dt, speed = 3.2) {
  const dx = m.target.x - m.pos.x, dz = m.target.z - m.pos.z, d = Math.hypot(dx, dz);
  if (d > .05) {
    const s = Math.min(d, speed * dt), nx = m.pos.x + (dx / d) * s, nz = m.pos.z + (dz / d) * s;
    if (m === player && blocked(nx, nz)) { m.target.copy(m.pos); m.moving = false; return false; }
    m.pos.x = nx; m.pos.z = nz; m.yaw = Math.atan2(dx, dz); m.moving = true; return true;
  }
  m.moving = false; return false;
}
function tick() {
  const dt = Math.min(clock.getDelta(), .05), now = performance.now(), t = now / 1000;
  if (player) {
    if (autoPath) {
      const p = autoPath.pts[autoPath.i]; player.target.set(p.x, 0, p.z);
      if (Math.hypot(p.x - player.pos.x, p.z - player.pos.z) < .3) { autoPath.i++; if (autoPath.i >= autoPath.pts.length) { const a = autoPath; autoPath = null; a.done(); } }
    }
    const moved = moveMonk(player, dt, autoPath ? (autoPath.climb ? 2.8 : 2) : 3.4);
    if (pendingMeal !== null && !moved && Math.hypot(player.pos.x + 21.6, player.pos.z + 1.65) < .35) { const i = pendingMeal; pendingMeal = null; startEat(i); }
    if (eating) { const k = Math.min(1, (performance.now() - eating.t0) / 6000); bowl.userData.food.scale.setScalar(Math.max(.05, 1 - k * .9)); if (bowl.userData.top) bowl.userData.top.scale.setScalar(1 - k * .9); }
    if (pendingSeat && !moved && Math.hypot(player.pos.x - pendingSeat.x, player.pos.z - pendingSeat.z) < .3) { pendingSeat = null; sitDown(); }
    if (moved && now - lastMoveSent > 250) { lastMoveSent = now; sendPresence(); }
    animateMonk(player, dt, now);
    const z = inRoom ? "room" : zoneOf(player.pos.x, player.pos.z);
    if (z !== zone) { const prev = zone; if (prev === "peak" && z !== "peak") { if (pray && pray.timer) stopPray(); pray = null; dipper.active = false; dipper.full = false; $("prayBox").hidden = true; applyTimeOfDay(); } zone = z; renderActions(); say(ZONES[zone].intro); gain(`visit:${z}`); if (z === "peak") reachPeak(); if (z === "hall") enterHallView(prev); }
    // 대웅전 안에서는 동자승 뒤쪽 위에서 부처님을 함께 바라보는 구도로 바꿔요
    if (inRoom) { // 개인 법당: 동자승 뒤에서 탱화와 불단을 바라봐요
      const yaw = clamp(camYaw, -.5, .5), cp = clamp(camPitch, .1, .6);
      const cw = new THREE.Vector3(RO.x + Math.sin(yaw) * 2, 2.25 + cp * .6, RO.z + 3.15 - Math.abs(Math.sin(yaw)) * .4);
      camTarget.lerp(new THREE.Vector3(RO.x, 1.45, RO.z - 2.6), Math.min(1, dt * 4)); camera.position.lerp(cw, Math.min(1, dt * 4));
    } else if (zone === "peak" && dipper.active) {
      const top = mh(player.pos.x, player.pos.z), cw = new THREE.Vector3(player.pos.x + 1.2, top + 2.4, player.pos.z + 4.2);
      camTarget.lerp(dipper.g.position.clone().add(new THREE.Vector3(0, 4.5, 0)), Math.min(1, dt * 1.5)); camera.position.lerp(cw, Math.min(1, dt * 2));
    } else if (zone === "hall") {
      // 대웅전: 끌어서 사방을 둘러보고, 두 손가락으로 확대 · 축소. 카메라는 법당 벽과 천장 안쪽에만 머물러요
      // 동자승 바로 뒤 눈높이에서 바라보는 방향으로 법당을 둘러봐요
      const fx = -Math.sin(camYaw), fz = -Math.cos(camYaw), cp = clamp(camPitch, .12, 1.0);
      const cd = 2.6 + (clamp(camDist, 3, 12) - 3) * .4;
      const cw = new THREE.Vector3(player.pos.x - fx * cd, 2.3 + cp * 2.4, player.pos.z - fz * cd);
      cw.x = clamp(cw.x, HB.x1 + .7, HB.x2 - .7); cw.z = clamp(cw.z, HB.z1 + .7, HB.z2 + 1.6); cw.y = clamp(cw.y, 1.3, HALL.h + .1);
      camTarget.lerp(new THREE.Vector3(player.pos.x + fx * 7, 2.6 - (cp - .36) * 3.5, player.pos.z + fz * 7), Math.min(1, dt * 6));
      camera.position.lerp(cw, Math.min(1, dt * 6));
    } else {
      camTarget.lerp(new THREE.Vector3(player.pos.x, 1.6 + (player.y || 0), player.pos.z), Math.min(1, dt * 5));
      const front = performance.now() < frontUntil, cy = front ? player.root.rotation.y : camYaw, cd = front ? 4.2 : camDist, cp = front ? .22 : camPitch;
      const cw = new THREE.Vector3(camTarget.x + Math.sin(cy) * Math.cos(cp) * cd, camTarget.y + Math.sin(cp) * cd, camTarget.z + Math.cos(cy) * Math.cos(cp) * cd);
      cw.y = Math.max(cw.y, mh(cw.x, cw.z) + 1);
      pullCamera(camTarget, cw);
      if (front || camera.userData.lerp) { camera.position.lerp(cw, Math.min(1, dt * 5)); camera.userData.lerp = front || camera.position.distanceTo(cw) > .05; } else camera.position.copy(cw);
    }
    camera.lookAt(camTarget);
    // 카메라와 동자승 사이를 가리는 나무는 잠시 숨겨요
    { const ax = camera.position.x, az = camera.position.z, bx = player.pos.x, bz = player.pos.z, vx = bx - ax, vz = bz - az, L = vx * vx + vz * vz || 1;
      for (const t of camHide) { const px = t.position.x, pz = t.position.z, k = clamp(((px - ax) * vx + (pz - az) * vz) / L, 0, 1), dx = ax + vx * k - px, dz = az + vz * k - pz, r = 2.3 * t.scale.x; t.visible = dx * dx + dz * dz > r * r; } }
    if (hallG.userData.sign) hallG.userData.sign.visible = zone !== "hall";
    mountMesh.userData.far.visible = zone !== "peak" && zone !== "mountain";
    player.label.visible = zone !== "hall" && !inRoom && camera.position.distanceTo(player.root.position) > 2.6;
    const fovWant = zone === "hall" ? 70 : inRoom ? 58 : 55;
    if (Math.abs(camera.fov - fovWant) > .1) { camera.fov += (fovWant - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  } else {
    camera.position.set(Math.sin(t * .05) * 22, 9, Math.cos(t * .05) * 22 - 4); camera.lookAt(0, 2, -8);
  }
  for (const [, o] of others) { moveMonk(o.monk, dt, 3.6); animateMonk(o.monk, dt, now); }
  if (!inRoom) updateNpcs(dt, now); updateDipper(dt, now, t);
  // 효과
  const inc = Date.now() < incenseUntil; incense.visible = inc;
  if (inc) smoke.forEach((s) => { s.userData.t = (s.userData.t + dt * .3) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 9) * .1, .6 + k * 1.6, 0); s.scale.setScalar(.6 + k * 1.8); s.material.opacity = Math.sin(k * Math.PI) * .35; });
  candles.forEach((f, i) => { f.scale.x = 1 + Math.sin(t * 13 + i) * .12; });
  if (inRoom) { roomCandles.forEach((f, i) => { f.scale.x = 1 + Math.sin(t * 11 + i * 2) * .14; }); roomLight.intensity = 8.5 + Math.sin(t * 7) * .8; roomStars.rotation.y = t * .01; }
  hallLight.intensity = 16 + Math.sin(t * 7) * 1.5;
  const cdl = Date.now() < candleUntil; shrineFlame.visible = cdl; shrineLight.intensity = cdl ? 5 + Math.sin(t * 9) : 0;
  const glow = (sevenStars.userData.glowUntil || 0) > Date.now(); sevenStars.children.forEach((s, i) => s.scale.setScalar(glow ? 1.6 + Math.sin(t * 4 + i) * .4 : 1));
  const tv = Date.now() < teaUntil; tea.visible = tv;
  if (tv) steam.forEach((s) => { s.userData.t = (s.userData.t + dt * .4) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 7) * .05, .25 + k * .6, 0); s.material.opacity = Math.sin(k * Math.PI) * .4; });
  const popAnim = (o) => { const pa = o.userData.popAt; if (!pa) return; const k = (now - pa) / 900; if (k >= 1) { o.scale.setScalar(1); o.userData.popAt = 0; return; } o.scale.setScalar(.2 + .8 * Math.min(1, k * 1.6) + Math.sin(k * Math.PI) * .25); };
  riceGroup.children.forEach(popAnim); giwaTiles.children.forEach(popAnim);
  for (const p of pungs) { const u = p.userData, e = now - (u.t0 || 0), k = u.amp ? Math.exp(-e / 1400) : 0; if (k < .01) u.amp = 0; const a = u.amp * k;
    p.rotation.z = Math.sin(t * 1.3 + u.ph) * .05 + (a ? a * Math.sin(e / 140) : 0); p.rotation.x = Math.sin(t * .9 + u.ph) * .03 + (a ? a * .4 * Math.cos(e / 170) : 0);
    u.fish.rotation.y = Math.sin(t * 1.1 + u.ph) * .6 + (a ? a * 2 * Math.sin(e / 120) : 0); }
  rockingStone.rotation.z = Math.sin(t * .9) * .025; rockingStone.rotation.x = Math.sin(t * .63) * .012;
  lanternGroup.children.forEach((l, i) => {
    l.rotation.z = Math.sin(t * .8 + i) * .06;
    const w = l.userData.wish, fa = w && w.flashAt;
    if (fa && now - fa < 4000) { const p = (now - fa) / 4000; const s = 1 + Math.sin(p * Math.PI * 6) * .25 * (1 - p); l.scale.set(s, 1.2 * s, s); if (l.userData.halo) l.userData.halo.scale.setScalar(1.6 + (1 - p) * 2.4); }
    else if (l.userData.halo) l.userData.halo.material.opacity = (kindOf(w) === "gold" ? .7 : .45) + Math.sin(t * 2 + i) * .08;
  });
  stream.material.color.setHSL(.55, .4, .27 + Math.sin(t * 2) * .02);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
/* ---------- 실제 시간에 맞춘 낮 · 노을 · 밤 ---------- */
function applyTimeOfDay() {
  const h = new Date().getHours() + new Date().getMinutes() / 60;
  const phase = h >= 6.5 && h < 17 ? "day" : (h >= 17 && h < 19) || (h >= 5 && h < 6.5) ? "dusk" : "night";
  const P = {
    day: { bg: "#a9c6dc", sky: "#cfe3f1", ground: "#6b5a44", hemi: 1.25, sun: "#fff1d6", sunI: 1.4, moon: false, stars: 0 },
    dusk: { bg: "#d99a7a", sky: "#f2c38f", ground: "#4a3a30", hemi: 1.0, sun: "#ffb27a", sunI: 1.0, moon: true, stars: .3 },
    night: { bg: "#18202c", sky: "#8fa6c8", ground: "#2a2018", hemi: .9, sun: "#dfe6ff", sunI: .9, moon: true, stars: 1 }
  }[phase];
  scene.background.set(P.bg); scene.fog.color.set(P.bg);
  hemi.color.set(P.sky); hemi.groundColor.set(P.ground); hemi.intensity = P.hemi;
  moon.color.set(P.sun); moon.intensity = P.sunI;
  moonBall.visible = P.moon; if (starField) { starField.visible = P.stars > 0; starField.material.opacity = P.stars; }
  document.body.dataset.time = phase;
}
applyTimeOfDay(); setInterval(applyTimeOfDay, 60000);

buildNpcs(); initDipper();
renderLanterns(me.localWishes);
for (let i = 0; i < Math.min(me.rice || 0, RICE_SPOTS.length); i++) addRiceBag(false);
renderGiwa(me.localGiwa);
requestAnimationFrame(tick);
say("법명을 정하고 산사에 들어가 보세요.");
