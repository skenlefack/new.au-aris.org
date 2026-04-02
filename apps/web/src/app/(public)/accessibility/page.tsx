import Link from 'next/link';
import Image from 'next/image';
import { LandingHeader } from '@/components/landing/LandingHeader';

export const metadata = {
  title: 'Accessibility | ARIS 4.0 — AU-IBAR',
  description: 'Accessibility Statement for the Animal Resources Information System (ARIS) of the African Union Interafrican Bureau for Animal Resources.',
};

export default function AccessibilityPage() {
  return (
    <>
      <LandingHeader />
      <div className="mx-auto max-w-4xl px-4 py-12 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="mb-10 flex items-center gap-4">
          <Image src="/au-logo.png" alt="AU-IBAR" width={48} height={48} className="h-12 w-12 object-contain" />
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Accessibility Statement</h1>
            <p className="text-sm text-gray-500">Last updated: March 30, 2026</p>
          </div>
        </div>

        <div className="max-w-none text-gray-700 [&_a]:text-[#006B3F] [&_a]:underline [&_h2]:mb-3 [&_h2]:mt-8 [&_h2]:text-xl [&_h2]:font-bold [&_h2]:text-gray-900 [&_h3]:mb-2 [&_h3]:mt-5 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-gray-800 [&_li]:ml-5 [&_li]:list-disc [&_p]:mb-4 [&_p]:leading-relaxed [&_ul]:mb-4 [&_ul]:space-y-1">
          <h2>Our Commitment</h2>
          <p>
            AU-IBAR is committed to ensuring that the Animal Resources Information System (ARIS) is accessible
            to all users across the 55 African Union Member States, regardless of ability, technology, or
            connectivity conditions. As a continental platform serving diverse populations, accessibility is
            a core design principle, not an afterthought.
          </p>

          <h2>Standards and Guidelines</h2>
          <p>
            ARIS strives to conform to the <strong>Web Content Accessibility Guidelines (WCAG) 2.1</strong> at
            the <strong>AA level</strong>. We continuously work to improve the platform&apos;s accessibility in
            alignment with the AU Digital Transformation Strategy&apos;s principle of inclusive digital services.
          </p>

          <h2>Accessibility Features</h2>

          <h3>Multilingual Support</h3>
          <p>
            ARIS is available in <strong>four official languages</strong> of the African Union:
          </p>
          <ul>
            <li><strong>English</strong> &mdash; Full support</li>
            <li><strong>French (Fran&ccedil;ais)</strong> &mdash; Full support</li>
            <li><strong>Portuguese (Portugu&ecirc;s)</strong> &mdash; Full support</li>
            <li><strong>Arabic (&rlm;&#1575;&#1604;&#1593;&#1585;&#1576;&#1610;&#1577;&rlm;)</strong> &mdash; Full support with Right-to-Left (RTL) layout</li>
          </ul>
          <p>
            Users can switch languages at any time through the language selector. The mobile application
            also supports all four languages with proper RTL rendering for Arabic.
          </p>

          <h3>Visual Accessibility</h3>
          <ul>
            <li>
              <strong>High Contrast Mode</strong> &mdash; The platform automatically detects system-level
              accessibility settings and can enable high contrast color schemes for improved readability
            </li>
            <li>
              <strong>Color Independence</strong> &mdash; Information is never conveyed by color alone; icons,
              labels, and patterns complement color-coded elements (workflow status, data quality indicators)
            </li>
            <li>
              <strong>Scalable Typography</strong> &mdash; Text sizes use relative units (rem/sp) and respect
              browser and device font size preferences
            </li>
            <li>
              <strong>Domain Color Coding</strong> &mdash; Each of the 9 business domains uses a distinct
              color with sufficient contrast ratios, always paired with text labels and icons
            </li>
          </ul>

          <h3>Navigation and Interaction</h3>
          <ul>
            <li>
              <strong>Keyboard Navigation</strong> &mdash; All interactive elements are accessible via keyboard.
              Focus indicators are visible when navigating with Tab/Shift+Tab
            </li>
            <li>
              <strong>Screen Reader Support</strong> &mdash; Semantic HTML structure with proper heading hierarchy,
              ARIA labels, and landmark regions for screen reader compatibility
            </li>
            <li>
              <strong>Clear Form Labels</strong> &mdash; All form inputs include visible labels, placeholder text,
              and error messages that are programmatically associated with their fields
            </li>
            <li>
              <strong>Skip Navigation</strong> &mdash; Skip-to-content links allow keyboard users to bypass
              repetitive navigation elements
            </li>
          </ul>

          <h3>Mobile Application Accessibility</h3>
          <ul>
            <li>
              <strong>TalkBack Support</strong> &mdash; The Android application is built with Jetpack Compose,
              which provides native accessibility support for Android&apos;s TalkBack screen reader
            </li>
            <li>
              <strong>Biometric Authentication</strong> &mdash; Alternative authentication methods (fingerprint,
              PIN) accommodate users who may have difficulty typing complex passwords
            </li>
            <li>
              <strong>Offline Operation</strong> &mdash; The app works without internet connectivity, essential
              for field agents in remote areas with limited infrastructure
            </li>
            <li>
              <strong>Adaptive Layout</strong> &mdash; The app adapts to different screen sizes (phones and tablets)
              with responsive grid layouts
            </li>
            <li>
              <strong>Touch Target Size</strong> &mdash; Interactive elements meet minimum touch target sizes
              (48dp) for comfortable interaction
            </li>
          </ul>

          <h3>Connectivity Accessibility</h3>
          <p>
            Recognizing that many users operate in areas with limited or intermittent internet connectivity,
            ARIS includes:
          </p>
          <ul>
            <li>
              <strong>Offline-First Architecture</strong> &mdash; The mobile app stores data locally and
              synchronizes when connectivity is available
            </li>
            <li>
              <strong>Offline Maps</strong> &mdash; Map tiles can be downloaded in advance for use without
              internet access, with 11 predefined regional presets covering all African regions
            </li>
            <li>
              <strong>Low Bandwidth Optimization</strong> &mdash; Images are compressed, data payloads are
              minimized, and incremental sync reduces data usage
            </li>
            <li>
              <strong>Connectivity Indicator</strong> &mdash; A clear visual banner informs users when they
              are working offline, so they understand their data will sync later
            </li>
          </ul>

          <h3>Data and Document Accessibility</h3>
          <ul>
            <li>
              <strong>Export Formats</strong> &mdash; Data can be exported in CSV and JSON formats compatible
              with assistive technologies and standard data analysis tools
            </li>
            <li>
              <strong>Structured Tables</strong> &mdash; Data tables include proper headers, sorting controls,
              and pagination for manageable data consumption
            </li>
            <li>
              <strong>Chart Alternatives</strong> &mdash; Dashboard charts and visualizations include text-based
              KPI summaries that convey the same information in non-visual formats
            </li>
          </ul>

          <h2>Known Limitations</h2>
          <p>
            We are aware of the following accessibility limitations that we are actively working to address:
          </p>
          <ul>
            <li>Some complex data visualization charts (Canvas-rendered) may not be fully accessible to screen readers; text-based alternatives are provided where possible</li>
            <li>The embedded Leaflet map on the continental dashboard requires mouse or touch interaction; a data table alternative is planned</li>
            <li>PDF export formatting may not be fully optimized for screen reader consumption</li>
          </ul>

          <h2>Testing</h2>
          <p>
            We test ARIS accessibility using:
          </p>
          <ul>
            <li>Automated testing tools (axe-core, Lighthouse)</li>
            <li>Manual keyboard navigation testing</li>
            <li>Screen reader testing (TalkBack on Android, NVDA/JAWS on desktop)</li>
            <li>Color contrast analysis tools</li>
            <li>Testing across multiple device types and screen sizes</li>
          </ul>

          <h2>Feedback and Support</h2>
          <p>
            We welcome feedback on the accessibility of ARIS. If you encounter accessibility barriers or have
            suggestions for improvement, please contact us:
          </p>
          <p>
            <strong>AU-IBAR ARIS Accessibility</strong><br />
            Email: <a href="mailto:ibar.office@au-ibar.org">ibar.office@au-ibar.org</a><br />
            Address: Kenindia Business Park, Museum Hill, P.O. Box 30786-00100, Nairobi, Kenya
          </p>
          <p>
            We aim to respond to accessibility feedback within 5 business days and to resolve identified
            barriers in a timely manner.
          </p>

          <h2>Continuous Improvement</h2>
          <p>
            AU-IBAR is committed to continuously improving the accessibility of ARIS as part of our mandate
            to serve all 55 Member States equitably. Accessibility reviews are conducted with each major
            platform update, and user feedback directly informs our improvement priorities.
          </p>
        </div>

        <div className="mt-12 border-t border-gray-200 pt-6 text-center text-sm text-gray-500">
          <Link href="/" className="text-[#006B3F] hover:underline">&larr; Back to ARIS</Link>
        </div>
      </div>
    </>
  );
}
