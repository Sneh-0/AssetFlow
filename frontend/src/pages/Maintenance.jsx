// OWNER: P3 — add photo attach, technician-assignment modal, priority filters
import { useEffect, useState, useRef } from 'react';
import { api } from '../api';
import { useAuth } from '../AuthContext';

export default function Maintenance() {
  const { user } = useAuth();
  const [requests, setRequests] = useState([]);
  const [assets, setAssets] = useState([]);
  const [form, setForm] = useState({ asset_id: '', issue: '', priority: 'medium', photo_url: '' });
  const [error, setError] = useState('');
  const [activePhoto, setActivePhoto] = useState(null);
  
  // Technician Assignment Modal States
  const [technicians, setTechnicians] = useState([]);
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [selectedRequestId, setSelectedRequestId] = useState(null);
  const [selectedTechId, setSelectedTechId] = useState('');

  // Manager Filtering States
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const fileInputRef = useRef(null);

  const load = () => {
    api('/maintenance').then(setRequests);
    
    if (user && user.role === 'employee') {
      api('/allocations?mine=true&active=true').then((allocs) => {
        setAssets(allocs.map(al => ({
          id: al.asset_id,
          asset_tag: al.asset_tag,
          name: al.asset_name
        })));
      });
    } else {
      api('/assets').then(setAssets);
    }
  };

  useEffect(load, [user]);

  const handlePhotoChange = (e) => {
    const file = e.target.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
      setError('Image size must be less than 2MB');
      e.target.value = '';
      return;
    }

    const reader = new FileReader();
    reader.onloadend = () => {
      setForm((f) => ({ ...f, photo_url: reader.result }));
    };
    reader.readAsDataURL(file);
  };

  const raise = async (e) => {
    e.preventDefault();
    setError('');
    try {
      await api('/maintenance', { method: 'POST', body: { ...form, asset_id: Number(form.asset_id) } });
      setForm({ asset_id: '', issue: '', priority: 'medium', photo_url: '' });
      if (fileInputRef.current) fileInputRef.current.value = '';
      load();
    } catch (err) { setError(err.message); }
  };

  const act = async (id, action) => {
    setError('');
    if (action === 'assign') {
      setSelectedRequestId(id);
      api('/technicians')
        .then((data) => {
          setTechnicians(data.filter(t => t.status === 'active'));
          setShowAssignModal(true);
        })
        .catch(err => setError(err.message));
      return;
    }
    
    try {
      await api(`/maintenance/${id}`, { method: 'PUT', body: { action } });
      load();
    } catch (err) { setError(err.message); }
  };

  const assignTechnician = async (e) => {
    e.preventDefault();
    if (!selectedTechId) return;
    setError('');
    try {
      await api(`/maintenance/${selectedRequestId}`, {
        method: 'PUT',
        body: { action: 'assign', technician_id: Number(selectedTechId) }
      });
      setShowAssignModal(false);
      setSelectedRequestId(null);
      setSelectedTechId('');
      load();
    } catch (err) { setError(err.message); }
  };

  const isManager = ['admin', 'asset_manager'].includes(user?.role);
  const NEXT = { pending: ['approve', 'reject'], approved: ['assign'], assigned: ['start', 'resolve'], in_progress: ['resolve'] };
  const badge = { pending: 'bg-amber-100 text-amber-700', approved: 'bg-sky-100 text-sky-700', rejected: 'bg-red-100 text-red-700', assigned: 'bg-purple-100 text-purple-700', in_progress: 'bg-indigo-100 text-indigo-700', resolved: 'bg-emerald-100 text-emerald-700' };

  // Filter requests client-side based on pills and dropdown selection
  const filteredRequests = requests.filter((m) => {
    if (isManager) {
      if (statusFilter !== 'all') {
        if (statusFilter === 'pending' && m.status !== 'pending') return false;
        if (statusFilter === 'approved' && m.status !== 'approved') return false;
        if (statusFilter === 'active' && !['assigned', 'in_progress'].includes(m.status)) return false;
        if (statusFilter === 'resolved' && m.status !== 'resolved') return false;
        if (statusFilter === 'rejected' && m.status !== 'rejected') return false;
      }
      if (priorityFilter !== 'all' && m.priority !== priorityFilter) return false;
    }
    return true;
  });

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Maintenance</h1>
      {error && <div className="text-sm text-red-600 bg-red-50 rounded-lg p-2">{error}</div>}

      <form onSubmit={raise} className="card flex flex-wrap gap-4 items-end">
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Asset</label>
          <select className="input" value={form.asset_id} onChange={(e) => setForm({ ...form, asset_id: e.target.value })} required>
            <option value="">Select…</option>
            {assets.map((a) => <option key={a.id} value={a.id}>{a.asset_tag} — {a.name}</option>)}
          </select>
        </div>
        <div className="grow max-w-md">
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Issue</label>
          <input className="input" value={form.issue} onChange={(e) => setForm({ ...form, issue: e.target.value })} required />
        </div>
        <div>
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Priority</label>
          <select className="input" value={form.priority} onChange={(e) => setForm({ ...form, priority: e.target.value })}>
            {['low', 'medium', 'high', 'critical'].map((p) => <option key={p}>{p}</option>)}
          </select>
        </div>
        <div className="grow max-w-xs">
          <label className="text-xs text-gray-500 font-semibold mb-1 block">Attach Photo</label>
          <input
            type="file"
            accept="image/*"
            ref={fileInputRef}
            className="input file:mr-2 file:py-1 file:px-2 file:rounded file:border-0 file:text-xs file:font-semibold file:bg-indigo-50 file:text-indigo-700 hover:file:bg-indigo-100 cursor-pointer"
            onChange={handlePhotoChange}
          />
        </div>
        {form.photo_url && (
          <div className="flex items-center gap-2 pb-1">
            <img src={form.photo_url} alt="Preview" className="h-10 w-10 object-cover rounded-lg border border-gray-300" />
            <button
              type="button"
              className="text-xs text-red-500 hover:text-red-700 font-medium"
              onClick={() => {
                setForm(f => ({ ...f, photo_url: '' }));
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
            >
              Clear
            </button>
          </div>
        )}
        <button className="btn self-end">Raise Request</button>
      </form>

      {/* Role-based Filter Controls for Admin and Asset Managers */}
      {isManager && (
        <div className="flex flex-wrap gap-4 items-center justify-between bg-white p-4 rounded-xl border border-gray-200">
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider mr-2">Filter Status:</span>
            {[
              { id: 'all', label: 'All Requests' },
              { id: 'pending', label: '⏳ Pending' },
              { id: 'approved', label: '✅ Approved' },
              { id: 'active', label: '🔧 Under Repair' },
              { id: 'resolved', label: '✨ Resolved' },
              { id: 'rejected', label: '❌ Rejected' }
            ].map((f) => (
              <button
                key={f.id}
                type="button"
                onClick={() => setStatusFilter(f.id)}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold cursor-pointer transition-all ${
                  statusFilter === f.id
                    ? 'bg-indigo-600 text-white shadow-sm'
                    : 'bg-gray-50 text-gray-600 hover:bg-gray-100 border border-gray-100'
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-400 font-semibold uppercase tracking-wider">Priority:</span>
            <select
              className="input max-w-[150px] !py-1"
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
            >
              <option value="all">All Priorities</option>
              <option value="low">Low</option>
              <option value="medium">Medium</option>
              <option value="high">High</option>
              <option value="critical">Critical</option>
            </select>
          </div>
        </div>
      )}

      <div className="card p-0 overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr>
              <th className="th">Asset</th>
              <th className="th">Issue</th>
              <th className="th">Photo</th>
              <th className="th">Priority</th>
              <th className="th">Raised By</th>
              <th className="th">Status</th>
              <th className="th">Actions</th>
            </tr>
          </thead>
          <tbody>
            {filteredRequests.map((m) => (
              <tr key={m.id}>
                <td className="td font-mono">{m.asset_tag}</td>
                <td className="td">
                  <div>{m.issue}</div>
                  {m.technician_name && (
                    <div className="text-xs text-indigo-600 font-semibold mt-0.5">
                      Tech Assigned: {m.technician_name} {m.technician_specialty ? `(${m.technician_specialty})` : ''}
                    </div>
                  )}
                </td>
                <td className="td">
                  {m.photo_url ? (
                    <img
                      src={m.photo_url}
                      alt="Asset Issue"
                      className="h-10 w-10 object-cover rounded-lg border border-gray-200 cursor-pointer hover:opacity-85 transition-opacity"
                      onClick={() => setActivePhoto(m.photo_url)}
                    />
                  ) : (
                    <span className="text-gray-400 text-xs">—</span>
                  )}
                </td>
                <td className="td capitalize">
                  <span className={`px-2 py-0.5 rounded text-xs font-semibold ${
                    m.priority === 'critical' ? 'bg-red-100 text-red-800' :
                    m.priority === 'high' ? 'bg-orange-100 text-orange-800' :
                    m.priority === 'medium' ? 'bg-yellow-100 text-yellow-800' : 'bg-green-100 text-green-800'
                  }`}>
                    {m.priority}
                  </span>
                </td>
                <td className="td">{m.raised_by_name}</td>
                <td className="td"><span className={`badge ${badge[m.status]}`}>{m.status.replace('_', ' ')}</span></td>
                <td className="td space-x-1">
                  {isManager && (NEXT[m.status] || []).map((a) => (
                    <button key={a} className="btn-secondary text-xs uppercase tracking-wide cursor-pointer" onClick={() => act(m.id, a)}>{a}</button>
                  ))}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {filteredRequests.length === 0 && (
          <p className="p-6 text-sm text-gray-400 text-center font-medium">No matching maintenance requests found.</p>
        )}
      </div>

      {/* Lightbox Modal for Photo Preview */}
      {activePhoto && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in"
          onClick={() => setActivePhoto(null)}
        >
          <div className="relative max-w-3xl max-h-[85vh] bg-white p-2 rounded-xl shadow-2xl overflow-hidden">
            <img src={activePhoto} alt="Maintenance Issue Preview" className="max-w-full max-h-[80vh] object-contain rounded-lg" />
            <button
              onClick={() => setActivePhoto(null)}
              className="absolute top-4 right-4 bg-black/50 text-white rounded-full p-2 hover:bg-black/70 cursor-pointer animate-pulse"
            >
              ✕
            </button>
          </div>
        </div>
      )}

      {/* Assign Technician Modal */}
      {showAssignModal && (
        <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50 animate-fade-in">
          <div className="bg-white rounded-xl shadow-2xl overflow-hidden max-w-md w-full p-6 space-y-4">
            <div className="flex justify-between items-center border-b border-gray-100 pb-3">
              <h3 className="text-lg font-bold text-gray-800">Assign Technician</h3>
              <button 
                onClick={() => { setShowAssignModal(false); setSelectedRequestId(null); setSelectedTechId(''); }} 
                className="text-gray-400 hover:text-gray-600 font-bold text-lg cursor-pointer"
              >
                ✕
              </button>
            </div>
            <form onSubmit={assignTechnician} className="space-y-4">
              <div>
                <label className="text-xs text-gray-500 font-semibold mb-1 block">Select Technician</label>
                <select 
                  className="input" 
                  value={selectedTechId} 
                  onChange={e => setSelectedTechId(e.target.value)} 
                  required
                >
                  <option value="">Select…</option>
                  {technicians.map(t => (
                    <option key={t.id} value={t.id}>
                      {t.name} ({t.specialty || 'General'}) — Active Jobs: {t.active_requests_count}
                    </option>
                  ))}
                </select>
                {technicians.length === 0 && (
                  <p className="text-xs text-amber-600 mt-1">No active technicians found. Please register technicians in Org Setup first.</p>
                )}
              </div>
              <div className="flex justify-end gap-2 border-t border-gray-100 pt-3">
                <button 
                  type="button" 
                  className="btn-secondary" 
                  onClick={() => { setShowAssignModal(false); setSelectedRequestId(null); setSelectedTechId(''); }}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn" 
                  disabled={!selectedTechId}
                >
                  Confirm Assignment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
