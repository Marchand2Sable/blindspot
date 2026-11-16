# BLINDSPOT — Campagnes CLASSIC et HARDCORE (rapport de level design)

Date : 2026-11-14. Tout ce qui est marqué « vérifié » a été exécuté (voir `npm test`, 231 tests). Rien n'a été **joué par un humain** : voir « Limites ».

## 1. Audit des anciens niveaux
Avant : 6 niveaux CLASSIC, et **pas de campagne HARDCORE** (les mêmes 6 niveaux avec des règles plus dures).

| Niveau | Ouverture | Gardes | Cycles | Attente | Marge | Constat |
|---|---|---|---|---|---|---|
| L1 Seuil | 0,51 | 1 | 1 | 4,25 s | 3 | tutoriel correct |
| L2 Alcôves | 0 | 1 | 1 | 5,25 s | 1 | seule idée vraiment spatiale |
| L3 Croisement | 0,19 | 2 | 2 | 7 s | 3 | carrefour plat |
| L4 Piliers | 0,20 | 3 | 3 | 3 s | 3 | piliers à mémoriser, le reste est ouvert |
| L5 Sentinelle | 0,54 | 2 | 2 | 5 s | 3 | salles ouvertes, lignes droites |
| L6 Synchronie | 0,67 | 3 | 3 | 1,75 s | 3 | salle ouverte à 3 gardes : difficulté par le nombre, pas par le puzzle |

Problèmes : progression suivant le nombre de gardes ; aucun labyrinthe, aucune impasse stratégique ; une seule idée spatiale ; cycles distincts utilisés en surface ; le budget de bascules de HARDCORE jamais exploité. Les 6 niveaux ont été remplacés.

## 2. Outils de validation (nouveaux)
- `validateLevel(def, marges)` : recherche espace-temps, route **jamais vue** (gardes échantillonnés 4× par pas, départ/milieu/arrivée sûrs, distance minimale 0,95).
- Échelle de marges (`MARGIN_LADDER`) : la « marge d'erreur » d'un niveau (0–3) est le plus haut échelon encore résoluble. Test d'équité : échelon 1 obligatoire.
- `measure(def)` (`src/systems/metrics.ts`) : ouverture, jonctions, impasses, cycles distincts, temps de résolution, attente, phases d'attente, déplacements, marge, score.
- **Score = aide au classement**, pondérations provisoires (`WEIGHTS`), à ajuster après tests de jeu. Il ne mesure pas le plaisir.
- Tests par niveau : métadonnées complètes, rondes hors des murs, solvable, ≥ 1,5 s d'attente, équité (échelon 1), bot rejouant la solution dans la vraie simulation (règles de la campagne). Tests de campagne : ids uniques, cibles de difficulté ≈ croissantes, **aucune paire de niveaux dont les murs intérieurs se ressemblent à ≥ 0,7** (les deux campagnes ensemble).
- Commande : `npx vite-node scripts/stats.ts classic|hardcore`.

## 3. CLASSIC — 20 niveaux (C01–C20)
Cooldown 2,5 → 5 s selon le niveau. Cible = difficulté visée (1–10).

| id | nom | cible | intention | taille | jonct. | impasses | gardes | cycles | attente | marge | score |
|---|---|---|---|---|---|---|---|---|---|---|---|
| C01 | Seuil | 1 | JOUR/NUIT et une salle surveillée | 14×8 | 0 | 0 | 1 | 1 | 4 s | 3 | 4,1 |
| C02 | Balancier | 2 | un garde surveille deux passages en alternance | 20×11 | 0 | 0 | 1 | 1 | 2 s | 3 | 3,9 |
| C03 | Guérite | 2 | sentinelles en impasse balayant le couloir | 22×9 | 2 | 2 | 2 | 2 | 5 s | 3 | 8,0 |
| C04 | Anneau | 3 | ronde en boucle : la suivre ou la croiser | 17×11 | 4 | 4 | 1 | 1 | 3 s | 3 | 6,8 |
| C05 | Chicane | 3 | alcôves dans des couloirs parallèles | 24×11 | 4 | 4 | 2 | 2 | 8,25 s | 3 | 12,1 |
| C06 | Impasses | 4 | premier labyrinthe, impasses-cachettes | 19×11 | 6 | 5 | 1 | 1 | 5,25 s | 3 | 9,9 |
| C07 | Colonnes | 4 | trois rondes verticales de périodes 10,6/7,5/8,7 | 25×11 | 3 | 6 | 3 | 3 | 8 s | 3 | 11,2 |
| C08 | Cellules | 5 | portes décalées, traversée en diagonale | 25×9 | 0 | 0 | 3 | 3 | 9 s | 3 | 11,6 |
| C09 | Treillis | 5 | trois couloirs gardés reliés par des traverses | 19×11 | 11 | 0 | 3 | 3 | 6,25 s | 3 | 12,1 |
| C10 | Cloître | 6 | anneau extérieur contre hall central surveillé | 21×13 | 4 | 0 | 3 | 3 | 7,25 s | 3 | 11,4 |
| C11 | Dédale | 6 | labyrinthe dense, deux rondes en relais | 21×13 | 6 | 6 | 2 | 2 | 7 s | 3 | 14,5 |
| C12 | Archipel | 7 | quatre îlots reliés par des ponts étroits | 23×15 | 0 | 0 | 3 | 3 | 8 s | 2 | 13,6 |
| C13 | Piliers | 7 | deux faisceaux longs et étroits, une lanterne courte et large | 19×11 | 15 | 0 | 3 | 3 | 11,75 s | 3 | 15,5 |
| C14 | Orbites | 7 | trois anneaux imbriqués aux portes décalées | 25×15 | 3 | 0 | 3 | 3 | 8,75 s | 3 | 13,5 |
| C15 | Labyrinthe | 8 | labyrinthe à trois cycles différents | 23×13 | 8 | 7 | 3 | 3 | 9 s | 3 | 17,6 |
| C16 | Méandres | 8 | grand labyrinthe, fenêtres enchaînées | 25×15 | 11 | 8 | 3 | 3 | 10,75 s | 3 | 18,8 |
| C17 | Dédale profond | 9 | très grand labyrinthe, plusieurs routes | 27×17 | 15 | 12 | 3 | 3 | 12,75 s | 3 | 21,1 |
| C18 | Citadelle | 9 | hall central ouvert dans un labyrinthe, lanterne + faisceau + rondes | 29×17 | 19 | 7 | 4 | 4 | 13 s | 3 | 20,1 |
| C19 | Sentinelles | 10 | faisceau, lanterne et deux rondes, une fenêtre par garde | 27×17 | 13 | 11 | 4 | 4 | 16,25 s | 2 | 25,4 |
| C20 | Épilogue | 10 | réseau dense, deux rondes se recouvrent à la sortie | 29×17 | 20 | 11 | 4 | 4 | 19,5 s | 2 | 24,3 |

