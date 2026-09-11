package main

import (
	"errors"
	"net/http"

	"github.com/AlexG-SYS/Test1_ImageProcessing_AlexG_ReeneB/internal/data"
)

// getJobHandler retrieves a job by its public ID and returns its details in JSON format.
func (app *application) getJobHandler(w http.ResponseWriter, r *http.Request) {
	job, err := app.models.Jobs.GetByPublicID(r.PathValue("id"))
	if err != nil {
		if errors.Is(err, data.ErrRecordNotFound) {
			app.notFoundResponse(w, r)
			return
		}
		app.serverErrorResponse(w, r, err)
		return
	}

	response := envelope{
		"id":           job.PublicID,
		"image_id":     job.ImageID, // overwritten below with the public ID
		"status":       job.Status,
		"queued_at":    job.QueuedAt,
		"started_at":   job.StartedAt,
		"completed_at": job.CompletedAt,
	}

	// Retrieve the image associated with the job to get its public ID
	img, err := app.models.Images.GetByID(job.ImageID)
	if err != nil {
		app.serverErrorResponse(w, r, err)
		return
	}
	response["image_id"] = img.PublicID

	// If the job has failed, include the error message in the response.
	if job.Status == "failed" && job.ErrorMessage != nil {
		response["error"] = *job.ErrorMessage
	}

	// If the job is completed, retrieve the variants associated with the image and include them in the response.
	if job.Status == "completed" {
		variants, err := app.models.Variants.ListByImageID(job.ImageID, img.PublicID)
		if err != nil {
			app.serverErrorResponse(w, r, err)
			return
		}
		response["variants"] = variants
	}

	if err := app.writeJSON(w, http.StatusOK, response, nil); err != nil {
		app.serverErrorResponse(w, r, err)
	}
}
