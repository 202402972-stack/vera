import { sql, platformSetting, setPlatformSetting } from "./core.js";
import { rawDb } from "../db.js";
rawDb.exec(
  `CREATE TABLE IF NOT EXISTS platform_price_plans(id TEXT PRIMARY KEY,version INTEGER NOT NULL,currency TEXT NOT NULL,amount_minor INTEGER NOT NULL,interval_days INTEGER NOT NULL,provider TEXT NOT NULL,provider_reference TEXT NOT NULL,active INTEGER NOT NULL,created INTEGER NOT NULL);`,
);
if (
  !sql("PRAGMA table_info(platform_price_plans)")
    .all()
    .some((c) => c.name === "integration_ids")
)
  rawDb.exec(
    "ALTER TABLE platform_price_plans ADD COLUMN integration_ids TEXT",
  );
export function displayPricing() {
  return platformSetting("displayPricing", {
    version: 1,
    displayDefaultCurrency: "USD",
    displayPrices: {
      USD: platformSetting("marketingPriceCents", 150),
      EGP: null,
    },
  });
}
export function saveDisplayPricing(value) {
  if (
    !value ||
    !["USD", "EGP"].includes(value.displayDefaultCurrency) ||
    !value.displayPrices
  )
    throw Error("Choose USD or EGP and an approved price.");
  for (const c of ["USD", "EGP"]) {
    const n = value.displayPrices[c];
    if (n !== null && (!Number.isSafeInteger(n) || n < 1 || n > 10000000))
      throw Error("Invalid display price.");
  }
  if (!value.displayPrices[value.displayDefaultCurrency])
    throw Error("Default currency requires a price.");
  setPlatformSetting("displayPricing", {
    version: 1,
    displayDefaultCurrency: value.displayDefaultCurrency,
    displayPrices: {
      USD: value.displayPrices.USD,
      EGP: value.displayPrices.EGP,
    },
  });
}
export function providerPlan() {
  const currency = process.env.PAYMOB_CURRENCY,
    amount = Number(process.env.PAYMOB_AMOUNT_CENTS),
    reference = process.env.PAYMOB_PLAN_ID;
  if (
    !["USD", "EGP"].includes(currency) ||
    !Number.isSafeInteger(amount) ||
    amount <= 0 ||
    !reference
  )
    return null;
  const integrationIds = JSON.stringify(
    [
      Number(process.env.PAYMOB_INTEGRATION_ID),
      Number(process.env.PAYMOB_MOTO_ID),
    ].filter((n) => Number.isSafeInteger(n) && n > 0),
  );
  const old = sql(
    "SELECT * FROM platform_price_plans WHERE provider='paymob' AND currency=? AND amount_minor=? AND provider_reference=? AND integration_ids=? ORDER BY version DESC LIMIT 1",
  ).get(currency, amount, reference, integrationIds);
  if (old) return old;
  const version = sql(
      "SELECT coalesce(max(version),0)+1 n FROM platform_price_plans",
    ).get().n,
    id = "paymob-" + version;
  sql("UPDATE platform_price_plans SET active=0 WHERE provider='paymob'").run();
  sql(
    "INSERT INTO platform_price_plans(id,version,currency,amount_minor,interval_days,provider,provider_reference,active,created,integration_ids) VALUES(?,?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    version,
    currency,
    amount,
    30,
    "paymob",
    reference,
    1,
    Date.now(),
    integrationIds,
  );
  return sql("SELECT * FROM platform_price_plans WHERE id=?").get(id);
}

export function stripePlan(price) {
  if (
    !price.active ||
    !price.recurring ||
    !Number.isSafeInteger(price.unit_amount) ||
    price.unit_amount <= 0
  )
    throw Error("Approved fixed recurring price required");
  const previous = sql(
    "SELECT * FROM platform_price_plans WHERE provider='stripe' AND provider_reference=? AND currency=? AND amount_minor=?",
  ).get(price.id, price.currency.toUpperCase(), price.unit_amount);
  if (previous)
    return {
      ...previous,
      interval: price.recurring.interval,
      interval_count: price.recurring.interval_count,
    };
  const version = sql(
      "SELECT coalesce(max(version),0)+1 n FROM platform_price_plans",
    ).get().n,
    id = "stripe-" + version,
    days =
      ({ day: 1, week: 7, month: 30, year: 365 }[price.recurring.interval] ||
        30) * price.recurring.interval_count;
  sql("UPDATE platform_price_plans SET active=0 WHERE provider='stripe'").run();
  sql(
    "INSERT INTO platform_price_plans(id,version,currency,amount_minor,interval_days,provider,provider_reference,active,created) VALUES(?,?,?,?,?,?,?,?,?)",
  ).run(
    id,
    version,
    price.currency.toUpperCase(),
    price.unit_amount,
    days,
    "stripe",
    price.id,
    1,
    Date.now(),
  );
  return {
    ...sql("SELECT * FROM platform_price_plans WHERE id=?").get(id),
    interval: price.recurring.interval,
    interval_count: price.recurring.interval_count,
  };
}
