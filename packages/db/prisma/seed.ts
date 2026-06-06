import { Pool } from "pg";
import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/client/index.js";

const pool = new Pool({ connectionString: process.env.DATABASE_URL });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

async function main() {
  console.log("🌱 開始植入 seed 資料...");

  // ── 契約模板 ──────────────────────────────────────────────────────────────
  const template = await prisma.contractTemplate.upsert({
    where: { id: "template-default-v1" },
    update: {},
    create: {
      id: "template-default-v1",
      name: "犬貓美容服務定型化契約（農業部 114/05/12）",
      version: "1.0",
      isDefault: true,
      htmlContent: `<!DOCTYPE html>
<html lang="zh-TW">
<head><meta charset="UTF-8"><title>犬貓美容服務契約</title></head>
<body>
  <h1>犬、貓美容服務契約書</h1>
  <p>立契約書人（以下稱甲方）：{{customerName}}，電話：{{customerPhone}}</p>
  <p>美容業者（以下稱乙方）：{{shopName}}</p>
  <h2>一、服務項目及費用（§3）</h2>
  <table>
    <tr><th>項目</th><th>單價</th><th>數量</th><th>小計</th></tr>
    {{#each items}}
    <tr><td>{{name}}</td><td>{{unitPrice}}</td><td>{{quantity}}</td><td>{{total}}</td></tr>
    {{/each}}
  </table>
  <p>合計：NT$ {{total}} 元</p>
  <h2>二、寵物資料及健康狀況（§4）</h2>
  <p>寵物名稱：{{petName}}，品種：{{petBreed}}，體重：{{petWeight}} kg</p>
  <p>攻擊性：{{isAggressive}}，健康狀況：{{healthCondition}}，疾病史：{{diseases}}</p>
  <h2>三、逾時費用規定</h2>
  <p>服務超過約定時間30分鐘以內不加收費用；超過30分鐘起按比例計收。</p>
  <h2>四、解約及退費</h2>
  <p>3日內申請退費，手續費上限為服務費5%且不超過新台幣1,000元。</p>
  <h2>五、緊急就醫</h2>
  <p>客戶指定獸醫院：{{emergencyVetClinic}}</p>
  <h2>六、簽署</h2>
  <p>甲方簽名：</p>
  <img src="{{signatureDataUrl}}" alt="客戶簽名" style="max-width:300px;border:1px solid #ccc;" />
  <p>簽署日期：{{signedAt}}</p>
</body>
</html>`,
      requiredFields: [
        { key: "customerName", label: "客戶姓名", type: "text", locked: true },
        { key: "customerPhone", label: "客戶電話", type: "text", locked: true },
        { key: "petName", label: "寵物名稱", type: "text", locked: true },
        { key: "petBreed", label: "品種", type: "text", locked: true },
        { key: "petWeight", label: "體重(kg)", type: "number", locked: true },
        { key: "isAggressive", label: "攻擊性", type: "boolean", locked: true },
        { key: "healthCondition", label: "健康狀況", type: "text", locked: true },
        { key: "diseases", label: "疾病史", type: "text", locked: true },
        { key: "emergencyVetClinic", label: "緊急獸醫院", type: "text", locked: true },
        { key: "items", label: "服務項目", type: "array", locked: true },
        { key: "total", label: "總金額", type: "number", locked: true },
        { key: "signatureDataUrl", label: "電子簽名", type: "signature", locked: true },
        { key: "signedAt", label: "簽署日期", type: "datetime", locked: true },
      ],
      customFields: [],
    },
  });
  console.log(`✅ 契約模板：${template.name}`);

  // ── 服務項目 ──────────────────────────────────────────────────────────────
  const services = await Promise.all([
    prisma.service.upsert({
      where: { id: "svc-bath-small" },
      update: {},
      create: {
        id: "svc-bath-small",
        name: "洗澡（小型犬/貓）",
        category: "BATH",
        basePrice: 600,
        estimatedMinutes: 90,
        sortOrder: 1,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-bath-medium" },
      update: {},
      create: {
        id: "svc-bath-medium",
        name: "洗澡（中型犬）",
        category: "BATH",
        basePrice: 900,
        estimatedMinutes: 120,
        sortOrder: 2,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-bath-large" },
      update: {},
      create: {
        id: "svc-bath-large",
        name: "洗澡（大型犬）",
        category: "BATH",
        basePrice: 1200,
        estimatedMinutes: 150,
        sortOrder: 3,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-full-small" },
      update: {},
      create: {
        id: "svc-full-small",
        name: "全套美容（小型犬/貓）",
        category: "FULL_GROOMING",
        basePrice: 1200,
        estimatedMinutes: 150,
        sortOrder: 4,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-full-medium" },
      update: {},
      create: {
        id: "svc-full-medium",
        name: "全套美容（中型犬）",
        category: "FULL_GROOMING",
        basePrice: 1600,
        estimatedMinutes: 180,
        sortOrder: 5,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-full-large" },
      update: {},
      create: {
        id: "svc-full-large",
        name: "全套美容（大型犬）",
        category: "FULL_GROOMING",
        basePrice: 2200,
        estimatedMinutes: 210,
        sortOrder: 6,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-nail" },
      update: {},
      create: {
        id: "svc-nail",
        name: "剪指甲",
        category: "NAIL_TRIM",
        basePrice: 150,
        estimatedMinutes: 15,
        sortOrder: 10,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-ear" },
      update: {},
      create: {
        id: "svc-ear",
        name: "清耳朵",
        category: "EAR_CLEANING",
        basePrice: 150,
        estimatedMinutes: 15,
        sortOrder: 11,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-teeth" },
      update: {},
      create: {
        id: "svc-teeth",
        name: "刷牙",
        category: "TEETH_BRUSHING",
        basePrice: 200,
        estimatedMinutes: 10,
        sortOrder: 12,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-anal" },
      update: {},
      create: {
        id: "svc-anal",
        name: "擠肛門腺",
        category: "ANAL_GLAND",
        basePrice: 100,
        estimatedMinutes: 5,
        sortOrder: 13,
      },
    }),
    prisma.service.upsert({
      where: { id: "svc-knot" },
      update: {},
      create: {
        id: "svc-knot",
        name: "打結處理（加價）",
        category: "ADD_ON",
        basePrice: 200,
        estimatedMinutes: 30,
        sortOrder: 20,
        description: "嚴重打結需額外處理費用",
      },
    }),
  ]);
  console.log(`✅ 服務項目：${services.length} 項`);

  // ── 員工 ──────────────────────────────────────────────────────────────────
  const staff = await prisma.staff.upsert({
    where: { id: "staff-001" },
    update: {},
    create: {
      id: "staff-001",
      name: "陳美容",
      phone: "0912-345-678",
      role: "GROOMER",
    },
  });
  console.log(`✅ 員工：${staff.name}`);

  // ── 會員方案 ──────────────────────────────────────────────────────────────
  const memberPlan = await prisma.memberPlan.upsert({
    where: { id: "plan-gold" },
    update: {},
    create: {
      id: "plan-gold",
      name: "黃金會員",
      description: "每月消費享85折，點數2倍累積",
      price: 1200,
      pointsMultiplier: 2.0,
      reviewDaysMin: 1,
      benefits: {
        discount: 15,
        birthdayBonus: 500,
        freeNailTrimPerYear: 4,
      },
    },
  });
  console.log(`✅ 會員方案：${memberPlan.name}`);

  // ── 範例客戶 + 寵物 ───────────────────────────────────────────────────────
  const customer = await prisma.customer.upsert({
    where: { phone: "0900-000-001" },
    update: {},
    create: {
      name: "王小明",
      phone: "0900-000-001",
      emergencyVetClinic: "台北市大安動物醫院",
      pets: {
        create: {
          name: "球球",
          species: "DOG",
          breed: "貴賓犬",
          weight: 3.5,
          isAggressive: false,
          healthCondition: "健康，無特殊疾病",
          diseases: "無",
        },
      },
    },
  });
  console.log(`✅ 範例客戶：${customer.name}`);

  console.log("\n🎉 Seed 完成！");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
    await pool.end();
  });
