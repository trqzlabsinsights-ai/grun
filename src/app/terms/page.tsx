import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Terms of Service — GangRun",
  description: "Terms and conditions for using the GangRun Plate Optimization Calculator.",
};

export default function TermsPage() {
  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 flex flex-col">
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

      <main className="max-w-4xl w-full mx-auto px-4 sm:px-6 py-10 flex-grow">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-8 sm:p-12">
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Terms of Service</h1>
          <p className="text-sm text-gray-500 mb-8">Last updated: April 2026</p>

          <div className="prose prose-gray max-w-none space-y-8">
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Welcome to GangRun</h2>
              <p className="text-gray-600 leading-relaxed">
                By using the GangRun Plate Optimization Calculator, you agree to these terms. We tried to keep them straightforward and human-readable, because nobody enjoys reading fine print. The short version: this tool helps you optimize plate layouts, it&apos;s provided as-is, and you should always verify results before going to press.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">What GangRun Does</h2>
              <p className="text-gray-600 leading-relaxed">
                GangRun is a computational tool that calculates optimized plate layouts for gang run printing. It takes your input parameters &mdash; sheet dimensions, bleed settings, and project specifications &mdash; and uses our proprietary algorithm to suggest the most efficient arrangement of your projects on a printing plate. The results include estimated outs, run lengths, material yields, and visual plate layouts to help you make informed production decisions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Accuracy and Verification</h2>
              <p className="text-gray-600 leading-relaxed">
                While we strive for accuracy in every calculation, GangRun is a planning and estimation tool, not a replacement for professional pre-press verification. Printing involves physical variables &mdash; press tolerances, material behavior, blade accuracy, and more &mdash; that no algorithm can fully account for. Always verify layouts with your print shop or pre-press technician before committing to a production run. We are not liable for material waste, production errors, or financial losses resulting from the use of calculated layouts without proper verification.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Fair Use</h2>
              <p className="text-gray-600 leading-relaxed">
                GangRun is free to use for individuals and businesses. We ask that you use the tool responsibly &mdash; no automated scraping, excessive API calls, or attempts to reverse-engineer our algorithm. We reserve the right to limit access for users who place undue load on our infrastructure. This helps us keep the tool fast and available for everyone.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Intellectual Property</h2>
              <p className="text-gray-600 leading-relaxed">
                The GangRun name, logo, and algorithm are our intellectual property. You may not use our branding or redistribute our software without explicit permission. However, the results generated from your own input data belong to you &mdash; use them however you see fit in your production workflow.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Limitation of Liability</h2>
              <p className="text-gray-600 leading-relaxed">
                GangRun is provided &ldquo;as is&rdquo; without warranties of any kind, either express or implied. In no event shall we be liable for any indirect, incidental, special, or consequential damages arising out of or in connection with the use of this tool. Your use of GangRun is entirely at your own risk, and you assume full responsibility for any decisions made based on its output.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Changes to These Terms</h2>
              <p className="text-gray-600 leading-relaxed">
                We may update these terms from time to time. Any changes will be posted on this page with an updated revision date. Continued use of GangRun after changes are posted constitutes acceptance of the revised terms. If you disagree with any changes, your recourse is to stop using the tool.
              </p>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 GangRun Plate Optimization. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-blue-600 transition-colors text-blue-600">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
