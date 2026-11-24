const modalLayer = document.querySelector(".modal-layer");
const modal = document.querySelector(".modal");
const modalTitle = document.querySelector(".modal-title");
const modalText = document.querySelector(".modal-text");
const modalActions = document.querySelector(".modal-actions");
const modalButtonTemplate = document.querySelector("#modal-button-template");

export function showModal({ title, message, createButtons }) {
  return new Promise((resolve) => {
    modalTitle.textContent = title;
    modalTitle.hidden = title === "";
    modalText.replaceChildren(message);
    const finish = (value) => {
      modalLayer.hidden = true;
      modalActions.replaceChildren();
      resolve(value);
    };
    modalActions.replaceChildren(...createButtons(finish));
    modalLayer.hidden = false;
    modal.scrollTop = 0;
  });
}

export function createButton(label, onClick) {
  const button = modalButtonTemplate.content.firstElementChild.cloneNode(true);
  button.textContent = label;
  button.addEventListener("click", onClick);
  return button;
}
