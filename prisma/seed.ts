/* Données de démonstration — `npm run db:seed` */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createCipheriv, randomBytes } from "node:crypto";
import { DEFAULT_LEAVE_TYPES, ISRAELI_HOLIDAYS, DEFAULT_ONBOARDING } from "../src/lib/israel-defaults";

const db = new PrismaClient();

function enc(plain: string) {
  const key = Buffer.from(process.env.ENCRYPTION_KEY ?? "", "base64");
  if (key.length !== 32) throw new Error("ENCRYPTION_KEY invalide (32 octets base64)");
  const iv = randomBytes(12);
  const c = createCipheriv("aes-256-gcm", key, iv);
  const e = Buffer.concat([c.update(plain, "utf8"), c.final()]);
  return `v1:${iv.toString("base64")}:${c.getAuthTag().toString("base64")}:${e.toString("base64")}`;
}

/** Génère un numéro de Teudat Zehut valide (chiffre de contrôle). */
function tz(seed: number) {
  const base = String(10000000 + ((seed * 7919) % 89999999)).slice(0, 8);
  for (let d = 0; d <= 9; d++) {
    const id = base + d;
    let sum = 0;
    for (let i = 0; i < 9; i++) {
      let n = Number(id[i]) * ((i % 2) + 1);
      if (n > 9) n -= 9;
      sum += n;
    }
    if (sum % 10 === 0) return id;
  }
  return base + "0";
}

const D = (s: string) => new Date(`${s}T00:00:00.000Z`);

