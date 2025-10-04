// popup.js (refactored, production-grade)

import { showToast } from "./common.js";
import { makeApiCall } from "./config.js";

/** ---------------------------
 * Chrome helpers (promisified)
 * --------------------------- */
const hasChrome = typeof chrome !== "undefined" && chrome?.storage && chrome?.proxy;
const storageGet = (keys) =>
  new Promise((resolve) =>
    hasChrome ? chrome.storage.local.get(keys, (res) => resolve(res)) : resolve({})
  );
const storageSet = (obj) =>
  new Promise((resolve) =>
    hasChrome ? chrome.storage.local.set(obj, () => resolve(true)) : resolve(true)
  );
const storageClear = () =>
  new Promise((resolve) =>
    hasChrome ? chrome.storage.local.clear(() => resolve(true)) : resolve(true)
  );
const proxySet = (value) =>
  new Promise((resolve) =>
    hasChrome ? chrome.proxy.settings.set({ value, scope: "regular" }, resolve) : resolve()
  );
const proxyClear = () =>
  new Promise((resolve) =>
    hasChrome ? chrome.proxy.settings.clear({ scope: "regular" }, resolve) : resolve()
  );
const setBadgeText = (text) =>
  new Promise((resolve) =>
    hasChrome && chrome.action
      ? chrome.action.setBadgeText({ text }, resolve)
      : resolve()
  );
const setBadgeColor = (color) =>
  new Promise((resolve) =>
    hasChrome && chrome.action
      ? chrome.action.setBadgeBackgroundColor({ color }, resolve)
      : resolve()
  );

/** ---------------------------
 * LocalStorage helpers
 * --------------------------- */
