# cubmongo

Use Cubism.js for time-series visualization of updates to
multiple MongoDB collections.

### deployment
 This is a Flask app. Example multi-worker deployment of WSGI app e.g. behind a
 reverse proxy:
 ```
 gunicorn -w 4 -b 0.0.0.0:8000 cubmongo:app
 ```