const fs = require('fs');

const path = '/Users/samdani/Desktop/check/w2w/frontend/src/pages/W2WSettingsPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Update the WasteType state
content = content.replace(/const \[wtForm, setWtForm\] = useState<any>\({ id: '', name: '', category: '', unit: 'kg', pricePerUnit: 0, colour: '#146484' }\);/,
  `const [wtForm, setWtForm] = useState<any>({ id: '', name: '', category: '', unit: 'kg', pricePerUnit: 0, pricePerKg: 0, buyer: '', colour: '#146484' });`);

// 2. Update the Create Modal handler
content = content.replace(/setWtForm\({ id: '', name: '', category: '', unit: 'kg', pricePerUnit: 0, colour: '#146484' }\);/,
  `setWtForm({ id: '', name: '', category: '', unit: 'kg', pricePerUnit: 0, pricePerKg: 0, buyer: '', colour: '#146484' });`);

// 3. Update the modal form fields for Waste Types
const formFields = `
                <div className="full"><div className="fg"><label className="fl">Waste Type Name <span className="req">*</span></label>
                  <input className="fc" value={wtForm.name} onChange={(e) => setWtForm({ ...wtForm, name: e.target.value })} />
                </div></div>
                <div className="fg"><label className="fl">Category</label>
                  <input className="fc" value={wtForm.category} onChange={(e) => setWtForm({ ...wtForm, category: e.target.value })} placeholder="e.g. Plastics" />
                </div>
                <div className="fg"><label className="fl">Unit</label>
                  <input className="fc" value={wtForm.unit} onChange={(e) => setWtForm({ ...wtForm, unit: e.target.value })} />
                </div>
                <div className="fg"><label className="fl">Default Price (per unit)</label>
                  <input className="fc" type="number" step="0.1" value={wtForm.pricePerUnit} onChange={(e) => setWtForm({ ...wtForm, pricePerUnit: Number(e.target.value) })} />
                </div>
                <div className="fg"><label className="fl">EPR Price (per kg)</label>
                  <input className="fc" type="number" step="0.1" value={wtForm.pricePerKg} onChange={(e) => setWtForm({ ...wtForm, pricePerKg: Number(e.target.value) })} />
                </div>
                <div className="full"><div className="fg"><label className="fl">EPR Buyer (PRO Partner)</label>
                  <select className="fc" value={wtForm.buyer} onChange={(e) => setWtForm({ ...wtForm, buyer: e.target.value })}>
                    <option value="">— Select PRO Partner —</option>
                    {(geo.proPartners || []).map((p: any) => <option key={p.id} value={p.name}>{p.name}</option>)}
                  </select>
                </div></div>
                <div className="fg full"><label className="fl">Label Colour</label>
                  <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
                    <input type="color" value={wtForm.colour} onChange={(e) => setWtForm({ ...wtForm, colour: e.target.value })} style={{ width: 40, height: 32, padding: 0, border: 'none' }} />
                    <span style={{ fontSize: 12, fontFamily: 'var(--font-mono)' }}>{wtForm.colour}</span>
                  </div>
                </div>
`;
content = content.replace(/<div className="full"><div className="fg"><label className="fl">Waste Type Name[\s\S]*?<\/div>\n                <\/div>/, formFields);

// 4. Update the Table columns
content = content.replace(/<th>Name<\/th>\n\s*<th>Category<\/th>\n\s*<th>Unit<\/th>\n\s*<th>Def\. Price<\/th>/,
  `<th>Name</th>
                        <th>Category</th>
                        <th>Unit</th>
                        <th>Def. Price</th>
                        <th>EPR Price/kg</th>
                        <th>Buyer</th>`);

// 5. Update Table row
content = content.replace(/<td>{wt\.category || '—'}<\/td>\n\s*<td>{wt\.unit}<\/td>\n\s*<td>R {wt\.pricePerUnit\.toFixed\(2\)}<\/td>/,
  `<td>{wt.category || '—'}</td>
                          <td>{wt.unit}</td>
                          <td>R {wt.pricePerUnit?.toFixed(2) || '0.00'}</td>
                          <td>R {wt.pricePerKg?.toFixed(2) || '0.00'}</td>
                          <td>{wt.buyer || '—'}</td>`);

fs.writeFileSync(path, content);
console.log('patched settings');
