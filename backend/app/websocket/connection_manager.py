# app/websocket/connection_manager.py

from fastapi import WebSocket, WebSocketDisconnect
from typing import Dict, Any, List
import logging
import asyncio
import os
import json
import tempfile
import time
import atexit
import uuid
import threading
import platform
import sys

# Import fcntl for Unix/Linux systems, or use a fallback for Windows
try:
    import fcntl

    HAS_FCNTL = True
except ImportError:
    HAS_FCNTL = False
    import msvcrt  # For Windows file locking

logger = logging.getLogger(__name__)

# Path for the shared connections file
CONNECTIONS_FILE = os.path.join(
    tempfile.gettempdir(), "fastapi_websocket_connections.json"
)
# Path for the message queue file
MESSAGE_QUEUE_FILE = os.path.join(
    tempfile.gettempdir(), "fastapi_websocket_messages.json"
)


class FileLock:
    """Cross-platform file locking."""

    def __init__(self, file_obj, exclusive=True):
        self.file_obj = file_obj
        self.exclusive = exclusive
        self._locked = False

    def acquire(self):
        if HAS_FCNTL:
            fcntl.flock(
                self.file_obj, fcntl.LOCK_EX if self.exclusive else fcntl.LOCK_SH
            )
        else:
            # Windows locking (less granular - can't do shared locks easily)
            msvcrt.locking(self.file_obj.fileno(), msvcrt.LK_LOCK, 1)  # Lock 1 byte
        self._locked = True

    def release(self):
        if self._locked:
            if HAS_FCNTL:
                fcntl.flock(self.file_obj, fcntl.LOCK_UN)
            else:
                msvcrt.locking(
                    self.file_obj.fileno(), msvcrt.LK_UNLCK, 1  # Unlock 1 byte
                )
            self._locked = False

    def __enter__(self):
        self.acquire()
        return self

    def __exit__(self, exc_type, exc_val, exc_tb):
        self.release()


