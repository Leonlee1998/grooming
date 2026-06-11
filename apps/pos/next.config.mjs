import { createRequire } from 'module'

const require = createRequire(import.meta.url)
const withPWA = require('next-pwa')({
  dest: 'public',
  disable: process.env.NODE_ENV === 'development',
  register: true,
  skipWaiting: true,
})

/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@repo/contract', '@repo/db', '@repo/line-bot'],
}

export default withPWA(nextConfig)
