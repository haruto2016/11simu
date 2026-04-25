"""
VirtualBox Web - Backend Server
Handles Cloud Storage, ISO uploads, and VM Networking Proxy.
"""

from flask import Flask, send_file, jsonify, Response, request, send_from_directory
from flask_cors import CORS
from flask_sock import Sock
import os
import json
import uuid
from werkzeug.utils import secure_filename

app = Flask(__name__)
CORS(app)
sock = Sock(app)

# Configuration
UPLOAD_FOLDER = 'storage'
ISO_FOLDER = os.path.join(UPLOAD_FOLDER, 'isos')
DISK_FOLDER = os.path.join(UPLOAD_FOLDER, 'disks')
STATE_FOLDER = os.path.join(UPLOAD_FOLDER, 'states')

for folder in [ISO_FOLDER, DISK_FOLDER, STATE_FOLDER]:
    os.makedirs(folder, exist_ok=True)

DATA_FILE = "user_data.json"

def load_data():
    if not os.path.exists(DATA_FILE):
        return {"users": {}, "vms": {}}
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f)

@app.route("/")
def index():
    return jsonify({
        "name": "VirtualBox Web API",
        "version": "2.0.0",
        "status": "online"
    })

# --- VM Management ---

@app.route("/api/vms", methods=["GET", "POST"])
def manage_vms():
    db = load_data()
    if request.method == "GET":
        return jsonify(db.get("vms", {}))
    
    vm_data = request.json # {name, ram, diskSize, isoId}
    vm_id = str(uuid.uuid4())
    vm_data["id"] = vm_id
    db["vms"][vm_id] = vm_data
    save_data(db)
    return jsonify({"status": "success", "id": vm_id})

# --- ISO & Disk Management ---

@app.route("/api/upload_iso", methods=["POST"])
def upload_iso():
    if 'file' not in request.files:
        return jsonify({"status": "error", "message": "No file part"}), 400
    file = request.files['file']
    if file.filename == '':
        return jsonify({"status": "error", "message": "No selected file"}), 400
    
    filename = secure_filename(file.filename)
    file_id = str(uuid.uuid4()) + "_" + filename
    file.save(os.path.join(ISO_FOLDER, file_id))
    
    return jsonify({"status": "success", "id": file_id, "name": filename})

@app.route("/storage/isos/<filename>")
def serve_iso(filename):
    return send_from_directory(ISO_FOLDER, filename)

@app.route("/storage/disks/<filename>")
def serve_disk(filename):
    # Support byte-range requests for v86 lazy loading
    return send_from_directory(DISK_FOLDER, filename)

@app.route("/api/save_state/<vm_id>", methods=["POST"])
def save_state(vm_id):
    if 'file' not in request.files:
        return jsonify({"status": "error"}), 400
    file = request.files['file']
    file.save(os.path.join(STATE_FOLDER, f"{vm_id}.bin"))
    return jsonify({"status": "success"})

# --- Networking Relay ---
# Bridges the VM's raw ethernet frames to a relay or NAT handler
@sock.route('/net')
def networking(ws):
    print("VM Connected to Network")
    while True:
        data = ws.receive()
        if not data: break
        # In a real implementation, we would bridge this to a TAP device or SLIRP
        # For now, we relay or log (Development stage)
        pass

# --- Static Files (JS/CSS) ---
@app.route("/<path:path>")
def serve_static(path):
    return send_from_directory(".", path)

# --- Helper to serve the frontend ---
@app.route("/vbox")
def serve_vbox():
    return send_from_directory(".", "vbox.html")

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
