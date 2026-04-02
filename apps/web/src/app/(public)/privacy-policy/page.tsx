import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/LandingHeader';

export const metadata = {
  title: 'Privacy Policy | ARIS 4.0 — AU-IBAR',
  description: 'Privacy Policy for the Animal Resources Information System (ARIS) of the African Union Interafrican Bureau for Animal Resources.',
};

export default function PrivacyPolicyPage() {
  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Privacy Policy</h1>
            <p className="text-sm text-gray-500">Last updated: March 30, 2026</p>
          </div>
        </div>

        <div className="max-w-none text-gray-700 [&_a]:text-[#006B3F] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-4 [&_p]:leading-relaxed [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_ul]:mb-4 [&_ul]:space-y-1">
          <h2>1. Introduction</h2>
          <p>
            The African Union Interafrican Bureau for Animal Resources (AU-IBAR), headquartered in Nairobi, Kenya,
            operates the Animal Resources Information System (ARIS) &mdash; a continental digital platform serving
            55 Member States and 8 Regional Economic Communities (RECs). This Privacy Policy describes how we collect,
            use, protect, and share information through the ARIS platform, including the web application
            (<strong>au-aris.org</strong>) and the ARIS mobile application.
          </p>

          <h2>2. Data Controller</h2>
          <p>
            <strong>AU-IBAR</strong><br />
            Kenindia Business Park, Museum Hill<br />
            P.O. Box 30786-00100, Nairobi, Kenya<br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            Website: <a href="https://www.au-ibar.org" target="_blank" rel="noopener noreferrer">www.au-ibar.org</a>
          </p>

          <h2>3. Information We Collect</h2>

          <h3>3.1 Account Information</h3>
          <p>When your organization registers you as an ARIS user, we collect:</p>
          <ul>
            <li>Full name, email address, and professional role</li>
            <li>Organizational affiliation (Member State, REC, or AU-IBAR)</li>
            <li>User role and domain access permissions</li>
            <li>Language preference (English, French, Portuguese, or Arabic)</li>
          </ul>

          <h3>3.2 Animal Resources Data</h3>
          <p>
            ARIS collects official animal resources data submitted by authorized national officers across 9 business
            domains: Animal Health, Livestock Production, Fisheries &amp; Aquaculture, Trade &amp; SPS, Wildlife &amp;
            Biodiversity, Apiculture, Climate &amp; Environment, Governance, and Knowledge Management. This data is
            submitted under the authority of each Member State and remains under national sovereignty.
          </p>

          <h3>3.3 Location Data (Mobile App)</h3>
          <p>
            The ARIS mobile application may collect GPS coordinates when:
          </p>
          <ul>
            <li>Recording field observations (outbreak locations, farm coordinates)</li>
            <li>Tracking transhumance corridors and field agent movements</li>
            <li>Geotagging photographs taken during field operations</li>
          </ul>
          <p>
            Location collection requires explicit user permission and can be disabled at any time through device settings.
            Location data is only collected while actively performing field operations.
          </p>

          <h3>3.4 Device and Technical Information</h3>
          <p>We automatically collect:</p>
          <ul>
            <li>Device identifier (for push notification delivery)</li>
            <li>Application version and operating system</li>
            <li>Network connectivity status (for offline sync management)</li>
            <li>Crash logs and error reports (for application improvement)</li>
          </ul>

          <h3>3.5 Photographs</h3>
          <p>
            Field agents may capture photographs as evidence for surveillance events, outbreak reports, or field
            inspections. These photos are stored securely and associated with the relevant data submission.
            EXIF metadata (including GPS coordinates and timestamp) may be retained for verification purposes.
          </p>

          <h2>4. How We Use Information</h2>
          <p>We use the collected information to:</p>
          <ul>
            <li>Operate and improve the ARIS platform and its services</li>
            <li>Enable data collection, validation, and reporting across Member States</li>
            <li>Generate continental dashboards, analytics, and KPI reports</li>
            <li>Facilitate the 4-level data validation workflow</li>
            <li>Support interoperability with international systems (WAHIS, EMPRES, FAOSTAT)</li>
            <li>Send push notifications for outbreak alerts and campaign updates</li>
            <li>Provide technical support and resolve issues</li>
            <li>Ensure platform security and prevent unauthorized access</li>
          </ul>

          <h2>5. Data Classification and Sharing</h2>
          <p>
            All data in ARIS is classified according to four levels, in line with the AU Digital Transformation
            Strategy:
          </p>
          <table>
            <thead>
              <tr>
                <th>Classification</th>
                <th>Description</th>
                <th>Access</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>PUBLIC</strong></td>
                <td>Aggregated statistics, continental dashboards</td>
                <td>Open access</td>
              </tr>
              <tr>
                <td><strong>PARTNER</strong></td>
                <td>Shared with authorized organizations (WOAH, FAO, WHO)</td>
                <td>Authenticated partners</td>
              </tr>
              <tr>
                <td><strong>RESTRICTED</strong></td>
                <td>Individual outbreak data, unconfirmed reports</td>
                <td>Authorized national officers only</td>
              </tr>
              <tr>
                <td><strong>CONFIDENTIAL</strong></td>
                <td>User credentials, security configurations</td>
                <td>System administrators only</td>
              </tr>
            </tbody>
          </table>
          <p>
            Data classified as RESTRICTED or CONFIDENTIAL is never shared publicly. Official disease notifications
            to WOAH via WAHIS are made exclusively by authorized WAHIS Focal Points, respecting national sovereignty.
          </p>

          <h2>6. Data Sovereignty</h2>
          <p>
            ARIS operates under the principle of <strong>federated subsidiarity</strong>: data is produced and
            validated at the country level. Each Member State retains sovereignty over its national data.
            AU-IBAR consolidates data at the continental level only after it has been officially validated through
            the 4-level workflow. No country-level data is published without the explicit approval of the
            national authority (Chief Veterinary Officer or designated official).
          </p>

          <h2>7. Data Security</h2>
          <p>We implement industry-standard security measures including:</p>
          <ul>
            <li>End-to-end encryption (TLS 1.3) for all data in transit</li>
            <li>AES-256 encryption for sensitive data at rest</li>
            <li>JWT RS256 token-based authentication with automatic expiration</li>
            <li>Multi-Factor Authentication (MFA TOTP) for privileged accounts</li>
            <li>Role-Based Access Control (RBAC) with 8 distinct roles</li>
            <li>Comprehensive audit trail for all data mutations</li>
            <li>Encrypted local storage on mobile devices (EncryptedSharedPreferences)</li>
            <li>Biometric authentication option on mobile devices</li>
            <li>Regular security assessments and penetration testing</li>
          </ul>

          <h2>8. Data Retention</h2>
          <p>
            Animal resources data is retained for the duration necessary to fulfill ARIS&apos;s mandate as the
            AU continental information system. Historical data is essential for trend analysis, epidemiological
            modelling, and policy evaluation. User accounts are maintained for the duration of employment in
            an authorized role and may be deactivated upon request from the relevant national authority.
          </p>

          <h2>9. Your Rights</h2>
          <p>Authorized users have the right to:</p>
          <ul>
            <li>Access their personal account information</li>
            <li>Request correction of inaccurate personal data</li>
            <li>Request account deactivation through their national administrator</li>
            <li>Export their submitted data in standard formats (CSV, JSON)</li>
            <li>Opt out of non-essential push notifications</li>
          </ul>

          <h2>10. International Data Transfers</h2>
          <p>
            ARIS servers are hosted in secure data centers. Data may be transferred between Member States and
            AU-IBAR headquarters in accordance with the AU Convention on Cyber Security and Personal Data
            Protection (Malabo Convention, 2014) and applicable national data protection laws.
          </p>

          <h2>11. Cookies and Analytics</h2>
          <p>
            The ARIS web platform uses essential cookies for session management and authentication. We do not
            use third-party advertising cookies. Anonymous usage analytics may be collected to improve the
            platform experience.
          </p>

          <h2>12. Children&apos;s Privacy</h2>
          <p>
            ARIS is a professional platform designed for authorized government officials and organizational
            personnel. It is not intended for use by individuals under 18 years of age.
          </p>

          <h2>13. Changes to This Policy</h2>
          <p>
            We may update this Privacy Policy to reflect changes in our practices or applicable regulations.
            Users will be notified of significant changes through the ARIS platform. The &quot;Last updated&quot;
            date at the top indicates the most recent revision.
          </p>

          <h2>14. Contact Us</h2>
          <p>
            For questions about this Privacy Policy or data protection matters, contact:
          </p>
          <p>
            <strong>AU-IBAR Data Protection Officer</strong><br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            Address: Kenindia Business Park, Museum Hill, P.O. Box 30786-00100, Nairobi, Kenya
          </p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-[#006B3F] hover:underline">&larr; Back to ARIS</Link>
        </div>
      </div>
    </>
  );
}
