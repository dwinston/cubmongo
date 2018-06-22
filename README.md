# cubmongo

Use Cubism.js for time-series visualization of updates to
multiple MongoDB collections.

### development

To run:
```
pip install -r requirements.txt
python cubmongo.py # starts Flask debug server
```

The current code connects to a set of hard-coded databases via
`mongogrant`. Eventually db config will be refactored to a config file.
For now, this repo is primarily used internally by
the [Materials Project](https://materialsproject.org) to produce a 
dashboard to monitor its database build pipeline.

To (re)install structure viewer javascript:
```
npm install
npm install -g npx
npx webpack
cp dist/main.js static/structureViewerBuilt.js
python cubmongo.py
```

### deployment
 This is a Flask app. Example multi-worker deployment of WSGI app e.g. behind a
 reverse proxy:
 ```
 gunicorn -w 4 -b 0.0.0.0:8000 cubmongo:app
 ```