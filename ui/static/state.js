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
