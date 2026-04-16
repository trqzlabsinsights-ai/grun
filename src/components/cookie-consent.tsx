"use client";

import { useState, useEffect } from "react";
import { Cookie, X, Shield } from "lucide-react";

const CONSENT_KEY = "gangrun_cookie_consent";

type ConsentState = "accepted" | "declined" | null;

export function CookieConsent() {
  const [visible, setVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Check if user has already made a choice
    try {
      const stored = localStorage.getItem(CONSENT_KEY) as ConsentState;
      if (stored) {
        setVisible(false);
        return;
      }
    } catch {
      // localStorage not available
    }
    // Show banner after a brief delay so it doesn't flash on load
    const timer = setTimeout(() => setVisible(true), 800);
    return () => clearTimeout(timer);
  }, []);

  const handleAccept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "accepted");
    } catch {}
    setVisible(false);
    setDismissed(true);
  };

  const handleDecline = () => {
    try {
      localStorage.setItem(CONSENT_KEY, "declined");
    } catch {}
    setVisible(false);
    setDismissed(true);
  };

  const handleDismiss = () => {
    setVisible(false);
    setDismissed(true);
  };

  if (!visible || dismissed) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-[100] p-4 sm:p-6 animate-in slide-in-from-bottom-4 duration-500">
      <div className="max-w-4xl mx-auto bg-white border border-gray-200 rounded-2xl shadow-xl p-5 sm:p-6 relative">
        {/* Close button */}
        <button
          onClick={handleDismiss}
          className="absolute top-3 right-3 text-gray-400 hover:text-gray-600 transition-colors"
          aria-label="Dismiss"
        >
          <X className="w-4 h-4" />
        </button>

        <div className="flex flex-col sm:flex-row items-start gap-4">
          {/* Icon */}
          <div className="p-2.5 bg-amber-50 rounded-xl shrink-0">
            <Cookie className="w-6 h-6 text-amber-600" />
          </div>

          {/* Content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-2">
              <h3 className="text-sm font-semibold text-gray-900">Your Privacy Matters</h3>
              <Shield className="w-3.5 h-3.5 text-blue-500" />
            </div>
            <p className="text-sm text-gray-600 leading-relaxed mb-4">
              We use essential cookies to keep GangRun running smoothly &mdash; things like remembering your calculator preferences and session state. We don&rsquo;t use tracking cookies, advertising pixels, or third-party analytics. By clicking <strong>Accept</strong>, you consent to our use of these functional cookies. You can change your mind at any time.{" "}
              <a href="/privacy" className="text-blue-600 hover:text-blue-700 underline underline-offset-2">
                Read our Privacy Policy
              </a>
            </p>

            {/* Actions */}
            <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
              <button
                onClick={handleAccept}
                className="px-5 py-2 bg-blue-600 hover:bg-blue-700 text-white text-sm font-medium rounded-lg transition-colors"
              >
                Accept Cookies
              </button>
              <button
                onClick={handleDecline}
                className="px-5 py-2 bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 text-sm font-medium rounded-lg transition-colors"
              >
                Decline Non-Essential
              </button>
              <span className="text-xs text-gray-400">You can change this anytime</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
