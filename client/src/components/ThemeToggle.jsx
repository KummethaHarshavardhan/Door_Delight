import React from 'react';
import { Moon, Sun } from 'lucide-react';
import { useTheme } from '../context/ThemeContext';

export default function ThemeToggle({ compact = false }) {
  const { theme, toggleTheme } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type="button"
      className="btn btn-secondary btn-sm theme-toggle-btn"
      onClick={toggleTheme}
      aria-label={`Switch to ${isDark ? 'light' : 'dark'} mode`}
      title={`Switch to ${isDark ? 'Light' : 'Dark'} Mode`}
    >
      {isDark ? <Sun size={16} color="#fbbf24" /> : <Moon size={16} color="#7c3aed" />}
      {!compact && <span>{isDark ? 'Light' : 'Dark'}</span>}
    </button>
  );
}
