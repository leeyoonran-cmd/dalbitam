import * as THREE from "three";
import { CONFIG } from "./config.js";

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
const me = Object.assign({ day: today, look: "0-0-0", pts: 0, daily: null, nick: "", mok: 0, bow: 0, tap: 0, bead: 0, pray: 0, localWishes: [] }, store.get("sansa3d", {}));
if (me.day !== today) { me.day = today; me.mok = 0; me.bow = 0; }
const save = () => store.set("sansa3d", me);
const myKey = store.get("sansa3d-key", null) || (() => { const k = "m" + Math.random().toString(36).slice(2, 10); store.set("sansa3d-key", k); return k; })();

$("siteTitle").textContent = CONFIG.siteName;
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
let ctx, master, noiseBuf;
const vol = { wind: .3, water: .2, bird: .3, chime: .25, fx: .8 };
function ac() {
  if (!ctx) {
    ctx = new (window.AudioContext || window.webkitAudioContext)();
    master = ctx.createGain(); master.gain.value = 1; master.connect(ctx.destination);
    const n = ctx.sampleRate * 2; noiseBuf = ctx.createBuffer(1, n, ctx.sampleRate);
    const d = noiseBuf.getChannelData(0); for (let i = 0; i < n; i++) d[i] = Math.random() * 2 - 1;
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
function preloadRecs() { ["moktak", "bell", "chant", "nature"].forEach(loadRec); }

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
    const s = c.createBufferSource(); s.buffer = noiseBuf; s.loop = true;
    const f = c.createBiquadFilter(), g = c.createGain(); g.gain.value = 0;
    if (kind === "wind") { f.type = "lowpass"; f.frequency.value = 380; const l = c.createOscillator(), lg = c.createGain(); l.frequency.value = .12; lg.gain.value = 220; l.connect(lg).connect(f.frequency); l.start(); }
    else { f.type = "bandpass"; f.frequency.value = 1100; f.Q.value = .6; }
    s.connect(f).connect(g).connect(master); s.start(); loops[kind] = g;
  }
  loops[kind].gain.setTargetAtTime(vol[kind] * (kind === "wind" ? .45 : .2), c.currentTime, .4);
}
[["vWind", "wind"], ["vWater", "water"], ["vBird", "bird"], ["vChime", "chime"], ["vFx", "fx"]].forEach(([id, k]) => {
  $(id).addEventListener("input", (e) => { vol[k] = e.target.value / 100; if (ctx && (k === "wind" || k === "water")) { noiseLoop(k); if (natureRec) natureRec.g.gain.setTargetAtTime(.6 * Math.max(vol.wind, vol.water), ctx.currentTime, .3); } });
});
setInterval(() => {
  if (!ctx || !player) return;
  const nearWalk = zoneOf(player.pos.x, player.pos.z) === "walk";
  if (vol.bird && Math.random() < .3 * vol.bird + (nearWalk ? .25 : .05)) { sfx.bird(); setTimeout(sfx.bird, 170); }
  if (vol.chime && Math.random() < .2 * vol.chime + .05) sfx.chime();
}, 1500);

let chantTimer = null, chantRec = null, natureRec = null;
function stopChant() {
  if (chantTimer) { clearInterval(chantTimer); chantTimer = null; }
  if (chantRec) { const { s: src, g } = chantRec; g.gain.setTargetAtTime(0, ctx.currentTime, .4); setTimeout(() => { try { src.stop(); } catch {} }, 1500); chantRec = null; }
  $("chantBtn").textContent = "염불"; $("chantBtn").classList.remove("on");
}
$("chantBtn").addEventListener("click", async () => {
  ac();
  if (chantTimer || chantRec) { stopChant(); return; }
  $("chantBtn").textContent = "염불 끄기"; $("chantBtn").classList.add("on");
  await loadRec("chant");
  if (!$("chantBtn").classList.contains("on")) return;
  if (rec.chant) { chantRec = playRec("chant", .9 * vol.fx, true); return; }
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

scene.add(new THREE.HemisphereLight("#8fa6c8", "#2a2018", .9));
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
const box = (w, h, d, m, x, y, z, parent = scene) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m); o.position.set(x, y, z); parent.add(o); return o; };
const cyl = (rt, rb, h, m, x, y, z, seg = 12, parent = scene) => { const o = new THREE.Mesh(new THREE.CylinderGeometry(rt, rb, h, seg), m); o.position.set(x, y, z); parent.add(o); return o; };

/* 땅과 산 */
const ground = new THREE.Mesh(new THREE.PlaneGeometry(200, 200), mat.ground); ground.rotation.x = -Math.PI / 2; scene.add(ground);
for (let i = 0; i < 14; i++) {
  const a = (i / 14) * Math.PI * 2, r = rand(55, 70);
  const m = new THREE.Mesh(new THREE.ConeGeometry(rand(14, 24), rand(14, 26), 6), M(i % 2 ? "#1d2633" : "#222d3a"));
  m.position.set(Math.cos(a) * r, 5, Math.sin(a) * r); scene.add(m);
}
const moonBall = new THREE.Mesh(new THREE.SphereGeometry(3, 24, 16), new THREE.MeshBasicMaterial({ color: "#efe6cc" }));
moonBall.position.set(-40, 38, -60); scene.add(moonBall);
// 별
{ const g = new THREE.BufferGeometry(), p = [];
  for (let i = 0; i < 500; i++) { const a = rand(0, Math.PI * 2), e = rand(.15, 1.3), r = 90; p.push(Math.cos(a) * Math.cos(e) * r, Math.sin(e) * r, Math.sin(a) * Math.cos(e) * r); }
  g.setAttribute("position", new THREE.Float32BufferAttribute(p, 3));
  scene.add(new THREE.Points(g, new THREE.PointsMaterial({ color: "#fff4d6", size: .35, fog: false }))); }

/* 길 */
for (let z = -11; z < 40; z += 1.3) box(2.2, .06, 1, mat.darkStone, Math.sin(z * .15) * (z > 10 ? 1.5 : 0), .03, z);
box(30, .04, 22, M("#5a5044"), 0, .02, 0); // 마당 흙

/* 장애물(충돌) 목록 */
const blockers = []; // {x1,x2,z1,z2}
const block = (x1, x2, z1, z2) => blockers.push({ x1, x2, z1, z2 });