const ls = {
  get(key, fallback = null) {
    try {
      const v = localStorage.getItem(key);
      return v ? JSON.parse(v) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {}
  },
  remove(key) {
    try {
      localStorage.removeItem(key);
    } catch {}
  },
};

/** ---------------------------
 * DOM helpers
 * --------------------------- */
const $ = (sel, root = document) => root.querySelector(sel);
const setText = (el, text) => el && (el.textContent = text);
const setHTML = (el, html) => el && (el.innerHTML = html);
const setSrc = (el, src) => el && (el.src = src);
const show = (el) => el && (el.style.display = "flex");
const hide = (el) => el && (el.style.display = "none");
const toggleClass = (el, name, on) => el && el.classList.toggle(name, !!on);

/** ---------------------------
 * State (single source of truth)
 * --------------------------- */
const state = {
  connection: false,
  selectedLocation: null, // { _id, locationName, countryName, flag }
  servers: [],            // [{ countryName, flag, locations: [{_id, name, isDefault}] }]
  userPackage: null,      // object or null
  userInfo: null,         // object or null
  errorSource: "",
  creds: { username: "", password: "" },
  proxyConfig: null,
  debug: true,
};

/** ---------------------------
 * Static selectors
 * --------------------------- */
const DOM = {
  powerButton: $("#powerButton"),
  smartLocationContainer: $(".location-container"),
  subscriptionPlan: $(".menu-right"),
  premiumOverlay: $(".premium-overlay"),
  upgradeToPremiumButton: $(".upgrade-button"),
  selectedLocationText: $(".location-text"),
  selectedLocationIcon: $(".location-icon"),
  mainContent: $(".main-content"),
  overlay: $("#overlay"),
  loadingSpinner: $("#loader"),
  logoutButton: $("#logoutButton"),
  menuIcon: $(".menu-icon"),
  sideMenu: $(".side-menu"),
  closeBtn: $(".close-btn"),
  toastContainer: $("#toastContainer"),
  networkError: $("#network-error"),
  retryButton: $("#retry-button"),
  wrapper: $(".wrapper"),
};

/** ---------------------------
 * UI Controls
 * --------------------------- */
const ui = {
  busy(on) {
    on ? show(DOM.overlay) : hide(DOM.overlay);
    if (DOM.loadingSpinner) DOM.loadingSpinner.style.display = on ? "block" : "none";
  },
  updatePowerVisual(connected) {
    const img = $("#powerButton img");
    const status = $(".status");
    if (status) {
      status.innerText = connected ? "Connected" : "Connect";
      status.style.color = connected ? "green" : "white";
    }
    if (img) setSrc(img, connected ? "/public/disconnect.svg" : "/public/connect.svg");
  },
  updateSelectedLocationInline(sel) {
    if (!sel) {
      setText(DOM.selectedLocationText, "Smart Location");
      setSrc(DOM.selectedLocationIcon, "/public/smart-location.svg");
      return;
    }
    const full = `${sel.countryName} - ${sel.locationName}`;
    const limited = full.length > 17 ? `${full.substring(0, 17)}...` : full;
    setText(DOM.selectedLocationText, limited);
    setSrc(DOM.selectedLocationIcon, sel.flag);
  },
  showNetworkError(source) {
    state.errorSource = source;
    hide(DOM.overlay);
    show(DOM.networkError);
  },
  hideNetworkError() {
    hide(DOM.networkError);
  },
  toast(msg) {
    showToast(msg, DOM.toastContainer);
  },
};

/** ---------------------------
 * Utils
 * --------------------------- */
const getCountryBadgeCode = (countryName) => {
  if (!countryName) return "ON"; // Off
  const parts = countryName.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return parts.map((w) => w[0]).join("").toUpperCase();
};

const pickFallbackLocation = (servers) => {
  // returns { _id, locationName, countryName, flag } or null
  for (const s of servers) {
    if (Array.isArray(s.locations) && s.locations.length) {
      const loc =
        s.locations.find((l) => l.isDefault) || s.locations[Math.floor(Math.random() * s.locations.length)];
      if (loc) {
        return { _id: loc._id, locationName: loc.name, countryName: s.countryName, flag: s.flag };
      }
    }
  }
  return null;
};

/** ---------------------------
 * Persistence (batch reads/writes)
 * --------------------------- */
async function hydrateStateFromStorage() {
  const [{ connection, selectedLocation }, userInfo] = await Promise.all([
    storageGet(["connection", "selectedLocation"]),
    Promise.resolve(ls.get("userinfo", null)), // remains in localStorage
  ]);

  state.connection = !!connection;
  state.selectedLocation = selectedLocation && selectedLocation !== "smart-location" ? selectedLocation : null;
  state.userInfo = userInfo;

  // Fast path loads for cached objects
  state.servers = ls.get("premium", []);
  state.userPackage = ls.get("userPackage", null);
}

function persistUserPackage(pkg) {
  state.userPackage = pkg;
  ls.set("userPackage", pkg);
}

function persistServers(servers) {
  state.servers = servers;
  ls.set("premium", servers);
}

async function persistConnection(on) {
  state.connection = !!on;
  await storageSet({ connection: state.connection });
}

/** ---------------------------
 * API flows
 * --------------------------- */
async function validateUserPackage() {
  try {
    const res = await makeApiCall({ url: "user-package", auth: true });
    if (res?.userPackage) {
      handleSubscriptionSuccess(res.userPackage);
    } else {
      handleNoSubscription();
    }
  } catch (err) {
    console.error("validateUserPackage error:", err?.message || err);
    handleError("validateUserPackage");
  }
}

function handleSubscriptionSuccess(userPackage) {
  persistUserPackage(userPackage);
  if (DOM.subscriptionPlan) setText(DOM.subscriptionPlan, userPackage.title || "Premium");
  // Allow upgrading navigation
  const subscriptionMenu = $("#subscriptionMenu");
  subscriptionMenu?.addEventListener("click", (e) => {
    e.preventDefault();
    window.location.href = "../html/upgradeSubscriptions.html";
  });
  // Refresh servers after validation
  fetchServers();
}

function handleNoSubscription() {
  if (DOM.subscriptionPlan) setText(DOM.subscriptionPlan, "No subscription");
  persistUserPackage(null);
  ui.toast("No active subscription");
}

function handleError(source) {
  ui.hideNetworkError();
  ui.busy(false);
  persistUserPackage(null);
  disableProxy(); // ensure proxy cleaned
  setPowerButtonState(false);
  ui.showNetworkError(source);
}

async function fetchServers({ showBusy = false } = {}) {
  try {
    if (showBusy) ui.busy(true);
    const res = await makeApiCall({ url: "server" });
    const premium = res?.success ? res?.data?.premium || [] : [];
    persistServers(premium);
  } catch (err) {
    console.error("fetchServers error:", err?.message || err);
    ui.showNetworkError("fetchServers");
    ui.toast("Failed to load servers");
  } finally {
    ui.busy(false);
  }
}

/** ---------------------------
 * Proxy control
 * --------------------------- */
async function setPowerButtonState(enabled) {
  ui.updatePowerVisual(enabled);

  // Badge updates
  const code = enabled ? getCountryBadgeCode(state.selectedLocation?.countryName) : "Off";
  await setBadgeText(code);
  await setBadgeColor(enabled ? "#34D399" : "#EF4444");

  await persistConnection(enabled);
}

async function enableProxy(ipAddress, port = 443, username = "eeagle-vpn-root-user", password = "Pakistan@1234") {
  // Per-ip creds override (keep your special-case)
  const isNy = ipAddress === "ny-1-eeagle.duckdns.org";
  state.creds.username = isNy ? "myuser" : username;
  state.creds.password = isNy ? "mypassword" : password;

  state.proxyConfig = {
    mode: "fixed_servers",
    rules: {
      singleProxy: { scheme: "https", host: ipAddress, port },
      bypassList: ["<local>"],
    },
  };

  await proxySet(state.proxyConfig);

  // Sanity check we can reach the internet
  try {
    const resp = await fetch("https://api64.ipify.org?format=json");
    await resp.json(); // will throw if invalid
    await setPowerButtonState(true);
  } catch (e) {
    ui.toast("Unable to connect to proxy server !!!");
    return;
  } finally {
    ui.busy(false);
  }
}

async function disableProxy() {
  try {
    await proxyClear();
  } catch {}
  state.creds = { username: "", password: "" };
  await setPowerButtonState(false);
}

/** ---------------------------
 * Connection toggle
 * --------------------------- */
async function toggleConnection() {
  try {
    ui.busy(true);

    if (state.connection) {
      await disableProxy();
      ui.toast("Disconnected!");
      await renderMainContent(); 
      ui.busy(false); 
      return;
    }

    if (!state.selectedLocation) {
      const fb = pickFallbackLocation(state.servers || []);
      if (fb) {
        await updateSelectedLocation(fb);
      } else {
        ui.toast("No default location available, please select manually.");
        ui.busy(false);
        return;
      }
    }

    // Get server IP for location
    const id = state.selectedLocation?._id
      || (state.servers?.flatMap((s) => s.locations)?.find((l) => l.isDefault)?._id)
      || state.servers?.flatMap((s) => s.locations)?.[0]?._id;

    if (!id) {
      ui.toast("Failed to load servers, reload extension");
      ui.busy(false);
      return;
    }

    const response = await makeApiCall({ url: `request/ip?id=${id}` });
    const ip = response?.success ? response?.data?.serverUrl : null;

    if (!ip) {
      ui.toast("Failed to load servers, reload extension");
      ui.busy(false);
      return;
    }

    await enableProxy(ip);
    await renderMainContent();

    const regionText = $(".region-text");
    setText(regionText, `🌍 ${state.selectedLocation?.countryName}` || "");
  } catch (err) {
    console.error("toggleConnection error:", err);
    ui.toast("Something went wrong, try again");
    ui.busy(false);
  }
}

/** ---------------------------
 * Location selection & UI
 * --------------------------- */
async function updateSelectedLocation(sel) {
  state.selectedLocation = sel; // {_id, locationName, countryName, flag}
  await storageSet({ selectedLocation: sel });
  ui.updateSelectedLocationInline(sel);
}

function renderServerList() {
  const servers = state.servers || [];
  const container = document.createElement("div");
  container.className = "server-list-container";

  // Smart location
  const smart = document.createElement("div");
  smart.className = "smart-location-item";
  smart.innerHTML = `
    <img src="/public/smart-location-icon.svg" class="country-icon" alt="Country Icon" />
    <span class="smart-location-text">Smart Location</span>
    <img src="/public/arrow.svg" class="arrow-icon" alt="Arrow Icon" />
  `;
  smart.addEventListener("click", async () => {
    await storageSet({ selectedLocation: "smart-location" });
    state.selectedLocation = null;
    renderSmartLocationContent();
  });
  container.appendChild(smart);

  const heading = document.createElement("h3");
  heading.textContent = "Premium Locations";
  heading.className = "premium-location-heading";
  container.appendChild(heading);

  if (!servers.length) {
    const msg = document.createElement("div");
    msg.className = "message-container";
    msg.innerHTML = `
      <img src="/public/reload.svg" alt="reload-server-icon" class="reload-server-icon" />
      <p class="no-servers-message">No servers available.</p>
    `;
    msg.querySelector(".reload-server-icon")?.addEventListener("click", () => fetchServers({ showBusy: true }));
    container.appendChild(msg);
    return container;
  }

  // One expanded list at a time
  let activeList = null;

  servers.forEach((country) => {
    const item = document.createElement("div");
    item.className = "server-item";
    item.innerHTML = `
      <div class="country-details-container">
        <img src="${country.flag}" class="country-icon" alt="Country Icon" />
        <span class="server-text">${country.countryName}</span>
        <img src="/public/premium-icon.svg" class="premium-icon" alt="Premium Icon" />
        <img src="/public/drop-icon.svg" class="drop-icon" alt="Drop Icon" />
      </div>
    `;
    item.addEventListener("click", (e) => {
      // toggle
      if (activeList) {
        activeList.remove();
        activeList = null;
        return;
      }
      const locList = document.createElement("div");
      locList.className = "location-list-container";
      (country.locations || []).forEach((loc) => {
        const row = document.createElement("div");
        row.className = "location-item";
        row.innerHTML = `
          <input type="radio" name="location-${country.countryName}" value="${loc.name}" class="location-radio" />
          <label class="location-label">${loc.name}</label>
        `;
        row.addEventListener("click", async (ev) => {
          ev.stopPropagation();
          await updateSelectedLocation({
            _id: loc._id,
            locationName: loc.name,
            countryName: country.countryName,
            flag: country.flag,
          });
          renderMainContent();
        });
        locList.appendChild(row);
      });
      item.appendChild(locList);
      activeList = locList;
    });
    container.appendChild(item);
  });

  return container;
}

/** ---------------------------
 * Rendering
 * --------------------------- */
async function renderMainContent() {
  const sel = state.selectedLocation;
  const connected = state.connection;

  const region = connected ? (`📍 ${sel?.countryName || ""}`) : "";
  const statusColor = connected ? "green" : "white";
  const statusText = connected ? "Connected" : "Connect";

  setHTML(
    DOM.mainContent,
    `
    <div class="img-status-div">
      <button class="power-button" id="powerButton">
        <img src="${connected ? "/public/disconnect.svg" : "/public/connect.svg"}" alt="Power Button" class="power-button-img" />
      </button>
      <div class="status" style="color:${statusColor};font-weight:bold;">${statusText}</div>
      <div class="region-text">${region}</div>
    </div>
    <div class="location-container" id="locationContainer">
      <img src="${sel?.flag || "/public/smart-location.svg"}" class="location-icon" alt="Location Icon" />
      <span class="location-text">${sel ? `${sel.countryName} - ${sel.locationName}`.slice(0, 17) + ( (sel.countryName + sel.locationName).length > 17 ? "..." : "" ) : "Smart Location"}</span>
      <span class="location-arrow">&rsaquo;</span>
    </div>
  `
  );

  if (DOM.wrapper) DOM.wrapper.style.maxHeight = "450px";

  // local listeners (rebuilt after HTML replacement)
  $("#powerButton")?.addEventListener("click", toggleConnection);
  $("#locationContainer")?.addEventListener("click", () => {
    if (state.connection) {
      ui.toast("Disconnect to access another location.");
      return;
    }
    if (!state.userPackage) {
      ui.toast("No active subscription");
      show(DOM.premiumOverlay);
      return;
    }
    setHTML(DOM.mainContent, "");
    DOM.mainContent.appendChild(renderServerList());
  });
}

function renderSmartLocationContent() {
  const connected = state.connection;
  setHTML(
    DOM.mainContent,
    `
    <div class="img-status-div">
      <button class="power-button" id="powerButton">
        <img src="${connected ? "/public/disconnect.svg" : "/public/connect.svg"}" alt="Power Button" class="power-button-img" />
      </button>
      <div class="status" style="color:${connected ? "green" : "white"};font-weight:bold;">
        ${connected ? "Connected" : "Connect"}
      </div>
    </div>
    <div class="location-container" id="locationContainer">
      <img src="/public/smart-location.svg" class="location-icon" alt="Location Icon" />
      <span class="location-text">Smart Location</span>
      <span class="location-arrow" id="locationArrow">&rsaquo;</span>
    </div>
  `
  );

  if (DOM.wrapper) DOM.wrapper.style.maxHeight = "450px";
  $("#powerButton")?.addEventListener("click", toggleConnection);
  $("#locationContainer")?.addEventListener("click", () => {
    if (state.connection) {
      ui.toast("Disconnect to access another locations.");
      return;
    }
    setHTML(DOM.mainContent, "");
    DOM.mainContent.appendChild(renderServerList());
  });
}

/** ---------------------------
 * Session / Auth
 * --------------------------- */
async function logout() {
  try {
    ui.busy(true);
    // Clear Chrome identity token if available
    if (hasChrome && chrome.identity) {
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        const finish = async () => {
          await storageClear();
          localStorage.clear();
          window.location.href = "login.html";
        };
        if (!token) return finish();
        const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;
        fetch(revokeUrl)
          .then(() => {
            chrome.identity.clearAllCachedAuthTokens?.(() => finish());
          })
          .catch(() => finish());
      });
    } else {
      await storageClear();
      localStorage.clear();
      window.location.href = "login.html";
    }
    await disableProxy();
  } catch {
    state.errorSource = "logout";
    ui.showNetworkError("logout");
  } finally {
    ui.busy(false);
  }
}

