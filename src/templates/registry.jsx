import React, { lazy, Suspense } from "react";
import { useStore } from "@/hooks/useStore";
const renderers = { boutique: lazy(() => import("@/App.jsx")) };
export default function TemplateRenderer() {
  const { store } = useStore();
  const Component = renderers[store._template?.renderer || "boutique"];
  if (!Component)
    return (
      <main className="p-10 text-center" role="alert">
        This template is temporarily unavailable.
      </main>
    );
  return (
    <Suspense
      fallback={
        <div className="p-10 text-center" role="status">
          …
        </div>
      }
    >
      <Component />
    </Suspense>
  );
}
