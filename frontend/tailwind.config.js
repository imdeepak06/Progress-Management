/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  // These color utilities are built dynamically at runtime (e.g. `bg-${color}-500/10`)
  // so Tailwind's scanner cannot see them in the source. Safelist them explicitly.
  safelist: [
    { pattern: /(bg|text|border|from|via|to)-(cyan|violet|amber|teal|emerald|orange|purple|brand|red|slate)-(400|500|600)/, variants: ['hover'] },
    { pattern: /(bg|text)-(cyan|violet|amber|teal|emerald|orange|purple|brand)-(400|500)\/(10|15|20)/ },
  ],
  theme: {
    extend: {
      fontFamily: {
        sans: ['"DM Sans"', 'system-ui', 'sans-serif'],
        mono: ['"JetBrains Mono"', 'monospace'],
        display: ['"Syne"', 'sans-serif'],
      },
      colors: {
        brand: {
          50:  '#f0f4ff',
          100: '#e0e9ff',
          400: '#6b8cff',
          500: '#4f6ef7',
          600: '#3b55e0',
          700: '#2d42c4',
          900: '#1a2880',
        },
        // Mapped to CSS variables so the same class names work in both
        // light and dark mode. The variable values are defined in index.css
        // and flip when the <html> element gets/loses the `dark` class.
        surface: {
          0:   'rgb(var(--surface-0) / <alpha-value>)',
          50:  'rgb(var(--surface-50) / <alpha-value>)',
          100: 'rgb(var(--surface-100) / <alpha-value>)',
          200: 'rgb(var(--surface-200) / <alpha-value>)',
          300: 'rgb(var(--surface-300) / <alpha-value>)',
          400: 'rgb(var(--surface-400) / <alpha-value>)',
          500: 'rgb(var(--surface-500) / <alpha-value>)',
          600: 'rgb(var(--surface-600) / <alpha-value>)',
        },
      },
    },
  },
  plugins: [],
}