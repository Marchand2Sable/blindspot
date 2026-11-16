# BLINDSPOT — Rapport de validation (Phase 2, prototype)

Dernière mise à jour : 2026-11-14. Tout ce qui est marqué « réussi » a été exécuté pour de vrai.

## Fonctionnalités développées
Déplacement 8 directions analogique avec glissement sur les murs · collisions cercle/grille (sans traversée à haute vitesse) ·
vision JOUR/NUIT exclusive avec cooldown par niveau et transition (fondu + onde) · gardes déterministes (patrouilles aller-retour/boucle,
pauses, rotations progressives) · détection (portée, cône, ligne de vue par raycast, jauge, contact) · victoire/échec ·
6 niveaux · LevelValidator (recherche espace-temps) · rendu canvas monochrome · menus (titre, niveaux, paramètres, crédits, pause,
victoire, échec, fin) · HUD · commandes clavier + tactile · audio WebAudio synthétisé · sauvegarde localStorage.

## Tests automatiques (`npm test`) — 55/55 réussis
- Grille : cartes invalides rejetées, blocage et glissement, anti-traversée, raycast.
- Gardes : déterminisme, périodicité, vitesse, orientation, rotation sans saut, offset.
- Détection : portée, cône, **jamais à travers un mur**, durée de remplissage, décroissance, contact.
- Vision : cooldown, refus pendant le cooldown, exclusivité des deux couches d'information.
- GameWorld : victoire, échec, entrées ignorées après la fin. SaveSystem : persistance, JSON corrompu, plafond de déverrouillage.
- Niveaux (×6) : structure valide · rondes ne traversant aucun mur · résoluble (validateur) · non trivial (≥ 1,5 s d'attente) ·
  **solution de référence rejouée par un bot dans la vraie simulation continue : victoire sans échec**.

Autres vérifications : `tsc --noEmit` sans erreur ; `vite build` réussi.

## Vérifications dans le navigateur (manuelles, via le navigateur intégré)
Réussies : écran titre, niveau 1 en JOUR et en NUIT (murs invisibles la nuit, gardes et cône blanc, cône coupé par les murs),
transition, pause/reprise, refus de bascule pendant le cooldown, recommencer (R), écran d'échec (contact), écran de victoire,
sauvegarde dans localStorage, rendu mobile portrait avec joystick et bouton de vision.

## Ajouts du 2026-11-14 (soir)
- **Mode hardcore** : détection instantanée, 4 bascules, pas de cooldown, records par mode. Tests : échec immédiat, limite de bascules,
  mode normal inchangé, sauvegarde par mode, et **solution de référence rejouée par le bot en hardcore sur les 6 niveaux** (65/65 tests).
- **Bug trouvé par ces tests** : le validateur échantillonnait les gardes toutes les 0,25 s et ratait un garde en train de pivoter
  (cône qui balaie ~40° en 0,1 s) ; le bot était vu en hardcore sur L3 et L5. Correction : 4 instants par pas, et départ/milieu/arrivée
  vérifiés sûrs à chaque instant. Conséquence : L5 est devenu infaisable → rondes retravaillées (balayage de paramètres) ; L3 passe à 7 s d'attente.
- HUD d'en-tête : pastille sombre (claire en NUIT) au lieu du texte en mélange de couleurs, illisible sur fond clair.
- Non vérifié visuellement : hardcore sur les écrans de victoire/échec, dernière bascule refusée (couverte par test unitaire seulement).

## NON testé / limites (pas de faux positif)
- **Pas de test end-to-end automatisé** : Playwright n'est pas installé (téléchargement de navigateurs non effectué). Les vérifications
  navigateur ci-dessus ont été faites à la main, une fois. À faire : suite Playwright.
- Les tests de victoire/échec dans le navigateur ont utilisé des téléportations de joueur via `window.__blindspot` : ils valident les écrans
  et la sauvegarde, pas la jouabilité (celle-ci est couverte par le bot de niveau).
- Pas testé sur un vrai téléphone (seulement l'émulation 375×812). Le joystick tactile n'a pas été manipulé.
- Le son n'a pas été écouté (contexte audio créé, aucune erreur, mais jugement sonore non fait).
- Équilibrage du cooldown (2,5–3,5 s) : valeurs de départ, **pas encore éprouvées par des joueurs**.
- Paysage mobile non vérifié.

## Bugs connus / points d'attention
- Le cône de vision d'un garde est découpé par les murs : de nuit, sa forme révèle un peu la géométrie. Conséquence directe de la règle
  « les murs bloquent la vue » ; à garder ou à adoucir selon les tests de jeu.
- En portrait mobile le niveau est petit (limité par la largeur).
- La difficulté de L6 (3 gardes) n'a pas été jouée humainement : le validateur la déclare faisable avec 1,5 s d'attente seulement ; elle
  est peut-être trop facile.

## Décisions techniques
- TypeScript + Vite + Canvas 2D, zéro dépendance d'exécution. Logique pure séparée du rendu.
- Gardes = fonction pure du temps (pas d'état simulé) → patterns reproductibles et validables.
- Validateur plus strict que le jeu : cellules 4-voisins, pas de 0,25 s (le joueur réel est plus rapide), marges de détection (+0,4 tuile,
  +8°), distance minimale 0,95 tuile aux gardes, route jamais vue du tout.
- Bug trouvé et corrigé pendant la validation : le validateur ignorait le contact physique avec un garde (bot attrapé en sortant d'une alcôve) →
  ajout de la distance minimale.
- Niveaux L1/L3 trop faciles au premier jet (0 s d'attente) → rondes ajustées par balayage de paramètres jusqu'à ≥ 3 s d'attente.

## Prochaine étape
1. Faire jouer L1–L3 pour juger le cooldown (comparer 2 / 3 / 4 s) — priorité absolue de la brief.
2. Installer Playwright et automatiser les parcours navigateur.
3. Tester sur téléphone, puis Phase 3 (patrouilles en boucle, rotations de sentinelle) et Phase 4 (campagne).

## Refonte UI/UX (2026-11-14)
Audit initial : texte du HUD collé dans une pastille, capitales espacées partout, boutons tous encadrés, cartes de niveaux, aucun rythme
d'espacement, légende et toast qui se chevauchent, indice « ESPACE » affiché sur tactile.
Refonte : système typographique (serif d'affichage / sans / mono : Display, Heading, Subheading, Body, Caption, Micro), échelle d'espacement
4 px (`--s1..--s9`), une colonne éditoriale alignée sur une gouttière commune, boutons réduits à un bouton principal + liens, liste de niveaux
sans cartes, sélecteur de mode segmenté, interrupteurs de paramètres, HUD éditorial (« Chapitre 01 / Titre / Objectif ») sans cadre, indicateur
de vision (Jour = le chemin / Nuit = le danger) avec barre de recharge fine ou pastilles de bascules en hardcore, interface pilotée par
`body[data-vision]` (encre sur papier le jour, papier sur noir la nuit, fondu 0,35 s), entrées d'écran en cascade courte, réserves de marge du rendu
adaptées (HUD en haut, légende ou contrôles tactiles en bas).
Vérifié visuellement dans le navigateur : accueil (bureau 1280×760 et mobile 375×812), jeu JOUR et NUIT, pause, niveaux, échec, fin de campagne,
victoire (affichée directement). Non vérifié : tablette, paysage mobile, vrai appareil tactile, `prefers-reduced-motion`, contraste mesuré (jugé à l'œil).
Pas de captures « avant/après » archivées : comparaison faite à l'œil à partir des écrans d'avant la refonte.

## Refonte minimaliste « Less UI. More identity. » (2026-11-14)
- **Design system** : `src/design/tokens.css` (réutilisable par les futurs jeux du studio) centralise palette (8 gris du brief), rôles de couleur, une seule famille
  (Inter variable, embarquée via `@fontsource-variable/inter`, aucune police serif), échelle Display / Heading / Nav / Title / Body / Caption / Micro, graisses,
  espacements 4 px, rayons, traits, durées, courbe. `styles.css` n'utilise plus que ces variables.
- **Composition** : écrans sans cartes ni cadres ni verre ni halo ; menu en texte (poids et contraste pour la hiérarchie) ; sélecteur de mode souligné ;
  liste de niveaux sans conteneur ; interrupteurs fins ; un seul bouton plein par écran.
- **HUD** : « Niveau 06 / Titre / Objectif » discret en haut à gauche ; à droite un marqueur géométrique (carré plein = JOUR, carré creux = NUIT), le nom du mode,
  une seule ligne fine de recharge (ou pastilles carrées en hardcore) ; une seule famille d'icônes (carrés, barres, cercles).
- **Dualité** : le JOUR est désormais un monde sombre (fond #252525, sol anthracite #454545, murs #171717, personnage noir cerclé de clair) ; la NUIT est le vide #171717
  où seuls les gardes blancs, leurs cônes et la sortie subsistent. Retiré : vignette, halo de la sortie, projecteur autour du joueur.
- Vérifié dans le navigateur : accueil, jeu JOUR et NUIT, sélection de niveaux (bureau 1280×760), accueil et jeu mobile 375×812. Tests unitaires 29/29, `tsc`, build OK.
- Non revérifié après cette refonte : écrans pause / échec / victoire / paramètres / crédits (même composants, non rouverts), tablette, paysage mobile, vrai appareil.
  Contraste jugé à l'œil (aucune mesure WCAG). Les tests de niveaux ne sont pas relancés ici : les deux campagnes sont en cours de réécriture par les level designers.
