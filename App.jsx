import { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import './storage.js'; // Initializes window.storage with IndexedDB

// ─── Config ─────────────────────────────────────────────────────────
const B = { orange: '#E8A020', dark: '#1A1A1A', navy: '#1A5276' };
const CATS = [
  'Fuel & transport', 'Equipment', 'Office supplies',
  'Meals & entertainment', 'Services', 'Rent & utilities',
  'Professional fees', 'Travel', 'Insurance', 'Other',
];
const DED_CATS = ['Fuel & transport','Equipment','Office supplies','Services','Professional fees','Rent & utilities','Insurance'];
const SK = { c: 'ac-clients', r: 'ac-receipts' };

// ─── Helpers ────────────────────────────────────────────────────────
const gid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const fmt = (n) => 'TZS ' + Number(n || 0).toLocaleString();
const fmtD = (d) => {
  if (!d) return '';
  return new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' });
};

// ─── Persisted State Hook (IndexedDB) ───────────────────────────────
function usePS(key, init) {
  const [v, sV] = useState(init);
  useEffect(() => {
    (async () => {
      try {
        const r = await window.storage.get(key);
        if (r?.value) sV(JSON.parse(r.value));
      } catch { /* first run, use defaults */ }
    })();
  }, [key]);
  const set = useCallback(
    (u) => {
      sV((p) => {
        const n = typeof u === 'function' ? u(p) : u;
        window.storage.set(key, JSON.stringify(n)).catch(() => {});
        return n;
      });
    },
    [key]
  );
  return [v, set];
}

// ─── Seed Data ──────────────────────────────────────────────────────
const SEED = [
  { id: gid(), name: 'GDM Company Limited', tin: '177-284-548', industry: 'Mining & drilling', color: '#185FA5' },
  { id: gid(), name: 'TLV Limited', tin: '200-441-992', industry: 'Logistics', color: '#0F6E56' },
  { id: gid(), name: 'China Village 999 Ltd', tin: '188-302-117', industry: 'Hospitality', color: '#D85A30' },
  { id: gid(), name: 'VST Company Limited', tin: '210-556-443', industry: 'Construction', color: '#534AB7' },
];

// ─── OCR via Anthropic API ──────────────────────────────────────────
// IMPORTANT: In production, route this through YOUR backend to protect API key
// Never expose the Anthropic API key in client-side code
const API_URL = import.meta.env.VITE_API_URL || '/api/ocr';

async function ocrReceipt(base64, mediaType) {
  try {
    const res = await fetch(API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ image: base64, mediaType }),
    });
    if (!res.ok) throw new Error(`OCR API returned ${res.status}`);
    return await res.json();
  } catch (e) {
    console.error('OCR error:', e);
    return null;
  }
}

