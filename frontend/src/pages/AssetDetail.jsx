// OWNER: P2 — add photo display, status transition buttons, QR code render
import { useEffect, useRef, useState } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import { QRCodeSVG } from 'qrcode.react';
import { jsPDF } from 'jspdf';
import { api } from '../api';
import { useAuth } from '../AuthContext';

const STATUS_COLORS = {
  available: 'bg-emerald-100 text-emerald-700',
  allocated: 'bg-indigo-100 text-indigo-700',
  reserved: 'bg-sky-100 text-sky-700',
  under_maintenance: 'bg-amber-100 text-amber-700',
  lost: 'bg-red-100 text-red-700',
  retired: 'bg-gray-200 text-gray-600',
  disposed: 'bg-gray-200 text-gray-500',
};

// Allowed manual status transitions per current status
const TRANSITIONS = {
  available:         ['reserved', 'lost', 'retired', 'disposed'],
  allocated:         ['lost', 'retired'],
  reserved:          ['available', 'lost', 'retired', 'disposed'],
  under_maintenance: ['available', 'lost', 'retired'],
  lost:              ['available'],
  retired:           ['disposed'],
  disposed:          [],
};

function toBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
}

export default function AssetDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { user } = useAuth();
  const [asset, setAsset] = useState(null);
  const [error, setError] = useState('');
  const [showEdit, setShowEdit] = useState(false);
  const [edit, setEdit] = useState({});
  const [imageMode, setImageMode] = useState('url');
  const qrRef = useRef(null);

  const reload = () => api(`/assets/${id}`).then((a) => { setAsset(a); setEdit({ name: a.name, condition: a.condition, location: a.location || '', is_bookable: a.is_bookable, image_url: a.image_url || '' }); });
  useEffect(() => { reload(); }, [id]);

  if (!asset) return <div className="text-gray-500">Loading…</div>;

  const canEdit   = ['admin', 'asset_manager'].includes(user.role);
  const canDelete = canEdit;

  // ── PDF helpers ──────────────────────────────────────────────
  const svgToPngDataUrl = () => new Promise((resolve) => {
    const svg  = qrRef.current?.querySelector('svg');
    if (!svg) return resolve(null);
    const xml  = new XMLSerializer().serializeToString(svg);
    const blob = new Blob([xml], { type: 'image/svg+xml' });
    const url  = URL.createObjectURL(blob);
    const img  = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = c.height = 256;
      c.getContext('2d').drawImage(img, 0, 0, 256, 256);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.src = url;
  });

  const downloadQrPdf = async () => {
    const png = await svgToPngDataUrl();
    if (!png) return;
    const doc = new jsPDF({ unit: 'mm', format: [60, 70] });
    doc.addImage(png, 'PNG', 5, 5, 50, 50);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(asset.asset_tag, 30, 60, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(7);
    doc.text(asset.name, 30, 65, { align: 'center', maxWidth: 50 });
    doc.save(`${asset.asset_tag}-qr.pdf`);
  };

  const downloadFullPdf = async () => {
    const png = await svgToPngDataUrl();
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const lm = 15, rm = 195, cw = 180;
    let y = 15;

    const line = () => { doc.setDrawColor(220); doc.line(lm, y, rm, y); y += 5; };

    const field = (label, value) => {
      if (!value && value !== 0) return;
      if (y > 272) { doc.addPage(); y = 20; }
      doc.setFontSize(8); doc.setFont('helvetica', 'normal'); doc.setTextColor(120);
      doc.text(label, lm, y);
      doc.setFontSize(9); doc.setTextColor(30);
      const lines = doc.splitTextToSize(String(value), cw - 46);
      doc.text(lines, lm + 45, y);
      y += lines.length * 5 + 1;
    };

    const section = (title) => {
      if (y > 265) { doc.addPage(); y = 20; }
      y += 3;
      doc.setFillColor(240, 242, 255); doc.rect(lm, y - 4, cw, 9, 'F');
      doc.setFontSize(10); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 80, 180);
      doc.text(title, lm + 2, y + 2); y += 10;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
    };

    const drawTable = (headers, rows) => {
      const rowH = 7;
      doc.setFillColor(225, 228, 255);
      doc.rect(lm, y - 4, cw, rowH, 'F');
      doc.setFontSize(8); doc.setFont('helvetica', 'bold'); doc.setTextColor(60, 80, 180);
      headers.forEach((h) => doc.text(h.label, h.x, y));
      y += rowH;
      doc.setFont('helvetica', 'normal'); doc.setTextColor(30);
      rows.forEach((cells, ri) => {
        if (y > 272) { doc.addPage(); y = 20; }
        if (ri % 2 === 0) { doc.setFillColor(248, 249, 255); doc.rect(lm, y - 4, cw, rowH, 'F'); }
        doc.setFontSize(8.5);
        cells.forEach((val, ci) => {
          doc.text(doc.splitTextToSize(String(val ?? '—'), headers[ci].w - 2), headers[ci].x, y);
        });
        y += rowH;
      });
      y += 2;
    };

    // Header
    doc.setFillColor(63, 81, 181); doc.rect(0, 0, 210, 22, 'F');
    doc.setFontSize(16); doc.setFont('helvetica', 'bold'); doc.setTextColor(255);
    doc.text('Asset Details Report', lm, 14);
    doc.setFontSize(9); doc.setFont('helvetica', 'normal');
    doc.text(`Generated: ${new Date().toLocaleString()}`, rm, 14, { align: 'right' });
    y = 30;

    // QR + basic side by side
    if (png) { doc.addImage(png, 'PNG', rm - 35, 25, 35, 35); }
    section('Basic Details');
    field('Asset Tag',    asset.asset_tag);
    field('Name',         asset.name);
    field('Category',     asset.category_name);
    field('Brand',        asset.brand);
    field('Model',        asset.model);
    field('Serial No.',   asset.serial_number);
    field('Condition',    asset.condition);
    field('Status',       asset.status.replace(/_/g, ' '));
    field('Location',     asset.location);
    field('Bookable',     asset.is_bookable ? 'Yes' : 'No');
    line();

    section('Purchase Information');
    field('Purchase Date',   asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString() : null);
    field('Cost',            asset.acquisition_cost ? `Rs. ${Number(asset.acquisition_cost).toLocaleString()}` : null);
    field('Vendor',          asset.vendor);
    field('Warranty Expiry', asset.warranty_expiry ? new Date(asset.warranty_expiry).toLocaleDateString() : null);
    line();

    section('Allocation History');
    if (asset.allocations.length === 0) {
      doc.setFontSize(9); doc.setTextColor(150); doc.text('Never allocated.', lm, y); y += 8;
    } else {
      drawTable(
        [
          { label: 'Holder',       x: lm,       w: 48 },
          { label: 'Allocated By', x: lm + 48,  w: 45 },
          { label: 'From',         x: lm + 93,  w: 30 },
          { label: 'To',           x: lm + 123, w: 30 },
          { label: 'Status',       x: lm + 153, w: 27 },
        ],
        asset.allocations.map((al) => [
          al.employee_name || al.department_name || '—',
          al.allocated_by_name || '—',
          new Date(al.allocated_at).toLocaleDateString(),
          al.returned_at ? new Date(al.returned_at).toLocaleDateString() : 'present',
          al.status,
        ])
      );
    }
    line();

    section('Maintenance History');
    if (asset.maintenance.length === 0) {
      doc.setFontSize(9); doc.setTextColor(150); doc.text('No maintenance records.', lm, y); y += 8;
    } else {
      drawTable(
        [
          { label: 'Issue',    x: lm,       w: 65 },
          { label: 'Priority', x: lm + 65,  w: 25 },
          { label: 'Status',   x: lm + 90,  w: 35 },
          { label: 'Raised By',x: lm + 125, w: 40 },
          { label: 'Date',     x: lm + 165, w: 30 },
        ],
        asset.maintenance.map((m) => [
          m.issue,
          m.priority,
          m.status.replace(/_/g, ' '),
          m.raised_by_name,
          new Date(m.created_at).toLocaleDateString(),
        ])
      );
    }

    doc.save(`${asset.asset_tag}-full-details.pdf`);
  };
  // ─────────────────────────────────────────────────────────────


  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const b64 = await toBase64(file);
    setEdit((prev) => ({ ...prev, image_url: b64 }));
  };

  const saveEdit = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api(`/assets/${id}`, { method: 'PUT', body: edit });
      setShowEdit(false);
      reload();
    } catch (err) { setError(err.message); }
  };

  const transition = async (status) => {
    if (!window.confirm(`Mark asset as "${status.replace('_', ' ')}"?`)) return;
    setError('');
    try {
      await api(`/assets/${id}`, { method: 'PUT', body: { status } });
      reload();
    } catch (err) { setError(err.message); }
  };

  const deleteAsset = async () => {
    if (!window.confirm(`Delete ${asset.asset_tag} — ${asset.name}? This cannot be undone.`)) return;
    try {
      await api(`/assets/${id}`, { method: 'DELETE' });
      navigate('/assets');
    } catch (err) { setError(err.message); }
  };

  const nextStatuses = TRANSITIONS[asset.status] || [];

  return (
    <div className="space-y-6 max-w-3xl">
      {/* Top bar */}
      <div className="flex items-center justify-between">
        <Link to="/assets" className="text-sm text-indigo-600">← Back to assets</Link>
        <div className="flex gap-2">
          {canEdit && <button onClick={() => setShowEdit(true)} className="btn text-sm">Edit</button>}
          {canDelete && <button onClick={deleteAsset} className="btn bg-red-600 hover:bg-red-700 text-white text-sm">Delete</button>}
        </div>
      </div>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      {/* Main info card */}
      <div className="card flex gap-5">
        {asset.image_url
          ? <img src={asset.image_url} alt={asset.name} className="h-28 w-28 object-cover rounded-lg border flex-shrink-0" />
          : (
              <div className="h-28 w-28 rounded-lg border bg-gray-100 flex items-center justify-center flex-shrink-0">
                <svg className="h-10 w-10 text-gray-300" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="1.5">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M20 7l-8-4-8 4m16 0l-8 4m8-4v10l-8 4m0-10L4 7m8 4v10M4 7v10l8 4" />
                </svg>
              </div>
            )
        }
        <div className="flex-1 min-w-0">
          <div className="flex items-start justify-between gap-2 flex-wrap">
            <h1 className="text-2xl font-bold">{asset.name} <span className="font-mono text-base text-gray-400">{asset.asset_tag}</span></h1>
            <span className={`badge ${STATUS_COLORS[asset.status]}`}>{asset.status.replace('_', ' ')}</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mt-4 text-sm">
            <div><div className="text-gray-400 text-xs">Category</div>{asset.category_name}</div>
            <div><div className="text-gray-400 text-xs">Condition</div>{asset.condition}</div>
            <div><div className="text-gray-400 text-xs">Location</div>{asset.location || '—'}</div>
            <div><div className="text-gray-400 text-xs">Serial</div>{asset.serial_number || '—'}</div>
            <div><div className="text-gray-400 text-xs">Acquired</div>{asset.acquisition_date ? new Date(asset.acquisition_date).toLocaleDateString() : '—'}</div>
            <div><div className="text-gray-400 text-xs">Cost</div>{asset.acquisition_cost ? `₹${Number(asset.acquisition_cost).toLocaleString()}` : '—'}</div>
            <div><div className="text-gray-400 text-xs">Bookable</div>{asset.is_bookable ? 'Yes' : 'No'}</div>
          </div>
        </div>
      </div>

      {/* Status transition actions */}
      {canEdit && nextStatuses.length > 0 && (
        <div className="card">
          <h2 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wide">Actions</h2>
          <div className="flex flex-wrap gap-2">
            {nextStatuses.map((s) => {
              const isDanger = s === 'disposed' || s === 'lost';
              const isWarn   = s === 'retired';
              return (
                <button key={s} onClick={() => transition(s)}
                  className={`btn text-sm capitalize ${
                    isDanger ? 'bg-red-600 hover:bg-red-700 text-white'
                    : isWarn ? 'bg-gray-500 hover:bg-gray-600 text-white'
                    : ''
                  }`}>
                  Mark as {s.replace('_', ' ')}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* QR Code */}
      <div className="card flex items-start gap-6">
        <div>
          <h2 className="font-semibold mb-3 text-sm text-gray-500 uppercase tracking-wide">QR Code</h2>
          <div ref={qrRef}>
            <QRCodeSVG value={asset.asset_tag} size={128} includeMargin level="M" />
          </div>
        </div>
        <div className="flex flex-col gap-2 mt-6">
          <p className="text-xs text-gray-400">Use "Scan QR" in the sidebar to scan</p>
          <p className="text-xs font-mono text-gray-500">{asset.asset_tag}</p>
          <button onClick={downloadQrPdf} className="btn text-sm">⬇ Download QR PDF</button>
          <button onClick={downloadFullPdf} className="btn text-sm">⬇ Download Full Details PDF</button>
        </div>
      </div>

      {/* Edit modal */}
      {showEdit && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form onSubmit={saveEdit} className="bg-white rounded-xl shadow-xl p-6 w-full max-w-md space-y-3">
            <h2 className="font-bold text-lg">Edit Asset</h2>
            <input className="input" placeholder="Name" value={edit.name} onChange={(e) => setEdit({ ...edit, name: e.target.value })} required />
            <select className="input" value={edit.condition} onChange={(e) => setEdit({ ...edit, condition: e.target.value })}>
              {['new', 'good', 'fair', 'poor'].map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <input className="input" placeholder="Location" value={edit.location} onChange={(e) => setEdit({ ...edit, location: e.target.value })} />
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={edit.is_bookable} onChange={(e) => setEdit({ ...edit, is_bookable: e.target.checked })} />
              Shared / bookable resource
            </label>

            {/* Photo in edit */}
            <div className="space-y-1">
              <div className="flex gap-3 text-sm">
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'url'} onChange={() => setImageMode('url')} /> URL
                </label>
                <label className="flex items-center gap-1 cursor-pointer">
                  <input type="radio" checked={imageMode === 'file'} onChange={() => setImageMode('file')} /> Upload file
                </label>
              </div>
              {imageMode === 'url'
                ? <input className="input" placeholder="Image URL" value={edit.image_url} onChange={(e) => setEdit({ ...edit, image_url: e.target.value })} />
                : <input type="file" accept="image/*" className="input text-sm" onChange={handleFile} />
              }
              {edit.image_url && <img src={edit.image_url} alt="preview" className="h-16 w-16 object-cover rounded border mt-1" />}
            </div>

            <div className="flex gap-2 pt-1">
              <button type="submit" className="btn flex-1">Save</button>
              <button type="button" className="btn bg-gray-100 text-gray-700 hover:bg-gray-200 flex-1" onClick={() => setShowEdit(false)}>Cancel</button>
            </div>
          </form>
        </div>
      )}

      {/* Allocation history */}
      <div className="card">
        <h2 className="font-semibold mb-2">Allocation History</h2>
        {asset.allocations.length === 0 && <p className="text-sm text-gray-400">Never allocated.</p>}
        {asset.allocations.map((al) => (
          <div key={al.id} className="text-sm py-2 border-t border-gray-100 flex justify-between">
            <span>{al.employee_name || al.department_name} <span className="text-gray-400">by {al.allocated_by_name}</span></span>
            <span className="text-gray-500">
              {new Date(al.allocated_at).toLocaleDateString()} → {al.returned_at ? new Date(al.returned_at).toLocaleDateString() : 'now'}
            </span>
          </div>
        ))}
      </div>

      {/* Maintenance history */}
      <div className="card">
        <h2 className="font-semibold mb-2">Maintenance History</h2>
        {asset.maintenance.length === 0 && <p className="text-sm text-gray-400">No maintenance records.</p>}
        {asset.maintenance.map((m) => (
          <div key={m.id} className="text-sm py-2 border-t border-gray-100 flex justify-between">
            <span>{m.issue} <span className="text-gray-400">({m.priority}, by {m.raised_by_name})</span></span>
            <span className="capitalize text-gray-500">{m.status.replace('_', ' ')}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
