const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;
const POLL_INTERVAL_MS = 1000; 
const POLL_TIMEOUT_MS = 8000;

function handleFileSelected(file) {
  if (!file) return;

  // validate the file type and size before proceeding. If the file is invalid, set the state to ERROR with an appropriate message.
  if (!ACCEPTED_TYPES.includes(file.type)) {
    setState({ phase: UploadPhase.ERROR, errorMessage: "Only JPEG and PNG images are supported." });
    return;
  }
  if (file.size > MAX_SIZE_BYTES) {
    setState({ phase: UploadPhase.ERROR, errorMessage: "Image must not exceed 10 MB." });
    return;
  }

  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);

  // If the file is valid, update the state to SELECTED, store the selected file, and create a preview URL for display.
  setState({
    phase: UploadPhase.SELECTED,
    selectedFile: file,
    previewUrl: URL.createObjectURL(file),
    errorMessage: null,
  });
}

async function handleProcessClick() {
  // Prevent multiple submissions and ensure a file is selected before proceeding. 
  // If the state indicates that a submission is already in progress or no file is selected, exit early.
  if (state.isSubmitting) return;
  if (!state.selectedFile) return;

  state.isSubmitting = true; // set synchronously, before the button is even disabled

  // Start fresh: stop polling the previous job and clear its job card and
  // variant results before the new upload begins.
  stopObserving();
  resetJobState();

  setState({ phase: UploadPhase.UPLOADING, errorMessage: null });

  try {
    const result = await submitImage(state.selectedFile);
    setState({ phase: UploadPhase.ACCEPTED, acceptedImage: result });
    startObservingJob(result);
  } catch (err) {
    // If an error occurs during the submission process, update the state to ERROR and display the error message to the user.
    setState({ phase: UploadPhase.ERROR, errorMessage: err.message });
  } finally {
    state.isSubmitting = false;
  }
}

// Starts polling the server for job status updates. If a job already exists, it will continue polling until the job is completed or an error occurs.
let observationController = null; 

// Starts polling the server for job status updates. If a job already exists, it will continue polling until the job is completed or an error occurs.
function stopObserving() {
  if (observationController) {
    observationController.abort();
    observationController = null;
  }
}

// Starts polling the server for job status updates. If a job already exists, it will continue polling until the job is completed or an error occurs.
function startObservingJob(accepted) {
  stopObserving();
  observationController = new AbortController();

  setJobState({
    job: {
      id: accepted.job_id,
      imageId: accepted.image_id,
      status: accepted.status,
      queuedAt: null,
      startedAt: null,
      completedAt: null,
      variants: [],
      error: null,
    },
    polling: true,
    retrievalError: false,
  });

  runPollLoop(accepted.status_url, observationController);
}

// Polls the server for job status updates in a loop until the job is completed or an error occurs. Each poll has a timeout, and if the server does not respond in time, it will be treated as a retrieval error.
function fetchWithTimeout(url, parentSignal, timeoutMs) {
  const localController = new AbortController();
  const timeoutId = setTimeout(() => localController.abort(new Error("timeout")), timeoutMs);

  const onParentAbort = () => localController.abort(parentSignal.reason);
  parentSignal.addEventListener("abort", onParentAbort, { once: true });

  const cleanup = () => {
    clearTimeout(timeoutId);
    parentSignal.removeEventListener("abort", onParentAbort);
  };

  return fetchJobStatus(url, localController.signal).finally(cleanup);
}

// Polls the server for job status updates in a loop until the job is completed or an error occurs. Each poll has a timeout, and if the server does not respond in time, it will be treated as a retrieval error.
function sleep(ms, signal) {
  return new Promise((resolve) => {
    const t = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(t);
        resolve();
      },
      { once: true }
    );
  });
}

async function runPollLoop(statusUrl, controller) {
  while (!controller.signal.aborted) {
    let data;
    try {
      data = await fetchWithTimeout(statusUrl, controller.signal, POLL_TIMEOUT_MS);
    } catch (err) {
      if (controller.signal.aborted) return; // POLL-06: cancelled on purpose, not a retrieval error
      // retrieval error, show the last known state and an error message until the user clicks "Try again" or a new job starts
      setJobState({ polling: false, retrievalError: true });
      return;
    }

    // A response that lands after this loop was cancelled (e.g. a new upload
    // started) belongs to a stale job and must not touch the UI.
    if (controller.signal.aborted) return;

    setJobState({
      job: {
        id: data.id,
        imageId: data.image_id,
        status: data.status,
        queuedAt: data.queued_at,
        startedAt: data.started_at,
        completedAt: data.completed_at,
        variants: data.variants || [],
        error: data.error || null,
      },
      retrievalError: false,
    });

    if (data.status === "completed" || data.status === "failed") {
      setJobState({ polling: false }); // POLL-05
      return;
    }

    await sleep(POLL_INTERVAL_MS, controller.signal);
  }
}

// Handles the "Try again" button click by restarting the polling loop for the current job. If no job exists, it does nothing.
function handleTryAgain() {
  if (!jobState.job) return;
  const statusUrl = `/v1/jobs/${jobState.job.id}`;

  stopObserving();
  observationController = new AbortController();
  setJobState({ retrievalError: false, polling: true });
  runPollLoop(statusUrl, observationController);
}

document.getElementById("file-input").addEventListener("change", (e) => {
  handleFileSelected(e.target.files[0]);
  e.target.value = ""; // allow re-selecting the same file later
});

document.getElementById("file-input-replace").addEventListener("change", (e) => {
  handleFileSelected(e.target.files[0]);
  e.target.value = "";
});

document.getElementById("process-button").addEventListener("click", handleProcessClick);
document.getElementById("try-again-button").addEventListener("click", handleTryAgain);

// Ensure that polling is stopped when the user navigates away from the page to avoid unnecessary network requests and potential memory leaks.
window.addEventListener("beforeunload", stopObserving);

events.on("change", () => render(state, jobState));
events.on("jobChange", () => render(state, jobState));
render(state, jobState);