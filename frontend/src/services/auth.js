let activeUser = null;
export function getCurrentUser() {
  try { return activeUser ?? JSON.parse(localStorage.getItem('currentUser') ?? 'null'); } catch { return activeUser; }
}
export function clearAuth() {
  activeUser = null;
  try { for (const key of ['userToken', 'userRole', 'currentUser']) localStorage.removeItem(key); } catch { /* Cookie vẫn do backend thu hồi khi đăng xuất. */ }
}
export function setCurrentUser(user) {
  clearAuth();
  if (user?.id) {
    activeUser = user;
    try {
      localStorage.setItem('currentUser', JSON.stringify(user));
      localStorage.setItem('userRole', user.role);
    } catch { /* Trình duyệt chặn storage vẫn dùng phiên cookie và dữ liệu trong bộ nhớ. */ }
  }
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
