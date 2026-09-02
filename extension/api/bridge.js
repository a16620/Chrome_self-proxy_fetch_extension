const WHITELIST_KEY = "whitelist";
const ENABLE_KEY = "enable";

const normalizePath = (url) => {
  const u = new URL(url);
  return u.origin + u.pathname;
}

chrome.storage.local.get([WHITELIST_KEY, ENABLE_KEY]).then((config)=>{

    if (!config[ENABLE_KEY] || !config[WHITELIST_KEY].includes(normalizePath(location.href))) {
        return;
    }

    window.addEventListener("message", async (event) => {
        if (event.source !== window) {
            return;
        }

        const packet = event.data;
        const acceptable = ['options', 'fetch'];

        if (!acceptable.includes(packet.type)) {
            return;
        }

        try {
            if (packet.type === "options") {
                window.postMessage({id: packet.id, type: "response", content: {ok: true, response: await chrome.storage.local.get(packet.content)}});
                return;
            } else if (packet.type === "fetch") {
                window.postMessage({id: packet.id, type: "response", content: await chrome.runtime.sendMessage(packet.content)});
                return;
            }
        } catch(err) {
            window.postMessage({id: packet.id, type: "response", content: {ok: false, error: err.toString()} });
        }
    });

});