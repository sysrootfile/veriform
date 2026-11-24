import { describe, expect, it } from "vitest";
import { isOperator } from "./operator.js";

describe("isOperator — env listesiyle yetki", () => {
  it("OPERATOR_EMAILS tanımsız/boşsa kimse operatör değildir", () => {
    expect(isOperator("a@x.com", undefined)).toBe(false);
    expect(isOperator("a@x.com", "")).toBe(false);
    expect(isOperator("a@x.com", "  ,  ")).toBe(false);
  });

  it("virgülle ayrılmış listede eşleşme kırpılır ve büyük/küçük harf duyarsızdır", () => {
    expect(isOperator("a@x.com", "a@x.com,b@y.com")).toBe(true);
    expect(isOperator("B@Y.COM", " a@x.com , b@y.com ")).toBe(true);
  });

  it("listedeki olmayan e-posta operatör değildir", () => {
    expect(isOperator("c@x.com", "a@x.com,b@y.com")).toBe(false);
    expect(isOperator("", "a@x.com")).toBe(false);
  });
});