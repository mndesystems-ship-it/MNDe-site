/* MNDe site behavior.
   CSP forbids inline scripts, so all interactivity is defined here.
   Header, footer and the interactive authorization widgets are rendered
   from the data structures below to keep content centralized (no
   duplicated markup across sections). */

const navItems = [
  { id: "product", label: "Product", href: "index.html#product" },
  { id: "architecture", label: "Architecture", href: "index.html#architecture" },
  { id: "evidence", label: "Evidence", href: "index.html#evidence" },
  { id: "integrations", label: "Integrations", href: "index.html#integrations" },
  { id: "security", label: "Security", href: "index.html#security" },
  { id: "roadmap", label: "Roadmap", href: "index.html#roadmap" },
  { id: "blog", label: "Blog", href: "blog/index.html" },
  { id: "contact", label: "Contact", href: "contact.html" }
];

const CONTACT_EMAIL = "contact@mndesystems.com";

function getBasePath() {
  return window.location.pathname.includes("/blog/") ? "../" : "";
}

function trackEvent(eventName, props) {
  if (typeof window.plausible !== "function") return;
  if (props && Object.keys(props).length > 0) {
    window.plausible(eventName, { props });
    return;
  }
  window.plausible(eventName);
}

function el(tag, attrs, children) {
  const node = document.createElement(tag);
  if (attrs) {
    Object.entries(attrs).forEach(([key, value]) => {
      if (value === null || value === undefined || value === false) return;
      if (key === "text") {
        node.textContent = value;
      } else if (key === "html") {
        node.innerHTML = value;
      } else if (key.startsWith("data-") || key === "role" || key.startsWith("aria-")) {
        node.setAttribute(key, value);
      } else if (key === "class") {
        node.className = value;
      } else {
        node.setAttribute(key, value);
      }
    });
  }
  (children || []).forEach((child) => {
    if (child == null) return;
    node.appendChild(typeof child === "string" ? document.createTextNode(child) : child);
  });
  return node;
}

/* ---------- Header / footer ---------- */

function renderHeader() {
  const header = document.querySelector('[data-include="header"]');
  if (!header) return;

  const basePath = getBasePath();
  const page = document.body.dataset.page;

  header.innerHTML = `
    <div class="container nav-shell">
      <a class="brand" href="${basePath}index.html" aria-label="MNDe home">
        <img class="brand-mark" src="${basePath}assets/img/mnde-mark.svg" alt="" width="64" height="40" aria-hidden="true" />
        <span class="brand-text">
          <strong>MNDe</strong>
          <span>Machine-authorization infrastructure</span>
        </span>
      </a>
      <div class="nav-cluster">
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="primary-nav" aria-label="Toggle navigation">Menu</button>
        <nav id="primary-nav" class="nav-links" aria-label="Primary"></nav>
        <a class="button button-primary button-sm nav-cta" href="${basePath}contact.html" data-track-group="cta" data-track-label="Request a technical pilot">Request a technical pilot</a>
      </div>
    </div>
  `;

  const nav = header.querySelector(".nav-links");
  navItems.forEach((item) => {
    const active = item.id === page;
    const link = el("a", {
      href: `${basePath}${item.href}`,
      "data-nav-id": item.id,
      "data-track-group": "nav",
      "data-track-label": item.label,
      text: item.label
    });
    if (active) {
      link.classList.add("is-active");
      link.setAttribute("aria-current", "page");
    }
    nav.appendChild(link);
  });

  const toggle = header.querySelector(".nav-toggle");
  toggle?.addEventListener("click", () => {
    const open = nav.classList.toggle("is-open");
    toggle.setAttribute("aria-expanded", String(open));
  });
  nav.addEventListener("click", (event) => {
    if (event.target.closest("a")) {
      nav.classList.remove("is-open");
      toggle?.setAttribute("aria-expanded", "false");
    }
  });
}