// ─── Excel Export ───────────────────────────────────────────────────
function exportXLSX(client, receipts) {
  const wb = XLSX.utils.book_new();

  // Sheet 1: All receipts
  const det = receipts.map((r) => ({
    Date: fmtD(r.date),
    Vendor: r.vendor || '',
    Category: r.category || '',
    'EFD No.': r.efdNo || '',
    'Amount (TZS)': Number(r.amount) || 0,
    'VAT (TZS)': Number(r.vatAmount) || 0,
    Status: r.status || 'pending',
    Notes: r.description || '',
  }));
  const ws1 = XLSX.utils.json_to_sheet(det);
  ws1['!cols'] = [
    { wch: 12 }, { wch: 25 }, { wch: 18 }, { wch: 12 },
    { wch: 15 }, { wch: 15 }, { wch: 10 }, { wch: 25 },
  ];
  XLSX.utils.book_append_sheet(wb, ws1, 'Receipts');

  // Sheet 2: Summary by category
  const bc = {};
  receipts.forEach((r) => {
    const c = r.category || 'Other';
    if (!bc[c]) bc[c] = { a: 0, v: 0, n: 0 };
    bc[c].a += Number(r.amount) || 0;
    bc[c].v += Number(r.vatAmount) || 0;
    bc[c].n++;
  });
  const sum = Object.entries(bc)
    .sort((a, b) => b[1].a - a[1].a)
    .map(([c, v]) => ({
      Category: c,
      Count: v.n,
      'Total (TZS)': v.a,
      'VAT (TZS)': v.v,
      Deductible: DED_CATS.includes(c) ? 'Yes' : 'Partial',
    }));
  sum.push({
    Category: 'TOTAL',
    Count: receipts.length,
    'Total (TZS)': receipts.reduce((s, r) => s + (Number(r.amount) || 0), 0),
    'VAT (TZS)': receipts.reduce((s, r) => s + (Number(r.vatAmount) || 0), 0),
    Deductible: '',
  });
  const ws2 = XLSX.utils.json_to_sheet(sum);
  ws2['!cols'] = [{ wch: 22 }, { wch: 8 }, { wch: 15 }, { wch: 15 }, { wch: 12 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Summary');

  const fname = `${client.name.replace(/[^a-zA-Z0-9]/g, '_')}_${new Date().toISOString().slice(0, 10)}.xlsx`;
  XLSX.writeFile(wb, fname);
}

// ─── SVG Icon Component ─────────────────────────────────────────────
const Ic = ({ n, s = 20, c = 'currentColor' }) => {
  const d = {
    home: <><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" /><polyline points="9 22 9 12 15 12 15 22" /></>,
    folder: <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z" />,
    camera: <><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z" /><circle cx="12" cy="13" r="4" /></>,
    chart: <><line x1="18" y1="20" x2="18" y2="10" /><line x1="12" y1="20" x2="12" y2="4" /><line x1="6" y1="20" x2="6" y2="14" /></>,
    plus: <><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></>,
    check: <polyline points="20 6 9 17 4 12" />,
    x: <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></>,
    dl: <><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" /><polyline points="7 10 12 15 17 10" /><line x1="12" y1="15" x2="12" y2="3" /></>,
    back: <polyline points="15 18 9 12 15 6" />,
    search: <><circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" /></>,
    zap: <polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />,
    trash: <><polyline points="3 6 5 6 21 6" /><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2" /></>,
  };
  return (
    <svg width={s} height={s} viewBox="0 0 24 24" fill="none" stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">{d[n]}</svg>
  );
};

// ─── CSS ────────────────────────────────────────────────────────────
const CSS = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; -webkit-tap-highlight-color: transparent; }
  html { font-family: 'DM Sans', system-ui, sans-serif; -webkit-font-smoothing: antialiased; }
  body { background: #FEFCF9; color: #1A1A1A; }
  input, select, textarea { font-family: inherit; font-size: 15px; -webkit-appearance: none; appearance: none; }

  @keyframes fadeUp { from { opacity: 0; transform: translateY(10px) } to { opacity: 1; transform: translateY(0) } }
  @keyframes slideIn { from { opacity: 0; transform: translateX(16px) } to { opacity: 1; transform: translateX(0) } }
  @keyframes pop { 0% { transform: scale(.95); opacity: 0 } 100% { transform: scale(1); opacity: 1 } }
  @keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: .5 } }
  .fu { animation: fadeUp .35s ease both }
  .si { animation: slideIn .3s ease both }
  .pls { animation: pulse 1.5s ease infinite }

  .ip { width: 100%; padding: 12px 14px; border: 1.5px solid #E8E4DD; border-radius: 12px; font-size: 15px; outline: none; background: #fff; transition: border .15s; color: #1A1A1A; }
  .ip:focus { border-color: ${B.orange}; }
  .ip::placeholder { color: #C0BAB0; }
  .sl2 { padding: 12px 14px; border: 1.5px solid #E8E4DD; border-radius: 12px; font-size: 15px; background: #fff; color: #1A1A1A; outline: none; width: 100%; }

  .bt { display: inline-flex; align-items: center; justify-content: center; gap: 6px; padding: 12px 20px; border-radius: 12px; font-size: 14px; font-weight: 600; cursor: pointer; border: none; transition: all .15s; font-family: inherit; }
  .bt:active { transform: scale(.96); }
  .bp2 { background: ${B.orange}; color: #1A1A1A; }
  .bp2:hover { background: #D49012; }
  .bo2 { background: #fff; border: 1.5px solid #E8E4DD; color: #777; }
  .bo2:hover { background: #F8F5F0; }
  .bdn { background: #FEF2F2; color: #B91C1C; border: 1.5px solid #FECACA; }
  .bsm { padding: 8px 14px; font-size: 13px; border-radius: 10px; }

  .cd { background: #fff; border: 1.5px solid #EDE9E3; border-radius: 16px; overflow: hidden; transition: border .15s; }
  .cd:hover { border-color: #D8D3CB; }
  .bg { display: inline-block; padding: 4px 10px; border-radius: 20px; font-size: 11px; font-weight: 600; letter-spacing: .3px; }
  .bgp { background: #FEF3C7; color: #92400E; }
  .bgv { background: #D1FAE5; color: #065F46; }
  .lb { display: block; font-size: 11px; font-weight: 600; color: #A09A90; text-transform: uppercase; letter-spacing: .8px; margin-bottom: 6px; }

  .st { background: #F8F5F0; border-radius: 14px; padding: 16px; }
  .stv { font-size: 24px; font-weight: 700; margin-top: 3px; letter-spacing: -.5px; }
  .stl { font-size: 11px; color: #A09A90; font-weight: 600; text-transform: uppercase; letter-spacing: .5px; }

  .tst { position: fixed; top: 20px; left: 50%; transform: translateX(-50%); background: #1A1A1A; color: #fff; padding: 12px 24px; border-radius: 14px; font-size: 14px; font-weight: 600; z-index: 1000; animation: pop .25s ease; box-shadow: 0 8px 32px rgba(0,0,0,.2); max-width: 90%; text-align: center; }
  .ov { position: fixed; inset: 0; background: rgba(0,0,0,.4); z-index: 900; display: flex; align-items: flex-end; justify-content: center; animation: fadeUp .15s ease; -webkit-backdrop-filter: blur(4px); backdrop-filter: blur(4px); }
  .md { background: #fff; border-radius: 20px 20px 0 0; padding: 24px 20px 36px; width: 100%; max-width: 480px; animation: fadeUp .3s ease; }

  .tb { position: fixed; bottom: 0; left: 50%; transform: translateX(-50%); width: 100%; max-width: 480px; background: rgba(254,252,249,.94); -webkit-backdrop-filter: blur(16px); backdrop-filter: blur(16px); border-top: 1px solid #EDE9E3; display: flex; justify-content: space-around; align-items: flex-end; padding: 6px 0 max(env(safe-area-inset-bottom, 8px), 8px); z-index: 800; }
  .ti { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 4px 10px; cursor: pointer; border: none; background: none; font-size: 10px; font-weight: 600; color: #B5B0A5; transition: color .15s; }
  .ti.ac { color: ${B.orange}; }
  .ti.ac svg { stroke: ${B.orange}; }

  .rw { display: flex; align-items: center; justify-content: space-between; padding: 14px 16px; border-bottom: 1px solid #F3F0EA; transition: background .1s; cursor: pointer; }
  .rw:active { background: #F8F5F0; }
  .rw:last-child { border-bottom: none; }
  .ini { display: flex; align-items: center; justify-content: center; border-radius: 12px; font-weight: 700; font-size: 13px; color: #fff; flex-shrink: 0; }

  @media (max-width: 390px) { .stv { font-size: 20px; } .st { padding: 12px; } }
`;

// ═══════════════════════════════════════════════════════════════════
// APP
// ═══════════════════════════════════════════════════════════════════
export default function App() {
  const [clients, setClients] = usePS(SK.c, SEED);
  const [receipts, setReceipts] = usePS(SK.r, []);
  const [view, setView] = useState('dashboard');
  const [sel, setSel] = useState(null);
  const [editR, setEditR] = useState(null);
  const [showNC, setShowNC] = useState(false);
  const [srch, setSrch] = useState('');
  const [fC, setFC] = useState('All');
  const [toast, setToast] = useState(null);
  const [cfm, setCfm] = useState(null);

  const nfy = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };

  const addR = (r) => { setReceipts((p) => [{ ...r, id: gid(), createdAt: new Date().toISOString() }, ...p]); nfy('Receipt saved'); };
  const updR = (r) => { setReceipts((p) => p.map((x) => (x.id === r.id ? r : x))); nfy('Updated'); };
  const delR = (id) => { setReceipts((p) => p.filter((x) => x.id !== id)); nfy('Deleted'); setCfm(null); };
  const addC = (c) => { setClients((p) => [...p, { ...c, id: gid() }]); nfy('Client added'); setShowNC(false); };
  const delC = (id) => {
    setClients((p) => p.filter((x) => x.id !== id));
    setReceipts((p) => p.filter((x) => x.clientId !== id));
    nfy('Removed'); setCfm(null);
    if (sel?.id === id) { setSel(null); setView('dashboard'); }
  };

  const cR = (cid) => receipts.filter((r) => r.clientId === cid);
  const cS = (cid) => {
    const rs = cR(cid);
    return { count: rs.length, total: rs.reduce((s, r) => s + (Number(r.amount) || 0), 0), pending: rs.filter((r) => r.status === 'pending').length };
  };
  const gS = {
    total: receipts.length,
    pending: receipts.filter((r) => r.status === 'pending').length,
    month: receipts.filter((r) => { const d = new Date(r.date), n = new Date(); return d.getMonth() === n.getMonth() && d.getFullYear() === n.getFullYear(); }).reduce((s, r) => s + (Number(r.amount) || 0), 0),
  };

  const go = (v, c) => { if (c) setSel(c); setView(v); if (v === 'dashboard') { setSrch(''); setFC('All'); } };

  const fR = sel
    ? cR(sel.id).filter((r) => fC === 'All' || r.category === fC).filter((r) => !srch || r.vendor?.toLowerCase().includes(srch.toLowerCase()) || r.efdNo?.includes(srch))
    : [];

  const rD = sel ? (() => {
    const rs = cR(sel.id), bc = {};
    rs.forEach((r) => { const c = r.category || 'Other'; if (!bc[c]) bc[c] = { a: 0, v: 0, n: 0 }; bc[c].a += Number(r.amount) || 0; bc[c].v += Number(r.vatAmount) || 0; bc[c].n++; });
    return { bc, tA: Object.values(bc).reduce((s, c) => s + c.a, 0), tV: Object.values(bc).reduce((s, c) => s + c.v, 0) };
  })() : null;

  return (
    <>
      <style>{CSS}</style>
      <div style={{ maxWidth: 480, margin: '0 auto', padding: '0 0 96px', position: 'relative', minHeight: '100vh' }}>
        {toast && <div className="tst">{toast}</div>}

        {cfm && (
          <div className="ov" onClick={() => setCfm(null)}>
            <div className="md" onClick={(e) => e.stopPropagation()}>
              <p style={{ fontWeight: 700, fontSize: 17, marginBottom: 8 }}>Confirm delete</p>
              <p style={{ fontSize: 14, color: '#777', marginBottom: 24 }}>{cfm.msg}</p>
              <div style={{ display: 'flex', gap: 10 }}>
                <button className="bt bo2" style={{ flex: 1 }} onClick={() => setCfm(null)}>Cancel</button>
                <button className="bt bdn" style={{ flex: 1 }} onClick={cfm.action}>Delete</button>
              </div>
            </div>
          </div>
        )}

        {showNC && <NewClientModal onAdd={addC} onClose={() => setShowNC(false)} />}

        <div style={{ padding: '0 16px' }}>
          {view === 'dashboard' && <DashV clients={clients} gS={gS} cS={cS} onOpen={(c) => go('client', c)} onDel={(c) => setCfm({ msg: `Remove "${c.name}" and all receipts?`, action: () => delC(c.id) })} onNew={() => setShowNC(true)} />}
          {view === 'client' && sel && <ClientV client={sel} recs={fR} stats={cS(sel.id)} srch={srch} setSrch={setSrch} fC={fC} setFC={setFC} onBack={() => go('dashboard')} onScan={() => go('scan')} onEdit={(r) => { setEditR(r); setView('scan'); }} onDel={(r) => setCfm({ msg: `Delete receipt from ${r.vendor}?`, action: () => delR(r.id) })} onTog={(r) => updR({ ...r, status: r.status === 'verified' ? 'pending' : 'verified' })} />}
          {view === 'scan' && <ScanV clients={clients} sel={sel} editing={editR} onSave={(r) => { if (editR) updR(r); else addR(r); setView('client'); setEditR(null); }} onBack={() => { setView(sel ? 'client' : 'dashboard'); setEditR(null); }} />}
          {view === 'report' && sel && rD && <ReportV client={sel} data={rD} recs={cR(sel.id)} onBack={() => setView('client')} />}
        </div>

        {/* Tab Bar */}
        <div className="tb">
          <button className={`ti ${view === 'dashboard' ? 'ac' : ''}`} onClick={() => go('dashboard')}><Ic n="home" s={22} /><span>Home</span></button>
          <button className={`ti ${view === 'client' ? 'ac' : ''}`} onClick={() => { if (sel) setView('client'); }}><Ic n="folder" s={22} /><span>Folder</span></button>
          <button className="ti" onClick={() => go('scan')} style={{ position: 'relative', top: -14 }}>
            <div style={{ width: 54, height: 54, borderRadius: 16, background: B.orange, display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(232,160,32,.4)' }}><Ic n="camera" s={25} c="#1A1A1A" /></div>
          </button>
          <button className={`ti ${view === 'report' ? 'ac' : ''}`} onClick={() => { if (sel) setView('report'); }}><Ic n="chart" s={22} /><span>Report</span></button>
          <button className="ti" onClick={() => { if (sel && receipts.filter((r) => r.clientId === sel.id).length > 0) exportXLSX(sel, receipts.filter((r) => r.clientId === sel.id)); else nfy('Select a client with receipts'); }}><Ic n="dl" s={22} /><span>Export</span></button>
        </div>
      </div>
    </>
  );
}

// ═══════════════════════════════════════════════════════════════════
// DASHBOARD
// ═══════════════════════════════════════════════════════════════════
function DashV({ clients, gS, cS, onOpen, onDel, onNew }) {
  return (
    <div className="fu">
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '20px 0 16px' }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 2 }}>
            <span style={{ fontWeight: 700, fontSize: 21, color: B.dark }}>Afri</span>
            <span style={{ fontWeight: 700, fontSize: 21, color: B.orange }}>Consult</span>
          </div>
          <p style={{ fontSize: 12, color: '#A09A90', fontWeight: 500, marginTop: 1 }}>Receipt manager</p>
        </div>
        <button className="bt bp2 bsm" onClick={onNew}><Ic n="plus" s={15} />Client</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 22 }}>
        <div className="st"><div className="stl">Receipts</div><div className="stv">{gS.total.toLocaleString()}</div></div>
        <div className="st"><div className="stl">Pending</div><div className="stv" style={{ color: B.orange }}>{gS.pending}</div></div>
        <div className="st"><div className="stl">This month</div><div className="stv" style={{ fontSize: 14 }}>{fmt(gS.month)}</div></div>
      </div>
      <div className="lb" style={{ marginBottom: 10 }}>Clients ({clients.length})</div>
      <div className="cd">
        {clients.length === 0 && <p style={{ padding: 32, textAlign: 'center', color: '#A09A90', fontSize: 14 }}>No clients yet</p>}
        {[...clients].sort((a, b) => a.name.localeCompare(b.name)).map((c, i) => {
          const st = cS(c.id);
          return (
            <div key={c.id} className="rw si" style={{ animationDelay: `${i * 40}ms` }} onClick={() => onOpen(c)}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 12, flex: 1, minWidth: 0 }}>
                <div className="ini" style={{ width: 40, height: 40, background: c.color || B.navy }}>{c.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
                <div style={{ minWidth: 0 }}>
                  <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{c.name}</p>
                  <p style={{ fontSize: 11, color: '#A09A90' }}>{c.tin ? `TIN ${c.tin}` : c.industry || ''}{st.count > 0 ? ` · ${st.count} receipts` : ''}</p>
                </div>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
                {st.pending > 0 ? <span className="bg bgp">{st.pending}</span> : st.count > 0 ? <span className="bg bgv">OK</span> : null}
                <button className="bt bo2" style={{ padding: 5, borderRadius: 8 }} onClick={(e) => { e.stopPropagation(); onDel(c); }}><Ic n="trash" s={14} c="#B91C1C" /></button>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// CLIENT VIEW
// ═══════════════════════════════════════════════════════════════════
function ClientV({ client, recs, stats, srch, setSrch, fC, setFC, onBack, onScan, onEdit, onDel, onTog }) {
  return (
    <div className="fu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 0 14px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Ic n="back" s={22} c="#A09A90" /></button>
        <div className="ini" style={{ width: 38, height: 38, background: client.color || B.navy }}>{client.name.split(' ').map((w) => w[0]).join('').slice(0, 2)}</div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <p style={{ fontWeight: 700, fontSize: 16, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{client.name}</p>
          <p style={{ fontSize: 11, color: '#A09A90' }}>{client.tin ? `TIN ${client.tin}` : ''}{client.industry ? ` · ${client.industry}` : ''}</p>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 14 }}>
        <div className="st"><div className="stl">Receipts</div><div className="stv">{stats.count}</div></div>
        <div className="st"><div className="stl">Pending</div><div className="stv" style={{ color: B.orange }}>{stats.pending}</div></div>
        <div className="st"><div className="stl">Total</div><div className="stv" style={{ fontSize: 13 }}>{fmt(stats.total)}</div></div>
      </div>
      <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
        <div style={{ flex: 1, position: 'relative' }}>
          <input className="ip" placeholder="Search..." value={srch} onChange={(e) => setSrch(e.target.value)} style={{ paddingLeft: 38 }} />
          <div style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }}><Ic n="search" s={16} c="#C0BAB0" /></div>
        </div>
        <select className="sl2" style={{ width: 'auto', minWidth: 90 }} value={fC} onChange={(e) => setFC(e.target.value)}>
          <option>All</option>
          {CATS.map((c) => <option key={c}>{c}</option>)}
        </select>
      </div>
      <div className="cd">
        {recs.length === 0 && <p style={{ padding: 32, textAlign: 'center', color: '#A09A90', fontSize: 14 }}>No receipts. Tap the camera to scan.</p>}
        {recs.map((r, i) => (
          <div key={r.id} className="rw si" style={{ animationDelay: `${i * 25}ms` }} onClick={() => onEdit(r)}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontWeight: 600, fontSize: 14, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.vendor || 'Unknown'}</p>
              <p style={{ fontSize: 11, color: '#A09A90' }}>{fmtD(r.date)}{r.category ? ` · ${r.category}` : ''}{r.efdNo ? ` · #${r.efdNo}` : ''}</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexShrink: 0 }}>
              <div style={{ textAlign: 'right' }}>
                <p style={{ fontWeight: 700, fontSize: 14 }}>{fmt(r.amount)}</p>
                <span className={`bg ${r.status === 'verified' ? 'bgv' : 'bgp'}`} onClick={(e) => { e.stopPropagation(); onTog(r); }} style={{ cursor: 'pointer' }}>{r.status === 'verified' ? 'Verified' : 'Pending'}</span>
              </div>
              <button className="bt bo2" style={{ padding: 5, borderRadius: 8 }} onClick={(e) => { e.stopPropagation(); onDel(r); }}><Ic n="trash" s={14} c="#B91C1C" /></button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// SCAN VIEW
// ═══════════════════════════════════════════════════════════════════
function ScanV({ clients, sel, editing, onSave, onBack }) {
  const [form, sF] = useState(editing || {
    vendor: '', amount: '', date: new Date().toISOString().split('T')[0],
    category: CATS[0], efdNo: '', vatAmount: '', description: '',
    status: 'pending', clientId: sel?.id || '',
  });
  const [ocrSt, setOcrSt] = useState('idle');
  const [ocrProg, setOcrProg] = useState(0);
  const [prev, setPrev] = useState(null);
  const fRef = useRef(null);
  const u = (k, v) => sF((f) => ({ ...f, [k]: v }));

  const handleFile = async (file) => {
    if (!file) return;
    if (!file.type.startsWith('image/')) { alert('Please use an image file'); return; }
    const reader = new FileReader();
    reader.onload = async (e) => {
      const url = e.target.result;
      setPrev(url);
      const b64 = url.split(',')[1];
      const mt = file.type || 'image/jpeg';
      setOcrSt('scanning'); setOcrProg(15);
      const t1 = setTimeout(() => setOcrProg(40), 500);
      const t2 = setTimeout(() => setOcrProg(65), 1200);
      const t3 = setTimeout(() => setOcrProg(80), 2000);
      const res = await ocrReceipt(b64, mt);
      clearTimeout(t1); clearTimeout(t2); clearTimeout(t3);
      setOcrProg(100);
      if (res) {
        setOcrSt('done');
        sF((f) => ({
          ...f,
          vendor: res.vendor || f.vendor,
          amount: res.amount ? String(res.amount) : f.amount,
          date: res.date || f.date,
          vatAmount: res.vat_amount ? String(res.vat_amount) : f.vatAmount,
          efdNo: res.efd_no || f.efdNo,
          category: CATS.includes(res.category) ? res.category : f.category,
          description: res.description || f.description,
        }));
      } else {
        setOcrSt('error');
      }
      setTimeout(() => setOcrProg(0), 800);
    };
    reader.readAsDataURL(file);
  };

  const save = () => {
    if (!form.vendor || !form.amount || !form.clientId) { alert('Fill vendor, amount, and client.'); return; }
    const fin = { ...form };
    if (form.amount && !form.vatAmount) fin.vatAmount = String(Math.round(Number(form.amount) * 18 / 118));
    onSave(fin);
  };

  return (
    <div className="fu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 0 14px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Ic n="back" s={22} c="#A09A90" /></button>
        <p style={{ fontWeight: 700, fontSize: 18 }}>{editing ? 'Edit receipt' : 'Scan receipt'}</p>
        {ocrSt === 'done' && <span className="bg bgv" style={{ marginLeft: 'auto' }}>AI filled</span>}
      </div>

      {!editing && (
        <div>
          <div onClick={() => fRef.current?.click()} style={{ border: `2px dashed ${prev ? 'transparent' : '#D8D3CB'}`, borderRadius: 16, padding: prev ? 0 : 28, textAlign: 'center', background: prev ? 'transparent' : '#F8F5F0', cursor: 'pointer', overflow: 'hidden', position: 'relative', marginBottom: 16 }}>
            {prev ? (
              <div style={{ position: 'relative' }}>
                <img src={prev} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', display: 'block', borderRadius: 14 }} />
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'linear-gradient(transparent,rgba(0,0,0,.65))', padding: '24px 16px 14px', borderRadius: '0 0 14px 14px', display: 'flex', alignItems: 'center', gap: 8 }}>
                  <Ic n={ocrSt === 'done' ? 'check' : 'zap'} s={16} c="#fff" />
                  <span style={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>
                    {ocrSt === 'scanning' ? 'AI reading receipt...' : ocrSt === 'done' ? 'Fields auto-filled' : ocrSt === 'error' ? 'OCR failed -- fill manually' : 'Processing...'}
                  </span>
                </div>
                {ocrSt === 'scanning' && <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 4, background: 'rgba(0,0,0,.2)', borderRadius: '0 0 14px 14px', overflow: 'hidden' }}><div className="pls" style={{ width: `${ocrProg}%`, height: '100%', background: B.orange, transition: 'width .5s ease' }} /></div>}
              </div>
            ) : (
              <>
                <div style={{ width: 60, height: 60, borderRadius: 18, background: B.orange + '18', display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 12px' }}><Ic n="camera" s={28} c={B.orange} /></div>
                <p style={{ fontSize: 16, fontWeight: 600, color: '#444', marginBottom: 4 }}>Tap to scan receipt</p>
                <p style={{ fontSize: 13, color: '#A09A90' }}>Camera or photo library</p>
                <p style={{ fontSize: 12, color: '#C0BAB0', marginTop: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}><Ic n="zap" s={13} c={B.orange} />AI auto-extracts vendor, amount, date, EFD</p>
              </>
            )}
          </div>
          <input ref={fRef} type="file" accept="image/*" capture="environment" style={{ display: 'none' }} onChange={(e) => handleFile(e.target.files[0])} />
        </div>
      )}

      <div className="cd" style={{ padding: 18 }}>
        <div className="lb" style={{ marginBottom: 14 }}>Receipt details</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <div><label className="lb">Vendor</label><input className="ip" value={form.vendor} onChange={(e) => u('vendor', e.target.value)} placeholder="e.g. Puma Energy" /></div>
          <div><label className="lb">Amount (TZS)</label><input className="ip" type="number" inputMode="numeric" value={form.amount} onChange={(e) => u('amount', e.target.value)} placeholder="3420000" /></div>
          <div><label className="lb">VAT (TZS)</label><input className="ip" type="number" inputMode="numeric" value={form.vatAmount} onChange={(e) => u('vatAmount', e.target.value)} placeholder="Auto 18%" /></div>
          <div><label className="lb">Date</label><input className="ip" type="date" value={form.date} onChange={(e) => u('date', e.target.value)} /></div>
          <div><label className="lb">Category</label><select className="sl2" value={form.category} onChange={(e) => u('category', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></div>
          <div><label className="lb">EFD No.</label><input className="ip" value={form.efdNo} onChange={(e) => u('efdNo', e.target.value)} placeholder="8847201" /></div>
          <div style={{ gridColumn: '1/-1' }}><label className="lb">Client</label><select className="sl2" value={form.clientId} onChange={(e) => u('clientId', e.target.value)}><option value="">Select...</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></div>
          <div style={{ gridColumn: '1/-1' }}><label className="lb">Notes</label><input className="ip" value={form.description} onChange={(e) => u('description', e.target.value)} placeholder="Optional..." /></div>
          <div style={{ gridColumn: '1/-1' }}>
            <label className="lb">Status</label>
            <div style={{ display: 'flex', gap: 8 }}>
              <button className={`bt bsm ${form.status === 'pending' ? 'bp2' : 'bo2'}`} onClick={() => u('status', 'pending')}>Pending</button>
              <button className={`bt bsm ${form.status === 'verified' ? 'bp2' : 'bo2'}`} onClick={() => u('status', 'verified')}>Verified</button>
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 18 }}>
          <button className="bt bp2" style={{ flex: 1 }} onClick={save}>{editing ? 'Update' : 'Save receipt'}</button>
          <button className="bt bo2" onClick={onBack}>Cancel</button>
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// REPORT VIEW
// ═══════════════════════════════════════════════════════════════════
function ReportV({ client, data, recs, onBack }) {
  const tD = Object.entries(data.bc).filter(([c]) => DED_CATS.includes(c)).reduce((s, [, v]) => s + v.a, 0);
  const pct = data.tA > 0 ? Math.round(tD / data.tA * 100) : 0;
  const mos = {};
  recs.forEach((r) => { const m = r.date ? r.date.slice(0, 7) : '?'; if (!mos[m]) mos[m] = { a: 0, c: 0 }; mos[m].a += Number(r.amount) || 0; mos[m].c++; });
  const sM = Object.entries(mos).sort((a, b) => b[0].localeCompare(a[0]));

  return (
    <div className="fu">
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '18px 0 6px' }}>
        <button onClick={onBack} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4 }}><Ic n="back" s={22} c="#A09A90" /></button>
        <div><p style={{ fontWeight: 700, fontSize: 18 }}>Tax report</p><p style={{ fontSize: 12, color: '#A09A90' }}>{client.name}</p></div>
      </div>
      <div style={{ display: 'flex', gap: 8, margin: '14px 0 18px' }}>
        <button className="bt bp2 bsm" onClick={() => exportXLSX(client, recs)}><Ic n="dl" s={14} />Export Excel</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
        <div className="st"><div className="stl">Expenses</div><div className="stv" style={{ fontSize: 14 }}>{fmt(data.tA)}</div></div>
        <div className="st"><div className="stl">VAT claim</div><div className="stv" style={{ fontSize: 14, color: '#065F46' }}>{fmt(data.tV)}</div></div>
        <div className="st"><div className="stl">Deductible</div><div className="stv">{pct}%</div></div>
      </div>
      <div className="lb" style={{ marginBottom: 8 }}>By category</div>
      <div className="cd" style={{ padding: '2px 14px', marginBottom: 20 }}>
        {Object.entries(data.bc).sort((a, b) => b[1].a - a[1].a).map(([cat, v]) => (
          <div key={cat} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '11px 0', borderBottom: '1px solid #F3F0EA', fontSize: 14 }}>
            <div style={{ minWidth: 0, flex: 1 }}><span style={{ fontWeight: 600 }}>{cat}</span><span style={{ color: '#C0BAB0', fontSize: 11, marginLeft: 6 }}>({v.n})</span></div>
            <div style={{ display: 'flex', gap: 12, flexShrink: 0, alignItems: 'center' }}>
              <span style={{ fontSize: 13, width: 85, textAlign: 'right' }}>{fmt(v.a)}</span>
              <span className={`bg ${DED_CATS.includes(cat) ? 'bgv' : 'bgp'}`} style={{ fontSize: 10, minWidth: 40, textAlign: 'center' }}>{DED_CATS.includes(cat) ? 'Yes' : 'Partial'}</span>
            </div>
          </div>
        ))}
        <div style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 0', borderTop: '2px solid #E8E4DD', fontWeight: 700, fontSize: 14 }}><span>Total</span><span>{fmt(data.tA)}</span></div>
      </div>
      {sM.length > 0 && <>
        <div className="lb" style={{ marginBottom: 8 }}>Monthly</div>
        <div className="cd" style={{ padding: '6px 14px', marginBottom: 20 }}>
          {sM.map(([m, v]) => { const mx = Math.max(...sM.map(([, x]) => x.a)); const p = mx > 0 ? v.a / mx * 100 : 0; return (
            <div key={m} style={{ padding: '10px 0', borderBottom: '1px solid #F3F0EA' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5 }}><span style={{ fontSize: 13, fontWeight: 600 }}>{m}</span><span style={{ fontSize: 12, color: '#A09A90' }}>{fmt(v.a)} · {v.c} receipts</span></div>
              <div style={{ height: 5, background: '#F3F0EA', borderRadius: 3, overflow: 'hidden' }}><div style={{ width: `${p}%`, height: '100%', background: B.orange, borderRadius: 3, transition: 'width .5s ease' }} /></div>
            </div>
          ); })}
        </div>
      </>}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════
// NEW CLIENT MODAL
// ═══════════════════════════════════════════════════════════════════
function NewClientModal({ onAdd, onClose }) {
  const [f, sF] = useState({ name: '', tin: '', industry: '', color: '#185FA5' });
  const cols = ['#185FA5', '#0F6E56', '#D85A30', '#534AB7', '#993556', '#854F0B', '#3B6D11'];
  return (
    <div className="ov" onClick={onClose}>
      <div className="md" onClick={(e) => e.stopPropagation()}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
          <p style={{ fontWeight: 700, fontSize: 18 }}>New client</p>
          <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer' }}><Ic n="x" s={20} c="#A09A90" /></button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div><label className="lb">Company name</label><input className="ip" value={f.name} onChange={(e) => sF((p) => ({ ...p, name: e.target.value }))} placeholder="ABC Trading Ltd" /></div>
          <div><label className="lb">TIN</label><input className="ip" value={f.tin} onChange={(e) => sF((p) => ({ ...p, tin: e.target.value }))} placeholder="177-284-548" /></div>
          <div><label className="lb">Industry</label><input className="ip" value={f.industry} onChange={(e) => sF((p) => ({ ...p, industry: e.target.value }))} placeholder="Manufacturing" /></div>
          <div>
            <label className="lb">Color</label>
            <div style={{ display: 'flex', gap: 10 }}>
              {cols.map((c) => (
                <div key={c} onClick={() => sF((p) => ({ ...p, color: c }))} style={{ width: 32, height: 32, borderRadius: '50%', background: c, cursor: 'pointer', border: f.color === c ? `3px solid ${B.dark}` : '3px solid transparent', transition: 'border .15s' }} />
              ))}
            </div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, marginTop: 22 }}>
          <button className="bt bo2" style={{ flex: 1 }} onClick={onClose}>Cancel</button>
          <button className="bt bp2" style={{ flex: 1 }} onClick={() => { if (f.name) onAdd(f); }}>Add client</button>
        </div>
      </div>
    </div>
  );
}
