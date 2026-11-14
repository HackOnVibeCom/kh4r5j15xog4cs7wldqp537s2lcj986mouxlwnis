import { describe, expect, it } from "vitest";
import { defang, extractLinks, linkPatternFlags } from "@/lib/links";

describe("extractLinks", () => {
  it("finds full and bare links and their registrable domain", () => {
    const links = extractLinks("Pay now at https://sbi-kyc-update.top/verify or visit www.example.co.uk today.");
    expect(links.map((l) => [l.hostname, l.domain])).toEqual([
      ["sbi-kyc-update.top", "sbi-kyc-update.top"],
      ["www.example.co.uk", "example.co.uk"],
    ]);
  });

  it("ignores email addresses, numbers and words with dots", () => {
    expect(extractLinks("Mail help@bank.com. Pay 1.50 now. e.g. this")).toEqual([]);
  });

  it("strips trailing punctuation and de-duplicates", () => {
    const links = extractLinks("Go to bit.ly/abc. Again: bit.ly/abc!");
    expect(links).toHaveLength(1);
    expect(links[0].url).toBe("bit.ly/abc");
  });
});

describe("linkPatternFlags", () => {
  it("flags a brand name on a domain the brand doesn't own", () => {
    const [flag] = linkPatternFlags({ hostname: "paypal-secure-login.com", domain: "paypal-secure-login.com" });
    expect(flag.strong).toBe(true);
    expect(flag.reason).toContain("PayPal");
  });

  it("does not flag the brand's real domain or a longer word containing it", () => {
    expect(linkPatternFlags({ hostname: "www.paypal.com", domain: "paypal.com" })).toEqual([]);
    expect(linkPatternFlags({ hostname: "pineapple-recipes.com", domain: "pineapple-recipes.com" })).toEqual([]);
  });

  it("marks shorteners as a weak signal and look-alike characters as strong", () => {
    expect(linkPatternFlags({ hostname: "bit.ly", domain: "bit.ly" })).toEqual([
      expect.objectContaining({ strong: false }),
    ]);
    expect(linkPatternFlags({ hostname: "xn--pypal-4ve.com", domain: "xn--pypal-4ve.com" })[0].strong).toBe(true);
  });
});

describe("defang", () => {
  it("makes links unclickable but keeps them readable", () => {
    expect(defang("Click https://usps-hold.top/track now")).toBe("Click hxxps://usps-hold[.]top/track now");
    expect(defang("Visit amazon.in")).toBe("Visit amazon[.]in");
  });

  it("leaves ordinary text alone", () => {
    expect(defang("Pay Rs. 1.50 by 9.30 pm.")).toBe("Pay Rs. 1.50 by 9.30 pm.");
  });
});
