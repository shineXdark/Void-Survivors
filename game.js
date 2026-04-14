const canvas = document.getElementById("game-canvas");
const ctx = canvas.getContext("2d");

const ui = {
  level: document.getElementById("level-value"),
  hp: document.getElementById("hp-value"),
  timer: document.getElementById("timer-value"),
  enemies: document.getElementById("enemy-value"),
  xpText: document.getElementById("xp-text"),
  xpFill: document.getElementById("xp-fill"),
  introOverlay: document.getElementById("intro-overlay"),
  levelupOverlay: document.getElementById("levelup-overlay"),
  gameoverOverlay: document.getElementById("gameover-overlay"),
  upgradeOptions: document.getElementById("upgrade-options"),
  gameoverTitle: document.getElementById("gameover-title"),
  gameoverSummary: document.getElementById("gameover-summary"),
  restartButton: document.getElementById("restart-button"),
};

const viewport = {
  width: window.innerWidth,
  height: window.innerHeight,
  dpr: Math.min(window.devicePixelRatio || 1, 2),
};

const state = {
  started: false,
  running: false,
  levelUpActive: false,
  gameOver: false,
  assetsReady: false,
  mode: "menu",
  multiplayer: false,
  isHost: false,
  localClientId: null,
  hostClientId: null,
  playerName: "Pilot",
  snapshotTimer: 0,
  sendSnapshot: null,
  sendInput: null,
  lastFrame: 0,
  elapsed: 0,
  spawnTimer: 0,
  levelQueue: 0,
  screenShake: 0,
  selectedUpgrades: [],
};

const keys = new Set();
const bullets = [];
const enemies = [];
const orbs = [];
const particles = [];
const shockwaves = [];
const remotePlayers = new Map();
const remoteInputs = new Map();
const spriteSources = {
  player: "./assets/sprites/player-ship.png",
  drifter: "./assets/sprites/enemy-drifter.png",
  rush: "./assets/sprites/enemy-rush.png",
  brute: "./assets/sprites/enemy-brute.png",
  shade: "./assets/sprites/enemy-shade.png",
  orb: "./assets/sprites/xp-orb.png",
  bullet: "./assets/sprites/bullet.png",
};
const sprites = {};
const farStars = createStarField(220, {
  spread: 3600,
  sizeMin: 0.35,
  sizeMax: 1.5,
  alphaMin: 0.18,
  alphaMax: 0.58,
  depthMin: 0.04,
  depthMax: 0.14,
  colors: ["#dff4ff", "#d2ddff", "#f5faff"],
});
const nearStars = createStarField(130, {
  spread: 2800,
  sizeMin: 0.9,
  sizeMax: 2.4,
  alphaMin: 0.28,
  alphaMax: 0.9,
  depthMin: 0.14,
  depthMax: 0.36,
  colors: ["#dff8ff", "#bfeaff", "#fff0d9"],
});
const nebulae = createNebulae(6);
const planets = createPlanets(5);

const enemyTypes = {
  drifter: {
    name: "Watcher",
    radius: 14,
    speed: 72,
    hp: 20,
    damage: 10,
    color: "#ff7d8e",
    glow: "#ff758f",
    xp: 1,
    sprite: "drifter",
  },
  rush: {
    name: "Stinger",
    radius: 11,
    speed: 110,
    hp: 16,
    damage: 8,
    color: "#ffc36b",
    glow: "#ffd989",
    xp: 1,
    sprite: "rush",
  },
  brute: {
    name: "Crusher",
    radius: 22,
    speed: 48,
    hp: 62,
    damage: 18,
    color: "#9d85ff",
    glow: "#c1b2ff",
    xp: 3,
    sprite: "brute",
  },
  shade: {
    name: "Phantom",
    radius: 16,
    speed: 86,
    hp: 34,
    damage: 12,
    color: "#69d7ff",
    glow: "#8de7ff",
    xp: 2,
    sprite: "shade",
  },
};

const upgradePool = [
  {
    id: "rapid-fire",
    title: "Rapid Fire",
    rarity: "Aggressive",
    description: "Your weapon cycles faster, letting you cut through dense packs.",
    apply(player) {
      player.fireRate *= 0.84;
    },
  },
  {
    id: "overcharge",
    title: "Overcharge Rounds",
    rarity: "Rare",
    description: "Every bullet hits harder and tears deeper into the horde.",
    apply(player) {
      player.damage += 8;
    },
  },
  {
    id: "multishot",
    title: "Twin Lattice",
    rarity: "Rare",
    description: "Add one more projectile to every volley with a slight spread.",
    apply(player) {
      player.multishot += 1;
    },
  },
  {
    id: "velocity",
    title: "Velocity Core",
    rarity: "Tech",
    description: "Projectiles travel faster and stay alive a little longer.",
    apply(player) {
      player.bulletSpeed += 85;
      player.bulletLife += 0.12;
    },
  },
  {
    id: "phase",
    title: "Phase Rounds",
    rarity: "Epic",
    description: "Bullets punch through an additional target before dissipating.",
    apply(player) {
      player.pierce += 1;
    },
  },
  {
    id: "mobility",
    title: "Afterburner Boots",
    rarity: "Utility",
    description: "Boost movement speed so you can kite and reposition cleanly.",
    apply(player) {
      player.speed += 26;
    },
  },
  {
    id: "vitality",
    title: "Vital Mesh",
    rarity: "Defense",
    description: "Increase max health and patch up a chunk immediately.",
    apply(player) {
      player.maxHp += 24;
      player.hp = Math.min(player.maxHp, player.hp + 24);
    },
  },
  {
    id: "magnet",
    title: "Gravity Well",
    rarity: "Utility",
    description: "Pull dropped energy shards from much farther away.",
    apply(player) {
      player.magnetRadius += 32;
    },
  },
  {
    id: "pulse",
    title: "Pulse Nova",
    rarity: "Epic",
    description: "Emit a damaging shockwave around you every few seconds.",
    apply(player) {
      player.pulseLevel += 1;
      player.pulseCooldown = Math.min(player.pulseCooldown, 0.9);
    },
  },
  {
    id: "resonance",
    title: "Resonance Shards",
    rarity: "Aggressive",
    description: "Energy shards are worth more, accelerating your future levels.",
    apply(player) {
      player.xpGain += 0.2;
    },
  },
];

