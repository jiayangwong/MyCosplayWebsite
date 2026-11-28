// Site-wide settings. Edit this file to change the name, handle, social links and contact email.
// Values marked PLACEHOLDER are still waiting for the real ones from Puzz.

export const SITE = {
  name: 'Puzz Kezz',
  wordmark: 'PUZZ KEZZ',
  handle: '@notpuzzkezz',
  tagline: 'Not a beatboxer. Just here to cosplay.',
  subtitle: 'COSPLAYER · LOLITA · MALAYSIA',
  email: 'hello@example.com', // PLACEHOLDER: real contact email not provided yet
  emailIsPlaceholder: true,
  instagram: 'https://www.instagram.com/notpuzzkezz/',
  socials: [
    { label: 'Instagram', url: 'https://www.instagram.com/notpuzzkezz/' },
    { label: 'Facebook', url: 'https://www.facebook.com/felix.jiang.376' },
  ],
  watermark: '@notpuzzkezz', // default text of the lattice watermark (admin uploader)
  // Cloudflare Web Analytics (TASK-30). Neither value is a secret (the beacon token is visible in every page's HTML).
  // siteHost must equal the hostname in CNAME. beaconToken: paste the token from Cloudflare -> Web Analytics -> your
  // site -> JS snippet (see worker/README.md). Set 2026-11-27. If it is emptied the beacon is never added.
  analytics: {
    siteHost: 'puzzkezz-testing.loc.cc',
    beaconToken: '224e53960a554b6f9fb635c47f914f2d', // Cloudflare Web Analytics beacon token (public, not a secret)
  },
};
