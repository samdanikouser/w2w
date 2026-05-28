const fs = require('fs');
const path = '/Users/samdani/Desktop/check/w2w/frontend/src/pages/EPRReportsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// Imports
content = content.replace(/import \{ sitesApi \} from '\.\.\/api\/endpoints';/, "import { sitesApi, settingsApi } from '../api/endpoints';");

// Remove MATERIAL_CODES and MATERIALS
content = content.replace(/\/\* ═══════════════════════════════════════════════════════\n   EPR Material Categories — constants from prototype\n   ═══════════════════════════════════════════════════════ \*\//, '');
content = content.replace(/const MATERIAL_CODES = \[[^\]]+\] as const;/s, '');
content = content.replace(/type MaterialCode = \(typeof MATERIAL_CODES\)\[number\];/s, '');
content = content.replace(/interface MaterialMeta \{[^\}]+\}/s, '');
content = content.replace(/const MATERIALS: Record<MaterialCode, MaterialMeta> = \{[^\}]+\};/s, '');

// Update MaterialBreakdown type
content = content.replace(/interface MaterialBreakdown \{[^\}]+\}/s, 'type MaterialBreakdown = Record<string, number>;');

// Update EprReport interface
content = content.replace(/materialBreakdown: Partial<MaterialBreakdown>;/, 'materialBreakdown: MaterialBreakdown;');

// Update SEED_REPORTS to be empty since we need dynamic DB IDs now
content = content.replace(/const SEED_REPORTS: EprReport\[\] = \[[^\]]+\];/s, 'const SEED_REPORTS: EprReport[] = [];');

// Update emptyBreakdown
content = content.replace(/function emptyBreakdown\(\): MaterialBreakdown \{[\s\S]*?\}/, `function emptyBreakdown(types: any[] = []): MaterialBreakdown {
  const bd: Record<string, number> = {};
  types.forEach(t => bd[t.id] = 0);
  return bd;
}`);

// Update sumBreakdown
content = content.replace(/function sumBreakdown\(bd: Partial<MaterialBreakdown>\): number \{[\s\S]*?\}/, `function sumBreakdown(bd: MaterialBreakdown): number {
  return Object.values(bd).reduce((s, val) => s + (val || 0), 0);
}`);

// Update CreateForm
content = content.replace(/const EMPTY_FORM: CreateForm = \{[\s\S]*?\};/, '');

// Inside EPRReportsPage component
content = content.replace(/const \[form, setForm\] = useState<CreateForm>\(\{ \.\.\.EMPTY_FORM, materialBreakdown: emptyBreakdown\(\) \}\);/, 
  `const [form, setForm] = useState<CreateForm>({ dateFrom: '', dateTo: '', siteId: '', buyerConfirmation: '', traceabilityRef: '', materialBreakdown: {} });`);

// Queries
content = content.replace(/const \{ data: sitesData = \[\] \} = useQuery\(\{ queryKey: \['sites'\], queryFn: \(\) => sitesApi\.list\(\) \}\);/, 
  `const { data: sitesData = [] } = useQuery({ queryKey: ['sites'], queryFn: () => sitesApi.list() });
  const { data: wasteTypes = [] } = useQuery({ queryKey: ['waste-types'], queryFn: () => settingsApi.getWasteTypes() });`);

// Update materialTotals logic
content = content.replace(/\/\* ── Material aggregation for the categories card ── \*\/\n  const materialTotals: Record<MaterialCode, number> = \{\} as Record<MaterialCode, number>;\n  for \(const code of MATERIAL_CODES\) \{\n    materialTotals\[code\] = reports.reduce\(\(s, r\) => s \+ \(r.materialBreakdown\[code\] \?\? 0\), 0\);\n  \}/, 
  `/* ── Material aggregation for the categories card ── */
  const materialTotals: Record<string, number> = {};
  for (const wt of (wasteTypes as any[])) {
    materialTotals[wt.id] = reports.reduce((s, r) => s + (r.materialBreakdown[wt.id] ?? 0), 0);
  }`);

