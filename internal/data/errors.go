package data

import "errors"

// ErrRecordNotFound is returned when a requested record does not exist in the database.
var ErrRecordNotFound = errors.New("no record found")
