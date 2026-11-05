#!/bin/sh
# Démarrage en production : migrations, données de démo (optionnel, base vide uniquement), serveur.
set -e
mkdir -p "${STORAGE_DIR:-/data/storage}"
npx prisma migrate deploy
if [ "$SEED_DEMO" = "reset" ]; then
  echo "SEED_DEMO=reset : réinitialisation des données de démo"; npx tsx prisma/seed.ts
elif [ "$SEED_DEMO" = "true" ]; then
  USERS=$(node -e "const{PrismaClient}=require('@prisma/client');const p=new PrismaClient();p.user.count().then(c=>{console.log(c);return p.\$disconnect()})")
  if [ "$USERS" = "0" ]; then echo "Base vide : chargement des données de démo"; npx tsx prisma/seed.ts; fi
fi
exec npx next start -H 0.0.0.0 -p "${PORT:-3000}"