class ConnectionManager:
    def __init__(self):
        self.active_connections: Dict[str, WebSocket] = {}
        self.connection_lock = asyncio.Lock()
        self._connection_map = {}  # Maps client_id to worker_id
        self._worker_id = os.getpid()  # Use process ID as worker ID
        self._message_check_interval = 1.0  # Check for messages every second
        self._message_processor_running = False
        self._main_event_loop = (
            asyncio.get_event_loop()
        )  # Store reference to main event loop

        # Create the connections file if it doesn't exist
        self._ensure_file_exists(CONNECTIONS_FILE, {})

        # Create the message queue file if it doesn't exist
        self._ensure_file_exists(MESSAGE_QUEUE_FILE, [])

        # Register cleanup on exit
        atexit.register(self._cleanup)

        # Start message processor
        self._start_message_processor()

        logger.info(
            f"ConnectionManager initialized for worker {self._worker_id} on {platform.system()}"
        )

    def _ensure_file_exists(self, filepath, default_content):
        """Create a file with default content if it doesn't exist"""
        if not os.path.exists(filepath):
            with open(filepath, "w") as f:
                with FileLock(f, exclusive=True):
                    json.dump(default_content, f)

    def _cleanup(self):
        """Remove this worker's connections from the shared file on exit"""
        try:
            connections = self._read_connections()
            # Remove any connections associated with this worker
            updated = {k: v for k, v in connections.items() if v != self._worker_id}
            self._write_connections(updated)

            # Stop message processor
            self._message_processor_running = False
            logger.info(
                f"ConnectionManager cleanup complete for worker {self._worker_id}"
            )
        except Exception as e:
            logger.error(f"Error during connection cleanup: {e}")

    def _read_connections(self):
        """Read the shared connections file with proper locking"""
        try:
            with open(CONNECTIONS_FILE, "r") as f:
                with FileLock(f, exclusive=False):  # Shared lock for reading
                    data = json.load(f)
                    return data
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Error reading connections file: {e}")
            return {}

    def _write_connections(self, connections):
        """Write to the shared connections file with proper locking"""
        try:
            with open(CONNECTIONS_FILE, "w") as f:
                with FileLock(f, exclusive=True):  # Exclusive lock for writing
                    json.dump(connections, f)
        except Exception as e:
            logger.error(f"Error writing connections file: {e}")

    def _read_message_queue(self):
        """Read the message queue file with proper locking"""
        try:
            with open(MESSAGE_QUEUE_FILE, "r") as f:
                with FileLock(f, exclusive=False):  # Shared lock for reading
                    data = json.load(f)
                    return data
        except (json.JSONDecodeError, FileNotFoundError) as e:
            logger.error(f"Error reading message queue file: {e}")
            return []

    def _write_message_queue(self, messages):
        """Write to the message queue file with proper locking"""
        try:
            with open(MESSAGE_QUEUE_FILE, "w") as f:
                with FileLock(f, exclusive=True):  # Exclusive lock for writing
                    json.dump(messages, f)
        except Exception as e:
            logger.error(f"Error writing message queue file: {e}")

    def _register_connection(self, client_id):
        """Register a connection in the shared file"""
        connections = self._read_connections()
        connections[client_id] = self._worker_id
        self._write_connections(connections)
        self._connection_map[client_id] = self._worker_id
        logger.info(f"Registered client {client_id} with worker {self._worker_id}")

    def _unregister_connection(self, client_id):
        """Unregister a connection from the shared file"""
        connections = self._read_connections()
        if client_id in connections:
            connections.pop(client_id)
            self._write_connections(connections)
            logger.info(f"Unregistered client {client_id} from shared connections")
        if client_id in self._connection_map:
            self._connection_map.pop(client_id)

    def _is_connection_registered(self, client_id):
        """Check if a connection is registered in any worker"""
        connections = self._read_connections()
        return client_id in connections

    def _is_my_connection(self, client_id):
        """Check if this connection belongs to this worker"""
        connections = self._read_connections()
        return client_id in connections and connections[client_id] == self._worker_id

    def _get_worker_for_client(self, client_id):
        """Get the worker ID for a client"""
        connections = self._read_connections()
        return connections.get(client_id)

    def _queue_message(self, client_id, message):
        """Add a message to the queue for a client on another worker"""
        try:
            messages = self._read_message_queue()
            messages.append(
                {
                    "id": str(uuid.uuid4()),
                    "client_id": client_id,
                    "worker_id": self._get_worker_for_client(client_id),
                    "message": message,
                    "timestamp": time.time(),
                }
            )
            self._write_message_queue(messages)
            logger.info(
                f"Queued message for client {client_id} on worker {self._get_worker_for_client(client_id)}"
            )
            return True
        except Exception as e:
            logger.error(f"Error queueing message: {e}")
            return False

    def _start_message_processor(self):
        """Start the message processor thread"""
        self._message_processor_running = True
        thread = threading.Thread(target=self._run_message_processor, daemon=True)
        thread.start()
        logger.info(f"Message processor started for worker {self._worker_id}")

    def _run_message_processor(self):
        """Process messages in the queue for this worker"""
        # Create a local event loop for this thread for any async operations
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)

        while self._message_processor_running:
            try:
                messages = self._read_message_queue()
                my_messages = [
                    m for m in messages if m.get("worker_id") == self._worker_id
                ]

                if my_messages:
                    # Process messages for this worker
                    remaining_messages = [
                        m for m in messages if m.get("worker_id") != self._worker_id
                    ]
                    self._write_message_queue(remaining_messages)

                    # Process each message in a way that doesn't require awaiting
                    for msg in my_messages:
                        client_id = msg.get("client_id")
                        message = msg.get("message")
                        if client_id in self.active_connections:
                            try:
                                # Use the stored main event loop
                                asyncio.run_coroutine_threadsafe(
                                    self._send_queued_message(client_id, message),
                                    self._main_event_loop,
                                )
                                logger.info(
                                    f"Processing queued message for client {client_id}"
                                )
                            except Exception as e:
                                logger.error(
                                    f"Error scheduling message for client {client_id}: {e}"
                                )
            except Exception as e:
                logger.error(f"Error in message processor: {e}")

            time.sleep(self._message_check_interval)

    async def _send_queued_message(self, client_id, message):
        """Send a queued message to a client"""
        try:
            if client_id in self.active_connections:
                websocket = self.active_connections[client_id]
                await websocket.send_json(message)
                logger.info(f"Sent queued message to client {client_id}")
            else:
                logger.warning(
                    f"Client {client_id} no longer connected, dropping message"
                )
        except Exception as e:
            logger.error(f"Error sending queued message to {client_id}: {e}")

    async def connect(self, client_id: str, websocket: WebSocket):
        """Connect a client with proper error handling"""
        await websocket.accept()
        async with self.connection_lock:
            # If there's an existing connection with the same ID, close it first
            if client_id in self.active_connections:
                logger.warning(
                    f"Client {client_id} already connected to this worker. Replacing connection."
                )
                old_connection = self.active_connections[client_id]
                try:
                    await old_connection.close()
                except Exception:
                    # Ignore errors from closing already closed connections
                    pass

            # Store the new connection
            self.active_connections[client_id] = websocket
            # Register in shared connections file
            self._register_connection(client_id)
            logger.info(f"Client {client_id} connected to worker {self._worker_id}")

    async def disconnect(self, client_id: str):
        """Safely disconnect a client"""
        async with self.connection_lock:
            if client_id in self.active_connections:
                # Don't try to close the connection here - just remove it from our dict
                self.active_connections.pop(client_id)
                # Unregister from shared connections file
                self._unregister_connection(client_id)
                logger.info(f"Client {client_id} removed from active connections")

    async def send_message(self, client_id: str, message: Any):
        """Send a message to a client with proper error handling"""
        # First check if this client is registered in any worker
        if not self._is_connection_registered(client_id):
            logger.warning(f"Tried to send message to unregistered client {client_id}")
            return False

        # If the connection is in this worker, send directly
        if client_id in self.active_connections:
            logger.info(f"Sending message to client {client_id} in this worker")
            websocket = self.active_connections[client_id]
            try:
                await websocket.send_json(message)
                return True
            except Exception as e:
                logger.error(f"Error sending message to client {client_id}: {str(e)}")
                # Mark client as disconnected if we can't send to it
                async with self.connection_lock:
                    if client_id in self.active_connections:
                        self.active_connections.pop(client_id)
                self._unregister_connection(client_id)
                return False
        else:
            logger.info(f"Sending message to client {client_id} on another worker")
            # If the connection is not in this worker but is registered,
            # queue the message for the worker that has the connection
            worker_id = self._get_worker_for_client(client_id)

            if worker_id:
                logger.info(
                    f"Queueing message for client {client_id} on worker {worker_id}"
                )
                success = self._queue_message(client_id, message)
                return success
            else:
                logger.warning(f"Client {client_id} is registered but no worker found")
                return False

    async def broadcast(self, message: Any):
        """Broadcast a message to all connected clients in this worker"""
        disconnected_clients = []

        for client_id, websocket in list(self.active_connections.items()):
            try:
                await websocket.send_json(message)
            except Exception:
                disconnected_clients.append(client_id)

        # Clean up any disconnected clients
        if disconnected_clients:
            async with self.connection_lock:
                for client_id in disconnected_clients:
                    if client_id in self.active_connections:
                        self.active_connections.pop(client_id)
                    self._unregister_connection(client_id)
