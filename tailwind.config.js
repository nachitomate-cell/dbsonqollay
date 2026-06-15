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
        // Superficies "Premium Dark": negros profundos (menor fatiga visual en
        // jornadas largas), con tono azul-grisáceo coherente con steel.
        ink: {
          900: '#05080c', // fondo de página (casi negro)
          800: '#0a0f15', // paneles / tarjetas
          700: '#111823', // superficies elevadas (encabezados, pestaña activa)
          600: '#18212e',
          500: '#222d3c',
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
      keyframes: {
        // Caída tipo "gravedad": el panel se desploma y rota un poco al cerrar.
        fall: {
          '0%': { transform: 'translateY(0) rotate(0deg)', opacity: '1' },
          '100%': { transform: 'translateY(115vh) rotate(6deg)', opacity: '0' },
        },
      },
      animation: {
        fall: 'fall 0.45s cubic-bezier(0.55, 0, 1, 0.45) forwards',
      },
    },
  },
  plugins: [],
}
