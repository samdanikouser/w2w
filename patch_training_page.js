const fs = require('fs');

const path = '/Users/samdani/Desktop/check/w2w/frontend/src/pages/TrainingPage.tsx';
let content = fs.readFileSync(path, 'utf8');

// 1. Remove hardcoded modules and initModules
content = content.replace(/const MANDATORY_MODULES = \[[\s\S]*?\];/, '');
content = content.replace(/const OPTIONAL_MODULES = \[[\s\S]*?\];/, '');
content = content.replace(/function initModules\(\)[\s\S]*?return val;\n}/, '');

// 2. Replace initModules call with dynamic lists
content = content.replace(/const modLists = useMemo\(\(\) => initModules\(\), \[\]\);/, `
  const [modModal, setModModal] = useState(false);
  const [modForm, setModForm] = useState({ id: '', name: '', description: '', type: 'MANDATORY', durationHrs: 0 });
`);

content = content.replace(/const isMandatory = \(name: string\) => modLists.mandatory.some\(\(m\) => m.toLowerCase\(\) === name.toLowerCase\(\)\);/, `
  const isMandatory = (name: string) => {
    const m = (modules as any[]).find(x => x.name.toLowerCase() === name.toLowerCase());
    return m ? m.type === 'MANDATORY' : false;
  };
`);

// 3. Update mutations to include create/update/delete for modules
content = content.replace(/\/\* ── Mutations ── \*\//, `/* ── Mutations ── */
  const createModMut = useMutation({
    mutationFn: (p: any) => trainingApi.createModule(p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); setModModal(false); }
  });
  const updateModMut = useMutation({
    mutationFn: ({ id, p }: any) => trainingApi.updateModule(id, p),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); setModModal(false); }
  });
  const deleteModMut = useMutation({
    mutationFn: (id: string) => trainingApi.deleteModule(id),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['training', 'modules'] }); }
  });
`);

// 4. Update Assign Form logic
content = content.replace(/const findModuleId = \(name: string\) => {[\s\S]*?};/, '');

content = content.replace(/if \(!assignForm.employeeId \|\| !assignForm.moduleName\) return;[\s\S]*?const modId = findModuleId\(assignForm.moduleName\);[\s\S]*?if \(!modId\) {[\s\S]*?return;\n    }/, `
    if (!assignForm.employeeId || !assignForm.moduleName) return;
    const modId = assignForm.moduleName;
`);

content = content.replace(/if \(!assignAllForm.moduleName\) return;[\s\S]*?let modId = findModuleId\(assignAllForm.moduleName\);[\s\S]*?if \(!modId\) {[\s\S]*?qc.invalidateQueries\({ queryKey: \['training', 'modules'\] }\);\n    }/, `
    if (!assignAllForm.moduleName) return;
    const modId = assignAllForm.moduleName;