/* 전각 만들기 */
function hall({ w, d, h, x, z, open = false, sign = "" }) {
  const g = new THREE.Group(); g.position.set(x, 0, z); scene.add(g);
  box(w + 1, .5, d + 1, mat.stone, 0, .25, 0, g); // 기단
  box(w, .05, d, mat.floor, 0, .52, 0, g);
  const cols = Math.max(3, Math.round(w / 3.2));
  for (let i = 0; i <= cols; i++) { const px = -w / 2 + (w / cols) * i; cyl(.22, .26, h, mat.pillar, px, .5 + h / 2, d / 2 - .2, 10, g); cyl(.22, .26, h, mat.pillar, px, .5 + h / 2, -d / 2 + .2, 10, g); }
  box(w, h, .2, mat.mural, 0, .5 + h / 2, -d / 2 + .1, g); // 뒷벽
  box(.2, h, d, mat.wall, -w / 2 + .1, .5 + h / 2, 0, g); box(.2, h, d, mat.wall, w / 2 - .1, .5 + h / 2, 0, g);
  if (!open) { box(w, h * .75, .15, mat.wall, 0, .5 + h * .375 + h * .25, d / 2 - .2, g); }
  box(w + .4, .35, d + .4, mat.green, 0, .5 + h + .1, 0, g); // 단청 띠
  const roof = new THREE.Mesh(new THREE.ConeGeometry(1, 1, 4, 1, true), mat.roofTile);
  roof.rotation.y = Math.PI / 4; roof.scale.set((w + 4) * .72, h * .75, (d + 4) * .72); roof.position.y = .5 + h + .25 + h * .37; g.add(roof);
  roof.material.side = THREE.DoubleSide;
  if (sign) { const s = textSprite(sign, { size: 46, color: "#d9b44a", bg: "#2a1612", pad: 18 }); s.position.set(0, .5 + h - .2, d / 2 + .05); s.scale.multiplyScalar(.9); g.add(s); }
  return g;
}

/* 대웅전 (안에 들어갈 수 있음) */
const HALL = { x: 0, z: -19, w: 16, d: 10, h: 4.2 };
const hallG = hall({ ...HALL, open: true, sign: "大雄殿" });
block(-8.6, 8.6, -24.6, -23.6); block(-8.6, -7.6, -24.6, -14); block(7.6, 8.6, -24.6, -14);
// 불상
{ const g = new THREE.Group(); g.position.set(0, .55, -22.4); g.scale.setScalar(.8); scene.add(g);
  box(5, 1, 1.6, mat.wood, 0, .5, 0, g);
  cyl(1.3, 1.5, .5, mat.gold, 0, 1.25, 0, 16, g);
  // 가부좌한 다리, 몸, 어깨, 머리를 따로 만들어 앉은 모습이 보이게
  const legs = new THREE.Mesh(new THREE.SphereGeometry(1, 24, 12), mat.gold); legs.scale.set(1.75, .42, 1); legs.position.y = 1.75; g.add(legs);
  const body = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 16), mat.gold); body.scale.set(.95, 1.05, .7); body.position.y = 2.55; g.add(body);
  const shoulders = new THREE.Mesh(new THREE.SphereGeometry(1, 20, 12), mat.gold); shoulders.scale.set(1.15, .4, .7); shoulders.position.y = 3.25; g.add(shoulders);
  const hands = new THREE.Mesh(new THREE.SphereGeometry(.3, 12, 8), mat.gold); hands.scale.set(1.4, .6, 1); hands.position.set(0, 2.0, .62); g.add(hands);
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(.22, .26, .3, 12), mat.gold); neck.position.y = 3.62; g.add(neck);
  const head = new THREE.Mesh(new THREE.SphereGeometry(.5, 24, 18), mat.gold); head.scale.set(1, 1.12, 1); head.position.y = 4.15; g.add(head);
  [-1, 1].forEach((sd) => { const ear = new THREE.Mesh(new THREE.CapsuleGeometry(.08, .35, 4, 8), mat.gold); ear.position.set(sd * .5, 4.0, 0); g.add(ear); });
  const top = new THREE.Mesh(new THREE.SphereGeometry(.24, 12, 8), mat.gold); top.position.y = 4.72; g.add(top);
  const halo = new THREE.Mesh(new THREE.TorusGeometry(.95, .07, 8, 40), mat.gold); halo.position.set(0, 4.2, -.5); g.add(halo);
  const halo2 = new THREE.Mesh(new THREE.TorusGeometry(2.4, .05, 8, 50), mat.gold); halo2.position.set(0, 2.9, -.55); g.add(halo2);
  block(-2.6, 2.6, -23.4, -21.5);
}
// 촛대 + 향로
const candles = [];
[-3.3, 3.3].forEach((x) => { cyl(.12, .12, .7, mat.candle, x, 1.4, -21.9); const f = new THREE.Mesh(new THREE.SphereGeometry(.09, 8, 6), mat.flame); f.scale.y = 1.8; f.position.set(x, 1.85, -21.9); scene.add(f); candles.push(f); });
const hallLight = new THREE.PointLight("#ffb466", 18, 16, 1.6); hallLight.position.set(0, 3, -20); scene.add(hallLight);
cyl(.35, .25, .35, mat.gold, 0, 1.2, -21.2, 12);
const incense = new THREE.Group(); incense.position.set(0, 1.4, -21.2); scene.add(incense);
cyl(.02, .02, .6, M("#8a5a3a"), 0, .3, 0, 6, incense); incense.visible = false;
const smoke = [];
for (let i = 0; i < 10; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.12, 8, 6), new THREE.MeshBasicMaterial({ color: "#dddddd", transparent: true, opacity: 0 })); s.userData.t = i / 10; incense.add(s); smoke.push(s); }
let incenseUntil = 0;
// 방석
const hallSeats = [];
for (let r = 0; r < 3; r++) for (let c = -3; c <= 3; c++) { const x = c * 1.9, z = -19.2 + r * 1.8; box(1.1, .12, 1.1, mat.cushion, x, .6, z); hallSeats.push({ x, z }); }

/* 석탑 (마당 가운데) */
const PAGODA = { x: 0, z: 0 };
{ let y = 0; [[3, .6], [2.3, 1.2], [2.9, .3], [1.8, 1], [2.4, .25], [1.4, .9], [1.9, .22], [1, .7], [1.4, .2]].forEach(([s, h], i) => { box(s, h, s, i % 2 ? mat.stone : mat.darkStone, 0, y + h / 2, 0); y += h; });
  cyl(.12, .12, 1.4, mat.darkStone, 0, y + .7, 0); block(-1.7, 1.7, -1.7, 1.7); }
