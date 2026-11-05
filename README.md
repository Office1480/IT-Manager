# IT Manager

Plateforme de pilotage d'une équipe IT : **collaborateurs (RH)**, **matériel**, **congés & avances**, **projets & ownership**.
Multi-entreprises, trilingue (🇫🇷 FR · 🇬🇧 EN · 🇮🇱 HE avec RTL), conçue pour le droit du travail israélien.

## Démarrage local

```bash
cp .env.example .env              # puis renseigner AUTH_SECRET et ENCRYPTION_KEY (openssl rand -base64 32)
docker compose up -d db           # PostgreSQL 16
npm install
npm run db:deploy                 # migrations
npm run db:seed                   # données de démo
npm run dev                       # http://localhost:3000
```

Comptes de démo (mot de passe `admin1234`) :

| Compte | Rôle |
|---|---|
| `admin@itmanager.dev` | Propriétaire (tous les droits) |
| `rh@itmanager.dev` | RH (salaires, documents, données sensibles) |
| `manager@itmanager.dev` | Manager (équipe, validation des congés) |
| `dev@itmanager.dev` | Collaborateur (son dossier, ses demandes) |

Application complète en conteneur : `docker compose --profile app up -d --build`.

## Stack

Next.js 15 (App Router, Server Actions) · React 19 · TypeScript strict · PostgreSQL + Prisma · Tailwind CSS 4 · Radix UI · next-intl · cmdk.

## Sécurité

- **Multi-tenant** : chaque requête est filtrée par `organizationId` côté serveur.
- **RBAC** : 5 rôles, matrice de permissions explicite (`src/lib/rbac.ts`).
- **Chiffrement AES-256-GCM** : Teudat Zehut, passeport, compte bancaire et **tous les fichiers** (au repos).
- **Journal d'audit** : création, modification, consultation de document, suppression…
- Sessions JWT en cookie `httpOnly`, mots de passe bcrypt.

## Structure

```
prisma/                 schéma (tous les modules) + seed
messages/               traductions fr / en / he (vérif : node scripts/check-i18n.mjs)
src/app/[locale]/       pages (login, (app)/…)
src/app/api/files/      téléchargement sécurisé et déchiffré
src/components/         ui/ (design system), shell/, people/, documents/
src/server/             accès données, server actions, contexte & audit
src/lib/                crypto, stockage, session, rbac, formatage
```

## Roadmap

- [x] **Phase 1** — Fondations, collaborateurs, documents chiffrés, historique de rémunération, dashboard, ⌘K
- [ ] **Phase 2** — Inventaire matériel, attribution avec signature électronique, garanties
- [ ] **Phase 3** — Congés (droit israélien), avances, planning d'équipe
- [ ] **Phase 4** — Projets, carte des responsabilités, backlog d'idéation → Jira
- [ ] **Phase 5** — Alertes bus factor, onboarding/offboarding, licences SaaS
