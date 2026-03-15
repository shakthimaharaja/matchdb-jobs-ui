/**
 * MembershipGatePage — shown when a logged-in user has no active membership.
 *
 * Vendor   (plan === "free") → prompts to subscribe (monthly plan)
 * Candidate (!hasPurchasedVisibility) → prompts to purchase a visibility package (one-time)
 *
 * Fires `matchdb:openPricing` with the correct tab so the shell's PricingPage modal opens.
 * No prices are hard-coded here — the PricingPage fetches real prices from Stripe.
 */
import React from "react";
import { Button } from "matchdb-component-library";
import "./MembershipGatePage.css";

interface MembershipGatePageProps {
  userType: "vendor" | "candidate" | "marketer";
}

const openPricing = (tab: "vendor" | "candidate" | "marketer") => {
  globalThis.dispatchEvent(
    new CustomEvent("matchdb:openPricing", { detail: { tab } }),
  );
};

// ── Vendor gate ───────────────────────────────────────────────────────────────

const VendorGate: React.FC = () => (
  <div className="mg-landing">
    <div className="mg-window">
      {/* Title bar */}
      <div className="mg-titlebar">
        <span className="mg-titlebar-icon">🔒</span>
        <span className="mg-titlebar-title">
          Jobs Database — Subscription Required
        </span>
      </div>

      {/* Address-bar style breadcrumb */}
      <div className="mg-addressbar">
        MatchDB &rsaquo; Jobs Portal &rsaquo; <strong>Vendor Membership</strong>
      </div>

      {/* Body */}
      <div className="mg-body">
        <p className="mg-headline">
          Subscribe to unlock job posting &amp; candidate matching
        </p>
        <p className="mg-subtext">
          You&apos;re on the <strong>Free plan</strong>. Choose a monthly
          subscription to start posting jobs and connecting with pre-screened
          candidates.
        </p>

        {/* Feature grid */}
        <table className="mg-feature-table">
          <thead>
            <tr>
              <th className="mg-feat-col">Feature</th>
              <th className="mg-plan-col mg-free-col">Free</th>
              <th className="mg-plan-col mg-basic-col">Basic</th>
              <th className="mg-plan-col mg-pro-col">Pro</th>
              <th className="mg-plan-col mg-plus-col">Pro+</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Post job openings</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">5 / mo</td>
              <td className="mg-yes">10 / mo</td>
              <td className="mg-yes">20 / mo</td>
            </tr>
            <tr>
              <td>Browse matched candidates</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Send pokes / month</td>
              <td className="mg-no">0</td>
              <td className="mg-yes">25</td>
              <td className="mg-yes">50</td>
              <td className="mg-yes">Unlimited</td>
            </tr>
            <tr>
              <td>Send email outreach</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>View candidate resumes</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Match score visibility</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
              <td className="mg-yes">✓</td>
            </tr>
          </tbody>
        </table>

        {/* Benefits callout */}
        <div className="mg-callout">
          <span className="mg-callout-icon">💡</span>
          <span>
            All plans include: ATS-style applicant tracking, smart job–candidate
            matching, and real-time live database updates.
          </span>
        </div>

        {/* CTA */}
        <div className="mg-cta-row">
          <Button variant="primary" onClick={() => openPricing("vendor")}>
            View Subscription Plans &amp; Pricing →
          </Button>
          <span className="mg-cta-note">
            Monthly billing via Stripe · Cancel anytime
          </span>
        </div>
      </div>

      {/* Status bar */}
      <div className="mg-statusbar">
        <span className="mg-sb-cell">plan=free</span>
        <span className="mg-sb-cell">jobs_posted=0</span>
        <span className="mg-sb-cell">
          Access restricted — subscribe to continue
        </span>
        <span className="mg-sb-cell mg-sb-right">MatchDB v97.2026</span>
      </div>
    </div>
  </div>
);

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

// ── Marketer gate ─────────────────────────────────────────────────────────────

