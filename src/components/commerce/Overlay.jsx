import React, { useRef } from "react";
import { useDialog } from "@/templates/gala/context";
export default function Overlay({ open, onClose, title, children }) {
  const ref = useRef(null);
  useDialog(open, ref, onClose);
  return open ? (
    <div
      className="commerce-overlay"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <section role="dialog" aria-modal="true" aria-label={title} ref={ref}>
        <header>
          <h2>{title}</h2>
          <button type="button" aria-label="Close / إغلاق" onClick={onClose}>
            ×
          </button>
        </header>
        {children}
      </section>
    </div>
  ) : null;
}
