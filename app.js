const game = window.NeonHordeGame;

const dom = {
  introOverlay: document.getElementById("intro-overlay"),
  menuHome: document.getElementById("menu-home"),
  menuMultiplayer: document.getElementById("menu-multiplayer"),
  menuJoin: document.getElementById("menu-join"),
  menuLobby: document.getElementById("menu-lobby"),
  nameInput: document.getElementById("player-name-input"),
  menuStatus: document.getElementById("menu-status"),
  singleplayerButton: document.getElementById("singleplayer-button"),
  multiplayerButton: document.getElementById("multiplayer-button"),
  hostGameButton: document.getElementById("host-game-button"),
  joinGameButton: document.getElementById("join-game-button"),
  backToHomeButton: document.getElementById("back-to-home-button"),
  refreshLobbiesButton: document.getElementById("refresh-lobbies-button"),
  backToMultiplayerButton: document.getElementById("back-to-multiplayer-button"),
  lobbyList: document.getElementById("lobby-list"),
  lobbyTitle: document.getElementById("lobby-title"),
  lobbySubtitle: document.getElementById("lobby-subtitle"),
  lobbyIdValue: document.getElementById("lobby-id-value"),
  lobbyCountValue: document.getElementById("lobby-count-value"),
  lobbyPlayerList: document.getElementById("lobby-player-list"),
  startMatchButton: document.getElementById("start-match-button"),
  leaveLobbyButton: document.getElementById("leave-lobby-button"),
};

const appState = {
  socket: null,
  socketOpen: false,
  clientId: null,
  currentLobby: null,
  lobbyList: [],
  assetsReady: game.isAssetsReady(),
  currentScreen: "home",
  multiplayerStarted: false,
};

function sanitizeName(value) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, 18);
}

function getNameOrWarn() {
  const name = sanitizeName(dom.nameInput.value);
  if (!name) {
    setStatus("Enter your pilot name first.");
    dom.nameInput.focus();
    return null;
  }
  game.setPlayerName(name);
  return name;
}

function setStatus(message = "") {
  dom.menuStatus.textContent = message;
}

function showScreen(screen) {
  appState.currentScreen = screen;
  dom.menuHome.classList.toggle("hidden", screen !== "home");
  dom.menuMultiplayer.classList.toggle("hidden", screen !== "multiplayer");
  dom.menuJoin.classList.toggle("hidden", screen !== "join");
  dom.menuLobby.classList.toggle("hidden", screen !== "lobby");
}

function updateMenuAvailability() {
  const disabled = !appState.assetsReady;
  dom.singleplayerButton.disabled = disabled;
  dom.multiplayerButton.disabled = disabled;
  dom.singleplayerButton.textContent = disabled ? "Loading Visuals..." : "Single Player";
  dom.multiplayerButton.textContent = "Multiplayer";
}

function ensureSocket() {
  if (appState.socket && (appState.socket.readyState === WebSocket.OPEN || appState.socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
  const socket = new WebSocket(`${protocol}//${window.location.host}`);
  appState.socket = socket;

  socket.addEventListener("open", () => {
    appState.socketOpen = true;
    socket.send(JSON.stringify({ type: "requestLobbies" }));
  });

  socket.addEventListener("close", () => {
    appState.socketOpen = false;
    if (appState.currentLobby && !appState.multiplayerStarted) {
      setStatus("Connection lost. Reconnect and host or join again.");
      appState.currentLobby = null;
      showScreen("multiplayer");
    }
  });

  socket.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    handleSocketMessage(message);
  });
}

function sendMessage(payload) {
  ensureSocket();
  if (appState.socket?.readyState === WebSocket.OPEN) {
    appState.socket.send(JSON.stringify(payload));
  }
}

function renderLobbyList() {
  dom.lobbyList.innerHTML = "";

  if (appState.lobbyList.length === 0) {
    const empty = document.createElement("div");
    empty.className = "lobby-card empty";
    empty.textContent = "No open lobbies yet. Ask a friend to host one, or create your own.";
    dom.lobbyList.appendChild(empty);
    return;
  }

  for (const lobby of appState.lobbyList) {
    const card = document.createElement("div");
    card.className = "lobby-card";
    card.innerHTML = `
      <div>
        <strong>${lobby.hostName}</strong>
        <span>${lobby.playerCount} player${lobby.playerCount === 1 ? "" : "s"} in lobby</span>
      </div>
    `;

    const button = document.createElement("button");
    button.type = "button";
    button.className = "secondary-button join-now";
    button.textContent = "Join";
    button.addEventListener("click", () => {
      const name = getNameOrWarn();
      if (!name) {
        return;
      }
      sendMessage({ type: "joinLobby", lobbyId: lobby.id, name });
    });

    card.appendChild(button);
    dom.lobbyList.appendChild(card);
  }
}

