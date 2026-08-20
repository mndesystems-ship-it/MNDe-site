"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const read = (file) => fs.readFileSync(path.join(root, file), "utf8");

const siteJs = read("assets/js/site.js");
const indexHtml = read("index.html");
const contactHtml = read("contact.html");

test("primary navigation exposes the expected sections", () => {
  ["Product", "Architecture", "Evidence", "Integrations", "Security", "Roadmap", "Contact"].forEach((label) => {
    assert.ok(siteJs.includes(`label: "${label}"`), `nav should include ${label}`);
  });
});

test("index page anchors every in-page nav target", () => {
  ["product", "architecture", "evidence", "integrations", "security", "roadmap"].forEach((id) => {
    assert.match(indexHtml, new RegExp(`id="${id}"`), `index should have section #${id}`);
  });
});

test("interactive widget mount points exist", () => {
  ["architecture-widget", "lifecycle-widget", "integration-widget", "threats-widget", "lab-console", "lab-controls"].forEach((id) => {
    assert.match(indexHtml, new RegExp(`id="${id}"`), `index should mount #${id}`);
  });
});

test("primary CTA routes through the existing contact page", () => {
  assert.ok(indexHtml.includes('href="contact.html"'), "hero CTA links to contact.html");
  assert.ok(siteJs.includes("Request a technical pilot"), "header renders the pilot CTA");
});

test("the canonical contact address is consistent across the site", () => {
  const email = "contact@mndesystems.com";
  assert.ok(siteJs.includes(email), "site.js uses the contact email");
  assert.ok(contactHtml.includes(`mailto:${email}`), "contact form routes to the contact address");
  // No alternative email address appears on the contact page.
  const others = contactHtml.match(/[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi) || [];
  others.forEach((addr) => assert.equal(addr.toLowerCase(), email, `unexpected address ${addr}`));
});

test("the preserved phone number is present on the contact page", () => {
  assert.ok(contactHtml.includes("231-420-9108"), "contact page keeps the existing phone number");
});

test("evidence labeling never claims production verification in the browser lab", () => {
  const labJs = read("assets/js/evidence-lab.js");
  assert.ok(labJs.includes("production_verified: false"), "bundle marks production_verified false");
  assert.ok(!/setControl\([^)]*"PRODUCTION VERIFIED"\)/.test(labJs), "no control is set to PRODUCTION VERIFIED");
  assert.ok(labJs.includes("UNPROVEN"), "unprovable controls are labeled UNPROVEN");
});

test("the app pages contain no inline scripts, styles, or handlers", () => {
  // Scoped to the pages this project authors. The legacy privacy/terms pages
  // are pre-existing and intentionally use inline styles.
  const htmlFiles = ["index.html", "contact.html"];

  htmlFiles.forEach((file) => {
    const html = read(file);
    assert.ok(!/\sstyle="/.test(html), `${file} must not use inline style attributes`);
    assert.ok(!/\son[a-z]+="/.test(html), `${file} must not use inline event handlers`);
    // <script> tags must only reference external src, never inline code.
    const scripts = html.match(/<script\b[^>]*>([\s\S]*?)<\/script>/gi) || [];
    scripts.forEach((tag) => {
      const body = tag.replace(/<script\b[^>]*>/i, "").replace(/<\/script>/i, "").trim();
      assert.equal(body, "", `${file} must not contain inline script bodies`);
    });
  });
});