/** ---------------------------
 * Event wiring (one-time)
 * --------------------------- */
function wireStaticUI() {
  DOM.menuIcon?.addEventListener("click", () => {
    if (!DOM.sideMenu) return;
    DOM.sideMenu.style.left = DOM.sideMenu.style.left === "0px" ? "-310px" : "0";
  });
  DOM.closeBtn?.addEventListener("click", () => {
    if (!DOM.sideMenu) return;
    DOM.sideMenu.style.left = DOM.sideMenu.style.left === "0px" ? "-310px" : "0";
  });

  DOM.upgradeToPremiumButton?.addEventListener(
    "click",
    () => (window.location.href = "upgradeToPremium.html")
  );

  DOM.logoutButton?.addEventListener("click", logout);

  DOM.subscriptionPlan?.addEventListener("click", (e) => {
    e.preventDefault();
    if (!state.userPackage) {
      window.location.href = "../html/upgradeToPremium.html";
    }
  });

  DOM.retryButton?.addEventListener("click", async () => {
    ui.hideNetworkError();
    ui.busy(true);
    await proxySet({ mode: "direct" });
    switch (state.errorSource) {
      case "fetchServers":
        await fetchServers();
        break;
      case "validateUserPackage":
        await validateUserPackage();
        break;
      case "logout":
        await logout();
        break;
      default:
        break;
    }
    ui.busy(false);
  });

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") storageSet({ isNewPage: true });
  });
}

