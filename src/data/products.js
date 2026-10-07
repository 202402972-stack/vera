// Original catalogue, used to seed a new database once. Manage live products in /admin.
// Prices are in cents. `stock: null` means unlimited.

const currency = { code: 'USD', symbol: '$', decimal_digits: 2 };

const products = [
  {
    id: 'alpaca-scarf',
    title: 'Alpaca Wool Scarf',
    subtitle: 'Soft, warm and lightweight',
    ribbon_text: 'Bestseller',
    description: 'A generously sized scarf woven from baby alpaca wool. Naturally warm, breathable and gentle on the skin.',
    color: '#b89f86',
    variants: [
      { id: 'alpaca-scarf-cream', title: 'Cream', price: 6500, stock: 20 },
      { id: 'alpaca-scarf-camel', title: 'Camel', price: 6500, stock: 12 },
      { id: 'alpaca-scarf-grey', title: 'Grey', price: 6500, sale: 5200, stock: 8 },
    ],
    additional_info: [
      { title: 'Material', description: '100% baby alpaca wool' },
      { title: 'Care', description: 'Hand wash cold, dry flat' },
    ],
  },
  {
    id: 'alpaca-beanie',
    title: 'Alpaca Wool Beanie',
    subtitle: 'Everyday knit hat',
    ribbon_text: '',
    description: 'A close-fitting ribbed beanie that keeps the cold out without itching.',
    color: '#8a7a6a',
    variants: [
      { id: 'alpaca-beanie-oat', title: 'Oat', price: 3800, stock: 25 },
      { id: 'alpaca-beanie-charcoal', title: 'Charcoal', price: 3800, stock: 15 },
    ],
    additional_info: [{ title: 'Material', description: '80% alpaca, 20% merino' }],
  },
  {
    id: 'alpaca-gloves',
    title: 'Alpaca Wool Gloves',
    subtitle: 'Warm fingers, all winter',
    ribbon_text: 'New',
    description: 'Fine-knit gloves with a soft fleece-like feel and a snug cuff.',
    color: '#a39080',
    variants: [
      { id: 'alpaca-gloves-s', title: 'Small', price: 4200, stock: 10 },
      { id: 'alpaca-gloves-m', title: 'Medium', price: 4200, stock: 14 },
      { id: 'alpaca-gloves-l', title: 'Large', price: 4200, stock: 0 },
    ],
    additional_info: [{ title: 'Material', description: '100% alpaca wool' }],
  },
  {
    id: 'alpaca-blanket',
    title: 'Alpaca Wool Throw Blanket',
    subtitle: 'Cozy up on the sofa',
    ribbon_text: '',
    description: 'A large, heavy throw with a brushed finish. Warmer than sheep wool and naturally hypoallergenic.',
    color: '#c9b9a3',
    variants: [{ id: 'alpaca-blanket-ivory', title: 'Ivory', price: 14500, stock: 6 }],
    additional_info: [
      { title: 'Size', description: '130 x 180 cm' },
      { title: 'Material', description: '100% alpaca wool' },
    ],
  },
];

const placeholder = (color, label) => {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="1000" viewBox="0 0 800 1000"><rect width="800" height="1000" fill="${color}"/><text x="400" y="510" font-family="Georgia,serif" font-size="44" fill="#ffffff" fill-opacity="0.85" text-anchor="middle">${label}</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
};

export const catalogue = products.map((p) => {
  const image = placeholder(p.color, p.title);
  return {
    id: p.id,
    title: p.title,
    subtitle: p.subtitle,
    ribbon_text: p.ribbon_text,
    description: p.description,
    image,
    images: [{ url: image }],
    purchasable: true,
    status: 'published',
    options: [],
    additional_info: p.additional_info.map((info, i) => ({ id: `${p.id}-info-${i}`, order: i, ...info })),
    variants: p.variants.map((v) => ({
      id: v.id,
      title: v.title,
      image_url: null,
      price_in_cents: v.price,
      sale_price_in_cents: v.sale ?? null,
      currency: currency.code,
      currency_info: currency,
      manage_inventory: v.stock !== null,
      inventory_quantity: v.stock,
      options: [],
    })),
  };
});
