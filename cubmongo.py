import datetime
import json
from urllib.parse import unquote

from flask import Flask, current_app, jsonify, request
from mongogrant import Client

app = Flask(__name__)


@app.route('/')
def hello_world():
    return current_app.send_static_file('main.html')


@app.route('/cubism')
def cubism():
    return current_app.send_static_file('cubism.v1.js')


client = Client()

client.set_alias("mg2.lbl", "matgen2.lbl.gov", "host")
client.set_alias("m01.nersc", "mongodb01.nersc.gov", "host")
client.set_alias("m03.nersc", "mongodb03.nersc.gov", "host")
client.set_alias("m04.nersc", "mongodb04.nersc.gov", "host")

client.set_alias("build", "mp_prod", "db")
client.set_alias("core", "fw_mp_prod_atomate", "db")
client.set_alias("app", "mg_apps_prod", "db")
client.set_alias("elastic", "fw_jhm_kpoints", "db")
client.set_alias("SCAN", "fw_shyamd", "db")

dbs = {
    "elastic": client.db("ro:m03.nersc/elastic", connect=False),
    "SCAN": client.db("ro:m03.nersc/SCAN", connect=False),
    "core": client.db("ro:m01.nersc/core", connect=False),
    "app": client.db("ro:m04.nersc/app", connect=False),
    "build": client.db("ro:mg2.lbl/build", connect=False),
}


@app.route('/mongometric')
def mongometric():
    dbname = request.args.get("db")
    collname = request.args.get("collection")
    filt = request.args.get("filter")
    timefield = request.args.get("timefield")
    start = request.args.get("start")
    stop = request.args.get("stop")
    step = request.args.get("step")

    dt_start = isostr_to_dt(start)
    dt_stop = isostr_to_dt(stop)
    td_step = datetime.timedelta(milliseconds=int(step))

    coll = dbs[dbname][collname]
    criteria_base = json.loads(unquote(filt))
    dt_last = dt_start
    values = []
    fmt = format_timefield.get(collname, tf_dtformat)
    while dt_last < dt_stop:
        criteria = criteria_base.copy()
        criteria.update({timefield: {
            "$lte": fmt(dt_last), "$gt": fmt(dt_last - td_step)
        }})
        values.append(coll.find(criteria).count())
        dt_last += td_step
    return jsonify(values)


def isostr_to_dt(isostr):
    isostr = isostr.split(".", 1)[0] # Lose sub-second precision
    return datetime.datetime.strptime(isostr, "%Y-%m-%dT%H:%M:%S")


tf_isoformat = lambda dt: dt.isoformat()
tf_dtformat = lambda dt: dt
format_timefield = {
    "fireworks": tf_isoformat,
    "workflows": tf_dtformat,
    "launches": tf_isoformat,
}

if __name__ == '__main__':
    app.run(debug=True)
