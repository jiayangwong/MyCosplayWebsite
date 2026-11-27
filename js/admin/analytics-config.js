// Where the admin Analytics panel reads its numbers from (the Cloudflare Worker in worker/, TASK-31).
// This file holds no secret: the passcode lives only in the browser's localStorage (analytics-client.js).
// workerUrl = the Worker's https:// origin, no path and no trailing slash, for example
// 'https://puzzkezz-stats.your-name.workers.dev'. Empty = "Not set up": the panel says so and sends no request.
// When you fill it in, add the SAME origin to connect-src in the Content-Security-Policy meta tag of
// admin/index.html (a test checks that the two agree). This is the only place the Worker URL is written.
export const ANALYTICS = Object.freeze({
  workerUrl: 'https://puzzkezz-analytics.jiayang-wong1999.workers.dev',
});
