import { afterEach, beforeEach, expect, it, vi } from "vitest";
import {
  HandleSearch,
  parseActors,
  TYPEAHEAD_URL,
  type SearchState,
} from "./handle-search";
const response = (handle = "alice.example.com") =>
  new Response(JSON.stringify({ actors: [{ handle, displayName: "Alice" }] }));
beforeEach(() => vi.useFakeTimers());
afterEach(() => {
  vi.clearAllTimers();
  vi.useRealTimers();
});
const setup = (
  fetcher = vi.fn<typeof fetch>().mockResolvedValue(response()),
) => {
  const update = vi.fn<(state: SearchState) => void>();
  const search = new HandleSearch(update, fetcher);
  return { search, update, fetcher };
};
it("debounces input and uses the canonical WAOW endpoint without credentials", async () => {
  const { search, update, fetcher } = setup();
  search.query("ali");
  await vi.advanceTimersByTimeAsync(300);
  search.query(" @Alice ");
  await vi.advanceTimersByTimeAsync(399);
  expect(fetcher).not.toHaveBeenCalled();
  await vi.advanceTimersByTimeAsync(1);
  expect(fetcher).toHaveBeenCalledTimes(1);
  const [url, options] = fetcher.mock.calls[0];
  expect(String(url)).toBe(`${TYPEAHEAD_URL}?q=alice&limit=5`);
  expect(options).toMatchObject({
    credentials: "omit",
    referrerPolicy: "no-referrer",
    headers: { "X-Client": "crazy-roomba" },
  });
  expect(update).toHaveBeenLastCalledWith({
    actors: [
      { handle: "alice.example.com", displayName: "Alice", avatar: null },
    ],
    status: "ready",
  });
  search.dispose();
});
it("does not search empty, one-character, DID or provider URL input", async () => {
  const { search, fetcher } = setup();
  for (const q of [
    "",
    "@a",
    "did:plc:abc",
    "https://pds.example.com",
    "a".repeat(101),
  ]) {
    search.query(q);
    await vi.advanceTimersByTimeAsync(500);
  }
  expect(fetcher).not.toHaveBeenCalled();
  search.dispose();
});
it("encodes the query as a parameter rather than another URL or parameter", async () => {
  const { search, fetcher } = setup();
  search.query("alice & bob");
  await vi.advanceTimersByTimeAsync(400);
  const url = new URL(String(fetcher.mock.calls[0][0]));
  expect(url.origin).toBe("https://typeahead.waow.tech");
  expect(url.searchParams.get("q")).toBe("alice & bob");
  expect([...url.searchParams.keys()]).toEqual(["q", "limit"]);
  search.dispose();
});
it("ignores an old response even when its fetch implementation ignores abort", async () => {
  let old!: (r: Response) => void;
  const fetcher = vi
    .fn<typeof fetch>()
    .mockImplementationOnce(
      () =>
        new Promise((r) => {
          old = r;
        }),
    )
    .mockResolvedValueOnce(response("bob.example.com"));
  const { search, update } = setup(fetcher);
  search.query("ali");
  await vi.advanceTimersByTimeAsync(400);
  const signal = fetcher.mock.calls[0][1]!.signal!;
  search.query("bob");
  expect(signal.aborted).toBe(true);
  await vi.advanceTimersByTimeAsync(400);
  old(response());
  await vi.advanceTimersByTimeAsync(0);
  expect(update).toHaveBeenLastCalledWith({
    actors: [{ handle: "bob.example.com", displayName: "Alice", avatar: null }],
    status: "ready",
  });
  search.dispose();
});
it("caches repeated searches for one minute", async () => {
  const { search, fetcher } = setup(
    vi.fn<typeof fetch>().mockImplementation(async () => response()),
  );
  search.query("alice");
  await vi.advanceTimersByTimeAsync(400);
  search.query("@ALICE");
  await vi.advanceTimersByTimeAsync(400);
  expect(fetcher).toHaveBeenCalledTimes(1);
  await vi.advanceTimersByTimeAsync(60000);
  search.query("alice");
  await vi.advanceTimersByTimeAsync(400);
  expect(fetcher).toHaveBeenCalledTimes(2);
  search.dispose();
});
it.each([429, 500])(
  "makes HTTP %s a recoverable suggestions failure",
  async (status) => {
    const { search, update, fetcher } = setup(
      vi.fn<typeof fetch>().mockResolvedValue(new Response("", { status })),
    );
    search.query("alice");
    await vi.advanceTimersByTimeAsync(400);
    expect(update).toHaveBeenLastCalledWith({
      actors: [],
      status: "unavailable",
    });
    expect(fetcher).toHaveBeenCalledTimes(1); // No Bluesky fallback or retry loop.
    search.dispose();
  },
);
it("cancels a pending debounce and suppresses completion after the dialog is closed", async () => {
  const first = setup();
  first.search.query("alice");
  first.search.dispose();
  await vi.advanceTimersByTimeAsync(500);
  expect(first.fetcher).not.toHaveBeenCalled();
  let resolve!: (r: Response) => void;
  const second = setup(
    vi.fn<typeof fetch>().mockImplementation(
      () =>
        new Promise((r) => {
          resolve = r;
        }),
    ),
  );
  second.search.query("alice");
  await vi.advanceTimersByTimeAsync(400);
  second.search.dispose();
  const calls = second.update.mock.calls.length;
  resolve(response());
  await vi.advanceTimersByTimeAsync(0);
  expect(second.update).toHaveBeenCalledTimes(calls);
});
it("times out hung searches", async () => {
  const fetcher = vi.fn<typeof fetch>().mockImplementation(
    (_url, options) =>
      new Promise((_resolve, reject) => {
        options!.signal!.addEventListener("abort", () =>
          reject(new Error("aborted")),
        );
      }),
  );
  const { search, update } = setup(fetcher);
  search.query("alice");
  await vi.advanceTimersByTimeAsync(5400);
  expect(update).toHaveBeenLastCalledWith({
    actors: [],
    status: "unavailable",
  });
  search.dispose();
});
it("filters invalid and duplicate handles while treating names as plain text", () => {
  expect(
    parseActors({
      actors: [
        { handle: "javascript:alert(1)" },
        { handle: "handle.invalid" },
        { handle: "-alice.example.com" },
        { handle: "alice.example.com", displayName: "<img onerror=alert(1)>" },
        { handle: "ALICE.EXAMPLE.COM" },
        { handle: "self.hosted.example" },
      ],
    }),
  ).toEqual([
    {
      handle: "alice.example.com",
      displayName: "<img onerror=alert(1)>",
      avatar: null,
    },
    { handle: "self.hosted.example", displayName: "", avatar: null },
  ]);
  expect(() => parseActors({ error: "Oops" })).toThrow();
  expect(parseActors({ actors: [] })).toEqual([]);
});

