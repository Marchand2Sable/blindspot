# Changelog

All notable changes to BLINDSPOT. Format: [Keep a Changelog](https://keepachangelog.com/en/1.1.0/); versions: [Semantic Versioning](https://semver.org/) (see `VERSIONING.md`).

## [0.1.0] - 2026-11-16

First published version.

### Added
- Dual-vision top-down stealth puzzle (TypeScript, Vite, Canvas 2D): day shows the walls, night shows the guards, never both.
- CLASSIC campaign (22 levels, vision switch with a cooldown) and HARDCORE campaign (15 levels, one glance is fatal, a limited number of switches).
- Three guard types (normal, heavy, light) with their own range, field of view and speed, shown in the HUD legend.
- Interactive tutorial (level 0), restart with R, pause with Escape, volume slider and options reachable from the pause menu.
- Detection speeds up the closer the player is to the middle of a guard's view and the closer they are to the guard (CLASSIC).
- Touch controls (joystick and vision button) for phones.
- Every level is proven solvable by the validator and checked by the design-contract tests.
- Studio pipeline: CI, GitHub Pages preview, itch.io release through Butler, version and build checks (`scripts/`), and the documents `DEPLOYMENT.md`, `VERSIONING.md`, `RELEASE_PROCESS.md`.

### Technical
- One source of version: `package.json`. The build injects version, commit, date and channel (`src/buildinfo.ts`).
- `base: './'`: relative paths, so the same build runs under a GitHub Pages sub-path and in the itch.io iframe.
