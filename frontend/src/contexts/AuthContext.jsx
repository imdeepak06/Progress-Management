import { createContext, useContext, useState, useEffect } from 'react';
import api from '../utils/api';

const AuthContext = createContext(null);

export const AuthProvider = ({ children }) => {
  const [user,    setUser]    = useState(() => { try { return JSON.parse(localStorage.getItem('fo_user')); } catch { return null; } });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const verify = async () => {
      if (localStorage.getItem('fo_token')) {
        try {
          const { data } = await api.get('/auth/me');
          setUser(data);
          localStorage.setItem('fo_user', JSON.stringify(data));
        } catch { logout(); }
      }
      setLoading(false);
    };
    verify();
  }, []);

  const login = async (email, password) => {
    const { data } = await api.post('/auth/login', { email, password });
    localStorage.setItem('fo_token', data.token);
    localStorage.setItem('fo_user', JSON.stringify(data.user));
    setUser(data.user);
    return data.user;
  };

  const logout = () => {
    localStorage.removeItem('fo_token');
    localStorage.removeItem('fo_user');
    setUser(null);
  };

  return <AuthContext.Provider value={{ user, loading, login, logout }}>{children}</AuthContext.Provider>;
};

export const useAuth = () => useContext(AuthContext);
