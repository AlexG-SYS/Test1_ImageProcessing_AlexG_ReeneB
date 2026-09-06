const ACCEPTED_TYPES = ["image/jpeg", "image/png"];
const MAX_SIZE_BYTES = 10 * 1024 * 1024;

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
  setState({ phase: UploadPhase.UPLOADING, errorMessage: null });

  try {
    const result = await submitImage(state.selectedFile);
    setState({ phase: UploadPhase.ACCEPTED, acceptedImage: result });
  } catch (err) {
    // If an error occurs during the submission process, update the state to ERROR and display the error message to the user.
    setState({ phase: UploadPhase.ERROR, errorMessage: err.message });
  } finally {
    state.isSubmitting = false;
  }
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

events.on("change", render);
render(state); 
