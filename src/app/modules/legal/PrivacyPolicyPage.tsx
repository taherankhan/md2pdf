import { FC } from 'react';
import LegalLayout from './LegalLayout';
import {
  LEGAL_CONTACT_EMAIL,
  LEGAL_DOMAIN,
  LEGAL_OPERATOR,
  LEGAL_PRODUCT_NAME,
  LEGAL_SITE_NAME,
} from './legalMeta';

const PrivacyPolicyPage: FC = () => (
  <LegalLayout title="Privacy Policy">
    <p>
      This Privacy Policy describes how {LEGAL_OPERATOR} (&quot;we&quot;, &quot;us&quot;) collects,
      uses, and shares information when you use {LEGAL_SITE_NAME} — {LEGAL_PRODUCT_NAME} — at{' '}
      {LEGAL_DOMAIN} and related subdomains (the &quot;Service&quot;).
    </p>

    <h2>1. Summary</h2>
    <ul>
      <li>
        <strong>Editor &amp; PDF export:</strong> Markdown and previews are processed in your browser.
        We do not receive your document content unless you sign in to save documents to your personal cloud library,
        create a public share link, or submit the contact form.
      </li>
      <li>
        <strong>Google Sign-In:</strong> When you choose to sign in with Google, we receive basic profile
        information (name, email address, profile picture, and Google account identifier) solely to authenticate
        your session and manage your saved documents.
      </li>
      <li>
        <strong>Cloud Library &amp; Sharing:</strong> Authenticated users can save private markdown files in our
        database (MongoDB Atlas). Documents remain strictly private to your account unless you explicitly generate
        a public share link.
      </li>
      <li>
        <strong>Hash-based sharing:</strong> Share URLs that use the <code>#d=...</code> fragment keep
        payload data in the browser; the fragment is not sent to our hosting server on page load.
      </li>
      <li>
        <strong>Analytics:</strong> We may use Google Analytics 4 and Vercel Analytics to understand
        usage (pages, events). See Section 5.
      </li>
      <li>
        <strong>Contact form:</strong> Messages you submit are stored in our database
        provider (MongoDB Atlas) to respond to you.
      </li>
    </ul>

    <h2>2. Information we collect</h2>
    <p>
      <strong>Google Account Information:</strong> If you sign in via Google OAuth 2.0, we collect and store
      your Google unique ID, primary email address, display name, and avatar picture URL. We do not access,
      request, or store passwords, contacts, Google Drive files, or any other Google account services.
    </p>
    <p>
      <strong>User Documents:</strong> When signed in, any markdown text, titles, and selected themes you save
      are stored in your cloud document library in MongoDB Atlas to allow multi-device editing.
    </p>
    <p>
      <strong>Information you provide:</strong> Email and message text when you submit the contact form.
      Optional cloud share payloads if you choose to publish a share link.
    </p>
    <p>
      <strong>Automatic technical data:</strong> IP address, browser type, device type, referring URL,
      and similar logs may be collected by our hosting (e.g. Vercel), analytics providers, or database
      provider for security and operations.
    </p>
    <p>
      <strong>Local storage:</strong> The Service uses browser storage for guest drafts and UI preferences.
    </p>

    <h2>3. Google API Services User Data Policy Compliance</h2>
    <p>
      {LEGAL_SITE_NAME}&apos;s use and transfer to any other app of information received from Google APIs adheres to the{' '}
      <a
        href="https://developers.google.com/terms/api-services-user-data-policy"
        target="_blank"
        rel="noopener noreferrer"
      >
        Google API Services User Data Policy
      </a>
      , including the Limited Use requirements. Specifically:
    </p>
    <ul>
      <li>We only use Google account data to provide user-facing features (authentication and cloud document storage).</li>
      <li>We do not transfer or disclose your Google data to third parties, except as necessary to provide the service (e.g., database storage).</li>
      <li>We do not use your Google data for serving advertisements, retargeting, or interest-based profiling.</li>
      <li>We do not use your Google data or document content to train generalized artificial intelligence (AI) or machine learning (ML) models.</li>
    </ul>

    <h2>4. How we use information</h2>
    <ul>
      <li>Operate, secure, and improve the Service</li>
      <li>Respond to contact and support requests</li>
      <li>Provide optional share-link and realtime collaboration features</li>
      <li>Measure aggregate usage and fix errors</li>
      <li>Comply with law and enforce our Terms</li>
    </ul>

    <h2>5. Legal bases (EEA/UK)</h2>
    <p>
      Where GDPR applies: we process contact and share data on <strong>contract</strong> or{' '}
      <strong>legitimate interests</strong> (operating the Service); analytics on{' '}
      <strong>consent</strong> where required (you may refuse non-essential cookies via your browser or
      regional consent tools we provide).
    </p>

    <h2>6. Cookies and analytics</h2>
    <p>
      We may set or allow third-party cookies/SDKs for analytics (e.g. Google Analytics 4, Vercel
      Analytics). These help us see page views and events such as &quot;export PDF&quot; or &quot;landing
      CTA&quot; — not the text of your documents unless you separately submit it. You can block cookies in
      your browser; some features may still work without analytics.
    </p>

    <h2>7. Sharing with service providers</h2>
    <p>We use trusted processors, including:</p>
    <ul>
      <li>Hosting (e.g. Vercel) — serves the web application</li>
      <li>MongoDB Atlas — user accounts, cloud documents, contact messages, and cloud share storage</li>
      <li>Google Identity Services — authentication and Google sign-in</li>
      <li>Google Analytics 4 — aggregate usage analytics</li>
    </ul>
    <p>They process data only to provide services to us under their terms and security measures.</p>

    <h2>8. Retention</h2>
    <ul>
      <li>User accounts and documents: retained as long as your account is active, or until you delete individual documents.</li>
      <li>Contact messages: until resolved and for a reasonable period for support history, unless law
        requires longer retention.</li>
      <li>Cloud shares: until deleted by us or you, or after a reasonable inactivity period.</li>
      <li>Analytics: per provider default retention settings.</li>
    </ul>

    <h2>9. Security</h2>
    <p>
      We use HTTPS, row-level security on database tables where configured, and industry-standard
      practices. No method of transmission over the Internet is 100% secure; use cloud share only for
      non-sensitive content unless you accept the risk.
    </p>

    <h2>10. Your rights</h2>
    <p>
      Depending on your region, you may have rights to access, correct, delete, restrict, or port
      personal data, and to object or withdraw consent. Contact us at{' '}
      <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a>. You may lodge a complaint
      with your local supervisory authority.
    </p>

    <h2>11. Children</h2>
    <p>The Service is not directed at children under 16. We do not knowingly collect their data.</p>

    <h2>12. International transfers</h2>
    <p>
      Processors may be located outside your country. We rely on appropriate safeguards where required
      by law.
    </p>

    <h2>13. Changes</h2>
    <p>
      We may update this policy. The &quot;Last updated&quot; date will change. Continued use after
      changes constitutes acceptance where permitted by law.
    </p>

    <h2>14. Contact</h2>
    <p>
      Questions: <a href={`mailto:${LEGAL_CONTACT_EMAIL}`}>{LEGAL_CONTACT_EMAIL}</a> or the contact
      form on our homepage.
    </p>
  </LegalLayout>
);

export default PrivacyPolicyPage;
