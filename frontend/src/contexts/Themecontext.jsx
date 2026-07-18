import { createContext, useContext, useEffect, useState } from 'react';

const ThemeContext = createContext(null);

const STORAGE_KEY = 'fo_theme';

const getInitialTheme = () => {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === 'light' || saved === 'dark') return saved;
  } catch { /* ignore */ }
  // Default to dark (original look)
  return 'dark';
};

// NOTE: We deliberately do NOT touch document.documentElement here.
// The theme is scoped locally (see Layout.jsx, which puts the `light`/`dark`
// class on the dashboard wrapper only) so that public-facing pages
// (Home, Login, Public Location, etc.) always keep the original look
// no matter what theme is selected inside the dashboard.
export const ThemeProvider = ({ children }) => {
  const [theme, setTheme] = useState(getInitialTheme);

  useEffect(() => {
    try { localStorage.setItem(STORAGE_KEY, theme); } catch { /* ignore */ }
  }, [theme]);

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'));

  return (
    <ThemeContext.Provider value={{ theme, setTheme, toggleTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useTheme = () => {
  const ctx = useContext(ThemeContext);
  if (!ctx) return { theme: 'dark', setTheme: () => {}, toggleTheme: () => {} };
  return ctx;
};