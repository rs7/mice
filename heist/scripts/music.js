const backgroundMusic = document.querySelector(".background-music");
const musicContext = new AudioContext();
const musicGain = musicContext.createGain();

musicContext.createMediaElementSource(backgroundMusic).connect(musicGain);
musicGain.connect(musicContext.destination);
backgroundMusic.volume = 0.3;

let pauseTimer;

export function startBackgroundMusic() {
  clearTimeout(pauseTimer);
  const now = musicContext.currentTime;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(1, now);
  musicContext.resume();
  backgroundMusic.play();
}

export function fadeOutBackgroundMusic(duration) {
  clearTimeout(pauseTimer);
  if (backgroundMusic.paused) return;
  const now = musicContext.currentTime;
  const volume = musicGain.gain.value;
  musicGain.gain.cancelScheduledValues(now);
  musicGain.gain.setValueAtTime(volume, now);
  musicGain.gain.linearRampToValueAtTime(0, now + duration / 1000);
  pauseTimer = setTimeout(() => backgroundMusic.pause(), duration);
}
