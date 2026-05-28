// ── Geography data store ──
// Shared between SettingsPage (management) and SitesPage (dropdowns)

const GEO_STORAGE_KEY = 'w2w_geography';

const DEFAULT_GEO = {
  provinces: [{ id: 'PROV-001', name: 'Gauteng', code: 'GP', premier: 'Panyaza Lesufi' }],
  municipalities: [{ id: 'MUN-001', name: 'City of Johannesburg Metropolitan Municipality', code: 'COJ', type: 'Metropolitan', provinceId: 'PROV-001' }],
  subRegions: [
    { id: 'SR-001', name: 'Planning Region C', code: 'C', description: 'Florida Lake, Fleurhof, Doornkop, Zandspruit corridor — western sub-region', municipalityId: 'MUN-001' },
    { id: 'SR-002', name: 'Planning Region D', code: 'D', description: 'Naledi, Jabulani — Soweto rail corridor', municipalityId: 'MUN-001' },
    { id: 'SR-003', name: 'Planning Region F', code: 'F', description: 'Newtown, Marshalltown — inner city', municipalityId: 'MUN-001' },
    { id: 'SR-004', name: 'Planning Region G', code: 'G', description: 'Lenasia, Orange Farm, Ennerdale — southern region', municipalityId: 'MUN-001' },
  ],
  proPartners: [
    { id: 'PRO-001', name: 'Petco', code: 'PETCO', focus: 'PET Plastics', contact: '' },
    { id: 'PRO-002', name: 'Polyco', code: 'POLYCO', focus: 'HDPE, LDPE, PP Plastics', contact: '' },
    { id: 'PRO-003', name: 'Fibre Cycle', code: 'FC', focus: 'Paper & Cardboard', contact: '' },
    { id: 'PRO-004', name: 'Metpac', code: 'METPAC', focus: 'Metals & Cans', contact: '' },
    { id: 'PRO-005', name: 'E-Wasa', code: 'EWASA', focus: 'E-Waste', contact: '' },
    { id: 'PRO-006', name: 'Circular Energy', code: 'CE', focus: 'Mixed / Energy Recovery', contact: '' },
  ],
};

export function loadGeography() {
  try {
    const saved = localStorage.getItem(GEO_STORAGE_KEY);
    if (saved) return JSON.parse(saved);
  } catch {}
  return DEFAULT_GEO;
}

export function saveGeography(geo: any) {
  localStorage.setItem(GEO_STORAGE_KEY, JSON.stringify(geo));
}
