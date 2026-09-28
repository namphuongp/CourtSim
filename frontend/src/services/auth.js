export function getCurrentUser() {
  try { return JSON.parse(localStorage.getItem('currentUser') ?? 'null'); } catch { return null; }
}
export function clearAuth() {
  for (const key of ['userToken', 'userRole', 'currentUser']) localStorage.removeItem(key);
}
export function setCurrentUser(user) {
  clearAuth();
  if (user?.id) {
    localStorage.setItem('currentUser', JSON.stringify(user));
    localStorage.setItem('userRole', user.role);
  }
}
export function safeReturnPath(value) {
  return typeof value === 'string' && /^\/(?:dashboard|simulation|admin)(?:\/|$)/.test(value) ? value : '/dashboard';
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
