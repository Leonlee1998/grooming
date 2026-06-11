import type { Config } from 'tailwindcss'

const config: Config = {
  content: [
    './src/pages/**/*.{js,ts,jsx,tsx,mdx}',
    './src/components/**/*.{js,ts,jsx,tsx,mdx}',
    './src/app/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        brand: {
          50: '#fdf8f3',
          100: '#faf0e3',
          200: '#f3d9b8',
          500: '#c9824a',
          700: '#78573a',
          900: '#3b2f2a',
        },
      },
      maxWidth: {
        mobile: '480px',
      },
    },
  },
  plugins: [],
}

export default config
