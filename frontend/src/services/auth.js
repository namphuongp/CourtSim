import { useEffect, useState } from 'react';

let activeUser = null;
const authListeners = new Set();

function notifyAuthListeners() {
  const current = getCurrentUser();
  for (const listener of authListeners) {
    try { listener(current); } catch { /* ignore */ }
  }
}

export function getCurrentUser() {
  try { return activeUser ?? JSON.parse(localStorage.getItem('currentUser') ?? 'null'); } catch { return activeUser; }
}
export function clearAuth() {
  activeUser = null;
  try { for (const key of ['userToken', 'userRole', 'currentUser']) localStorage.removeItem(key); } catch { /* Cookie vẫn do backend thu hồi khi đăng xuất. */ }
  notifyAuthListeners();
}
export function setCurrentUser(user) {
  activeUser = null;
  try { for (const key of ['userToken', 'userRole', 'currentUser']) localStorage.removeItem(key); } catch { /* ignore */ }
  if (user?.id) {
    activeUser = user;
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
    } catch { /* Trình duyệt chặn storage vẫn dùng phiên cookie và dữ liệu trong bộ nhớ. */ }
  }
  notifyAuthListeners();
}
export function useCurrentUser() {
  const [user, setUser] = useState(() => getCurrentUser());
  useEffect(() => {
    const sync = () => setUser(getCurrentUser());
    authListeners.add(sync);
    window.addEventListener('storage', sync);
    sync();
    return () => {
      authListeners.delete(sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return user;
}
export function safeReturnPath(value) {
  return typeof value === 'string' && /^\/(?:dashboard|simulation|admin|account|checkout)(?:\/|$)/.test(value) ? value : '/dashboard';
}
export function draftKey(sessionId) {
  return `courtsim:draft:${getCurrentUser()?.id ?? 'unknown'}:${sessionId}`;
}
export function readDraft(key) {
  try { return JSON.parse(sessionStorage.getItem(key) ?? 'null'); } catch { return null; }
}
export function saveDraft(key, value) {
  try { if (value === null) sessionStorage.removeItem(key); else sessionStorage.setItem(key, JSON.stringify(value)); } catch { /* Bộ nhớ riêng tư có thể không khả dụng; vẫn cho phép luyện tập. */ }
}
