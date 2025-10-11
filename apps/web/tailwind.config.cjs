const defaultTheme = require('tailwindcss/defaultTheme');

module.exports = {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          savia: '#A7C7A0',
          azul: '#B3D4E0',
          escuro: '#3D6655',
          gelo: '#F8FAF9',
          grafite: '#0F172A',
        },
      },
      fontFamily: {
        montserrat: ['"Montserrat"', ...defaultTheme.fontFamily.sans],
        nunito: ['"Nunito Sans"', ...defaultTheme.fontFamily.sans],
      },
      boxShadow: {
        card: '0 20px 40px -15px rgba(15, 23, 42, 0.2)',
      },
    },
  },
  plugins: [],
};
