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
- [x] **Phase 2** — Inventaire matériel, attribution avec signature électronique (PDF signé), restitution, garanties, étiquettes QR
- [x] **Phase 3** — Congés (barème légal israélien, fêtes, demi-journées), planning d'équipe, validations, avances + export paie
- [x] **Phase 4** — Projets, owner/suppléant & expertise, carte des responsabilités, backlog d'idéation (Kanban, RICE) → Jira
- [x] **Phase 5** — Alertes bus factor, onboarding/offboarding, licences SaaS, organigramme, paramètres, dashboard par rôle

## Modules

| Module | Points clés |
|---|---|
| Collaborateurs | Fiche RH complète, Teudat Zehut vérifiée, documents chiffrés avec expiration, historique salarial (augmentations, primes, havraa) |
| Matériel | N° de série unique, garantie & SAV, preuve d'achat, attribution avec **signature au doigt** et PDF de remise généré, restitution signée, QR code |
| Congés | Types légaux (congés, maladie 1,5 j/mois plafonnée à 90, miluim, maternité, deuil…), semaine dim.–jeu., fêtes juives, planning d'équipe, soldes, alerte de couverture |
| Avances | Demande, échéancier, validation, versement, export CSV paie |
| Projets | Owner + suppléant avec niveau d'expertise, carte des responsabilités (graphe + matrice), risques de continuité, backlog Idée → Cadrage → Définition → Revue → Validé → Jira |
| Licences | Sièges, coût mensuel, renouvellements, révocation intégrée à l'offboarding |
| Onboarding / offboarding | Checklists générées automatiquement (matériel à récupérer, accès à révoquer inclus) |

> Les règles de congés (`src/lib/leave.ts`) et les dates de fêtes (`src/lib/israel-defaults.ts`) sont fournies à titre de base : faites-les valider par votre conseiller paie / juridique. Tout est modifiable dans **Paramètres**.
