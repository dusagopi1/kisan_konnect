import asyncio
import json
from datetime import datetime
from typing import Dict, Set

from websockets.server import WebSocketServerProtocol, serve

# Store active connections
connections: Dict[str, Set[WebSocketServerProtocol]] = {}

async def register(websocket: WebSocketServerProtocol, chat_id: str):
    """Register a WebSocket connection for a specific chat."""
    if chat_id not in connections:
        connections[chat_id] = set()
    connections[chat_id].add(websocket)

async def unregister(websocket: WebSocketServerProtocol, chat_id: str):
    """Unregister a WebSocket connection."""
    if chat_id in connections:
        connections[chat_id].remove(websocket)
        if not connections[chat_id]:
            del connections[chat_id]

async def notify_chat(chat_id: str, message: dict, exclude_websocket: WebSocketServerProtocol = None):
    """Send a message to all connected clients in a chat except the sender."""
    if chat_id in connections:
        websockets = connections[chat_id]
        if websockets:
            await asyncio.gather(
                *[ws.send(json.dumps(message)) for ws in websockets if ws != exclude_websocket]
            )

async def chat_handler(websocket: WebSocketServerProtocol, path: str):
    """Handle WebSocket connections for chat."""
    try:
        # Extract chat_id from path (e.g., /ws/chat/123)
        chat_id = path.split('/')[-1]
        
        # Register the connection
        await register(websocket, chat_id)
        
        try:
            async for message in websocket:
                data = json.loads(message)
                
                # Add timestamp to the message
                data['created_at'] = datetime.now().isoformat()
                
                # Broadcast the message to all other clients in the chat
                await notify_chat(chat_id, data, exclude_websocket=websocket)
                
        except Exception as e:
            print(f"Error handling message: {e}")
            
        finally:
            # Unregister the connection when the client disconnects
            await unregister(websocket, chat_id)
            
    except Exception as e:
        print(f"Error in chat handler: {e}")

async def start_websocket_server(host: str = 'localhost', port: int = 8765):
    """Start the WebSocket server."""
    async with serve(chat_handler, host, port):
        await asyncio.Future()  # run forever

def run_websocket_server():
    """Run the WebSocket server in the current thread."""
    asyncio.run(start_websocket_server()) 