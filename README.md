# BLINDSPOT — TWO TONE STUDIO

Puzzle d'infiltration en vue du dessus. **Le jour montre les murs, la nuit montre les gardes. Jamais les deux.**
Mémorise la géométrie de jour, observe les rondes de nuit, traverse au bon moment.

## Lancer

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # build de production dans dist/ (fichiers statiques)
npm test           # tests unitaires + validation de tous les niveaux
npm run typecheck
```

## Contrôles

| Action | Clavier | Mobile |
|---|---|---|
| Déplacement | ZQSD / WASD / flèches | joystick (toucher la moitié gauche) |
| Changer de vision | Espace (ou E) | bouton rond en bas à droite |
| Pause | Échap (ou P) | bouton ❚❚ |
| Recommencer | R | menu pause |

## Règles (identiques dans tous les niveaux)

- Un seul mode de vision à la fois. Après chaque bascule, **cooldown** (réglé par niveau, 2,5 à 3,5 s), affiché dans le HUD et autour du personnage.
- Un garde te voit si : distance ≤ 5 tuiles, tu es dans son cône (70°), et **aucun mur** ne coupe la ligne de vue (raycast sur la grille).
- Vu : la jauge de détection se remplit (≈ 0,75 s à portée maximale, plus vite de près), et se vide si tu te caches. Jauge pleine : échec. Contact direct : échec immédiat.
- **Mode HARDCORE** (bouton « Mode » sur l'écran titre et la sélection de niveaux) : être vu une seule fois = perdu, **4 bascules maximum par
  niveau** (`hardSwitches` pour l'ajuster), aucun cooldown. Les meilleurs temps sont séparés par mode.
- Gagner : atteindre la sortie (toujours visible, dans les deux modes).
- Les rondes sont déterministes : la position d'un garde est une fonction du temps. Aucun hasard.

## Architecture

```
src/
  core/      types, constantes, maths (aucune dépendance)
  systems/   logique pure, sans DOM : grid (murs, raycast, collisions), guard (GuardAI),
             detection (DetectionSystem), vision (VisionSystem), player (PlayerController),
             validator (LevelValidator)
  levels/    campagne (données) — LevelManager = parseLevel + LEVELS
  engine/    GameWorld (règles), GameEngine (boucle/écrans), InputController,
             AudioManager (WebAudio synthétisé), SaveSystem (localStorage)
  render/    Renderer (canvas 2D, lecture seule de l'état)
  ui/        UIController (menus + HUD DOM)
tests/       vitest
docs/        VALIDATION.md (suivi), design.md
```

Dépendances à sens unique : `core ← systems ← engine ← render/ui`. Le rendu ne modifie jamais l'état du jeu.
La logique pure est testable sans navigateur ; `GameWorld` exécute la vraie simulation dans les tests.

## Ajouter un niveau

Éditer `src/levels/levels.ts` (carte ASCII `#` mur, `S` départ, `E` sortie ; gardes = waypoints, vitesse, pauses, offset).
`npm test` vérifie automatiquement : carte valide, rondes ne traversant aucun mur, **niveau résoluble** (LevelValidator), non trivial
(≥ 1,5 s d'attente obligatoire sur la meilleure route), et rejoué par un bot avec la vraie physique.

Statistiques de chaque niveau : `npx vite-node scripts/stats.ts`.

## État

Voir [docs/VALIDATION.md](docs/VALIDATION.md) pour ce qui est testé, ce qui ne l'est pas, et les problèmes connus.
