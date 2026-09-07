const WHITELIST_KEY = "whitelist";

 function normalizePath(url) {
    const u = new URL(url);
    return u.origin + u.pathname;
}

const sender_is_in_white_list = async (sender) => {
	const wlist = (await chrome.storage.local.get(WHITELIST_KEY))[WHITELIST_KEY] ?? [];
  	return (await chrome.permissions.contains({permissions:['scripting']})) && wlist.includes(normalizePath(sender.url));
}

const api_is_in_white_list = async (url) => {
	if (typeof url !== 'string' && !(url instanceof String)) {
		return false;
	}

	if (!url.startsWith("http")) {
		url = "http://" + url;
	}

	const api_target = (new URL(url)).origin+'/*';
    return await chrome.permissions.contains({
        origins: [api_target]
    });
}

const handle_request = async (message, sender) => {
	const allow = await sender_is_in_white_list(sender);
	if (!allow) {
		throw "API에 접근 불가능한 파일입니다.";
	}

	const { url, options=null } = message;
	if (!await api_is_in_white_list(url)) {
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