`);

content = content.replace(/const assignAllForModule = async \(moduleName: string\) => {[\s\S]*?let modId = findModuleId\(moduleName\);[\s\S]*?if \(!modId\) {[\s\S]*?qc.invalidateQueries\({ queryKey: \['training', 'modules'\] }\);\n    }/, `
  const assignAllForModule = async (modId: string) => {
`);

content = content.replace(/const getModuleRecords = \(moduleName: string\) => {[\s\S]*?if \(!mod\) return \[\];\n    return allRecords.filter\(\(r\) => r.trainingModuleId === mod.id\);\n  };/, `
  const getModuleRecords = (modId: string) => {
    return allRecords.filter((r) => r.trainingModuleId === modId);
  };
`);

content = content.replace(/const getCompletedCount = \(moduleName: string\) =>\n    getModuleRecords\(moduleName\).filter\(\(r\) => r.status === 'COMPLETED'\).length;/, `
  const getCompletedCount = (modId: string) =>
    getModuleRecords(modId).filter((r) => r.status === 'COMPLETED').length;
`);

// 5. Update UI rendering
content = content.replace(/{modLists.mandatory.map\(\(name, i\) => {[\s\S]*?const completed = getCompletedCount\(name\);/, `{modules.filter((m:any) => m.type === 'MANDATORY').map((mod: any, i: number) => {
                const name = mod.name;
                const completed = getCompletedCount(mod.id);`);

content = content.replace(/<button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={\(\) => assignAllForModule\(name\)}>Assign All<\/button>/g, `
<ActionIcon title="Edit" tone="blue" onClick={() => { setModForm({ id: mod.id, name: mod.name, description: mod.description || '', type: mod.type || 'MANDATORY', durationHrs: mod.durationHrs || 0 }); setModModal(true); }}><Edit2 size={13}/></ActionIcon>
<ActionIcon title="Delete" tone="red" onClick={() => deleteModMut.mutate(mod.id)}><Trash2 size={13}/></ActionIcon>
<button className="btn btn-ghost" style={{ fontSize: 10, padding: '2px 8px' }} onClick={() => assignAllForModule(mod.id)}>Assign All</button>`);

content = content.replace(/{modLists.optional.map\(\(name, i\) => {[\s\S]*?const completed = getCompletedCount\(name\);/, `{modules.filter((m:any) => m.type === 'OPTIONAL').map((mod: any, i: number) => {
                const name = mod.name;
                const completed = getCompletedCount(mod.id);`);


content = content.replace(/<optgroup label="Mandatory">[\s\S]*?{modLists.mandatory.map\(\(m\) => <option key={m} value={m}>{m}<\/option>\)}[\s\S]*?<\/optgroup>/g, `<optgroup label="Mandatory">
                      {modules.filter((m:any) => m.type==='MANDATORY').map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>`);

content = content.replace(/<optgroup label="Optional">[\s\S]*?{modLists.optional.map\(\(m\) => <option key={m} value={m}>{m}<\/option>\)}[\s\S]*?<\/optgroup>/g, `<optgroup label="Optional">
                      {modules.filter((m:any) => m.type==='OPTIONAL').map((m:any) => <option key={m.id} value={m.id}>{m.name}</option>)}
                    </optgroup>`);


content = content.replace(/{modLists.mandatory.map\(\(m\) => \([\s\S]*?<th key={m} style={{ fontSize: 10, whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 6px', maxWidth: 100 }}>{m}<\/th>[\s\S]*?\)\)}/, 
`{modules.filter((m:any)=>m.type==='MANDATORY').map((m:any) => (
                    <th key={m.id} style={{ fontSize: 10, whiteSpace: 'nowrap', textAlign: 'center', padding: '8px 6px', maxWidth: 100 }}>{m.name}</th>
                  ))}`);

content = content.replace(/{modLists.mandatory.length \+ 1}/g, `{modules.filter((m:any)=>m.type==='MANDATORY').length + 1}`);

content = content.replace(/{modLists.mandatory.map\(\(modName\) => {[\s\S]*?const mod = allModules.find\(\(m: any\) => m.name === modName\);[\s\S]*?const rec = mod \? allRecords.find\(\(r: any\) => r.employeeId === emp.id && r.trainingModuleId === mod.id\) : null;/, 
`{modules.filter((m:any)=>m.type==='MANDATORY').map((mod:any) => {
                          const rec = allRecords.find((r: any) => r.employeeId === emp.id && r.trainingModuleId === mod.id);`);

content = content.replace(/return <td key={modName} style={{ textAlign: 'center' }}>{cell}<\/td>;/g, `return <td key={mod.id} style={{ textAlign: 'center' }}>{cell}</td>;`);


content = content.replace(/<div className="pt">Training Tracker<\/div>[\s\S]*?<\/div>[\s\S]*?<div style={{ display: 'flex', gap: 8 }}>/, 
`<div className="pt">Training Tracker</div>
        </div>
        <div style={{ display: 'flex', gap: 8 }}>
          {tab === 'modules' && <button className="btn btn-primary" onClick={() => { setModForm({ id: '', name: '', description: '', type: 'MANDATORY', durationHrs: 0 }); setModModal(true); }}>+ New Module</button>}
`);

// 6. Add Module Modal
const addModModal = `
      {/* ═══ Module Modal ═══ */}
      {modModal && (
        <div className="modal-ov open" onClick={() => setModModal(false)}>
          <div className="modal" style={{ width: 400 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">{modForm.id ? 'Edit Module' : 'New Module'}</span>
              <button onClick={() => setModModal(false)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb">
              <div className="fgrid">
                <div className="full"><div className="fg"><label className="fl">Module Name <span className="req">*</span></label>
                  <input className="fc" value={modForm.name} onChange={(e) => setModForm({ ...modForm, name: e.target.value })} />
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Type</label>
                  <select className="fc" value={modForm.type} onChange={(e) => setModForm({ ...modForm, type: e.target.value })}>
                    <option value="MANDATORY">Mandatory</option>
                    <option value="OPTIONAL">Optional</option>
                  </select>
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Description</label>
                  <textarea className="fc" value={modForm.description} onChange={(e) => setModForm({ ...modForm, description: e.target.value })} />
                </div></div>
                <div className="full"><div className="fg"><label className="fl">Duration (Hours)</label>
                  <input className="fc" type="number" value={modForm.durationHrs} onChange={(e) => setModForm({ ...modForm, durationHrs: Number(e.target.value) })} />
                </div></div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModModal(false)}>Cancel</button>
              <button className="btn btn-primary" disabled={createModMut.isPending || updateModMut.isPending} onClick={() => {
                if (!modForm.name) return;
                if (modForm.id) updateModMut.mutate({ id: modForm.id, p: { name: modForm.name, type: modForm.type, description: modForm.description, durationHrs: modForm.durationHrs } });
                else createModMut.mutate({ name: modForm.name, type: modForm.type, description: modForm.description, durationHrs: modForm.durationHrs });
              }}>
                {modForm.id ? 'Save Changes' : 'Create Module'}
              </button>
            </div>
          </div>
        </div>
      )}
`;

content = content.replace(/<\/div>\n  \);\n}\n$/, addModModal + '\n    </div>\n  );\n}\n');
content = content.replace(/import { X } from 'lucide-react';/, `import { X, Edit2, Trash2 } from 'lucide-react';`);
content = content.replace(/import { StatCard, RowBtn } from '.\/SitesPage';/, `import { StatCard, RowBtn } from './SitesPage';\n\nfunction ActionIcon({ children, title, onClick, tone }: any) {
  const c = tone === 'red' ? 'var(--color-red)' : 'var(--color-w2w)';
  return <button title={title} onClick={onClick} style={{ background: 'transparent', border: 'none', color: c, cursor: 'pointer', padding: 4 }}>{children}</button>;
}`);

fs.writeFileSync(path, content);
console.log('patched');
