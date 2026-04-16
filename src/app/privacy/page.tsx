import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy — GangRun",
  description: "How GangRun handles your data, privacy, and information security.",
};

export default function PrivacyPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 py-4 flex items-center justify-between">
          <a href="/" className="flex items-center gap-3 hover:opacity-80 transition-opacity">
            <div className="p-2 bg-blue-50 rounded-lg">
              <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="w-6 h-6 text-blue-600">
                <rect width="7" height="7" x="3" y="3" rx="1"></rect>
                <rect width="7" height="7" x="14" y="3" rx="1"></rect>
                <rect width="7" height="7" x="14" y="14" rx="1"></rect>
                <rect width="7" height="7" x="3" y="14" rx="1"></rect>
              </svg>
            </div>
            <span className="text-xl font-bold text-gray-900">GangRun</span>
          </a>
          <a href="/" className="text-sm text-blue-600 hover:text-blue-700 transition-colors font-medium">
            &larr; Back to Calculator
          </a>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Privacy Policy</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Your Data, Your Control</h2>
              <p className="text-gray-600 leading-relaxed">
                At GangRun, we believe that your printing data is exactly that &mdash; yours. Every dimension, quantity, and layout configuration you enter into our calculator stays right where it belongs: between you and your browser. We do not collect, store, or transmit your project details to any external server for analytics, marketing, or any other purpose. When you close the tab, your data disappears with it.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">What We Process</h2>
              <p className="text-gray-600 leading-relaxed">
                When you click &ldquo;Calculate,&rdquo; your input parameters (sheet dimensions, bleed settings, and project specifications) are sent to our server solely for the purpose of computing your optimized plate layout. The calculation happens in real-time, and the result is returned directly to your browser. We do not persist your input data on our servers after the calculation is complete. No databases, no logs of your project specs, no hidden archives.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">No Tracking, No Cookies</h2>
              <p className="text-gray-600 leading-relaxed">
                We use minimal, functional-only cookies required to keep the application running smoothly &mdash; things like session state for the calculator interface. We do not use third-party analytics trackers, advertising pixels, or fingerprinting techniques. We don&rsquo;t follow you around the internet after you leave. Your visit to GangRun is nobody&rsquo;s business but your own.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Third-Party Services</h2>
              <p className="text-gray-600 leading-relaxed">
                GangRun may use standard web infrastructure services (such as CDN providers for delivering static assets) that inherently process basic connection data like IP addresses. These services are bound by their own privacy policies and do not have access to the content of your calculations. We carefully evaluate any third-party service before integration to ensure it aligns with our privacy-first philosophy.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to This Policy</h2>
              <p className="text-gray-600 leading-relaxed">
                If we ever change how we handle data &mdash; and we mean ever &mdash; we will update this page prominently and transparently. We will never quietly alter our privacy practices in a way that reduces your protections. If you have questions about this policy, feel free to reach out through our Support page.
              </p>
            </section>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-gray-200 bg-white py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 GangRun Plate Optimization. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-blue-600 transition-colors text-blue-600">Privacy</a>
            <a href="/terms" className="hover:text-blue-600 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
