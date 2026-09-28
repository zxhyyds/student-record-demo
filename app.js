"use strict";

const infoDialog = document.querySelector("#info-dialog");
let triggerButton;

document.querySelectorAll("[data-open-info]").forEach((button) => {
  button.addEventListener("click", () => {
    triggerButton = button;
    infoDialog.showModal();
    document.body.classList.add("dialog-open");
  });
});

infoDialog.addEventListener("close", () => {
  document.body.classList.remove("dialog-open");
  triggerButton?.focus({ preventScroll: true });
});

infoDialog.addEventListener("click", (event) => {
  if (event.target !== infoDialog) return;
  const bounds = infoDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) infoDialog.close();
});
