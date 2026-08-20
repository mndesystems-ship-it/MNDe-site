/* MNDe Evidence Lab — core logic.
 *
 * Pure, dependency-free reference implementation of the authorization
 * evidence primitives. Loaded in the browser as a classic script
 * (attaches window.MNDeEvidenceCore) and imported by the Node test suite
 * (module.exports). Uses the Web Crypto API available in both runtimes.
 *
 * Signature profile: ECDSA P-256 with SHA-256 (ES256). This is a real,
 * universally available signature scheme — the labels the UI shows reflect
 * exactly what runs. Nothing here proves a production deployment.
 */
(function (root, factory) {
  const api = factory();
  if (typeof module !== "undefined" && module.exports) {
    module.exports = api;
  } else {
    root.MNDeEvidenceCore = api;
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  const SIG_ALG = "ECDSA-P256-SHA256 (ES256)";

  function getCrypto() {
    const c = typeof globalThis !== "undefined" ? globalThis.crypto : undefined;
    if (!c || !c.subtle) {
      throw new Error("WebCrypto SubtleCrypto API is unavailable in this environment");
    }
    return c;
  }

  function cryptoAvailable() {
    try {
      getCrypto();
      return true;
    } catch (_error) {
      return false;
    }
  }

  const encoder = new TextEncoder();

  /* ----- encoding helpers (browser + Node) ----- */

  function bufToBytes(buf) {
    return buf instanceof Uint8Array ? buf : new Uint8Array(buf);
  }

  function bufToHex(buf) {
    const bytes = bufToBytes(buf);
    let hex = "";
    for (let i = 0; i < bytes.length; i += 1) {
      hex += bytes[i].toString(16).padStart(2, "0");
    }
    return hex;
  }

  function bufToBase64(buf) {
    const bytes = bufToBytes(buf);
    if (typeof Buffer !== "undefined") {
      return Buffer.from(bytes).toString("base64");
    }
    let binary = "";
    for (let i = 0; i < bytes.length; i += 1) {
      binary += String.fromCharCode(bytes[i]);
    }
    return btoa(binary);
  }

  function base64ToBuf(b64) {
    if (typeof Buffer !== "undefined") {
      const b = Buffer.from(b64, "base64");
      return b.buffer.slice(b.byteOffset, b.byteOffset + b.byteLength);
    }
    const binary = atob(b64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i += 1) {
      bytes[i] = binary.charCodeAt(i);
    }
    return bytes.buffer;
  }

  function randomHex(byteLength) {
    const bytes = new Uint8Array(byteLength);
    getCrypto().getRandomValues(bytes);
    return bufToHex(bytes);
  }

  /* ----- canonicalization ----- */

  function sortValue(value) {
    if (Array.isArray(value)) {
      return value.map(sortValue);
    }
    if (value && typeof value === "object") {
      return Object.keys(value)
        .sort()
        .reduce((acc, key) => {
          if (value[key] !== undefined) {
            acc[key] = sortValue(value[key]);
          }
          return acc;
        }, {});
    }
    if (typeof value === "number" && !Number.isFinite(value)) {
      throw new Error("non-finite numbers are not canonicalizable");
    }
    if (typeof value === "function" || typeof value === "undefined") {
      throw new Error("value is not canonicalizable");
    }
    return value;
  }

  function canonicalize(value) {
    return JSON.stringify(sortValue(value));
  }

  async function sha256Hex(input) {
    const bytes = typeof input === "string" ? encoder.encode(input) : bufToBytes(input);
    const digest = await getCrypto().subtle.digest("SHA-256", bytes);
    return bufToHex(digest);
  }

  async function digestRequest(request) {
    return sha256Hex(canonicalize(request));
  }

  /* ----- keys / signatures ----- */

  async function generateKeyPair() {
    return getCrypto().subtle.generateKey(
      { name: "ECDSA", namedCurve: "P-256" },
      true,
      ["sign", "verify"]
    );
  }

  async function exportPublicJwk(publicKey) {
    return getCrypto().subtle.exportKey("jwk", publicKey);
  }

  async function keyId(publicKey) {
    const jwk = await exportPublicJwk(publicKey);
    const thumb = await sha256Hex(canonicalize({ crv: jwk.crv, kty: jwk.kty, x: jwk.x, y: jwk.y }));
    return `key:${thumb.slice(0, 16)}`;
  }

  async function signString(privateKey, message) {
    const signature = await getCrypto().subtle.sign(
      { name: "ECDSA", hash: "SHA-256" },
      privateKey,
      encoder.encode(message)
    );
    return bufToBase64(signature);
  }

  async function verifyString(publicKey, message, signatureB64) {
    return getCrypto().subtle.verify(
      { name: "ECDSA", hash: "SHA-256" },
      publicKey,
      base64ToBuf(signatureB64),
      encoder.encode(message)
    );
  }

  /* ----- domain objects ----- */

  function exampleMergeRequest(overrides) {
    const base = {
      action: "merge_pull_request",
      resource: "github.com/acme/payments",
      parameters: {
        repository: "acme/payments",
        pull_request: 4182,
        head_sha: "a19f4c2e77b1d0c9f3a5e8b26d41f70a9c8e5b23",
        base: "main",
        method: "squash",
        required_checks: ["ci/build", "ci/tests", "security/scan"],
        risk_ceiling: "medium"
      }
    };
    if (overrides && overrides.parameters) {
      base.parameters = Object.assign({}, base.parameters, overrides.parameters);
      delete overrides.parameters;
    }
    return Object.assign(base, overrides || {});
  }

  async function issueGrant(request, options) {
    const opts = options || {};
    const now = opts.now || Date.now();
    const ttl = opts.ttlSeconds || 120;
    const digest = await digestRequest(request);
    const issuerKeyId = opts.issuerKeyId || (opts.authorityKey ? await keyId(opts.authorityKey) : "key:authority");

    const grant = {
      grant_id: `grant:${randomHex(12)}`,
      execution_id: opts.executionId || `exec:${randomHex(12)}`,
      actor: opts.actor || "agent:payments-bot",
      principal: opts.principal || "service:release-orchestrator",
      authority: opts.authority || "delegated:release-merge",
      action: request.action,
      resource: request.resource,
      environment: opts.environment || "reference",
      canonical_param_digest: `sha256:${digest}`,
      limits: opts.limits || { max_risk: "medium", required_checks: request.parameters.required_checks },
      policy_hash: opts.policyHash || `sha256:${await sha256Hex(canonicalize(opts.policy || { policy: "release-merge@v3" }))}`,
      delegation_tip: opts.delegationTip || "delegation:release-orchestrator->payments-bot",
      issued_at: new Date(now).toISOString(),
      expires_at: new Date(now + ttl * 1000).toISOString(),
      nonce: `nonce:${randomHex(16)}`,
      max_uses: opts.maxUses || 1,
      issuer_key_id: issuerKeyId,
      sig_alg: SIG_ALG
    };

    const canonicalGrant = canonicalize(grant);
    const grantHash = await sha256Hex(canonicalGrant);
    const signature = opts.authorityPrivateKey
      ? await signString(opts.authorityPrivateKey, canonicalGrant)
      : null;

    return { grant, grantHash, signature };
  }

  async function buildAuthorizationReceipt(grant, grantHash, options) {
    const opts = options || {};
    const receipt = {
      type: "authorization",
      statement: `MNDe authorized execution ${grant.execution_id} under policy ${grant.policy_hash} using grant ${grant.grant_id}`,
      execution_id: grant.execution_id,
      grant_id: grant.grant_id,
      grant_hash: `sha256:${grantHash}`,
      policy_hash: grant.policy_hash,
      issuer_key_id: opts.issuerKeyId || grant.issuer_key_id,
      issued_at: new Date(opts.now || Date.now()).toISOString(),
      sig_alg: SIG_ALG
    };
    const canonical = canonicalize(receipt);
    const hash = await sha256Hex(canonical);
    const signature = opts.authorityPrivateKey ? await signString(opts.authorityPrivateKey, canonical) : null;
    return { receipt, hash, signature };
  }

  async function buildExecutionReceipt(grant, grantHash, authorizationReceiptHash, result, options) {
    const opts = options || {};
    const resultHash = await sha256Hex(canonicalize(result));
    const receipt = {
      type: "execution",
      statement: `Executor ${opts.executorId || "executor:protected-github"} used grant ${grant.grant_id} for execution ${grant.execution_id} and observed the recorded result`,
      execution_id: grant.execution_id,
      grant_id: grant.grant_id,
      grant_hash: `sha256:${grantHash}`,
      authorization_receipt_hash: `sha256:${authorizationReceiptHash}`,
      result_hash: `sha256:${resultHash}`,
      executor_key_id: opts.executorKeyId || "key:executor",
      observed_at: new Date(opts.now || Date.now()).toISOString(),
      sig_alg: SIG_ALG
    };
    const canonical = canonicalize(receipt);
    const hash = await sha256Hex(canonical);
    const signature = opts.executorPrivateKey ? await signString(opts.executorPrivateKey, canonical) : null;
    return { receipt, hash, signature, resultHash };
  }

  function receiptsLinked(authReceipt, authHash, execReceipt, grantHash) {
    return (
      execReceipt.execution_id === authReceipt.execution_id &&
      execReceipt.grant_hash === `sha256:${grantHash}` &&
      authReceipt.grant_hash === `sha256:${grantHash}` &&
      execReceipt.authorization_receipt_hash === `sha256:${authHash}`
    );
  }

  /* ----- single-use reference ledger ----- */

  function createConsumptionLedger() {
    const consumed = new Set();
    return {
      reserve(nonce) {
        if (consumed.has(nonce)) {
          return { ok: false, reason: "REPLAY" };
        }
        consumed.add(nonce);
        return { ok: true };
      },
      isConsumed(nonce) {
        return consumed.has(nonce);
      }
    };
  }

  /* ----- delegation attenuation (reference) ----- */

  function delegationAttenuates(parentScope, childScope) {
    // A child grant may only narrow: every child action/resource must be
    // permitted by the parent, and numeric ceilings may not increase.
    const parentActions = new Set(parentScope.actions || []);
    const childActions = childScope.actions || [];
    const actionsOk = childActions.every((action) => parentActions.has(action));
    const riskRank = { low: 1, medium: 2, high: 3 };
    const ceilingOk =
      !childScope.max_risk ||
      !parentScope.max_risk ||
      riskRank[childScope.max_risk] <= riskRank[parentScope.max_risk];
    return actionsOk && ceilingOk;
  }

  /* ----- revocation freshness (reference) ----- */

  function revocationFresh(checkpointAgeSeconds, freshnessWindowSeconds) {
    if (checkpointAgeSeconds > freshnessWindowSeconds) {
      return { fresh: false, verdict: "INDETERMINATE" };
    }
    return { fresh: true, verdict: "OK" };
  }

  return {
    SIG_ALG,
    cryptoAvailable,
    canonicalize,
    sha256Hex,
    digestRequest,
    generateKeyPair,
    exportPublicJwk,
    keyId,
    signString,
    verifyString,
    exampleMergeRequest,
    issueGrant,
    buildAuthorizationReceipt,
    buildExecutionReceipt,
    receiptsLinked,
    createConsumptionLedger,
    delegationAttenuates,
    revocationFresh
  };
});
