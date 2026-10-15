import { useEffect, useState } from 'react';
import api, { getApiError } from '../../services/api';

export default function useDashboardSessions({ includeSkills = false } = {}) {
  const [sessions, setSessions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/v1/sessions', { signal: controller.signal, ...(includeSkills ? { params: { include: 'skills' } } : {}) }).then(({ data }) => {
      if (!Array.isArray(data.data)) throw new Error('Invalid session list');
      setSessions(data.data);
    }).catch(e => { if (!controller.signal.aborted) setError(getApiError(e)); })
      .finally(() => { if (!controller.signal.aborted) setLoading(false); });
    return () => controller.abort();
  }, [revision, includeSkills]);
  return { sessions, loading, error, retry: () => { setError(''); setLoading(true); setRevision(n => n + 1); } };
}
