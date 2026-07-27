function clean(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function sellerIdFrom(href) {
  try { const u = new URL(href, location.href); return u.searchParams.get("seller") || u.searchParams.get("smid") || ""; }
  catch { return ""; }
}
function sleep(ms) { return new Promise(resolve => setTimeout(resolve, ms)); }
async function waitForOffers(timeout = 15000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    if (document.querySelector("#aod-offer")) return true;
    await sleep(300);
  }
  return false;
}
async function openAllBuyingOptions() {
  if (document.querySelector("#aod-offer")) return true;
  const selectors = [
    "#buybox-see-all-buying-choices",
    "#buybox-see-all-buying-choices-announce",
    "a[href*='offer-listing']",
    "a[href*='aod=1']"
  ];
  const button = selectors.map(selector => document.querySelector(selector)).find(Boolean);
  if (!button) return false;
  (button.closest("a, button") || button).click();
  return waitForOffers();
}
async function scrape() {
  const body = document.body?.innerText || "";
  if (/Enter the characters you see below|输入您在这个图片中看到的字符|CAPTCHA/i.test(body)) {
    return {ok: false, error: "Amazon触发验证码，请打开该Amazon页面完成人工验证后重试"};
  }
  await openAllBuyingOptions();
  const offers = [...document.querySelectorAll("#aod-offer")].map(node => {
    const sellerLink = node.querySelector("#aod-offer-soldBy a");
    const soldBy = node.querySelector("#aod-offer-soldBy");
    const price = node.querySelector(".a-price .a-offscreen");
    const text = clean(node.innerText);
    let sellerName = clean(sellerLink?.textContent || soldBy?.textContent?.replace(/Sold by|销售方|Verkauf durch|Vendido por|Vendeur/gi, ""));
    if (!sellerName && /Amazon/i.test(text)) sellerName = "Amazon";
    return {
      sellerName: sellerName || "未知卖家",
      sellerId: sellerIdFrom(sellerLink?.href),
      price: clean(price?.textContent),
      fulfillment: /Ships from\s+Amazon|Amazon配送|Versand durch Amazon|Expédié par Amazon/i.test(text) ? "FBA" : "FBM"
    };
  });
  if (!offers.length) {
    const buyingOptions = document.querySelector("#buybox-see-all-buying-choices, #buybox-see-all-buying-choices-announce");
    return {
      ok: false,
      error: buyingOptions
        ? "已找到购买选项入口，但报价侧栏未能加载。请切换到前台检测并检查验证码"
        : "商品页没有显示“查看所有购买选项”，当前可能只有一个报价或商品暂不可售"
    };
  }
  return {ok: true, offers, pageTitle: clean(document.title)};
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SCRAPE_OFFERS") return;
  scrape().then(sendResponse).catch(error => sendResponse({ok: false, error: error.message}));
  return true;
});
