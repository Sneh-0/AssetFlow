// OWNER: P4 — unread badge in sidebar, toast on new notifications (poll every 30s)
import { useEffect, useState } from 'react';
import { api } from '../api';

export default function Notifications() {
  const [notifications, setNotifications] = useState([]);
  const [activity, setActivity] = useState([]);
  const [tab, setTab] = useState('notifications');

  const load = () => {
    api('/notifications').then(setNotifications);
    api('/activity').then(setActivity);
  };
  useEffect(load, []);

  const markAll = async () => { await api('/notifications/read-all', { method: 'POST' }); load(); };

  return (
    <div className="space-y-4 max-w-3xl">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Notifications & Activity</h1>
        {tab === 'notifications' && <button className="btn-secondary" onClick={markAll}>Mark all read</button>}
      </div>
      <div className="flex gap-2">
        {['notifications', 'activity log'].map((t) => (
          <button key={t} onClick={() => setTab(t === 'activity log' ? 'activity' : t)}
            className={`px-4 py-2 rounded-lg text-sm font-medium capitalize cursor-pointer ${((tab === 'activity') === (t === 'activity log')) ? 'bg-indigo-600 text-white' : 'bg-white border border-gray-200'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'notifications' && (
        <div className="card p-0 divide-y divide-gray-100">
          {notifications.length === 0 && <p className="p-4 text-sm text-gray-400">No notifications.</p>}
          {notifications.map((n) => (
            <div key={n.id} className={`p-4 text-sm ${n.read ? 'text-gray-400' : 'font-medium'}`}>
              <div>{n.message}</div>
              <div className="text-xs text-gray-400 mt-1">{n.type.replace(/_/g, ' ')} · {new Date(n.created_at).toLocaleString()}</div>
            </div>
          ))}
        </div>
      )}

      {tab === 'activity' && (
        <div className="card p-0 divide-y divide-gray-100">
          {activity.map((l) => (
            <div key={l.id} className="p-3 text-sm flex justify-between">
              <span><span className="font-medium">{l.user_name || 'System'}</span> · {l.action} {l.details && <span className="text-gray-400">— {l.details}</span>}</span>
              <span className="text-xs text-gray-400">{new Date(l.created_at).toLocaleString()}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
