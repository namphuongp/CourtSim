import { BookOpen, LoaderCircle } from 'lucide-react';
import './workspaceStates.css';

export function LoadingState({ children = 'Đang tải dữ liệu…' }) {
  return <div className="workspace-loading" role="status"><LoaderCircle size={21} aria-hidden="true"/><span>{children}</span><div className="workspace-skeleton" aria-hidden="true"><i/><i/><i/></div></div>;
}

export function EmptyState({ title, children, action }) {
  return <div className="workspace-empty"><span className="workspace-empty-icon"><BookOpen size={22} aria-hidden="true"/></span><div><strong>{title}</strong>{children && <p>{children}</p>}</div>{action}</div>;
}