function renderFooter() {
  const footer = document.querySelector('[data-include="footer"]');
  if (!footer) return;

  const basePath = getBasePath();
  const year = new Date().getFullYear();

  const footerNav = navItems
    .map((item) => `<a href="${basePath}${item.href}">${item.label}</a>`)
    .join("");

  footer.innerHTML = `
    <div class="container footer-shell">
      <div class="footer-brand">
        <strong>MNDe Systems</strong>
        <span>Authority before execution. No consequential machine action executes without valid, specific, unconsumed authority for that exact action.</span>
        <span class="footer-contact"><a href="mailto:${CONTACT_EMAIL}">${CONTACT_EMAIL}</a></span>
        <span class="footer-contact"><a href="tel:+12314209108">231-420-9108</a></span>
      </div>
      <nav class="footer-nav" aria-label="Footer">${footerNav}</nav>
    </div>
    <div class="container footer-legal">
      <span>&copy; ${year} MNDe Systems. All rights reserved.</span>
      <span class="footer-legal-links">
        <a href="${basePath}privacy.html">Privacy</a>
        <a href="${basePath}mnde-site/Terms.html">Terms</a>
      </span>
    </div>
  `;
}

/* ---------- Reveal on scroll ---------- */

function setupReveal() {
  const items = document.querySelectorAll(".reveal");
  if (!items.length) return;

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (reduced || !("IntersectionObserver" in window)) {
    items.forEach((item) => item.classList.add("is-visible"));
    return;
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          observer.unobserve(entry.target);
        }
      });
    },
    { threshold: 0.14 }
  );
  items.forEach((item) => observer.observe(item));
}

/* ---------- Active section highlight ---------- */

function setupActiveNav() {
  const sections = navItems
    .map((item) => document.getElementById(item.id))
    .filter(Boolean);
  if (!sections.length || !("IntersectionObserver" in window)) return;

  const links = new Map(
    Array.from(document.querySelectorAll("[data-nav-id]")).map((link) => [
      link.getAttribute("data-nav-id"),
      link
    ])
  );

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        links.forEach((link) => link.classList.remove("is-active"));
        const active = links.get(entry.target.id);
        if (active) active.classList.add("is-active");
      });
    },
    { rootMargin: "-45% 0px -50% 0px", threshold: 0 }
  );
  sections.forEach((section) => observer.observe(section));
}

/* ---------- Architecture component selector ---------- */