let player = createPlayer();

function createPlayer() {
  return {
    id: "local",
    name: state.playerName,
    x: 0,
    y: 0,
    radius: 16,
    speed: 220,
    hp: 100,
    maxHp: 100,
    level: 1,
    xp: 0,
    xpToNext: 8,
    xpGain: 1,
    fireRate: 0.52,
    shootTimer: 0.12,
    damage: 14,
    bulletSpeed: 480,
    bulletLife: 1.1,
    multishot: 1,
    pierce: 0,
    magnetRadius: 100,
    invuln: 0,
    pulseLevel: 0,
    pulseCooldown: 2.2,
    pulseInterval: 2.6,
    facing: -Math.PI / 2,
  };
}

function createRemotePlayer(id, name) {
  return {
    id,
    name,
    x: randomRange(-80, 80),
    y: randomRange(-80, 80),
    radius: 16,
    speed: 210,
    hp: 100,
    maxHp: 100,
    invuln: 0,
    shootTimer: randomRange(0.08, 0.32),
    facing: -Math.PI / 2,
    respawnTimer: 0,
  };
}

function resizeCanvas() {
  viewport.width = window.innerWidth;
  viewport.height = window.innerHeight;
  viewport.dpr = Math.min(window.devicePixelRatio || 1, 2);
  canvas.width = Math.floor(viewport.width * viewport.dpr);
  canvas.height = Math.floor(viewport.height * viewport.dpr);
  canvas.style.width = `${viewport.width}px`;
  canvas.style.height = `${viewport.height}px`;
  ctx.setTransform(viewport.dpr, 0, 0, viewport.dpr, 0, 0);
}

function createStarField(count, options) {
  const {
    spread,
    sizeMin,
    sizeMax,
    alphaMin,
    alphaMax,
    depthMin,
    depthMax,
    colors,
  } = options;

  return Array.from({ length: count }, () => ({
    x: Math.random() * spread,
    y: Math.random() * spread,
    spread,
    size: randomRange(sizeMin, sizeMax),
    alpha: randomRange(alphaMin, alphaMax),
    depth: randomRange(depthMin, depthMax),
    color: colors[Math.floor(Math.random() * colors.length)],
    flicker: Math.random() * Math.PI * 2,
  }));
}

function createNebulae(count) {
  const colors = ["90,190,255", "104,244,212", "255,111,150", "171,145,255"];

  return Array.from({ length: count }, () => ({
    x: Math.random() * 3200,
    y: Math.random() * 3200,
    spread: 3200,
    radius: randomRange(180, 380),
    depth: randomRange(0.06, 0.18),
    alpha: randomRange(0.06, 0.13),
    color: randomChoice(colors),
  }));
}

function createPlanets(count) {
  return Array.from({ length: count }, () => ({
    x: Math.random() * 3400,
    y: Math.random() * 3400,
    spread: 3400,
    radius: randomRange(30, 90),
    depth: randomRange(0.05, 0.16),
    alpha: randomRange(0.16, 0.34),
    ring: Math.random() > 0.45,
    ringTilt: randomRange(-0.5, 0.5),
    colorA: randomChoice(["#395a8f", "#4e3d89", "#6e4f9d", "#1e5b74"]),
    colorB: randomChoice(["#7ed2ff", "#ccb7ff", "#89f0d4", "#ff9abe"]),
  }));
}

function resetGame() {
  bullets.length = 0;
  enemies.length = 0;
  orbs.length = 0;
  particles.length = 0;
  shockwaves.length = 0;
  remoteInputs.clear();

  for (const [id, actor] of remotePlayers) {
    actor.x = randomRange(-80, 80);
    actor.y = randomRange(-80, 80);
    actor.hp = actor.maxHp;
    actor.invuln = 0;
    actor.respawnTimer = 0;
    actor.facing = -Math.PI / 2;
    actor.shootTimer = randomRange(0.08, 0.32);
  }

  player = createPlayer();
  player.id = state.localClientId || "local";
  player.name = state.playerName;

  state.running = false;
  state.levelUpActive = false;
  state.gameOver = false;
  state.elapsed = 0;
  state.spawnTimer = 0.25;
  state.levelQueue = 0;
  state.screenShake = 0;
  state.snapshotTimer = 0;
  state.selectedUpgrades = [];
  state.lastFrame = performance.now();

  ui.levelupOverlay.classList.add("hidden");
  ui.gameoverOverlay.classList.add("hidden");
  updateHud();
}

function beginRun() {
  if (!state.assetsReady) {
    return;
  }
  if (!state.started) {
    state.started = true;
  }
  resetGame();
  ui.introOverlay.classList.add("hidden");
  state.mode = "playing";
  state.running = true;
}

function restartRun() {
  beginRun();
}

function updateHud() {
  ui.level.textContent = String(player.level);
  ui.hp.textContent = `${Math.ceil(player.hp)} / ${player.maxHp}`;
  ui.timer.textContent = formatTime(state.elapsed);
  ui.enemies.textContent = String(enemies.length);
  ui.xpText.textContent = `${Math.floor(player.xp)} / ${player.xpToNext}`;
  ui.xpFill.style.width = `${clamp((player.xp / player.xpToNext) * 100, 0, 100)}%`;
}

function formatTime(seconds) {
  const total = Math.max(0, Math.floor(seconds));
  const mins = String(Math.floor(total / 60)).padStart(2, "0");
  const secs = String(total % 60).padStart(2, "0");
  return `${mins}:${secs}`;
}

