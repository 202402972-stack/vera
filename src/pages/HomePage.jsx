import { useLanguage, localizeView } from "@/i18n/LanguageContext";
import React, { useRef } from "react";
import { Helmet } from "react-helmet";
import { Link } from "react-router-dom";
import { motion } from "framer-motion";
import { ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import Header from "@/components/Header.jsx";
import Footer from "@/components/Footer.jsx";
import { useStore } from "@/hooks/useStore";
import ProductsList from "@/components/ProductsList.jsx";
const HomePage = () => {
  const { t } = useLanguage();
  const productsRef = useRef(null);
  const { store } = useStore();
  const handleScrollToProducts = (e) => {
    e.preventDefault();
    if (productsRef.current) {
      productsRef.current.scrollIntoView({
        behavior: "smooth",
        block: "start",
      });
    }
  };
  return localizeView(
    <>
      <Helmet>
        <title>
          {store.name} - {store.tagline}
        </title>
        <meta name="description" content={store.metaDescription} />
      </Helmet>

      <Header />

      <main id="main-content" tabIndex={-1}>
        <section className="grid grid-cols-1 md:grid-cols-2 min-h-[85dvh] bg-background">
          {/* Mobile: Image on top. Desktop: Image on right */}
          <div className="order-1 md:order-2 relative h-[50vh] md:h-auto overflow-hidden">
            <img
              fetchPriority="high"
              width="1600"
              height="1800"
              src={store.hero.image}
              alt={store.hero.alt}
              className="absolute inset-0 w-full h-full object-cover"
            />
          </div>

          {/* Mobile: Text below. Desktop: Text on left */}
          <div className="order-2 md:order-1 flex flex-col justify-center px-6 py-16 md:px-12 lg:px-24 xl:px-32">
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              animate={{
                opacity: 1,
                y: 0,
              }}
              transition={{
                duration: 0.8,
                ease: "easeOut",
              }}
              className="max-w-xl"
            >
              <h1 className="text-4xl md:text-5xl lg:text-6xl xl:text-7xl font-semibold mb-6 text-foreground leading-tight">
                {store.hero.title}
              </h1>
              <p className="text-lg md:text-xl text-muted-foreground mb-10 leading-relaxed">
                {store.hero.text}
              </p>
              <motion.div
                initial={{
                  opacity: 0,
                }}
                animate={{
                  opacity: 1,
                }}
                transition={{
                  delay: 0.3,
                  duration: 0.6,
                }}
              >
                <Button
                  onClick={handleScrollToProducts}
                  size="lg"
                  className="store-cta font-medium text-lg px-8 py-6 rounded-xl group transition-colors"
                >
                  <span className="inline-flex items-center gap-2">
                    {store.hero.button}
                    <ArrowRight className="h-5 w-5 group-hover:translate-x-1 transition-transform duration-300" />
                  </span>
                </Button>
              </motion.div>
            </motion.div>
          </div>
        </section>

        {store.brand?.showStory !== false && (
          <section id="story" className="py-24 bg-muted/50">
            <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
              <motion.div
                initial={{
                  opacity: 0,
                  y: 20,
                }}
                whileInView={{
                  opacity: 1,
                  y: 0,
                }}
                viewport={{
                  once: true,
                }}
                transition={{
                  duration: 0.6,
                }}
              >
                <h2 className="text-3xl md:text-4xl font-semibold mb-6 text-foreground">
                  {store.story.title}
                </h2>
                <p className="text-lg text-muted-foreground leading-relaxed mx-auto">
                  {store.story.text}
                </p>
              </motion.div>
            </div>
          </section>
        )}

        <section
          id="collection"
          ref={productsRef}
          className="py-24 bg-background scroll-mt-20"
        >
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <motion.div
              initial={{
                opacity: 0,
                y: 20,
              }}
              whileInView={{
                opacity: 1,
                y: 0,
              }}
              viewport={{
                once: true,
              }}
              transition={{
                duration: 0.6,
              }}
              className="text-center mb-16"
            >
              <h2 className="text-4xl md:text-5xl font-semibold mb-4 text-foreground">
                {store.collection.title}
              </h2>
              <p className="text-lg text-muted-foreground max-w-2xl mx-auto">
                {store.collection.text}
              </p>
            </motion.div>

            <ProductsList />
          </div>
        </section>
      </main>

      <Footer />
    </>,
    t,
  );
};
export default HomePage;
