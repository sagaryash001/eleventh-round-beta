/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{ts,tsx}'],
  theme: {
    extend: {
      colors: {
        black:    '#080808',
        'near-black': '#0c0c0d',
        charcoal: '#141416',
        'charcoal-2': '#1a1a1d',
        'charcoal-3': '#222226',
        blood:    '#8b0000',
        'blood-bright': '#a80000',
        'blood-glow':   '#c00000',
        crimson:        '#C41E3A',
        'off-white': '#f0ece4',
        'gray-1': '#b8b4ae',
        'gray-2': '#7a7672',
        'gray-3': '#4a4846',
        gold:     '#c9a84c',
      },
      fontFamily: {
        display:    ['"Bebas Neue"', 'sans-serif'],
        condensed:  ['"Barlow Condensed"', 'sans-serif'],
        body:       ['"Barlow"', 'sans-serif'],
        narrow:     ['"Archivo Narrow"', 'sans-serif'],
        hud:        ['"Share Tech Mono"', 'ui-monospace', 'monospace'],
      },
    },
  },
  plugins: [],
}