const pagodaLamp = new THREE.PointLight("#ffcf8a", 6, 12, 2); pagodaLamp.position.set(0, 1, 5); scene.add(pagodaLamp);

/* 산신각 · 칠성각 (동쪽) */
const SHRINE = { x: 15, z: -7, w: 6, d: 5, h: 3 };
hall({ ...SHRINE, sign: "山神閣" }); block(11.5, 18.5, -10, -4.2);
const shrineCandle = cyl(.1, .1, .5, mat.candle, 15, .8, -4.1); const shrineFlame = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), mat.flame);
shrineFlame.position.set(15, 1.12, -4.1); shrineFlame.scale.y = 1.8; scene.add(shrineFlame); shrineFlame.visible = false;
const shrineLight = new THREE.PointLight("#ffb466", 0, 8, 2); shrineLight.position.set(15, 1.6, -3.6); scene.add(shrineLight);
let candleUntil = 0;
// 칠성 (북두칠성) 별빛
const sevenStars = new THREE.Group(); scene.add(sevenStars);
[[0, 0], [2, .4], [4, .5], [6, 0], [7, -1.6], [9.4, -1.3], [9.8, .6]].forEach(([x, y]) => { const s = new THREE.Mesh(new THREE.SphereGeometry(.25, 8, 6), new THREE.MeshBasicMaterial({ color: "#fff3c8", fog: false })); s.position.set(20 + x, 22 + y, -40); sevenStars.add(s); });

/* 공양간 (서쪽) */
const KITCHEN = { x: -15, z: -7, w: 7, d: 5, h: 3 };
hall({ ...KITCHEN, sign: "供養間" }); block(-19, -11, -10, -4.2);
box(4, .15, 1.2, mat.wood, -15, .8, -2.8); [[-16.8, -3.2], [-13.2, -3.2], [-16.8, -2.4], [-13.2, -2.4]].forEach(([x, z]) => box(.12, .8, .12, mat.wood, x, .4, z));
block(-17.1, -12.9, -3.5, -2.1);
const bowl = new THREE.Group(); bowl.position.set(-15.6, .9, -2.8); scene.add(bowl); bowl.visible = false;
{ const b = new THREE.Mesh(new THREE.SphereGeometry(.28, 16, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2), M("#7a5a40")); b.rotation.x = Math.PI; b.position.y = .28; bowl.add(b);
  const food = new THREE.Mesh(new THREE.CircleGeometry(.26, 16), M("#c98a3a")); food.rotation.x = -Math.PI / 2; food.position.y = .27; bowl.add(food); bowl.userData.food = food; }
const tea = new THREE.Group(); tea.position.set(-14.3, .9, -2.8); scene.add(tea); tea.visible = false;
cyl(.15, .11, .2, M("#e8e2d4"), 0, .1, 0, 12, tea);
const steam = []; for (let i = 0; i < 6; i++) { const s = new THREE.Mesh(new THREE.SphereGeometry(.06, 6, 4), new THREE.MeshBasicMaterial({ color: "#eee", transparent: true, opacity: 0 })); s.userData.t = i / 6; tea.add(s); steam.push(s); }
let teaUntil = 0;
const kitchenLight = new THREE.PointLight("#ffb466", 6, 9, 2); kitchenLight.position.set(-15, 2.2, -3); scene.add(kitchenLight);

