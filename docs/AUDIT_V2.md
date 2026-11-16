# Audit initial (avant la refonte « Level Design Overhaul »)

Mesuré avec `npx vite-node scripts/audit.ts classic|hardcore` et `scripts/stats.ts`.

## Diagnostic
- **Contournement du switch** : seul CLASSIC C06 « Impasses » a un trajet de 60 cases qu'aucun garde ne voit jamais (le joueur peut ne jamais regarder la NUIT). Les autres niveaux n'ont pas de trajet entièrement hors vision.
- **Début trop facile** : scores de difficulté mesurés C01 5.2, C02 5.0, C03 9 ; H01 7.1, H02 8.1. Les 3 premiers niveaux CLASSIC se traversent en 4 à 5 s d'attente.
- **Apparitions injustes (premières secondes)** : H04 — un garde voit un joueur immobile au départ après 0,85 s ; H06 2,1 s ; H03 — un garde passe à 1,8 case du départ en 2,5 s ; C02 un garde à 2,0 cases.
- **Routes alternatives** : seulement 23 % des niveaux CLASSIC et 8 % des HARDCORE gardent une solution quand on bloque le milieu de la route de référence (beaucoup de couloirs uniques).
- **Gardes** : pas de types — les vitesses (1,0 à 3,0) et les portées (3 / 5 / 8) varient sans identité lisible.
- **Bascules HARDCORE** : budgets 3-6 décidés à l'intuition, sans justification écrite.
- **Contrôles** : la touche R ne relançait pas le niveau depuis l'écran « Repéré » (seul le bouton marchait).
