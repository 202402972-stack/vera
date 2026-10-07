import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React from "react";
import { Link } from "react-router-dom";
import {
  Mail,
  Phone,
  MapPin,
  Instagram,
  Facebook,
  Link as LinkIcon,
} from "lucide-react";
import { useStore } from "@/hooks/useStore";
const Footer = () => {
  const { t } = useLanguage();
  const currentYear = new Date().getFullYear();
  const { store } = useStore();
  const quickLinks = store.footer.quickLinks;
  return localizeView(
    <footer
      id="contact"
      className="bg-secondary text-secondary-foreground mt-24 border-t border-border"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
          <div>
            <h3 className="text-2xl font-semibold mb-4">{store.name}</h3>
            <p className="text-secondary-foreground/80 leading-relaxed">
              {store.footer.text}
            </p>
          </div>

          <div>
            <h4 className="text-lg font-medium mb-4">Quick Links</h4>
            <ul className="space-y-2">
              {quickLinks.map((link) => (
                <li key={link.path}>
                  <Link
                    to={link.path}
                    className="text-secondary-foreground/80 hover:text-primary transition-colors duration-300"
                  >
                    {link.label}
                  </Link>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-lg font-medium mb-4">Contact</h4>
            <ul className="space-y-3">
              <li className="flex items-center gap-2 text-secondary-foreground/80">
                <Mail className="h-4 w-4" />
                <a href={`mailto:${store.footer.email}`}>
                  <bdi dir="ltr">{store.footer.email}</bdi>
                </a>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/80">
                <Phone className="h-4 w-4" />
                <a href={`tel:${store.footer.phone}`}>
                  <bdi dir="ltr">{store.footer.phone}</bdi>
                </a>
              </li>
              <li className="flex items-center gap-2 text-secondary-foreground/80">
                <MapPin className="h-4 w-4" />
                <span>{store.footer.location}</span>
              </li>
            </ul>
            {store.footer.socials.length > 0 && (
              <div className="flex flex-wrap gap-4 mt-5">
                {store.footer.socials.map((link) => (
                  <a
                    key={link.path}
                    href={link.path}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 text-secondary-foreground/80 hover:text-primary"
                    aria-label={link.label}
                  >
                    {/instagram/i.test(link.label) ? (
                      <Instagram size={16} />
                    ) : /facebook/i.test(link.label) ? (
                      <Facebook size={16} />
                    ) : (
                      <LinkIcon size={16} />
                    )}
                    <span className="text-sm">{link.label}</span>
                  </a>
                ))}
              </div>
            )}
          </div>
        </div>

        <div className="mt-12 pt-8 border-t border-border/50 flex flex-col md:flex-row justify-between items-center gap-4">
          <p className="text-sm text-secondary-foreground/70">
            © {currentYear} {store.name}. {store.footer.rights}
          </p>
          <div className="flex flex-wrap justify-center gap-4">
            <Link
              to="/shipping"
              className="text-sm text-secondary-foreground/70 hover:text-primary"
            >
              Shipping & delivery
            </Link>
            <Link
              to="/returns"
              className="text-sm text-secondary-foreground/70 hover:text-primary"
            >
              Returns & exchanges
            </Link>
            <Link
              to="/privacy"
              className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors duration-300"
            >
              Privacy Policy
            </Link>
            <Link
              to="/terms"
              className="text-sm text-secondary-foreground/70 hover:text-primary transition-colors duration-300"
            >
              Terms of Service
            </Link>
          </div>
        </div>
      </div>
      <div className="text-center pb-3">
        <Link
          to="/admin"
          className="text-[10px] text-secondary-foreground/40 hover:text-secondary-foreground/70"
        >
          Admin
        </Link>
      </div>
    </footer>,
    t,
  );
};
export default Footer;
