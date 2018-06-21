import datetime
import json
from urllib.parse import unquote
from flask import Flask, current_app, jsonify, request
from mongogrant import Client
from mp_viewer.structure_vis_mp import PymatgenVisualizationIntermediateFormat
from pymatgen import Structure

app = Flask(__name__)


@app.route('/')
def hello_world():
    return current_app.send_static_file('main.html')


@app.route('/cubism')
def cubism():
    return current_app.send_static_file('cubism.v1.js')


client = Client()

client.set_alias("m01.nersc", "mongodb01.nersc.gov", "host")
client.set_alias("m03.nersc", "mongodb03.nersc.gov", "host")

client.set_alias("core", "fw_mp_prod_atomate", "db")
client.set_alias("elastic", "fw_jhm_kpoints", "db")
client.set_alias("SCAN", "fw_shyamd", "db")

dbs = {
    "elastic": client.db("ro:m03.nersc/elastic", connect=False),
    "SCAN": client.db("ro:m03.nersc/SCAN", connect=False),
    "core": client.db("ro:m01.nersc/core", connect=False),
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
    fmt = format_timefield[collname]
    while dt_last < dt_stop:
        criteria = criteria_base.copy()
        criteria.update({timefield: {
            "$lte": fmt(dt_last), "$gt": fmt(dt_last - td_step)
        }})
        values.append(coll.find(criteria).count())
        dt_last += td_step
    return jsonify(values)

@app.route('/recent_structures')
def recent_structures():
    # Hella lazy
    coll = dbs['elastic']['fireworks']
    cursor = coll.find({"state": "COMPLETED"},
                       {"spec": 1, "name": 1, "updated_on": 1})
    recent_fws = cursor.sort("updated_on", -1).limit(4)
    recent_calcs = []
    for fw in recent_fws:
        if 'structure optimization' in fw['name']:
            structure = fw['spec']['_tasks'][1]['structure']
        else:
            structure = fw['spec']['_tasks'][2]['structure']
        structure = Structure.from_dict(structure)
        fmt = PymatgenVisualizationIntermediateFormat(structure)
        recent_calcs.append(fmt.json)
    return jsonify(recent_calcs)


def isostr_to_dt(isostr):
    isostr = isostr.split(".", 1)[0] # Lose sub-second precision
    return datetime.datetime.strptime(isostr, "%Y-%m-%dT%H:%M:%S")


tf_isoformat = lambda dt: dt.isoformat()
tf_dtformat = lambda dt: dt
format_timefield = {
    "fireworks": tf_isoformat,
    "workflows":tf_dtformat,
    "launches": tf_isoformat,
}

if __name__ == '__main__':
    app.run(debug=True)
