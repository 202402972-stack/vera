import test from "node:test";
import assert from "node:assert/strict";
import { templateRegistry } from "../server/templates/registry.js";
import { validateProduct, validateSettings } from "../server/validation.js";
import { catalogue } from "../src/data/products.js";

test("FORM is a separate renderer and its merchant seed contains no demonstration inventory", () => {
  const form = templateRegistry.find((t) => t.id === "form");
  assert.ok(form, "FORM must be registered");
  assert.equal(form.renderer, "form");
  assert.equal(form.products.length, 0);
  assert.equal(
    templateRegistry.find((t) => t.id === "atelier").renderer,
    "boutique",
  );
  assert.equal(validateSettings(form.settings).form.heroPosition, 15);
});
test("product options survive validation and malformed options are rejected", () => {
  const p = structuredClone(catalogue[0]);
  p.status = "published";
  p.variants[0].attributes = { color: "Forest", size: "M" };
  assert.deepEqual(validateProduct(p).variants[0].attributes, {
    color: "Forest",
    size: "M",
  });
  p.variants[0].attributes = { color: {} };
  assert.throws(() => validateProduct(p));
});
