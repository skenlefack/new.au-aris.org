export const metadata = {
  title: 'Privacy Policy — ARIS',
};

export default function PrivacyPolicyPage() {
  return (
    <div className="mx-auto max-w-3xl px-6 py-16 text-gray-800">
      <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
      <p className="text-sm text-gray-500 mb-8">Last updated: May 8, 2026</p>

      <div className="space-y-6 text-sm leading-relaxed">
        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">1. Introduction</h2>
          <p>
            ARIS (Animal Resources Information System) is operated by the African Union &mdash;
            Inter-African Bureau for Animal Resources (AU-IBAR). This Privacy Policy explains how
            we collect, use, and protect information through the ARIS mobile application and web
            platform.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">2. Information We Collect</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li><strong>Account information:</strong> Name, email address, role, and organisation provided during registration by your national administrator.</li>
            <li><strong>Data collection submissions:</strong> Animal health reports, vaccination records, livestock census data, and other domain-specific data submitted through campaigns.</li>
            <li><strong>Location data:</strong> GPS coordinates captured during field data collection, used to geolocate observations and outbreaks. Location is only captured when you explicitly use the GPS feature.</li>
            <li><strong>Photos:</strong> Images attached to submissions as evidence, captured via the device camera. Photos are only taken when you choose to attach them.</li>
            <li><strong>Device information:</strong> Device identifier for synchronisation, app version, and operating system version.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">3. How We Use Information</h2>
          <ul className="list-disc pl-6 space-y-1">
            <li>To facilitate animal resource data collection across 55 AU Member States.</li>
            <li>To produce continental dashboards, analytics, and reports for AU-IBAR programmes.</li>
            <li>To support disease surveillance (WAHIS, EMPRES) and early warning systems.</li>
            <li>To validate and ensure the quality of submitted data through the 4-level workflow.</li>
            <li>To synchronise offline data when connectivity is restored.</li>
          </ul>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">4. Data Storage and Security</h2>
          <p>
            Data is stored on secured servers hosted by AU-IBAR. The mobile application stores data
            locally on your device using encrypted storage for offline use. Data is transmitted using
            TLS encryption. Access is controlled through role-based access control (RBAC) with
            JWT authentication and optional multi-factor authentication (MFA).
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">5. Data Sharing</h2>
          <p>
            Data is shared within the AU-IBAR federated system following the principle of subsidiarity:
            national data remains under national sovereignty. Aggregated and anonymised data may be
            shared with international partners (WOAH, FAO) through official interoperability channels.
            We do not sell personal data to third parties.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">6. Camera and Location Permissions</h2>
          <p>
            The app requests camera permission to allow you to attach photographic evidence to field
            submissions. Location permission is used to geolocate field observations. Both permissions
            are optional and only activated when you use the respective features. You can revoke these
            permissions at any time through your device settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">7. Data Retention</h2>
          <p>
            Submitted data is retained as part of the continental animal resources database for
            historical analysis and reporting. Local data on your device is automatically cleaned
            after successful synchronisation (30-day retention for synced submissions).
            You can clear local data at any time from the app settings.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">8. Your Rights</h2>
          <p>
            You may request access to, correction of, or deletion of your personal data by contacting
            your national administrator or AU-IBAR directly. Account management is handled by
            authorised administrators within the RBAC framework.
          </p>
        </section>

        <section>
          <h2 className="text-lg font-semibold text-gray-900 mb-2">9. Contact</h2>
          <p>
            For questions about this Privacy Policy or data protection matters, contact:
          </p>
          <p className="mt-2">
            <strong>AU-IBAR</strong><br />
            African Union &mdash; Inter-African Bureau for Animal Resources<br />
            Kenindia Business Park, Museum Hill, Westlands Road<br />
            P.O. Box 30786-00100, Nairobi, Kenya<br />
            Email: <a href="mailto:ibar.office@african-union.org" className="text-blue-600 hover:underline">ibar.office@african-union.org</a>
          </p>
        </section>
      </div>
    </div>
  );
}
