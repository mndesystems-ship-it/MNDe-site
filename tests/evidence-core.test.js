"use strict";

const test = require("node:test");
const assert = require("node:assert/strict");

// Ensure Web Crypto is available for the reference core (Node 20+ exposes it
// as a global; fall back to node:crypto.webcrypto just in case).
if (!globalThis.crypto || !globalThis.crypto.subtle) {
  globalThis.crypto = require("node:crypto").webcrypto;
}

const Core = require("../assets/js/evidence-core.js");

test("canonicalize is deterministic and key-order independent", () => {
  const a = Core.canonicalize({ b: 1, a: { y: 2, x: 1 } });
  const b = Core.canonicalize({ a: { x: 1, y: 2 }, b: 1 });
  assert.equal(a, b);
});

test("canonicalize rejects non-canonicalizable values", () => {
  assert.throws(() => Core.canonicalize({ f: () => 1 }));
  assert.throws(() => Core.canonicalize({ n: Infinity }));
});

test("a meaningful parameter mutation changes the request digest", async () => {
  const request = Core.exampleMergeRequest();
  const mutated = Core.exampleMergeRequest({ parameters: { pull_request: 4183 } });
  const d1 = await Core.digestRequest(request);
  const d2 = await Core.digestRequest(mutated);
  assert.notEqual(d1, d2);
  // An unrelated re-serialization of the same request is stable.
  assert.equal(d1, await Core.digestRequest(Core.exampleMergeRequest()));
});

test("issued grant binds the canonical digest and verifies under the authority key", async () => {
  const authority = await Core.generateKeyPair();
  const request = Core.exampleMergeRequest();
  const { grant, signature } = await Core.issueGrant(request, {
    authorityPrivateKey: authority.privateKey
  });
  assert.equal(grant.action, "merge_pull_request");
  assert.equal(grant.max_uses, 1);
  assert.match(grant.canonical_param_digest, /^sha256:[0-9a-f]{64}$/);
  const ok = await Core.verifyString(authority.publicKey, Core.canonicalize(grant), signature);
  assert.equal(ok, true);
});

test("authorization and execution receipts verify only under their own keys", async () => {
  const authority = await Core.generateKeyPair();
  const executor = await Core.generateKeyPair();
  const request = Core.exampleMergeRequest();
  const issued = await Core.issueGrant(request, { authorityPrivateKey: authority.privateKey });

  const auth = await Core.buildAuthorizationReceipt(issued.grant, issued.grantHash, {
    authorityPrivateKey: authority.privateKey
  });
  const exec = await Core.buildExecutionReceipt(
    issued.grant,
    issued.grantHash,
    auth.hash,
    { status: "merged" },
    { executorPrivateKey: executor.privateKey }
  );

  assert.equal(await Core.verifyString(authority.publicKey, Core.canonicalize(auth.receipt), auth.signature), true);
  assert.equal(await Core.verifyString(executor.publicKey, Core.canonicalize(exec.receipt), exec.signature), true);
  // Cross-key verification must fail (independent signatures).
  assert.equal(await Core.verifyString(authority.publicKey, Core.canonicalize(exec.receipt), exec.signature), false);
});

test("dual-receipt linkage holds and tampering breaks it", async () => {
  const authority = await Core.generateKeyPair();
  const executor = await Core.generateKeyPair();
  const issued = await Core.issueGrant(Core.exampleMergeRequest(), { authorityPrivateKey: authority.privateKey });
  const auth = await Core.buildAuthorizationReceipt(issued.grant, issued.grantHash, { authorityPrivateKey: authority.privateKey });
  const exec = await Core.buildExecutionReceipt(issued.grant, issued.grantHash, auth.hash, { status: "merged" }, { executorPrivateKey: executor.privateKey });

  assert.equal(Core.receiptsLinked(auth.receipt, auth.hash, exec.receipt, issued.grantHash), true);

  const tampered = JSON.parse(JSON.stringify(exec.receipt));
  tampered.grant_hash = "sha256:" + "0".repeat(64);
  assert.equal(Core.receiptsLinked(auth.receipt, auth.hash, tampered, issued.grantHash), false);
});

test("single-use ledger admits one reservation and refuses replay", () => {
  const ledger = Core.createConsumptionLedger();
  const nonce = "nonce:abc";
  assert.equal(ledger.reserve(nonce).ok, true);
  const replay = ledger.reserve(nonce);
  assert.equal(replay.ok, false);
  assert.equal(replay.reason, "REPLAY");
});

test("delegation only narrows authority", () => {
  const parent = { actions: ["merge_pull_request", "close_pull_request"], max_risk: "high" };
  assert.equal(Core.delegationAttenuates(parent, { actions: ["merge_pull_request"], max_risk: "medium" }), true);
  assert.equal(Core.delegationAttenuates(parent, { actions: ["delete_branch"], max_risk: "high" }), false);
  assert.equal(Core.delegationAttenuates(parent, { actions: ["merge_pull_request"], max_risk: "high" }), true);
});

test("revocation freshness degrades to INDETERMINATE when stale", () => {
  assert.equal(Core.revocationFresh(30, 300).verdict, "OK");
  assert.equal(Core.revocationFresh(3600, 300).verdict, "INDETERMINATE");
});
