export const getAuthToken = () => {
  if (typeof window === 'undefined') return null;
  
  const realToken = localStorage.getItem('realToken');
  const tokenTmp = localStorage.getItem('tokenTmp');
  
  if (!realToken && tokenTmp) {
    console.error('realToken missing but tokenTmp exists - auth state invalid');
    window.dispatchEvent(new CustomEvent('auth:invalid'));
    return null;
  }
  
  return realToken;
};

export const clearAuthTokens = () => {
  if (typeof window === 'undefined') return;
  
  localStorage.removeItem('tokenTmp');
  localStorage.removeItem('realToken');
  localStorage.removeItem('LoggedIn');
};
