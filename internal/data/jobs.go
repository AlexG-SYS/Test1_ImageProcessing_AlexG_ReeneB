package data

import (
	"context"
	"database/sql"
	"errors"
	"time"
)

// Job represents a single image processing job, with metadata about its status and timestamps for each stage of processing.
type Job struct {
	ID           string     `json:"-"`
	PublicID     string     `json:"id"`
	ImageID      string     `json:"image_id"`
	Status       string     `json:"status"`
	ErrorMessage *string    `json:"error_message,omitempty"`
	QueuedAt     time.Time  `json:"queued_at"`
	StartedAt    *time.Time `json:"started_at,omitempty"`
	CompletedAt  *time.Time `json:"completed_at,omitempty"`
}

type JobModel struct {
	DB *sql.DB
}

// Insert creates a new job record in the database for the given image ID and returns the created Job struct with its
// ID, PublicID, and QueuedAt fields populated.
func (m JobModel) Insert(imageID string) (*Job, error) {
	query := `
		INSERT INTO jobs (image_id)
		VALUES ($1)
		RETURNING id, public_id, image_id, status, queued_at`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var job Job
	err := m.DB.QueryRowContext(ctx, query, imageID).Scan(
		&job.ID, &job.PublicID, &job.ImageID, &job.Status, &job.QueuedAt,
	)
	if err != nil {
		return nil, err
	}
	return &job, nil
}

// GetByPublicID retrieves a job record from the database by its public ID. If no record is found, it returns ErrRecordNotFound.
func (m JobModel) GetByPublicID(publicID string) (*Job, error) {
	query := `
		SELECT id, public_id, image_id, status, error_message, queued_at, started_at, completed_at
		FROM jobs
		WHERE public_id = $1`

	ctx, cancel := context.WithTimeout(context.Background(), 3*time.Second)
	defer cancel()

	var job Job
	err := m.DB.QueryRowContext(ctx, query, publicID).Scan(
		&job.ID, &job.PublicID, &job.ImageID, &job.Status,
		&job.ErrorMessage, &job.QueuedAt, &job.StartedAt, &job.CompletedAt,
	)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			return nil, ErrRecordNotFound
		}
		return nil, err
	}
	return &job, nil
}

// ClaimNext retrieves the next queued job from the database, marks it as started, and returns the Job struct. If no queued jobs are available, it returns nil without an error.
func (m JobModel) ClaimNext() (*Job, error) {
	return nil, nil // actual logic to claim the next job will be added later.
}
