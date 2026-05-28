import prisma from '../src/config/db.js';

const SITES = [
  { name: 'Florida Lake Dumping Site', region: 'Region C', subRegionId: 'SR-001', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'IWMC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 75, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Illegal dumping clearance — lakeside corridor' },
  { name: 'Fleurhof Dumping Site', region: 'Region C', subRegionId: 'SR-001', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'MRC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 75, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Residential waste — high-density flats' },
  { name: 'Doornkop Dumping Site', region: 'Region C', subRegionId: 'SR-001', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'BBC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 70, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Community-based informal dumping' },
  { name: 'Zandspruit Clinic Dumping Site', region: 'Region C', subRegionId: 'SR-001', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'BBC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 70, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Clinic precinct illegal dumping clearance' },
  { name: 'Newtown Dumping Site', region: 'Region F', subRegionId: 'SR-003', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'IWMC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 75, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Inner city waste corridor — arts precinct' },
  { name: 'Marshalltown Dumping Site', region: 'Region F', subRegionId: 'SR-003', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'MRC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 75, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'CBD fringe illegal dumping — commercial waste' },
  { name: 'Naledi Informal Dumping Ground', region: 'Region D', subRegionId: 'SR-002', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'BBC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 70, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Informal settlement dumping — high-volume plastics' },
  { name: 'Jabulani Rail Dumping Site', region: 'Region D', subRegionId: 'SR-002', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'MRC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 70, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Rail corridor illegal dumping clearance' },
  { name: 'Jabulile Secondary School', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'BBC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 72, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'School precinct illegal dumping' },
  { name: 'Sepona Mandela Park Dr 6A', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'IWMC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 72, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Park perimeter illegal dumping clearance' },
  { name: 'Lenasia Old Taxi Rank', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'MRC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 72, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Transport node illegal dumping — high mixed waste' },
  { name: 'Zodiac Primary School', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'BBC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 72, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'School precinct dumping prevention' },
  { name: 'Alice Street x9', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'BBC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 72, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Residential street illegal dumping' },
  { name: 'Pikitup Garden Centre', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'IWMC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 75, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Organic waste & garden refuse — secondary sorting' },
  { name: 'Freedom Park Complex Ground', region: 'Region G', subRegionId: 'SR-004', municipalityId: 'MUN-001', provinceId: 'PROV-001', type: 'MRC', status: 'ACTIVE', phase: 'Month 1', beneficiaries: 14, ohsRating: 72, monthlyTonnage: 0, cleanliness: 'Fair', launched: '2026-04-01', focus: 'Residential complex illegal dumping clearance' },
];

async function seed() {
  console.log('🌱 Seeding 15 prototype sites…');

  for (const site of SITES) {
    const existing = await prisma.site.findFirst({ where: { name: site.name } });
    if (existing) {
      console.log(`  ⏭ Skip (exists): ${site.name}`);
      continue;
    }
    await prisma.site.create({ data: site as any });
    console.log(`  ✅ Created: ${site.name}`);
  }

  const total = await prisma.site.count();
  console.log(`\n🏗 Total sites in DB: ${total}`);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
