"use strict";

const STORAGE_KEY = "student-record-demo:profile:v1";
const infoDialog = document.querySelector("#info-dialog");
const editor = document.querySelector("#editor-dialog");
const form = document.querySelector("#editor-form");
const editorFields = document.querySelector("#editor-fields");
const editorStatus = document.querySelector("#editor-status");
const saveButton = document.querySelector("#save-edit");
const openEditorButton = document.querySelector("#open-editor");
const hideEditorCheckbox = document.querySelector("#hide-editor-entry");
const photoSlots = ["admission", "graduation"];
const textNodes = [...document.querySelectorAll("[data-field]")];
const limits = Object.fromEntries(textNodes.map((node) => [node.dataset.field,
  node.dataset.field === "footerNote" ? 300 : node.dataset.field.endsWith("Label") ? 30 : 100]));
const defaults = {
  version: 1,
  text: Object.fromEntries(textNodes.map((node) => [node.dataset.field, node.textContent])),
  photos: { admission: "", graduation: "" },
  ui: { hideEditor: false },
};
const placeholders = Object.fromEntries(photoSlots.map((slot) => [slot,
  document.querySelector(`[data-photo="${slot}"] svg`).cloneNode(true)]));
const clone = (data) => JSON.parse(JSON.stringify(data));
let current = clone(defaults);
let draft = null;
let pendingUploads = new Map();
let photoMessages = new Map();
let triggerButton;
let toastTimeout;

function notify(message) {
  const toast = document.querySelector("#toast");
  toast.textContent = message;
  toast.hidden = false;
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => { toast.hidden = true; }, 4500);
}

function validateStored(data) {
  if (!data || data.version !== 1 || !data.text || !data.photos) throw new Error("Invalid saved data");
  const result = clone(defaults);
  result.ui.hideEditor = data.ui?.hideEditor === true;
  for (const key of Object.keys(defaults.text)) {
    if (typeof data.text[key] !== "string" || data.text[key].length > limits[key]) throw new Error("Invalid text");
    result.text[key] = data.text[key];
  }
  for (const slot of photoSlots) {
    const photo = data.photos[slot];
    if (typeof photo !== "string" || photo.length > 2000000 || (photo && !/^data:image\/jpeg;base64,[A-Za-z0-9+/=]+$/.test(photo))) throw new Error("Invalid photo");
    result.photos[slot] = photo;
  }
  return result;
}

function paintPhoto(container, source, label, placeholder) {
  container.replaceChildren();
  if (source) {
    const image = new Image();
    image.src = source;
    image.alt = label;
    container.append(image);
  } else if (placeholder) {
    container.append(placeholder.cloneNode(true));
  } else {
    const hint = document.createElement("span");
    hint.textContent = "暂无照片";
    container.append(hint);
  }
}

function renderPage() {
  openEditorButton.hidden = current.ui.hideEditor;
  textNodes.forEach((node) => { node.textContent = current.text[node.dataset.field]; });
  document.title = `${current.text.title || "学籍档案"} · 非官方演示`;
  photoSlots.forEach((slot) => {
    const container = document.querySelector(`[data-photo="${slot}"]`);
    const caption = current.text[`${slot}Caption`] || "照片";
    container.setAttribute("aria-label", current.photos[slot] ? caption : `${caption}占位图`);
    paintPhoto(container, current.photos[slot], caption, placeholders[slot]);
  });
}

try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) current = validateStored(JSON.parse(saved));
} catch {
  notify("未能读取本地资料，当前显示初始内容。");
}
renderPage();

function setEditorStatus(message, error = false) {
  editorStatus.textContent = message;
  editorStatus.classList.toggle("is-error", error);
}

function inputField(key, labelText) {
  const label = document.createElement("label");
  label.className = "editor-field";
  const title = document.createElement("span");
  title.textContent = labelText;
  const input = document.createElement(key === "footerNote" ? "textarea" : "input");
  if (input.tagName === "INPUT") input.type = "text";
  else input.rows = 3;
  input.name = key;
  input.id = `edit-${key}`;
  input.value = draft.text[key];
  input.maxLength = limits[key];
  input.autocomplete = "off";
  input.spellcheck = false;
  input.addEventListener("input", () => { if (draft) draft.text[key] = input.value; });
  label.append(title, input);
  return label;
}

function group(title) {
  const fieldset = document.createElement("fieldset");
  const legend = document.createElement("legend");
  legend.textContent = title;
  fieldset.append(legend);
  editorFields.append(fieldset);
  return fieldset;
}