/** ---------------------------
 * Profile header setup
 * --------------------------- */
function updateProfileHeader() {
  if (!state.userInfo) return;
  const profileImage = $(".profile-image");
  const userName = $(".user-name");
  const userEmail = $(".user-email");

  if (profileImage) {
    setSrc(profileImage, state.userInfo?.picture || "/public/default-profile.png");
    profileImage.alt = `${state.userInfo?.name || "User"}'s Profile Image`;
  }
  if (userName) {
    const n = state.userInfo?.name || "User";
    setText(userName, n.length > 15 ? `${n.substring(0, 15)}...` : n);
  }
  if (userEmail) {
    const e = state.userInfo?.email || "";
    setText(userEmail, e.length > 25 ? `${e.substring(0, 25)}...` : e);
  }
}

/** ---------------------------
 * Bootstrap
 * --------------------------- */
document.addEventListener("DOMContentLoaded", async () => {
  // 1) hydrate from storage/local
  await hydrateStateFromStorage();

  wireStaticUI();
  updateProfileHeader();

  // 2) initial badge & UI
  ui.updatePowerVisual(state.connection);
  ui.updateSelectedLocationInline(state.selectedLocation);

  // 3) if no connection cached, show overlay until servers/user package fetched
  if (!state.connection) show(DOM.overlay);

  // 4) validate subscription & fetch servers (in parallel but await both)
  try {
    await Promise.all([validateUserPackage(), fetchServers()]);
  } finally {
    ui.busy(false);
  }

  // 5) update connection visuals from storage
  await renderMainContent();
});
