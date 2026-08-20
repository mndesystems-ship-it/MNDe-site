/* MNDe Evidence Lab — browser controller.
 * Wires the repository-owned reference core (evidence-core.js) to the UI.
 * Runs real ECDSA P-256 / SHA-256 operations locally in the browser.
 * All results are labeled as browser reference evidence, never production. */

(function () {
  "use strict";

  const Core = window.MNDeEvidenceCore;
  const root = document.getElementById("lab");
  if (!Core || !root) return;

  const consoleEl = document.getElementById("lab-console");
  const controlsEl = document.getElementById("lab-controls");
  const runBtn = document.getElementById("lab-run");
  const mutateBtn = document.getElementById("lab-mutate");
  const exportBtn = document.getElementById("lab-export");
  const clearBtn = document.getElementById("lab-clear");

  const CONTROLS = [
    ["Canonical scope-mutation detection", "CRYPTOGRAPHIC PASS"],
    ["Independent authority and executor signatures", "CRYPTOGRAPHIC PASS"],
    ["Dual-receipt linkage", "CRYPTOGRAPHIC PASS"],
    ["Single-use reference consumption", "REFERENCE PASS"],
    ["Delegation attenuation", "REFERENCE PASS"],
    ["Revocation-freshness behavior", "REFERENCE PASS"],
    ["Provider non-bypassability", "UNPROVEN"],
    ["Witness split-view detection", "UNPROVEN"]
  ];

  let lastBundle = null;

  function renderControls() {
    controlsEl.innerHTML = "";
    CONTROLS.forEach((control, index) => {
      const row = document.createElement("div");
      row.className = "control-row";
      row.setAttribute("data-control", String(index + 1));

      const num = document.createElement("span");
      num.className = "control-num";
      num.textContent = String(index + 1).padStart(2, "0");

      const name = document.createElement("span");
      name.className = "control-name";
      name.textContent = control[0];

      const tag = document.createElement("span");
      tag.className = "result-tag";
      tag.setAttribute("data-result", "PENDING");
      tag.textContent = "PENDING";

      row.appendChild(num);
      row.appendChild(name);
      row.appendChild(tag);
      controlsEl.appendChild(row);
    });
  }

  function setControl(index, result) {
    const tag = controlsEl.querySelector(`[data-control="${index + 1}"] .result-tag`);
    if (tag) {
      tag.setAttribute("data-result", result);
      tag.textContent = result;
    }
  }

  function resetControls() {
    CONTROLS.forEach((control, index) => setControl(index, "PENDING"));
  }

  function log(text, cls) {
    const line = document.createElement("div");
    if (cls) line.className = cls;
    line.textContent = text;
    consoleEl.appendChild(line);
    consoleEl.scrollTop = consoleEl.scrollHeight;
  }

  function clearConsole() {
    consoleEl.innerHTML = "";
  }

  async function run(withMutation) {
    if (!Core.cryptoAvailable()) {
      clearConsole();
      log("WebCrypto SubtleCrypto is unavailable in this browser.", "no");
      log("Evidence classification for this run: INDETERMINATE.", "warn");
      CONTROLS.forEach((control, index) => setControl(index, "INDETERMINATE"));
      exportBtn.disabled = true;
      return;
    }

    setBusy(true);
    clearConsole();
    resetControls();

    try {
      log("MNDe Evidence Lab — browser reference run", "accent");
      log(`Signature profile: ${Core.SIG_ALG}`, "dim");
      log("Generating ephemeral authority and executor keys...", "dim");
      const authority = await Core.generateKeyPair();
      const executor = await Core.generateKeyPair();
      const authorityKid = await Core.keyId(authority.publicKey);
      const executorKid = await Core.keyId(executor.publicKey);
      log(`  authority key: ${authorityKid}`, "dim");
      log(`  executor  key: ${executorKid}`, "dim");

      const request = Core.exampleMergeRequest();
      const digest = await Core.digestRequest(request);
      log("");
      log("Canonical action request:", "accent");
      log(`  ${Core.canonicalize(request)}`);
      log(`  digest sha256:${digest}`, "dim");

      const issued = await Core.issueGrant(request, {
        authorityPrivateKey: authority.privateKey,
        issuerKeyId: authorityKid,
        now: Date.now()
      });
      log("");
      log(`Grant issued: ${issued.grant.grant_id}`, "ok");
      log(`  nonce ${issued.grant.nonce}, max_uses ${issued.grant.max_uses}, expires ${issued.grant.expires_at}`, "dim");
      const grantSigOk = await Core.verifyString(
        authority.publicKey,
        Core.canonicalize(issued.grant),
        issued.signature
      );
      log(`  grant signature verifies: ${grantSigOk}`, grantSigOk ? "ok" : "no");

      // Control 1 — scope mutation detection.
      const mutated = Core.exampleMergeRequest({ parameters: { pull_request: 4183 } });
      const mutatedDigest = await Core.digestRequest(mutated);
      const mutationDetected = mutatedDigest !== digest;
      log("");
      log("[1] Canonical scope-mutation detection", "accent");
      log(`  merge_pull_request(pr=4182) digest: sha256:${digest.slice(0, 24)}...`, "dim");
      log(`  merge_pull_request(pr=4183) digest: sha256:${mutatedDigest.slice(0, 24)}...`, "dim");
      log(`  mutation changes digest → grant does not authorize it: ${mutationDetected}`, mutationDetected ? "ok" : "no");
      setControl(0, mutationDetected ? "CRYPTOGRAPHIC PASS" : "FAIL");

      const activeRequest = withMutation ? mutated : request;
      if (withMutation) {
        log("");
        log("Presenting MUTATED request (pr=4183) against grant bound to pr=4182...", "warn");
        const presentedDigest = await Core.digestRequest(activeRequest);
        const scopeOk = `sha256:${presentedDigest}` === issued.grant.canonical_param_digest;
        log(`  presented digest matches grant binding: ${scopeOk}`, scopeOk ? "ok" : "no");
        log("  VERDICT: REFUSE / SCOPE_MISMATCH — provider is never contacted.", "no");
      }

      // Receipts.
      const auth = await Core.buildAuthorizationReceipt(issued.grant, issued.grantHash, {
        authorityPrivateKey: authority.privateKey,
        issuerKeyId: authorityKid
      });
      const result = withMutation
        ? { status: "refused", reason: "SCOPE_MISMATCH", provider_called: false }
        : { status: "merged", repository: "acme/payments", pull_request: 4182, merged_sha: request.parameters.head_sha };
      const exec = await Core.buildExecutionReceipt(issued.grant, issued.grantHash, auth.hash, result, {
        executorPrivateKey: executor.privateKey,
        executorKeyId: executorKid,
        executorId: "executor:protected-github"
      });

      // Control 2 — independent signatures verify with own key, fail cross-checked.
      const authOk = await Core.verifyString(authority.publicKey, Core.canonicalize(auth.receipt), auth.signature);
      const execOk = await Core.verifyString(executor.publicKey, Core.canonicalize(exec.receipt), exec.signature);
      const crossFails = !(await Core.verifyString(authority.publicKey, Core.canonicalize(exec.receipt), exec.signature));
      log("");
      log("[2] Independent authority and executor signatures", "accent");
      log(`  authorization receipt verifies with authority key: ${authOk}`, authOk ? "ok" : "no");
      log(`  execution receipt verifies with executor key: ${execOk}`, execOk ? "ok" : "no");
      log(`  execution receipt does NOT verify with authority key: ${crossFails}`, crossFails ? "ok" : "no");
      setControl(1, authOk && execOk && crossFails ? "CRYPTOGRAPHIC PASS" : "FAIL");

      // Control 3 — dual-receipt linkage, and tamper detection.
      const linked = Core.receiptsLinked(auth.receipt, auth.hash, exec.receipt, issued.grantHash);
      const tampered = JSON.parse(JSON.stringify(exec.receipt));
      tampered.grant_hash = "sha256:0000000000000000000000000000000000000000000000000000000000000000";
      const tamperBreaks = !Core.receiptsLinked(auth.receipt, auth.hash, tampered, issued.grantHash);
      log("");
      log("[3] Dual-receipt linkage", "accent");
      log(`  execution ↔ authorization ↔ grant hashes link: ${linked}`, linked ? "ok" : "no");
      log(`  altering a linked hash breaks verification: ${tamperBreaks}`, tamperBreaks ? "ok" : "no");
      setControl(2, linked && tamperBreaks ? "CRYPTOGRAPHIC PASS" : "FAIL");

      // Control 4 — single-use reference consumption.
      const ledger = Core.createConsumptionLedger();
      const first = ledger.reserve(issued.grant.nonce);
      const second = ledger.reserve(issued.grant.nonce);
      const singleUse = first.ok && !second.ok;
      log("");
      log("[4] Single-use reference consumption", "accent");
      log(`  first reservation: ${first.ok ? "won" : "lost"}; replay: ${second.ok ? "won" : "refused (" + second.reason + ")"}`, singleUse ? "ok" : "no");
      log("  Note: browser reference only — not a distributed linearizability proof.", "dim");
      setControl(3, singleUse ? "REFERENCE PASS" : "FAIL");

      // Control 5 — delegation attenuation.
      const parent = { actions: ["merge_pull_request", "close_pull_request"], max_risk: "high" };
      const childOk = Core.delegationAttenuates(parent, { actions: ["merge_pull_request"], max_risk: "medium" });
      const childWiden = Core.delegationAttenuates(parent, { actions: ["delete_branch"], max_risk: "high" });
      log("");
      log("[5] Delegation attenuation", "accent");
      log(`  narrowing delegation permitted: ${childOk}`, childOk ? "ok" : "no");
      log(`  widening delegation rejected: ${!childWiden}`, !childWiden ? "ok" : "no");
      setControl(4, childOk && !childWiden ? "REFERENCE PASS" : "FAIL");

      // Control 6 — revocation freshness.
      const fresh = Core.revocationFresh(30, 300);
      const stale = Core.revocationFresh(3600, 300);
      const freshnessOk = fresh.verdict === "OK" && stale.verdict === "INDETERMINATE";
      log("");
      log("[6] Revocation-freshness behavior", "accent");
      log(`  fresh checkpoint → ${fresh.verdict}; stale checkpoint → ${stale.verdict}`, freshnessOk ? "ok" : "no");
      setControl(5, freshnessOk ? "REFERENCE PASS" : "FAIL");

      // Control 7 — provider non-bypassability (cannot be proven in a browser).
      log("");
      log("[7] Provider non-bypassability", "accent");
      log("  Requires provider-enforced identity, network policy, and credential", "dim");
      log("  brokering in a deployed environment. Not demonstrable in-browser.", "dim");
      log("  Classification: UNPROVEN.", "warn");
      setControl(6, "UNPROVEN");

      // Control 8 — witness split-view detection (requires deployed witnesses).
      log("");
      log("[8] Witness split-view detection", "accent");
      log("  Requires independent witnesses and a transparency log with", "dim");
      log("  inclusion/consistency proofs. Not demonstrable in-browser.", "dim");
      log("  Classification: UNPROVEN.", "warn");
      setControl(7, "UNPROVEN");

      lastBundle = buildBundle({
        request: activeRequest,
        digest,
        grant: issued.grant,
        grantHash: issued.grantHash,
        grantSignature: issued.signature,
        authorityJwk: await Core.exportPublicJwk(authority.publicKey),
        executorJwk: await Core.exportPublicJwk(executor.publicKey),
        authorizationReceipt: auth.receipt,
        authorizationSignature: auth.signature,
        executionReceipt: exec.receipt,
        executionSignature: exec.signature,
        result,
        mutated: withMutation
      });

      log("");
      log("Run complete. Evidence bundle ready for export.", "accent");
      log("This is browser reference evidence — not production deployment evidence.", "warn");
      exportBtn.disabled = false;
    } catch (error) {
      log(`Error during run: ${error.message}`, "no");
      log("Evidence classification: INDETERMINATE.", "warn");
    } finally {
      setBusy(false);
    }
  }

  function buildBundle(data) {
    return {
      mnde_evidence_bundle: "reference-v1",
      generated_at: new Date().toISOString(),
      evidence_class: "BROWSER REFERENCE EVIDENCE",
      signature_profile: Core.SIG_ALG,
      production_verified: false,
      scenario: data.mutated ? "mutated-request (expected REFUSE)" : "valid-exact-merge (expected ALLOW)",
      canonical_request: data.request,
      canonical_request_digest: `sha256:${data.digest}`,
      grant: data.grant,
      grant_hash: `sha256:${data.grantHash}`,
      grant_signature_b64: data.grantSignature,
      authorization_receipt: data.authorizationReceipt,
      authorization_signature_b64: data.authorizationSignature,
      execution_receipt: data.executionReceipt,
      execution_signature_b64: data.executionSignature,
      observed_result: data.result,
      public_verification_material: {
        authority_public_jwk: data.authorityJwk,
        executor_public_jwk: data.executorJwk
      },
      limitations: [
        "Keys are ephemeral and generated in-browser; they are not backed by any HSM, KMS, or production trust root.",
        "Single-use consumption is demonstrated with an in-memory ledger and does not prove distributed linearizability.",
        "Provider non-bypassability and credential dispossession are TARGET architecture and are not exercised here.",
        "Witness checkpoints, transparency-log inclusion, and revocation propagation are not present in this bundle.",
        "No external provider (including GitHub) is contacted; provider results are reference behavior only.",
        "This bundle is not evidence of a production deployment and must not be labeled PRODUCTION VERIFIED."
      ]
    };
  }

  function download(bundle) {
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `mnde-evidence-bundle-${Date.now()}.json`;
    document.body.appendChild(anchor);
    anchor.click();
    document.body.removeChild(anchor);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  function setBusy(busy) {
    [runBtn, mutateBtn, clearBtn].forEach((btn) => {
      if (btn) btn.disabled = busy;
    });
    if (busy) exportBtn.disabled = true;
  }

  renderControls();
  resetControls();
  exportBtn.disabled = true;

  runBtn?.addEventListener("click", () => run(false));
  mutateBtn?.addEventListener("click", () => run(true));
  clearBtn?.addEventListener("click", () => {
    clearConsole();
    resetControls();
    exportBtn.disabled = true;
    lastBundle = null;
    log("Cleared. Run the sequence to regenerate evidence.", "dim");
  });
  exportBtn?.addEventListener("click", () => {
    if (lastBundle) download(lastBundle);
  });

  log("Evidence Lab ready. Runs ECDSA P-256 / SHA-256 locally in your browser.", "accent");
  log("Choose a run to generate a fresh evidence bundle.", "dim");
})();
