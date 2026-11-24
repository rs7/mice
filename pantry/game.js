import { createGameMachine } from "./fsm.js";

const debugMode = new URLSearchParams(window.location.search).has("help");

const totalAttempts = 4;
const transitionDuration = 1000;
const victoryUrl = "../heist/";

const gameState = {
  status: "intro",
  lives: totalAttempts,
  selectedObjectIndex: 0
};

const viewport = document.querySelector(".scene-viewport");
const stage = document.querySelector(".scene-stage");
const image = document.querySelector(".scene-image");
const map = document.querySelector("#scene-map");
const debugOverlay = document.querySelector(".debug-overlay");
const hintPanel = document.querySelector(".hint-panel");
const livesCounter = document.querySelector(".lives-counter");
const progressCounter = document.querySelector(".progress-counter");
const modalLayer = document.querySelector(".modal-layer");
const modal = document.querySelector(".modal");
const modalTitle = document.querySelector(".modal-title");
const modalText = document.querySelector(".modal-text");
const modalActions = document.querySelector(".modal-actions");
const backgroundMusic = document.querySelector(".background-music");
const outroMusic = document.querySelector(".outro-music");

let musicContext;
let musicGain;
let outroGain;

backgroundMusic.volume = 0.3;
outroMusic.volume = 0.3;

function startBackgroundMusic() {
  musicContext = new AudioContext();
  musicGain = createMusicGain(backgroundMusic);
  musicContext.resume();
  backgroundMusic.play();
}

function createMusicGain(audio) {
  const gain = musicContext.createGain();
  musicContext.createMediaElementSource(audio).connect(gain);
  gain.connect(musicContext.destination);
  return gain;
}

function fadeOutMusic(audio, gain) {
  if (audio.paused) return;
  const now = musicContext.currentTime;
  gain.gain.setValueAtTime(gain.gain.value, now);
  gain.gain.linearRampToValueAtTime(0, now + transitionDuration / 1000);
  setTimeout(() => audio.pause(), transitionDuration);
}

function startOutroMusic() {
  fadeOutMusic(backgroundMusic, musicGain);
  outroGain = createMusicGain(outroMusic);
  const now = musicContext.currentTime;
  outroGain.gain.setValueAtTime(0, now);
  outroGain.gain.linearRampToValueAtTime(1, now + transitionDuration / 1000);
  outroMusic.play();
}

function showModal(title, text, createButtons) {
  return new Promise((resolve) => {
    modalTitle.textContent = title;
    modalTitle.hidden = title === "";
    modalText.replaceChildren(text);
    const finish = (value) => {
      modalLayer.hidden = true;
      modalActions.replaceChildren();
      resolve(value);
    };
    modalActions.replaceChildren(...createButtons(finish));
    modalLayer.hidden = false;
    modal.scrollTop = 0;
    modalActions.firstElementChild?.focus({ preventScroll: true });
  });
}

function createButton(label, onClick) {
  const button = document.createElement("button");
  button.type = "button";
  button.classList.add("modal-button");
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}

function showMessage(title, text, label) {
  return showModal(title, text, (finish) => [
    createButton(label, () => finish())
  ]);
}

function showEnd(text) {
  return showModal(text.title, createOutroNote(text), (finish) => [
    createButton(text.restartButton, () => finish("restart")),
    createButton(text.button, () => {
      fadeOutMusic(outroMusic, outroGain);
      if (victoryUrl) window.open(victoryUrl, "_blank", "noopener,noreferrer");
    })
  ]);
}

function createOutroNote(text) {
  const message = document.createElement("p");
  message.textContent = text.message;
  const signature = document.createElement("p");
  const emphasis = document.createElement("em");
  emphasis.textContent = text.signature;
  signature.append(emphasis);
  const afterword = document.createElement("p");
  afterword.textContent = text.afterword;
  const content = document.createDocumentFragment();
  content.append(message, signature, document.createElement("hr"), afterword);
  return content;
}

