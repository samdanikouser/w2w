import React, { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { depotsApi, sitesApi, cooperativesApi, wasteTypesApi } from '../api/endpoints';
import { X, Edit2, Trash2 } from 'lucide-react';

const REGIONS = ['A', 'B', 'C', 'D', 'E', 'F', 'G'];

export default function FacilityDashboard() {
  const qc = useQueryClient();
  const [region, setRegion] = useState('');
  const [depotId, setDepotId] = useState('');
  const [siteId, setSiteId] = useState('');

  const [editingDepotId, setEditingDepotId] = useState<string | null>(null);
  const [editingSiteId, setEditingSiteId] = useState<string | null>(null);
  const [editingCoopId, setEditingCoopId] = useState<string | null>(null);

  const [modal, setModal] = useState<'depot' | 'site' | 'coop' | null>(null);

  // -- Form States --
  const [depotForm, setDepotForm] = useState({ name: '', regionCode: 'A', physicalAddress: '', totalCompactorTrucks: 0, totalSkipLoaderTrucks: 0, operationalStatus: 'active' });
  const [siteForm, setSiteForm] = useState({ 
    depotId: '', name: '', type: 'GARDEN_SITE', status: 'ACTIVE', 
    currentSkipBinCount: 0, gateFee: 0, weighbridge: 'active', maxVehicleTonnage: 0, acceptedMaterials: [] as string[], 
    metadata: {
      publicAccessGateHours: '',
      remainingAirspaceVolume: 0,
      cashFloatBalance: 0,
      commercialOffTakerId: '',
      mechanicalAssetRegistry: [] as string[],
      sortingLineThroughputCapacity: 0,
      landLeaseExpiry: '',
      npoDocumentUrl: '',
      fleetParkingCapacity: 0,
      fuelStationDepotReserve: 0
    }
  });
  const [coopForm, setCoopForm] = useState({ siteId: '', name: '', registrationNumber: '', contactPerson: '', contactNumber: '', totalMembers: 0, hasBalingMachine: false, dailyTonsRecovered: 0, petRate: 0, cardboardRate: 0, aluminumRate: 0 });

  // -- Global Stats --
  const { data: allDepots = [] } = useQuery({
    queryKey: ['depots', 'all'],
    queryFn: () => depotsApi.list(),
  });
  const { data: allSites = [] } = useQuery({
    queryKey: ['sites', 'all'],
    queryFn: () => sitesApi.list(),
  });
  const { data: allCoops = [] } = useQuery({
    queryKey: ['coops', 'all'],
    queryFn: () => cooperativesApi.list(),
  });
  const { data: wasteTypes = [] } = useQuery({
    queryKey: ['waste-types'],
    queryFn: () => wasteTypesApi.list(),
  });

  // -- Filtered Queries --
  const { data: depots = [] } = useQuery({
    queryKey: ['depots', region],
    queryFn: () => depotsApi.list({ regionCode: region }),
    enabled: !!region
  });

  const { data: sites = [] } = useQuery({
    queryKey: ['sites', depotId],
    queryFn: () => sitesApi.list({ depot_id: depotId }),
    enabled: !!depotId
  });

  const { data: coops = [] } = useQuery({
    queryKey: ['coops', siteId],
    queryFn: () => cooperativesApi.list({ siteId }),
    enabled: !!siteId
  });

  // -- Mutations --
  const createDepot = useMutation({
    mutationFn: depotsApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depots'] }); setModal(null); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const updateDepot = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => depotsApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depots'] }); setModal(null); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const deleteDepot = useMutation({
    mutationFn: depotsApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['depots'] }); setDepotId(''); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const createSite = useMutation({
    mutationFn: sitesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setModal(null); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const updateSite = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => sitesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setModal(null); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const deleteSite = useMutation({
    mutationFn: sitesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['sites'] }); setSiteId(''); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const createCoop = useMutation({
    mutationFn: cooperativesApi.create,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coops'] }); setModal(null); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const updateCoop = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => cooperativesApi.update(id, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coops'] }); setModal(null); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const deleteCoop = useMutation({
    mutationFn: cooperativesApi.delete,
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['coops'] }); },
    onError: (err: any) => alert(err.response?.data?.message || err.message)
  });

  const submitCoop = () => {
    const payload = {
      siteId: coopForm.siteId,
      name: coopForm.name,
      registrationNumber: coopForm.registrationNumber,
      contactPerson: coopForm.contactPerson,
      contactNumber: coopForm.contactNumber,
      totalMembers: coopForm.totalMembers,
      hasBalingMachine: coopForm.hasBalingMachine,
      dailyTonsRecovered: coopForm.dailyTonsRecovered,
      materialPayoutRates: {
        pet_plastic_zar_per_kg: coopForm.petRate,
        cardboard_zar_per_kg: coopForm.cardboardRate,
        aluminum_cans_zar_per_kg: coopForm.aluminumRate
      }
    };
    if (editingCoopId) {
      updateCoop.mutate({ id: editingCoopId, data: payload });
    } else {
      createCoop.mutate(payload);
    }
  };

  return (
    <div className="pg">
      <header className="pg-hdr">
        <h1>Facility Hierarchy</h1>
        <div className="acts">
          <button className="btn btn-primary" onClick={() => { setDepotForm({ name: '', regionCode: region || 'A', physicalAddress: '', totalCompactorTrucks: 0, totalSkipLoaderTrucks: 0, operationalStatus: 'active' }); setModal('depot'); }}>+ Add Depot</button>
        </div>
      </header>

      <div className="stats-grid" style={{ marginTop: '24px', marginBottom: '24px' }}>
        <div className="stat-card sc-blue card">
          <div className="stat-title">Total Depots</div>
          <div className="stat-val">{allDepots.length}</div>
        </div>
        <div className="stat-card sc-green card">
          <div className="stat-title">Total Sites</div>
          <div className="stat-val">{allSites.length}</div>
        </div>
        <div className="stat-card sc-purple card">
          <div className="stat-title">Total Cooperatives</div>
          <div className="stat-val">{allCoops.length}</div>
        </div>
      </div>

      <div className="card" style={{ marginBottom: '24px', padding: '24px' }}>
        <h2 style={{ fontSize: '18px', fontWeight: '600', marginBottom: '16px' }}>Facility Filter</h2>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '20px' }}>
          <div className="fg">
            <label>Region</label>
            <select className="fc" value={region} onChange={(e) => { setRegion(e.target.value); setDepotId(''); setSiteId(''); }}>
              <option value="">-- Select Region --</option>
              {REGIONS.map(r => <option key={r} value={r}>Region {r}</option>)}
            </select>
          </div>

          <div className="fg">
            <label>Depot</label>
            <div style={{ display: 'flex', gap: '8px' }}>
              <select className="fc" value={depotId} onChange={(e) => { setDepotId(e.target.value); setSiteId(''); }} disabled={!region}>
                <option value="">-- Select Depot --</option>
                {depots.map((d: any) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
              {depotId && (
                <>
                  <button className="btn btn-outline" style={{ padding: '0 12px' }} onClick={() => {
                    const d = depots.find((x: any) => x.id === depotId);
                    if (d) {
                      setEditingDepotId(d.id);
                      setDepotForm({ name: d.name, regionCode: d.regionCode, physicalAddress: d.physicalAddress || '', totalCompactorTrucks: d.totalCompactorTrucks || 0, totalSkipLoaderTrucks: d.totalSkipLoaderTrucks || 0, operationalStatus: d.operationalStatus || 'active' });
                      setModal('depot');
                    }
                  }}>Edit</button>
                  <button className="btn btn-outline" style={{ padding: '0 12px', color: 'red', borderColor: 'red' }} onClick={() => {
                    if (confirm('Delete this depot?')) deleteDepot.mutate(depotId);
                  }}>Delete</button>
                </>
              )}
            </div>
          </div>

          <div className="fg">
            <label>Site</label>
            <select className="fc" value={siteId} onChange={(e) => setSiteId(e.target.value)} disabled={!depotId}>
              <option value="">-- Select Site --</option>
              {sites.map((s: any) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {depotId && !siteId && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Sites under Depot</h2>
            <button className="btn btn-outline" onClick={() => { setSiteForm({ ...siteForm, depotId }); setModal('site'); }}>+ Add Site</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: '20px' }}>
            {sites.map((s: any) => (
              <div key={s.id} style={{ border: '1px solid var(--color-border)', padding: '20px', borderRadius: '12px', background: 'var(--color-surface)', position: 'relative' }}>
                <div style={{ position: 'absolute', top: 12, right: 12, display: 'flex', gap: '8px' }}>
                  <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '12px' }} onClick={() => {
                    setEditingSiteId(s.id);
                    setSiteForm({
                      name: s.name, type: s.type, status: s.status,
                      depotId: s.depotId,
                      metadata: s.metadata || { fuelStationDepotReserve: 0 },
                      currentSkipBinCount: s.currentSkipBinCount || 0,
                      weighbridge: s.weighbridge || 'active'
                    });
                    setModal('site');
                  }}>Edit</button>
                  <button className="btn btn-outline" style={{ padding: '4px 8px', fontSize: '12px', color: 'red', borderColor: 'red' }} onClick={() => {
                    if (confirm('Delete this site?')) deleteSite.mutate(s.id);
                  }}>Delete</button>
                </div>
                <h3 style={{ display: 'flex', alignItems: 'center', gap: '10px', fontSize: '16px', marginBottom: '12px', paddingRight: '100px' }}>
                  <span style={{ color: s.status === 'ACTIVE' ? '#10b981' : s.status === 'RESTRICTED' ? '#f59e0b' : '#ef4444', fontSize: '12px' }}>●</span>
                  {s.name}
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  <p style={{ fontSize: '14px', color: 'var(--color-text-dim)' }}><strong>Type:</strong> {s.type === 'GARDEN_SITE' ? 'Garden Refuse Site' : s.type}</p>
                  {s.type === 'GARDEN_SITE' ? (
                    <p style={{ fontSize: '14px' }}><strong>Skip Bins:</strong> {s.currentSkipBinCount || 0}</p>
                  ) : (
                    <p style={{ fontSize: '14px' }}><strong>Weighbridge:</strong> <span style={{ textTransform: 'capitalize' }}>{s.weighbridge || 'active'}</span></p>
                  )}
                </div>
              </div>
            ))}
            {sites.length === 0 && <p style={{ color: 'var(--color-text-dim)', fontStyle: 'italic' }}>No sites registered under this depot yet.</p>}
          </div>
        </div>
      )}

      {siteId && (
        <div className="card" style={{ padding: '24px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
            <h2 style={{ fontSize: '18px', fontWeight: '600' }}>Cooperatives stationed at Site</h2>
            <button className="btn btn-outline" onClick={() => { setCoopForm({ ...coopForm, siteId }); setModal('coop'); }}>+ Add Cooperative</button>
          </div>
          <div className="table-responsive">
            <table className="tbl" style={{ width: '100%', borderCollapse: 'collapse', marginTop: '10px' }}>
              <thead>
                <tr style={{ background: 'var(--color-w2w-dark)', color: 'white' }}>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Name</th>
                  <th style={{ padding: '12px', textAlign: 'left' }}>Reg No</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Members</th>
                  <th style={{ padding: '12px', textAlign: 'right' }}>Tons/Day</th>
                </tr>
              </thead>
              <tbody>
                {coops.map((c: any) => (
                  <tr key={c.id} style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <td style={{ padding: '12px', fontWeight: '500' }}>{c.name}</td>
                    <td style={{ padding: '12px', color: 'var(--color-text-dim)' }}>{c.registrationNumber || 'N/A'}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{c.totalMembers}</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>{c.dailyTonsRecovered} t</td>
                    <td style={{ padding: '12px', textAlign: 'right' }}>
                      <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                        <button className="btn btn-outline" style={{ padding: '2px 6px', fontSize: '11px' }} onClick={() => {
                          setEditingCoopId(c.id);
                          setCoopForm({
                            name: c.name, registrationNumber: c.registrationNumber,
                            totalMembers: c.totalMembers, dailyTonsRecovered: c.dailyTonsRecovered,
                            siteId: c.siteId, contactPerson: c.contactPerson, contactNumber: c.contactNumber,
                            hasBalingMachine: c.hasBalingMachine, petRate: c.materialPayoutRates?.pet_plastic_zar_per_kg || 0,
                            cardboardRate: c.materialPayoutRates?.cardboard_zar_per_kg || 0,
                            aluminumRate: c.materialPayoutRates?.aluminum_cans_zar_per_kg || 0
                          });
                          setModal('coop');
                        }}>Edit</button>
                        <button className="btn btn-outline" style={{ padding: '2px 6px', fontSize: '11px', color: 'red', borderColor: 'red' }} onClick={() => {
                          if (confirm('Delete this cooperative?')) deleteCoop.mutate(c.id);
                        }}>Delete</button>
                      </div>
                    </td>
                  </tr>
                ))}
                {coops.length === 0 && (
                  <tr><td colSpan={5} style={{ textAlign: 'center', padding: '30px', color: 'var(--color-text-dim)', fontStyle: 'italic' }}>No cooperatives are registered at this site yet.</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {modal === 'depot' && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Add New Depot</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb" style={{ padding: '20px' }}>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="fg"><label>Name</label><input className="fc" value={depotForm.name} onChange={e => setDepotForm({...depotForm, name: e.target.value})} placeholder="e.g. Zondi Depot" /></div>
                <div className="fg"><label>Region</label>
                  <select className="fc" value={depotForm.regionCode} onChange={e => setDepotForm({...depotForm, regionCode: e.target.value})}>
                    {REGIONS.map(r => <option key={r} value={r}>Region {r}</option>)}
                  </select>
                </div>
                <div className="fg"><label>Physical Address</label><input className="fc" value={depotForm.physicalAddress} onChange={e => setDepotForm({...depotForm, physicalAddress: e.target.value})} placeholder="123 Main St" /></div>
                <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="fg"><label>Compactor Trucks</label><input type="number" className="fc" value={depotForm.totalCompactorTrucks} onChange={e => setDepotForm({...depotForm, totalCompactorTrucks: parseInt(e.target.value) || 0})} /></div>
                  <div className="fg"><label>Skip Loader Trucks</label><input type="number" className="fc" value={depotForm.totalSkipLoaderTrucks} onChange={e => setDepotForm({...depotForm, totalSkipLoaderTrucks: parseInt(e.target.value) || 0})} /></div>
                </div>
                <div className="fg"><label>Operational Status</label>
                  <select className="fc" value={depotForm.operationalStatus} onChange={e => setDepotForm({...depotForm, operationalStatus: e.target.value})}>
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createDepot.mutate(depotForm)}>Save Depot</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'site' && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Add New Site</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb" style={{ padding: '20px' }}>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="fg"><label>Name</label><input className="fc" value={siteForm.name} onChange={e => setSiteForm({...siteForm, name: e.target.value})} placeholder="e.g. Randburg Garden Site" /></div>
                <div className="fg"><label>Type</label>
                  <select className="fc" value={siteForm.type} onChange={e => setSiteForm({...siteForm, type: e.target.value})}>
                    <option value="GARDEN_SITE">Garden Refuse Site</option>
                    <option value="LANDFILL">Landfill</option>
                    <option value="BUYBACK_CENTRE">Buyback Centre</option>
                    <option value="IWMC">IWMC (Integrated Waste Management Centre)</option>
                    <option value="MRC">MRC (Material Recovery Centre)</option>
                    <option value="BBC">BBC</option>
                    <option value="COOPERATIVE">Cooperative (Standalone)</option>
                    <option value="DEPOT">Depot (Site)</option>
                  </select>
                </div>
                
                {siteForm.type === 'GARDEN_SITE' && (
                  <>
                    <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="fg"><label>Skip Bin Count</label><input type="number" className="fc" value={siteForm.currentSkipBinCount} onChange={e => setSiteForm({...siteForm, currentSkipBinCount: parseInt(e.target.value) || 0})} /></div>
                      <div className="fg"><label>Max Tonnage</label><input type="number" step="0.1" className="fc" value={siteForm.maxVehicleTonnage} onChange={e => setSiteForm({...siteForm, maxVehicleTonnage: parseFloat(e.target.value) || 0})} /></div>
                    </div>
                    <div className="fg"><label>Public Access Gate Hours</label><input className="fc" placeholder="e.g. Sat-Sun 08:00 - 16:00" value={siteForm.metadata.publicAccessGateHours} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, publicAccessGateHours: e.target.value}})} /></div>
                    <div className="fg"><label>Accepted Materials</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                        {wasteTypes.map((mat: any) => (
                          <label key={mat.id} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                            <input 
                              type="checkbox" 
                              checked={siteForm.acceptedMaterials.includes(mat.id)}
                              onChange={(e) => {
                                const newMats = e.target.checked 
                                  ? [...siteForm.acceptedMaterials, mat.id] 
                                  : siteForm.acceptedMaterials.filter(m => m !== mat.id);
                                setSiteForm({...siteForm, acceptedMaterials: newMats});
                              }}
                            />
                            {mat.category || mat.name || 'Unknown Material'}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {siteForm.type === 'LANDFILL' && (
                  <>
                    <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="fg"><label>Weighbridge Status</label>
                        <select className="fc" value={siteForm.weighbridge || 'Operational'} onChange={e => setSiteForm({...siteForm, weighbridge: e.target.value})}>
                          <option value="Operational">Operational</option>
                          <option value="Faulty">Faulty</option>
                          <option value="No Scale">No Scale</option>
                        </select>
                      </div>
                      <div className="fg"><label>Gate Fee Per Ton (R)</label><input type="number" className="fc" value={siteForm.gateFee || 0} onChange={e => setSiteForm({...siteForm, gateFee: parseFloat(e.target.value) || 0})} /></div>
                    </div>
                    <div className="fg"><label>Remaining Airspace Volume (m³)</label><input type="number" className="fc" value={siteForm.metadata.remainingAirspaceVolume} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, remainingAirspaceVolume: parseFloat(e.target.value) || 0}})} /></div>
                  </>
                )}

                {siteForm.type === 'BUYBACK_CENTRE' && (
                  <>
                    <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="fg"><label>Cash Float Balance (R)</label><input type="number" className="fc" value={siteForm.metadata.cashFloatBalance} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, cashFloatBalance: parseFloat(e.target.value) || 0}})} /></div>
                      <div className="fg"><label>Commercial Off-taker</label><input className="fc" placeholder="e.g. Consol Glass" value={siteForm.metadata.commercialOffTakerId} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, commercialOffTakerId: e.target.value}})} /></div>
                    </div>
                  </>
                )}

                {(siteForm.type === 'IWMC' || siteForm.type === 'MRC') && (
                  <>
                    <div className="fg"><label>Sorting Line Throughput Capacity (TPH)</label><input type="number" className="fc" value={siteForm.metadata.sortingLineThroughputCapacity} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, sortingLineThroughputCapacity: parseFloat(e.target.value) || 0}})} /></div>
                    <div className="fg"><label>Mechanical Asset Registry</label>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px', marginTop: '5px' }}>
                        {['Conveyor Belt Sorting Lines', 'Hydraulic Balers', 'Glass Crushers', 'Plastic Shredders'].map(asset => (
                          <label key={asset} style={{ display: 'flex', alignItems: 'center', gap: '5px', fontSize: '13px' }}>
                            <input 
                              type="checkbox" 
                              checked={siteForm.metadata.mechanicalAssetRegistry.includes(asset)}
                              onChange={(e) => {
                                const newAssets = e.target.checked 
                                  ? [...siteForm.metadata.mechanicalAssetRegistry, asset] 
                                  : siteForm.metadata.mechanicalAssetRegistry.filter((a: string) => a !== asset);
                                setSiteForm({...siteForm, metadata: {...siteForm.metadata, mechanicalAssetRegistry: newAssets}});
                              }}
                            />
                            {asset}
                          </label>
                        ))}
                      </div>
                    </div>
                  </>
                )}

                {siteForm.type === 'COOPERATIVE' && (
                  <>
                    <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="fg"><label>Land Lease Agreement Expiry</label><input type="date" className="fc" value={siteForm.metadata.landLeaseExpiry} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, landLeaseExpiry: e.target.value}})} /></div>
                      <div className="fg"><label>NPO / CIPC Document URL</label><input className="fc" placeholder="e.g. https://docs.google.com/..." value={siteForm.metadata.npoDocumentUrl} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, npoDocumentUrl: e.target.value}})} /></div>
                    </div>
                  </>
                )}

                {siteForm.type === 'DEPOT' && (
                  <>
                    <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                      <div className="fg"><label>Fleet Parking Capacity</label><input type="number" className="fc" value={siteForm.metadata.fleetParkingCapacity} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, fleetParkingCapacity: parseInt(e.target.value) || 0}})} /></div>
                      <div className="fg"><label>Fuel Station Depot Reserve (Liters)</label><input type="number" className="fc" value={siteForm.metadata.fuelStationDepotReserve} onChange={e => setSiteForm({...siteForm, metadata: {...siteForm.metadata, fuelStationDepotReserve: parseFloat(e.target.value) || 0}})} /></div>
                    </div>
                  </>
                )}
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={() => createSite.mutate({ ...siteForm, depotId: siteForm.depotId })}>Save Site</button>
            </div>
          </div>
        </div>
      )}

      {modal === 'coop' && (
        <div className="modal-ov open" onClick={() => setModal(null)}>
          <div className="modal" style={{ width: 500 }} onClick={(e) => e.stopPropagation()}>
            <div className="mh">
              <span className="mt">Register Cooperative</span>
              <button onClick={() => setModal(null)} className="mc"><X size={15} /></button>
            </div>
            <div className="mb" style={{ padding: '20px' }}>
              <div className="fgrid" style={{ gridTemplateColumns: '1fr' }}>
                <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="fg"><label>Name</label><input className="fc" value={coopForm.name} onChange={e => setCoopForm({...coopForm, name: e.target.value})} placeholder="e.g. Siyakha Co-op" /></div>
                  <div className="fg"><label>Registration No</label><input className="fc" value={coopForm.registrationNumber} onChange={e => setCoopForm({...coopForm, registrationNumber: e.target.value})} placeholder="e.g. 2021/12345/08" /></div>
                </div>
                <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr', gap: '15px' }}>
                  <div className="fg"><label>Contact Person</label><input className="fc" value={coopForm.contactPerson} onChange={e => setCoopForm({...coopForm, contactPerson: e.target.value})} placeholder="e.g. Thabo Mokoena" /></div>
                  <div className="fg"><label>Contact Phone</label><input className="fc" value={coopForm.contactNumber} onChange={e => setCoopForm({...coopForm, contactNumber: e.target.value})} placeholder="e.g. +27821234567" /></div>
                </div>
                <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '15px' }}>
                  <div className="fg"><label>Members</label><input type="number" className="fc" value={coopForm.totalMembers} onChange={e => setCoopForm({...coopForm, totalMembers: parseInt(e.target.value) || 0})} /></div>
                  <div className="fg"><label>Daily Tons</label><input type="number" className="fc" value={coopForm.dailyTonsRecovered} onChange={e => setCoopForm({...coopForm, dailyTonsRecovered: parseFloat(e.target.value) || 0})} /></div>
                  <div className="fg" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                    <label style={{ display: 'flex', alignItems: 'center', gap: '8px', cursor: 'pointer', marginTop: '15px' }}>
                      <input type="checkbox" checked={coopForm.hasBalingMachine} onChange={e => setCoopForm({...coopForm, hasBalingMachine: e.target.checked})} />
                      Has Baling Machine
                    </label>
                  </div>
                </div>
                <div className="fg" style={{ marginTop: '10px' }}><label>Payout Rates (ZAR/kg)</label>
                  <div className="fgrid" style={{ gridTemplateColumns: '1fr 1fr 1fr', gap: '10px', marginTop: '5px' }}>
                    <div className="fg"><span style={{fontSize: '11px', color: 'var(--color-text3)'}}>PET Plastic</span><input type="number" step="0.1" className="fc" value={coopForm.petRate} onChange={e => setCoopForm({...coopForm, petRate: parseFloat(e.target.value) || 0})} /></div>
                    <div className="fg"><span style={{fontSize: '11px', color: 'var(--color-text3)'}}>Cardboard</span><input type="number" step="0.1" className="fc" value={coopForm.cardboardRate} onChange={e => setCoopForm({...coopForm, cardboardRate: parseFloat(e.target.value) || 0})} /></div>
                    <div className="fg"><span style={{fontSize: '11px', color: 'var(--color-text3)'}}>Aluminum</span><input type="number" step="0.1" className="fc" value={coopForm.aluminumRate} onChange={e => setCoopForm({...coopForm, aluminumRate: parseFloat(e.target.value) || 0})} /></div>
                  </div>
                </div>
              </div>
            </div>
            <div className="mf">
              <button className="btn btn-ghost" onClick={() => setModal(null)}>Cancel</button>
              <button className="btn btn-primary" onClick={submitCoop}>Save Cooperative</button>
            </div>
          </div>
        </div>
      )}

    </div>
  );
}
