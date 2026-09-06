package main

import (
	"context"
	"time"
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
				// app.models.Jobs.ClaimNext(ctx), generate
				// variants, MarkCompleted/MarkFailed.
			}
		}
	}()
}
