package main

import (
	"context"
	"database/sql"
	"errors"
	"fmt"
	"image"
	"image/jpeg"
	"image/png"
	"os"
	"path/filepath"
	"time"

	"github.com/AlexG-SYS/Test1_ImageProcessing_AlexG_ReeneB/internal/data"
)

// startImageWorker launches the single background worker goroutine for
// the life of the process, which polls the database for new image jobs to claim and process. It
// uses a ticker to poll at a regular interval, which is configured in the application config.

// If there are no jobs to claim yet,
// since createImageHandler doesn't create any.
// image transformation, and MarkCompleted/MarkFailed inside the ticker
func (app *application) startImageWorker(ctx context.Context) {
	app.wg.Add(1)
	go func() {
		defer app.wg.Done()
		ticker := time.NewTicker(app.config.workerPollInterval)
		defer ticker.Stop()
		for {
			select {
			case <-ctx.Done():
				app.logger.Info("image worker stopped")
				return
			case <-ticker.C:
				app.logger.Info("image worker polling for jobs")
				err := app.processNextImageJob(ctx)
				if err != nil && !errors.Is(err, data.ErrRecordNotFound) && !errors.Is(err, context.Canceled) {
					app.logger.Error("image worker error", "error", err)
				}
			}
		}
	}()
}

// processNextImageJob claims the next queued job, processes it, and marks it completed or failed.
// It returns an error if there was a problem claiming the job or marking it completed/failed,
// but not if the job itself failed (that is recorded in the database and logged).
func (app *application) processNextImageJob(ctx context.Context) error {
	job, err := app.models.Jobs.ClaimNext(ctx)
	if err != nil {
		return err
	}

	app.logger.Info("image job started", "job_id", job.PublicID)

	// If a processing delay is configured, wait for that duration before starting the actual image processing.
	// This simulates a longer processing time for testing purposes.
	// If the context is canceled during this wait, stop the timer and return the context's error.
	if app.config.processingDelay > 0 {
		timer := time.NewTimer(app.config.processingDelay)
		select {
		case <-ctx.Done():
			timer.Stop()
			return ctx.Err()
		case <-timer.C:
		}
	}

	// Call transformImage to perform the actual image processing. If it returns an error,
	// log the error and mark the job as failed with a safe error message for the client.
	if err := app.transformImage(ctx, job); err != nil {
		app.logger.Error("image job failed", "job_id", job.PublicID, "error", err)
		if markErr := app.models.Jobs.MarkFailed(ctx, job.ID, safeProcessingError(err)); markErr != nil {
			return markErr
		}
		return nil
	}

	if err := app.models.Jobs.MarkCompleted(ctx, job.ID); err != nil {
		return err
	}
	app.logger.Info("image job completed", "job_id", job.PublicID)
	return nil
}

// transformImage retrieves the original image from storage, decodes it, generates the required variants,
// and saves them to storage and the database. It returns an error if any step fails.
func (app *application) transformImage(ctx context.Context, job *data.Job) error {
	img, err := app.models.Images.GetByID(job.ImageID)
	if err != nil {
		return fmt.Errorf("look up image: %w", err)
	}

	srcPath := filepath.Join(app.config.storage.originalsDir, img.StoredFilename)
	srcFile, err := os.Open(srcPath)
	if err != nil {
		return fmt.Errorf("open original: %w", err)
	}
	defer srcFile.Close()

	decoded, _, err := image.Decode(srcFile)
	if err != nil {
		return fmt.Errorf("decode original: %w", err)
	}

	if err := os.MkdirAll(app.config.storage.variantsDir, 0o755); err != nil {
		return fmt.Errorf("prepare variants directory: %w", err)
	}

	for _, spec := range requiredVariants {
		out := generateVariant(decoded, spec)
		bounds := out.Bounds()

		storedFilename, err := randomFilename(extensionFor(img.MediaType))
		if err != nil {
			return fmt.Errorf("generate variant filename: %w", err)
		}

		destPath := filepath.Join(app.config.storage.variantsDir, storedFilename)
		size, err := writeImage(destPath, out, img.MediaType)
		if err != nil {
			return fmt.Errorf("write %s variant: %w", spec.name, err)
		}

		err = app.models.Variants.Insert(job.ImageID, spec.name, storedFilename, bounds.Dx(), bounds.Dy(), size)
		if err != nil {
			os.Remove(destPath) // don't leave an orphaned file if the database insert fails
			return fmt.Errorf("record %s variant: %w", spec.name, err)
		}
	}

	return nil
}

// writeImage writes the given image to the specified destination path in the appropriate format based on the media type.
func writeImage(destPath string, img image.Image, mediaType string) (int64, error) {
	f, err := os.OpenFile(destPath, os.O_WRONLY|os.O_CREATE|os.O_EXCL, 0o644)
	if err != nil {
		return 0, err
	}
	defer f.Close()

	switch mediaType {
	case "image/png":
		err = png.Encode(f, img)
	default: // image/jpeg — the only other type VAL-01 accepts
		err = jpeg.Encode(f, img, &jpeg.Options{Quality: 85})
	}
	if err != nil {
		os.Remove(destPath)
		return 0, err
	}

	info, err := f.Stat()
	if err != nil {
		return 0, err
	}
	return info.Size(), nil
}

func extensionFor(mediaType string) string {
	if mediaType == "image/png" {
		return ".png"
	}
	return ".jpg"
}

// safeProcessingError returns a user-friendly error message based on the underlying error encountered during image processing.
func safeProcessingError(err error) string {
	switch {
	case errors.Is(err, sql.ErrNoRows), errors.Is(err, data.ErrRecordNotFound):
		return "the source image could not be found"
	case errors.Is(err, os.ErrNotExist):
		return "the source image file is missing"
	default:
		return "the image could not be processed"
	}
}
