"""Live feed WebSocket routes."""

from fastapi import APIRouter, WebSocket, WebSocketDisconnect

from services.live_feed import live_feed_manager

router = APIRouter(tags=["Live Feed"])


@router.websocket("/ws/live-feed")
async def websocket_live_feed(websocket: WebSocket):
    await live_feed_manager.connect(websocket)
    try:
        while True:
            await websocket.receive_text()
    except WebSocketDisconnect:
        await live_feed_manager.disconnect(websocket)
    except Exception:
        await live_feed_manager.disconnect(websocket)
