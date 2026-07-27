function clean(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function sellerIdFrom(href) {
  try { const u = new URL(href, location.href); return u.searchParams.get("seller") || u.searchParams.get("smid") || ""; }
  catch { return ""; }
}
function first(selectors) {
  return selectors.map(selector => document.querySelector(selector)).find(Boolean);
}
function sellerNameFromText(text) {
  const value = clean(text);
  const patterns = [
    /Sold by\s+(.+?)(?:\s+Returns|\s+Payment|\s*$)/i,
    /销售方[：:\s]+(.+?)(?:\s+退换货|\s*$)/i,
    /Verkauf durch\s+(.+?)(?:\s+Rückgabe|\s*$)/i,
    /Vendido por\s+(.+?)(?:\s+Devoluciones|\s*$)/i,
    /Vendeur\s+(.+?)(?:\s+Retours|\s*$)/i
  ];
  for (const pattern of patterns) {
    const match = value.match(pattern);
    if (match) return clean(match[1]);
  }
  return "";
}
function scrape() {
  const body = document.body?.innerText || "";
  if (/Enter the characters you see below|输入您在这个图片中看到的字符|CAPTCHA/i.test(body)) {
    return {ok: false, error: "Amazon触发验证码，请打开该Amazon页面完成人工验证后重试"};
  }
  const sellerLink = first([
    "#sellerProfileTriggerId",
    "#tabular-buybox .tabular-buybox-text[tabular-attribute-name='Sold by'] a",
    "#shipsFromSoldBy_feature_div a[href*='seller=']",
    "#merchant-info a[href*='seller=']",
    "#merchant-info a[href*='smid=']"
  ]);
  const sellerArea = first([
    "#shipsFromSoldBy_feature_div",
    "#tabular-buybox",
    "#merchant-info",
    "#buybox"
  ]);
  let sellerName = clean(sellerLink?.textContent);
  if (!sellerName) sellerName = sellerNameFromText(sellerArea?.innerText);
  if (!sellerName && /Ships from and sold by Amazon|Sold by Amazon|销售和发货方.*Amazon|Amazon\.com/i.test(clean(sellerArea?.innerText))) {
    sellerName = location.hostname.endsWith("amazon.com") ? "Amazon.com" : "Amazon";
  }
  if (!sellerName) {
    return {ok: false, error: "商品页未检测到当前购物车卖家，可能当前没有Buy Box、商品不可售或页面尚未完全加载"};
  }
  const price = first([
    "#corePrice_feature_div .a-price .a-offscreen",
    "#price_inside_buybox",
    "#newBuyBoxPrice",
    "#apex_desktop .a-price .a-offscreen"
  ]);
  const sellerText = clean(sellerArea?.innerText);
  const offer = {
    sellerName,
    sellerId: sellerIdFrom(sellerLink?.href),
    price: clean(price?.textContent),
    fulfillment: /Ships from\s+Amazon|Amazon配送|Versand durch Amazon|Expédié par Amazon|Spedizione da Amazon/i.test(sellerText) ? "FBA" : "FBM"
  };
  return {ok: true, offers: [offer], buyBoxSeller: offer, pageTitle: clean(document.title)};
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SCRAPE_OFFERS") return;
  sendResponse(scrape());
});
