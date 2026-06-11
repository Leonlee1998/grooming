import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { loadEnvFile } from "node:process";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";
import { PrismaClient } from "../generated/client/index.js";

const rootEnvPath = resolve("../../.env");

if (existsSync(rootEnvPath)) {
  loadEnvFile(rootEnvPath);
}

const connectionString = process.env.DIRECT_URL ?? process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL or DIRECT_URL is required to run db:seed.");
}

const pool = new Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("Seeding database...");

  const [wang, lin, chen] = await Promise.all([
    prisma.staff.upsert({
      where: { id: "staff-wang-xiaomei" },
      update: {
        name: "王小美",
        role: "GROOMER",
        surcharge: 0,
        isActive: true,
      },
      create: {
        id: "staff-wang-xiaomei",
        name: "王小美",
        role: "GROOMER",
      },
    }),
    prisma.staff.upsert({
      where: { id: "staff-lin-dashuai" },
      update: {
        name: "林大帥",
        role: "GROOMER",
        surcharge: 100,
        isActive: true,
      },
      create: {
        id: "staff-lin-dashuai",
        name: "林大帥",
        role: "GROOMER",
        surcharge: 100,
      },
    }),
    prisma.staff.upsert({
      where: { id: "staff-chen-manager" },
      update: {
        name: "陳店長",
        role: "MANAGER",
        surcharge: 0,
        isActive: true,
      },
      create: {
        id: "staff-chen-manager",
        name: "陳店長",
        role: "MANAGER",
      },
    }),
  ]);
  console.log(`Staff: ${[wang.name, lin.name, chen.name].join(", ")}`);

  const [basicPlan, vipPlan] = await Promise.all([
    prisma.memberPlan.upsert({
      where: { id: "member-plan-basic" },
      update: {
        name: "一般會員",
        monthlyFee: 0,
        pointRate: 1,
        discountRate: 0,
        isActive: true,
      },
      create: {
        id: "member-plan-basic",
        name: "一般會員",
        description: "免費，1倍點數",
        monthlyFee: 0,
        pointRate: 1,
        discountRate: 0,
      },
    }),
    prisma.memberPlan.upsert({
      where: { id: "member-plan-vip" },
      update: {
        name: "VIP 會員",
        monthlyFee: 299,
        pointRate: 1.5,
        discountRate: 0.05,
        isActive: true,
      },
      create: {
        id: "member-plan-vip",
        name: "VIP 會員",
        description: "月費 299，1.5倍點數，95折",
        monthlyFee: 299,
        pointRate: 1.5,
        discountRate: 0.05,
      },
    }),
  ]);
  console.log(`MemberPlan: ${basicPlan.name}, ${vipPlan.name}`);

  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: "service-bath-spa" },
      update: {
        name: "洗澡 SPA",
        category: "BATH",
        basePrice: 600,
        estimatedMinutes: 90,
        sortOrder: 1,
        isActive: true,
      },
      create: {
        id: "service-bath-spa",
        name: "洗澡 SPA",
        category: "BATH",
        basePrice: 600,
        estimatedMinutes: 90,
        sortOrder: 1,
      },
    }),
    prisma.service.upsert({
      where: { id: "service-haircut" },
      update: {
        name: "剃毛",
        category: "HAIRCUT",
        basePrice: 800,
        estimatedMinutes: 120,
        sortOrder: 2,
        isActive: true,
      },
      create: {
        id: "service-haircut",
        name: "剃毛",
        category: "HAIRCUT",
        basePrice: 800,
        estimatedMinutes: 120,
        sortOrder: 2,
      },
    }),
    prisma.service.upsert({
      where: { id: "service-nail" },
      update: {
        name: "剪指甲",
        category: "NAIL",
        basePrice: 150,
        estimatedMinutes: 15,
        sortOrder: 3,
        isActive: true,
      },
      create: {
        id: "service-nail",
        name: "剪指甲",
        category: "NAIL",
        basePrice: 150,
        estimatedMinutes: 15,
        sortOrder: 3,
      },
    }),
    prisma.service.upsert({
      where: { id: "service-bath-haircut" },
      update: {
        name: "洗澡+剃毛",
        category: "BATH",
        basePrice: 1200,
        estimatedMinutes: 180,
        sortOrder: 4,
        isActive: true,
      },
      create: {
        id: "service-bath-haircut",
        name: "洗澡+剃毛",
        category: "BATH",
        basePrice: 1200,
        estimatedMinutes: 180,
        sortOrder: 4,
      },
    }),
    prisma.service.upsert({
      where: { id: "service-face-spa" },
      update: {
        name: "臉部美容",
        category: "SPA",
        basePrice: 300,
        estimatedMinutes: 30,
        sortOrder: 5,
        isActive: true,
      },
      create: {
        id: "service-face-spa",
        name: "臉部美容",
        category: "SPA",
        basePrice: 300,
        estimatedMinutes: 30,
        sortOrder: 5,
      },
    }),
    prisma.service.upsert({
      where: { id: "service-essential-oil-spa" },
      update: {
        name: "精油護膚",
        category: "SPA",
        basePrice: 500,
        estimatedMinutes: 60,
        sortOrder: 6,
        isActive: true,
      },
      create: {
        id: "service-essential-oil-spa",
        name: "精油護膚",
        category: "SPA",
        basePrice: 500,
        estimatedMinutes: 60,
        sortOrder: 6,
      },
    }),
  ]);
  console.log(`Service: ${services.map((service) => service.name).join(", ")}`);

  const priceRules = await Promise.all([
    prisma.priceRule.upsert({
      where: { id: "price-rule-bath-spa-over-10kg" },
      update: {
        serviceId: "service-bath-spa",
        name: "洗澡 SPA：體重 10kg 以上",
        weightMin: 10,
        weightMax: null,
        priceAdjustment: 200,
        adjustmentType: "FIXED",
        isActive: true,
      },
      create: {
        id: "price-rule-bath-spa-over-10kg",
        serviceId: "service-bath-spa",
        name: "洗澡 SPA：體重 10kg 以上",
        weightMin: 10,
        priceAdjustment: 200,
        adjustmentType: "FIXED",
      },
    }),
    prisma.priceRule.upsert({
      where: { id: "price-rule-haircut-over-15kg" },
      update: {
        serviceId: "service-haircut",
        name: "剃毛：體重 15kg 以上",
        weightMin: 15,
        weightMax: null,
        priceAdjustment: 300,
        adjustmentType: "FIXED",
        isActive: true,
      },
      create: {
        id: "price-rule-haircut-over-15kg",
        serviceId: "service-haircut",
        name: "剃毛：體重 15kg 以上",
        weightMin: 15,
        priceAdjustment: 300,
        adjustmentType: "FIXED",
      },
    }),
  ]);
  console.log(`PriceRule: ${priceRules.map((rule) => rule.name).join(", ")}`);

  const templateHtml = readFileSync(
    resolve("../contract/templates/single-service.html"),
    "utf-8",
  );
  const contractTemplate = await prisma.contractTemplate.upsert({
    where: { id: "contract-template-standard-single-service" },
    update: {
      name: "標準美容服務契約",
      type: "SINGLE_SERVICE",
      htmlContent: templateHtml,
      customFields: null,
      isActive: true,
      version: 1,
    },
    create: {
      id: "contract-template-standard-single-service",
      name: "標準美容服務契約",
      type: "SINGLE_SERVICE",
      htmlContent: templateHtml,
      version: 1,
    },
  });
  console.log(`ContractTemplate: ${contractTemplate.name}`);

  console.log("Seed complete.");
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
