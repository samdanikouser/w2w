import { z } from 'zod';
import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

const siteSchema = z.object({
  name: z.string().min(1),
  type: z.string().default('IWMC'),
  region: z.string().default(''),
  address: z.string().default(''),
  lat: z.number().nullish(),
  lng: z.number().nullish(),
  status: z.enum(['ACTIVE', 'INACTIVE']).default('ACTIVE'),
  ward: z.string().optional().default(''),
  gps: z.string().optional().default(''),
  supervisor: z.string().optional().default(''),
  beneficiaries: z.number().optional().default(0),
  ohsRating: z.number().optional().default(80),
  monthlyTonnage: z.number().optional().default(0),
  phase: z.string().optional().default(''),
  focus: z.string().optional().default(''),
  cleanliness: z.string().optional().default(''),
  launched: z.string().optional().default(''),
  notes: z.string().optional().default(''),
  provinceId: z.string().optional().default(''),
  municipalityId: z.string().optional().default(''),
  subRegionId: z.string().optional().default(''),
  depotId: z.string().optional().nullish(),
  currentSkipBinCount: z.number().optional().nullish(),
  gateFee: z.number().optional().nullish(),
  weighbridge: z.string().optional().nullish(),
});

async function main() {
  try {
    const rawData = {
      depotId: "some-depot-id-that-does-not-exist",
      name: "Test",
      type: "GARDEN_SITE",
      status: "ACTIVE",
      currentSkipBinCount: 0,
      gateFee: 0,
      weighbridge: "active"
    };
    const data = siteSchema.parse(rawData);
    const site = await prisma.site.create({
      data: { 
        ...data, 
        lat: data.lat || null, 
        lng: data.lng || null, 
        status: data.status as any, 
        type: data.type as any,
        depotId: data.depotId || null,
        currentSkipBinCount: data.currentSkipBinCount || null,
        gateFee: data.gateFee || null,
        weighbridge: data.weighbridge || null
      },
    });
    console.log("SUCCESS:", site);
  } catch (err) {
    console.error("ERROR:", err.message);
  }
}
main().finally(() => prisma.$disconnect());
