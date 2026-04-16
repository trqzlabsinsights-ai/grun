import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Support — GangRun",
  description: "Get help with the GangRun Plate Optimization Calculator.",
};

export default function SupportPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Support</h1>
          <p className="text-sm text-gray-500 mb-8">We&apos;re here to help you get the most out of GangRun</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* FAQ */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-4">Frequently Asked Questions</h2>

              <div className="space-y-6">
                <div>
                  <h3 className="text-base font-medium text-gray-800 mb-2">Why does the calculator say my projects can&apos;t fit on a single plate?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Every project needs at least 2 outs on a plate. If your stickers are large relative to your sheet size, there may not be enough room to give every project at least 2 slots. Try using a larger sheet size, or let the algorithm explore two-plate or multi-plate configurations where projects can be split across separate plates.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-gray-800 mb-2">The yield seems low on one of my plates. Is something wrong?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    A low yield on a particular plate usually means the sticker dimensions don&apos;t tile efficiently on that sheet size. For example, 3.5&times;4.5 stickers on a 12&times;18 sheet leave a narrow strip that&apos;s too small for another sticker. This is a geometric constraint, not a bug. Consider a different sheet size that&apos;s a better multiple of your sticker dimensions.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-gray-800 mb-2">Should I always choose the option with the fewest sheets?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Fewer sheets generally means lower material cost, but remember that each additional plate requires a separate setup and run. A two-plate solution that saves 500 sheets might still be more expensive than a single-plate solution if the plate setup cost is high. Consider both material savings and plate costs when making your decision.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-gray-800 mb-2">Does GangRun account for grain direction?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    The current version of GangRun optimizes purely for material efficiency (maximizing the number of stickers per sheet). Grain direction is displayed on the visual layout for your reference, but the algorithm does not constrain placement based on grain. If grain direction is critical for your application, we recommend using the visual layout as a starting point and manually adjusting as needed.
                  </p>
                </div>

                <div>
                  <h3 className="text-base font-medium text-gray-800 mb-2">Can I enter dimensions in centimeters or millimeters?</h3>
                  <p className="text-gray-600 leading-relaxed">
                    Currently, GangRun accepts sticker dimensions in inches and bleed in millimeters (which is the standard in the printing industry). If you work in metric, simply convert your sticker dimensions to inches before entering them (1 inch = 25.4mm). We&apos;re considering adding unit selection in a future update.
                  </p>
                </div>
              </div>
            </section>

            {/* Common Issues */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Common Issues</h2>

              <div className="space-y-4">
                <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
                  <h3 className="text-base font-medium text-amber-800 mb-1">Calculation seems slow for many projects</h3>
                  <p className="text-amber-700 text-sm leading-relaxed">
                    The algorithm performs an exhaustive search across all possible plate splits, which grows with the number of projects. For 5+ projects, calculations may take a few seconds. This is intentional &mdash; thoroughness ensures you get the best result. Quality takes a few extra clock cycles.
                  </p>
                </div>

                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                  <h3 className="text-base font-medium text-blue-800 mb-1">Two-plate result shows more sheets than single plate</h3>
                  <p className="text-blue-700 text-sm leading-relaxed">
                    This can happen when the projects have similar order quantities and similar-sized stickers. In such cases, splitting across plates doesn&apos;t save material. The calculator always shows all options so you can compare, even when single plate is optimal.
                  </p>
                </div>
              </div>
            </section>

            {/* Contact */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Get in Touch</h2>
              <p className="text-gray-600 leading-relaxed">
                Have a question that&apos;s not covered here? Found a bug? Have a feature request? We&apos;d love to hear from you. The best way to reach us is through our GitHub repository where you can open an issue or start a discussion. We actively monitor submissions and typically respond within 24-48 hours.
              </p>
              <div className="mt-4">
                <a
                  href="https://github.com/trqzlabs-ai/grun"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-5 py-2.5 bg-gray-900 text-white rounded-lg text-sm font-medium hover:bg-gray-800 transition-colors"
                >
                  <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>
                  Open an Issue on GitHub
                </a>
              </div>
            </section>
          </div>
        </div>
      </main>

      <footer className="border-t border-gray-200 bg-white py-6 mt-auto">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-4 text-sm text-gray-500">
          <p>&copy; 2026 GangRun Plate Optimization. All rights reserved.</p>
          <div className="flex gap-4">
            <a href="/privacy" className="hover:text-blue-600 transition-colors">Privacy</a>
            <a href="/terms" className="hover:text-blue-600 transition-colors">Terms</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
