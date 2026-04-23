"""
Windows 11 Simulator - Extension File Server
Serves win11_extension.js with proper CORS headers for TurboWarp.
Deployed on Railway.
"""

from flask import Flask, send_file, jsonify, Response, request
from flask_cors import CORS
import os
import json
import uuid

app = Flask(__name__)
CORS(app)

DATA_FILE = "user_data.json"

# Load or initialize data
if not os.path.exists(DATA_FILE):
    with open(DATA_FILE, "w") as f:
        json.dump({"users": {}, "files": {}}, f)

def load_data():
    with open(DATA_FILE, "r") as f:
        return json.load(f)

def save_data(data):
    with open(DATA_FILE, "w") as f:
        json.dump(data, f)

@app.route("/")
def index():
    return jsonify({
        "name": "Windows 11 Simulator Cloud Server",
        "status": "online"
    })

@app.route("/auth/login", methods=["POST", "OPTIONS"])
def login():
    if request.method == "OPTIONS": return Response(), 200
    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username:
        return jsonify({"status": "error", "message": "Username is required"}), 400
    
    try:
        db = load_data()
        if username in db["users"] and db["users"][username]["password"] == password:
            return jsonify({"status": "success", "token": username})
        return jsonify({"status": "error", "message": "Invalid username or password"}), 401
    except Exception as e:
        print(f"Login error: {e}")
        return jsonify({"status": "error", "message": "System error"}), 500

@app.route("/auth/register", methods=["POST", "OPTIONS"])
def register():
    if request.method == "OPTIONS": return Response(), 200
    data = request.json
    username = data.get("username", "").strip()
    password = data.get("password", "")
    
    if not username or len(password) < 1:
        return jsonify({"status": "error", "message": "Username and password required"}), 400
    
    try:
        db = load_data()
        if username in db["users"]:
            return jsonify({"status": "error", "message": "User already exists"}), 400
        
        db["users"][username] = {"password": password}
        save_data(db)
        print(f"New user registered: {username}")
        return jsonify({"status": "success"})
    except Exception as e:
        print(f"Registration error: {e}")
        return jsonify({"status": "error", "message": f"Storage error: {str(e)}"}), 500

@app.route("/files/<username>", methods=["GET", "POST"])
def handle_files(username):
    db = load_data()
    if request.method == "GET":
        user_files = [f for f in db["files"].values() if f["owner"] == username]
        return jsonify(user_files)
    
    file_data = request.json
    file_id = str(uuid.uuid4())
    file_data["id"] = file_id
    file_data["owner"] = username
    db["files"][file_id] = file_data
    save_data(db)
    return jsonify({"status": "success", "id": file_id})

@app.route("/win11_extension.js")
def serve_extension():
    ext_path = os.path.join(os.path.dirname(__file__), "win11_extension.js")
    with open(ext_path, "r", encoding="utf-8") as f:
        content = f.read()
    response = Response(content, mimetype="application/javascript")
    response.headers["Access-Control-Allow-Origin"] = "*"
    response.headers["Access-Control-Allow-Methods"] = "GET, OPTIONS"
    response.headers["Access-Control-Allow-Headers"] = "*"
    return response

@app.route("/health")
def health():
    return jsonify({"status": "ok"})

if __name__ == "__main__":
    port = int(os.environ.get("PORT", 5000))
    app.run(host="0.0.0.0", port=port, debug=False)