function xpForLevel(level) {
  return Math.floor(8 + (level - 1) * 4.5);
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function randomRange(min, max) {
  return min + Math.random() * (max - min);
}

function randomChoice(values) {
  return values[Math.floor(Math.random() * values.length)];
}

function wrapParallax(value, span) {
  return ((value % span) + span) % span;
}

function getLivingActors() {
  const actors = [player];
  for (const remote of remotePlayers.values()) {
    actors.push(remote);
  }
  return actors.filter((actor) => actor.hp > 0);
}

function getAllActors() {
  return [player, ...remotePlayers.values()];
}

function getAverageActorPosition() {
  const actors = getLivingActors();
  if (actors.length === 0) {
    return { x: player.x, y: player.y };
  }

  let sumX = 0;
  let sumY = 0;
  for (const actor of actors) {
    sumX += actor.x;
    sumY += actor.y;
  }

  return {
    x: sumX / actors.length,
    y: sumY / actors.length,
  };
}

function readLocalInput() {
  const input = { x: 0, y: 0 };
  if (keys.has("KeyW") || keys.has("ArrowUp")) input.y -= 1;
  if (keys.has("KeyS") || keys.has("ArrowDown")) input.y += 1;
  if (keys.has("KeyA") || keys.has("ArrowLeft")) input.x -= 1;
  if (keys.has("KeyD") || keys.has("ArrowRight")) input.x += 1;
  return input;
}

function moveActor(actor, input, dt) {
  if (!actor || actor.hp <= 0) {
    return;
  }
  if (input.x !== 0 || input.y !== 0) {
    const length = Math.hypot(input.x, input.y);
    actor.x += (input.x / length) * actor.speed * dt;
    actor.y += (input.y / length) * actor.speed * dt;
  }
}

function findNearestEnemyFrom(actor) {
  let nearest = null;
  let nearestDistance = Infinity;

  for (const enemy of enemies) {
    const dx = enemy.x - actor.x;
    const dy = enemy.y - actor.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistance) {
      nearestDistance = distSq;
      nearest = enemy;
    }
  }

  return nearest;
}

function findNearestActorForEnemy(enemy) {
  let nearest = player;
  let nearestDistance = Infinity;

  for (const actor of getLivingActors()) {
    const dx = actor.x - enemy.x;
    const dy = actor.y - enemy.y;
    const distSq = dx * dx + dy * dy;
    if (distSq < nearestDistance) {
      nearestDistance = distSq;
      nearest = actor;
    }
  }

  return nearest;
}

function pickUpgradeChoices() {
  const pool = [...upgradePool];
  for (let i = pool.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [pool[i], pool[j]] = [pool[j], pool[i]];
  }
  return pool.slice(0, 3);
}

function showLevelUp() {
  state.running = false;
  state.levelUpActive = true;
  state.selectedUpgrades = pickUpgradeChoices();
  ui.upgradeOptions.innerHTML = "";

  state.selectedUpgrades.forEach((upgrade) => {
    const button = document.createElement("button");
    button.type = "button";
    button.className = "upgrade-option";
    button.innerHTML = `
      <span class="rarity">${upgrade.rarity}</span>
      <h3>${upgrade.title}</h3>
      <p>${upgrade.description}</p>
    `;
    button.addEventListener("click", () => applyUpgrade(upgrade));
    ui.upgradeOptions.appendChild(button);
  });

  ui.levelupOverlay.classList.remove("hidden");
}

function applyUpgrade(upgrade) {
  upgrade.apply(player);
  state.levelQueue = Math.max(0, state.levelQueue - 1);
  state.levelUpActive = false;
  ui.levelupOverlay.classList.add("hidden");
  updateHud();

  if (state.levelQueue > 0) {
    showLevelUp();
  } else {
    state.running = true;
  }
}

function gainXp(amount) {
  player.xp += amount * player.xpGain;
  while (player.xp >= player.xpToNext) {
    player.xp -= player.xpToNext;
    player.level += 1;
    player.xpToNext = xpForLevel(player.level);
    state.levelQueue += 1;
  }

  updateHud();

  if (state.levelQueue > 0 && !state.levelUpActive && !state.gameOver) {
    showLevelUp();
  }
}

function spawnEnemy() {
  if (enemies.length > 260) {
    return;
  }

  const difficulty = 1 + state.elapsed / 42;
  const roll = Math.random();
  let type = enemyTypes.drifter;

  if (state.elapsed > 90 && roll > 0.78) {
    type = enemyTypes.shade;
  } else if (state.elapsed > 50 && roll > 0.66) {
    type = enemyTypes.brute;
  } else if (state.elapsed > 20 && roll > 0.4) {
    type = enemyTypes.rush;
  }

  const angle = Math.random() * Math.PI * 2;
  const distance = Math.max(viewport.width, viewport.height) * 0.65 + Math.random() * 220;
  const anchor = getAverageActorPosition();

  enemies.push({
    type: type.name,
    x: anchor.x + Math.cos(angle) * distance,
    y: anchor.y + Math.sin(angle) * distance,
    radius: type.radius,
    speed: type.speed * Math.min(2.4, 0.92 + difficulty * 0.16),
    hp: type.hp * Math.min(3.4, 0.94 + difficulty * 0.18),
    maxHp: type.hp * Math.min(3.4, 0.94 + difficulty * 0.18),
    damage: type.damage,
    color: type.color,
    glow: type.glow,
    xp: type.xp,
    sprite: type.sprite,
    wobble: Math.random() * Math.PI * 2,
  });
}

function currentSpawnInterval() {
  return clamp(0.82 - state.elapsed * 0.0044, 0.13, 0.82);
}

function findNearestEnemy() {
  return findNearestEnemyFrom(player);
}