// Update Handlers
content = content.replace(/const openCreate = \(\) => \{[\s\S]*?setModal\('create'\);\n  \};/, 
  `const openCreate = () => {
    setForm({ dateFrom: '', dateTo: '', siteId: '', buyerConfirmation: '', traceabilityRef: '', materialBreakdown: emptyBreakdown(wasteTypes as any[]) });
    setModal('create');
  };`);

content = content.replace(/const updateMaterial = \(code: MaterialCode, val: string\) => \{/, 
  `const updateMaterial = (code: string, val: string) => {`);

// View Modal Rendering
content = content.replace(/\{MATERIAL_CODES\.map\(code => \{[\s\S]*?return \([\s\S]*?<\/tr>\);\n                    \}\)\}/, 
  `{(wasteTypes as any[]).map(wt => {
                      const tons = active.materialBreakdown[wt.id] ?? 0;
                      const revenue = tons * 1000 * (wt.pricePerKg || 0); // tons→kg
                      return (
                        <tr key={wt.id}>
                          <td style={{ fontWeight: 600 }}>{wt.name}</td>
                          <td>{tons.toFixed(1)}t</td>
                          <td>R{(wt.pricePerKg || 0).toFixed(2)}/kg</td>
                          <td style={{ fontWeight: 600 }}>R {revenue.toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>
                        </tr>
                      );
                    })}`);

content = content.replace(/<td>R \{MATERIAL_CODES.reduce\(\(s, code\) => s \+ \(\(active.materialBreakdown\[code\] \?\? 0\) \* 1000 \* MATERIALS\[code\].pricePerKg\), 0\).toLocaleString\('en-ZA', \{ minimumFractionDigits: 0, maximumFractionDigits: 0 \}\)}<\/td>/, 
  `<td>R {(wasteTypes as any[]).reduce((s: number, wt: any) => s + ((active.materialBreakdown[wt.id] ?? 0) * 1000 * (wt.pricePerKg || 0)), 0).toLocaleString('en-ZA', { minimumFractionDigits: 0, maximumFractionDigits: 0 })}</td>`);

// Create Form Rendering
content = content.replace(/\{MATERIAL_CODES\.map\(code => \([\s\S]*?<\/div>\n                \)\)\}/, 
  `{(wasteTypes as any[]).map(wt => (
                  <div className="fg" key={wt.id} style={{ marginBottom: 0 }}>
                    <label className="fl">{wt.name}</label>
                    <input className="fc" type="number" step={0.1} min={0}
                      value={form.materialBreakdown[wt.id] || 0}
                      onChange={e => updateMaterial(wt.id, e.target.value)} />
                  </div>
                ))}`);

// Card Rendering
content = content.replace(/\{MATERIAL_CODES\.map\(code => \{[\s\S]*?const meta = MATERIALS\[code\];[\s\S]*?return \([\s\S]*?<\/div>\n              \);\n            \}\)\}/, 
  `{(wasteTypes as any[]).map(wt => {
              return (
                <div key={wt.id} style={{
                  padding: '12px 14px', border: '1px solid var(--color-border)',
                  borderRadius: 'var(--radius-md)', background: 'var(--color-surface2)',
                }}>
                  <div style={{ fontSize: 10, fontWeight: 700, color: 'var(--color-w2w)', textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: 6 }}>
                    {wt.name}
                  </div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
                    {(materialTotals[wt.id] || 0).toFixed(1)}t
                  </div>
                  <div style={{ fontSize: 10, color: 'var(--color-text3)', marginTop: 4 }}>
                    R{(wt.pricePerKg || 0).toFixed(2)}/kg · {wt.buyer || 'No Buyer'}
                  </div>
                </div>
              );
            })}`);

fs.writeFileSync(path, content);
console.log('patched epr');