async function initializeScene() {
  const response = await fetch("objects.json");
  const scene = await response.json();
  const lifeIcons = Array.from({ length: totalAttempts }, () => {
    const icon = document.createElement("img");
    icon.classList.add("lives-icon");
    icon.draggable = false;
    livesCounter.append(icon);
    return icon;
  });
  const progressIcons = scene.objects.map(() => {
    const icon = document.createElement("img");
    icon.classList.add("progress-icon");
    icon.draggable = false;
    progressCounter.append(icon);
    return icon;
  });
  const machine = createGameMachine(gameState, scene.objects.length, handleStateChange);

  image.src = scene.image.src;

  if (debugMode) {
    debugOverlay.setAttribute("viewBox", `0 0 ${scene.image.width} ${scene.image.height}`);
    for (const object of scene.objects) {
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", object.polygon.map((point) => point.join(",")).join(" "));
      debugOverlay.append(polygon);
    }
  }

  function renderGame() {
    const textScreen = ["intro", "outro", "outro_note"].includes(gameState.status);
    modal.classList.toggle("modal-note", gameState.status === "outro_note");
    livesCounter.hidden = textScreen;
    lifeIcons.forEach((icon, index) => {
      icon.src = index >= totalAttempts - gameState.lives ? "assets/heart.svg" : "assets/heart-outline.svg";
    });
    progressCounter.hidden = textScreen;
    const foundCount = gameState.selectedObjectIndex
      + Number(["item_found", "all_found", "outro", "outro_note"].includes(gameState.status));
    progressIcons.forEach((icon, index) => {
      icon.src = index < foundCount ? "assets/star.svg" : "assets/star-outline.svg";
    });
    image.hidden = textScreen;
    debugOverlay.toggleAttribute("hidden", !debugMode || textScreen);
    Array.from(debugOverlay.children).forEach((polygon, index) => {
      polygon.classList.toggle("is-current",
        gameState.status === "searching" && index === gameState.selectedObjectIndex);
    });
    hintPanel.hidden = gameState.status !== "searching";
    hintPanel.textContent = scene.objects[gameState.selectedObjectIndex].hint;
  }

  function fadeScene(from, to) {
    return stage.animate([{ opacity: from }, { opacity: to }], {
      duration: transitionDuration,
      easing: "ease-in-out",
      fill: "forwards"
    }).finished;
  }

  async function handleStateChange(event) {
    renderGame();

    switch (gameState.status) {
      case "welcome":
        await fadeScene(0, 1);
        await showMessage(texts.welcome.title, texts.welcome.message, texts.welcome.button);
        await machine.send("START");
        break;
      case "searching":
        if (event === "START" || event === "CONTINUE") {
          hintPanel.hidden = true;
          const object = scene.objects[gameState.selectedObjectIndex];
          await showMessage(texts.hint.title, object.hint, texts.hint.button);
          hintPanel.hidden = false;
        } else if (event === "MISS") {
          await showMessage(texts.miss.title, texts.miss.message, texts.miss.button);
        }
        break;
      case "item_found": {
        const object = scene.objects[gameState.selectedObjectIndex];
        await showMessage(object.name, object.foundText, object.foundButton);
        await machine.send("CONTINUE");
        break;
      }
      case "all_found":
        await showMessage(texts.all_found.title, texts.all_found.message, texts.all_found.button);
        startOutroMusic();
        await fadeScene(1, 0);
        await machine.send("CONTINUE");
        break;
      case "outro": {
        const continued = showMessage(texts.outro.title, texts.outro.message, texts.outro.button);
        await fadeScene(0, 1);
        await continued;
        await machine.send("CONTINUE");
        break;
      }
      case "outro_note": {
        const action = await showEnd(texts.outro_note);
        if (action === "restart") {
          fadeOutMusic(outroMusic, outroGain);
          await fadeScene(1, 0);
          window.location.reload();
        }
        break;
      }
      case "out_of_lives":
        await showMessage(texts.out_of_lives.title, texts.out_of_lives.message, texts.out_of_lives.button);
        await fadeScene(1, 0);
        window.location.reload();
        break;
    }
  }

  const areas = scene.objects.map((object, index) => {
    const area = document.createElement("area");
    area.shape = "poly";
    area.addEventListener("click", () => {
      machine.send(index === gameState.selectedObjectIndex ? "HIT" : "MISS");
    });
    map.append(area);
    return { area, polygon: object.polygon };
  });

  image.addEventListener("click", () => machine.send("MISS"));

  function resizeMap() {
    const scale = Math.min(
      viewport.clientWidth / scene.image.width,
      viewport.clientHeight / scene.image.height
    );

    stage.style.width = `${scene.image.width * scale}px`;
    stage.style.height = `${scene.image.height * scale}px`;

    for (const { area, polygon } of areas) {
      area.coords = polygon
        .flatMap(([x, y]) => [Math.round(x * scale), Math.round(y * scale)])
        .join(",");
    }
  }

  resizeMap();
  new ResizeObserver(resizeMap).observe(viewport);
  renderGame();
  await showMessage(texts.intro.title, texts.intro.message, texts.intro.button);
  startBackgroundMusic();
  await image.decode();
  await machine.send("CONTINUE");
}

const textsResponse = await fetch("text.json");
const texts = await textsResponse.json();

initializeScene();
