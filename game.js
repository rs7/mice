import { createGameMachine } from "./fsm.js";

const debugMode = new URLSearchParams(window.location.search).get("debug") === "1";

const gameState = {
  status: "intro",
  lives: 3,
  selectedObjectIndex: 0
};

const livesCounter = document.querySelector(".lives-counter");
const modalLayer = document.querySelector(".modal-layer");
const modal = document.querySelector(".modal");
const modalText = document.querySelector(".modal-text");
const modalNext = document.querySelector(".modal-next");

const lifeIcons = Array.from({ length: gameState.lives }, () => {
  const icon = document.createElement("img");
  icon.classList.add("lives-icon");
  icon.draggable = false;
  livesCounter.append(icon);
  return icon;
});

function renderLives() {
  livesCounter.hidden = gameState.status === "intro";
  lifeIcons.forEach((icon, index) => {
    icon.src = index < gameState.lives ? "assets/heart.svg" : "assets/heart-outline.svg";
  });
}

function showModal(message, buttonText) {
  return new Promise((resolve) => {
    modalText.textContent = message;
    modalNext.textContent = buttonText;
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
  const image = document.querySelector(".scene-image");
  const map = document.querySelector("#scene-map");
  const debugOverlay = document.querySelector(".debug-overlay");
  const hintPanel = document.querySelector(".hint-panel");
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
    renderLives();
    image.hidden = gameState.status === "intro";
    debugOverlay.toggleAttribute("hidden", !debugMode || gameState.status === "intro");
    hintPanel.hidden = gameState.status !== "searching";
    hintPanel.textContent = scene.objects[gameState.selectedObjectIndex].hint;
  }

  async function handleStateChange(event) {
    renderGame();

    switch (gameState.status) {
      case "welcome":
        await showModal(texts.welcome.message, texts.welcome.button);
        await machine.send("START");
        break;
      case "searching":
        if (event === "START" || event === "CONTINUE") {
          hintPanel.hidden = true;
          const object = scene.objects[gameState.selectedObjectIndex];
          await showModal(object.hint, texts.hint.button);
          hintPanel.hidden = false;
        } else if (event === "MISS") {
          await showModal(texts.miss.message, texts.miss.button);
        }
        break;
      case "item_found": {
        const object = scene.objects[gameState.selectedObjectIndex];
        const title = texts.item_found.message.replace("{name}", object.name.toUpperCase());
        await showModal(`${title}\n\n${object.foundText}`, object.foundButton);
        await machine.send("CONTINUE");
        break;
      }
      case "all_found":
        await showModal(texts.all_found.message, texts.all_found.button);
        break;
      case "out_of_lives":
        await showModal(texts.out_of_lives.message, texts.out_of_lives.button);
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

    // Размер самого img совпадает с видимой картинкой, без чёрных полос.
    image.style.width = `${scene.image.width * scale}px`;
    image.style.height = `${scene.image.height * scale}px`;
    debugOverlay.style.width = image.style.width;
    debugOverlay.style.height = image.style.height;

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
  await showModal(texts.intro.message, texts.intro.button);
  await machine.send("CONTINUE");
}

renderLives();

const textsResponse = await fetch("text.json");
const texts = await textsResponse.json();

initializeScene();