function shootVolleyFor(actor, statsSource = player) {
  const target = findNearestEnemyFrom(actor);
  let angle = actor.facing;

  if (target) {
    angle = Math.atan2(target.y - actor.y, target.x - actor.x);
  }

  actor.facing = angle;

  const shots = statsSource.multishot;
  const spread = shots === 1 ? 0 : 0.2;

  for (let i = 0; i < shots; i += 1) {
    const offset = (i - (shots - 1) / 2) * spread;
    const shotAngle = angle + offset;
    bullets.push({
      x: actor.x + Math.cos(shotAngle) * 18,
      y: actor.y + Math.sin(shotAngle) * 18,
      vx: Math.cos(shotAngle) * statsSource.bulletSpeed,
      vy: Math.sin(shotAngle) * statsSource.bulletSpeed,
      angle: shotAngle,
      damage: statsSource.damage,
      radius: 5,
      life: statsSource.bulletLife,
      pierce: statsSource.pierce,
    });
  }

  for (let i = 0; i < 5; i += 1) {
    particles.push({
      x: actor.x + Math.cos(angle) * 20,
      y: actor.y + Math.sin(angle) * 20,
      vx: Math.cos(angle + randomRange(-0.3, 0.3)) * randomRange(60, 120),
      vy: Math.sin(angle + randomRange(-0.3, 0.3)) * randomRange(60, 120),
      life: randomRange(0.12, 0.24),
      maxLife: 0.24,
      size: randomRange(2, 4.5),
      color: "99,245,200",
    });
  }
}

function emitPulse() {
  const radius = 110 + player.pulseLevel * 18;
  const damage = 15 + player.pulseLevel * 8;

  shockwaves.push({
    x: player.x,
    y: player.y,
    radius: 24,
    maxRadius: radius,
    alpha: 0.9,
  });

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    const dx = enemy.x - player.x;
    const dy = enemy.y - player.y;
    const distance = Math.hypot(dx, dy);
    if (distance <= radius + enemy.radius) {
      enemy.hp -= damage;
      const force = clamp((radius - distance) * 3.4, 40, 180);
      enemy.x += (dx / Math.max(distance, 1)) * force * 0.04;
      enemy.y += (dy / Math.max(distance, 1)) * force * 0.04;
      spawnHitParticles(enemy.x, enemy.y, enemy.glow, 7);
      if (enemy.hp <= 0) {
        enemyDefeated(enemy, i);
      }
    }
  }

  state.screenShake = Math.max(state.screenShake, 9);
}

