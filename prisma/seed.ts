/* Données de démonstration — `npm run db:seed` */
import { PrismaClient, type Prisma } from "@prisma/client";
import bcrypt from "bcryptjs";
import { createCipheriv, randomBytes } from "node:crypto";

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
