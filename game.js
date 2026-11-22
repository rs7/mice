import { createGameMachine } from "./fsm.js";

const gameState = {
  status: "intro",
  lives: 3,
  selectedObjectIndex: 0
};

const livesCounter = document.querySelector(".lives-counter");
const modal = document.querySelector(".modal");
const modalText = document.querySelector(".modal-text");
const modalNext = document.querySelector(".modal-next");

modal.addEventListener("cancel", (event) => event.preventDefault());

const lifeIcons = Array.from({ length: gameState.lives }, () => {
  const icon = document.createElement("img");
  icon.classList.add("lives-icon");
  icon.alt = "";
  icon.draggable = false;
  livesCounter.append(icon);
  return icon;
});

function renderLives() {
  livesCounter.hidden = gameState.status === "intro";
  lifeIcons.forEach((icon, index) => {
    icon.src = index < gameState.lives ? "assets/heart.svg" : "assets/heart-outline.svg";
  });
  livesCounter.setAttribute("aria-label", `Осталось жизней: ${gameState.lives} из ${lifeIcons.length}`);
}

function showModal(message, buttonText = texts.next) {
  return new Promise((resolve) => {
    modalText.textContent = message;
    modalNext.textContent = buttonText;
    modalNext.addEventListener("click", () => {
      modal.close();
      resolve();
    }, { once: true });
    modal.showModal();
  });
}

async function initializeScene() {
  const response = await fetch("objects.json");
  const scene = await response.json();
  const viewport = document.querySelector(".scene-viewport");
  const image = document.querySelector(".scene-image");
  const map = document.querySelector("#scene-map");
  const hintPanel = document.querySelector(".hint-panel");
  const machine = createGameMachine(gameState, scene.objects.length, handleStateChange);

  image.src = scene.image.src;

  function renderGame() {
    renderLives();
    image.hidden = gameState.status === "intro";
    hintPanel.hidden = gameState.status !== "searching";
    hintPanel.textContent = scene.objects[gameState.selectedObjectIndex].hint;
    areas.forEach(({ area }, areaIndex) => {
      const active = gameState.status === "searching" && areaIndex === gameState.selectedObjectIndex;
      if (active) {
        area.href = "#";
      } else {
        area.removeAttribute("href");
      }
      area.setAttribute("aria-disabled", String(!active));
    });
  }

  async function handleStateChange(event) {
    renderGame();

    switch (gameState.status) {
      case "welcome":
        await showModal(texts.welcome);
        await machine.send("START");
        break;
      case "searching":
        if (event === "START" || event === "CONTINUE") {
          await showModal(scene.objects[gameState.selectedObjectIndex].hint);
        } else if (event === "MISS") {
          await showModal(texts.miss);
        }
        break;
      case "item_found": {
        const object = scene.objects[gameState.selectedObjectIndex];
        await showModal(texts.item_found.replace("{name}", object.name));
        await machine.send("CONTINUE");
        break;
      }
      case "all_found":
        await showModal(texts.all_found);
        break;
      case "out_of_lives":
        await showModal(texts.out_of_lives, texts.restart);
        window.location.reload();
        break;
    }
  }

  const areas = scene.objects.map((object, index) => {
    const area = document.createElement("area");
    area.shape = "poly";
    area.alt = object.hint;
    area.tabIndex = -1;
    area.addEventListener("click", (event) => {
      event.preventDefault();
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
  await showModal(texts.intro);
  await machine.send("CONTINUE");
}

renderLives();

const textsResponse = await fetch("text.json");
const texts = await textsResponse.json();

initializeScene();
