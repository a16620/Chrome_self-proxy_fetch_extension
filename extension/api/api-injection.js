(async ()=>{
    const bridge_message = (type, content) => new Promise((resolve, reject)=>{
        const req_id = crypto.randomUUID();
        
        const response_receiver = (event) => {
            if (event.source !== window) {
                return;
            }
        
            const packet = event.data;
            if (packet.type !== "response" || packet.id !== req_id) {
                return;
            }
        
            window.removeEventListener("message", response_receiver);
            
            const api_call_result = packet.content;
            if (api_call_result.ok) {
                resolve(api_call_result.response);
            } else {
                reject(new Error(api_call_result.error));
            }
        };
        
        window.addEventListener("message", response_receiver);
        window.postMessage({id: req_id, type: type, content: content});
    });

    const ENABLE_KEY = 'enable';
    const MODE_KEY = 'injection_mode';
    const INJ_NAMESPACE_KEY = "injection_name";

    const extension_config = await bridge_message('options', [ENABLE_KEY, MODE_KEY, INJ_NAMESPACE_KEY]);
    
    if (!extension_config[ENABLE_KEY]) {
        return;
    }

    const meta = document.querySelector('meta[name="api-helper"][content="enable"]');
    if (!meta) {
        return;
    }

    const injection_mode = extension_config[MODE_KEY] ?? 'container',
            injection_name = extension_config[INJ_NAMESPACE_KEY] ?? 'myAPI';
    if (injection_mode === 'override') {
        const original_fetch = window.fetch;
        window.fetch = async (url, options) => {
            try {
                return await original_fetch(url, options);
            } catch (org_err) {
                const raw_response = await bridge_message('fetch', { url, options });
                return new Response(new Uint8Array(raw_response.body), {
                    status: raw_response.status,
                    statusText: raw_response.statusText,
                    headers: raw_response.headers
                });
            }            
        };
        window.fetch2 = (url, options) => bridge_message('fetch', { url, options });
    } else {
        if (window[injection_name] !== undefined) {
            alert('작동 중단 경고: 프로그램이 기존에 존재하는 함수를 덮어쓰고 있습니다. 네임스페이스 이름 변경하세요.');
            return;
        }

        window[injection_name] = {
            fetch: (url, options) => bridge_message('fetch', { url, options })
        };
    }
})();