/* 카메라 바로 앞을 가리는 나무는 잠깐 숨겨요 */
const camHide = [];

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
{ const g = new THREE.Group(); g.position.set(-9, 0, 7); scene.add(g);
  [[-1.3, -1.3], [1.3, -1.3], [-1.3, 1.3], [1.3, 1.3]].forEach(([x, z]) => cyl(.15, .18, 3.2, mat.pillar, x, 1.6, z, 8, g));
  const r = new THREE.Mesh(new THREE.ConeGeometry(2.6, 1.4, 4), mat.roofTile); r.rotation.y = Math.PI / 4; r.position.y = 3.9; g.add(r);
  const bell = new THREE.Mesh(new THREE.CylinderGeometry(.55, .8, 1.5, 16), M("#5a5a4a", { metalness: .7, roughness: .4 })); bell.position.y = 2.2; g.add(bell);
  block(-10.6, -7.4, 5.4, 8.6); }

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
function renderLanterns(list) {
  lanternGroup.clear();
  list.slice(0, lanternSlots.length).forEach((w, i) => {
    const color = lanternColors[i % lanternColors.length];
    const m = new THREE.Mesh(new THREE.SphereGeometry(.32, 12, 10), new THREE.MeshStandardMaterial({ color, emissive: color, emissiveIntensity: .9 }));
    m.scale.y = 1.2; m.position.copy(lanternSlots[i]); m.userData.wish = w; lanternGroup.add(m);
    const tassel = new THREE.Mesh(new THREE.CylinderGeometry(.02, .02, .3, 4), new THREE.MeshBasicMaterial({ color })); tassel.position.y = -.5; m.add(tassel);
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
const PTS = { mok: 1, bow: 3, incense: 3, bell: 2, tap: 10, pray: 3, candle: 3, meal: 3, tea: 2, greet: 2, wish: 5, bead: 1, chat: 1, visit: 0 };
const MISSION_POOL = [
  ["mok", 30, "목탁 30번 치기"], ["bow", 30, "절 30번 올리기"], ["tap", 1, "탑돌이 한 바퀴"], ["greet", 3, "합장 인사 3번"],
  ["incense", 1, "향 피우기"], ["tea", 1, "공양간에서 차 마시기"], ["wish", 1, "소원 연등 달기"], ["visit:walk", 1, "산책길 걷기"],
  ["chat", 1, "누군가에게 말 걸기"], ["bead", 108, "염주 한 바퀴 돌리기"], ["pray", 1, "산신각에서 기도하기"], ["bell", 3, "범종 3번 치기"]
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
  const key = kind; me.daily.c[key] = (me.daily.c[key] || 0) + n;
  me.pts += (PTS[kind.split(":")[0]] ?? 0) * n;
  MISSIONS.forEach(([k, goal, title]) => {
    if (k === key && !me.daily.done.includes(k) && me.daily.c[k] >= goal) {
      me.daily.done.push(k); me.pts += 30; toast(`✅ 오늘의 수행 완료: ${title} (+30 공덕)`); sfx.soft();
      if (me.daily.done.length === MISSIONS.length) setTimeout(() => { toast("🌕 오늘의 수행을 모두 마쳤어요! (+50 공덕)"); me.pts += 50; save(); updateHud(); }, 1200);
    }
  });
  const lv = levelOf(me.pts);
  if (lv > lastLevel) {
    lastLevel = lv; toast(`🎉 ${TITLES[lv][0]}(으)로 올라갔어요!`); sfx.bell();
    if (player) { setLabel(player, labelText(me.nick, lv), true); bubble(player, `${TITLES[lv][0]} 승급!`); trackMe(); }
    renderLookPanel("lookBody");
  }
  save(); updateHud();
}
function updateHud() {
  const lv = levelOf(me.pts), next = TITLES[lv + 1];
  $("hudTitle").textContent = TITLES[lv][0];
  $("hudPts").textContent = me.pts.toLocaleString();
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
  acc: [["없음", ""], ["염주", "beads"], ["털모자", "beanie"], ["삿갓", "hat"], ["연꽃", "lotus"]]
};
const ACC_LEVEL = [0, 0, 1, 2, 3]; // 소품을 쓰려면 필요한 등급 (털모자: 행자, 삿갓: 수행자, 연꽃: 스님)
const looksOk = (l) => typeof l === "string" && /^[0-9]-[0-9]-[0-9]$/.test(l);
function lookParts(l) { const [r, s, a] = (looksOk(l) ? l : "0-0-0").split("-").map(Number); return { r: LOOKS.robe[r] ? r : 0, s: LOOKS.sash[s] ? s : 0, a: LOOKS.acc[a] ? a : 0 }; }
function applyLook(m, l) {
  if (!m || m.look === l) return; m.look = l;
  const p = lookParts(l);
  m.robeMat.color.set(LOOKS.robe[p.r][1]); m.sashMat.color.set(LOOKS.sash[p.s][1]);
  if (m.acc) { m.head.remove(m.acc); m.body.remove(m.acc); m.acc = null; }
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
  }
  m.acc = g;
}

function makeMonk(nick, isMe) {
  const root = new THREE.Group(); const body = new THREE.Group(); root.add(body);
  const robeM = mat.robe.clone(), sashM = mat.sash.clone();
  // 몸통: 동글동글한 승복
  const torso = new THREE.Mesh(new THREE.SphereGeometry(.42, 24, 18), robeM); torso.scale.set(1, 1.08, .92); torso.position.y = .62; body.add(torso);
  const hem = new THREE.Mesh(new THREE.CylinderGeometry(.38, .44, .22, 20), robeM); hem.position.y = .34; body.add(hem);
  // 가사: 몸에 감기는 대각선 띠
  const sash = new THREE.Mesh(new THREE.TorusGeometry(.415, .075, 8, 32), sashM);
  sash.position.y = .64; sash.scale.set(1, 1.08, .94); sash.rotation.set(0, Math.PI / 2, .8); body.add(sash);
  // 다리와 신발
  [-.15, .15].forEach((x) => {
    const leg = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .14, 4, 8), robeM); leg.position.set(x, .2, 0); body.add(leg);
    const shoe = new THREE.Mesh(new THREE.SphereGeometry(.11, 10, 8), M("#efe8d8")); shoe.scale.set(1, .6, 1.4); shoe.position.set(x, .05, .05); body.add(shoe);
  });
  // 팔 (어깨를 축으로 움직여요)
  const arm = (side) => {
    const g = new THREE.Group(); g.position.set(side * .36, .86, 0); body.add(g);
    const sleeve = new THREE.Mesh(new THREE.CapsuleGeometry(.1, .2, 4, 8), robeM); sleeve.position.y = -.16; g.add(sleeve);
    const hand = new THREE.Mesh(new THREE.SphereGeometry(.085, 10, 8), mat.skin); hand.position.y = -.34; g.add(hand);
    g.rotation.z = side * .3; return g;
  };
  const armL = arm(-1), armR = arm(1);
  // 큰 머리
  const head = new THREE.Group(); head.position.y = 1.42; body.add(head);
  const skull = new THREE.Mesh(new THREE.SphereGeometry(.5, 28, 20), mat.skin); skull.scale.set(1, .96, .96); head.add(skull);
  [-.16, .16].forEach((x) => {
    const e = new THREE.Mesh(new THREE.TorusGeometry(.06, .016, 6, 12, Math.PI), mat.eye); e.position.set(x, .02, .465); head.add(e);
    const ch = new THREE.Mesh(new THREE.CircleGeometry(.065, 14), new THREE.MeshBasicMaterial({ color: "#e0866a", transparent: true, opacity: .55 })); ch.position.set(x * 1.45, -.1, .462); ch.rotation.y = x * .9; head.add(ch);
    const ear = new THREE.Mesh(new THREE.SphereGeometry(.08, 8, 6), mat.skin); ear.scale.set(.6, 1, 1); ear.position.set(x * 3.1, -.02, 0); head.add(ear);
  });
  const mouth = new THREE.Mesh(new THREE.TorusGeometry(.05, .013, 6, 12, Math.PI), mat.eye); mouth.rotation.z = Math.PI; mouth.position.set(0, -.14, .47); head.add(mouth);
  const label = textSprite(nick || "스님", { size: 30, color: isMe ? "#f2a65a" : "#ece6d8", pad: 10 }); label.scale.multiplyScalar(.6); label.position.y = 2.25; root.add(label);
  scene.add(root);
  return { root, body, head, armL, armR, label, nick, robeMat: robeM, sashMat: sashM, acc: null, look: null, pos: new THREE.Vector3(), target: new THREE.Vector3(), yaw: 0, anim: null, animT: 0, moving: false, bubble: null, bubbleUntil: 0 };
}
function setLabel(m, nick, isMe) { if (m.nick === nick) return; m.root.remove(m.label); m.label.material.map.dispose(); m.label = textSprite(nick || "스님", { size: 30, color: isMe ? "#f2a65a" : "#ece6d8", pad: 10 }); m.label.scale.multiplyScalar(.6); m.label.position.y = 2.25; m.root.add(m.label); m.nick = nick; }
function bubble(m, text) { if (m.bubble) { m.root.remove(m.bubble); m.bubble.material.map.dispose(); } m.bubble = textSprite(text, { size: 30, color: "#2a1a0c", bg: "rgba(243,238,227,.95)", pad: 10 }); m.bubble.scale.multiplyScalar(.65); m.bubble.position.y = 2.65; m.root.add(m.bubble); m.bubbleUntil = performance.now() + 2200; }
function playAnim(m, name) { m.anim = name; m.animT = 0; }
function animateMonk(m, dt, now) {
  // 걷기
  const step = m.moving ? Math.abs(Math.sin(now * .012)) * .06 : 0;
  m.body.position.y = step;
  const fy = floorY(m.pos.x, m.pos.z); m.y = (m.y ?? fy) + (fy - (m.y ?? fy)) * Math.min(1, dt * 12);
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
  m.body.rotation.x = bowX;
  m.body.position.z = Math.sin(bowX) * .25;
  const sw = m.moving && !m.anim ? Math.sin(now * .012) * .5 : 0;
  m.armL.rotation.set(-1.25 * handsUp + sw, 0, -.3 + handsUp * .95);
  m.armR.rotation.set(-1.25 * handsUp - sw, 0, .3 - handsUp * .95);
  if (m.bubble && now > m.bubbleUntil) { m.root.remove(m.bubble); m.bubble.material.map.dispose(); m.bubble = null; }
}

