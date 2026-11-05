# Déployer IT Manager sur Railway

Durée : ~10 minutes. Résultat : une URL publique en HTTPS (ex. `https://it-manager-production.up.railway.app`) utilisable sur mobile.

## 1. Créer le projet
1. Connectez-vous sur **railway.com** avec votre compte GitHub.
2. **New Project → Deploy from GitHub repo →** `Office1480/IT-Manager`.
3. Dans le projet : **+ Create → Database → PostgreSQL**.

## 2. Variables du service `IT-Manager` (onglet *Variables*)
| Variable | Valeur |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (référence à la base) |
| `AUTH_SECRET` | une chaîne aléatoire de 32+ caractères (`openssl rand -base64 32`) |
| `ENCRYPTION_KEY` | 32 octets en base64 (`openssl rand -base64 32`) — **à conserver précieusement : sans elle, les documents et données chiffrées sont illisibles** |
| `STORAGE_DIR` | `/data/storage` |
| `APP_URL` | l'URL publique du service (après l'étape 4) |
| `SEED_DEMO` | `true` pour charger les données de démo au premier démarrage (sinon ne pas définir) |

## 3. Volume pour les documents
Service `IT-Manager` → **Settings → Volumes → Add volume**, point de montage : `/data`.

## 4. Domaine public
Service `IT-Manager` → **Settings → Networking → Generate Domain**. Reportez l'URL dans `APP_URL`.

## 5. Premier accès
- Avec `SEED_DEMO=true` : connexion `admin@itmanager.dev` / `admin1234` (changez ce mot de passe ou retirez les comptes de démo avant tout usage réel).
- Sans données de démo : l'application ouvre l'écran **« Bienvenue »** pour créer votre organisation et votre compte propriétaire.

## Notes
- Les migrations de base s'appliquent automatiquement à chaque déploiement (`scripts/start.sh`).
- Chaque `git push` sur `main` redéploie automatiquement.
- Sauvegardes : activez les backups de la base PostgreSQL dans Railway et sauvegardez le volume `/data`.
