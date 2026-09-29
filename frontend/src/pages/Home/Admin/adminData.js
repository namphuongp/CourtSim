import { useEffect, useState } from 'react';
import api, { getApiError } from '../../../services/api';
export function useAdminData(path) {
  const [refresh, setRefresh] = useState(0);
  const [state, setState] = useState({});
  const key = `${path}:${refresh}`;
  useEffect(() => {
    const controller = new AbortController();
    api.get(path, { signal: controller.signal, timeout: 20000 }).then(({ data }) => setState({ key, value: data }))
      .catch(error => { if (!controller.signal.aborted) setState({ key, error: getApiError(error, 'Không thể tải dữ liệu. Vui lòng thử lại.') }); });
    return () => controller.abort();
  }, [key, path]);
  return { data: state.key === key ? state.value : null, loading: state.key !== key, error: state.key === key ? state.error : null, reload: () => setRefresh(v => v + 1) };
}
export const date = value => value ? new Date(value).toLocaleString('vi-VN') : 'Chưa có dữ liệu';
export const number = value => value == null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('vi-VN', { maximumFractionDigits: 2 }).format(value);
export const money = value => value == null ? 'Chưa có dữ liệu' : new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 6 }).format(value);
export const duration = value => value == null ? 'Chưa có dữ liệu' : `${number(value / 60000)} phút`;
export const roleLabel = value => ({ defense_lawyer: 'Luật sư bảo vệ bị đơn / bào chữa', plaintiff_lawyer: 'Luật sư bảo vệ nguyên đơn / bị hại', judge: 'Chủ tọa', opponent: 'Bên đối lập', evaluator: 'Chấm điểm', legal_assistant: 'Trợ lý luật', voice: 'Giọng nói', other: 'Khác' })[value] ?? value;
