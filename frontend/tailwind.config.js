export default {
  content: [
    "./index.html",
    "./src/**/*.{js,ts,jsx,tsx}",
  ],
  theme: {
    extend: {
      colors: {
        background: '#0B0A10',
        surface: '#15141D',
        primary: {
          DEFAULT: '#8B5CF6',
          hover: '#7C3AED',
        },
        text: {
          main: '#F8FAFC',
          muted: '#94A3B8'
        }
      }
    },
  },
  plugins: [],
}
