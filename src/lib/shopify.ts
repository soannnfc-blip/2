const API_VERSION = "2025-01";

function shopConfig() {
  const domain = process.env.SHOPIFY_SHOP_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  if (!domain || !token) {
    throw new Error(
      "SHOPIFY_SHOP_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN manquants. Crée une app personnalisée dans " +
        "Shopify Admin (Paramètres > Apps et canaux de vente > Développer des apps), accorde les scopes " +
        "read_orders, read_products, read_customers, puis renseigne le token dans .env."
    );
  }
  return { domain, token };
}

export function isShopifyConfigured() {
  return !!(process.env.SHOPIFY_SHOP_DOMAIN && process.env.SHOPIFY_ADMIN_ACCESS_TOKEN);
}

async function shopifyFetch(path: string, init?: RequestInit) {
  const { domain, token } = shopConfig();
  const res = await fetch(`https://${domain}/admin/api/${API_VERSION}${path}`, {
    ...init,
    headers: {
      "X-Shopify-Access-Token": token,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Erreur Shopify (${res.status}): ${body}`);
  }
  return res.json();
}

export async function listRecentOrders(limit = 50) {
  const data = await shopifyFetch(`/orders.json?status=any&limit=${limit}&order=created_at+desc`);
  return data.orders as Array<{
    id: number;
    name: string;
    total_price: string;
    created_at: string;
    financial_status: string;
    customer?: { first_name?: string; last_name?: string; email?: string };
    line_items: Array<{ title: string; quantity: number; price: string }>;
  }>;
}

export async function getShopInfo() {
  const data = await shopifyFetch("/shop.json");
  return data.shop;
}
