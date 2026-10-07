import { Link } from "react-router-dom";
import { Helmet } from "react-helmet";
import { useLanguage } from "@/i18n/LanguageContext";
import Header from "@/components/Header";
import Footer from "@/components/Footer";

export default function NotFoundPage() {
  const { language } = useLanguage(),
    ar = language === "ar";
  return (
    <>
      <Helmet>
        <title>{ar ? "الصفحة غير موجودة" : "Page not found"}</title>
        <meta name="robots" content="noindex" />
      </Helmet>
      <Header />
      <main id="main-content" tabIndex={-1} className="text-center px-6 py-28">
        <p className="text-primary tracking-widest text-sm mx-auto mb-6">404</p>
        <h1 className="text-5xl mb-6">
          {ar ? "هذه الصفحة لم تعد هنا." : "This page has moved on."}
        </h1>
        <p className="mx-auto text-muted-foreground mb-8">
          {ar
            ? "استكشف مجموعتنا أو تواصل معنا للمساعدة."
            : "Explore the collection, or get in touch for a little guidance."}
        </p>
        <Link
          className="inline-block bg-primary text-primary-foreground px-7 py-3 rounded-lg"
          to="/"
        >
          {ar ? "العودة إلى المتجر" : "Back to the boutique"}
        </Link>
      </main>
      <Footer />
    </>
  );
}
