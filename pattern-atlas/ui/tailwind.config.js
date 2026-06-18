export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'media',
  theme: {
    extend: {
      fontFamily: {
        sans: ['Inter', 'system-ui', 'sans-serif'],
      },
      colors: {
        atlas: {
          bg:           '#F9F7F4',
          'bg-dark':    '#1E1C1A',
          surface:      '#FFFFFF',
          'surface-dk': '#2A2825',
          accent:       '#5B7FA8',
          'accent-dk':  '#7BA3C8',
          success:      '#5E8C6A',
          locked:       '#B8B3AD',
          text:         '#2C2C2A',
          'text-dk':    '#E8E4DE',
          muted:        '#8A8580',
          border:       '#E4E0DA',
          'border-dk':  '#3A3835',
        },
      },
      maxWidth: {
        content: '720px',
      },
    },
  },
  plugins: [],
}