const architectureComponents = [
  {
    id: "grant",
    name: "Exact-action execution grant",
    status: ["badge-limited", "LIMITED"],
    responsibility:
      "Authorize exactly one action against exactly one resource with canonically bound parameters, a short expiration, and a single-use nonce.",
    boundary: "Signed authority object issued by the authority plane; meaningful to the protected executor only.",
    input: "Canonical action request, resolved policy, delegation chain, issuer signing key.",
    output: "A signed grant plus the authorization receipt that records the decision.",
    failure: "Any mismatch, expiry, or prior consumption yields REFUSE before the provider is contacted.",
    detail:
      "A grant is not a role or a session. It names one action, one resource, one canonical parameter digest, and one nonce. Changing any bound field produces a different grant identity and fails verification."
  },
  {
    id: "canonical",
    name: "Canonical parameter binding",
    status: ["badge-implemented", "IMPLEMENTED / REFERENCE"],
    responsibility:
      "Reduce an action request to a deterministic canonical form and hash it so the authorized parameters cannot drift.",
    boundary: "Pure, deterministic transform shared by issuer, executor, and offline verifier.",
    input: "Action name, resource identifiers, and parameters.",
    output: "A canonical byte string and its SHA-256 digest.",
    failure: "Non-canonicalizable or ambiguous input is rejected rather than guessed.",
    detail:
      "The reference canonicalizer in this repository sorts keys, normalizes types, and rejects unknown shapes. The Evidence Lab runs it live in your browser and demonstrates that a single mutated parameter changes the digest."
  },
  {
    id: "executor",
    name: "Protected executor",
    status: ["badge-target", "TARGET"],
    responsibility:
      "Be the only path that can perform the consequential action, validating and atomically consuming a grant before it acts.",
    boundary: "Isolated execution identity that external providers accept; agents do not.",
    input: "A presented grant and the request it authorizes.",
    output: "The provider call plus a signed execution receipt.",
    failure: "No valid grant, no execution. A consumed or expired grant is refused atomically.",
    detail:
      "Non-bypassability is a property of provider permissions, identity policy, and network boundaries — not of voluntary SDK usage. That end state is TARGET until a deployment demonstrates it."
  },
  {
    id: "broker",
    name: "Credential broker",
    status: ["badge-target", "TARGET"],
    responsibility:
      "Hold upstream credentials and release only a narrow, short-lived credential to a validated protected executor.",
    boundary: "Trusted secret custodian; never exposes upstream credentials to agents.",
    input: "A validated grant consumption event from the protected executor.",
    output: "A minimal credential scoped to the authorized action.",
    failure: "Without a consumed grant, no credential is released.",
    detail:
      "Credential dispossession means the agent never holds and cannot retrieve the upstream production credential. Only the protected executor identity is accepted by the external provider."
  },
  {
    id: "policy",
    name: "Policy and delegation",
    status: ["badge-limited", "LIMITED"],
    responsibility:
      "Decide whether a principal may obtain authority for an action, and attenuate authority as it is delegated.",
    boundary: "Authority plane evaluation; delegation can only narrow, never widen.",
    input: "Principal identity, requested action, delegation chain, policy state.",
    output: "An allow/refuse/review decision and the constraints bound into the grant.",
    failure: "Ambiguous or over-broad delegation resolves to REFUSE or REVIEW, not ALLOW.",
    detail:
      "Delegation attenuation guarantees a delegate cannot exceed the authority of its delegator. The chain tip is bound into every grant and resolved during offline verification."
  },
  {
    id: "ledger",
    name: "Atomic consumption ledger",
    status: ["badge-limited", "LIMITED"],
    responsibility:
      "Reserve and consume a grant's single-use nonce exactly once, even under concurrent presentation.",
    boundary: "Linearizable reservation point between validation and execution.",
    input: "A grant nonce and an execution identifier.",
    output: "A single winning reservation; all replays lose.",
    failure: "A second presentation of a consumed nonce is refused as replay.",
    detail:
      "A browser demonstration can show one-winner selection as a reference, but it does not prove distributed linearizability. Production proof requires a deployed ledger history."
  },
  {
    id: "receipts",
    name: "Authorization & execution receipts",
    status: ["badge-limited", "LIMITED"],
    responsibility:
      "Emit two independently signed records — what was authorized, and what was executed and observed — cryptographically linked.",
    boundary: "Evidence artifacts verifiable offline against published trust roots.",
    input: "Grant, execution identifier, result, issuer and executor keys.",
    output: "Two linked receipts forming a tamper-evident record.",
    failure: "A broken link or invalid signature fails verification.",
    detail:
      "The authorization receipt says MNDe authorized execution X under policy P using grant G. The execution receipt says executor Y used grant G for execution X and observed result Z. They are bound by execution id, grant hash, and result hash."
  },
  {
    id: "revocation",
    name: "Revocation & freshness",
    status: ["badge-target", "TARGET"],
    responsibility:
      "Invalidate delegated authority and require verifiers to check revocation freshness within a bounded window.",
    boundary: "Signed revocation service consulted during verification.",
    input: "Revocation entries and a freshness policy.",
    output: "A revocation status with a freshness timestamp.",
    failure: "A stale revocation checkpoint yields INDETERMINATE, not a silent allow.",
    detail:
      "Revocation without a freshness requirement is not enforcement. Verifiers must treat an outdated checkpoint as inconclusive."
  },
  {
    id: "witness",
    name: "Witness checkpoints",
    status: ["badge-target", "TARGET"],
    responsibility:
      "Provide independent inclusion evidence so a single party cannot present a split view of the record.",
    boundary: "External witnesses and a transparency log with inclusion and consistency proofs.",
    input: "Receipt hashes and log checkpoints.",
    output: "Inclusion proofs and cross-witness consistency.",
    failure: "A split view is detectable when witnesses disagree.",
    detail:
      "Witnessing turns 'trust the log' into 'verify the log against independent observers.' This is TARGET architecture until witnesses are deployed."
  },
  {
    id: "content",
    name: "Modular content-security inputs",
    status: ["badge-limited", "LIMITED"],
    responsibility:
      "Feed optional content-risk signals into the authorization decision without becoming the authorization mechanism.",
    boundary: "Pluggable adapters that inform policy; never the sole control.",
    input: "Content and context signals for a requested action.",
    output: "Risk inputs consumed by policy evaluation.",
    failure: "A missing or low-confidence signal degrades to REVIEW, not silent allow.",
    detail:
      "Content inspection is an input to authority, not a substitute for it. Authorization still requires a valid, specific, unconsumed grant."
  }
];