function spawnHitParticles(x, y, glow, count) {
  const rgb = hexToRgb(glow);
  for (let i = 0; i < count; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(50, 180);
    particles.push({
      x,
      y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.25, 0.5),
      maxLife: 0.5,
      size: randomRange(2, 5.5),
      color: `${rgb.r},${rgb.g},${rgb.b}`,
    });
  }
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const value = Number.parseInt(clean, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function enemyDefeated(enemy, index) {
  spawnHitParticles(enemy.x, enemy.y, enemy.glow, 12);
  state.screenShake = Math.max(state.screenShake, enemy.radius > 20 ? 8 : 4);

  const orbCount = enemy.xp;
  for (let i = 0; i < orbCount; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * 12;
    orbs.push({
      x: enemy.x + Math.cos(angle) * distance,
      y: enemy.y + Math.sin(angle) * distance,
      vx: Math.cos(angle) * randomRange(18, 44),
      vy: Math.sin(angle) * randomRange(18, 44),
      value: 1,
      radius: 7,
      life: 12,
    });
  }

  enemies.splice(index, 1);
}

function takeDamageActor(actor, amount) {
  if (!actor || actor.invuln > 0 || state.gameOver) {
    return;
  }

  actor.hp -= amount;
  actor.invuln = 0.55;
  state.screenShake = Math.max(state.screenShake, 12);

  for (let i = 0; i < 16; i += 1) {
    const angle = Math.random() * Math.PI * 2;
    const speed = randomRange(80, 180);
    particles.push({
      x: actor.x,
      y: actor.y,
      vx: Math.cos(angle) * speed,
      vy: Math.sin(angle) * speed,
      life: randomRange(0.3, 0.6),
      maxLife: 0.6,
      size: randomRange(2, 5),
      color: "255,125,142",
    });
  }

  if (actor.hp <= 0) {
    actor.hp = 0;
    if (actor === player) {
      gameOver();
    } else {
      actor.respawnTimer = 3;
    }
  }

  updateHud();
}

function gameOver() {
  state.running = false;
  state.gameOver = true;
  ui.gameoverTitle.textContent = "The horde swallowed the arena.";
  ui.gameoverSummary.textContent = `Level ${player.level}. Survived ${formatTime(state.elapsed)}. Build another run and push it further.`;
  ui.gameoverOverlay.classList.remove("hidden");

  if (state.multiplayer && state.isHost && typeof state.sendSnapshot === "function") {
    state.sendSnapshot(buildWorldSnapshot());
  }
}

function update(dt) {
  state.elapsed += dt;
  state.screenShake = Math.max(0, state.screenShake - dt * 18);
  player.invuln = Math.max(0, player.invuln - dt);
  player.pulseCooldown -= dt;

  const input = readLocalInput();
  moveActor(player, input, dt);

  if (state.multiplayer && typeof state.sendInput === "function") {
    state.sendInput(input);
  }

  for (const remote of remotePlayers.values()) {
    remote.invuln = Math.max(0, remote.invuln - dt);
    if (remote.hp <= 0) {
      remote.respawnTimer -= dt;
      if (remote.respawnTimer <= 0) {
        remote.hp = remote.maxHp;
        remote.x = player.x + randomRange(-80, 80);
        remote.y = player.y + randomRange(-80, 80);
      }
      continue;
    }

    if (state.multiplayer && state.isHost) {
      const remoteInput = remoteInputs.get(remote.id) || { x: 0, y: 0 };
      moveActor(remote, remoteInput, dt);
      remote.shootTimer -= dt;
      while (remote.shootTimer <= 0) {
        shootVolleyFor(remote, player);
        remote.shootTimer += player.fireRate;
      }
    }
  }

  for (const actor of getLivingActors()) {
    if (Math.random() < 0.22) {
      particles.push({
        x: actor.x + randomRange(-8, 8),
        y: actor.y + randomRange(-8, 8),
        vx: randomRange(-8, 8),
        vy: randomRange(-8, 8),
        life: 0.35,
        maxLife: 0.35,
        size: randomRange(3, 6),
        color: actor.invuln > 0 ? "255,125,142" : actor === player ? "99,245,200" : "145,230,255",
      });
    }
  }

  player.shootTimer -= dt;
  while (player.shootTimer <= 0) {
    shootVolleyFor(player, player);
    player.shootTimer += player.fireRate;
  }

  if (player.pulseLevel > 0 && player.pulseCooldown <= 0) {
    emitPulse();
    player.pulseCooldown += Math.max(0.75, player.pulseInterval - player.pulseLevel * 0.2);
  }

  state.spawnTimer -= dt;
  while (state.spawnTimer <= 0) {
    spawnEnemy();
    state.spawnTimer += currentSpawnInterval();
  }

  for (let i = bullets.length - 1; i >= 0; i -= 1) {
    const bullet = bullets[i];
    bullet.x += bullet.vx * dt;
    bullet.y += bullet.vy * dt;
    bullet.life -= dt;

    let removeBullet = bullet.life <= 0;
    for (let j = enemies.length - 1; j >= 0 && !removeBullet; j -= 1) {
      const enemy = enemies[j];
      const dx = bullet.x - enemy.x;
      const dy = bullet.y - enemy.y;
      const totalRadius = bullet.radius + enemy.radius;
      if (dx * dx + dy * dy <= totalRadius * totalRadius) {
        enemy.hp -= bullet.damage;
        spawnHitParticles(bullet.x, bullet.y, enemy.glow, 4);
        if (enemy.hp <= 0) {
          enemyDefeated(enemy, j);
        }

        if (bullet.pierce > 0) {
          bullet.pierce -= 1;
        } else {
          removeBullet = true;
        }
      }
    }

    if (removeBullet) {
      bullets.splice(i, 1);
    }
  }

  for (let i = enemies.length - 1; i >= 0; i -= 1) {
    const enemy = enemies[i];
    enemy.wobble += dt * 5;

    const target = findNearestActorForEnemy(enemy);
    const dx = target.x - enemy.x;
    const dy = target.y - enemy.y;
    const dist = Math.hypot(dx, dy) || 1;

    let moveX = dx / dist;
    let moveY = dy / dist;

    if (enemy.sprite === "shade") {
      moveX += Math.cos(enemy.wobble) * 0.16;
      moveY += Math.sin(enemy.wobble) * 0.16;
    }

    enemy.x += moveX * enemy.speed * dt;
    enemy.y += moveY * enemy.speed * dt;

    if (dist < enemy.radius + target.radius + 6) {
      takeDamageActor(target, enemy.damage);
      enemy.x -= moveX * 16;
      enemy.y -= moveY * 16;
    }
  }

  for (let i = orbs.length - 1; i >= 0; i -= 1) {
    const orb = orbs[i];
    orb.life -= dt;
    orb.x += orb.vx * dt;
    orb.y += orb.vy * dt;
    orb.vx *= 0.97;
    orb.vy *= 0.97;

    let collector = null;
    let dist = Infinity;
    for (const actor of getLivingActors()) {
      const dx = actor.x - orb.x;
      const dy = actor.y - orb.y;
      const candidateDist = Math.hypot(dx, dy) || 1;
      if (candidateDist < dist) {
        dist = candidateDist;
        collector = actor;
      }
    }

    if (collector && dist < player.magnetRadius) {
      const dx = collector.x - orb.x;
      const dy = collector.y - orb.y;
      const pull = clamp((player.magnetRadius - dist) * 7, 30, 420);
      orb.vx += (dx / dist) * pull * dt;
      orb.vy += (dy / dist) * pull * dt;
    }

    if (collector && dist < collector.radius + orb.radius + 8) {
      gainXp(orb.value);
      spawnHitParticles(orb.x, orb.y, "#63f5c8", 5);
      orbs.splice(i, 1);
      continue;
    }

    if (orb.life <= 0) {
      orbs.splice(i, 1);
    }
  }

  for (let i = shockwaves.length - 1; i >= 0; i -= 1) {
    const wave = shockwaves[i];
    wave.radius += dt * 260;
    wave.alpha -= dt * 1.6;
    if (wave.radius >= wave.maxRadius || wave.alpha <= 0) {
      shockwaves.splice(i, 1);
    }
  }

  for (let i = particles.length - 1; i >= 0; i -= 1) {
    const particle = particles[i];
    particle.life -= dt;
    particle.x += particle.vx * dt;
    particle.y += particle.vy * dt;
    particle.vx *= 0.96;
    particle.vy *= 0.96;
    if (particle.life <= 0) {
      particles.splice(i, 1);
    }
  }

  if (state.multiplayer && state.isHost && typeof state.sendSnapshot === "function") {
    state.snapshotTimer -= dt;
    if (state.snapshotTimer <= 0) {
      state.snapshotTimer = 0.08;
      state.sendSnapshot(buildWorldSnapshot());
    }
  }

  updateHud();
}

function worldToScreen(x, y, camera) {
  return {
    x: x - camera.x + viewport.width / 2,
    y: y - camera.y + viewport.height / 2,
  };
}

function renderBackground(camera) {
  ctx.clearRect(0, 0, viewport.width, viewport.height);

  const gradient = ctx.createLinearGradient(0, 0, 0, viewport.height);
  gradient.addColorStop(0, "#050915");
  gradient.addColorStop(0.56, "#0a1222");
  gradient.addColorStop(1, "#12091a");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, viewport.width, viewport.height);

  renderNebulae(camera);
  renderPlanets(camera);
  renderStars(farStars, camera);
  renderGrid(camera);
  renderStars(nearStars, camera);

  const vignette = ctx.createRadialGradient(
    viewport.width / 2,
    viewport.height / 2,
    Math.min(viewport.width, viewport.height) * 0.1,
    viewport.width / 2,
    viewport.height / 2,
    Math.max(viewport.width, viewport.height) * 0.68
  );
  vignette.addColorStop(0, "rgba(0, 0, 0, 0)");
  vignette.addColorStop(1, "rgba(0, 0, 0, 0.42)");
  ctx.fillStyle = vignette;
  ctx.fillRect(0, 0, viewport.width, viewport.height);
}