function renderLobby(lobby) {
  appState.currentLobby = lobby;
  dom.lobbyTitle.textContent = lobby.hostId === appState.clientId ? "Your lobby is live" : `Joined ${lobby.hostName}'s lobby`;
  dom.lobbySubtitle.textContent = lobby.hostId === appState.clientId
    ? "Your friends will see this lobby in their join list while it stays open."
    : "Wait here until the host starts the match.";
  dom.lobbyIdValue.textContent = lobby.id;
  dom.lobbyCountValue.textContent = String(lobby.players.length);
  dom.startMatchButton.style.display = lobby.hostId === appState.clientId ? "inline-flex" : "none";
  dom.startMatchButton.disabled = lobby.players.length < 1;

  dom.lobbyPlayerList.innerHTML = "";
  for (const player of lobby.players) {
    const item = document.createElement("div");
    item.className = `player-card${player.id === lobby.hostId ? " host" : ""}`;
    item.innerHTML = `
      <div>
        <strong>${player.name}</strong>
        <span>${player.id === lobby.hostId ? "Host" : "Pilot"}</span>
      </div>
      <span>${player.id === appState.clientId ? "You" : "Connected"}</span>
    `;
    dom.lobbyPlayerList.appendChild(item);
  }
}

function handleSocketMessage(message) {
  switch (message.type) {
    case "welcome":
      appState.clientId = message.clientId;
      break;
    case "lobbyList":
      appState.lobbyList = message.lobbies || [];
      renderLobbyList();
      break;
    case "lobbyJoined":
      appState.currentLobby = message.lobby;
      appState.multiplayerStarted = false;
      renderLobby(message.lobby);
      showScreen("lobby");
      setStatus("");
      break;
    case "lobbyUpdate":
      appState.currentLobby = message.lobby;
      renderLobby(message.lobby);
      renderLobbyList();
      break;
    case "lobbyClosed":
      appState.currentLobby = null;
      appState.multiplayerStarted = false;
      game.notifyLobbyClosed();
      showScreen("multiplayer");
      setStatus(message.reason || "The lobby closed.");
      break;
    case "gameStarted": {
      const name = getNameOrWarn() || "Pilot";
      appState.currentLobby = message.lobby;
      appState.multiplayerStarted = true;
      game.configureMultiplayerSession({
        isHost: message.lobby.hostId === appState.clientId,
        localClientId: appState.clientId,
        hostClientId: message.lobby.hostId,
        name,
        players: message.lobby.players,
        sendSnapshot(snapshot) {
          sendMessage({ type: "worldSnapshot", snapshot });
        },
        sendInput(input) {
          if (message.lobby.hostId === appState.clientId) {
            return;
          }
          sendMessage({ type: "playerInput", input });
        },
      });
      if (message.lobby.hostId === appState.clientId) {
        game.startMultiplayerMatch();
      }
      dom.introOverlay.classList.add("hidden");
      break;
    }
    case "playerInput":
      game.receiveRemoteInput(message.playerId, message.input);
      break;
    case "worldSnapshot":
      game.receiveSnapshot(message.snapshot);
      break;
    case "error":
      setStatus(message.message || "Something went wrong.");
      break;
    default:
      break;
  }
}

dom.singleplayerButton.addEventListener("click", () => {
  const name = getNameOrWarn();
  if (!name || !appState.assetsReady) {
    return;
  }
  setStatus("");
  appState.currentLobby = null;
  appState.multiplayerStarted = false;
  game.startSinglePlayer(name);
});

dom.multiplayerButton.addEventListener("click", () => {
  const name = getNameOrWarn();
  if (!name || !appState.assetsReady) {
    return;
  }
  setStatus("");
  showScreen("multiplayer");
});

dom.hostGameButton.addEventListener("click", () => {
  const name = getNameOrWarn();
  if (!name) {
    return;
  }
  sendMessage({ type: "createLobby", name });
});

dom.joinGameButton.addEventListener("click", () => {
  const name = getNameOrWarn();
  if (!name) {
    return;
  }
  ensureSocket();
  sendMessage({ type: "requestLobbies" });
  showScreen("join");
});

dom.backToHomeButton.addEventListener("click", () => {
  showScreen("home");
  setStatus("");
});

dom.backToMultiplayerButton.addEventListener("click", () => {
  showScreen("multiplayer");
  setStatus("");
});

dom.refreshLobbiesButton.addEventListener("click", () => {
  sendMessage({ type: "requestLobbies" });
});

dom.leaveLobbyButton.addEventListener("click", () => {
  if (appState.currentLobby) {
    sendMessage({ type: "leaveLobby" });
  }
  appState.currentLobby = null;
  appState.multiplayerStarted = false;
  game.leaveToMenu();
  showScreen("multiplayer");
});

dom.startMatchButton.addEventListener("click", () => {
  sendMessage({ type: "startGame" });
});

window.addEventListener("game-assets-ready", () => {
  appState.assetsReady = true;
  updateMenuAvailability();
  setStatus("");
});

window.addEventListener("game-assets-failed", () => {
  appState.assetsReady = false;
  updateMenuAvailability();
  setStatus("Visual assets failed to load. Refresh and try again.");
});

updateMenuAvailability();
showScreen("home");
