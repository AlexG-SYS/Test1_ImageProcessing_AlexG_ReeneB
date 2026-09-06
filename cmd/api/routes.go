package main

import "net/http"

func (app *application) routes() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /v1/healthcheck", app.healthcheckHandler)
	mux.HandleFunc("POST /v1/images", app.createImageHandler)

	// Serves index.html/app.js/style.css etc.
	mux.Handle("/", http.FileServer(http.Dir("./ui/static")))

	return mux
}