Conception : C01–C05, C07–C09, C12–C14 à la main (placement des gardes de C08–C10 et C12–C14 par recherche) ; C06, C11, C15–C20 labyrinthes générés avec gardes placés par optimisation (chaque garde doit être utile, plusieurs cycles, plusieurs phases d'attente, marge ≥ 2).

## 4. HARDCORE — 13 niveaux (H01–H13)
Règles : un seul regard = perdu, **pas de cooldown**, nombre de bascules limité (`hardSwitches`). Mise en page originale (aucun niveau CLASSIC repris).

| id | nom | cible | bascules | idée / plan prévu | taille | jonct. | impasses | gardes | cycles | attente | marge | score |
|---|---|---|---|---|---|---|---|---|---|---|---|---|
| H01 | Moyeu | 5 | 3 | moyeu à 4 bras : sentinelle centrale + guetteur est ; monter par le nord dans la fenêtre commune | 19×13 | 0 | 2 | 2 | 2 | 5,25 s | 3 | 6,0 |
| H02 | Cellules | 5 | 3 | six cellules aux portes décalées, deux gardées | 19×9 | 5 | 0 | 2 | 2 | 5,25 s | 1 | 8,8 |
| H03 | Phares | 6 | 4 | trois salles, trois phares qui tournent à cadences différentes | 19×7 | 0 | 0 | 3 | 3 | 8,25 s | 3 | 9,2 |
| H04 | Piliers | 6 | 4 | trois salles à pilier central, contournement à contre-sens | 25×9 | 0 | 0 | 3 | 3 | 5,75 s | 3 | 10,0 |
| H05 | Anneau | 7 | 4 | deux anneaux en sens inverses, un seul rayon | 17×13 | 4 | 2 | 2 | 2 | 12 s | 3 | 11,6 |
| H06 | Peigne | 7 | 4 | épine à dents-cachettes sous une ronde, voie basse sous une autre | 21×11 | 14 | 9 | 2 | 2 | 8,25 s | 3 | 14,2 |
| H07 | Sas | 7 | 4 | deux galeries gardées en série, alcôves de trois cases | 17×11 | 6 | 6 | 2 | 2 | 13,25 s | 1 | 17,0 |
| H08 | Greffe | 8 | 5 | labyrinthe, deux rondes, impasses-abris | 17×11 | 9 | 3 | 2 | 2 | 18,25 s | 3 | 17,2 |
| H09 | Cloître | 8 | 5 | labyrinthe à boucles, trois cycles | 21×13 | 12 | 4 | 3 | 3 | 18,75 s | 3 | 18,8 |
| H10 | Longue-vue | 8 | 5 | guetteurs à longue portée et champ très étroit | 23×13 | 12 | 5 | 3 | 3 | 17,75 s | 3 | 20,0 |
| H11 | Dédale | 9 | 6 | le plus grand plan, quatre gardes | 29×17 | 19 | 8 | 4 | 4 | 13,25 s | 3 | 22,4 |
| H12 | Veilleurs | 9 | 6 | quatre veilleurs à vision courte et très large | 25×15 | 17 | 7 | 4 | 4 | 18,5 s | 1 | 25,4 |
| H13 | Catacombes | 10 | 6 | grand labyrinthe, trois cycles, longues attentes | 25×15 | 18 | 8 | 3 | 3 | 24 s | 3 | 25,8 |

H08–H13 : labyrinthes générés par programme, gardes (vitesse, pauses, décalages) choisis par recherche sur des critères du solveur ; les textes d'intention ont été écrits ensuite d'après les mesures.

## 5. Résultats de validation (exécutés)
- 20 niveaux CLASSIC + 13 niveaux HARDCORE : tous résolubles par une route jamais vue, ≥ 1,5 s d'attente, résolubles à l'échelon de marge 1, solution rejouée avec succès dans la vraie simulation continue (règles de la campagne).
- Aucun couple de niveaux ne dépasse 0,7 de similarité ; maximum côté CLASSIC : 0,58.
- 231/231 tests, `tsc` propre, build OK.

## 6. Bugs et corrections liés à ce travail
- Le validateur ratait un garde en train de pivoter (échantillonnage trop espacé) → échantillonnage 4× par pas ; L5 et L3 retravaillés (session précédente).
- Séparation des campagnes : progression et records distincts par mode (`unlockedHard`, clés `hN`), écran « Niveaux » à trois colonnes.
- Indices : deux textes corrigés (C02 donnait la solution, C20 affirmait une route unique non vérifiée).

## 7. Niveaux et points encore problématiques (honnêtement)
- **Aucun niveau n'a été joué par un humain.** Les plans « prévus » sont du raisonnement ; l'apprentissabilité des labyrinthes à couloirs de largeur 1 n'est pas vérifiée.
- **Budgets de bascules HARDCORE** (3 à 6) : jugement, pas calcul. Le solveur ignore le mode de vision : personne n'a prouvé qu'un niveau est faisable dans son budget.
- **Le cooldown n'est dans aucun niveau comme contrainte de conception** : il augmente avec la difficulté (2,5 → 5 s) mais le solveur ne le modélise pas. L'exigence « le cooldown fait partie du puzzle » n'est donc pas remplie.
- **Marge faible (1 sur 3)** : H02, H07, H12 ; marge 2 : C12, C19, C20. H12 (39 s de résolution) est fragile.
- **Gardes à utilité faible** (retirer le garde ne raccourcit la route que de 1,3–2,5 s) : C03, C08, C15, C20.
- **Attentes longues** sur les derniers niveaux (jusqu'à 24 s) : peut être fastidieux.
- **Variété en fin de campagne** : 6 des 7 derniers CLASSIC et 6 des 8 derniers HARDCORE sont des labyrinthes.
- **Progression** : le score n'est pas monotone (CLASSIC : plateau C08–C10, creux à C14 ; HARDCORE : H05 11,6 puis H06 14,2…). Objectif non atteint : 20–25 niveaux CLASSIC visés → 20 ; 15–20 HARDCORE visés → 13.
- Contraintes du validateur : distance minimale 0,95 tuile et marges font que, dans un couloir de largeur 1, on ne partage jamais l'espace avec un garde : les impasses-abris deviennent le mécanisme central des labyrinthes. C'est une contrainte de design, pas un bug.

## 8. Prochaines étapes recommandées
1. Faire jouer C01–C10 puis H01–H05 et comparer ressenti et score.
2. Calculer le nombre minimal de bascules d'un plan réaliste pour fixer `hardSwitches` sur des mesures.
3. Concevoir 3–4 niveaux CLASSIC où le cooldown est réellement la contrainte (fenêtre plus courte que le cooldown).
4. Remplacer une partie des labyrinthes générés tardifs par des architectures dessinées à la main (variété).

## 9. Corrections du 2026-11-14 (après retour de playtest)
- **HARDCORE sans retour de mur** : plus de flash ni de son quand on touche un mur (demande du joueur : le retour rendait le mode trop facile). Vérifié dans le navigateur : 0 retour en HARDCORE, 3 en mode normal pour le même test (pousser 1,4 s contre un mur).
- **Réglage automatique des rondes** (recherche locale sur vitesses, pauses et décalages, avec le solveur) sur 9 niveaux fragiles. Résultats mesurés :
  | niveau | marge | utilité min. d'un garde | attente | décision |
  |---|---|---|---|---|
  | H02 | 1 → 2 | — | 5,25 → 5,5 s | appliqué |
  | H07 | 1 → 2 | — | 13,25 → 21 s | appliqué (marge gagnée, attente plus longue) |
  | C08 | 3 | 1,8 → 3,3 s | 9 → 10,5 s | appliqué |
  | C12 | 2 → 3 | — | 8 → 5,25 s | appliqué, **mais la complexité mesurée baisse** (score 13,6 → 8,2, phases d'attente 11 → 3) ; cible ramenée de 7 à 6 |
  | C19 | 2 → 3 | — | 16 → 23 s | **non appliqué** (attente trop longue) |
  | C20 | 2 → 3 | 2,5 → 4 s | 19,5 → 28 s | **non appliqué** (attente trop longue) |
  | H12 | 1 → 1 | — | — | aucun gain trouvé en 1500 essais |
  | C03 | 3 | 1,5 → 2 s | — | gain insuffisant, inchangé |
  | C15 | 3 | 1,3 → 1,5 s | — | gain insuffisant, inchangé |
- 231/231 tests après modifications.
- **Reste à traiter** : H12 (marge 1), H02/H07 (marge 2 seulement), C19/C20 (marge 2), gardes peu utiles de C03/C15/C20, attentes très longues en fin de campagne. Le cooldown reste une contrainte de conception absente (le solveur ne le modélise pas) : il faut dessiner à la main quelques niveaux dont la fenêtre est plus courte que le cooldown.
- La version originale des rondes de C12 n'a pas été sauvegardée avant modification (pas de contrôle de version dans le projet).

## 10. Deuxième passe de corrections (2026-11-14)
Recherche locale avec contraintes : attente plafonnée (22 s), phases d'attente conservées (≥ 80 % de l'original), solveur à chaque essai.
| niveau | marge | utilité min. d'un garde | attente | phases d'attente | décision |
|---|---|---|---|---|---|
| C19 | 2 → 3 | — | 16,25 → 18,75 s | 13 → 11 | appliqué |
| C20 | 2 → 3 | 2,5 → 7,5 s | 19,5 → 21,75 s | 7 → 6 | appliqué |
| H12 | 1 → 1 | — | — | — | **aucun gain en 2500 essais**, inchangé (même en autorisant l'ouverture du champ de vision) |

231/231 tests. Sauvegarde des fichiers de niveaux **avant** cette passe : `docs/backup/*.bak` (état après la première passe).
**Reste ouvert** : H12 (marge 1, 39 s) ; marge 2 sur H02 et H07 ; gardes peu utiles de C03 (gain 2 s) et C15 (1,5 s) ; attentes longues en fin de campagne ; cooldown absent comme contrainte de conception ; variété (labyrinthes générés en fin de campagne). Pour H12 la piste restante est structurelle (retirer un garde ou élargir un passage), pas un réglage de rondes.

## 11. H12 Veilleurs — correction structurelle (2026-11-14)
Les réglages de rondes n'apportaient rien (marge 1 sur 3). Exploration automatique de variantes structurelles (retirer un garde ; ouvrir une case de mur, ~150 variantes) :
- retirer un garde → marge 3 mais route de 31 s à 3 s et 1 phase d'attente : le niveau perd son sens, **rejeté** ;
- ouvrir (colonne 19, rangée 12) → **marge 3**, route de référence **inchangée** (39 s, 18,5 s d'attente, 7 phases), jonctions 17 → 19 : **appliqué** ;
- d'autres ouvertures donnaient une marge 3 mais cassaient la difficulté (0 à 5 s d'attente) : rejetées.
Mesures après correction : H12 marge **3**, score 24,4, 231/231 tests. Vérifié à l'écran : le niveau se charge en hardcore avec 6 bascules.
Sauvegarde avant cette passe : `docs/backup/hardcore.ts.bak`. Non vérifié : l'effet de cette ouverture sur l'expérience (elle ajoute un raccord entre deux couloirs, sans raccourcir la route validée).
**Reste ouvert** : marge 2 sur H02 et H07 ; gardes peu utiles de C03 et C15 ; attentes longues ; cooldown absent comme contrainte ; labyrinthes générés en fin de campagne.

## 12. Niveaux « cooldown » (2026-11-14)
**Limite de fond** : le solveur ne peut pas modéliser le cooldown. Avec une mémoire parfaite du plan et des rondes, le joueur n'aurait jamais besoin de changer de vision. Le cooldown ne contraint donc que la *cécité* : pour lire les gardes il faut être en NUIT, pour lire les murs en JOUR, et après une bascule on est verrouillé `cooldown` secondes.

**Métrique ajoutée** (`cooldownPressure` dans `src/systems/metrics.ts`, mesurée, pas prouvée) : sur la route de référence, une « zone de danger » est une case que ≥ 1 garde peut voir à un moment du cycle. On mesure la plus longue traversée continue de telles cases (`dangerRun`, en secondes), le nombre de virages dedans (`turns`) et `ratio = dangerRun / cooldown`. Un ratio ≥ 1 signifie qu'on ne peut pas relire pendant la traversée. `npx vite-node scripts/pressure.ts` l'affiche pour CLASSIC.
Mesure des 20 niveaux précédents : ratio médian ≈ 0,9 ; seuls C04 (2,8) et C16 (1,6) dépassaient 1,5. Le cooldown n'était donc, en pratique, jamais la contrainte.

**Deux niveaux dessinés autour de cette contrainte** (plans dessinés à la main, rondes cherchées par optimisation sous critères) :
| niveau | plan | gardes | cooldown | route surveillée | virages | ratio | attente | marge | utilité min. d'un garde |
|---|---|---|---|---|---|---|---|---|---|
| C15 Chicanes (cible 7) | salle 23×11 à 3 cloisons, 4 couloirs, 3 passages en alternance | 3 | 5 s | 11,75 s | 10 | 2,35 | 12,5 s | 3 | 2,8 s |
| C18 Descente (cible 8) | tour 15×17 à 3 étages, passages à gauche/droite en alternance | 2 | 5 s | 13,75 s | 8 | 2,75 | 10,25 s | 3 | 7,0 s |
Critères de sélection (tous mesurés) : solvable, marge ≥ 2, attente 4–14 s, ratio ≥ 1,5, virages ≥ 3, chaque garde fait gagner ≥ 1,5–2 s. Test de régression ajouté (`cooldown-pressure levels`).
**CLASSIC compte maintenant 22 niveaux** ; les ids ont été renumérotés C01–C22 par ordre de jeu (la progression sauvegardée est indexée par position : un joueur de test voit ses temps décalés après C14).

**Ce qui n'est PAS prouvé** :
- Le jeu n'oblige pas à utiliser le cooldown : un joueur qui retient les rondes peut tout faire en NUIT, sans jamais changer. La pression est une probabilité de gêne, pas une contrainte dure.
- Aucun humain n'a joué ces niveaux ; la métrique n'a pas été corrélée à un ressenti.
- Seuls 2 niveaux sur les 3–4 visés : un troisième plan (îlots à gardes circulaires) n'a pas été dessiné faute de temps.
- Les deux plans sont des variantes du même principe (cloisons alternées) ; ils diffèrent par la forme (salle large / tour étroite) et l'orientation des rondes.


## 14. Refonte CLASSIC (v2)
Sauvegarde de l'ancienne campagne : `docs/backup/classic.pre-v2.ts.bak`. 22 niveaux C01–C22 (même nombre, ids dans l'ordre de jeu). Plans dessinés à la main (ou repris et densifiés) ; **rondes (vitesses, attentes, décalages) cherchées par hill-climbing avec redémarrages** sous critères mesurés (validateur, `measure`, `freeRoute`, `startCheck`, `hasAlternativeRoute`, `cooldownPressure`, utilité des gardes).

### Table des niveaux (mesures exécutées ; score = `measure(def,false)`, comme dans les tests)
| id | nom | cible | taille | gardes (types) | score | marge | attente | alt. | intention |
|---|---|---|---|---|---|---|---|---|---|
| C01 | Seuil | 3 | 21x11 | 2 normal | 8.2 | 3 | 5.5 s | oui | Apprendre à alterner JOUR (les murs) et NUIT (les gardes) : trois salles, des portes décalées, un garde dans le hall et un second qui veille sur la sortie. |
| C02 | Balancier | 3 | 21x11 | 2 normal | 8.6 | 3 | 8.3 s | oui | Deux couloirs, deux gardes en opposition de phase : choisis celui dont le garde tourne le dos. |
| C03 | Guérite | 4 | 23x13 | 3 normal | 10.4 | 3 | 4.5 s | oui | Des îlots-guérites dans une grande salle : trois sentinelles balaient les allées, il faut passer d’îlot en îlot à l’abri des murs. |
| C04 | Anneau | 4 | 21x13 | 2 normal | 10.3 | 3 | 6.5 s | oui | Une ronde en boucle fermée autour d’un anneau, et une traverse centrale : suivre la ronde dans son dos, la croiser dans une niche ou couper par le milieu. |
| C05 | Chicane | 4 | 24x11 | 2 normal | 13.4 | 3 | 7.0 s | non | Un couloir trop étroit pour deux : se glisser dans une alcôve pour laisser passer la ronde. |
| C06 | Galerie | 5 | 21x13 | 2 normal + 1 lourd | 10.7 | 3 | 5.5 s | oui | Premier garde lourd : lent, mais son regard porte très loin. Il tient toute la galerie centrale en ligne droite : traverse-la d’une salle à l’autre entre deux de ses passages. |
| C07 | Colonnes | 5 | 25x11 | 2 normal + 1 lourd | 12.3 | 3 | 8.0 s | non | Trois rondes de durées différentes coupent le même couloir : trouver l’instant où elles regardent toutes ailleurs. |
| C08 | Cellules | 6 | 25x9 | 3 normal | 11.7 | 3 | 11.0 s | oui | Des portes décalées obligent à traverser chaque cellule en diagonale, sous trois rondes distinctes. |
| C09 | Treillis | 6 | 19x11 | 1 normal + 2 lourd | 12.3 | 3 | 7.0 s | oui | Trois voies parallèles gardées, reliées par des traverses : changer de voie au bon moment. |
| C10 | Cloître | 6 | 21x13 | 1 normal + 1 lourd + 1 léger | 13.1 | 3 | 10.8 s | oui | Premier garde léger : rapide mais à courte vue, il arpente l’anneau extérieur ; le hall central est tenu par un garde lourd. Deux chemins aux risques différents. |
| C11 | Dédale | 7 | 21x13 | 1 normal + 1 léger | 15.3 | 3 | 10.0 s | non | Un labyrinthe plus dense où deux rondes de cycles différents ferment les couloirs l’une après l’autre. |
| C12 | Archipel | 7 | 23x15 | 2 normal + 1 léger | 15.1 | 3 | 7.8 s | oui | Quatre îlots reliés par d’étroits passages : chaque pont se franchit entre deux regards. |
| C13 | Piliers | 7 | 19x11 | 2 lourd + 1 léger | 14.6 | 3 | 9.0 s | oui | Deux gardes lourds à longue portée et un garde léger à champ large : avancer de pilier en pilier à l’abri des lignes de vue. |
| C14 | Orbites | 7 | 25x15 | 1 normal + 1 lourd + 1 léger | 15.6 | 3 | 9.3 s | non | Trois anneaux emboîtés dont les portes sont décalées : chaque couche gardée a son propre rythme. |
| C15 | Serpentin | 8 | 23x11 | 1 normal + 2 lourd | 15.8 | 2 | 18.8 s | non | Traverser une salle à chicanes entièrement surveillée : le trajet dure plus de deux fois le cooldown, donc on ne peut pas relire les gardes en chemin. |
| C16 | Labyrinthe | 8 | 23x13 | 1 normal + 1 lourd + 1 léger | 17.8 | 3 | 7.5 s | non | Un labyrinthe à trois rondes de natures distinctes : un plan à mémoriser, des fenêtres à enchaîner. |
| C17 | Méandres | 8 | 25x15 | 1 normal + 1 lourd + 1 léger | 18.3 | 3 | 9.0 s | non | Un grand labyrinthe : plusieurs fenêtres de tir à enchaîner sans jamais être vu. |
| C18 | Descente | 8 | 15x17 | 1 normal + 1 lourd | 17.4 | 3 | 13.0 s | non | Descendre une tour à étages sous deux rondes : plus de dix secondes de trajet surveillé, avec de nombreux virages, entre lire les murs et lire les gardes. |
| C19 | Dédale profond | 9 | 27x17 | 1 normal + 1 lourd + 1 léger | 20.4 | 3 | 15.8 s | non | Très grand labyrinthe à embranchements multiples : choisir la bonne route avant de risquer la bonne fenêtre. |
| C20 | Citadelle | 9 | 29x17 | 2 normal + 1 lourd + 1 léger | 20.4 | 3 | 16.5 s | non | Une salle centrale ouverte au cœur d’un labyrinthe : la traverser sous les regards ou la contourner, entre garde léger, garde lourd et rondes. |
| C21 | Sentinelles | 10 | 27x17 | 2 normal + 1 lourd + 1 léger | 24.7 | 2 | 21.5 s | non | Un faisceau long et étroit, une lanterne courte et large, deux rondes simples : chaque fenêtre dépend d’un garde de nature différente. |
| C22 | Épilogue | 10 | 29x17 | 2 normal + 1 lourd + 1 léger | 22.8 | 3 | 16.0 s | non | Un réseau très dense de couloirs : deux rondes se chevauchent devant la sortie, il faut passer entre leurs deux cycles. |

Route alternative : **10 / 22 (45 %)** pour un seuil de 40 %. Pression du cooldown (ratio ≥ 1,5 et ≥ 3 virages) : C15 (1,75 ; 8 virages) et C18 (2,4 ; 10 virages) ; C21 a un ratio de 1,55 mais 2 virages seulement. Début de campagne : C01–C03 passent de 5,2 / 5,0 / 9 à 8,2 / 8,6 / 10,4 ; attentes 4,5–8,3 s au lieu de 4–5 s, sur des plans à plusieurs salles et portes décalées.

### Ce qui change par rapport à l'ancienne campagne
- **Début plus dur, plus structuré** : C01 (3 salles, portes décalées, 2 gardes), C02 (anneau à deux couloirs, gardes en opposition de phase), C03 (îlots-guérites, 3 sentinelles), C04 (anneau + traverse + niches). Ce sont des salles et des boucles à options, pas des couloirs uniques.
- **Contournement corrigé** : `freeRoute = 0` partout. L'ancien C06 « Impasses » (60 cases jamais vues) est remplacé par C06 « Galerie » : une galerie centrale d'une case de large, tenue en ligne droite par le garde lourd, relie six salles ; toute traversée passe par des cases vues. Aucun garde n'a été ajouté pour « boucher » : c'est le plan qui a changé.
- **Trois types de gardes seulement** (`kind`, plus aucun `range`/`fov`) : lourd introduit en C06 (l'intention contient « lourd »), léger en C10 (« léger »). Lourd présent dans 14 niveaux, léger dans 11 ; ils se combinent dès C10. Toutes les vitesses sont dans la bande de leur type.
- **Routes multiples** : C01–C04, C06, C08 (portes doublées), C09, C10, C12, C13. Marge (slack) 3 partout sauf C15 et C21 (2).
- **Premières secondes équitables** : aucun garde ne voit la case de départ avant 3,0 s (C09, le pire), distance minimale au départ ≥ 3,2 cases (C13).
- **Gardes utiles** : critère d'optimisation (retirer un garde fait perdre ≥ 1,25 s à la route de référence) appliqué aux niveaux qui avaient des gardes inutiles. Mesuré : chaque garde de chaque niveau fait gagner au moins 1,5 s à la route de référence (minimum atteint en C16, C17, C20, C22).
- **Plans repris** de l'ancienne campagne (densifiés ou non) : C05, C07, C09–C22 (C08 avec doublement des portes, C10/C15/C18 avec niches ou piliers) ; gardes entièrement recalés. C15 est renommé « Serpentin » (doublon de nom avec C05 « Chicane » dans la version précédente de la liste).

### Limites (honnêtes)
- **Mesuré** : solvabilité, attente, marge, score, `freeRoute`, premières secondes, route alternative, pression du cooldown, utilité des gardes, victoire de la route de référence en physique réelle. `tests/levels.test.ts` : 240/240 verts au moment de l'écriture (HARDCORE compris).
- **Jugé, non mesuré** : lisibilité, plaisir, progression pédagogique, qualité des intentions et des indices, « un niveau = une idée ». **Aucun humain n'a joué ces niveaux.**
- Le score est une aide au classement à poids provisoires ; les planchers du test (7,5 + 0,55 × index) le forcent à monter vite, ce qui favorise les labyrinthes de couloirs. Les salles ouvertes (C03, C06) ont dû être cloisonnées ou densifiées pour atteindre leur plancher.
- C05, C07, C11, C14–C22 n'ont **pas** de route alternative (labyrinthes et couloirs uniques). La part de 45 % ne laisse qu'un niveau de marge sur le seuil de 40 %. Des tentatives automatiques d'imposer une route alternative sur C11, C14, C16, C17, C19–C22 ont échoué (les rondes ferment toujours l'autre route).
- Niveaux qui passent de peu le plancher de score : C08 (+0,35), C09 (+0,40), C06 (+0,45), C13 (+0,50), C18 (+0,55), C02 (+0,55), C15 (+0,60), C10 (+0,65), C01 (+0,70). Marge 2 seulement : C15, C21.
- Attentes longues : C15 18,8 s, C21 21,5 s (sous 22 s mais pénibles) ; C19, C20, C22 de 15,8 à 16,5 s.
- C15–C22 sont des couloirs-labyrinthes à rondes difficiles à lire : la difficulté y vient de la mémoire et de la patience plus que de choix spatiaux.
- Le cooldown reste une pression statistique, jamais une contrainte dure (voir section 12).
- Les cibles (`target`) sont des intentions de conception, non calibrées sur des joueurs.

## 15. Refonte HARDCORE (v2)
Campagne HARDCORE entièrement refaite : **15 niveaux (H01–H15)**, 3 types de garde (`normal`, `lourd`, `léger`, voir `GUARD_KINDS`), budgets de bascules (`hardSwitches`) justifiés niveau par niveau (`switchWhy`), départs corrigés. Fichier : `src/levels/hardcore.ts` (ancienne version : `docs/backup/hardcore.pre-v2.ts.bak`).

### Les 15 niveaux
Colonnes mesurées : `score` = `measure(def,false).score` (plancher du test : 9 + 0,8·index), `marge` = plus haut échelon de la `MARGIN_LADDER` encore solvable (0–3), `attente` = secondes d'attente de la route de référence, `alt.` = `hasAlternativeRoute`. Gardes : N normal, L lourd, Lé léger.

| id | nom | cible | taille | gardes (types) | bascules | score (plancher) | marge | attente | alt. | intention |
|---|---|---|---|---|---|---|---|---|---|---|
| H01 | Moyeu | 4 | 19×13 | 3 (3 N) | **2** | 9,9 (9,0) | 3 | 9,8 s | non | une seule lecture NUIT de trois rondes dans une simple croix, retour en JOUR |
| H02 | Vestiaires | 4 | 17×9 | 3 (3 N) | **3** | 11,1 (9,8) | 3 | 8,3 s | oui | deux salles à pilier, boucles autour des piliers, porte du haut ou du bas |
| H03 | Mirador | 5 | 21×11 | 3 (1 L, 2 N) | **3** | 11,5 (10,6) | 3 | 14,3 s | oui | **introduit le lourd** : lent, longue portée, fait le tour d'un pilier central |
| H04 | Piliers | 5 | 25×9 | 3 (Lé, N, L) | **3** | 11,8 (11,4) | 3 | 6,8 s | oui | **introduit le léger** : trois salles à pilier, trois cadences, deux portes par cloison |
| H05 | Anneau | 6 | 17×13 | 2 (N, L) | **3** | 14,1 (12,2) | 3 | 16,0 s | non | deux anneaux, suivre la ronde par derrière ; difficulté = attente |
| H06 | Peigne | 6 | 21×11 | 2 (N, Lé) | **2** | 13,9 (13,0) | 3 | 5,3 s | non | dents-cachettes, voie basse balayée par un léger rapide ; budget serré |
| H07 | Sas | 6 | 19×11 | 2 (L, Lé) | **4** | 15,0 (13,8) | 3 | 14,0 s | non | deux galeries à alcôves en série, lent puis rapide |
| H08 | Esplanade | 7 | 23×13 | 5 (L, Lé, 3 N) | **4** | 15,2 (14,6) | 3 | 15,3 s | oui | terrain ouvert à piliers décalés, cinq rondes, plusieurs itinéraires |
| H09 | Greffe | 7 | 17×11 | 2 (Lé, L) | **5** | 16,4 (15,4) | 3 | 20,0 s | non | dédale étroit, quatre séquences de danger séparées par de longues attentes |
| H10 | Quartiers | 7 | 21×13 | 4 (L, N, 2 Lé) | **3** | 16,7 (16,2) | 3 | 17,5 s | oui | quatre quartiers en croix, une ronde par type, deux portes par cloison (boucle) |
| H11 | Cloître | 8 | 21×13 | 3 (L, N, Lé) | **4** | 17,7 (17,0) | 3 | 16,0 s | non | dédale à boucles et impasses, trois types de garde |
| H12 | Longue-vue | 8 | 23×13 | 3 (2 L, Lé) | **5** | 19,6 (17,8) | 3 | 13,8 s | non | couloirs droits sous deux lourds à longue portée, virages à vérifier |
| H13 | Veilleurs | 9 | 25×15 | 4 (2 N, Lé, L) | **4** | 22,7 (18,6) | 3 | 18,3 s | non | grand dédale, quatre veilleurs de trois types |
| H14 | Dédale | 9 | 29×17 | 4 (2 N, L, Lé) | **5** | 23,7 (19,4) | 3 | 16,0 s | non | le plus grand plan, quatre rondes, trois séquences de danger |
| H15 | Catacombes | 10 | 25×15 | 3 (L, N, Lé) | **4** | 25,4 (20,2) | 3 | 18,3 s | non | épreuve de mémoire : douze phases d'attente, budget volontairement serré |

**Pourquoi ces budgets** (le détail complet est dans `switchWhy` de chaque niveau ; contraintes testées : H01–H03 ≤ 3, 2 ≤ budget ≤ 2 + max(2, séquences de danger de la route de référence)) :
- Minimum théorique = 2 (regarder les gardes en NUIT, revenir en JOUR). H01 et H06 sont à 2 volontairement : peu de gardes, plan sans détour, c'est un test de mémoire pure.
- 3 quand un niveau offre un choix (deux portes, boucle) ou une ronde lente très lisible (H02, H03, H04, H05, H10) : une bascule de secours pour recaler.
- 4–5 quand le plan est un dédale qu'on ne retient pas d'un regard, ou que la route de référence a 3–4 séquences de danger séparées (H07, H09, H11, H12, H14) ; le budget n'est pas monotone (H10 = 3 après H09 = 5 ; H13 et H15 = 4, plus serrés que H12 et H14).

### Ce qui a changé
- **Types de garde** : plus aucun `range`/`fov`/vitesse hors bande. Le lourd est introduit en H03 (intention : « lourd »), le léger en H04 (intention : « léger »), puis combinés ; chacun apparaît dans ≥ 3 niveaux (lourd : 12 niveaux, léger : 11 niveaux).
- **Départs justes** : `startCheck` : aucun garde ne voit le départ avant 4,1 s (ou jamais) et aucun garde à moins de 3,2 cases dans les 2,5 premières secondes (contrat : ≥ 2,5 s et ≥ 2,0).
- **Aucun contournement** : `freeRoute` = 0 sur les 15 niveaux.
- **Routes alternatives** : 5 niveaux sur 15 (33 %, seuil 30 %) : H02, H03, H04, H08, H10 (salles à deux portes, boucle, terrain à piliers).
- **Architectures mélangées** : croix (H01), salles à piliers (H02–H04), anneaux (H05), peigne (H06), galeries à alcôves (H07), terrain ouvert (H08), dédales (H09, H11–H15), quartiers en boucle (H10).
- **Ramp** : scores 9,9 → 25,4, jamais de chute > 3 ; cibles 4 → 10 sans baisse.
- Cartes reprises et restructurées : H01 (moyeu), H05 (anneau), H06 (peigne), H09/H11/H12/H13/H14/H15 (dédales de l'ancienne campagne, nouveaux gardes) ; neuves : H02, H03, H07 (alcôves redessinées, les anciennes ressemblaient trop à C04), H08, H10 ; H04 (piliers) reçoit une 2e porte par cloison.
- Les rondes (vitesse dans la bande du type, attentes, décalages) ont été trouvées par recherche aléatoire/escalade sous contraintes (solvable, marge ≥ 1 et ≥ 2 visée, départ équitable, score ≥ plancher + marge, attente 3–20 s, `freeRoute` = 0, route alternative pour les niveaux visés).

### Limites honnêtes
- **Mesuré** (tests + scripts) : solvabilité, marges, attente, score, départs, contournement, route alternative, similarité des cartes (max 0,63 contre CLASSIC : H15~C17), route de référence qui gagne en physique réelle.
- **Jugé** (non mesuré) : l'intention de chaque niveau, les textes `intent`/`hint`, la progression ressentie, et surtout **les budgets de bascules** : ce sont des jugements de design bornés par les tests, **pas** des minima calculés. Le solveur suppose une mémoire parfaite : il ne peut pas dire si un humain retient réellement 3–4 cycles de gardes avec 2 bascules.
- **Rien n'a été joué par un humain.** Les budgets 2 de H01 et H06 en particulier sont une hypothèse (lecture NUIT unique + mémoire) à confirmer en playtest.
- Les plans de gardes sont issus d'une recherche automatique : les rondes respectent les critères mais n'ont pas été polies à la main (certaines attentes sont longues : H09 20 s, H13 et H15 18,3 s, H10 17,5 s ; aucune > 22 s).
- Marges justes sur les planchers de score : H04 (+0,4), H10 (+0,5), H08 (+0,6), H06 (+0,9). Le seuil « route alternative » est atteint pile (5/15). H15 et H13 sont proches de C17 par la carte (0,63 et 0,61) : la similarité reste sous 0,7 mais dépend de `classic.ts`, qui est modifié par un autre travail.
- Les scores croissent surtout avec la taille du plan et le nombre de cases parcourues : les derniers niveaux sont « difficiles » au sens de la métrique (plans vastes, longues attentes) plus que par une nouvelle idée de puzzle.
