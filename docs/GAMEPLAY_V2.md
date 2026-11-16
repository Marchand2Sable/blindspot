# Gameplay V2 — gardes, bascules, tutoriel, contrôles

## Trois types de gardes (et pas un de plus)
Définis dans `src/core/constants.ts` (`GUARD_KINDS`), choisis par garde avec `kind` dans un niveau.

| Type | Vitesse (cases/s) | Portée | Cône | Rôle | Repère visuel |
|---|---|---|---|---|---|
| Normal | 1,6 – 2,4 | 5 | 70° | garde de référence | silhouette standard |
| Lourd | 1,0 – 1,5 | 7,5 | 50° | lignes droites et espaces ouverts | silhouette 30 % plus grande + anneau |
| Léger | 2,5 – 3,4 | 3,4 | 90° | fenêtres courtes, patrouilles vives | silhouette 18 % plus petite |

Mêmes règles de détection pour tous (portée, cône, ligne de vue, jauge ou perte instantanée en Hardcore). Un niveau ne peut pas surcharger portée/cône : un test l'interdit, ainsi que les vitesses hors bande.
L'interface du niveau liste les types présents (nom, vitesse, vision, portée) sous l'objectif. L'écran « Repéré » nomme le type du garde qui t'a vu et donne le conseil adapté.

## Compteur de bascules (Hardcore)
Carte dédiée en haut à droite : libellé « Bascules », chiffre 40 px sur total, carrés pleins/vides, note qui rappelle que chaque changement de vision en consomme une.
- Consommation : la carte s'inverse un instant, « −1 » monte.
- Dernière bascule : carte inversée (papier sur encre) qui pulse, « Dernière bascule. Réfléchis avant de l'utiliser ».
- Zéro : carte en pointillé, chiffre barré, « Plus de bascule : tu restes en JOUR/NUIT », et un message à l'écran si on tente quand même.
Sur mobile la carte passe sous la ligne du mode de vision ; la zone de jeu (marge du haut) s'adapte à la hauteur réelle du HUD.

## Niveau 0 — tutoriel interactif
`src/levels/tutorial.ts` (niveau réel, règles CLASSIC) + `src/ui/Tutorial.ts`. 10 étapes avec mise en évidence (le reste est assombri), carte « Précédent / Suivant », points de progression, « Quitter le tutoriel ».
Étapes à action (« Suivant » reste grisé tant que l'action n'est pas faite) : passer en NUIT, observer la ronde, revenir en JOUR, traverser l'ouverture du mur, repasser en NUIT, atteindre la sortie. Étapes d'explication (jeu figé) : objectif, JOUR, murs invisibles, cooldown et bascules limitées, danger.
Dernière traversée en conditions réelles : si le garde te voit, retour au départ de la traversée avec un message, sans écran d'échec. Fin : « Commencer la campagne », « Rejouer le tutoriel », « Menu principal ». Rejouable depuis le menu (« Tutoriel ») et depuis la liste des niveaux (ligne 00). « Jouer » lance le tutoriel une seule fois pour un tout nouveau joueur.

## Contrôles
- **R** et le bouton « Réessayer / Recommencer » font la même chose : nouveau monde (joueur, gardes, trajectoires, jauge, bascules, vision JOUR). R fonctionnait en jeu et en pause mais PAS depuis l'écran « Repéré » (cause : le moteur était en mode « menu ») — corrigé.
- R, espace, échap sont ignorés dans un champ de saisie et avec Ctrl/Cmd/Alt (Ctrl+R recharge toujours la page). Pas de doublon : les répétitions de touche sont filtrées.
- Test navigateur réel : R depuis « Repéré » → joueur en (1,5 ; 1,5), temps ≈ 0, jauge 0, vision JOUR ; R dans un `<input>` et Ctrl+R sans effet sur le niveau.

## Nouveaux contrôles automatiques (tests)
`src/systems/audit.ts` + `tests/levels.test.ts` ('design contract') : aucun trajet hors vision (le NUIT est toujours utile), premières secondes équitables (pas de vue avant 2,5 s, aucun garde à moins de 2 cases), vitesses dans la bande du type, lourd/léger présents ≥ 3 niveaux et annoncés dans l'intent, plancher de difficulté croissant, part de niveaux avec route alternative, budgets Hardcore justifiés (`switchWhy`).
`npx vite-node scripts/audit.ts classic|hardcore` donne le tableau des niveaux.
