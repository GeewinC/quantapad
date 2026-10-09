import { describe, it, expect } from "vitest";
import { splitTax } from "@/lib/tokens";

describe("tax split", () => {
  it("protocol takes 10% and the rest follows the 4-way split", () => {
    const r = splitTax(100, { creator: 40, burn: 20, dividends: 30, liquidity: 10 });
    expect(r.protocol).toBe(10);
    expect(r.creator).toBe(36);
    expect(r.burn).toBe(18);
    expect(r.dividends).toBe(27);
    expect(r.liquidity).toBe(9);
  });
});