async function main() {
  const orgSlug = "demo-lab";
  await db.organization.deleteMany({ where: { slug: orgSlug } });
  await db.user.deleteMany({ where: { email: { endsWith: "@itmanager.dev" } } });

  const org = await db.organization.create({ data: { name: "Demo Lab", slug: orgSlug } });

  const deps = Object.fromEntries(
    await Promise.all(
      [
        ["Direction", "#8b5cf6"],
        ["Infrastructure", "#0ea5e9"],
        ["Développement", "#6366f1"],
        ["Data", "#10b981"],
        ["Support", "#f59e0b"],
        ["Sécurité", "#ef4444"],
      ].map(async ([name, color]) => [name, await db.department.create({ data: { organizationId: org.id, name, color } })]),
    ),
  );

  type P = { first: string; last: string; fh: string; lh: string; job: string; dep: string; start: string; birth: string; salary: number; gender: "MALE" | "FEMALE"; manager?: string; status?: "ACTIVE" | "ONBOARDING" };
  const people: Record<string, P> = {
    david: { first: "David", last: "Cohen", fh: "דוד", lh: "כהן", job: "CTO", dep: "Direction", start: "2018-03-01", birth: "1982-11-20", salary: 52000, gender: "MALE" },
    sarah: { first: "Sarah", last: "Levi", fh: "שרה", lh: "לוי", job: "Responsable RH", dep: "Direction", start: "2019-06-15", birth: "1988-11-28", salary: 28000, gender: "FEMALE", manager: "david" },
    yossi: { first: "Yossi", last: "Mizrahi", fh: "יוסי", lh: "מזרחי", job: "Head of Infrastructure", dep: "Infrastructure", start: "2019-01-07", birth: "1985-02-14", salary: 38000, gender: "MALE", manager: "david" },
    noa: { first: "Noa", last: "Friedman", fh: "נועה", lh: "פרידמן", job: "Lead Developer", dep: "Développement", start: "2020-02-03", birth: "1990-12-02", salary: 36000, gender: "FEMALE", manager: "david" },
    avi: { first: "Avi", last: "Peretz", fh: "אבי", lh: "פרץ", job: "DevOps Engineer", dep: "Infrastructure", start: "2021-04-11", birth: "1992-07-30", salary: 29000, gender: "MALE", manager: "yossi" },
    tamar: { first: "Tamar", last: "Biton", fh: "תמר", lh: "ביטון", job: "SysAdmin", dep: "Infrastructure", start: "2022-09-01", birth: "1994-11-18", salary: 22000, gender: "FEMALE", manager: "yossi" },
    eli: { first: "Eli", last: "Azoulay", fh: "אלי", lh: "אזולאי", job: "Full-stack Developer", dep: "Développement", start: "2021-11-14", birth: "1993-03-09", salary: 27000, gender: "MALE", manager: "noa" },
    maya: { first: "Maya", last: "Shapiro", fh: "מאיה", lh: "שפירא", job: "Frontend Developer", dep: "Développement", start: "2023-01-08", birth: "1996-08-21", salary: 23000, gender: "FEMALE", manager: "noa" },
    lior: { first: "Lior", last: "Ben-David", fh: "ליאור", lh: "בן דוד", job: "Backend Developer", dep: "Développement", start: "2023-07-02", birth: "1995-12-05", salary: 24500, gender: "MALE", manager: "noa" },
    rachel: { first: "Rachel", last: "Amar", fh: "רחל", lh: "עמר", job: "Data Engineer", dep: "Data", start: "2022-03-20", birth: "1991-05-17", salary: 30000, gender: "FEMALE", manager: "david" },
    omer: { first: "Omer", last: "Katz", fh: "עומר", lh: "כץ", job: "Data Analyst", dep: "Data", start: "2024-02-04", birth: "1998-11-11", salary: 19000, gender: "MALE", manager: "rachel" },
    shira: { first: "Shira", last: "Dahan", fh: "שירה", lh: "דהן", job: "Support Engineer", dep: "Support", start: "2022-11-13", birth: "1997-01-25", salary: 16500, gender: "FEMALE", manager: "yossi" },
    yonatan: { first: "Yonatan", last: "Golan", fh: "יונתן", lh: "גולן", job: "Security Engineer", dep: "Sécurité", start: "2021-08-01", birth: "1989-11-30", salary: 34000, gender: "MALE", manager: "david" },
    michal: { first: "Michal", last: "Ohayon", fh: "מיכל", lh: "אוחיון", job: "Junior Developer", dep: "Développement", start: "2026-10-26", birth: "2000-04-03", salary: 15000, gender: "FEMALE", manager: "noa", status: "ONBOARDING" },
  };

  const ids: Record<string, string> = {};
  let n = 1;
  for (const [key, p] of Object.entries(people)) {
    const nationalId = tz(n * 131 + 7);
    const e = await db.employee.create({
      data: {
        organizationId: org.id,
        employeeNumber: String(n).padStart(4, "0"),
        status: p.status ?? "ACTIVE",
        firstName: p.first,
        lastName: p.last,
        firstNameHe: p.fh,
        lastNameHe: p.lh,
        gender: p.gender,
        birthDate: D(p.birth),
        nationality: "Israélienne",
        maritalStatus: n % 3 === 0 ? "SINGLE" : "MARRIED",
        childrenCount: n % 4,
        nationalIdEnc: enc(nationalId),
        nationalIdLast4: nationalId.slice(-4),
        email: `${p.first.toLowerCase()}.${p.last.toLowerCase().replace(/[^a-z]/g, "")}@demolab.co.il`,
        phone: `+972 5${n % 10}-${String(1000000 + n * 7351).slice(0, 3)}-${String(1000 + n * 37).slice(0, 4)}`,
        addressCity: ["Tel Aviv", "Jérusalem", "Haïfa", "Ra'anana", "Herzliya", "Netanya"][n % 6],
        addressCountry: "Israël",
        emergencyName: "Contact famille",
        emergencyPhone: "+972 50-000-0000",
        emergencyRelation: n % 2 ? "Conjoint(e)" : "Parent",
        jobTitle: p.job,
        departmentId: deps[p.dep].id,
        startDate: D(p.start),
        contractType: "PERMANENT",
        workPercentage: 100,
        workLocation: "Tel Aviv — Rothschild 22",
        bankName: ["Leumi", "Hapoalim", "Discount", "Mizrahi-Tefahot"][n % 4],
        bankBranch: String(600 + n),
        bankAccountEnc: enc(String(100000 + n * 4271)),
        pensionFund: ["Menora Mivtachim", "Harel", "Migdal", "Clal"][n % 4],
        pensionEmployeeRate: 6,
        pensionEmployerRate: 6.5,
        severanceRate: 8.33,
        kerenHishtalmut: n % 3 !== 2,
        kerenEmployeeRate: n % 3 !== 2 ? 2.5 : null,
        kerenEmployerRate: n % 3 !== 2 ? 7.5 : null,
      },
    });
    ids[key] = e.id;

    // Historique salarial : embauche + augmentations annuelles
    const start = D(p.start);
    const events: Prisma.CompensationEventCreateManyInput[] = [];
    const yearsIn = Math.max(0, new Date().getUTCFullYear() - start.getUTCFullYear());
    const hireSalary = Math.round(p.salary / Math.pow(1.06, yearsIn) / 100) * 100;
    events.push({ organizationId: org.id, employeeId: e.id, type: "HIRE", effectiveDate: start, baseSalary: hireSalary, jobTitle: p.job, reason: "Salaire d'embauche", decidedBy: "David Cohen" });
    let s = hireSalary;
    for (let y = 1; y <= yearsIn; y++) {
      const d = new Date(Date.UTC(start.getUTCFullYear() + y, 0, 1));
      if (d > new Date()) break;
      s = y === yearsIn ? p.salary : Math.round((s * 1.06) / 100) * 100;
      events.push({ organizationId: org.id, employeeId: e.id, type: y % 3 === 0 ? "PROMOTION" : "RAISE", effectiveDate: d, baseSalary: s, reason: y % 3 === 0 ? "Évolution de poste" : "Revue annuelle", decidedBy: "David Cohen" });
      events.push({ organizationId: org.id, employeeId: e.id, type: "HAVRAA", effectiveDate: new Date(Date.UTC(start.getUTCFullYear() + y, 6, 1)), amount: 2088, reason: "Dmei Havraa annuels" });
    }
    await db.compensationEvent.createMany({ data: events });
    n++;
  }

  for (const [key, p] of Object.entries(people)) {
    if (p.manager) await db.employee.update({ where: { id: ids[key] }, data: { managerId: ids[p.manager] } });
  }


  // ── Congés : types légaux, fêtes, demandes ────────────────
  await db.leaveType.createMany({
    data: DEFAULT_LEAVE_TYPES.map((t, i) => ({
      organizationId: org.id, code: t.code, names: t.names, color: t.color, paid: t.paid,
      tracksBalance: "tracksBalance" in t ? t.tracksBalance : false,
      requiresDocument: "requiresDocument" in t ? t.requiresDocument : false,
      requiresApproval: "requiresApproval" in t ? t.requiresApproval : true,
      deductsFromCode: "deductsFromCode" in t ? t.deductsFromCode : null,
      maxBalance: "maxBalance" in t ? t.maxBalance : null,
      statutory: "statutory" in t ? t.statutory : false, position: i,
    })),
  });
  await db.holiday.createMany({ data: ISRAELI_HOLIDAYS.map((h) => ({ organizationId: org.id, date: D(h.date), kind: h.kind, names: h.names })) });
  const lt = Object.fromEntries((await db.leaveType.findMany({ where: { organizationId: org.id } })).map((t) => [t.code, t.id]));
  const today = new Date();
  const rel = (days: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate() + days));
  const workDaysBetween = (a: Date, b: Date) => { let n = 0; const d = new Date(a); while (d <= b) { if (d.getUTCDay() <= 4) n++; d.setUTCDate(d.getUTCDate() + 1); } return n; };
  const leave = (who: string, code: string, from: number, to: number, status: "APPROVED" | "PENDING" = "APPROVED", reason?: string) => ({
    organizationId: org.id, employeeId: ids[who], leaveTypeId: lt[code], startDate: rel(from), endDate: rel(to), days: workDaysBetween(rel(from), rel(to)), status, reason,
    ...(status === "APPROVED" ? { reviewerName: "David Cohen", reviewedAt: rel(Math.min(from, 0) - 3) } : {}),
  });
  await db.leaveRequest.createMany({
    data: [
      leave("eli", "VACATION", -40, -36), leave("maya", "SICK", -20, -19), leave("avi", "MILUIM", -2, 12, "APPROVED", "Ordre de rappel 8"),
      leave("tamar", "VACATION", 0, 4), leave("lior", "REMOTE", 1, 1), leave("rachel", "VACATION", 6, 13),
      leave("yossi", "VACATION", 8, 12, "PENDING", "Vacances en famille à Eilat"), leave("shira", "SICK_FAMILY", 0, 0),
      leave("noa", "VACATION", 18, 25), leave("eli", "VACATION", 20, 24, "PENDING", "Mariage de mon frère"),
      leave("omer", "UNPAID", 30, 34, "PENDING"), leave("yonatan", "VACATION", -10, -6), leave("david", "VACATION", 40, 47),
      leave("sarah", "WEDDING", 14, 16), leave("maya", "VACATION", 9, 11),
      leave("eli", "VACATION", -150, -141), leave("noa", "VACATION", -120, -113), leave("david", "VACATION", -100, -91), leave("rachel", "VACATION", -180, -174),
      leave("yossi", "VACATION", -90, -86), leave("avi", "VACATION", -200, -193), leave("tamar", "VACATION", -60, -56), leave("shira", "VACATION", -130, -126),
    ],
  });
  // Report de l'année précédente (saisi au 1er janvier)
  const jan1 = new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
  await db.leaveAdjustment.createMany({
    data: Object.keys(people).filter((k) => D(people[k].start) < jan1).map((k, i) => ({
      organizationId: org.id, employeeId: ids[k], leaveTypeId: lt.VACATION, days: [4, 7, 2, 10, 5, 3, 8, 6][i % 8], reason: "Report de l'année précédente", effectiveDate: jan1,
    })),
  });

  // ── Avances ───────────────────────────────────────────────
  const firstOf = (m: number) => new Date(Date.UTC(today.getUTCFullYear(), today.getUTCMonth() + m, 1));
  await db.salaryAdvance.createMany({
    data: [
      { organizationId: org.id, employeeId: ids.shira, amount: 4000, installments: 4, firstDeduction: firstOf(-1), status: "APPROVED", reason: "Réparation voiture", reviewerName: "Sarah Levi", reviewedAt: rel(-40), paidAt: rel(-38) },
      { organizationId: org.id, employeeId: ids.omer, amount: 2500, installments: 2, firstDeduction: firstOf(1), status: "PENDING", reason: "Déménagement" },
      { organizationId: org.id, employeeId: ids.tamar, amount: 6000, installments: 6, firstDeduction: firstOf(1), status: "APPROVED", reason: "Frais médicaux", reviewerName: "Sarah Levi", reviewedAt: rel(-2) },
    ],
  });

  // ── Matériel ──────────────────────────────────────────────
  const sup = Object.fromEntries(await Promise.all([
    ["Bug Multisystem", "Ronen", "b2b@bug.co.il", "*6500"], ["KSP", "Service entreprises", "business@ksp.co.il", "*6006"], ["iDigital (Apple)", "Support Pro", "pro@idigital.co.il", "*2266"], ["Dell Israel", "Account manager", "il_sales@dell.com", "1-809-414-000"],
  ].map(async ([name, contactName, email, phone]) => [name, await db.supplier.create({ data: { organizationId: org.id, name, contactName, email, phone } })])));
  type A = [string, "LAPTOP" | "MONITOR" | "KEYBOARD" | "MOUSE" | "HEADSET" | "DOCKING" | "PHONE" | "SERVER" | "NETWORK", string, string, number, string, number, string];
  const assetsData: A[] = [
    ["david", "LAPTOP", "Apple", "MacBook Pro 16\" M4 Pro", 14900, "2025-02-10", 36, "iDigital (Apple)"],
    ["noa", "LAPTOP", "Apple", "MacBook Pro 14\" M4", 10900, "2025-03-02", 36, "iDigital (Apple)"],
    ["yossi", "LAPTOP", "Dell", "Latitude 7450", 7800, "2024-01-15", 36, "Dell Israel"],
    ["avi", "LAPTOP", "Lenovo", "ThinkPad X1 Carbon Gen 12", 8900, "2024-02-20", 36, "Bug Multisystem"],
    ["tamar", "LAPTOP", "Dell", "Latitude 5440", 5200, "2023-11-28", 24, "Dell Israel"],
    ["eli", "LAPTOP", "Lenovo", "ThinkPad T14s Gen 5", 6900, "2024-06-03", 36, "KSP"],
    ["maya", "LAPTOP", "Apple", "MacBook Air 15\" M3", 7400, "2024-01-10", 24, "iDigital (Apple)"],
    ["lior", "LAPTOP", "Dell", "XPS 14", 9200, "2025-07-01", 24, "Dell Israel"],
    ["rachel", "LAPTOP", "Apple", "MacBook Pro 14\" M3 Pro", 11200, "2024-04-18", 36, "iDigital (Apple)"],
    ["yonatan", "LAPTOP", "Lenovo", "ThinkPad P1 Gen 7", 12400, "2024-09-09", 36, "Bug Multisystem"],
    ["shira", "LAPTOP", "HP", "EliteBook 840 G10", 5600, "2023-12-04", 24, "KSP"],
    ["omer", "LAPTOP", "Lenovo", "ThinkPad E14 Gen 5", 4300, "2024-02-01", 24, "KSP"],
    ["david", "MONITOR", "Dell", "UltraSharp U2724D", 1890, "2024-03-10", 36, "Dell Israel"],
    ["noa", "MONITOR", "LG", "UltraFine 27UQ850", 2200, "2024-03-10", 24, "KSP"],
    ["eli", "MONITOR", "Dell", "UltraSharp U2724D", 1890, "2024-06-03", 36, "Dell Israel"],
    ["avi", "DOCKING", "Lenovo", "ThinkPad Thunderbolt 4 Dock", 1150, "2024-02-20", 36, "Bug Multisystem"],
    ["eli", "KEYBOARD", "Logitech", "MX Keys S", 420, "2024-06-03", 12, "KSP"],
    ["eli", "MOUSE", "Logitech", "MX Master 3S", 380, "2024-06-03", 12, "KSP"],
    ["yonatan", "HEADSET", "Jabra", "Evolve2 75", 1290, "2025-01-12", 24, "Bug Multisystem"],
    ["shira", "PHONE", "Apple", "iPhone 16", 3900, "2025-09-20", 12, "iDigital (Apple)"],
    ["", "LAPTOP", "Dell", "Latitude 7450", 7800, "2025-10-20", 36, "Dell Israel"],
    ["", "LAPTOP", "Apple", "MacBook Air 13\" M4", 5900, "2025-10-28", 12, "iDigital (Apple)"],
    ["", "MONITOR", "Dell", "P2725H", 990, "2025-01-05", 36, "Dell Israel"],
    ["", "SERVER", "Dell", "PowerEdge R760", 64000, "2023-05-15", 60, "Dell Israel"],
    ["", "NETWORK", "Ubiquiti", "UniFi Dream Machine Pro", 2100, "2022-08-01", 24, "Bug Multisystem"],
  ];
  let tag = 1;
  for (const [who, category, brand, model, price, bought, months, s] of assetsData) {
    const purchase = D(bought);
    const warranty = new Date(Date.UTC(purchase.getUTCFullYear(), purchase.getUTCMonth() + months, purchase.getUTCDate()));
    const a = await db.asset.create({
      data: {
        organizationId: org.id, assetTag: `IT-${String(tag).padStart(4, "0")}`, category, brand, model, serialNumber: `${brand.slice(0, 2).toUpperCase()}${(98765 + tag * 7919).toString(36).toUpperCase()}${tag}`,
        status: who ? "ASSIGNED" : category === "SERVER" || category === "NETWORK" ? "ASSIGNED" : "IN_STOCK", condition: who ? "GOOD" : "NEW",
        purchaseDate: purchase, purchasePrice: price, replacementCost: Math.round(price * 0.8), supplierId: sup[s].id, invoiceNumber: `INV-${2024 + (tag % 2)}-${1000 + tag * 13}`,
        warrantyEndDate: warranty, warrantyProvider: brand, warrantyContact: `${brand} Pro Support`, warrantyPhone: sup[s].phone, warrantyEmail: sup[s].email,
        location: who ? null : category === "SERVER" || category === "NETWORK" ? "Salle serveur — Rack A" : "Stock — Armoire IT",
      },
    });
    if (category === "SERVER" || category === "NETWORK") await db.asset.update({ where: { id: a.id }, data: { status: "IN_STOCK" } });
    if (who) {
      const pending = who === "lior" || (who === "shira" && category === "PHONE");
      const emp = people[who];
      await db.assetAssignment.create({
        data: {
          organizationId: org.id, assetId: a.id, employeeId: ids[who], assignedAt: purchase > D(emp.start) ? purchase : D(emp.start),
          liabilityAmount: Math.round(price * 0.8), conditionOut: "GOOD",
          ...(pending ? {} : { signedAt: purchase > D(emp.start) ? purchase : D(emp.start), signerName: `${emp.first} ${emp.last}` }),
        },
      });
    }
    tag++;
  }

  // ── Licences SaaS ─────────────────────────────────────────
  const lic = async (name: string, vendor: string, category: string, cost: number, cycle: "MONTHLY" | "YEARLY", seats: number, who: string[], renewIn: number) => {
    const l = await db.license.create({ data: { organizationId: org.id, name, vendor, category, costPerSeat: cost, currency: "USD", billingCycle: cycle, seatsPurchased: seats, renewalDate: rel(renewIn) } });
    await db.licenseSeat.createMany({ data: who.map((w) => ({ organizationId: org.id, licenseId: l.id, employeeId: ids[w], accountEmail: `${people[w].first.toLowerCase()}@demolab.co.il` })) });
  };
  const all = Object.keys(people);
  await lic("Google Workspace Business", "Google", "Collaboration", 14, "MONTHLY", 16, all, 120);
  await lic("Slack Pro", "Salesforce", "Collaboration", 8.75, "MONTHLY", 15, all.filter((w) => w !== "michal"), 45);
  await lic("Jira Software Standard", "Atlassian", "Dev", 7.53, "MONTHLY", 10, ["david", "noa", "eli", "maya", "lior", "rachel", "omer", "yonatan"], 18);
  await lic("GitHub Team", "GitHub", "Dev", 48, "YEARLY", 8, ["noa", "eli", "maya", "lior", "avi", "yonatan"], 200);
  await lic("1Password Business", "AgileBits", "Sécurité", 7.99, "MONTHLY", 15, all.filter((w) => w !== "michal"), 25);
  await lic("Figma Professional", "Figma", "Design", 15, "MONTHLY", 3, ["maya"], 60);

  // ── Projets & ownership ───────────────────────────────────
  type Pr = [string, string, string, string, "ACTIVE" | "BUILD" | "MAINTENANCE", "LOW" | "MEDIUM" | "HIGH" | "CRITICAL", string, string, number, string | null, number, string];
  const projectsData: Pr[] = [
    ["ERP", "ERP Priority", "ERP de gestion commerciale et comptable", "#6366f1", "ACTIVE", "CRITICAL", "rachel", "rachel", 5, "omer", 3, "Paramétrage, interfaces et reporting autour de Priority. Interfaces avec la banque, la paie et le CRM."],
    ["INFRA", "Infrastructure & Cloud", "Serveurs, réseau, AWS et sauvegardes", "#0ea5e9", "ACTIVE", "CRITICAL", "yossi", "yossi", 5, "avi", 4, "Hébergement on-prem et AWS, réseau, VPN, sauvegardes 3-2-1 et PRA."],
    ["SEC", "Sécurité & Conformité", "SOC, IAM, conformité Amendement 13", "#ef4444", "ACTIVE", "HIGH", "yonatan", "yonatan", 5, "avi", 2, "Gestion des identités, EDR, revue des accès, conformité à la loi sur la protection de la vie privée."],
    ["PORTAL", "Portail clients", "Espace client web et mobile", "#10b981", "BUILD", "HIGH", "noa", "noa", 5, "eli", 4, "Application Next.js exposée aux clients : suivi de commandes, factures, tickets."],
    ["DATA", "Data Platform", "Entrepôt de données et BI", "#8b5cf6", "ACTIVE", "MEDIUM", "rachel", "rachel", 4, "lior", 2, "Pipelines d'ingestion, entrepôt BigQuery, tableaux de bord Looker Studio."],
    ["HELP", "Helpdesk", "Support utilisateurs N1/N2", "#f59e0b", "ACTIVE", "MEDIUM", "shira", "shira", 4, "tamar", 3, "Outil de ticketing, base de connaissances, SLA internes."],
    ["M365", "Poste de travail", "Parc, MDM, images et déploiements", "#14b8a6", "MAINTENANCE", "MEDIUM", "tamar", "tamar", 4, "shira", 3, "Gestion du parc via MDM, masters Windows/macOS, déploiement des logiciels."],
    ["API", "API Gateway", "Passerelle d'API partenaires", "#ec4899", "BUILD", "HIGH", "eli", "eli", 4, null, 3, "Exposition sécurisée des API internes aux partenaires (OAuth2, quotas, monitoring)."],
    ["MOBILE", "App mobile terrain", "Application des techniciens", "#84cc16", "BUILD", "MEDIUM", "maya", "maya", 3, "lior", 2, "Application React Native pour les interventions terrain, mode hors ligne."],
  ];
  const pids: Record<string, string> = {};
  for (const [key, name, tagline, color, status, criticality, , owner, oe, deputy, de, definition] of projectsData) {
    const p = await db.project.create({
      data: { organizationId: org.id, key, name, tagline, color, status, criticality, ownerId: ids[owner], ownerExpertise: oe, deputyId: deputy ? ids[deputy] : null, deputyExpertise: de, definition, links: [{ label: "Repository", url: `https://github.com/demolab/${key.toLowerCase()}` }, { label: "Documentation", url: `https://wiki.demolab.co.il/${key.toLowerCase()}` }] },
    });
    pids[key] = p.id;
  }
  type B = [string, string, "IDEA" | "SCOPING" | "DEFINITION" | "REVIEW" | "VALIDATED" | "IN_JIRA" | "REJECTED", string, number | null, number | null, number | null, number | null, string | null];
  const backlog: B[] = [
    ["PORTAL", "Connexion par lien magique (sans mot de passe)", "IDEA", "eli", 3000, 1, 50, 2, null],
    ["PORTAL", "Téléchargement groupé des factures en ZIP", "SCOPING", "noa", 1200, 1, 80, 1, null],
    ["PORTAL", "Notifications push sur l'avancement des commandes", "DEFINITION", "noa", 5000, 2, 70, 4, null],
    ["PORTAL", "Mode sombre et accessibilité AA", "REVIEW", "maya", 8000, 0.5, 90, 2, null],
    ["PORTAL", "Paiement en ligne des factures (Tranzila)", "VALIDATED", "noa", 2500, 3, 80, 6, null],
    ["PORTAL", "Suivi des tickets en temps réel", "IN_JIRA", "eli", 4000, 2, 100, 3, "PORT-142"],
    ["INFRA", "Migrer les sauvegardes vers S3 Glacier Instant", "DEFINITION", "yossi", 30, 2, 80, 3, null],
    ["INFRA", "Second lien Internet (Bezeq + Partner) en failover", "VALIDATED", "yossi", 30, 3, 100, 2, null],
    ["INFRA", "Kubernetes managé (EKS) pour les apps internes", "SCOPING", "avi", 30, 2, 50, 12, null],
    ["INFRA", "Supervision Grafana + alerting Slack", "IN_JIRA", "avi", 30, 2, 90, 2, "OPS-87"],
    ["SEC", "MFA obligatoire par clé matérielle pour les admins", "REVIEW", "yonatan", 12, 3, 90, 1, null],
    ["SEC", "Revue trimestrielle automatisée des accès", "IDEA", "yonatan", 16, 2, 60, 3, null],
    ["SEC", "Simulation de phishing mensuelle", "VALIDATED", "yonatan", 16, 1, 80, 1, null],
    ["ERP", "Interface bancaire automatique (Leumi API)", "DEFINITION", "rachel", 5, 3, 70, 5, null],
    ["ERP", "Export comptable vers Hashavshevet", "IDEA", "omer", 3, 1, 50, 2, null],
    ["DATA", "Tableau de bord de rentabilité par client", "SCOPING", "rachel", 10, 2, 60, 4, null],
    ["DATA", "Ingestion temps réel des événements du portail", "IDEA", "lior", 10, 1, 40, 6, null],
    ["HELP", "Chatbot de premier niveau sur Slack", "IDEA", "shira", 16, 1, 50, 3, null],
    ["HELP", "Portail self-service de réinitialisation de mot de passe", "VALIDATED", "shira", 16, 2, 90, 1, null],
    ["API", "Rate limiting par partenaire", "DEFINITION", "eli", 20, 2, 80, 2, null],
    ["MOBILE", "Signature client sur la tablette en fin d'intervention", "REVIEW", "maya", 40, 3, 70, 3, null],
    ["MOBILE", "Synchronisation hors ligne des fiches d'intervention", "SCOPING", "lior", 40, 3, 50, 8, null],
    ["M365", "Migration des postes vers Intune Autopilot", "REJECTED", "tamar", 16, 1, 30, 10, null],
  ];
  const counters: Record<string, number> = {};
  for (const [key, title, stage, author, reach, impact, confidence, effort, jira] of backlog) {
    counters[key] = (counters[key] ?? 0) + 1;
    const item = await db.backlogItem.create({
      data: {
        organizationId: org.id, projectId: pids[key], number: counters[key], title, stage, authorId: ids[author], reach, impact, confidence, effort,
        jiraKey: jira, problem: "Les utilisateurs nous remontent régulièrement ce besoin ; aujourd'hui le contournement est manuel et coûteux.",
        proposal: stage === "IDEA" ? null : "Mettre en place une solution standard, mesurer l'adoption sur un mois puis généraliser.",
        acceptance: ["VALIDATED", "IN_JIRA", "REVIEW"].includes(stage) ? "- Fonctionne sur desktop et mobile\n- Documenté dans le wiki\n- Validé par l'owner" : null,
      },
    });
    if (stage === "REVIEW" || stage === "VALIDATED") {
      await db.backlogComment.createMany({ data: [
        { organizationId: org.id, itemId: item.id, authorId: ids.david, authorName: "David Cohen", body: "Bonne idée, quel est l'impact sur la charge de l'équipe ce trimestre ?" },
        { organizationId: org.id, itemId: item.id, authorId: ids[author], authorName: `${people[author].first} ${people[author].last}`, body: "Estimé à quelques jours, je peux le prendre dès le prochain sprint." },
      ] });
    }
  }

  // ── Onboarding de Michal ─────────────────────────────────
  await db.checklistTask.createMany({
    data: DEFAULT_ONBOARDING.map((t, i) => ({ organizationId: org.id, employeeId: ids.michal, kind: "ONBOARDING" as const, title: t.title, category: t.category, position: i, done: i < 6, doneAt: i < 6 ? rel(-7) : null, doneByName: i < 6 ? "Sarah Levi" : null })),
  });

  const hash = await bcrypt.hash("admin1234", 10);
  const users = [
    { email: "admin@itmanager.dev", name: "David Cohen", role: "OWNER" as const, emp: "david" },
    { email: "rh@itmanager.dev", name: "Sarah Levi", role: "HR" as const, emp: "sarah" },
    { email: "manager@itmanager.dev", name: "Noa Friedman", role: "MANAGER" as const, emp: "noa" },
    { email: "dev@itmanager.dev", name: "Eli Azoulay", role: "EMPLOYEE" as const, emp: "eli" },
  ];
  for (const u of users) {
    await db.user.create({
      data: {
        email: u.email,
        name: u.name,
        passwordHash: hash,
        memberships: { create: { organizationId: org.id, role: u.role, employeeId: ids[u.emp] } },
      },
    });
  }

  console.log(`✔ Seed OK — organisation « ${org.name} », ${Object.keys(people).length} collaborateurs`);
  console.log("  Comptes (mot de passe admin1234) : admin@ / rh@ / manager@ / dev@itmanager.dev");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => db.$disconnect());
