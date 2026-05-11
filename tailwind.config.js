/** @type {import('tailwindcss').Config} */
export default {
  content: [
    './index.html',
    './src/**/*.{js,jsx,ts,tsx}',
  ],
  theme: {
    extend: {
      fontFamily: {
        'dm-sans': ['"DM Sans"', 'sans-serif'],
      },
      colors: {
        page:          '#faf8f4',
        card:          '#ffffff',
        surface:       '#f1efe8',
        'input-border':'#e0ddd8',
        navy: {
          DEFAULT: '#3d6494',
          hover:   '#335580',
        },
        success: {
          DEFAULT: '#2a9d6e',
          light:   '#E1F5EE',
          text:    '#0F6E56',
        },
        amber: {
          DEFAULT: '#c47d1a',
          light:   '#FAEEDA',
          dark:    '#7a4f0d',
        },
        coral: {
          light: '#FAECE7',
          text:  '#993C1D',
        },
        info: {
          light: '#E6F1FB',
          text:  '#185FA5',
        },
        content: {
          primary:   '#1a1a1a',
          secondary: '#6b6b6b',
          hint:      '#9a9a9a',
        },
      },
      borderRadius: {
        card:   '12px',
        button: '10px',
        pill:   '20px',
        input:  '8px',
      },
      fontSize: {
        '11': ['11px', { lineHeight: '1.4' }],
        '12': ['12px', { lineHeight: '1.4' }],
        '13': ['13px', { lineHeight: '1.5' }],
        '14': ['14px', { lineHeight: '1.5' }],
        '15': ['15px', { lineHeight: '1.5' }],
        '16': ['16px', { lineHeight: '1.5' }],
        '17': ['17px', { lineHeight: '1.4' }],
        '18': ['18px', { lineHeight: '1.3' }],
      },
    },
  },
  plugins: [],
}
