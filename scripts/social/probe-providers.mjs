// Read-only, small-sample comparison. No account tokens, graph crawls, or score writes.
// node scripts/social/probe-providers.mjs > /tmp/roomba-graph-probe.json
const actor = "did:plc:z72i7hdynmk6r22z27h6tvur";
const peers = [
  "did:plc:ewvi7nxzyoun6zhxrhs64oiz",
  "did:plc:ragtjsm2j2vknwkz3zp4oxrd",
];
const userAgent =
  "CrazyRoomba/2.9 graph-provider-evaluation (+https://crazy-roomba-v2.austin-855.workers.dev/)";
const findings = [];
function endpoint(base, method, params) {
  const url = new URL(`/xrpc/${method}`, base);
  for (const [key, value] of Object.entries(params))
    for (const item of Array.isArray(value) ? value : [value])
      url.searchParams.append(key, item);
  return url;
}
async function check(name, url) {
  const start = performance.now();
  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json", "User-Agent": userAgent },
      signal: AbortSignal.timeout(12000),
      redirect: "manual",
    });
    const raw = await response.text();
    let data;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { unexpectedContent: raw.slice(0, 120) };
    }
    findings.push({
      name,
      url: String(url),
      status: response.status,
      elapsedMs: Math.round(performance.now() - start),
      data,
    });
    return response.ok ? data : null;
  } catch (error) {
    findings.push({
      name,
      url: String(url),
      elapsedMs: Math.round(performance.now() - start),
      error: error.message,
    });
    return null;
  }
}
const appviews = [
  "https://public.api.bsky.app",
  "https://api.blacksky.community",
];
const boards = await Promise.all(
  appviews.map((base) =>
    check(
      new URL(base).hostname,
      endpoint(base, "app.bsky.graph.getRelationships", {
        actor,
        others: peers,
      }),
    ),
  ),
);
// Check both directions, so an absent followedBy can be distinguished from a response asymmetry.
for (const peer of peers)
  await check(
    `blacksky-reverse:${peer}`,
    endpoint(appviews[1], "app.bsky.graph.getRelationships", {
      actor: peer,
      others: actor,
    }),
  );
await check(
  "constellation-incoming",
  endpoint(
    "https://constellation.microcosm.blue",
    "blue.microcosm.links.getBacklinks",
    {
      subject: actor,
      source: "app.bsky.graph.follow:subject",
      did: peers,
      limit: "10",
    },
  ),
);
for (const peer of peers)
  await check(
    `constellation-outgoing:${peer}`,
    endpoint(
      "https://constellation.microcosm.blue",
      "blue.microcosm.links.getBacklinks",
      {
        subject: peer,
        source: "app.bsky.graph.follow:subject",
        did: actor,
        limit: "10",
      },
    ),
  );
const docs = new Map();
async function pds(did) {
  if (!docs.has(did)) {
    const document = await check(
      `did-document:${did}`,
      `https://plc.directory/${did}`,
    );
    const host =
      document?.id === did
        ? document.service?.find((s) => s.type === "AtprotoPersonalDataServer")
            ?.serviceEndpoint
        : null;
    if (!host || !/^https:\/\/[a-z0-9.-]+\/?$/i.test(host))
      throw new Error("Unexpected PDS endpoint");
    docs.set(did, host);
  }
  return docs.get(did);
}
for (const relation of boards[0]?.relationships || []) {
  for (const direction of ["following", "followedBy"]) {
    const uri = relation[direction];
    if (typeof uri !== "string") continue;
    const match =
      /^at:\/\/(did:plc:[a-z2-7]{24})\/(app\.bsky\.graph\.follow)\/([a-z0-9]+)$/.exec(
        uri,
      );
    if (!match || ![actor, ...peers].includes(match[1]))
      throw new Error("Unexpected record reference");
    const [, repo, collection, rkey] = match;
    const host = await pds(repo);
    await Promise.all([
      check(
        `pds:${repo}:${rkey}`,
        endpoint(host, "com.atproto.repo.getRecord", {
          repo,
          collection,
          rkey,
        }),
      ),
      check(
        `slingshot:${repo}:${rkey}`,
        endpoint(
          "https://slingshot.microcosm.blue",
          "com.atproto.repo.getRecord",
          { repo, collection, rkey },
        ),
      ),
    ]);
  }
}
const host = await pds(actor);
await check(
  "pds-listRecords-sample",
  endpoint(host, "com.atproto.repo.listRecords", {
    repo: actor,
    collection: "app.bsky.graph.follow",
    limit: "2",
  }),
);
await check(
  "slingshot-listRecords-capability",
  endpoint("https://slingshot.microcosm.blue", "com.atproto.repo.listRecords", {
    repo: actor,
    collection: "app.bsky.graph.follow",
    limit: "2",
  }),
);
console.log(
  JSON.stringify(
    {
      observedAt: new Date().toISOString(),
      note: "Two public-account pairs. Diagnostic spot check, not a coverage or latency benchmark. Absence in an index is not proof of no relationship.",
      actor,
      peers,
      findings,
    },
    null,
    2,
  ),
);
