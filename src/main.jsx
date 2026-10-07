import React, { lazy, Suspense } from "react";
import ReactDOM from "react-dom/client";
import { MotionConfig } from "framer-motion";
import { BrowserRouter } from "react-router-dom";
import ErrorBoundary from "@/components/ErrorBoundary";
import { LanguageProvider } from "@/i18n/LanguageContext";
import { storeBase } from "@/lib/store-scope";
import "@/index.css";
const Platform = lazy(() => import("@/platform/Platform"));
const StoreRoot = lazy(() => import("@/templates/StoreRoot"));
let platformConfig = null,
  failed = false;
if (!storeBase) {
  try {
    const response = await fetch("/api/platform/config");
    if (response.ok) platformConfig = await response.json();
    else if (response.status !== 404) failed = true;
  } catch {
    failed = true;
  }
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <MotionConfig reducedMotion="user">
    <LanguageProvider>
      <ErrorBoundary>
        <Suspense
          fallback={
            <main className="p-12 text-center" role="status">
              …
            </main>
          }
        >
          {failed ? (
            <main className="p-12 text-center" role="alert">
              <p>
                تعذر تحميل الخدمة. حاول مجددًا. / Unable to load. Please retry.
              </p>
              <button onClick={() => window.location.reload()}>
                إعادة المحاولة / Retry
              </button>
            </main>
          ) : platformConfig ? (
            <BrowserRouter>
              <Platform initialConfig={platformConfig} />
            </BrowserRouter>
          ) : (
            <StoreRoot />
          )}
        </Suspense>
      </ErrorBoundary>
    </LanguageProvider>
  </MotionConfig>,
);
