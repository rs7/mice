const backgroundMusic = document.querySelector(".background-music");
const outroMusic = document.querySelector(".outro-music");

const musicContext = new AudioContext();
const musicGain = createMusicGain(backgroundMusic);
const outroGain = createMusicGain(outroMusic);

backgroundMusic.volume = 0.3;
outroMusic.volume = 0.3;

export function startBackgroundMusic() {
  musicContext.resume();
  backgroundMusic.play();
}

function createMusicGain(audio) {
  const gain = musicContext.createGain();
  musicContext.createMediaElementSource(audio).connect(gain);
  gain.connect(musicContext.destination);
  return gain;
}

function fadeOutMusic(audio, gain, duration) {
  if (audio.paused) return;
  const now = musicContext.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + duration / 1000);
  setTimeout(() => audio.pause(), duration);
}

export function startOutroMusic(duration) {
  fadeOutMusic(backgroundMusic, musicGain, duration);
  const now = musicContext.currentTime;
  outroGain.gain.setValueAtTime(0, now);
  outroGain.gain.linearRampToValueAtTime(1, now + duration / 1000);
  outroMusic.play();
}

export function fadeOutOutroMusic(duration) {
  fadeOutMusic(outroMusic, outroGain, duration);
}
