/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Premium Dark palette
        ink: {
          900: '#0a0f1a',
          800: '#0d1424',
          700: '#111a2e',
          600: '#16203a',
          500: '#1d2a47',
        },
        // Electric / neon accent
        accent: {
          DEFAULT: '#22d3ee',
          400: '#38bdf8',
          500: '#0ea5e9',
          600: '#0284c7',
          glow: '#22d3ee',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(34,211,238,0.25), 0 8px 30px -12px rgba(34,211,238,0.35)',
        card: '0 10px 40px -20px rgba(0,0,0,0.7)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
