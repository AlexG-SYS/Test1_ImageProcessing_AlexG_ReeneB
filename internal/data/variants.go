package data

import "database/sql"

// Variant represents a single generated variant of an original image,
// with metadata about its dimensions, file size, and how it is stored on disk.
type Variant struct {
	ID             string `json:"-"`
	ImageID        string `json:"-"`
	Name           string `json:"name"`
	StoredFilename string `json:"-"`
	Width          int    `json:"width"`
	Height         int    `json:"height"`
	SizeBytes      int64  `json:"-"`
	URL            string `json:"url"`
}

type VariantModel struct {
	DB *sql.DB
}