function renderEditorFields() {
  editorFields.replaceChildren();
  const basic = group("基本信息");
  const basicGrid = document.createElement("div");
  basicGrid.className = "field-grid";
  for (const [key, label] of [["name", "姓名"], ["gender", "性别"], ["birthday", "出生日期"], ["school", "学校"], ["degree", "学历层次"], ["major", "专业"], ["studyMode", "学习形式"]]) {
    basicGrid.append(inputField(key, label));
  }
  basic.append(basicGrid);

  const details = group("学籍详情");
  const hint = document.createElement("p");
  hint.className = "field-hint";
  hint.textContent = "左侧是字段名称，右侧是内容；都可以修改。";
  details.append(hint);
  for (const key of ["ethnicity", "idNumber", "duration", "category", "college", "department", "className", "studentNumber", "enrollment", "status", "graduationDate"]) {
    const row = document.createElement("div");
    row.className = "detail-editor-row";
    row.append(inputField(`${key}Label`, `${defaults.text[`${key}Label`]} · 名称`), inputField(key, `${defaults.text[`${key}Label`]} · 内容`));
    details.append(row);
  }

  const wording = group("页面文字");
  for (const [key, label] of [["title", "页面标题"], ["admissionCaption", "录取照片下方文字"], ["graduationCaption", "学历照片下方文字"], ["reportButton", "主按钮文字"], ["footerNote", "底部文字"]]) {
    wording.append(inputField(key, label));
  }
  const note = document.createElement("p");
  note.className = "field-hint";
  note.textContent = "页面顶部的“非官方演示页面”标识固定保留。";
  wording.append(note);
}

function renderPhotoPreviews() {
  photoSlots.forEach((slot) => {
    paintPhoto(document.querySelector(`#${slot}-preview`), draft.photos[slot], `${slot === "admission" ? "录取" : "学历"}照片预览`);
    document.querySelector(`[data-remove="${slot}"]`).disabled = !draft.photos[slot] && !pendingUploads.has(slot);
    const status = document.querySelector(`[data-photo-status="${slot}"]`);
    const message = photoMessages.get(slot);
    status.textContent = message?.text || "";
    status.hidden = !message;
    status.classList.toggle("is-error", Boolean(message?.error));
  });
  saveButton.disabled = pendingUploads.size > 0;
}

function openEditor() {
  draft = clone(current);
  pendingUploads = new Map();
  photoMessages = new Map();
  form.reset();
  hideEditorCheckbox.checked = draft.ui.hideEditor;
  renderEditorFields();
  renderPhotoPreviews();
  setEditorStatus("修改后点击“保存并展示”。");
  editor.showModal();
  document.body.classList.add("dialog-open");
  document.querySelector(".editor-body").scrollTop = 0;
}
openEditorButton.addEventListener("click", openEditor);
document.querySelector("#edit-from-info").addEventListener("click", () => {
  // Wait until the first modal has completed its close/focus lifecycle.
  infoDialog.addEventListener("close", openEditor, { once: true });
  infoDialog.close();
});

function discardDraft() {
  draft = null;
  pendingUploads.clear();
  editor.close();
}
document.querySelectorAll("[data-cancel-edit]").forEach((button) => button.addEventListener("click", discardDraft));
editor.addEventListener("cancel", (event) => { event.preventDefault(); discardDraft(); });
editor.addEventListener("close", () => {
  draft = null;
  pendingUploads.clear();
  if (!infoDialog.open && !editor.open) {
    document.body.classList.remove("dialog-open");
    const focusTarget = openEditorButton.hidden ? document.querySelector(".about-button") : openEditorButton;
    focusTarget.focus({ preventScroll: true });
  }
});

