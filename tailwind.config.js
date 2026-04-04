const matchdbPreset = require("matchdb-component-library/tailwind.preset");

/** @type {import('tailwindcss').Config} */
module.exports = {
  presets: [matchdbPreset],
  content: [
    "./src/**/*.{ts,tsx}",
    "./public/**/*.html",
    "../matchingdb-component-library/src/**/*.{ts,tsx}",
  ],
  important: "#root",
};
