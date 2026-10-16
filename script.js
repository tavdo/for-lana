// სიმღერის შესაცვლელად მხოლოდ ეს ID ჩაანაცვლე.
const YOUTUBE_VIDEO_ID = "VAI-fUqoyOA";

// "არა"-ს ყოველ გაქცევაზე ეს წარწერები რიგით იცვლება, ბოლოს კი თავიდან იწყება.
const NO_LABELS = [
  "ნამდვილად? 🥺",
  "დაფიქრდი კიდევ...",
  "გთხოვ 🥹",
  "ძალიან გთხოვ 💔",
  "ბოლო შანსი 😭"
];

const RAIN_HEARTS = ["💗", "💖", "💕", "❤️"];
const YES_SCALE_MAX = 220;
const YES_SCALE_STEP = 15;

const openBtn = document.getElementById("open-btn");
const yesBtn = document.getElementById("yes-btn");
const noBtn = document.getElementById("no-btn");
const muteBtn = document.getElementById("mute-btn");
const heartRain = document.getElementById("heart-rain");
const safeProbe = document.getElementById("safe-probe");
const screens = document.querySelectorAll(".screen");

let noLabelIndex = 0;
let yesScale = 100;
let fleeLockUntil = 0;
let wantsSound = true;
let musicStarted = false;
let playerReady = false;
let player = null;
let rainStarted = false;

// ეკრანის ჩვენება: მხოლოდ ერთი ბარათი რჩება ხილული
function showScreen(id) {
  screens.forEach((screen) => {
    const active = screen.id === id;
    screen.classList.toggle("is-active", active);
    screen.setAttribute("aria-hidden", active ? "false" : "true");
    if (active) {
      const heading = screen.querySelector("h1");
      if (heading) heading.focus({ preventScroll: true });
    }
  });
}

function growYes() {
  yesScale = Math.min(YES_SCALE_MAX, yesScale + YES_SCALE_STEP);
  yesBtn.style.setProperty("--yes-scale", String(yesScale / 100));
}

