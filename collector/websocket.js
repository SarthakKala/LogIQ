const { WebSocketServer, WebSocket } = require('ws');

let wss;

function startWebSocketServer(port) {
  wss = new WebSocketServer({ port });
  wss.on('connection', (socket) => {
    socket.on('error', () => {});
  });
  console.log(`WebSocket log stream: ws://localhost:${port}`);
}

function broadcast(logEntry) {
  if (!wss) return;
  const payload = JSON.stringify(logEntry);
  for (const client of wss.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

module.exports = { startWebSocketServer, broadcast };
