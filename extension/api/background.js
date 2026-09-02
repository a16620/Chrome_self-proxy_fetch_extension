const WHITELIST_KEY = "whitelist";
const api_white_list = new Set(["dummyjson.com", "water.nier.go.kr"]);

const normalizePath = (url) => {
  const u = new URL(url);
  return u.origin + u.pathname;
}

async function sender_is_in_white_list(sender) {
  const res = await chrome.storage.local.get(WHITELIST_KEY);
  const whitelist = res[WHITELIST_KEY] ?? [];

  try {
    return whitelist.includes(normalizePath(sender.url));
  } catch {
    return false;
  }
}

const api_is_in_white_list = (url) => {
	if (typeof url !== 'string' && !(url instanceof String)) {
		return false;
	}

	if (!url.startsWith("http")) {
		url = "http://" + url;
	}

	const url_information = new URL(url);
	return api_white_list.has(url_information.host);
}

const handle_request = async (message, sender) => {
	const allow = await sender_is_in_white_list(sender);
	if (!allow) {
		throw "API에 접근 불가능한 파일입니다.";
	}

	const { url, options=null } = message;
	if (!api_is_in_white_list(url)) {
		throw "허용되지 않은 api입니다.";
	}

	return await fetch(url, options);
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
	handle_request(message, sender)
	.then(async (response)=>sendResponse({
		ok: true,
		response: {
			status: response.status,
    		statusText: response.statusText,
    		headers: Object.fromEntries(response.headers.entries()),
			body: Array.from(await response.bytes())
		}
	}))
	.catch((err)=>sendResponse({ok: false, error: err.toString()}));
    return true;
});