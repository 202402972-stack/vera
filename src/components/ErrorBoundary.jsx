import { Component } from "react";
import { useLanguage } from "@/i18n/LanguageContext";

class Boundary extends Component {
  state = { failed: false };
  static getDerivedStateFromError() {
    return { failed: true };
  }
  render() {
    if (!this.state.failed) return this.props.children;
    const ar = this.props.language === "ar";
    return (
      <main className="min-h-screen grid place-items-center px-6">
        <div className="max-w-md text-center">
          <h1 className="text-4xl mb-5">
            {ar ? "تعذّر عرض الصفحة." : "Something interrupted your visit."}
          </h1>
          <p className="text-muted-foreground mb-7">
            {ar
              ? "جرّب إعادة تحميل الصفحة. إذا استمرت المشكلة، تواصل مع المتجر."
              : "Please reload the page. If this continues, contact the store."}
          </p>
          <button
            className="px-6 py-3 bg-primary text-primary-foreground rounded-lg"
            onClick={() => window.location.reload()}
          >
            {ar ? "إعادة التحميل" : "Reload page"}
          </button>
        </div>
      </main>
    );
  }
}
export default function ErrorBoundary({ children }) {
  const { language } = useLanguage();
  return <Boundary language={language}>{children}</Boundary>;
}
