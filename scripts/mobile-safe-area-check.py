#!/usr/bin/env python3
"""Automated + manual iPhone notch / home-indicator viewport checks.

Verifies the mobile bottom tab bar never overlaps page content in portrait
and landscape on notched iPhone viewports.

Usage:
  python3 scripts/mobile-safe-area-check.py                 # automated (headless, asserts)
  python3 scripts/mobile-safe-area-check.py --manual        # keeps screenshots for eyeballing
  BASE_URL=http://localhost:8080 python3 scripts/...        # override target

Screenshots are written to /tmp/browser/safe-area/.
"""
import asyncio
import os
import sys
from pathlib import Path

from playwright.async_api import async_playwright

BASE_URL = os.environ.get("BASE_URL", "http://localhost:8080")
OUT = Path("/tmp/browser/safe-area")
OUT.mkdir(parents=True, exist_ok=True)

# width, height, home-indicator inset (portrait) — notched/Dynamic Island iPhones
DEVICES = [
    ("iphone-x-portrait", 375, 812, 34),
    ("iphone-x-landscape", 812, 375, 21),
    ("iphone-14-pro-portrait", 393, 852, 34),
    ("iphone-14-pro-landscape", 852, 393, 21),
    ("iphone-15-pro-max-portrait", 430, 932, 34),
    ("iphone-15-pro-max-landscape", 932, 430, 21),
]

TABS = ["Home", "Simulator", "Optimizer", "Rankings", "Blog"]


async def check(page, name, inset, manual):
    failures = []

    # Simulate the iOS safe-area insets that Playwright's viewport does not provide.
    await page.add_style_tag(
        content=f"""
        :root {{ --test-sab: {inset}px; }}
        .bottom-nav-safe {{ padding-bottom: max(0.25rem, var(--test-sab)) !important; }}
        .pb-bottom-nav {{ padding-bottom: calc(3.5rem + 1.5rem + var(--test-sab)) !important; }}
        .mb-bottom-nav {{ margin-bottom: calc(3.5rem + var(--test-sab)) !important; }}
        """
    )

    nav = page.locator('nav[aria-label="Sections"]')
    if await nav.count() == 0 or not await nav.is_visible():
        return failures  # desktop layout: no bottom bar

    for tab in TABS:
        await nav.get_by_role("button", name=tab).click()
        await page.wait_for_timeout(250)
        # scroll to the very bottom, where overlap would show up
        await page.evaluate("window.scrollTo(0, document.body.scrollHeight)")
        await page.wait_for_timeout(250)

        box = await nav.bounding_box()
        metrics = await page.evaluate(
            """(navTop) => {
              const bad = [];
              const nav = document.querySelector('nav[aria-label="Sections"]');
              const nodes = document.querySelectorAll('main *, footer *');
              for (const el of nodes) {
                if (nav.contains(el)) continue;
                if (el.children.length) continue;             // leaf nodes only
                const r = el.getBoundingClientRect();
                if (r.width === 0 || r.height === 0) continue;
                if (r.top > window.innerHeight) continue;
                if (r.bottom > navTop + 1) {
                  bad.push((el.textContent || el.tagName).trim().slice(0, 40));
                }
              }
              return {
                overlapped: bad.slice(0, 5),
                hScroll: document.documentElement.scrollWidth - window.innerWidth,
                navBottom: nav.getBoundingClientRect().bottom,
                innerHeight: window.innerHeight,
              };
            }""",
            box["y"],
        )

        if metrics["overlapped"]:
            failures.append(f"{name}/{tab}: bottom bar overlaps {metrics['overlapped']}")
        if metrics["hScroll"] > 1:
            failures.append(f"{name}/{tab}: horizontal overflow {metrics['hScroll']}px")
        if abs(metrics["navBottom"] - metrics["innerHeight"]) > 1:
            failures.append(f"{name}/{tab}: bottom bar not flush with viewport bottom")

        shot = OUT / f"{name}_{tab.lower()}.png"
        await page.screenshot(path=str(shot))
        if manual:
            print(f"  screenshot: {shot}")

    return failures


async def main():
    manual = "--manual" in sys.argv
    all_failures = []
    async with async_playwright() as pw:
        browser = await pw.chromium.launch(headless=True)
        for name, w, h, inset in DEVICES:
            context = await browser.new_context(
                viewport={"width": w, "height": h},
                device_scale_factor=3,
                is_mobile=True,
                has_touch=True,
            )
            page = await context.new_page()
            await page.goto(BASE_URL, wait_until="domcontentloaded")
            await page.wait_for_timeout(600)
            print(f"checking {name} ({w}x{h}, inset {inset}px)")
            all_failures += await check(page, name, inset, manual)
            await context.close()
        await browser.close()

    if all_failures:
        print("\nFAIL")
        for f in all_failures:
            print(" -", f)
        sys.exit(1)
    print("\nPASS: bottom tab bar clears all content in portrait and landscape")


asyncio.run(main())
