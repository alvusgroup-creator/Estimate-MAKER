/**
 * Local dev seed: one org + user + starter catalog + a couple of clients and estimates.
 * Run: npx prisma db seed
 * SEED_USER_ID must be a real Supabase auth user id so you can log in and see the data.
 */
import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { GENERAL_CONTRACTOR_PRESETS, DEFAULT_TERMS } from "../src/lib/catalog-presets";
import { computeTotals } from "../src/lib/estimates/calc";

const prisma = new PrismaClient({ adapter: new PrismaPg({ connectionString: process.env.DIRECT_URL ?? process.env.DATABASE_URL }) });

async function main() {
  const userId = process.env.SEED_USER_ID;
  const email = process.env.SEED_USER_EMAIL ?? "dev@example.com";
  if (!userId) throw new Error("Set SEED_USER_ID (Supabase auth user id) before seeding");

  const org = await prisma.organization.create({
    data: {
      name: "Rodriguez Home Services LLC",
      email: "hello@rodriguezhs.com",
      phone: "(555) 010-2030",
      licenseNo: "CSLB #1092233",
      addressLine1: "412 Oak Street",
      city: "Austin",
      state: "TX",
      postalCode: "78701",
      primaryColor: "#0F3D3E",
      accentColor: "#E76F51",
      defaultTaxRate: 0.0825,
      defaultTerms: DEFAULT_TERMS,
      defaultDepositType: "PERCENT",
      defaultDepositValue: 30,
      users: { create: { id: userId, email, fullName: "Felipe Dev" } },
      serviceItems: { create: GENERAL_CONTRACTOR_PRESETS },
      clients: {
        create: [
          { firstName: "Sarah", lastName: "Mitchell", phone: "(555) 221-8790", email: "sarah.m@gmail.com", addressLine1: "88 Pecan Ln", city: "Austin", state: "TX", postalCode: "78745" },
          { firstName: "Dan", lastName: "Kowalski", companyName: "Kowalski Rentals", phone: "(555) 330-1144", addressLine1: "1500 Riverside Dr", city: "Austin", state: "TX", postalCode: "78741", tags: ["landlord", "repeat"] },
        ],
      },
    },
    include: { clients: true, serviceItems: true },
  });

  const paint = org.serviceItems.find((s) => s.name.startsWith("Interior Painting — Walls"))!;
  const prep = org.serviceItems.find((s) => s.name === "Site Prep & Protection")!;
  const cleanup = org.serviceItems.find((s) => s.name === "Final Cleanup")!;

  const lines = [
    { serviceItemId: prep.id, name: prep.name, description: prep.description, quantity: 1, unit: prep.unit, unitPrice: Number(prep.unitPrice), taxable: prep.taxable },
    { serviceItemId: paint.id, name: paint.name, description: paint.description, quantity: 1200, unit: paint.unit, unitPrice: Number(paint.unitPrice), taxable: paint.taxable },
    { serviceItemId: cleanup.id, name: cleanup.name, description: cleanup.description, quantity: 1, unit: cleanup.unit, unitPrice: Number(cleanup.unitPrice), taxable: cleanup.taxable },
  ];
  const totals = computeTotals({ lines, taxRate: 0.0825, depositType: "PERCENT", depositValue: 30 });

  await prisma.estimate.create({
    data: {
      organizationId: org.id,
      clientId: org.clients[0].id,
      number: "EST-1001",
      title: "Interior repaint — living room & hallway",
      status: "SENT",
      sentAt: new Date(),
      expiresAt: new Date(Date.now() + 30 * 864e5),
      jobAddressLine1: "88 Pecan Ln",
      jobCity: "Austin",
      jobState: "TX",
      jobPostalCode: "78745",
      terms: DEFAULT_TERMS,
      taxRate: 0.0825,
      subtotal: totals.subtotal,
      taxAmount: totals.taxAmount,
      total: totals.total,
      depositType: "PERCENT",
      depositValue: 30,
      depositAmount: totals.depositAmount,
      lineItems: { create: lines.map((l, i) => ({ ...l, position: i, lineTotal: totals.lineTotals[i] })) },
      events: { create: [{ type: "CREATED" }, { type: "SENT" }] },
    },
  });

  await prisma.organization.update({ where: { id: org.id }, data: { nextEstimateNumber: 1002 } });
  console.log(`Seeded org ${org.id} with ${org.serviceItems.length} services, ${org.clients.length} clients, 1 estimate`);
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