function renderNebulae(camera) {
  for (const nebula of nebulae) {
    const screenX = wrapParallax(nebula.x - camera.x * nebula.depth, nebula.spread);
    const screenY = wrapParallax(nebula.y - camera.y * nebula.depth, nebula.spread);
    const gradient = ctx.createRadialGradient(screenX, screenY, 0, screenX, screenY, nebula.radius);
    gradient.addColorStop(0, `rgba(${nebula.color}, ${nebula.alpha})`);
    gradient.addColorStop(1, `rgba(${nebula.color}, 0)`);
    ctx.fillStyle = gradient;
    ctx.beginPath();
    ctx.arc(screenX, screenY, nebula.radius, 0, Math.PI * 2);
    ctx.fill();
  }
}

function renderPlanets(camera) {
  for (const planet of planets) {
    const screenX = wrapParallax(planet.x - camera.x * planet.depth, planet.spread);
    const screenY = wrapParallax(planet.y - camera.y * planet.depth, planet.spread);

    ctx.save();
    ctx.globalAlpha = planet.alpha;

    const body = ctx.createRadialGradient(
      screenX - planet.radius * 0.35,
      screenY - planet.radius * 0.4,
      4,
      screenX,
      screenY,
      planet.radius
    );
    body.addColorStop(0, planet.colorB);
    body.addColorStop(1, planet.colorA);
    ctx.fillStyle = body;
    ctx.beginPath();
    ctx.arc(screenX, screenY, planet.radius, 0, Math.PI * 2);
    ctx.fill();

    if (planet.ring) {
      ctx.strokeStyle = "rgba(220, 235, 255, 0.32)";
      ctx.lineWidth = 5;
      ctx.beginPath();
      ctx.ellipse(screenX, screenY, planet.radius * 1.5, planet.radius * 0.44, planet.ringTilt, 0, Math.PI * 2);
      ctx.stroke();
    }

    ctx.restore();
  }
}

