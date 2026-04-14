# Changelog

All notable project updates will be tracked here with a version number so we can identify and roll back changes safely.

## v1.3.0 - 2026-04-12

- Added a required pilot-name step before starting a run.
- Added multiplayer menu flow with host game, join game, live lobby list, and lobby player roster.
- Added a Node/Express/WebSocket server for lobby discovery and online match relaying across devices on the same server.

## v1.2.0 - 2026-04-12

- Redesigned the player into a UFO-style spaceship sprite.
- Reworked each enemy into a more distinct alien silhouette instead of simple orb-like shapes.
- Updated the in-game copy so the presentation matches the new UFO-versus-aliens theme.

## v1.1.0 - 2026-04-12

- Added generated PNG sprite assets for the player, enemies, bullets, and XP shards.
- Reworked the battlefield into a richer space scene with nebula color, deeper star layers, and orbital ambience.
- Tidied the HUD and overlays so the screen layout feels cleaner and more polished during play.

## v1.0.0 - 2026-04-12

- Initial playable release of Neon Horde.
- Added the survivor-style gameplay loop with enemy waves, XP shard pickups, level-ups, and random upgrades.
- Added the local Node-based launch setup with `http-server` and `start-game.ps1`.
