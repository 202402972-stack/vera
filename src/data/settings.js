import { defaultBrand, defaultCommerce } from "./brand.js";
import { arabicStore } from "../i18n/content.js";
// Original storefront copy: also used to seed a new database exactly once.
export const defaultSettings = {
  brand: defaultBrand,
  commerce: defaultCommerce,
  translations: { ar: arabicStore },
  name: "Alpaca Wool Boutique",
  tagline: "Handcrafted Alpaca Wool Essentials",
  metaDescription:
    "Discover our collection of handcrafted alpaca wool essentials, ethically sourced and lovingly made for those who appreciate quality and craftsmanship.",
  hero: {
    title: "Handcrafted Alpaca Wool Luxury",
    text: "Discover our curated collection of ethically sourced sweaters, hats, socks, and scarves. Lovingly made for those who appreciate timeless craftsmanship and unparalleled warmth.",
    image: "/assets/hero.jpg",
    alt: "Handcrafted alpaca wool luxury",
    button: "Shop Collection",
  },
  story: {
    title: "Our Story",
    text: "At Alpaca Wool Boutique, we believe in the beauty of slow fashion and sustainable craftsmanship. Each piece in our collection is thoughtfully created from ethically sourced alpaca wool, known for its exceptional softness, warmth, and durability. We partner with artisan communities who share our commitment to quality and environmental stewardship, ensuring every item tells a story of care and tradition.",
  },
  collection: {
    title: "Our Collection",
    text: "Discover handcrafted alpaca wool pieces designed to last a lifetime",
  },
  footer: {
    text: "Handcrafted alpaca wool essentials, ethically sourced and lovingly made for those who appreciate quality and craftsmanship.",
    email: "hello@yourexample.com",
    phone: "+1 (555) 123-4567",
    location: "Portland, Oregon",
    rights: "All rights reserved.",
    quickLinks: [
      { path: "/", label: "Home" },
      { path: "/shop", label: "Shop" },
      { path: "/about", label: "About" },
      { path: "/contact", label: "Contact" },
    ],
    socials: [],
  },
  pages: {
    shipping:
      "Delivery availability and fees are confirmed at checkout. Contact the store for estimated delivery times before placing your order.",
    returns:
      "Contact the store with your order number to request a return or cancellation. The store will confirm eligibility and next steps under its terms and applicable law.",
    privacy:
      "We use the information you provide at checkout to fulfil your order. First-party analytics record pages visited and store interactions using anonymous browser identifiers. We do not store full IP addresses or payment card details. Your browser’s Do Not Track setting is respected. Contact us to request access to or deletion of your order information.",
    terms:
      "Orders are paid by cash on delivery. Availability and final totals are confirmed when your order is placed. Contact the store for delivery arrangements, returns, and cancellation requests.",
  },
  checkout: {
    currency: "USD",
    symbol: "$",
    shippingInCents: 0,
    deliveryNote:
      "We will contact you to arrange delivery. Pay in cash when your order arrives.",
  },
};
