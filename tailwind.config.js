/** @type {import('tailwindcss').Config} */
module.exports = {
  content: [
    "./src/app/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/components/**/*.{js,ts,jsx,tsx,mdx}",
    "./src/pages/**/*.{js,ts,jsx,tsx,mdx}",
  ],
  theme: {
    extend: {
      colors: {
        coal:  "#0b0b0b",  // tło strony
        onyx:  "#151515",  // powierzchnie/karty
        cream: "#f2eadf",  // jasny tekst/akcent
        gold:  {
          300: "#f1d48a",
          400: "#e7c566",
          500: "#d8b251",   // główny złoty
          600: "#c39d3d",
          700: "#a8832d",
        },
        border: "#262626",
      },
    },
  },
  plugins: [],
};