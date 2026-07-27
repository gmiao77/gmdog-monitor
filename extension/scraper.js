function clean(text) { return String(text || "").replace(/\s+/g, " ").trim(); }
function sellerIdFrom(href) {
  try { const u = new URL(href, location.href); return u.searchParams.get("seller") || u.searchParams.get("smid") || ""; }
  catch { return ""; }
}
function scrape() {
  const body = document.body?.innerText || "";
  if (/Enter the characters you see below|输入您在这个图片中看到的字符|CAPTCHA/i.test(body)) {
    return {ok: false, error: "Amazon触发验证码，请打开该Amazon页面完成人工验证后重试"};
  }
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
  if (!offers.length) return {ok: false, error: "未读取到报价。可能当前没有其他报价，或Amazon页面结构发生变化"};
  return {ok: true, offers, pageTitle: clean(document.title)};
}
chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message.type !== "SCRAPE_OFFERS") return;
  sendResponse(scrape());
});
