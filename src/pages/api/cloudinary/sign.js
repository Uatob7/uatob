// POST /api/cloudinary/sign
//
// Returns a short-lived signature the browser uses to upload a driver document
// straight to Cloudinary — WITHOUT ever exposing the Cloudinary API secret to
// the client. The client sends { folder }, we sign { folder, timestamp } with
// the secret and hand back { cloudName, apiKey, timestamp, folder, signature }.
//
// Cloudinary's signature = sha1( "<k1=v1&k2=v2…>" + api_secret ), where the
// signed params are alphabetically sorted and EXCLUDE file, api_key,
// resource_type and cloud_name. We only sign folder + timestamp, so the client
// must send exactly those (plus the unsigned file/api_key/signature).
//
// Env: CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.

import crypto from 'crypto';

const CLOUD_NAME = process.env.CLOUDINARY_CLOUD_NAME || process.env.NEXT_PUBLIC_CLOUDINARY_CLOUD_NAME;
const API_KEY    = process.env.CLOUDINARY_API_KEY;
const API_SECRET = process.env.CLOUDINARY_API_SECRET;

// Keep uploads inside a known UaTob tree no matter what the client asks for.
function safeFolder(input) {
  const raw = String(input || '').replace(/^\/+|\/+$/g, '');
  const clean = raw.replace(/[^a-zA-Z0-9/_-]/g, '');       // strip anything odd
  if (!clean || !/^(drivers|riders)\//.test(clean)) return 'uploads/misc';
  return clean;
}

export default async function handler(req, res) {
  if (req.method !== 'POST') return res.status(405).json({ error: 'method not allowed' });
  if (!CLOUD_NAME || !API_KEY || !API_SECRET) {
    return res.status(500).json({ error: 'Cloudinary is not configured' });
  }

  const folder    = safeFolder(req.body?.folder);
  const timestamp = Math.floor(Date.now() / 1000);

  const toSign = { folder, timestamp };
  const signStr = Object.keys(toSign).sort().map((k) => `${k}=${toSign[k]}`).join('&');
  const signature = crypto.createHash('sha1').update(signStr + API_SECRET).digest('hex');

  return res.status(200).json({ cloudName: CLOUD_NAME, apiKey: API_KEY, timestamp, folder, signature });
}
