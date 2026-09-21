// Single source of truth for the upload flow's UI state. Nothing else in
// the app holds its own copy of these values 
const UploadPhase = {
  IDLE: "idle", // no file, no job, no results
  SELECTED: "selected", // local preview only, nothing sent yet
  UPLOADING: "uploading", // POST in flight
  ACCEPTED: "accepted", // Terminal state: stored, no job/polling yet
  ERROR: "error", // rejected upload or failed request
};

const events = new EventEmitter();

const state = {
  phase: UploadPhase.IDLE,
  selectedFile: null,
  previewUrl: null,
  isSubmitting: false, // guards against overlapping POSTs from this page
  errorMessage: null,
  acceptedImage: null, // { image_id, original_filename, media_type, size_bytes }
};

function setState(patch) {
  Object.assign(state, patch);
  events.emit("change", state);
}

function resetToIdle() {
  if (state.previewUrl) URL.revokeObjectURL(state.previewUrl);
  setState({
    phase: UploadPhase.IDLE,
    selectedFile: null,
    previewUrl: null,
    errorMessage: null,
    acceptedImage: null,
  });
}

// Single source of truth for the job polling state. Nothing else in the app
// holds its own copy of these values. The job object is null until a job is
// created, and then it is updated with the latest status on each poll.
const jobState = {
  job: null, // { id, imageId, status, queuedAt, startedAt, completedAt, variants, error } once a job exists
  polling: false, // true only while the 1-second loop is actively running 
  retrievalError: false, // true after a failed GET, until Try again or a new job starts 
};

function setJobState(patch) {
  Object.assign(jobState, patch);
  events.emit("jobChange", jobState);
}

function resetJobState() {
  jobState.job = null;
  jobState.polling = false;
  jobState.retrievalError = false;
  events.emit("jobChange", jobState);
}