function renderArchitecture() {
  const mount = document.getElementById("architecture-widget");
  if (!mount) return;

  const list = el("div", { class: "selector-list", role: "tablist", "aria-label": "Architecture components", "aria-orientation": "vertical" });
  const detail = el("div", { class: "selector-detail", id: "architecture-detail", role: "tabpanel", "aria-live": "polite" });

  function show(component, focus) {
    list.querySelectorAll(".selector-item").forEach((btn) => {
      const selected = btn.getAttribute("data-comp") === component.id;
      btn.setAttribute("aria-selected", String(selected));
      btn.setAttribute("tabindex", selected ? "0" : "-1");
    });
    detail.innerHTML = "";
    detail.appendChild(el("span", { class: `badge ${component.status[0]}`, text: component.status[1] }));
    detail.appendChild(el("h3", { text: component.name }));
    detail.appendChild(el("p", { class: "muted", text: component.detail }));
    const rows = el("dl", { class: "detail-rows" }, [
      detailRow("Responsibility", component.responsibility),
      detailRow("Trust boundary", component.boundary),
      detailRow("Input", component.input),
      detailRow("Output", component.output),
      detailRow("Failure behavior", component.failure)
    ]);
    detail.appendChild(rows);
    if (focus) {
      const active = list.querySelector('[aria-selected="true"]');
      active?.focus();
    }
  }

  function detailRow(label, value) {
    return el("div", { class: "detail-row" }, [
      el("dt", { text: label }),
      el("dd", { text: value })
    ]);
  }

  architectureComponents.forEach((component, index) => {
    const btn = el("button", {
      type: "button",
      class: "selector-item",
      role: "tab",
      "data-comp": component.id,
      "aria-selected": index === 0 ? "true" : "false",
      tabindex: index === 0 ? "0" : "-1"
    }, [
      el("span", { text: component.name }),
      el("span", { class: `badge ${component.status[0]}`, text: component.status[1] })
    ]);
    btn.addEventListener("click", () => show(component, false));
    btn.addEventListener("keydown", (event) => {
      const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      const next = (index + keys[event.key] + architectureComponents.length) % architectureComponents.length;
      show(architectureComponents[next], true);
    });
    list.appendChild(btn);
  });

  mount.appendChild(list);
  mount.appendChild(detail);
  show(architectureComponents[0], false);
}

/* ---------- Grant lifecycle stepper ---------- */

const lifecycleStates = [
  { name: "Requested", detail: "A principal asks the authority plane for authority to perform one specific action. Nothing executes yet." },
  { name: "Issued", detail: "Policy and delegation resolve to ALLOW. A signed exact-action grant is minted with a canonical parameter digest, expiration, and single-use nonce." },
  { name: "Reserved", detail: "The protected executor atomically reserves the grant's nonce in the consumption ledger. Concurrent presenters race here; exactly one reservation wins." },
  { name: "Consumed", detail: "The reservation is finalized. The nonce can never be reserved again — this is what makes the grant single-use." },
  { name: "Executed", detail: "The credential broker releases a narrow credential and the protected executor invokes the external system for the exact authorized action." },
  { name: "Receipt emitted", detail: "Linked authorization and execution receipts are signed and published so the outcome can be verified offline." }
];

const lifecycleTerminals = [
  { name: "Expired", detail: "Presented after its short expiration window." },
  { name: "Revoked", detail: "Delegated authority was withdrawn before consumption." },
  { name: "Refused", detail: "Scope, policy, or branch conditions did not hold." },
  { name: "Indeterminate", detail: "Revocation freshness or witness state was inconclusive." },
  { name: "Failed before provider call", detail: "Validation or reservation failed; provider never contacted." },
  { name: "Ambiguous provider result", detail: "Provider executed but the response was lost; requires reconciliation." }
];

