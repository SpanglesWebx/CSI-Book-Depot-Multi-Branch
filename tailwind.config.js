export default {
  content: [
    "./index.html",
    "./src/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      colors: {
        dasher: "#00A76F",
        dasherHover: "#05B782",
      },

      keyframes: {
        slideUp: {
          "0%": {
            transform: "translateY(10px)",
            opacity: "0",
          },
          "100%": {
            transform: "translateY(0)",
            opacity: "1",
          },
        },
      },

      animation: {
        slideUp: "slideUp 0.2s ease-out",
      },
    },
  },
  plugins: [],
};