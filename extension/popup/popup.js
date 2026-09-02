const WHITELIST_KEY = "whitelist";
const ENABLE_KEY = "enable";
const MODE_KEY = "injection_mode";
const INJ_NAMESPACE_KEY = "injection_name";

function normalizePath(url) {
  const u = new URL(url);
  return u.origin + u.pathname;
}

function getWhitelist() {
  return chrome.storage.local.get(WHITELIST_KEY).then((res) => res[WHITELIST_KEY] ?? []);
}

function setWhitelist(list) {
  return chrome.storage.local.set({ [WHITELIST_KEY]: list });
}

async function getCurrentPath() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab?.url) return null;
  try {
    return normalizePath(tab.url);
  } catch {
    return null; // chrome:// 같은 내부 페이지
  }
}

async function render() {
  const currentPath = await getCurrentPath();
  const whitelist = await getWhitelist();

  // 현재 페이지 표시 + 토글 버튼
  const pathEl = document.getElementById("current-path");
  const toggleBtn = document.getElementById("toggle-current-btn");

  if (!currentPath || !currentPath.startsWith("file:///")) {
    pathEl.textContent = "이 페이지는 등록할 수 없습니다.";
    toggleBtn.style.display = "none";
  } else {
    pathEl.textContent = currentPath;
    toggleBtn.style.display = "block";
    const isIn = whitelist.includes(currentPath);
    toggleBtn.textContent = isIn ? "화이트리스트에서 제거" : "화이트리스트에 추가";
    toggleBtn.className = isIn ? "remove" : "add";
  }

  // 목록 렌더링
  const ul = document.getElementById("whitelist");
  const emptyMsg = document.getElementById("empty-msg");
  ul.innerHTML = "";

  if (whitelist.length === 0) {
    emptyMsg.style.display = "block";
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
        const list = await getWhitelist();
        await setWhitelist(list.filter((p) => p !== path));
        render();
      });

      li.appendChild(span);
      li.appendChild(removeBtn);
      ul.appendChild(li);
    });
  }
}

document.getElementById("toggle-current-btn").addEventListener("click", async () => {
  const currentPath = await getCurrentPath();
  if (!currentPath) return;

  const list = await getWhitelist();
  const isIn = list.includes(currentPath);
  const updated = isIn ? list.filter((p) => p !== currentPath) : [...list, currentPath];

  await setWhitelist(updated);
  render();
});

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

initSettings();
render();