/* =========================================================
   나 (플레이어)
   ========================================================= */
let player;
const SPAWN = new THREE.Vector3(0, 0, 9);
function blocked(x, z) {
  if (Math.abs(x) > 40 || z < -26 || z > 46) return true;
  for (const b of blockers) if (x > b.x1 - .3 && x < b.x2 + .3 && z > b.z1 - .3 && z < b.z2 + .3) return true;
  return false;
}
function floorY(x, z) { return (x > -8.5 && x < 8.5 && z > -24.5 && z < -13.5) ? .55 : 0; }
function zoneOf(x, z) {
  if (z < -13.5 && Math.abs(x) < 9) return "hall";
  if (x > 10.5 && z < -1) return "shrine";
  if (x < -10.5 && z < -1) return "kitchen";
  if (z > 11) return "walk";
  if (Math.hypot(x - PAGODA.x, z - PAGODA.z) < 6) return "pagoda";
  return "yard";
}
const ZONES = {
  yard: { name: "마당", intro: "마당에 들어왔어요. 가고 싶은 곳을 눌러 걸어가 보세요." },
  hall: { name: "대웅전", intro: "부처님 앞이에요. 목탁을 치고 절을 올려 보세요." },
  pagoda: { name: "석탑", intro: "석탑을 천천히 돌며 소원을 떠올려 보세요." },
  shrine: { name: "산신각·칠성각", intro: "산신께는 산의 기운을, 칠성께는 별의 기운을 빌어요." },
  kitchen: { name: "공양간", intro: "오늘의 공양을 골라 보세요. 차도 한 잔 있어요." },
  walk: { name: "산책길", intro: "물소리 들리는 숲길이에요. 천천히 걸어 보세요." }
};
const GOTO = { hall: [0, -17.6], pagoda: [0, 3.2], shrine: [15, -2.6], kitchen: [-15, -1.2], walk: [0, 16], yard: [0, 8] };

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
  if (pointers.size === 2) { const [a, b] = [...pointers.values()]; const d = Math.hypot(a.x - b.x, a.y - b.y); camDist = clamp(distStart * pinchStart / Math.max(d, 1), 3, 16); return; }
  if (downAt) downAt.moved += Math.abs(dx) + Math.abs(dy);
  camYaw -= dx * .006; camPitch = clamp(camPitch + dy * .004, .12, 1.2);
});
const endPointer = (e) => {
  pointers.delete(e.pointerId);
  if (downAt && downAt.moved < 10 && performance.now() - downAt.t < 450) tap(e.clientX, e.clientY);
  downAt = null;
};
canvas.addEventListener("pointerup", endPointer); canvas.addEventListener("pointercancel", (e) => { pointers.delete(e.pointerId); downAt = null; });
canvas.addEventListener("wheel", (e) => { e.preventDefault(); camDist = clamp(camDist + e.deltaY * .01, 3, 16); }, { passive: false });
window.addEventListener("keydown", (e) => {
  if (!player || e.target.tagName === "INPUT") return;
  const k = e.key.toLowerCase(), f = 2.5;
  const fw = new THREE.Vector3(-Math.sin(camYaw), 0, -Math.cos(camYaw)), rt = new THREE.Vector3(Math.cos(camYaw), 0, -Math.sin(camYaw));
  let v = null;
  if (k === "w" || k === "arrowup") v = fw; if (k === "s" || k === "arrowdown") v = fw.clone().negate();
  if (k === "a" || k === "arrowleft") v = rt.clone().negate(); if (k === "d" || k === "arrowright") v = rt;
  if (v) { player.target.copy(player.pos).addScaledVector(v, f); autoPath = null; }
});
function tap(cx, cy) {
  const r = canvas.getBoundingClientRect(); ndc.set(((cx - r.left) / r.width) * 2 - 1, -((cy - r.top) / r.height) * 2 + 1);
  raycaster.setFromCamera(ndc, camera);
  const hitL = raycaster.intersectObjects(lanternGroup.children, false)[0];
  if (hitL) { const w = hitL.object.userData.wish; toast(`🏮 ${w.text}${w.nick ? " · " + w.nick : ""}`); return; }
  const hitM = raycaster.intersectObjects([...others.values()].map((o) => o.monk.root), true)[0];
  if (hitM) { for (const [key, o] of others) { let n = hitM.object; while (n && n !== o.monk.root) n = n.parent; if (n) { greet(key); return; } } }
  const hit = raycaster.intersectObject(ground)[0];
  if (hit) { player.target.set(hit.point.x, 0, hit.point.z); autoPath = null; }
}

/* =========================================================
   행동 버튼
   ========================================================= */
