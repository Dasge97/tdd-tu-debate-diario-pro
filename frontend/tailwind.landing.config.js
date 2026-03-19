/** @type {import('tailwindcss').Config} */
export default {
  content: ["./public/landing/index.html"],
  theme: {
    extend: {
      colors: {
        cream: "#f7f2ea",
        paper: "#fffdf9",
        ink: "#16181f",
        muted: "#6d6b67",
        line: "#e7dfd2",
        accent: {
          DEFAULT: "#f07b3f",
          dark: "#dd6431",
          soft: "#fff0e7"
        }
      },
      boxShadow: {
        card: "0 10px 30px rgba(23, 26, 32, 0.07)",
        float: "0 18px 50px rgba(23, 26, 32, 0.12)"
      },
      borderRadius: {
        '2.5xl': '1.5rem'
      },
      fontFamily: {
        display: ["Inter", "system-ui", "sans-serif"],
        body: ["Inter", "system-ui", "sans-serif"]
      }
    }
  },
  plugins: []
};
