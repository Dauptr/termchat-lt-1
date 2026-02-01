import sys
import signal
import paho.mqtt.client as mqtt
import json
import os
import threading
import random
import string
import time
import subprocess  # Fixed: Imported at top level
from datetime import datetime
from dotenv import load_dotenv
from http.server import HTTPServer, SimpleHTTPRequestHandler

# AI Imports (Check for ZhipuAI)
try:
    from zhipuai import ZhipuAI
    AI_AVAILABLE = True
except ImportError:
    AI_AVAILABLE = False
    print("[WARNING] ZhipuAI not installed. AI features will use fallback.")

# Load Config
load_dotenv()
ZHIPU_API_KEY = os.getenv("ZHIPU_API_KEY")
PORT = int(os.getenv("PORT", 10000))

# Global State
active_users = {}
conv_history = []
admin_token = ''.join(random.choices(string.ascii_uppercase + string.digits, k=8))

print(f"[TERMOS] Backend Starting...")
print(f"[SECURITY] Admin Token: {admin_token}")
print(f"[PORT] {PORT}")

# ==========================================
# MQTT CLIENT (V2 FIX)
# ==========================================
mqtt_client = mqtt.Client(mqtt.CallbackAPIVersion.VERSION2)

def on_connect(client, userdata, flags, reason_code, properties):
    """Callback for connection"""
    if reason_code == 0:
        print(f"[MQTT] Connected. Code: {reason_code}")
        # Subscribe to Nexus topics
        client.subscribe("termos/nexus/+") 
        client.subscribe("termos/input")
    else:
        print(f"[MQTT] Failed. Code: {reason_code}")

def on_message(client, userdata, msg):
    """Handle incoming MQTT messages"""
    topic = msg.topic
    try:
        payload = msg.payload.decode()
        data = json.loads(payload) if payload.startswith('{') else {}
    except:
        data = {}

    print(f"[LOG] {topic}: {payload[:50]}...")

    # Handle Chat Input
    if topic.startswith("termos/nexus"):
        # Broadcast logic handled by frontend P2P mostly, 
        # but we echo here for persistence/log if DB existed
        pass

    # Handle AI Triggers
    if topic == "termos/input":
        user_msg = payload
        if AI_AVAILABLE and ZHIPU_API_KEY:
            # Simple logic to detect if user is asking AI
            if "?" in user_msg or "ai" in user_msg.lower() or "termai" in user_msg.lower():
                print("[AI] Processing request...")
                try:
                    ai = ZhipuAI(api_key=ZHIPU_API_KEY)
                    response = ai.chat.completions.create(
                        model="glm-4-flash",
                        messages=[
                            {"role": "system", "content": "You are TermOS Kernel. You can execute functions to change the UI. Available: install_theme(name), add_animation(name). Respond in JSON format for commands, or plain text for chat."},
                            {"role": "user", "content": user_msg}
                        ]
                    )
                    reply = response.choices[0].message.content
                    
                    # Check if AI wants to execute a command
                    if "install_theme" in reply or "add_animation" in reply:
                        # Parse simple JSON command
                        try:
                            # Try to extract JSON from reply
                            start = reply.find('{')
                            end = reply.rfind('}')
                            if start != -1 and end != -1:
                                cmd_json = json.loads(reply[start:end+1])
                                # Publish to frontend for execution
                                mqtt_client.publish("termos/nexus/global", json.dumps({
                                    "sender": "KERNEL",
                                    "type": "mutation",
                                    "data": cmd_json
                                }))
                            else:
                                # Just text
                                mqtt_client.publish("termos/nexus/global", json.dumps({
                                    "sender": "KERNEL",
                                    "type": "chat",
                                    "msg": reply
                                }))
                        except Exception as e:
                            print(f"[AI JSON ERROR] {e}")
                    else:
                        mqtt_client.publish("termos/nexus/global", json.dumps({
                            "sender": "KERNEL",
                            "type": "chat",
                            "msg": reply
                        }))
                except Exception as e:
                    print(f"[AI ERROR] {e}")

# Callbacks
mqtt_client.on_connect = on_connect
mqtt_client.on_message = on_message

# ==========================================
# HTTP SERVER (Serve Frontend)
# ==========================================
class FrontendHandler(SimpleHTTPRequestHandler):
    def do_GET(self):
        if self.path == '/':
            try:
                with open("index.html", "rb") as f:
                    self.send_response(200)
                    self.send_header('Content-type', 'text/html')
                    self.end_headers()
                    self.wfile.write(f.read())
            except FileNotFoundError:
                self.send_response(404)
                self.end_headers()
                self.wfile.write(b"index.html not found")
        elif self.path == '/health':
            self.send_response(200)
            self.end_headers()
            self.wfile.write(b"OK")
    
    def do_POST(self):
        # Allow remote shell execution (God Mode)
        if self.path == '/exec':
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            try:
                data = json.loads(body)
                if data.get('token') == admin_token:
                    cmd = data.get('command')
                    result = subprocess.run(cmd, shell=True, capture_output=True, text=True, timeout=5)
                    self.send_response(200)
                    self.send_header('Content-type', 'application/json')
                    self.end_headers()
                    self.wfile.write(json.dumps({'output': result.stdout}).encode())
                else:
                    self.send_response(403)
                    self.end_headers()
            except Exception as e:
                print(f"[EXEC ERROR] {e}")

# ==========================================
# MAIN
# ==========================================
if __name__ == '__main__':
    # Start HTTP
    server = HTTPServer(('0.0.0.0', PORT), FrontendHandler)
    thread = threading.Thread(target=server.serve_forever)
    thread.daemon = True
    thread.start()
    print(f"[HTTP] Serving on port {PORT}")

    # Connect MQTT
    try:
        mqtt_client.connect("broker.emqx.io", 1883, 60)
        mqtt_client.loop_forever()
    except KeyboardInterrupt:
        print("[SHUTDOWN] Exiting")
