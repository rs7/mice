import { createGameMachine } from "./fsm.js";
import { startBackgroundMusic, startOutroMusic, fadeOutOutroMusic } from "./music.js";
import { showModal, createButton } from "./modal.js";
import { scene, texts } from "./data.js";

const debugMode = new URLSearchParams(window.location.search).has("help");

const totalAttempts = 3;
const transitionDuration = 1000;
const victoryUrl = "../heist/";

const gameState = {
  status: "intro",
  lives: totalAttempts,
  currentIndex: 0
};

const viewport = document.querySelector(".scene-viewport");
const stage = document.querySelector(".scene-stage");
const image = document.querySelector(".scene-image");
const map = document.querySelector("#scene-map");
const debugOverlay = document.querySelector(".debug-overlay");
const hintPanel = document.querySelector(".hint-panel");
const livesCounter = document.querySelector(".lives-counter");
const progressCounter = document.querySelector(".progress-counter");
const modal = document.querySelector(".modal");
const outroNoteTemplate = document.querySelector("#outro-note-template");
const lifeIconTemplate = document.querySelector("#life-icon-template");
const progressIconTemplate = document.querySelector("#progress-icon-template");

// Общие функции интерфейса.
function showMessage({ title, message, button }) {
  return showModal({
    title,
    message,
    createButtons: (finish) => [
      createButton(button, () => finish())
    ]
  });
}

function fadeScene(from, to) {
  return stage.animate([{ opacity: from }, { opacity: to }], {
    duration: transitionDuration,
    easing: "ease-in-out",
    fill: "forwards"
  }).finished;
}

// Переходы и перезапуск.
function nextPart() {
  window.open(victoryUrl, "_blank", "noopener,noreferrer");
}

async function restart() {
  await fadeScene(1, 0);
  window.location.reload();
}

// Финальная записка.
function createOutroNote(text) {
  const content = outroNoteTemplate.content.cloneNode(true);
  content.querySelector("[data-message]").textContent = text.message;
  content.querySelector("[data-signature]").textContent = text.signature;
  content.querySelector("[data-afterword]").textContent = text.afterword;
  return content;
}

function showEnd() {
  const text = texts.end;
  return showModal({
    title: text.title,
    message: createOutroNote(text),
    createButtons: (finish) => [
      createButton(text.restartButton, () => finish("restart")),
      createButton(text.button, () => {
        fadeOutOutroMusic(transitionDuration);
        nextPart();
      })
    ]
  });
}

// Сцена и игровой сценарий.
function getCurrentObject() {
  return scene.objects[gameState.currentIndex];
}

async function initializeScene() {
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

  function renderGame() {
    const textScreen = ["intro", "outro", "end"].includes(gameState.status);
    modal.classList.toggle("modal-note", gameState.status === "end");
    livesCounter.hidden = textScreen;
    lifeIcons.forEach((icon, index) => {
      icon.src = index < gameState.lives ? "assets/heart.svg" : "assets/heart-outline.svg";
    });
    progressCounter.hidden = textScreen;
    const foundCount = gameState.currentIndex
      + Number(["item_found", "all_found", "outro", "end"].includes(gameState.status));
    progressIcons.forEach((icon, index) => {
      icon.src = index < foundCount ? "assets/star.svg" : "assets/star-outline.svg";
    });
    image.hidden = textScreen;
    debugOverlay.toggleAttribute("hidden", !debugMode || textScreen);
    Array.from(debugOverlay.children).forEach((polygon, index) => {
      polygon.classList.toggle("is-current",
        gameState.status === "searching" && index === gameState.currentIndex);
    });
    hintPanel.hidden = gameState.status !== "searching";
    hintPanel.textContent = getCurrentObject().hint;
  }

  async function handleStateChange(event) {
    renderGame();

    switch (gameState.status) {
      case "welcome":
        await fadeScene(0, 1);
        await showMessage(texts.welcome);
        await machine.send("START");
        break;
      case "searching":
        if (event === "START" || event === "CONTINUE") {
          hintPanel.hidden = true;
          const object = getCurrentObject();
          await showMessage({ ...texts.hint, message: object.hint });
          hintPanel.hidden = false;
        } else if (event === "MISS") {
          await showMessage(texts.miss);
        }
        break;
      case "item_found": {
        const object = getCurrentObject();
        await showMessage({
          title: object.name,
          message: object.foundText,
          button: object.foundButton
        });
        await machine.send("CONTINUE");
        break;
      }
      case "all_found":
        await showMessage(texts.all_found);
        startOutroMusic(transitionDuration);
        await fadeScene(1, 0);
        await machine.send("CONTINUE");
        break;
      case "outro": {
        const continued = showMessage(texts.outro);
        await fadeScene(0, 1);
        await continued;
        await machine.send("CONTINUE");
        break;
      }
      case "end": {
        const action = await showEnd();
        if (action === "restart") {
          fadeOutOutroMusic(transitionDuration);
          await restart();
        }
        break;
      }
      case "out_of_lives":
        await showMessage(texts.out_of_lives);
        await restart();
        break;
    }
  }

  // Подготовка и запуск сцены.
  const lifeIcons = Array.from({ length: totalAttempts }, () => {
    const icon = lifeIconTemplate.content.firstElementChild.cloneNode(true);
    livesCounter.prepend(icon);
    return icon;
  });

  const progressIcons = scene.objects.map(() => {
    const icon = progressIconTemplate.content.firstElementChild.cloneNode(true);
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

  const areas = scene.objects.map((object, index) => {
    const area = document.createElement("area");
    area.shape = "poly";
    area.addEventListener("click", () => {
      machine.send(index === gameState.currentIndex ? "HIT" : "MISS");
    });
    map.append(area);
    return { area, polygon: object.polygon };
  });

  image.addEventListener("click", () => machine.send("MISS"));

  resizeMap();
  new ResizeObserver(resizeMap).observe(viewport);
  renderGame();
  await showMessage(texts.intro);
  startBackgroundMusic();
  await image.decode();
  await machine.send("CONTINUE");
}

initializeScene();
