/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  // Hide the dev-only on-screen route indicator (bottom-left badge).
  // Build/runtime errors are still surfaced. Removed keys (buildActivity etc.)
  // no longer exist in Next 16 — `false` is the supported switch.
  devIndicators: false,
};

export default nextConfig;