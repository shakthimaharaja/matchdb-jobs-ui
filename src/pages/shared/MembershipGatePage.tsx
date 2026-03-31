/**
 * MembershipGatePage — shown when a logged-in user has no active membership.
 *
 * Employer (plan === "free") → prompts to subscribe (monthly plan)
 * Candidate (!hasPurchasedVisibility) → prompts to purchase a visibility package (one-time)
 *
 * Fires `matchdb:openPricing` with the correct tab so the shell's PricingPage modal opens.
 * No prices are hard-coded here — the PricingPage fetches real prices from Stripe.
 */
import React from "react";
import { Button } from "matchdb-component-library";
import "./MembershipGatePage.css";

interface MembershipGatePageProps {
  userType: "candidate" | "employer";
}

const openPricing = (tab: "candidate" | "employer") => {
  globalThis.dispatchEvent(
    new CustomEvent("matchdb:openPricing", { detail: { tab } }),
  );
};

// ── Candidate gate ────────────────────────────────────────────────────────────

const CandidateGate: React.FC = () => (
  <div className="mg-landing">
    <div className="mg-window">
      {/* Title bar */}
      <div className="mg-titlebar">
        <span className="mg-titlebar-icon">🔒</span>
        <span className="mg-titlebar-title">
          Jobs Database — Visibility Package Required
        </span>
      </div>

      {/* Address-bar style breadcrumb */}
      <div className="mg-addressbar">
        MatchDB &rsaquo; Jobs Portal &rsaquo;{" "}
        <strong>Candidate Membership</strong>
      </div>

      {/* Body */}
      <div className="mg-body">
        <p className="mg-headline">
          Purchase a visibility package to get discovered by employers
        </p>
        <p className="mg-subtext">
          Your profile is not yet visible to employers. A{" "}
          <strong>one-time visibility purchase</strong> makes you searchable,
          shows your match score on job listings, and lets you apply and send
          pokes to vendors.
        </p>

        {/* Package overview */}
        <div className="mg-pkg-grid">
          <div className="mg-pkg-card">
            <div className="mg-pkg-name">Base</div>
            <div className="mg-pkg-desc">
              1 contract subdomain <em>or</em> 1 full-time subdomain
            </div>
            <div className="mg-pkg-from">from $13</div>
          </div>
          <div className="mg-pkg-card">
            <div className="mg-pkg-name">Subdomain Add-on</div>
            <div className="mg-pkg-desc">
              Add extra work-type coverage (C2C, W2, C2H, Direct Hire…)
            </div>
            <div className="mg-pkg-from">+$2 each</div>
          </div>
          <div className="mg-pkg-card mg-pkg-highlighted">
            <div className="mg-pkg-badge">POPULAR</div>
            <div className="mg-pkg-name">Domain Bundle</div>
            <div className="mg-pkg-desc">
              All subdomains in either Contract <em>or</em> Full-Time
            </div>
            <div className="mg-pkg-from">$17 one-time</div>
          </div>
          <div className="mg-pkg-card">
            <div className="mg-pkg-name">Full Bundle</div>
            <div className="mg-pkg-desc">
              Complete visibility — all contract &amp; full-time subtypes
            </div>
            <div className="mg-pkg-from">$23 one-time</div>
          </div>
        </div>

        {/* What visibility unlocks */}
        <table className="mg-feature-table">
          <thead>
            <tr>
              <th className="mg-feat-col">Feature</th>
              <th className="mg-plan-col mg-free-col">No Package</th>
              <th className="mg-plan-col mg-pro-col">With Package</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Appear in employer searches</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>View job match scores</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Apply to job openings</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Send pokes to vendors</td>
              <td className="mg-no">✗ (5/mo)</td>
              <td className="mg-yes">✓ (plan limit)</td>
            </tr>
            <tr>
              <td>Public resume profile page</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
          </tbody>
        </table>

        {/* Benefits callout */}
        <div className="mg-callout">
          <span className="mg-callout-icon">💡</span>
          <span>
            All packages are <strong>one-time payments</strong> — no recurring
            fees. Choose which work types and domains you want to be visible in.
          </span>
        </div>

        {/* CTA */}
        <div className="mg-cta-row">
          <Button variant="primary" onClick={() => openPricing("candidate")}>
            Get Visibility Package →
          </Button>
          <span className="mg-cta-note">
            Secure checkout via Stripe · One-time payment · No subscription
          </span>
        </div>
      </div>

      {/* Status bar */}
      <div className="mg-statusbar">
        <span className="mg-sb-cell">has_purchased_visibility=false</span>
        <span className="mg-sb-cell">profile_locked=true</span>
        <span className="mg-sb-cell">
          Profile not visible — purchase a package to continue
        </span>
        <span className="mg-sb-cell mg-sb-right">MatchDB v97.2026</span>
      </div>
    </div>
  </div>
);

// ── Employer gate ───────────────────────────────────────────────────────────

const EmployerGate: React.FC = () => (
  <div className="mg-landing">
    <div className="mg-window">
      <div className="mg-titlebar">
        <span className="mg-titlebar-icon">🔒</span>
        <span className="mg-titlebar-title">
          Employer Portal — Subscription Required
        </span>
      </div>

      <div className="mg-addressbar">
        MatchDB &rsaquo; Jobs Portal &rsaquo;{" "}
        <strong>Employer Membership</strong>
      </div>

      <div className="mg-body">
        <p className="mg-headline">
          Subscribe to unlock job posting, candidate matching &amp; staffing
          tools
        </p>
        <p className="mg-subtext">
          As an employer you get <strong>combined access</strong> to both vendor
          (job posting) and staffing (market intelligence) features. Choose a
          plan to get started.
        </p>

        <table className="mg-feature-table">
          <thead>
            <tr>
              <th className="mg-feat-col">Feature</th>
              <th className="mg-plan-col mg-free-col">Free</th>
              <th className="mg-plan-col mg-pro-col">Subscribed</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Post job openings</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Browse &amp; match candidates</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Send pokes &amp; email outreach</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Vendor email &amp; phone on jobs</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Download CSV / Excel / Resume</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Staffing market intelligence</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
          </tbody>
        </table>

        <div className="mg-callout">
          <span className="mg-callout-icon">💡</span>
          <span>
            Employer accounts combine vendor and staffing features in a single
            login. All plans are monthly, cancel anytime.
          </span>
        </div>

        <div className="mg-cta-row">
          <Button variant="primary" onClick={() => openPricing("employer")}>
            View Employer Plans &amp; Pricing →
          </Button>
          <span className="mg-cta-note">
            Monthly billing via Stripe · Cancel anytime
          </span>
        </div>
      </div>

      <div className="mg-statusbar">
        <span className="mg-sb-cell">plan=free</span>
        <span className="mg-sb-cell">
          Access restricted — subscribe to continue
        </span>
        <span className="mg-sb-cell mg-sb-right">MatchDB v97.2026</span>
      </div>
    </div>
  </div>
);

const MembershipGatePage: React.FC<MembershipGatePageProps> = ({
  userType,
}) => {
  if (userType === "employer") return <EmployerGate />;
  return <CandidateGate />;
};

export default MembershipGatePage;
