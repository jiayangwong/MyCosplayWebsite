// Where "Publish to GitHub" writes. This file holds no secret: the token lives only in the
// browser's localStorage (see github-token.js), never in the repo.
export const GITHUB = Object.freeze({
  owner: 'jiayangwong',
  repo: 'MyCosplayWebsite',
  branch: 'site-v1', // Must match the branch GitHub Pages serves (the repo's default branch).
  apiBase: 'https://api.github.com',
});

/** REST API version sent with every request (X-GitHub-Api-Version). */
export const GITHUB_API_VERSION = '2022-11-28';
