import { createContext, useContext, useState } from 'react';
import { api, setSession, clearSession, getUser } from './api';

const AuthCtx = createContext(null);
export const useAuth = () => useContext(AuthCtx);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(getUser());
  const login = async (email, password) => {
    const { token, user: u } = await api('/api/auth/login', { method: 'POST', body: { email, password } });
    setSession(token, u);
    setUser(u);
  };
  const logout = () => { clearSession(); setUser(null); };
  const can = (...roles) => !!user && roles.includes(user.role);
  return <AuthCtx.Provider value={{ user, login, logout, can }}>{children}</AuthCtx.Provider>;
}
