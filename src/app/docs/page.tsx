import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Documentation — GangRun",
  description: "Learn how to use the GangRun Plate Optimization Calculator effectively.",
};

export default function DocsPage() {
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
          <h1 className="text-3xl font-bold text-gray-900 mb-2">Documentation</h1>
          <p className="text-sm text-gray-500 mb-8">Everything you need to get the most out of GangRun</p>

          <div className="prose prose-gray max-w-none space-y-8">
            {/* Getting Started */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Getting Started</h2>
              <p className="text-gray-600 leading-relaxed">
                GangRun is a plate optimization calculator designed for gang run printing. If you&apos;ve ever manually tried to figure out how many stickers of different sizes can fit on a single sheet &mdash; and how many sheets you need to order to fulfill all your projects &mdash; you know how tedious and error-prone that process can be. GangRun automates that entire workflow. You enter your sheet size, your bleed requirements, and a list of projects (each with its own dimensions and order quantity), and our algorithm does the heavy lifting to find the most material-efficient layout.
              </p>
            </section>

            {/* Input Parameters */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Input Parameters</h2>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Sheet Size</h3>
              <p className="text-gray-600 leading-relaxed">
                This is the physical dimensions of the printing plate or master stock sheet you&apos;ll be feeding into the press. Enter the width and height in inches. Common sheet sizes include 12&times;18, 24&times;16.5, and 25&times;19. The algorithm evaluates both portrait and landscape orientations of your stickers relative to the sheet, so the order of width vs. height on the sheet itself doesn&apos;t affect the result &mdash; but it should match what your print shop actually uses.
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Bleed</h3>
              <p className="text-gray-600 leading-relaxed">
                Bleed is the extra printed area beyond the final trim line, measured in millimeters per side, per group. A standard bleed of 5mm ensures that minor shifts in the cutting blade won&apos;t leave unsightly white borders on your finished stickers. GangRun adds bleed equally on all four sides of each sticker group. If your project doesn&apos;t require bleed (for example, edge-to-edge designs or kiss-cut products), you can set this to 0.
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Projects</h3>
              <p className="text-gray-600 leading-relaxed">
                Each project represents a distinct sticker design that needs to be printed. For every project, you provide a name (for your reference), the sticker dimensions (width and height in inches), and the order quantity (how many you need produced). The algorithm requires a minimum of 2 outs per project per plate &mdash; this is a physical constraint that ensures each project is meaningfully represented on the plate layout. If a project&apos;s stickers are too large to fit at least 2 times on a sheet, you&apos;ll see a suggestion to use a larger sheet size or split projects across multiple plates.
              </p>
            </section>

            {/* Understanding Results */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Understanding Your Results</h2>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Outs</h3>
              <p className="text-gray-600 leading-relaxed">
                &ldquo;Outs&rdquo; is the industry term for how many copies of a particular project fit on a single sheet. If Project A has 10 outs, that means 10 identical stickers for Project A are printed on each pass through the press. Higher outs mean fewer total sheets are needed to fulfill the order, which translates directly to lower material costs.
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Run Length</h3>
              <p className="text-gray-600 leading-relaxed">
                The run length is the number of sheets that need to be printed for a particular plate configuration. It&apos;s calculated by dividing the project with the highest order quantity by its outs, then rounding up. For example, if Project A needs 6844 stickers and has 10 outs, the run length is 685 sheets (6844 &divide; 10 = 684.4, rounded up).
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Material Yield</h3>
              <p className="text-gray-600 leading-relaxed">
                Material yield is the percentage of the sheet area that&apos;s actually occupied by sticker artwork (including bleed). A yield of 90% means only 10% of the sheet is wasted space. Higher yields mean more efficient use of material. The algorithm strives to maximize yield by filling gaps and rotating stickers to fit more per sheet.
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Overage</h3>
              <p className="text-gray-600 leading-relaxed">
                Because run lengths are rounded up, you&apos;ll almost always produce more stickers than you ordered. This extra production is called overage. While it means slightly more material cost, overage is generally considered acceptable (even desirable) in the printing industry to account for spoilage during cutting and finishing.
              </p>
            </section>

            {/* Plate Configurations */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Plate Configurations</h2>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Single Plate</h3>
              <p className="text-gray-600 leading-relaxed">
                All projects are arranged on a single plate. This is the most cost-effective option when all projects can fit together with at least 2 outs each. You only pay for one plate setup, and all projects are printed simultaneously on every sheet. However, if the projects have very different order quantities, the smaller-quantity projects will produce significant overage.
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Two Plates</h3>
              <p className="text-gray-600 leading-relaxed">
                Projects are split across two separate plates, each with its own run length. This is beneficial when projects have highly disparate order quantities &mdash; for example, when one project needs thousands of copies while others need only hundreds. By separating the high-volume project onto its own plate, you reduce the overage on lower-volume projects. The trade-off is an additional plate setup cost, but the material savings often outweigh it.
              </p>

              <h3 className="text-lg font-medium text-gray-800 mt-6 mb-2">Multiple Plates</h3>
              <p className="text-gray-600 leading-relaxed">
                When the sheet size is too small to accommodate all projects even on two plates, the algorithm explores configurations with three or more plates. Each plate runs independently with its own run length and layout. This is common with smaller sheet sizes or when projects have very large sticker dimensions relative to the available space.
              </p>
            </section>

            {/* Tips */}
            <section>
              <h2 className="text-xl font-semibold text-gray-900 mb-3">Pro Tips</h2>
              <ul className="space-y-3 text-gray-600">
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 shrink-0">&#x2022;</span>
                  <span><strong>Rotation is automatic.</strong> You don&apos;t need to manually swap width and height &mdash; the algorithm tries both orientations and picks the best one for each sticker.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 shrink-0">&#x2022;</span>
                  <span><strong>Compare plate options.</strong> Always check both the Single and Two Plate tabs. Sometimes the material savings from a two-plate setup more than justify the extra plate cost.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 shrink-0">&#x2022;</span>
                  <span><strong>Watch the yield.</strong> If you see a yield below 75%, consider whether a different sheet size might pack more efficiently. Small changes in sheet dimensions can have a big impact.</span>
                </li>
                <li className="flex items-start gap-2">
                  <span className="text-blue-600 font-bold mt-0.5 shrink-0">&#x2022;</span>
                  <span><strong>Overage is normal.</strong> Don&apos;t worry about producing 5-15% more than ordered &mdash; this is standard in gang run printing and provides a buffer for cutting spoilage.</span>
                </li>
              </ul>
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
