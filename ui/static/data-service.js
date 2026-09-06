// Submits an image file to the server and returns the response.
async function submitImage(file) {
  const formData = new FormData();
  formData.append("image", file);

  const response = await fetch("/v1/images", {
    method: "POST",
    body: formData,
  });

  let body = null;
  try {
    body = await response.json();
  } catch {
    // A non-JSON body on failure still falls through to the status check below.
  }

  if (!response.ok) {
    const message =
      (body && typeof body.error === "string" && body.error) ||
      `Upload failed (HTTP ${response.status})`;
    throw new Error(message);
  }

  return body;
}