function renderLifecycle() {
  const mount = document.getElementById("lifecycle-widget");
  if (!mount) return;

  const track = el("div", { class: "lifecycle-track", role: "tablist", "aria-label": "Grant lifecycle states" });
  const detail = el("div", { class: "lifecycle-detail", role: "tabpanel", "aria-live": "polite" });

  function show(index, focus) {
    track.querySelectorAll(".lifecycle-step").forEach((step, i) => {
      const selected = i === index;
      step.setAttribute("aria-selected", String(selected));
      step.setAttribute("tabindex", selected ? "0" : "-1");
    });
    const state = lifecycleStates[index];
    detail.innerHTML = "";
    detail.appendChild(el("span", { class: "mono-label", text: `State ${index + 1} of ${lifecycleStates.length}` }));
    detail.appendChild(el("h3", { text: state.name }));
    detail.appendChild(el("p", { class: "muted", text: state.detail }));
    if (focus) track.querySelector('[aria-selected="true"]')?.focus();
  }

  lifecycleStates.forEach((state, index) => {
    const step = el("button", {
      type: "button",
      class: "lifecycle-step",
      role: "tab",
      "aria-selected": index === 0 ? "true" : "false",
      tabindex: index === 0 ? "0" : "-1"
    }, [
      el("span", { class: "lifecycle-index", text: String(index + 1).padStart(2, "0") }),
      el("strong", { text: state.name })
    ]);
    step.addEventListener("click", () => show(index, false));
    step.addEventListener("keydown", (event) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      show((index + keys[event.key] + lifecycleStates.length) % lifecycleStates.length, true);
    });
    track.appendChild(step);
  });

  const terminals = el("div", { class: "lifecycle-terminals" });
  lifecycleTerminals.forEach((terminal) => {
    terminals.appendChild(el("div", { class: "terminal-chip" }, [
      el("strong", { text: terminal.name }),
      document.createTextNode(terminal.detail)
    ]));
  });

  mount.appendChild(track);
  mount.appendChild(detail);
  const terminalsHeading = el("p", { class: "mono-label mt-2", text: "Terminal alternatives" });
  mount.appendChild(terminalsHeading);
  mount.appendChild(terminals);
  show(0, false);
}

/* ---------- GitHub protected-merge scenarios ---------- */