let autoPath = null; // [{x,z}] 자동 걷기 (탑돌이 등)
let zone = "yard";
const MEALS = [["비빔밥", "#c98a3a"], ["산채나물", "#6f8f4a"], ["연근조림", "#8a5a3a"], ["두부조림", "#e8dcc0"]];
let mealIdx = 0;
const A = (icon, label, fn, hot) => ({ icon, label, fn, hot });
function actionsFor(z) {
  const greetA = A("🙏", "합장", () => greet(null)), beadA = A("📿", "염주", openBeads), wishA = A("🏮", "소원 연등", () => openPanel("wishPanel"));
  if (z === "hall") return [A("🪵", "목탁", doMok, true), A("🙇", "절하기", doBow, true), A("🕯️", "향 피우기", doIncense), greetA, beadA];
  if (z === "pagoda") return [A("🗼", "탑돌이", doTapdori, true), wishA, greetA, beadA];
  if (z === "shrine") return [A("⛰️", "산신 기도", () => doPray("산신"), true), A("✨", "칠성 기도", () => doPray("칠성"), true), A("🕯️", "초 켜기", doCandle), greetA];
  if (z === "kitchen") return [A("🍚", "공양하기", doMeal, true), A("🍵", "차 마시기", doTea, true), greetA, beadA];
  if (z === "walk") return [A("🌊", "계곡 소리", doNature, true), greetA, beadA, wishA];
  return [A("🔔", "범종 치기", doBell), greetA, wishA, beadA];
}
function renderActions() {
  const box = $("actions"); box.innerHTML = "";
  for (const a of actionsFor(zone)) { const b = document.createElement("button"); b.type = "button"; b.className = "act" + (a.hot ? " hot" : ""); b.innerHTML = `<i>${a.icon}</i>`; b.append(a.label); b.onclick = () => { ac(); a.fn(); }; box.appendChild(b); }
  $("placeTag").textContent = ZONES[zone].name;
  document.querySelectorAll("#places button").forEach((b) => b.classList.toggle("here", b.dataset.z === zone));
}
const placeNames = { hall: "대웅전", pagoda: "석탑", shrine: "산신각", kitchen: "공양간", walk: "산책길" };
for (const [z, n] of Object.entries(placeNames)) {
  const b = document.createElement("button"); b.type = "button"; b.dataset.z = z; b.textContent = n;
  b.onclick = () => { const [x, zz] = GOTO[z]; player.pos.set(x, 0, zz); player.target.set(x, 0, zz); autoPath = null; camYaw = z === "walk" ? Math.PI : 0; lastMoveTx = 0; sendPresence(); };
  $("places").appendChild(b);
}

function act(name, extra = {}) { sendPresence({ act: name, ...extra }); if (PTS[name] !== undefined) gain(name); }
function doMok() { sfx.mok(); playAnim(player, "mok"); me.mok++; save(); if (me.mok % 10 === 0) say(); bubble(player, `똑 · ${me.mok}`); act("mok"); }
function doBow() {
  if (player.anim === "bow") return;
  sfx.soft(); playAnim(player, "bow"); me.bow++; save(); act("bow");
  bubble(player, `${me.bow}배`);
  if (me.bow === 108) { say("오늘 108배를 모두 마쳤어요. 정말 수고했어요."); sfx.bell(); } else if (me.bow % 12 === 0) say();
}
function doIncense() { incenseUntil = Date.now() + 90000; act("incense"); say("향 연기가 천천히 피어올라요."); }
function doBell() { const bx = -9, bz = 7; if (player.pos.distanceTo(new THREE.Vector3(bx, 0, bz)) > 5) { player.target.set(bx + 2.4, 0, bz); } sfx.bell(); act("bell"); say(); bubble(player, "데엥…"); }
function doTapdori() {
  if (autoPath) return; const pts = []; const r = 3.4; const start = Math.atan2(player.pos.x - PAGODA.x, player.pos.z - PAGODA.z);
  for (let i = 0; i <= 36; i++) { const a = start + (i / 36) * Math.PI * 2; pts.push({ x: PAGODA.x + Math.sin(a) * r, z: PAGODA.z + Math.cos(a) * r }); }
  autoPath = { pts, i: 0, done() { me.tap++; save(); bubble(player, `탑돌이 ${me.tap}바퀴`); act("tap"); if (me.tap % 3 === 0) say(); } };
  say("시계 방향으로 천천히 탑을 돌아요.");
}
function doPray(kind) { playAnim(player, "pray"); me.pray++; save(); sfx.soft(); act("pray", { what: kind });
  say(kind === "산신" ? "산의 기운이 가족을 지켜 주길 빌었어요." : "별빛 아래 모두 건강하고 오래오래 행복하길 빌었어요.");
  if (kind === "칠성") { sevenStars.userData.glowUntil = Date.now() + 6000; } }
function doCandle() { candleUntil = Date.now() + 120000; act("candle"); bubble(player, "초를 밝혔어요"); }
function doMeal() { const [name, color] = MEALS[mealIdx++ % MEALS.length]; bowl.visible = true; bowl.userData.food.material.color.set(color); bubble(player, name); act("meal", { what: name }); say("공양은 감사한 마음으로, 천천히 남김없이."); }
function doTea() { tea.visible = true; teaUntil = Date.now() + 60000; act("tea"); say("따뜻한 차 한 모금에 숨을 골라 보세요."); bubble(player, "후―"); }
function doNature() { vol.water = .7; vol.bird = .6; vol.wind = .35; $("vWater").value = 70; $("vBird").value = 60; $("vWind").value = 35; noiseLoop("water"); noiseLoop("wind"); say("물소리와 새소리를 들으며 천천히 걸어 보세요."); }
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
  [["robe", "법복", "r"], ["sash", "가사", "s"], ["acc", "소품", "a"]].forEach(([k, title, key]) => {
    const row = document.createElement("div"); row.className = "look-row";
    const h = document.createElement("small"); h.textContent = title; row.appendChild(h);
    const opts = document.createElement("div"); opts.className = "look-opts";
    LOOKS[k].forEach(([name, val], i) => {
      const b = document.createElement("button"); b.type = "button"; b.className = "look-opt" + (cur[key] === i ? " on" : "");
      if (k !== "acc") { const sw = document.createElement("span"); sw.className = "sw"; sw.style.background = val; b.appendChild(sw); }
      const locked = k === "acc" && levelOf(me.pts) < ACC_LEVEL[i];
      b.append(locked ? `🔒 ${name}` : name);
      if (locked) { b.classList.add("locked"); b.title = `${TITLES[ACC_LEVEL[i]][0]}부터 쓸 수 있어요`; b.onclick = () => toast(`${name}은(는) ${TITLES[ACC_LEVEL[i]][0]} 등급부터 쓸 수 있어요`); opts.appendChild(b); return; }
      b.onclick = () => { const p = lookParts(me.look); p[key] = i; me.look = `${p.r}-${p.s}-${p.a}`; save(); if (player) { applyLook(player, me.look); lastMoveTx = 0; lastTarget = { x: 1e9, z: 1e9 }; sendPresence(); trackMe(); } renderLookPanel(boxId); };
      opts.appendChild(b);
    });
    row.appendChild(opts); box.appendChild(row);
  });
}
renderLookPanel("gateLook");
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
$("lookBtn").onclick = () => { renderLookPanel("lookBody"); openPanel("lookPanel"); };
$("soundBtn").onclick = () => { ac(); noiseLoop("wind"); noiseLoop("water"); openPanel("soundPanel"); };
function renderStats() { $("stats").innerHTML = ""; [["오늘 목탁", me.mok], ["오늘 108배", me.bow], ["탑돌이", me.tap]].forEach(([k, v]) => { const d = document.createElement("div"); d.innerHTML = `<small>${k}</small><b>${v}</b>`; $("stats").appendChild(d); }); }