it("preserves the browser receiver when using the default fetch", async () => {
  const native = vi.spyOn(globalThis, "fetch").mockImplementation(function (
    this: unknown,
  ) {
    expect(this).toBe(globalThis);
    return Promise.resolve(response());
  });
  const update = vi.fn<(state: SearchState) => void>();
  const search = new HandleSearch(update);
  try {
    search.query("alice");
    await vi.advanceTimersByTimeAsync(400);
    expect(update).toHaveBeenLastCalledWith({
      actors: [
        { handle: "alice.example.com", displayName: "Alice", avatar: null },
      ],
      status: "ready",
    });
  } finally {
    search.dispose();
    native.mockRestore();
  }
});

it("keeps HTTPS profile pictures and preserves accounts with missing or unsafe avatar URLs", () => {
  const avatar =
    "https://cdn.bsky.app/img/avatar/plain/did:plc:alice/photo@jpeg";
  expect(
    parseActors({ actors: [{ handle: "alice.example.com", avatar }] })[0]
      .avatar,
  ).toBe(avatar);
  for (const invalid of [
    undefined,
    null,
    {},
    "",
    "/avatar.jpg",
    "http://example.com/a.jpg",
    "javascript:alert(1)",
    "data:image/svg+xml,<svg/>",
    "https://",
    "https://user:secret@example.com/a.jpg",
    `https://example.com/${"a".repeat(2048)}`,
  ]) {
    expect(
      parseActors({
        actors: [{ handle: "alice.example.com", avatar: invalid }],
      }),
    ).toEqual([{ handle: "alice.example.com", displayName: "", avatar: null }]);
  }
});