const integrationScenarios = [
  { name: "Valid exact merge", providerCalled: "Yes — exact authorized commit", verdict: ["verdict-allow", "ALLOW"], note: "Grant matches repository, PR number, head commit, base branch, and merge method. The protected executor consumes the grant once and merges the exact commit." },
  { name: "Pull-request mutation", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / SCOPE_MISMATCH"], note: "The PR number differs from the bound value, so the canonical digest changes and verification fails before any provider call." },
  { name: "Commit mutation", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / SCOPE_MISMATCH"], note: "The head commit no longer matches the bound expected head. Authority does not transfer to a different commit." },
  { name: "Scope mismatch", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / SCOPE_MISMATCH"], note: "Repository, base branch, or merge method differs from the grant. The action is not the authorized action." },
  { name: "Expired grant", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / EXPIRED"], note: "The grant is presented after its short expiration window. Time-bounding limits the blast radius of a leaked grant." },
  { name: "Revoked authority", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / REVOKED"], note: "The delegation backing the grant was revoked before consumption; a fresh revocation check refuses it." },
  { name: "Replay refusal", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / REPLAY"], note: "The nonce was already consumed. A second presentation loses the reservation race and is refused." },
  { name: "Branch-policy refusal", providerCalled: "No", verdict: ["verdict-refuse", "REFUSE / BRANCH_POLICY"], note: "Required checks or branch protections did not hold at execution time, so the merge is not authorized." },
  { name: "Direct-provider bypass", providerCalled: "Denied by provider", verdict: ["verdict-refuse", "REFUSE / NON_BYPASSABLE"], note: "An agent calling GitHub directly is rejected: only the protected executor identity holds the installation credential. This is TARGET behavior until a real installation enforces it." }
];

function renderIntegration() {
  const mount = document.getElementById("integration-widget");
  if (!mount) return;

  const tabs = el("div", { class: "lifecycle-track", role: "tablist", "aria-label": "GitHub protected-merge scenarios" });
  const detail = el("div", { class: "lifecycle-detail", role: "tabpanel", "aria-live": "polite" });

  function show(index, focus) {
    tabs.querySelectorAll(".lifecycle-step").forEach((step, i) => {
      const selected = i === index;
      step.setAttribute("aria-selected", String(selected));
      step.setAttribute("tabindex", selected ? "0" : "-1");
    });
    const scenario = integrationScenarios[index];
    detail.innerHTML = "";
    detail.appendChild(el("h3", { text: scenario.name }));
    const dl = el("dl", { class: "detail-rows" }, [
      rowNode("Expected verdict", el("span", { class: `verdict ${scenario.verdict[0]}`, text: scenario.verdict[1] })),
      rowNode("Provider call", document.createTextNode(scenario.providerCalled)),
      rowNode("Explanation", document.createTextNode(scenario.note))
    ]);
    detail.appendChild(dl);
    if (focus) tabs.querySelector('[aria-selected="true"]')?.focus();
  }

  function rowNode(label, valueNode) {
    return el("div", { class: "detail-row" }, [el("dt", { text: label }), el("dd", {}, [valueNode])]);
  }

  integrationScenarios.forEach((scenario, index) => {
    const step = el("button", {
      type: "button",
      class: "lifecycle-step",
      role: "tab",
      "aria-selected": index === 0 ? "true" : "false",
      tabindex: index === 0 ? "0" : "-1"
    }, [
      el("span", { class: "lifecycle-index", text: String(index + 1).padStart(2, "0") }),
      el("strong", { text: scenario.name })
    ]);
    step.addEventListener("click", () => show(index, false));
    step.addEventListener("keydown", (event) => {
      const keys = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 };
      if (!(event.key in keys)) return;
      event.preventDefault();
      show((index + keys[event.key] + integrationScenarios.length) % integrationScenarios.length, true);
    });
    tabs.appendChild(step);
  });

  mount.appendChild(tabs);
  mount.appendChild(detail);
  show(0, false);
}

/* ---------- Threat & failure scenarios ---------- */

const threatScenarios = [
  ["Grant replay", "Single-use nonce", "Consumption ledger reservation", "Protected executor", ["verdict-refuse", "REFUSE / REPLAY"], "No", "Refused reservation entry", "Ledger availability under partition"],
  ["Parameter mutation", "Canonical parameter binding", "Signature / digest verification", "Protected executor", ["verdict-refuse", "REFUSE / SCOPE_MISMATCH"], "No", "Verification failure record", "Canonicalizer completeness"],
  ["Direct provider bypass", "Protected-path non-bypassability", "Provider identity & network policy", "External provider", ["verdict-refuse", "REFUSE / NON_BYPASSABLE"], "Denied", "Provider rejection log", "Depends on provider-enforced identity (TARGET)"],
  ["Credential theft", "Credential dispossession", "Broker release on consumed grant only", "Credential broker", ["verdict-refuse", "REFUSE"], "No", "Broker audit entry", "Broker compromise"],
  ["Revoked delegation", "Revocation", "Fresh revocation check", "Authority plane", ["verdict-refuse", "REFUSE / REVOKED"], "No", "Revocation hit record", "Revocation propagation latency"],
  ["Expired grant", "Short expiration", "Expiry check", "Protected executor", ["verdict-refuse", "REFUSE / EXPIRED"], "No", "Expiry record", "Clock skew handling"],
  ["Stale revocation checkpoint", "Revocation freshness", "Freshness window enforcement", "Offline verifier", ["verdict-indeterminate", "INDETERMINATE"], "No", "Freshness gap record", "Freshness policy tuning"],
  ["Key confusion", "Issuer key identification", "Key id + algorithm binding", "Offline verifier", ["verdict-refuse", "REFUSE"], "No", "Key mismatch record", "Key rotation discipline"],
  ["Compromised executor", "Least-authority credential + witness", "Narrow credential scope, witnessing", "Credential broker / witness", ["verdict-review", "REVIEW"], "Possibly (bounded)", "Anomalous receipt pattern", "Residual until witness deployment (TARGET)"],
  ["Log deletion", "Tamper-evident receipts", "Transparency log inclusion", "Witness / log", ["verdict-review", "REVIEW"], "N/A", "Missing inclusion proof", "Requires deployed transparency log (TARGET)"],
  ["Witness split view", "Witness checkpoints", "Cross-witness consistency", "Independent witnesses", ["verdict-refuse", "REFUSE"], "N/A", "Consistency proof failure", "Requires multiple witnesses (TARGET)"],
  ["Provider timeout", "Ambiguous-result handling", "Reconciliation on execution id", "Protected executor", ["verdict-indeterminate", "INDETERMINATE"], "Started, unknown", "Pending-execution record", "Idempotent reconciliation"],
  ["Provider success with lost response", "Execution-id idempotency", "Reconciliation before re-execution", "Protected executor", ["verdict-indeterminate", "INDETERMINATE"], "Yes, response lost", "Reconciliation record", "Duplicate-suppression correctness"],
  ["Ledger failure during reservation", "Fail-closed reservation", "Atomic reserve-or-refuse", "Consumption ledger", ["verdict-refuse", "REFUSE"], "No", "Failed-reservation record", "Ledger high-availability (TARGET)"],
  ["Crash after provider execution", "Execution receipt durability", "Receipt reconstruction from provider log", "Protected executor", ["verdict-indeterminate", "INDETERMINATE"], "Yes", "Partial-execution record", "Recovery completeness"],
  ["Duplicate delivery", "Single-use nonce", "Idempotent consumption", "Consumption ledger", ["verdict-refuse", "REFUSE / REPLAY"], "No (second)", "Duplicate-suppressed record", "Exactly-once under retries"]
];

function renderThreats() {
  const mount = document.getElementById("threats-widget");
  if (!mount) return;

  threatScenarios.forEach((row, index) => {
    const [name, invariant, detection, enforcement, verdict, provider, evidence, residual] = row;
    const scenario = el("div", { class: "scenario" });
    const summary = el("button", {
      type: "button",
      class: "scenario-summary",
      "aria-expanded": index === 0 ? "true" : "false"
    }, [
      el("span", { text: name }),
      el("span", { class: "scenario-meta" }, [
        el("span", { class: `verdict ${verdict[0]}`, text: verdict[1] }),
        el("span", { class: "chevron", "aria-hidden": "true", text: "›" })
      ])
    ]);
    const body = el("div", { class: "scenario-body" }, [
      el("dl", { class: "scenario-grid" }, [
        term("Violated invariant", invariant),
        term("Detection point", detection),
        term("Enforcement point", enforcement),
        term("Expected verdict", verdict[1]),
        term("Provider call begins", provider),
        term("Evidence emitted", evidence),
        term("Residual risk", residual)
      ])
    ]);
    if (index === 0) scenario.classList.add("is-open");
    summary.addEventListener("click", () => {
      const open = scenario.classList.toggle("is-open");
      summary.setAttribute("aria-expanded", String(open));
    });
    scenario.appendChild(summary);
    scenario.appendChild(body);
    mount.appendChild(scenario);
  });

  function term(label, value) {
    return el("div", {}, [el("dt", { text: label }), el("dd", { text: value })]);
  }
}

/* ---------- Contact form (preserved mailto routing) ---------- */

function setupContactForm() {
  const form = document.getElementById("contact-form");
  const note = document.getElementById("form-note");
  if (!form || !note) return;

  form.addEventListener("submit", (event) => {
    event.preventDefault();
    const data = new FormData(form);
    const name = String(data.get("name") || "").trim();
    const email = String(data.get("email") || "").trim();
    const intent = String(data.get("intent") || "General inquiry").trim();
    const message = String(data.get("message") || "").trim();

    const subject = encodeURIComponent(`MNDe inquiry — ${intent} — from ${name}`);
    const body = encodeURIComponent(`Name: ${name}\nEmail: ${email}\nIntent: ${intent}\n\n${message}`);

    trackEvent("Contact Form Submit", {
      page: document.body.dataset.page || "unknown",
      intent
    });

    note.textContent = "Opening your email client.";
    window.location.href = `mailto:${CONTACT_EMAIL}?subject=${subject}&body=${body}`;
  });
}

/* ---------- Tracking ---------- */

function setupTracking() {
  const currentPage = document.body.dataset.page || "unknown";

  document.querySelectorAll(".button").forEach((button) => {
    if (!button.getAttribute("data-track-group")) {
      button.setAttribute("data-track-group", "cta");
      button.setAttribute("data-track-label", button.textContent.trim());
    }
  });

  document.querySelectorAll('a[href^="mailto:"]').forEach((link) => {
    link.setAttribute("data-track-group", "contact");
    link.setAttribute("data-track-label", "Email Click");
  });

  document.addEventListener("click", (event) => {
    const target = event.target.closest("[data-track-group]");
    if (!target) return;
    const group = target.getAttribute("data-track-group");
    const label = target.getAttribute("data-track-label") || target.textContent.trim();
    const href = target.getAttribute("href") || "";

    if (group === "nav") {
      trackEvent("Nav Click", { label, from: currentPage, to: href });
    } else if (group === "cta") {
      trackEvent("CTA Click", { label, page: currentPage });
    } else if (group === "contact") {
      trackEvent("Email Click", { page: currentPage });
    }
  });
}

renderHeader();
renderFooter();
setupReveal();
setupActiveNav();
renderArchitecture();
renderLifecycle();
renderIntegration();
renderThreats();
setupContactForm();
setupTracking();
