import { createGameMachine } from "./fsm.js";

const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";
const totalAttempts = 3;
const victoryUrl = "/part2/";

const gameState = {
  status: "intro",
  lives: totalAttempts,
  selectedObjectIndex: 0
};

const modalLayer = document.querySelector(".modal-layer");
const modal = document.querySelector(".modal");
const modalTitle = document.querySelector(".modal-title");
const modalText = document.querySelector(".modal-text");
const modalNext = document.querySelector(".modal-next");
const livesCounter = document.querySelector(".lives-counter");
const backgroundMusic = document.querySelector(".background-music");

backgroundMusic.volume = 0.3;
modalNext.addEventListener("click", () => backgroundMusic.play(), { once: true });

const lifeIcons = Array.from({ length: totalAttempts }, () => {
  const icon = document.createElement("img");
  icon.classList.add("lives-icon");
  icon.draggable = false;
  livesCounter.append(icon);
  return icon;
});

function showModal(title, message, label) {
  return new Promise((resolve) => {
    modalTitle.textContent = title;
    modalTitle.hidden = title === "";
    modalText.textContent = message;
    modalNext.textContent = label;
    modalNext.addEventListener("click", () => {
      modalLayer.hidden = true;
      resolve();
    }, { once: true });
    modalLayer.hidden = false;
    modal.scrollTop = 0;
  });
}

async function initializeScene() {
  const response = await fetch("objects.json");
  const scene = await response.json();
  const viewport = document.querySelector(".scene-viewport");
  const stage = document.querySelector(".scene-stage");
  const image = document.querySelector(".scene-image");
  const map = document.querySelector("#scene-map");
  const debugOverlay = document.querySelector(".debug-overlay");
  const debugControls = document.querySelector(".debug-controls");
  const hintPanel = document.querySelector(".hint-panel");
  const progressCounter = document.querySelector(".progress-counter");
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
    document.querySelector(".debug-lose").addEventListener("click", () => showDebugResult("DEBUG_LOSE"));
    document.querySelector(".debug-win").addEventListener("click", () => showDebugResult("DEBUG_WIN"));
    debugOverlay.setAttribute("viewBox", `0 0 ${scene.image.width} ${scene.image.height}`);
    for (const object of scene.objects) {
      const polygon = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
      polygon.setAttribute("points", object.polygon.map((point) => point.join(",")).join(" "));
      debugOverlay.append(polygon);
    }
  }

  async function showDebugResult(event) {
    if (!modalLayer.hidden) {
      modalNext.click();
      // Завершаем обработку подсказки или промаха перед показом финала.
      await Promise.resolve();
    }
    await machine.send(event);
  }

  function renderGame() {
    debugControls.hidden = !debugMode || gameState.status !== "searching";
    livesCounter.hidden = gameState.status === "intro";
    lifeIcons.forEach((icon, index) => {
      icon.src = index >= totalAttempts - gameState.lives ? "assets/heart.svg" : "assets/heart-outline.svg";
    });
    progressCounter.hidden = gameState.status === "intro";
    const foundCount = gameState.selectedObjectIndex
      + Number(gameState.status === "item_found" || gameState.status === "all_found");
    progressIcons.forEach((icon, index) => {
      icon.src = index < foundCount ? "assets/star.svg" : "assets/star-outline.svg";
    });
    image.hidden = gameState.status === "intro";
    debugOverlay.toggleAttribute("hidden", !debugMode || gameState.status === "intro");
    Array.from(debugOverlay.children).forEach((polygon, index) => {
      polygon.classList.toggle("is-current",
        gameState.status === "searching" && index === gameState.selectedObjectIndex);
    });
    hintPanel.hidden = gameState.status !== "searching";
    hintPanel.textContent = scene.objects[gameState.selectedObjectIndex].hint;
  }

  function fadeScene(from, to) {
    return stage.animate([{ opacity: from }, { opacity: to }], {
      duration: 1000,
      easing: "ease-in-out",
      fill: "forwards"
    }).finished;
  }

  async function handleStateChange(event) {
    renderGame();

    switch (gameState.status) {
      case "welcome":
        await fadeScene(0, 1);
        await showModal(texts.welcome.title, texts.welcome.message, texts.welcome.button);
        await machine.send("START");
        break;
      case "searching":
        if (event === "START" || event === "CONTINUE") {
          hintPanel.hidden = true;
          const object = scene.objects[gameState.selectedObjectIndex];
          await showModal(texts.hint.title, object.hint, texts.hint.button);
          hintPanel.hidden = false;
        } else if (event === "MISS") {
          await showModal(texts.miss.title, texts.miss.message, texts.miss.button);
        }
        break;
      case "item_found": {
        const object = scene.objects[gameState.selectedObjectIndex];
        await showModal(object.name, object.foundText, object.foundButton);
        await machine.send("CONTINUE");
        break;
      }
      case "all_found":
        await showModal(texts.all_found.title, texts.all_found.message, texts.all_found.button);
        await fadeScene(1, 0);
        if (victoryUrl) window.location.assign(victoryUrl);
        break;
      case "out_of_lives":
        await showModal(texts.out_of_lives.title, texts.out_of_lives.message, texts.out_of_lives.button);
        await fadeScene(1, 0);
        window.location.reload();
        break;
    }
  }

  const areas = scene.objects.map((object, index) => {
    const area = document.createElement("area");
    area.shape = "poly";
    area.addEventListener("click", () => {
      if (index < gameState.selectedObjectIndex) return;
      machine.send(index === gameState.selectedObjectIndex ? "HIT" : "MISS");
    });
    map.append(area);
    return { area, polygon: object.polygon };
  });

  // Клики по area обрабатываются отдельно и не всплывают в соседний img.
  image.addEventListener("click", () => machine.send("MISS"));

  function resizeMap() {
    const scale = Math.min(
      viewport.clientWidth / scene.image.width,
      viewport.clientHeight / scene.image.height
    );

    stage.style.width = `${scene.image.width * scale}px`;
    stage.style.height = `${scene.image.height * scale}px`;

    // polygon: [x, y] в пикселях исходной картинки.
    // Начало — левый верхний угол; x растёт вправо, y — вниз.
    for (const { area, polygon } of areas) {
      area.coords = polygon
        .flatMap(([x, y]) => [Math.round(x * scale), Math.round(y * scale)])
        .join(",");
    }
  }

  resizeMap();
  new ResizeObserver(resizeMap).observe(viewport);
  renderGame();
  await showModal(texts.intro.title, texts.intro.message, texts.intro.button);
  await image.decode();
  await machine.send("CONTINUE");
}

const textsResponse = await fetch("text.json");
const texts = await textsResponse.json();

initializeScene();
