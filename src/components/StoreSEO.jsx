import React from "react";
import { Helmet } from "react-helmet";
import { useLocation } from "react-router-dom";
import { storeBase } from "@/lib/store-scope";
export default function StoreSEO() {
  const { pathname } = useLocation(),
    privatePage =
      /^\/(admin|account|saved|track|checkout|success)(\/|$)/.test(pathname) ||
      storeBase.startsWith("/demo/") ||
      new URLSearchParams(window.location.search).get("preview") === "1";
  return (
    <Helmet>
      {privatePage ? (
        <meta name="robots" content="noindex,nofollow" />
      ) : (
        <link
          rel="canonical"
          href={window.location.origin + storeBase + pathname}
        />
      )}
    </Helmet>
  );
}
