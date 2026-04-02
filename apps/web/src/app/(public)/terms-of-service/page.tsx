import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/LandingHeader';

export const metadata = {
  title: 'Terms of Service | ARIS 4.0 — AU-IBAR',
  description: 'Terms of Service for the Animal Resources Information System (ARIS) of the African Union Interafrican Bureau for Animal Resources.',
};

export default function TermsOfServicePage() {
  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Terms of Service</h1>
            <p className="text-sm text-gray-500">Last updated: March 30, 2026</p>
          </div>
        </div>

        <div className="max-w-none text-gray-700 [&_a]:text-[#006B3F] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:ml-5 [&_li]:list-disc [&_li]:marker:text-gray-400 [&_ol_li]:list-decimal [&_p]:mb-4 [&_p]:leading-relaxed [&_table]:my-4 [&_table]:w-full [&_table]:border-collapse [&_td]:border [&_td]:border-gray-200 [&_td]:px-3 [&_td]:py-2 [&_td]:text-sm [&_th]:border [&_th]:border-gray-200 [&_th]:bg-gray-50 [&_th]:px-3 [&_th]:py-2 [&_th]:text-left [&_th]:text-sm [&_th]:font-semibold [&_ul]:mb-4 [&_ul]:space-y-1">
          <h2>1. Acceptance of Terms</h2>
          <p>
            By accessing or using the Animal Resources Information System (ARIS), operated by the African Union
            Interafrican Bureau for Animal Resources (AU-IBAR), you agree to be bound by these Terms of Service.
            ARIS is a restricted-access platform; access is granted only to authorized personnel of AU Member States,
            Regional Economic Communities (RECs), and partner organizations.
          </p>

          <h2>2. Description of Service</h2>
          <p>
            ARIS is a continental digital infrastructure providing:
          </p>
          <ul>
            <li>Data collection and reporting for animal resources across 9 business domains</li>
            <li>A 4-level data validation workflow (National Data Steward &rarr; CVO &rarr; REC &rarr; AU-IBAR)</li>
            <li>Continental dashboards, analytics, and KPI monitoring</li>
            <li>Interoperability with international systems (WAHIS, EMPRES, FAOSTAT, FishStatJ, CITES)</li>
            <li>Mobile field data collection with offline capability</li>
            <li>Document management and knowledge sharing</li>
            <li>Real-time outbreak alerts and push notifications</li>
          </ul>

          <h2>3. User Accounts and Access</h2>

          <h3>3.1 Account Creation</h3>
          <p>
            ARIS accounts are created by authorized administrators (National Admins, REC Admins, or AU-IBAR
            Super Admins). Self-registration is not available. Each user is assigned a specific role
            determining their access level and permissions.
          </p>

          <h3>3.2 User Roles</h3>
          <table>
            <thead>
              <tr>
                <th>Role</th>
                <th>Responsibilities</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>Super Admin</strong></td>
                <td>Full system administration (AU-IBAR ICT)</td>
              </tr>
              <tr>
                <td><strong>Continental Admin</strong></td>
                <td>AU-IBAR program officers, continental oversight</td>
              </tr>
              <tr>
                <td><strong>REC Admin</strong></td>
                <td>Regional coordination and data harmonization</td>
              </tr>
              <tr>
                <td><strong>National Admin</strong></td>
                <td>National administration (CVO office)</td>
              </tr>
              <tr>
                <td><strong>Data Steward</strong></td>
                <td>Data quality assurance and validation</td>
              </tr>
              <tr>
                <td><strong>WAHIS Focal Point</strong></td>
                <td>Authorized WOAH disease reporters</td>
              </tr>
              <tr>
                <td><strong>Analyst</strong></td>
                <td>Read-only access for research and analysis</td>
              </tr>
              <tr>
                <td><strong>Field Agent</strong></td>
                <td>Mobile data collection in the field</td>
              </tr>
            </tbody>
          </table>

          <h3>3.3 Account Security</h3>
          <p>Users are responsible for:</p>
          <ul>
            <li>Maintaining the confidentiality of their login credentials</li>
            <li>Enabling Multi-Factor Authentication (MFA) when required by their administrator</li>
            <li>Reporting any suspected unauthorized access immediately</li>
            <li>Logging out of shared or public devices after each session</li>
            <li>Using the PIN lock or biometric authentication feature on mobile devices</li>
          </ul>

          <h2>4. Data Submission and Accuracy</h2>

          <h3>4.1 Official Data</h3>
          <p>
            Users authorized to submit data acknowledge that their submissions represent official information
            from their respective organizations. All data must pass ARIS quality gates before publication:
          </p>
          <ol>
            <li><strong>Completeness</strong> &mdash; Key fields must be filled</li>
            <li><strong>Temporal consistency</strong> &mdash; Dates must be logically ordered</li>
            <li><strong>Geographic consistency</strong> &mdash; Locations must be valid</li>
            <li><strong>Codes &amp; vocabularies</strong> &mdash; Must use approved referentials</li>
            <li><strong>Units</strong> &mdash; Must be consistent (SI + sectoral)</li>
            <li><strong>Deduplication</strong> &mdash; No duplicate records</li>
            <li><strong>Auditability</strong> &mdash; Source and validation status documented</li>
          </ol>

          <h3>4.2 WAHIS Notifications</h3>
          <p>
            Official disease notifications to the World Organisation for Animal Health (WOAH) via the WAHIS
            system are exclusively the responsibility of designated WAHIS Focal Points. ARIS facilitates the
            preparation of WAHIS-ready data packages but does not automatically submit notifications to WOAH.
            Each notification remains a sovereign act of the Member State.
          </p>

          <h2>5. Acceptable Use</h2>
          <p>Users agree NOT to:</p>
          <ul>
            <li>Share login credentials with unauthorized individuals</li>
            <li>Submit knowingly false or misleading data</li>
            <li>Attempt to access data outside their authorized scope</li>
            <li>Use automated tools to scrape or extract bulk data without authorization</li>
            <li>Circumvent security controls, access restrictions, or audit mechanisms</li>
            <li>Use ARIS data for commercial purposes without written authorization from AU-IBAR</li>
            <li>Publish RESTRICTED or CONFIDENTIAL data without proper authorization</li>
            <li>Interfere with the platform&apos;s operation or other users&apos; access</li>
          </ul>

          <h2>6. Intellectual Property</h2>
          <p>
            The ARIS platform, including its software, design, documentation, and analytical methodologies,
            is the property of AU-IBAR. The data submitted by Member States remains under the sovereignty
            of the submitting country. Aggregated and analytical outputs produced by ARIS are co-owned by
            AU-IBAR and the contributing Member States, subject to the data classification rules.
          </p>

          <h2>7. Audit Trail and Accountability</h2>
          <p>
            All actions within ARIS are logged in a comprehensive audit trail, including:
          </p>
          <ul>
            <li>Data creation, modification, and deletion</li>
            <li>Validation approvals and rejections with reasons</li>
            <li>User login and logout events</li>
            <li>Data exports and interoperability operations</li>
          </ul>
          <p>
            The audit trail is immutable and may be reviewed for compliance, dispute resolution, or
            security investigations.
          </p>

          <h2>8. Service Availability</h2>
          <p>
            AU-IBAR endeavors to maintain ARIS availability 24/7. However, we reserve the right to perform
            scheduled maintenance (typically communicated in advance) and cannot guarantee uninterrupted
            service. The mobile application includes offline capabilities to ensure data collection can
            continue during connectivity disruptions.
          </p>

          <h2>9. Account Suspension and Termination</h2>
          <p>
            AU-IBAR or the relevant national administrator may suspend or terminate a user account for:
          </p>
          <ul>
            <li>Violation of these Terms of Service</li>
            <li>Submission of fraudulent data</li>
            <li>Security breaches or unauthorized access attempts</li>
            <li>End of official mandate or employment</li>
            <li>Request from the user&apos;s supervising authority</li>
          </ul>

          <h2>10. Limitation of Liability</h2>
          <p>
            ARIS is provided &quot;as is&quot; for official use by AU Member States. AU-IBAR shall not be liable
            for decisions made based on data within the platform. Users and Member States are responsible
            for verifying the accuracy of data before using it for official notifications, policy decisions,
            or public communications. Analytical dashboards carry appropriate provenance disclaimers.
          </p>

          <h2>11. Governing Framework</h2>
          <p>
            These Terms are governed by the applicable frameworks of the African Union, including:
          </p>
          <ul>
            <li>AU Constitutive Act</li>
            <li>AU Digital Transformation Strategy 2020&ndash;2030</li>
            <li>AU Convention on Cyber Security and Personal Data Protection (Malabo Convention)</li>
            <li>AU-IBAR Strategic Plan 2024&ndash;2028</li>
            <li>Livestock Development Strategy for Africa (LiDeSA)</li>
            <li>Policy Framework for Pastoralism in Africa (PFRS)</li>
          </ul>

          <h2>12. Modifications</h2>
          <p>
            AU-IBAR reserves the right to update these Terms of Service. Users will be notified of material
            changes through the ARIS platform. Continued use of the platform after notification constitutes
            acceptance of the updated terms.
          </p>

          <h2>13. Contact</h2>
          <p>
            For questions about these Terms of Service, contact:
          </p>
          <p>
            <strong>AU-IBAR ARIS Support</strong><br />
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
