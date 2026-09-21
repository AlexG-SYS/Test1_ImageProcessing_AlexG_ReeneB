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

  jobEmpty: document.getElementById("job-empty"),
  jobActive: document.getElementById("job-active"),
  jobIdLabel: document.getElementById("job-id-label"),
  jobStatusBadge: document.getElementById("job-status-badge"),
  pollingIndicator: document.getElementById("polling-indicator"),
  jobRetrievalError: document.getElementById("job-retrieval-error"),
  timeline: {
    accepted: document.getElementById("timeline-accepted"),
    stored: document.getElementById("timeline-stored"),
    generating: document.getElementById("timeline-generating"),
    complete: document.getElementById("timeline-complete"),
  },

  resultsEmpty: document.getElementById("results-empty"),
  resultsProcessing: document.getElementById("results-processing"),
  resultsFailed: document.getElementById("results-failed"),
  resultsFailedMessage: document.getElementById("results-failed-message"),
  resultsGrid: document.getElementById("results-grid"),
};

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function render(current, job) {
  renderUploadCard(current, job);
  renderJobCard(job);
  renderResultsCard(job);
}

function renderUploadCard(current, job) {
  const hasSelection = current.phase !== UploadPhase.IDLE && current.selectedFile;

  dom.emptyState.hidden = hasSelection;
  dom.previewState.hidden = !hasSelection;

  if (hasSelection) {
    dom.previewImage.src = current.previewUrl;
    dom.previewName.textContent = current.selectedFile.name;
    dom.previewSize.textContent = formatBytes(current.selectedFile.size);
    dom.previewType.textContent = current.selectedFile.type || "unknown";
  }

  // disabled + relabeled while the POST is actually in flight.
  // Also disabled once ACCEPTED — state.selectedFile still points at the
  // File object that was just submitted, so a second click here would
  // silently resubmit the exact same bytes as a brand-new job unless the
  // user genuinely picks something new via "Choose another image" first.
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

function renderJobCard(job) {
  const hasJob = !!job.job;

  dom.jobEmpty.hidden = hasJob; //"No active job" only when there truly is none
  dom.jobActive.hidden = !hasJob;
  if (!hasJob) return;

  // job ID and current status, always shown once a job exists.
  dom.jobIdLabel.textContent = `Job #${job.job.id.slice(0, 8)}`;
  dom.jobStatusBadge.textContent = job.job.status;
  dom.jobStatusBadge.className = `status-badge status-badge--${job.job.status}`;

  // Timeline steps: accepted/stored/generating/complete. The first two are
  // always complete once a job exists, the last two are active/pending/error
  // depending on the job's current status.
  setTimelineStep(dom.timeline.accepted, "complete");
  setTimelineStep(dom.timeline.stored, "complete");

  const isFailed = job.job.status === "failed";
  const isTerminal = job.job.status === "completed" || isFailed;

  if (job.job.status === "completed") {
    setTimelineStep(dom.timeline.generating, "complete");
    setTimelineStep(dom.timeline.complete, "complete");
  } else if (isFailed) {
    setTimelineStep(dom.timeline.generating, "error");
    setTimelineStep(dom.timeline.complete, "error");
  } else {
    setTimelineStep(dom.timeline.generating, "active");
    setTimelineStep(dom.timeline.complete, "pending");
  }

  // The final step must not read "Complete" when the job failed.
  dom.timeline.complete.textContent = isFailed ? "Failed" : "Complete";

  // Polling indicator is shown only while the 1-second loop is running, and
  // never once the job has reached a terminal state (completed or failed).
  dom.pollingIndicator.hidden = !job.polling || isTerminal;

  // Retrieval error message is shown only after a failed GET, until the user clicks "Try again" or a new job starts
  dom.jobRetrievalError.hidden = !job.retrievalError;
}

// Sets a timeline step's data-state attribute to "complete", "active", "pending", or "error".
function setTimelineStep(el, state) {
  el.dataset.state = state; 
}

function renderResultsCard(job) {
  const status = job.job ? job.job.status : null;

  // The four possible states of the results card are mutually exclusive, so we can just hide/show them based on the job's current status.
  dom.resultsEmpty.hidden = status !== null;
  dom.resultsProcessing.hidden = !(status === "queued" || status === "processing");
  dom.resultsFailed.hidden = status !== "failed";
  dom.resultsGrid.hidden = status !== "completed";

  // If the job has failed, show the server-provided error message if available, otherwise a generic fallback.
  if (status === "failed") {
    dom.resultsFailedMessage.textContent = job.job.error || "Processing failed.";
  }

  if (status === "completed") {
    renderVariants(job.job.variants);
  } else {
    // Never leave a previous job's variant cards in the DOM.
    dom.resultsGrid.replaceChildren();
  }
}

// Renders the grid of variant cards for a completed job. Each card contains an image, metadata, and links to view/download the variant.
function renderVariants(variants) {
  dom.resultsGrid.innerHTML = ""; 

  // Create a card for each variant and append it to the results grid.
  for (const variant of variants) {
    const card = document.createElement("div");
    card.className = "variant-card";

    const img = document.createElement("img");
    img.src = variant.url;
    img.alt = `${variant.name} variant`;
    card.appendChild(img);

    const meta = document.createElement("p");
    meta.className = "variant-meta";
    meta.textContent = `${variant.name} \u2014 ${variant.width}\u00d7${variant.height}`;
    card.appendChild(meta);

    const actions = document.createElement("div");
    actions.className = "variant-actions";

    const viewLink = document.createElement("a");
    viewLink.href = variant.url;
    viewLink.target = "_blank";
    viewLink.rel = "noopener";
    viewLink.textContent = "View";
    actions.appendChild(viewLink);

    const downloadLink = document.createElement("a");
    downloadLink.href = variant.url;
    downloadLink.download = variant.name;
    downloadLink.textContent = "Download";
    actions.appendChild(downloadLink);

    card.appendChild(actions);
    dom.resultsGrid.appendChild(card);
  }
}