async function preparePhoto(file) {
  if (file.size > 20 * 1024 * 1024) throw new Error("照片超过 20 MB，请选择较小的图片。");
  if (file.type === "image/svg+xml" || !/\.(jpe?g|png|webp|avif|gif|heic|heif)$/i.test(file.name) && !/^image\/(jpeg|png|webp|avif|gif|heic|heif)$/.test(file.type)) {
    throw new Error("请选择 JPG、PNG 或 WebP 格式的照片。");
  }
  const objectUrl = URL.createObjectURL(file);
  try {
    const source = new Image();
    await new Promise((resolve, reject) => {
      source.onload = resolve;
      source.onerror = () => reject(new Error("无法读取这张照片。若为 HEIC，请转为 JPG 或 PNG 后重试。"));
      source.src = objectUrl;
    });
    const scale = Math.min(1, 960 / Math.max(source.naturalWidth, source.naturalHeight));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(source.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(source.naturalHeight * scale));
    const context = canvas.getContext("2d");
    if (!context) throw new Error("当前浏览器无法处理照片，请更换浏览器重试。");
    context.fillStyle = "#fff";
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(source, 0, 0, canvas.width, canvas.height);
    const result = canvas.toDataURL("image/jpeg", 0.85);
    if (result.length > 2000000) throw new Error("照片处理后仍过大，请选择较小的图片。");
    return result;
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}

document.querySelectorAll("[data-upload]").forEach((input) => {
  input.addEventListener("change", async () => {
    const file = input.files[0];
    if (!file || !draft) return;
    const slot = input.dataset.upload;
    const editingDraft = draft;
    const token = {};
    pendingUploads.set(slot, token);
    photoMessages.set(slot, { text: "正在处理…" });
    renderPhotoPreviews();
    setEditorStatus("正在处理照片…");
    try {
      const photo = await preparePhoto(file);
      if (draft !== editingDraft || pendingUploads.get(slot) !== token) return;
      draft.photos[slot] = photo;
      photoMessages.set(slot, { text: "照片已就绪" });
    } catch (error) {
      if (draft === editingDraft && pendingUploads.get(slot) === token) photoMessages.set(slot, { text: error.message, error: true });
    } finally {
      if (draft === editingDraft && pendingUploads.get(slot) === token) {
        pendingUploads.delete(slot);
        input.value = "";
        renderPhotoPreviews();
        const hasError = [...photoMessages.values()].some((message) => message.error);
        setEditorStatus(pendingUploads.size ? "仍在处理照片…" : hasError ? "有照片未能处理，请查看照片下方提示。" : "照片已就绪，点击保存后生效。", hasError);
      }
    }
  });
});

document.querySelectorAll("[data-remove]").forEach((button) => {
  button.addEventListener("click", () => {
    if (!draft) return;
    const slot = button.dataset.remove;
    pendingUploads.delete(slot);
    photoMessages.delete(slot);
    draft.photos[slot] = "";
    document.querySelector(`[data-upload="${slot}"]`).value = "";
    renderPhotoPreviews();
    setEditorStatus("照片已移除，点击保存后生效。");
  });
});

document.querySelector("#reset-draft").addEventListener("click", () => {
  draft = clone(defaults);
  pendingUploads.clear();
  photoMessages.clear();
  form.reset();
  hideEditorCheckbox.checked = draft.ui.hideEditor;
  renderEditorFields();
  renderPhotoPreviews();
  setEditorStatus("已恢复初始内容，点击保存后生效。取消可放弃这次恢复。");
});

form.addEventListener("submit", (event) => {
  event.preventDefault();
  if (!draft || pendingUploads.size) return;
  // Include browser autofill and the latest IME composition when saving.
  for (const key of Object.keys(defaults.text)) draft.text[key] = form.elements.namedItem(key).value;
  draft.ui.hideEditor = hideEditorCheckbox.checked;
  let next;
  try {
    next = validateStored(draft);
    localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  } catch {
    setEditorStatus("保存失败：浏览器存储不可用或空间不足。修改仍保留在这里，可移除照片后重试，或换用普通浏览窗口。", true);
    return;
  }
  current = next;
  renderPage();
  draft = null;
  editor.close();
  notify(current.ui.hideEditor ? "已保存并隐藏编辑入口。再次编辑请点右上角 ⋯。" : "已保存到当前浏览器。");
});

document.querySelectorAll("[data-open-info]").forEach((button) => {
  button.addEventListener("click", () => {
    triggerButton = button;
    infoDialog.showModal();
    document.body.classList.add("dialog-open");
  });
});

infoDialog.addEventListener("close", () => {
  if (!editor.open && !infoDialog.open) {
    document.body.classList.remove("dialog-open");
    triggerButton?.focus({ preventScroll: true });
  }
});

infoDialog.addEventListener("click", (event) => {
  if (event.target !== infoDialog) return;
  const bounds = infoDialog.getBoundingClientRect();
  const outside = event.clientX < bounds.left || event.clientX > bounds.right ||
    event.clientY < bounds.top || event.clientY > bounds.bottom;
  if (outside) infoDialog.close();
});
