document.addEventListener('DOMContentLoaded', async ()=>{
  const WHITELIST_KEY = "whitelist";
  const ENABLE_KEY = "enable";
  const MODE_KEY = "injection_mode";
  const INJ_NAMESPACE_KEY = "injection_name";

  function normalizePath(url) {
    const u = new URL(url);
    return u.origin + u.pathname;
  }

  function makeMatchURLs(url) {
    return [url, url+'?*', url+'#*'];
  }

  async function getCurrentPath() {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
    if (!tab?.url) return null;
    try {
      return normalizePath(tab.url);
    } catch {
      return null;
    }
  }

  async function isGrantOrigin(path) {
    const wl = (await chrome.storage.local.get(WHITELIST_KEY))[WHITELIST_KEY] ?? [];
    return wl.includes(path);
  }

  async function requestGrantOrigin(path) {
    try {
      const wl = (await chrome.storage.local.get(WHITELIST_KEY))[WHITELIST_KEY] ?? [];
      if (wl.includes(path)) {
        return true;
      }

      await chrome.storage.local.set({
        [WHITELIST_KEY]: [...wl, path]
      });

      console.log((await chrome.storage.local.get(WHITELIST_KEY))[WHITELIST_KEY])

      return true;
    } catch (err) {
      return false;
    }
  }

  async function removeGrantOrigin(path) {
    const HOOK_BRIDGE = 'hook-bridge-', HOOK_IINJECTION = 'hook-inject-';
    try {
      await chrome.scripting.unregisterContentScripts({ids: [HOOK_BRIDGE+path, HOOK_IINJECTION+path]});
    } catch (error) {
      //스크립트가 등록 안된 경우에 오류 발생 => 그냥 무시
    }

    const wl = (await chrome.storage.local.get(WHITELIST_KEY))[WHITELIST_KEY] ?? [];
    await chrome.storage.local.set({
      [WHITELIST_KEY]: wl.filter((p) => p !== path)
    });
  }

  async function registerScript(path) {
    const HOOK_BRIDGE = 'hook-bridge-', HOOK_IINJECTION = 'hook-inject-';
    const script = await chrome.scripting.getRegisteredContentScripts({ids: [HOOK_BRIDGE+path, HOOK_IINJECTION+path]});
    if (script.length > 0) {
      return;
    }

    const match = makeMatchURLs(path);
    return await chrome.scripting.registerContentScripts([
      {
        "id": HOOK_BRIDGE+path,
        "matches": match,
        "js": ["./api/bridge.js"],
        "runAt": "document_end",
        "world": "ISOLATED"
      },
      {
        "id": HOOK_IINJECTION+path,
        "matches": match,
        "js": ["./api/api-injection.js"],
        "runAt": "document_end",
        "world": "MAIN"
      }
    ]);
  }

  async function getWhiteList() {
    return (await chrome.permissions.getAll()).origins ?? [];
  }

  async function initSettings() {
    const res = await chrome.storage.local.get([ENABLE_KEY, MODE_KEY, INJ_NAMESPACE_KEY]);
    const enabled = res[ENABLE_KEY] ?? false;                 // 기본값: 꺼짐
    const mode = res[MODE_KEY] ?? "container";                // 기본값: container
    let inj_namespace = res[INJ_NAMESPACE_KEY] ?? "myAPI";    // 기본값: myAPI

    const enableToggle = document.getElementById("enable-toggle");
    const modeSelect = document.getElementById("mode-select");
    const divNamespace = document.getElementById("div-extension-namespace");
    const inputNamespace = document.getElementById("input-extension-namespace");

    divNamespace.style.display = (mode === 'container') ? '' : 'none';
    inputNamespace.value = inj_namespace;
    enableToggle.checked = enabled;
    modeSelect.value = mode;

    inputNamespace.addEventListener("change", async() => {
      let name = inputNamespace.value;
      const is_valid = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(name)
      if (!is_valid) {
        inputNamespace.value = inj_namespace;
        alert('네임스페이스 이름으로 사용할 수 없습니다');
        return;
      }
      await chrome.storage.local.set({ [INJ_NAMESPACE_KEY]: name });
      inj_namespace = name;
    });

    enableToggle.addEventListener("change", async () => {
      const value = enableToggle.checked;
      await chrome.storage.local.set({ [ENABLE_KEY]: value });
    });

    modeSelect.addEventListener("change", async () => {
      divNamespace.style.display = (modeSelect.value === 'container') ? '' : 'none';
      await chrome.storage.local.set({ [MODE_KEY]: modeSelect.value });
    });
  }


  async function renderToggle() {
    const currentPath = await getCurrentPath();
    const grant = await isGrantOrigin(currentPath);

    const notAvilableEl = document.getElementById("current-script-not-available");
    const toggleBtn = document.getElementById("toggle-current-btn");

    if (!currentPath || !currentPath.startsWith("file:///")) {
      notAvilableEl.style.display = '';
      toggleBtn.style.display = 'none';
    } else {
      notAvilableEl.style.display = 'none';
      toggleBtn.style.display = '';

      toggleBtn.textContent = grant ? "Fetch 제거" : "Fetch 등록";
      toggleBtn.className = grant ? "remove" : "add";
    }
  }

  document.getElementById("toggle-current-btn").addEventListener("click", async () => {
    const currentPath = await getCurrentPath();
    if (!currentPath) return;

    const grant = await isGrantOrigin(currentPath);

    if (grant) {
      await removeGrantOrigin(currentPath);
    } else {
      if (!await requestGrantOrigin(currentPath)) {
        alert('등록 실패')
        return;
      }
      await registerScript(currentPath);
    }
    renderToggle();
  });

  async function renderWhitelist() {
    const ul = document.getElementById("whitelist");
    const emptyMsg = document.getElementById("empty-msg");
    ul.innerHTML = "";

    const whitelist = (await getWhiteList())
    .filter((path)=>!path.startsWith("file:///"));

    if (whitelist.length === 0) {
      emptyMsg.style.display = '';
    } else {
      emptyMsg.style.display = "none";
      whitelist.forEach((path) => {
        const li = document.createElement("li");

        const span = document.createElement("span");
        span.textContent = path;
        span.title = path;

        const removeBtn = document.createElement("button");
        removeBtn.textContent = "제거";
        removeBtn.addEventListener("click", async () => {
          await chrome.permissions.remove({
            origins: [path]
          });

          renderWhitelist();
        });

        li.appendChild(span);
        li.appendChild(removeBtn);
        ul.appendChild(li);
      });
    }
  }

  document.getElementById("button-api-register").addEventListener('click', async()=>{
    const input = document.getElementById("input-api-register");
    let url;
    try {
      url = new URL(input.value);
    } catch (error) {
      alert('URL 형식이 잘못 되었습니다');
      return;
    }

    if (url.origin.startsWith('file:///')) {
      alert('원격 서버 주소를 입력하세요');
      return;
    }

    const grant = await chrome.permissions.request({
      origins: [url.origin + '/*']
    });

    if (!grant) {
      alert('권한이 거부되었습니다');
      return;
    }

    input.value = '';
    renderWhitelist();
  });

  document.getElementById('button-reset-file-list').addEventListener('click', async ()=>{
    if (!window.confirm('등록된 모든 파일에서 fetch를 제거합니다')) {
      return;
    }

    const registerd = await chrome.scripting.getRegisteredContentScripts();
    try {
      const ids = registerd.map((src)=>src.id);
      await chrome.scripting.unregisterContentScripts({ids: ids});
    } catch (error) {
      //스크립트가 등록 안된 경우에 오류 발생 => 그냥 무시
      alert('실패');
    }

    await chrome.storage.local.set({
      [WHITELIST_KEY]: []
    });

    renderToggle();
  })

  document.getElementById('button-reset-api-list').addEventListener('click', async ()=>{
    if (!window.confirm('등록된 모든 api의 권한을 제거합니다')) {
      return;
    }

    const whitelist = (await getWhiteList())
    .filter((path)=>!path.startsWith("file:///"));

    const result = await chrome.permissions.remove({
        origins: whitelist
    });

    if (result) {
      renderWhitelist();
    } else {
      alert('초기화 실패');
    }
  });

  initSettings();
  renderToggle();
  renderWhitelist();
});