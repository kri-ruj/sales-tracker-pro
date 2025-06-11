# Permanent Fix for Frontend Version Caching

## The Root Cause
Google App Engine's edge servers cache static files aggressively. Even with no-cache headers, the CDN takes time to propagate changes globally.

## The Solution: Force Cache Invalidation

### 1. Deploy with Unique Version String
The deployment already uses version IDs like "v3710" but the static files are still cached.

### 2. Add Cache Busting to ALL Static Resources
We need to add timestamp or version parameters to every static file request.

### 3. Use App Engine's Cache Invalidation
After deployment, we need to wait for cache propagation or force invalidation.

## Implementation Steps

### Step 1: Update index.html to force reload all assets
```html
<!-- Before -->
<script src="config.js"></script>

<!-- After -->
<script>
  const v = new Date().getTime();
  document.write('<script src="config.js?v=' + v + '"><\/script>');
</script>
```

### Step 2: Add dispatch.yaml to route version checks
```yaml
dispatch:
  - url: "*/version.json"
    service: frontend
  - url: "*/config.js"
    service: frontend
```

### Step 3: Use Cloud CDN cache invalidation
After deployment, invalidate the CDN cache:
```bash
gcloud compute url-maps invalidate-cdn-cache [URL_MAP] \
  --path="/config.js" \
  --path="/index.html" \
  --path="/version.json"
```

### Step 4: Alternative - Use Dynamic Serving
Instead of static files, serve config.js dynamically with Python:
```python
# main.py
from flask import Flask, Response
import json

app = Flask(__name__)

@app.route('/config.js')
def serve_config():
    config = {
        'liffId': '2007552096-wrG1aV9p',
        'apiBaseUrl': 'https://sales-tracker-api-dot-salesappfkt.as.r.appspot.com/api',
        'VERSION': '3.7.11'
    }
    js_content = f"const CONFIG = {json.dumps(config)};"
    return Response(js_content, mimetype='application/javascript', 
                   headers={'Cache-Control': 'no-cache, no-store, must-revalidate'})
```

## Quick Fix for Now
The fastest solution is to:
1. Change the service name temporarily
2. Deploy to a new service
3. Switch back

Or manually invalidate through GCP Console:
1. Go to App Engine → Settings → Clear cache
2. Or use Cloud CDN → Invalidate cache

## Validation Fix
Instead of checking the HTML, check version.json directly with cache buster:
```javascript
const url = 'https://frontend-dot-PROJECT.appspot.com/version.json?t=' + Date.now();
```