const BEADS = 27; let beadOffset = 0;
function drawBeads() {
  const ring = $("beadRing"); ring.innerHTML = "";
  for (let i = 0; i < BEADS; i++) {
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
$("beadRing").addEventListener("keydown", (e) => { if (e.key === " " || e.key === "Enter") { e.preventDefault(); nextBead(); } });

/* 소원 연등 */
let wishes = [];
function renderWishList() {
  const ul = $("wishList"); ul.innerHTML = "";
  if (!wishes.length) { const li = document.createElement("li"); li.textContent = "아직 걸린 연등이 없어요. 첫 소원을 달아 보세요."; ul.appendChild(li); }
  wishes.slice(0, 50).forEach((w) => { const li = document.createElement("li"); li.textContent = w.text; if (w.nick) { const s = document.createElement("small"); s.textContent = w.nick; li.appendChild(s); } ul.appendChild(li); });
  renderLanterns(wishes);
}
const BANNED = ["시발", "씨발", "ㅅㅂ", "병신", "ㅂㅅ", "좆", "개새", "섹스", "fuck", "닥쳐", "꺼져", "자살", "죽어"];
$("wishBtn").addEventListener("click", async () => {
  const text = $("wishInput").value.trim().slice(0, 40); if (!text) return;
  if (BANNED.some((b) => text.includes(b))) { $("wishNote").textContent = "고운 말로 적어 주세요."; return; }
  $("wishInput").value = ""; sfx.soft();
  const w = { text, nick: me.nick.slice(0, 8) };
  if (sb) {
    const { error } = await sb.from("wishes").insert(w);
    if (error) { $("wishNote").textContent = "연등을 걸지 못했어요. 잠시 뒤 다시 시도해 주세요."; return; }
    $("wishNote").textContent = "연등을 달았어요. 모두에게 보여요."; gain("wish");
  } else { gain("wish"); me.localWishes.unshift(w); me.localWishes = me.localWishes.slice(0, 40); save(); wishes = me.localWishes; renderWishList(); }
});
$("wishInput").addEventListener("keydown", (e) => { if (e.key === "Enter") $("wishBtn").click(); });

/* =========================================================
   실시간 (Supabase)
   ========================================================= */
let sb = null, lobby = null, roomCh = null, roomNo = 1, roomJoinedAt = 0;
const others = new Map(); // key -> {monk, nick, seenAt}
const roomCounts = {};
const ACT = { mok: "목탁을 쳤어요", greet: "합장했어요", bow: "절을 올렸어요", incense: "향을 피웠어요", candle: "초를 밝혔어요", pray: "기도를 올렸어요", tap: "탑을 한 바퀴 돌았어요", meal: "공양을 해요", tea: "차를 마셔요", bell: "범종을 울렸어요" };
const online = () => !!sb;

/* 신호 아끼기: 접속 명단(presence)은 들어올 때와 30초마다 한 번만,
   걷기는 목적지가 바뀔 때만, 동작은 그때그때 짧은 메시지(broadcast)로 보내요. */
let lastMoveTx = 0, lastTarget = { x: 1e9, z: 1e9 }, presence = {};
const posPayload = () => ({ k: myKey, l: me.look, lv: levelOf(me.pts), x: +player.pos.x.toFixed(2), z: +player.pos.z.toFixed(2), tx: +player.target.x.toFixed(2), tz: +player.target.z.toFixed(2) });
function trackMe() { if (roomCh && player) roomCh.track({ nick: me.nick.slice(0, 8), ...posPayload(), at: Date.now() }).catch(() => {}); }
setInterval(trackMe, 30000);
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
  if (!o) { o = { monk: makeMonk(nick, false), nick }; o.monk.pos.set(clamp(+p.x || 0, -40, 40), 0, clamp(+p.z || 0, -26, 46)); o.monk.target.copy(o.monk.pos); others.set(key, o); }
  if (p.nick) o.nick = nick;
  setLabel(o.monk, labelText(o.nick, Number.isFinite(+p.lv) ? +p.lv : (o.lv ?? 0)), false); if (Number.isFinite(+p.lv)) o.lv = +p.lv;
  if (looksOk(p.l)) applyLook(o.monk, p.l);
  return o;
}
function applyMove(o, p) {
  const x = clamp(+p.x || 0, -40, 40), z = clamp(+p.z || 0, -26, 46);
  if (Math.hypot(o.monk.pos.x - x, o.monk.pos.z - z) > 6) o.monk.pos.set(x, 0, z);
  o.monk.target.set(clamp(+p.tx || x, -40, 40), 0, clamp(+p.tz || z, -26, 46));
}
function onRoomSync() {
  const state = roomCh.presenceState(); const keys = new Set();
  for (const [key, metas] of Object.entries(state)) {
    if (key === myKey) continue; const p = metas[metas.length - 1]; if (!p) continue; keys.add(key);
    const isNew = !others.has(key); const o = ensureOther(key, p); if (isNew) applyMove(o, p);
  }
  for (const [key, o] of others) if (!keys.has(key)) { scene.remove(o.monk.root); others.delete(key); }
  $("peopleCount").textContent = others.size + 1;
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
  if (p.act === "bow") playAnim(o.monk, "bow");
  if (p.act === "greet") { playAnim(o.monk, "greet"); bubble(o.monk, "🙏"); }
  if (p.act === "pray") playAnim(o.monk, "pray");
  if (p.act === "incense") incenseUntil = Math.max(incenseUntil, Date.now() + 60000);
  if (p.act === "candle") candleUntil = Math.max(candleUntil, Date.now() + 90000);
  const near = player && o.monk.pos.distanceTo(player.pos) < 14;
  if (p.act === "greet" && p.to === myKey) toast(`${nick}님이 나에게 합장했어요 🙏`, { label: "맞합장", fn: () => greet(key) });
  else if (near && p.act === "greet") toast(`${nick}님이 합장했어요`, { label: "맞합장", fn: () => greet(key) });
  else if (near && p.act !== "bow" && p.act !== "mok") toast(`${nick}님이 ${ACT[p.act]}`);
}

async function joinRoom(n) {
  if (roomCh) { await sb.removeChannel(roomCh); roomCh = null; }
  for (const [, o] of others) scene.remove(o.monk.root); others.clear();
  roomNo = n; roomJoinedAt = Date.now(); $("roomLabel").textContent = `${CONFIG.roomName} ${n}`;
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
  // 소원 연등
  const { data } = await sb.from("wishes").select("text,nick,created_at").order("created_at", { ascending: false }).limit(42);
  wishes = data || []; renderWishList();
  sb.channel("sansa-wishes").on("postgres_changes", { event: "INSERT", schema: "public", table: "wishes" }, ({ new: w }) => {
    wishes.unshift({ text: String(w.text || "").slice(0, 40), nick: String(w.nick || "").slice(0, 8) }); wishes = wishes.slice(0, 42); renderWishList();
    if (w.nick !== me.nick) toast(`🏮 새 연등: ${String(w.text).slice(0, 20)}`);
  }).subscribe();
}
function solo(msg) {
  sb = null; $("roomLabel").textContent = "혼자 수행 중"; $("peopleCount").textContent = "1";
  $("wishNote").textContent = "지금은 연등이 이 기기에만 저장돼요.";
  wishes = me.localWishes; renderWishList(); if (msg) toast(msg);
}
function renderRooms() {
  const list = $("roomList"); list.innerHTML = ""; countRooms();
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
  const nick = $("nickInput").value.trim().slice(0, 8) || ["고요", "청산", "연화", "바람", "달빛", "솔향", "보리"][Math.floor(Math.random() * 7)];
  me.nick = nick; save();
  $("gate").hidden = true; ac(); preloadRecs(); noiseLoop("wind"); noiseLoop("water");
  loadRec("nature").then((b) => { if (b) { natureRec = playRec("nature", .6 * Math.max(vol.wind, vol.water, .3), true); } });
  { const lp = lookParts(me.look); if (levelOf(me.pts) < ACC_LEVEL[lp.a]) { me.look = `${lp.r}-${lp.s}-0`; save(); } }
  player = makeMonk(nick, true); applyLook(player, me.look); setLabel(player, labelText(nick, levelOf(me.pts)), true); updateHud(); player.pos.set(SPAWN.x + rand(-3, 3), 0, SPAWN.z + rand(-1, 1.5)); player.target.copy(player.pos); player.yaw = Math.PI;
  zone = zoneOf(player.pos.x, player.pos.z); renderActions(); say(ZONES[zone].intro);
  connect();
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
    const moved = moveMonk(player, dt, autoPath ? 2 : 3.4);
    if (moved && now - lastMoveSent > 250) { lastMoveSent = now; sendPresence(); }
    animateMonk(player, dt, now);
    const z = zoneOf(player.pos.x, player.pos.z);
    if (z !== zone) { zone = z; renderActions(); say(ZONES[zone].intro); gain(`visit:${z}`); }
    // 대웅전 안에서는 동자승 뒤쪽 위에서 부처님을 함께 바라보는 구도로 바꿔요
    if (zone === "hall") {
      const want = new THREE.Vector3(player.pos.x * .5, 2.3, player.pos.z - 4.2);
      camTarget.lerp(want, Math.min(1, dt * 4));
      const back = 3.3, yaw = clamp(camYaw, -.6, .6);
      const camWant = new THREE.Vector3(player.pos.x + Math.sin(yaw) * back, 4.1, Math.min(player.pos.z + Math.cos(yaw) * back, -14.4));
      camera.position.lerp(camWant, Math.min(1, dt * 4));
    } else {
      camTarget.lerp(new THREE.Vector3(player.pos.x, 1.6, player.pos.z), Math.min(1, dt * 5));
      camera.position.set(camTarget.x + Math.sin(camYaw) * Math.cos(camPitch) * camDist, camTarget.y + Math.sin(camPitch) * camDist, camTarget.z + Math.cos(camYaw) * Math.cos(camPitch) * camDist);
    }
    camera.lookAt(camTarget);
    for (const t of camHide) { const dx = t.position.x - camera.position.x, dz = t.position.z - camera.position.z; t.visible = dx * dx + dz * dz > 7; }
    const fovWant = zone === "hall" ? 70 : 55;
    if (Math.abs(camera.fov - fovWant) > .1) { camera.fov += (fovWant - camera.fov) * Math.min(1, dt * 4); camera.updateProjectionMatrix(); }
  } else {
    camera.position.set(Math.sin(t * .05) * 22, 9, Math.cos(t * .05) * 22 - 4); camera.lookAt(0, 2, -8);
  }
  for (const [, o] of others) { moveMonk(o.monk, dt, 3.6); animateMonk(o.monk, dt, now); }
  // 효과
  const inc = Date.now() < incenseUntil; incense.visible = inc;
  if (inc) smoke.forEach((s) => { s.userData.t = (s.userData.t + dt * .3) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 9) * .1, .6 + k * 1.6, 0); s.scale.setScalar(.6 + k * 1.8); s.material.opacity = Math.sin(k * Math.PI) * .35; });
  candles.forEach((f, i) => { f.scale.x = 1 + Math.sin(t * 13 + i) * .12; });
  hallLight.intensity = 16 + Math.sin(t * 7) * 1.5;
  const cdl = Date.now() < candleUntil; shrineFlame.visible = cdl; shrineLight.intensity = cdl ? 5 + Math.sin(t * 9) : 0;
  const glow = (sevenStars.userData.glowUntil || 0) > Date.now(); sevenStars.children.forEach((s, i) => s.scale.setScalar(glow ? 1.6 + Math.sin(t * 4 + i) * .4 : 1));
  const tv = Date.now() < teaUntil; tea.visible = tv;
  if (tv) steam.forEach((s) => { s.userData.t = (s.userData.t + dt * .4) % 1; const k = s.userData.t; s.position.set(Math.sin(k * 7) * .05, .25 + k * .6, 0); s.material.opacity = Math.sin(k * Math.PI) * .4; });
  lanternGroup.children.forEach((l, i) => { l.rotation.z = Math.sin(t * .8 + i) * .06; });
  stream.material.color.setHSL(.55, .4, .27 + Math.sin(t * 2) * .02);
  renderer.render(scene, camera);
  requestAnimationFrame(tick);
}
renderLanterns(me.localWishes);
requestAnimationFrame(tick);
say("법명을 정하고 산사에 들어가 보세요.");
