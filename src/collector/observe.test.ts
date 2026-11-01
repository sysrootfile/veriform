// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeNetwork, observeSubmissions, type NetworkWindow } from "./observe.js";
import { parseRequestTarget, type RequestTarget } from "./targets.js";

function form(html: string): HTMLFormElement {
  document.body.innerHTML = html;
  return document.querySelector("form")!;
}

afterEach(() => {
  document.body.innerHTML = "";
});

describe("observeSubmissions", () => {
  it("form submit'i yakalar ve hedefi (origin+path, query'siz) bildirir", () => {
    const f = form(`<form action="/kayit?dev=1" method="post"><input name="tcno"></form>`);
    const cb = vi.fn();
    const detach = observeSubmissions(document, cb);

    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(cb).toHaveBeenCalledTimes(1);
    const notice = cb.mock.calls[0]![0] as { form: HTMLFormElement; target: RequestTarget };
    expect(notice.form).toBe(f);
    expect(notice.target).toMatchObject({ origin: "http://localhost:3000", path: "/kayit" });
    expect(notice.target.via).toBe("form");
    expect(notice.target.method).toBe("POST");
    detach();
  });

  it("action'sız formda mevcut sayfa adresini hedef alır", () => {
    const f = form(`<form method="post"><input name="q"></form>`);
    const cb = vi.fn();
    const detach = observeSubmissions(document, cb);

    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    const notice = cb.mock.calls[0]![0] as { target: { origin: string } };
    expect(notice.target.origin).toBe("http://localhost:3000");
    detach();
  });

  it("detach sonrası gözlemi durdurur", () => {
    const f = form(`<form action="/a"></form>`);
    const cb = vi.fn();
    const detach = observeSubmissions(document, cb);
    detach();

    f.dispatchEvent(new Event("submit", { bubbles: true, cancelable: true }));

    expect(cb).not.toHaveBeenCalled();
  });
});

describe("observeNetwork", () => {
  const win = () => window as unknown as NetworkWindow;

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("fetch çağrısının hedefini (origin+path) bildirir ve orijinali geçirir", async () => {
    const win_ = win();
    const orig = vi.fn(async () => ({}));
    win_.fetch = orig as NonNullable<typeof win_.fetch>;
    const cb = vi.fn();
    const detach = observeNetwork(win_, cb);

    await win_.fetch!("https://api.example.com/v1/save?a=1");

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toMatchObject({
      origin: "https://api.example.com",
      path: "/v1/save",
      via: "fetch",
      method: "GET",
    });
    expect(orig).toHaveBeenCalledOnce();
    detach();
    expect(win_.fetch).toBe(orig as unknown);
  });

  it("fetch POST metodunu taşır", async () => {
    const win_ = win();
    win_.fetch = vi.fn(async () => ({})) as NonNullable<typeof win_.fetch>;
    const cb = vi.fn();
    const detach = observeNetwork(win_, cb);

    await win_.fetch!("https://api.example.com/track", { method: "POST" });

    expect(cb.mock.calls[0]![0]).toMatchObject({ path: "/track", method: "POST" });
    detach();
  });

  it("XHR open çağrısının hedefini bildirir (v0: open anında)", () => {
    const win_ = win();
    const cb = vi.fn();
    const detach = observeNetwork(win_, cb);

    const xhr = new win_.XMLHttpRequest();
    xhr.open("POST", "https://api.example.com/collect");

    expect(cb).toHaveBeenCalledTimes(1);
    expect(cb.mock.calls[0]![0]).toMatchObject({
      origin: "https://api.example.com",
      path: "/collect",
      via: "xhr",
      method: "POST",
    });
    detach();
  });

  it("detach sonrası fetch gözlemi durur ve orijinal restore edilir", async () => {
    const win_ = win();
    const orig = vi.fn(async () => ({}));
    win_.fetch = orig as NonNullable<typeof win_.fetch>;
    const cb = vi.fn();
    const detach = observeNetwork(win_, cb);
    detach();

    await win_.fetch!("https://api.example.com/x");
    expect(cb).not.toHaveBeenCalled();
    expect(orig).toHaveBeenCalledOnce();
  });

  it("GİZLİLİK: sorgu parametreli fetch hedefinde değer taşınmaz", async () => {
    const win_ = win();
    win_.fetch = vi.fn(async () => ({})) as NonNullable<typeof win_.fetch>;
    const cb = vi.fn();
    const detach = observeNetwork(win_, cb);

    await win_.fetch!("https://api.example.com/find?tcno=10000000146");

    expect(JSON.stringify(cb.mock.calls[0]![0])).not.toContain("10000000146");
    detach();
  });
});