function renderStars(field, camera) {
  for (const star of field) {
    const screenX = wrapParallax(star.x - camera.x * star.depth, star.spread);
    const screenY = wrapParallax(star.y - camera.y * star.depth, star.spread);
    const pulse = Math.sin(state.elapsed * 0.7 + star.flicker) * 0.14 + 0.86;
    ctx.save();
    ctx.globalAlpha = star.alpha * pulse;
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(screenX, screenY, star.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}

function renderGrid(camera) {
  const gridSize = 100;
  const offsetX = (-camera.x % gridSize + gridSize) % gridSize;
  const offsetY = (-camera.y % gridSize + gridSize) % gridSize;
  ctx.strokeStyle = "rgba(190, 222, 255, 0.055)";
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = offsetX; x <= viewport.width; x += gridSize) {
    ctx.moveTo(x, 0);
    ctx.lineTo(x, viewport.height);
  }
  for (let y = offsetY; y <= viewport.height; y += gridSize) {
    ctx.moveTo(0, y);
    ctx.lineTo(viewport.width, y);
  }
  ctx.stroke();
}

function drawSpriteCentered(sprite, x, y, width, height, rotation = 0, alpha = 1) {
  if (!sprite || !sprite.complete) {
    return false;
  }
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(rotation);
  ctx.globalAlpha = alpha;
  ctx.drawImage(sprite, -width / 2, -height / 2, width, height);
  ctx.restore();
  return true;
}

function drawPilot(actor, camera, isRemote = false) {
  const screen = worldToScreen(actor.x, actor.y, camera);
  ctx.save();
  ctx.shadowColor = actor.invuln > 0 ? "#ff7d8e" : isRemote ? "#91e6ff" : "#63f5c8";
  ctx.shadowBlur = isRemote ? 20 : 30;
  const rendered = drawSpriteCentered(sprites.player, screen.x, screen.y, isRemote ? 50 : 56, isRemote ? 50 : 56, actor.facing);
  if (!rendered) {
    const fallback = ctx.createRadialGradient(screen.x - 5, screen.y - 7, 4, screen.x, screen.y, 28);
    fallback.addColorStop(0, "#ffffff");
    fallback.addColorStop(0.16, isRemote ? "#c8f4ff" : "#9effea");
    fallback.addColorStop(0.58, isRemote ? "#91e6ff" : "#63f5c8");
    fallback.addColorStop(1, isRemote ? "#356985" : "#208278");
    ctx.fillStyle = fallback;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, actor.radius, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();

  ctx.save();
  ctx.fillStyle = "rgba(244,248,255,0.92)";
  ctx.font = '600 13px "Space Grotesk", sans-serif';
  ctx.textAlign = "center";
  ctx.fillText(actor.name, screen.x, screen.y - 28);
  ctx.restore();
}

function buildWorldSnapshot() {
  return {
    elapsed: state.elapsed,
    level: player.level,
    xp: player.xp,
    xpToNext: player.xpToNext,
    gameOver: state.gameOver,
    gameoverTitle: ui.gameoverTitle.textContent,
    gameoverSummary: ui.gameoverSummary.textContent,
    players: getAllActors().map((actor) => ({
      id: actor.id,
      name: actor.name,
      x: actor.x,
      y: actor.y,
      hp: actor.hp,
      maxHp: actor.maxHp,
      facing: actor.facing,
      invuln: actor.invuln || 0,
    })),
    enemies: enemies.map((enemy) => ({
      type: enemy.type,
      x: enemy.x,
      y: enemy.y,
      radius: enemy.radius,
      hp: enemy.hp,
      maxHp: enemy.maxHp,
      glow: enemy.glow,
      color: enemy.color,
      sprite: enemy.sprite,
      wobble: enemy.wobble,
    })),
    bullets: bullets.map((bullet) => ({
      x: bullet.x,
      y: bullet.y,
      angle: bullet.angle,
      radius: bullet.radius,
    })),
    orbs: orbs.map((orb) => ({
      x: orb.x,
      y: orb.y,
      radius: orb.radius,
    })),
    shockwaves: shockwaves.map((wave) => ({
      x: wave.x,
      y: wave.y,
      radius: wave.radius,
      alpha: wave.alpha,
    })),
  };
}

function applyWorldSnapshot(snapshot) {
  if (!snapshot) {
    return;
  }

  state.elapsed = snapshot.elapsed || 0;
  player.level = snapshot.level || player.level;
  player.xp = snapshot.xp || 0;
  player.xpToNext = snapshot.xpToNext || player.xpToNext;

  const remoteIds = new Set();
  for (const actor of snapshot.players || []) {
    if (actor.id === state.localClientId) {
      player.id = actor.id;
      player.name = actor.name;
      player.x = actor.x;
      player.y = actor.y;
      player.hp = actor.hp;
      player.maxHp = actor.maxHp;
      player.facing = actor.facing;
      player.invuln = actor.invuln || 0;
      continue;
    }

    remoteIds.add(actor.id);
    const existing = remotePlayers.get(actor.id) || createRemotePlayer(actor.id, actor.name);
    existing.name = actor.name;
    existing.x = actor.x;
    existing.y = actor.y;
    existing.hp = actor.hp;
    existing.maxHp = actor.maxHp;
    existing.facing = actor.facing;
    existing.invuln = actor.invuln || 0;
    remotePlayers.set(actor.id, existing);
  }

  for (const id of [...remotePlayers.keys()]) {
    if (!remoteIds.has(id)) {
      remotePlayers.delete(id);
    }
  }

  enemies.length = 0;
  for (const enemy of snapshot.enemies || []) {
    enemies.push({ ...enemy });
  }

  bullets.length = 0;
  for (const bullet of snapshot.bullets || []) {
    bullets.push({ ...bullet });
  }

  orbs.length = 0;
  for (const orb of snapshot.orbs || []) {
    orbs.push({ ...orb, life: 1 });
  }

  shockwaves.length = 0;
  for (const wave of snapshot.shockwaves || []) {
    shockwaves.push({ ...wave, maxRadius: wave.radius + 1 });
  }

  if (snapshot.gameOver) {
    state.running = false;
    state.gameOver = true;
    ui.gameoverTitle.textContent = snapshot.gameoverTitle || "Run complete";
    ui.gameoverSummary.textContent = snapshot.gameoverSummary || "";
    ui.gameoverOverlay.classList.remove("hidden");
  }

  updateHud();
}

function renderWorld(camera) {
  for (const orb of orbs) {
    const screen = worldToScreen(orb.x, orb.y, camera);
    const rendered = drawSpriteCentered(
      sprites.orb,
      screen.x,
      screen.y,
      orb.radius * 3.2,
      orb.radius * 3.2,
      state.elapsed * 3 + orb.x * 0.01
    );
    if (!rendered) {
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(state.elapsed * 3 + orb.x * 0.01);
      ctx.shadowColor = "rgba(99,245,200,0.8)";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#63f5c8";
      ctx.beginPath();
      ctx.moveTo(0, -orb.radius);
      ctx.lineTo(orb.radius, 0);
      ctx.lineTo(0, orb.radius);
      ctx.lineTo(-orb.radius, 0);
      ctx.closePath();
      ctx.fill();
      ctx.restore();
    }
  }

  for (const wave of shockwaves) {
    const screen = worldToScreen(wave.x, wave.y, camera);
    ctx.save();
    ctx.globalAlpha = wave.alpha;
    ctx.strokeStyle = "rgba(141,231,255,0.9)";
    ctx.lineWidth = 6;
    ctx.shadowBlur = 24;
    ctx.shadowColor = "rgba(141,231,255,0.8)";
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, wave.radius, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const enemy of enemies) {
    const screen = worldToScreen(enemy.x, enemy.y, camera);
    ctx.save();
    ctx.shadowColor = enemy.glow;
    ctx.shadowBlur = enemy.radius > 20 ? 30 : 22;
    const size = enemy.radius * (enemy.radius > 20 ? 2.65 : 2.8);
    const rendered = drawSpriteCentered(
      sprites[enemy.sprite],
      screen.x,
      screen.y,
      size,
      size,
      enemy.sprite === "shade" ? enemy.wobble * 0.1 : 0
    );
    if (!rendered) {
      const body = ctx.createRadialGradient(
        screen.x - enemy.radius * 0.4,
        screen.y - enemy.radius * 0.4,
        2,
        screen.x,
        screen.y,
        enemy.radius * 1.2
      );
      body.addColorStop(0, "#ffffff");
      body.addColorStop(0.18, enemy.glow);
      body.addColorStop(1, enemy.color);
      ctx.fillStyle = body;
      ctx.beginPath();
      ctx.arc(screen.x, screen.y, enemy.radius, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();

    const hpWidth = enemy.radius * 2.4;
    ctx.fillStyle = "rgba(255,255,255,0.1)";
    ctx.fillRect(screen.x - hpWidth / 2, screen.y + enemy.radius + 12, hpWidth, 4);
    ctx.fillStyle = "rgba(234, 244, 255, 0.72)";
    ctx.fillRect(screen.x - hpWidth / 2, screen.y + enemy.radius + 12, hpWidth * (enemy.hp / enemy.maxHp), 4);
  }

  for (const bullet of bullets) {
    const screen = worldToScreen(bullet.x, bullet.y, camera);
    const rendered = drawSpriteCentered(sprites.bullet, screen.x, screen.y, 24, 18, bullet.angle);
    if (!rendered) {
      ctx.save();
      ctx.translate(screen.x, screen.y);
      ctx.rotate(bullet.angle);
      ctx.shadowColor = "#8de7ff";
      ctx.shadowBlur = 18;
      ctx.fillStyle = "#c8f7ff";
      ctx.beginPath();
      ctx.arc(0, 0, bullet.radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  }

  for (const particle of particles) {
    const screen = worldToScreen(particle.x, particle.y, camera);
    ctx.save();
    ctx.globalAlpha = clamp(particle.life / particle.maxLife, 0, 1);
    ctx.fillStyle = `rgba(${particle.color}, 1)`;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }

  const screen = worldToScreen(player.x, player.y, camera);
  if (player.pulseLevel > 0) {
    ctx.save();
    ctx.strokeStyle = "rgba(99,245,200,0.18)";
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(screen.x, screen.y, 26 + player.pulseLevel * 3, 0, Math.PI * 2);
    ctx.stroke();
    ctx.restore();
  }

  for (const remote of remotePlayers.values()) {
    drawPilot(remote, camera, true);
  }

  drawPilot(player, camera, false);
}

function roundedPolygon(context, radius, sides, rotation) {
  for (let i = 0; i < sides; i += 1) {
    const angle = rotation + (i / sides) * Math.PI * 2;
    const x = Math.cos(angle) * radius;
    const y = Math.sin(angle) * radius;
    if (i === 0) {
      context.moveTo(x, y);
    } else {
      context.lineTo(x, y);
    }
  }
  context.closePath();
}

function render() {
  const shakeX = randomRange(-state.screenShake, state.screenShake);
  const shakeY = randomRange(-state.screenShake, state.screenShake);
  const camera = {
    x: player.x + shakeX,
    y: player.y + shakeY,
  };

  renderBackground(camera);
  renderWorld(camera);

  if (!state.started) {
    updateHud();
  }
}

function loop(timestamp) {
  const delta = Math.min((timestamp - state.lastFrame) / 1000, 0.033);
  state.lastFrame = timestamp;

  if (state.running && !state.levelUpActive && !state.gameOver && (!state.multiplayer || state.isHost || !state.started)) {
    update(delta);
  }

  render();
  requestAnimationFrame(loop);
}

function onKeyChange(event, isDown) {
  if (["Space", "ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(event.code)) {
    event.preventDefault();
  }
  if (isDown) {
    keys.add(event.code);
  } else {
    keys.delete(event.code);
  }
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.addEventListener("load", () => resolve(image));
    image.addEventListener("error", () => reject(new Error(`Failed to load ${src}`)));
    image.src = src;
  });
}

async function loadSprites() {
  const entries = await Promise.all(
    Object.entries(spriteSources).map(async ([key, src]) => [key, await loadImage(src)])
  );

  for (const [key, image] of entries) {
    sprites[key] = image;
  }

  state.assetsReady = true;
  window.dispatchEvent(new CustomEvent("game-assets-ready"));
}

function onAssetLoadFailure() {
  window.dispatchEvent(new CustomEvent("game-assets-failed"));
}

function syncLobbyPlayers(players) {
  const seen = new Set();

  for (const entry of players || []) {
    if (entry.id === state.localClientId) {
      player.id = entry.id;
      player.name = entry.name;
      seen.add(entry.id);
      continue;
    }

    seen.add(entry.id);
    const remote = remotePlayers.get(entry.id) || createRemotePlayer(entry.id, entry.name);
    remote.name = entry.name;
    remotePlayers.set(entry.id, remote);
  }

  for (const id of [...remotePlayers.keys()]) {
    if (!seen.has(id)) {
      remotePlayers.delete(id);
      remoteInputs.delete(id);
    }
  }
}

function clearMultiplayerState() {
  state.multiplayer = false;
  state.isHost = false;
  state.localClientId = null;
  state.hostClientId = null;
  state.sendSnapshot = null;
  state.sendInput = null;
  state.snapshotTimer = 0;
  remotePlayers.clear();
  remoteInputs.clear();
}

function returnToMenu() {
  state.running = false;
  state.started = false;
  state.levelUpActive = false;
  state.gameOver = false;
  state.mode = "menu";
  ui.levelupOverlay.classList.add("hidden");
  ui.gameoverOverlay.classList.add("hidden");
  ui.introOverlay.classList.remove("hidden");
}

const gameApi = {
  isAssetsReady() {
    return state.assetsReady;
  },
  setPlayerName(name) {
    const sanitized = String(name || "").trim().replace(/\s+/g, " ").slice(0, 18) || "Pilot";
    state.playerName = sanitized;
    player.name = sanitized;
  },
  startSinglePlayer(name) {
    clearMultiplayerState();
    this.setPlayerName(name);
    beginRun();
  },
  configureMultiplayerSession(options) {
    state.multiplayer = true;
    state.isHost = Boolean(options?.isHost);
    state.localClientId = options?.localClientId || null;
    state.hostClientId = options?.hostClientId || state.localClientId;
    state.sendSnapshot = options?.sendSnapshot || null;
    state.sendInput = options?.sendInput || null;
    this.setPlayerName(options?.name || state.playerName);
    syncLobbyPlayers(options?.players || []);
  },
  syncLobbyPlayers(players) {
    syncLobbyPlayers(players);
  },
  startMultiplayerMatch() {
    beginRun();
  },
  receiveRemoteInput(playerId, input) {
    if (!state.multiplayer || !state.isHost) {
      return;
    }
    remoteInputs.set(playerId, {
      x: Number(input?.x) || 0,
      y: Number(input?.y) || 0,
    });
  },
  receiveSnapshot(snapshot) {
    if (!state.multiplayer || state.isHost) {
      return;
    }
    state.running = true;
    state.started = true;
    state.mode = "playing";
    ui.introOverlay.classList.add("hidden");
    applyWorldSnapshot(snapshot);
  },
  leaveToMenu() {
    clearMultiplayerState();
    returnToMenu();
  },
  notifyLobbyClosed() {
    clearMultiplayerState();
    returnToMenu();
  },
};

window.NeonHordeGame = gameApi;

window.addEventListener("keydown", (event) => onKeyChange(event, true));
window.addEventListener("keyup", (event) => onKeyChange(event, false));
window.addEventListener("resize", resizeCanvas);

ui.restartButton.addEventListener("click", returnToMenu);

resizeCanvas();
resetGame();
render();
loadSprites().catch(onAssetLoadFailure);
requestAnimationFrame(loop);
