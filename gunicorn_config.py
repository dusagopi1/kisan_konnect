import multiprocessing

# Worker settings
worker_class = "eventlet"
workers = 1  # Keep this as 1 when using eventlet
threads = 1000

# Timeout settings
timeout = 300  # Increased timeout for WebSocket connections
keepalive = 5

# Server settings
bind = "0.0.0.0:10000"
max_requests = 1000
max_requests_jitter = 50

# Logging
accesslog = "-"
errorlog = "-"
loglevel = "info"

# SSL (if needed)
# keyfile = "path/to/keyfile"
# certfile = "path/to/certfile"

# Process naming
proc_name = "kisan_konnect"

# Eventlet specific
worker_connections = 1000

# WebSocket specific
websocket_timeout = 3600  # 1 hour
graceful_timeout = 60 