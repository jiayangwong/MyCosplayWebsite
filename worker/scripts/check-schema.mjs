// Compares the Cloudflare fields the Worker uses (EXPECTED_FIELDS in src/index.js) with YOUR account's real GraphQL schema,
// and prints the per-dataset limits (maxDuration, maxPageSize, notOlderThan). Read-only: it only runs introspection queries.
// Usage (from the worker/ folder):   CF_API_TOKEN=... ACCOUNT_ID=... node scripts/check-schema.mjs
// Optional: SITE_TAG=... to also test one tiny real query. Exit code 1 when something expected is missing.
import { EXPECTED_FIELDS } from '../src/index.js';

const token = process.env.CF_API_TOKEN;
const account = process.env.ACCOUNT_ID;
if (!token || !account) {
  console.error('Set CF_API_TOKEN and ACCOUNT_ID first (the same values as in the Worker). Nothing is printed about the token.');
  process.exit(2);
}

async function gql(query, variables = {}) {
  const res = await fetch('https://api.cloudflare.com/client/v4/graphql', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const body = await res.json();
  if (body.errors?.length) throw new Error(body.errors.map((e) => e.message).join('; '));
  return body.data;
}

const TYPE = `query($n: String!) { __type(name: $n) { name fields { name args { name type { ...T } } type { ...T } } inputFields { name } } }
fragment T on __Type { kind name ofType { kind name ofType { kind name ofType { kind name } } } }`;
const base = (t) => { let x = t; while (x && !x.name && x.ofType) x = x.ofType; return x?.name; };
const typeOf = async (name) => (await gql(TYPE, { n: name })).__type;

let missing = 0;
const report = (ok, text) => { if (!ok) missing += 1; console.log(`${ok ? 'OK     ' : 'MISSING'} ${text}`); };

const accountType = await typeOf('account');
if (!accountType) { console.error('Cannot read the account type (token permission "Account Analytics: Read"?).'); process.exit(2); }
for (const ds of EXPECTED_FIELDS.datasets) {
  const field = accountType.fields.find((f) => f.name === ds);
  report(!!field, `account-level dataset ${ds}`);
  if (!field) continue;
  const groupType = await typeOf(base(field.type));
  const exp = EXPECTED_FIELDS[ds];
  for (const top of exp.top) report(!!groupType.fields.find((f) => f.name === top), `${ds}.${top}`);
  for (const sub of ['sum', 'quantiles', 'dimensions']) {
    if (!exp[sub]) continue;
    const parent = groupType.fields.find((f) => f.name === sub);
    if (!parent) continue;
    const subType = await typeOf(base(parent.type));
    for (const name of exp[sub]) report(!!subType.fields.find((f) => f.name === name), `${ds}.${sub}.${name}`);
  }
  const filterArg = field.args.find((a) => a.name === 'filter');
  const filterType = filterArg ? await typeOf(base(filterArg.type)) : null;
  for (const name of EXPECTED_FIELDS.filter) report(!!filterType?.inputFields?.find((f) => f.name === name), `${ds} filter ${name}`);
}

try {
  const s = await gql(`query($a: string!) { viewer { accounts(filter: { accountTag: $a }) { settings {
    rumPageloadEventsAdaptiveGroups { enabled maxDuration maxPageSize notOlderThan }
    rumPerformanceEventsAdaptiveGroups { enabled maxDuration maxPageSize notOlderThan }
    rumWebVitalsEventsAdaptiveGroups { enabled maxDuration maxPageSize notOlderThan } } } } }`, { a: account });
  console.log('\nLimits Cloudflare reports (seconds; notOlderThan = how far back a query may read):');
  console.log(JSON.stringify(s.viewer.accounts[0]?.settings, null, 2));
} catch (e) {
  console.log(`\nCould not read the settings node (${e.message}). The Worker then uses safe defaults (7-day pieces, 180 days back).`);
}

if (process.env.SITE_TAG) {
  const hours = new Date(Date.now() - 2 * 3600000);
  const start = new Date(hours.getTime() - 24 * 3600000).toISOString().replace(/\.\d{3}Z$/, 'Z');
  const end = hours.toISOString().replace(/\.\d{3}Z$/, 'Z');
  try {
    const d = await gql(`query($a: string!, $s: string!, $start: Time!, $end: Time!) { viewer { accounts(filter: { accountTag: $a }) {
      hours: rumPageloadEventsAdaptiveGroups(filter: { siteTag: $s, datetime_geq: $start, datetime_lt: $end }, limit: 5) { count sum { visits } dimensions { datetimeHour } } } } }`,
    { a: account, s: process.env.SITE_TAG, start, end });
    report(true, `sample hourly query with your SITE_TAG returned ${d.viewer.accounts[0].hours.length} row(s) for the last day`);
  } catch (e) {
    report(false, `sample hourly query failed: ${e.message}`);
  }
}
console.log(missing ? `\n${missing} expected item(s) missing: tell the programmer, the Worker queries need a change.` : '\nEverything the Worker uses exists in your schema.');
process.exit(missing ? 1 : 0);
