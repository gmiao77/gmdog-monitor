function startBridge() {
  if (!document.querySelector('meta[name="amazon-monitor-app"][content="v1"]')) return;
  window.addEventListener("message", async event => {
    const message = event.data;
    if (event.source !== window || message?.source !== "AMZ_MONITOR_WEB") return;
    try {
      const response = await chrome.runtime.sendMessage({type: message.type, payload: message.payload});
      window.postMessage({source: "AMZ_MONITOR_EXTENSION", id: message.id, ...response}, "*");
    } catch (error) {
      window.postMessage({source: "AMZ_MONITOR_EXTENSION", id: message.id, ok: false, error: error.message}, "*");
    }
  });
}
if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", startBridge, {once: true});
} else {
  startBridge();
}