const MarketerGate: React.FC = () => (
  <div className="mg-landing">
    <div className="mg-window">
      <div className="mg-titlebar">
        <span className="mg-titlebar-icon">🔒</span>
        <span className="mg-titlebar-title">
          Market Intelligence — Subscription Required
        </span>
      </div>

      <div className="mg-addressbar">
        MatchDB &rsaquo; Jobs Portal &rsaquo;{" "}
        <strong>Marketer Membership</strong>
      </div>

      <div className="mg-body">
        <p className="mg-headline">
          Subscribe to access the live job &amp; candidate database
        </p>
        <p className="mg-subtext">
          Choose your job-type access level. Your company gets one marketer
          account — see vendor contact emails, phones, and candidate profiles
          with download options.
        </p>

        <table className="mg-feature-table">
          <thead>
            <tr>
              <th className="mg-feat-col">Plan</th>
              <th className="mg-plan-col mg-free-col">Details</th>
              <th className="mg-plan-col mg-pro-col">Price</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>
                <strong>1 Job Type</strong> (e.g. C2C only)
              </td>
              <td>C2C openings + C2C candidates</td>
              <td className="mg-yes">
                <strong>$100/mo</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Any 2 Types</strong>
              </td>
              <td>Pick 2 of C2C, W2, C2H, Full Time</td>
              <td className="mg-yes">
                <strong>$180/mo</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>Any 3 Types</strong>
              </td>
              <td>Pick 3 of C2C, W2, C2H, Full Time</td>
              <td className="mg-yes">
                <strong>$250/mo</strong>
              </td>
            </tr>
            <tr>
              <td>
                <strong>All Types</strong>
              </td>
              <td>Full access to all job types</td>
              <td className="mg-yes">
                <strong>$499/mo</strong>
              </td>
            </tr>
            <tr>
              <td colSpan={3} style={{ fontSize: 11, paddingTop: 6 }}>
                <strong>Add-on:</strong> 0–2 sessions free · Up to 5 concurrent
                sessions: +$100/mo
              </td>
            </tr>
          </tbody>
        </table>

        <table className="mg-feature-table" style={{ marginTop: 12 }}>
          <thead>
            <tr>
              <th className="mg-feat-col">Feature</th>
              <th className="mg-plan-col mg-free-col">No Plan</th>
              <th className="mg-plan-col mg-pro-col">Marketer</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Vendor email &amp; phone on job openings</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Candidate email &amp; phone on profiles</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Download job openings as CSV</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Download candidate profiles as Excel</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Download individual resumes as PDF</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>View job opening in detail</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
            <tr>
              <td>Real-time new-entry highlights</td>
              <td className="mg-no">✗</td>
              <td className="mg-yes">✓</td>
            </tr>
          </tbody>
        </table>

        <div className="mg-callout">
          <span className="mg-callout-icon">💡</span>
          <span>
            One account per company. Data is sourced directly from vendor and
            candidate databases, refreshed in real time — ideal for market
            research and talent intelligence.
          </span>
        </div>

        <div className="mg-cta-row">
          <Button variant="primary" onClick={() => openPricing("marketer")}>
            View Marketer Plans &amp; Pricing →
          </Button>
          <span className="mg-cta-note">
            Monthly billing via Stripe · Cancel anytime
          </span>
        </div>
      </div>

      <div className="mg-statusbar">
        <span className="mg-sb-cell">plan=none</span>
        <span className="mg-sb-cell">
          Access restricted — subscribe to continue
        </span>
        <span className="mg-sb-cell mg-sb-right">MatchDB v97.2026</span>
      </div>
    </div>
  </div>
);

// ── Root export ───────────────────────────────────────────────────────────────

const MembershipGatePage: React.FC<MembershipGatePageProps> = ({ userType }) => {
  if (userType === "vendor") return <VendorGate />;
  if (userType === "marketer") return <MarketerGate />;
  return <CandidateGate />;
};

export default MembershipGatePage;
