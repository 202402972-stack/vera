import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { Mail, Phone, MapPin, ArrowLeft } from "lucide-react";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { useStore } from "@/hooks/useStore";
export default function InfoPage({ type }) {
  const { t } = useLanguage();
  const { store } = useStore();
  const title = {
    about: store.story.title,
    contact: "Contact",
    privacy: "Privacy Policy",
    terms: "Terms of Service",
    shipping: "Shipping & delivery",
    returns: "Returns & exchanges",
  }[type];
  return localizeView(
    <>
      <Helmet>
        <title>
          {title} - {store.name}
        </title>
      </Helmet>
      <Header />
      <main
        id="main-content"
        tabIndex={-1}
        className="max-w-4xl mx-auto px-6 py-20 min-h-[50vh]"
      >
        <Link
          to="/"
          className="inline-flex gap-2 items-center text-sm text-muted-foreground mb-8"
        >
          <ArrowLeft size={16} /> Back to store
        </Link>
        <h1 className="text-4xl md:text-5xl mb-8">{title}</h1>
        {type === "contact" ? (
          <div className="space-y-6 text-muted-foreground">
            <p>{store.footer.text}</p>
            <a
              className="flex gap-3 items-center"
              href={`mailto:${store.footer.email}`}
            >
              <Mail size={20} />
              <bdi dir="ltr">{store.footer.email}</bdi>
            </a>
            <a
              className="flex gap-3 items-center"
              href={`tel:${store.footer.phone}`}
            >
              <Phone size={20} />
              <bdi dir="ltr">{store.footer.phone}</bdi>
            </a>
            <p className="flex gap-3 items-center">
              <MapPin size={20} />
              {store.footer.location}
            </p>
          </div>
        ) : (
          <p className="text-lg text-muted-foreground leading-relaxed whitespace-pre-line">
            {type === "about"
              ? store.story.text
              : store.pages[type] ||
                (type === "shipping"
                  ? store.checkout.deliveryNote
                  : store.pages.terms)}
          </p>
        )}
      </main>
      <Footer />
    </>,
    t,
  );
}
