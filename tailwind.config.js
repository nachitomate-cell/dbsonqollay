/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Marca Sonqollay (extraída del logo): naranja + gris pizarra (steel).
        brand: {
          50: '#FFF3E9',
          100: '#FFE2C7',
          200: '#FFC79A',
          300: '#FBA869',
          400: '#F78A38',
          500: '#F77000', // naranja del logo
          600: '#D65F00',
          700: '#A84A00',
          800: '#7C3700',
          900: '#5A2800',
          DEFAULT: '#F77000',
        },
        steel: {
          400: '#8A97A3',
          500: '#6B7886',
          600: '#586878', // gris del logo
          700: '#485868',
          800: '#38454F',
          900: '#2A343C',
        },
        // Superficies oscuras (dark mode), tono azul-grisáceo coherente con steel.
        ink: {
          900: '#0c1116',
          800: '#121922',
          700: '#1a232e',
          600: '#22303d',
          500: '#2c3c4c',
        },
        // En dark mode el acento interactivo es el naranja de marca.
        accent: {
          DEFAULT: '#F77000',
          400: '#F78A38',
          500: '#F77000',
          600: '#D65F00',
          glow: '#F77000',
        },
      },
      boxShadow: {
        glow: '0 0 0 1px rgba(247,112,0,0.25), 0 8px 30px -12px rgba(247,112,0,0.35)',
        card: '0 10px 40px -20px rgba(0,0,0,0.7)',
      },
      fontFamily: {
        sans: ['Inter', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
    },
  },
  plugins: [],
}
