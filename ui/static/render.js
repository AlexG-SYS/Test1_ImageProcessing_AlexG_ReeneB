// render() is the only place that touches the DOM. It is called once on
// load and again every time state.js emits "change"
// it never runs on a timer and never runs from inside app.js's event handlers directly.
const dom = {
  emptyState: document.getElementById("empty-state"),
  previewState: document.getElementById("preview-state"),
  previewImage: document.getElementById("preview-image"),
  previewName: document.getElementById("preview-name"),
  previewSize: document.getElementById("preview-size"),
  previewType: document.getElementById("preview-type"),
  processButton: document.getElementById("process-button"),
  uploadError: document.getElementById("upload-error"),
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function render(current) {
  const hasSelection = current.phase !== UploadPhase.IDLE && current.selectedFile;

  dom.emptyState.hidden = hasSelection;
  dom.previewState.hidden = !hasSelection;

  if (hasSelection) {
    dom.previewImage.src = current.previewUrl;
    dom.previewName.textContent = current.selectedFile.name;
    dom.previewSize.textContent = formatBytes(current.selectedFile.size);
    dom.previewType.textContent = current.selectedFile.type || "unknown";
  }

  // disabled + relabeled only while the POST is actually in flight.
 if (current.phase === UploadPhase.UPLOADING) {
  dom.processButton.disabled = true;
  dom.processButton.textContent = "Uploading...";
  } else if (current.phase === UploadPhase.ACCEPTED) {
  dom.processButton.disabled = true;
  dom.processButton.textContent = "Choose another image to process";
  } else {
  dom.processButton.disabled = !hasSelection;
  dom.processButton.textContent = "Process image";
  }

  if (current.phase === UploadPhase.ERROR && current.errorMessage) {
    dom.uploadError.hidden = false;
    dom.uploadError.textContent = current.errorMessage;
  } else {
    dom.uploadError.hidden = true;
  }


}
