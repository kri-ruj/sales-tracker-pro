# Force Cache Clear for Version Sync

## The Problem
Frontend shows old version (3.7.8) while backend shows new version (3.7.10) because:
1. App Engine aggressively caches static files
2. Service Worker caches the old version
3. Browser caches the old files

## Solution Implemented

### 1. Updated Version References
- `config.js`: VERSION = '3.7.10'
- `sw.js`: VERSION = '3.7.10'
- `VERSION` file: 3.7.10
- `index.html`: All hardcoded versions removed, now uses CONFIG.VERSION

### 2. Dynamic Version Loading
- Config.js loads first
- All version displays use CONFIG.VERSION
- CSS file loaded with version + timestamp

### 3. App Engine Cache Headers
Need to add to `app.yaml`:
```yaml
handlers:
- url: /config.js
  static_files: config.js
  upload: config.js
  http_headers:
    Cache-Control: no-cache, no-store, must-revalidate
  
- url: /index.html
  static_files: index.html
  upload: index.html
  http_headers:
    Cache-Control: no-cache, no-store, must-revalidate

- url: /sw.js
  static_files: sw.js
  upload: sw.js
  http_headers:
    Cache-Control: no-cache, no-store, must-revalidate
```

## Manual Cache Clear Steps
If version still shows old after deployment:

1. **Clear Browser Cache**:
   - Chrome: Settings → Privacy → Clear browsing data
   - Check "Cached images and files"

2. **Unregister Service Worker**:
   - Chrome DevTools → Application → Service Workers → Unregister

3. **Force Reload**:
   - Ctrl+Shift+R (Windows/Linux)
   - Cmd+Shift+R (Mac)

4. **Use Force Update Page**:
   - Visit: https://frontend-dot-salesappfkt.as.r.appspot.com/force-update.html

## Prevention
The new service worker (v3.7.10) includes:
- Timestamp in cache name
- Network-first strategy
- Automatic old cache cleanup
- Update notifications to clients