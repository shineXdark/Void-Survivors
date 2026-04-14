const express = require("express");
const http = require("http");
const path = require("path");
const { WebSocketServer } = require("ws");

const PORT = Number(process.env.PORT || 3000);
const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.resolve(__dirname)));

const clients = new Map();
const lobbies = new Map();

function makeId(length = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let value = "";
  for (let i = 0; i < length; i += 1) {
    value += chars[Math.floor(Math.random() * chars.length)];
  }
  return value;
}

function send(ws, payload) {
  if (ws.readyState === ws.OPEN) {
    ws.send(JSON.stringify(payload));
  }
}

function sanitizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 18);
}

function getLobbySummary(lobby) {
  return {
    id: lobby.id,
    hostId: lobby.hostId,
    hostName: lobby.hostName,
    playerCount: lobby.players.size,
    started: lobby.started,
  };
}

function getLobbyPayload(lobby) {
  return {
    id: lobby.id,
    hostId: lobby.hostId,
    hostName: lobby.hostName,
    started: lobby.started,
    players: [...lobby.players.values()],
  };
}

function broadcastLobbyList() {
  const lobbyList = [...lobbies.values()]
    .filter((lobby) => !lobby.started)
    .map(getLobbySummary)
    .sort((a, b) => a.hostName.localeCompare(b.hostName));

  for (const ws of clients.keys()) {
    send(ws, { type: "lobbyList", lobbies: lobbyList });
  }
}

function sendLobbyUpdate(lobby) {
  const payload = { type: "lobbyUpdate", lobby: getLobbyPayload(lobby) };
  for (const player of lobby.players.values()) {
    const target = player.ws;
    send(target, payload);
  }
}

function closeLobby(lobbyId, reason = "Lobby closed.") {
  const lobby = lobbies.get(lobbyId);
  if (!lobby) {
    return;
  }

  for (const player of lobby.players.values()) {
    const client = clients.get(player.ws);
    if (client) {
      client.lobbyId = null;
    }
    send(player.ws, { type: "lobbyClosed", reason });
  }

  lobbies.delete(lobbyId);
  broadcastLobbyList();
}

function leaveLobby(ws, reason = null) {
  const client = clients.get(ws);
  if (!client?.lobbyId) {
    return;
  }

  const lobby = lobbies.get(client.lobbyId);
  client.lobbyId = null;

  if (!lobby) {
    broadcastLobbyList();
    return;
  }

  if (lobby.hostId === client.id) {
    closeLobby(lobby.id, reason || "Host left the lobby.");
    return;
  }

  lobby.players.delete(client.id);
  sendLobbyUpdate(lobby);
  broadcastLobbyList();
}

function createLobby(ws, displayName) {
  leaveLobby(ws);

  const client = clients.get(ws);
  const hostName = sanitizeName(displayName);
  if (!hostName) {
    send(ws, { type: "error", message: "Choose a valid name first." });
    return;
  }

  let lobbyId = makeId();
  while (lobbies.has(lobbyId)) {
    lobbyId = makeId();
  }

  const lobby = {
    id: lobbyId,
    hostId: client.id,
    hostName,
    started: false,
    players: new Map(),
  };

  const player = { id: client.id, name: hostName, ws };
  lobby.players.set(client.id, player);
  lobbies.set(lobbyId, lobby);

  client.name = hostName;
  client.lobbyId = lobbyId;

  send(ws, { type: "lobbyJoined", lobby: getLobbyPayload(lobby) });
  sendLobbyUpdate(lobby);
  broadcastLobbyList();
}

function joinLobby(ws, lobbyId, displayName) {
  leaveLobby(ws);

  const client = clients.get(ws);
  const lobby = lobbies.get(String(lobbyId || "").trim().toUpperCase());
  const name = sanitizeName(displayName);

  if (!name) {
    send(ws, { type: "error", message: "Choose a valid name first." });
    return;
  }

  if (!lobby || lobby.started) {
    send(ws, { type: "error", message: "That lobby is no longer available." });
    broadcastLobbyList();
    return;
  }

  lobby.players.set(client.id, { id: client.id, name, ws });
  client.name = name;
  client.lobbyId = lobby.id;

  send(ws, { type: "lobbyJoined", lobby: getLobbyPayload(lobby) });
  sendLobbyUpdate(lobby);
  broadcastLobbyList();
}

function startLobby(ws) {
  const client = clients.get(ws);
  const lobby = client?.lobbyId ? lobbies.get(client.lobbyId) : null;
  if (!lobby || lobby.hostId !== client.id) {
    return;
  }

  lobby.started = true;
  const payload = {
    type: "gameStarted",
    lobby: getLobbyPayload(lobby),
  };

  for (const player of lobby.players.values()) {
    send(player.ws, payload);
  }

  broadcastLobbyList();
}

function relayToHost(ws, payload) {
  const client = clients.get(ws);
  const lobby = client?.lobbyId ? lobbies.get(client.lobbyId) : null;
  if (!lobby || lobby.hostId === client.id) {
    return;
  }

  const host = lobby.players.get(lobby.hostId);
  if (!host) {
    return;
  }

  send(host.ws, {
    type: "playerInput",
    playerId: client.id,
    input: payload,
  });
}

function relaySnapshot(ws, snapshot) {
  const client = clients.get(ws);
  const lobby = client?.lobbyId ? lobbies.get(client.lobbyId) : null;
  if (!lobby || lobby.hostId !== client.id) {
    return;
  }

  for (const player of lobby.players.values()) {
    if (player.id === client.id) {
      continue;
    }
    send(player.ws, {
      type: "worldSnapshot",
      snapshot,
    });
  }
}

wss.on("connection", (ws) => {
  const client = {
    id: makeId(8),
    name: "",
    lobbyId: null,
  };

  clients.set(ws, client);
  send(ws, { type: "welcome", clientId: client.id });
  send(ws, {
    type: "lobbyList",
    lobbies: [...lobbies.values()].filter((lobby) => !lobby.started).map(getLobbySummary),
  });

  ws.on("message", (raw) => {
    let message;
    try {
      message = JSON.parse(String(raw));
    } catch {
      send(ws, { type: "error", message: "Invalid message format." });
      return;
    }

    switch (message.type) {
      case "requestLobbies":
        broadcastLobbyList();
        break;
      case "createLobby":
        createLobby(ws, message.name);
        break;
      case "joinLobby":
        joinLobby(ws, message.lobbyId, message.name);
        break;
      case "leaveLobby":
        leaveLobby(ws, "A player left the lobby.");
        break;
      case "startGame":
        startLobby(ws);
        break;
      case "playerInput":
        relayToHost(ws, message.input);
        break;
      case "worldSnapshot":
        relaySnapshot(ws, message.snapshot);
        break;
      default:
        send(ws, { type: "error", message: "Unknown message type." });
        break;
    }
  });

  ws.on("close", () => {
    leaveLobby(ws, "A player disconnected.");
    clients.delete(ws);
  });
});

server.listen(PORT, () => {
  console.log(`Neon Horde server running on http://0.0.0.0:${PORT}`);
});
