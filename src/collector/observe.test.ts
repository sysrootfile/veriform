// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from "vitest";
import { observeSubmissions } from "./observe.js";
import { parseRequestTarget } from "./targets.js";

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
    const notice = cb.mock.calls[0]![0] as { form: HTMLFormElement; target: ReturnType<typeof parseRequestTarget> };
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
