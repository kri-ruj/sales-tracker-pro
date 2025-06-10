# Simple static file server for App Engine
# This file is required for Python runtime but won't be used
# since all requests are handled by static file handlers in app.yaml

from flask import Flask
app = Flask(__name__)

@app.route('/')
def index():
    return "This route should not be reached - check app.yaml static handlers"

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8080)