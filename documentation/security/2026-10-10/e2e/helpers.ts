import { Page, expect } from "@playwright/test";

// ─────────────────────────────────────────────
// Shared E2E helpers
// ─────────────────────────────────────────────

export interface ConsoleCollector {
  errors: string[];
  warnings: string[];
}

/**
 * Attach console/pageerror listeners. Call BEFORE page.goto().
 * Filters low-signal noise (favicon, analytics) so genuine JS errors surface.
 */
export function collectConsole(page: Page): ConsoleCollector {
  const errors: string[] = [];
  const warnings: string[] = [];

  page.on("console", (msg) => {
    const text = msg.text();
    if (msg.type() === "error") {
      // Known external noise:
      //  - favicon / self-hosted analytics
      //  - Cloudflare Web Analytics auto-injects beacon.min.js which the CSP
      //    does not allow; see SECURITY_REMEDIATION_REPORT finding F-5.
      if (
        text.includes("favicon") ||
        text.includes("analytics.knowyourgov") ||
        text.includes("cloudflareinsights")
      )
        return;
      errors.push(text);
    } else if (msg.type() === "warning") {
      warnings.push(text);
    }
  });
  page.on("pageerror", (err) => {
    errors.push(`pageerror: ${err.message}`);
  });

  return { errors, warnings };
}

/**
 * Navigate and assert the document response status. Returns the response.
 * Uses `waitUntil: "domcontentloaded"` for speed; readiness is asserted via
 * meaningful page assertions rather than arbitrary sleeps.
 */
export async function gotoAndCheck(
  page: Page,
  path: string,
  expectedStatus = 200
) {
  const resp = await page.goto(path, { waitUntil: "domcontentloaded" });
  expect(resp, `no response for ${path}`).not.toBeNull();
  expect(resp!.status(), `unexpected status for ${path}`).toBe(expectedStatus);
  return resp!;
}

/** Assert no element causes horizontal document overflow (mobile responsiveness). */
export async function expectNoHorizontalOverflow(page: Page) {
  const overflow = await page.evaluate(() => {
    const doc = document.documentElement;
    return doc.scrollWidth - doc.clientWidth;
  });
  // Allow a small tolerance for sub-pixel rounding / scrollbars.
  expect(overflow, "document has horizontal overflow").toBeLessThanOrEqual(2);
}

/** Assert every <img> either loaded or was intentionally lazily deferred. */
export async function expectNoBrokenImages(page: Page) {
  const broken = await page.evaluate(() =>
    Array.from(document.images)
      .filter((img) => img.complete && img.naturalWidth === 0)
      .map((img) => img.currentSrc || img.src)
  );
  expect(broken, `broken images: ${broken.join(", ")}`).toEqual([]);
}
