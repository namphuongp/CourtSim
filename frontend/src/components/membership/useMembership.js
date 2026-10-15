import { useEffect, useState } from 'react';
import api, { getApiError } from '../../services/api';

export default function useMembership(creationRequestId) {
  const [state, setState] = useState({ loading: true, data: null, error: '' });
  const [revision, setRevision] = useState(0);
  useEffect(() => {
    const controller = new AbortController();
    api.get('/auth/membership', { signal: controller.signal,
      ...(creationRequestId ? { params: { creation_request_id: creationRequestId } } : {}) }).then(({ data }) => {
      if (!controller.signal.aborted) setState({ loading: false, data: data.data, error: '' });
    }).catch(error => {
      if (!controller.signal.aborted) setState({ loading: false, data: null, error: getApiError(error, 'Chưa tải được quyền lợi và số lượt. Hãy thử lại.') });
    });
    return () => controller.abort();
  }, [revision, creationRequestId]);
  return { ...state, refresh: () => { setState(current => ({ ...current, loading: true, error: '' })); setRevision(value => value + 1); } };
}