function safeBox() {
  const rect = safeProbe.getBoundingClientRect();
  const margin = 10;
  return {
    minX: rect.left + margin,
    minY: rect.top + margin,
    maxX: rect.right - margin,
    maxY: rect.bottom - margin
  };
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function pointerOf(event) {
  const touch = (event.touches && event.touches[0]) || (event.changedTouches && event.changedTouches[0]);
  if (touch) return { x: touch.clientX, y: touch.clientY };
  if (typeof event.clientX === "number") return { x: event.clientX, y: event.clientY };
  return null;
}

function covers(x, y, width, height, target, pad) {
  if (!target) return false;
  return (
    target.x >= x - pad &&
    target.x <= x + width + pad &&
    target.y >= y - pad &&
    target.y <= y + height + pad
  );
}

// ღილაკი შემთხვევით ადგილას გადადის, თითსა და ხმის ღილაკს გვერდს უვლის
function randomSpot(width, height, pointer) {
  const box = safeBox();
  const mute = muteBtn.getBoundingClientRect();
  const maxX = Math.max(box.minX, box.maxX - width);
  const maxY = Math.max(box.minY, box.maxY - height);
  let x = box.minX;
  let y = box.minY;

  for (let attempt = 0; attempt < 24; attempt += 1) {
    x = box.minX + Math.random() * (maxX - box.minX);
    y = box.minY + Math.random() * (maxY - box.minY);
    const hitsPointer = covers(x, y, width, height, pointer, 48);
    const hitsMute = !(
      x + width < mute.left - 8 ||
      x > mute.right + 8 ||
      y + height < mute.top - 8 ||
      y > mute.bottom + 8
    );
    if (!hitsPointer && !hitsMute) return { x, y };
  }

  if (pointer) {
    x = pointer.x < window.innerWidth / 2 ? maxX : box.minX;
    y = pointer.y < window.innerHeight / 2 ? maxY : box.minY;
  }

  return {
    x: clamp(x, box.minX, maxX),
    y: clamp(y, box.minY, maxY)
  };
}

function flee(event) {
  const now = Date.now();
  if (now < fleeLockUntil) return;
  fleeLockUntil = now + 380;

  if (event.cancelable && event.type === "touchstart") event.preventDefault();

  noBtn.textContent = NO_LABELS[noLabelIndex % NO_LABELS.length];
  noLabelIndex += 1;
  growYes();

  if (!noBtn.classList.contains("is-fleeing")) {
    noBtn.classList.add("is-fleeing");
    document.body.appendChild(noBtn);
  }

  const spot = randomSpot(noBtn.offsetWidth, noBtn.offsetHeight, pointerOf(event));
  noBtn.style.left = spot.x + "px";
  noBtn.style.top = spot.y + "px";
}

function keepNoButtonOnScreen() {
  if (!noBtn.isConnected || !noBtn.classList.contains("is-fleeing")) return;
  const box = safeBox();
  const width = noBtn.offsetWidth;
  const height = noBtn.offsetHeight;
  const x = clamp(parseFloat(noBtn.style.left) || box.minX, box.minX, Math.max(box.minX, box.maxX - width));
  const y = clamp(parseFloat(noBtn.style.top) || box.minY, box.minY, Math.max(box.minY, box.maxY - height));
  noBtn.style.left = x + "px";
  noBtn.style.top = y + "px";
}

function updateMuteButton() {
  muteBtn.textContent = wantsSound ? "🔊" : "🔇";
  muteBtn.classList.toggle("is-muted", !wantsSound);
  muteBtn.setAttribute("aria-pressed", wantsSound ? "false" : "true");
  muteBtn.setAttribute("aria-label", wantsSound ? "მუსიკის გამორთვა" : "მუსიკის ჩართვა");
}

function applySound() {
  if (!playerReady || !player) return;
  if (wantsSound) {
    player.unMute();
    player.setVolume(70);
  } else {
    player.mute();
  }
}

function playMusic() {
  if (!playerReady || !player) return;
  applySound();
  player.playVideo();
}

// ხმა მხოლოდ პირველი შეხების შემდეგ ირთვება — ავტოპლეი ბრაუზერს ეკრძალება
function startMusic() {
  musicStarted = true;
  if (playerReady) playMusic();
}

function toggleSound() {
  wantsSound = !wantsSound;
  updateMuteButton();
  if (!musicStarted || !playerReady || !player) return;

  // თუ პირველ ღილაკზე ხმა ვერ აეწყო, აქ ხელახლა ვცდით
  const state = player.getPlayerState();
  const playing = state === YT.PlayerState.PLAYING || state === YT.PlayerState.BUFFERING;
  if (playing) applySound();
  else playMusic();
}

function startHeartRain() {
  if (rainStarted) return;
  rainStarted = true;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const count = reduced ? 10 : 20;

  for (let i = 0; i < count; i += 1) {
    const heart = document.createElement("span");
    heart.className = "rain-heart";
    heart.textContent = RAIN_HEARTS[i % RAIN_HEARTS.length];
    heart.style.setProperty("--x", Math.random() * 100 + "%");
    heart.style.setProperty("--size", 14 + Math.random() * 22 + "px");
    heart.style.setProperty("--dur", 4.2 + Math.random() * 3.4 + "s");
    heart.style.setProperty("--delay", Math.random() * 5 + "s");
    heart.style.setProperty("--drift", -30 + Math.random() * 60 + "px");
    heart.style.setProperty("--top", 8 + Math.random() * 78 + "%");
    heartRain.appendChild(heart);
  }
}

function onPlayerReady(event) {
  player = event.target;
  playerReady = true;
  const iframe = player.getIframe();
  iframe.tabIndex = -1;
  iframe.title = "ფონის მუსიკა";
  iframe.setAttribute("aria-hidden", "true");
  applySound();
  if (musicStarted) playMusic();
}

function onPlayerStateChange(event) {
  // playlist-ის ციკლს დამატებით ვამაგრებთ, რომ სიმღერა არ გაჩერდეს
  if (event.data === YT.PlayerState.ENDED && musicStarted) {
    player.seekTo(0, true);
    player.playVideo();
  }
}

function onYouTubeIframeAPIReady() {
  const playerVars = {
    autoplay: 0,
    controls: 0,
    disablekb: 1,
    fs: 0,
    iv_load_policy: 3,
    loop: 1,
    playlist: YOUTUBE_VIDEO_ID,
    modestbranding: 1,
    playsinline: 1,
    rel: 0
  };

  if (location.protocol === "http:" || location.protocol === "https:") {
    playerVars.origin = location.origin;
  }

  player = new YT.Player("yt-player", {
    width: "240",
    height: "135",
    videoId: YOUTUBE_VIDEO_ID,
    playerVars,
    events: {
      onReady: onPlayerReady,
      onStateChange: onPlayerStateChange
    }
  });
}

function loadYouTubeApi() {
  const tag = document.createElement("script");
  tag.src = "https://www.youtube.com/iframe_api";
  document.head.appendChild(tag);
}

openBtn.addEventListener("click", () => {
  startMusic();
  showScreen("screen-ask");
});

yesBtn.addEventListener("click", () => {
  noBtn.remove();
  showScreen("screen-thanks");
  startHeartRain();
});

noBtn.addEventListener("touchstart", flee, { passive: false });
noBtn.addEventListener("mouseenter", flee);
noBtn.addEventListener("click", flee);

muteBtn.addEventListener("click", toggleSound);
window.addEventListener("resize", keepNoButtonOnScreen);

window.onYouTubeIframeAPIReady = onYouTubeIframeAPIReady;
loadYouTubeApi();
