# Test1_ImageProcessing_AlexG_ReeneB

# ImageLab

Asynchronous image processing: 202 Accepted + durable job + one background worker + short polling.

## Prerequisites

- Go 1.25.5
- PostgreSQL 18

## Environment configuration

The app is configured entirely through command-line flags (no `.env` file). Run with `-h` to see all of them:

go run ./cmd/api -h

The ones you'll actually need to change locally:

| Flag | Default | Purpose |
|---|---|---|
| `-db-dsn` | `postgresql://alex:alex@localhost/imagelab?sslmode=disable` | PostgreSQL connection string |
| `-port` | `4000` | API server port |
| `-worker-poll-interval` | `250ms` | How often the worker checks for queued jobs |
| `-processing-delay` | `0` | Artificial per-job delay — set this (e.g. `-processing-delay=1s`) to make queue wait and state transitions easy to observe by hand |
| `-storage-originals-dir` | `./storage/originals` | Where uploaded originals are written |
| `-storage-variants-dir` | `./storage/variants` | Where generated thumbnail/preview/display files are written |

## Database setup

# Create the role and database (adjust name/password to match your -db-dsn)
sudo -u postgres psql -c "CREATE ROLE alex WITH LOGIN PASSWORD 'alex';"
sudo -u postgres psql -c "CREATE DATABASE imagelab OWNER alex;"

# Postgres 15+ requires this explicitly, even for the owner
sudo -u postgres psql -d imagelab -c "GRANT ALL ON SCHEMA public TO alex;"
sudo -u postgres psql -d imagelab -c "GRANT CREATE ON SCHEMA public TO alex;"

## Migrations

Plain `.sql` files in `migrations/`, apply `.up.sql` in order with `psql`:
To roll back, apply the `.down.sql` files in reverse order.

## Running the app

go build -o imagelab-api ./cmd/api
./imagelab-api -db-dsn="postgresql://alex:alex@localhost/imagelab?sslmode=disable"

Then open `http://localhost:4000` in a browser.

## Running tests

There is no automated test suite for the Go backend in this version — verification was done manually via `curl`/`psql` 

## Project layout

cmd/api/            HTTP handlers, routing, worker, main()
internal/data/       Database models (Image, Job, Variant)
internal/validator/  Generic validation helpers
migrations/          SQL schema, applied in order
ui/static/           Frontend (vanilla JS, no build step)
storage/             Uploaded originals and generated variants (gitignored)

## API summary

| Method | Path | Purpose |

| `POST` | `/v1/images` | Accept an upload, return `202` with `job_id`/`status_url` |
| `GET` | `/v1/jobs/{id}` | Current job state; polled by the frontend roughly every second |
| `GET` | `/v1/images/{id}/variants/{name}` | Fetch one generated variant (`thumbnail`/`preview`/`display`) |
| `GET` | `/v1/healthcheck` | Liveness only |


## TESTING
Start the Server with a delay 
`./imagelab-api -processing-delay=2s`

Run this Command to start saving curl measurements
`START of command`
BASE=http://localhost:4000

measure() {   # usage: measure test.jpg 1
  local t0=$(date +%s.%N)
  # 1) upload; curl reports HTTP code + time to the 202 response
  local out=$(curl -s -w '\n%{http_code} %{time_total}' -F "image=@$1" $BASE/v1/images)
  local http=$(echo "$out" | tail -1 | cut -d' ' -f1)
  local ack=$(echo "$out" | tail -1 | cut -d' ' -f2)
  local url=$(echo "$out" | grep -o '"status_url": *"[^"]*"' | sed 's/.*: *"\(.*\)"/\1/')

  # 2) poll every 1s (same as the UI) and count polls
  local polls=0 status="" proc=""
  while [[ $status != completed && $status != failed ]]; do
    sleep 1
    polls=$((polls+1))
    local body=$(curl -s $BASE$url)
    status=$(echo "$body" | grep -o '"status": *"[^"]*"' | sed 's/.*: *"\(.*\)"/\1/')
    if [[ $status == processing && -z $proc ]]; then
      proc=$(awk -v a=$(date +%s.%N) -v b=$t0 'BEGIN{printf "%.2f", a-b}')
    fi
  done
  local total=$(awk -v a=$(date +%s.%N) -v b=$t0 'BEGIN{printf "%.2f", a-b}')
  echo "img#$2 http=$http ack=${ack}s first_seen_processing=${proc:-n/a}s total=${total}s polls=$polls final=$status"
  echo "   $body" | grep -o '"\(queued_at\|started_at\|completed_at\)": *"[^"]*"' | tr '\n' ' '; echo
}
`END of command`

## Single Image Measure Test
`measure test.jpg 1`


## Multi Image Measure Test
`for i in 1 2 3 4 5; do measure test.jpg $i & done | sort -t= -k2`

## Watch Live on Database
`watch -n 0.5 "psql -d imagelab -c \"SELECT id, status, started_at, completed_at FROM jobs ORDER BY id DESC LIMIT 5;\""`

## if Watch Live fails to execute the addition of your password and Postgres
## username will remedy the situation. Replace 'password' with the password ##you created, eg. 'apple', and the first imagelab after -U with your username, eg, John.
`watch -n 0.5 "PGPASSWORD='password' psql -h 127.0.0.1 -U imagelab -d imagelab -c \"SELECT id, status, started_at, completed_at FROM jobs ORDER BY id DESC LIMIT 5;\""`
