import { showToast } from "./common.js";
import { makeApiCall } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
  const powerButton = document.getElementById("powerButton");
  const smartLocationContainer = document.querySelector(".location-container");
  const subscriptionPlan = document.querySelector(".menu-right");
  const premiumOverlay = document.querySelector(".premium-overlay");
  const upgradeToPremiumButton = document.querySelector(".upgrade-button");
  const selectedLocationText = document.querySelector(".location-text");
  const selectedLocationIcon = document.querySelector(".location-icon");
  const mainContent = document.querySelector(".main-content");
  const overlay = document.getElementById("overlay");
  const loadingSpinner = document.getElementById("loader");
  const logoutButton = document.getElementById("logoutButton");
  const menuIcon = document.querySelector(".menu-icon");
  const sideMenu = document.querySelector(".side-menu");
  const closeBtn = document.querySelector(".close-btn");
  const toastContainer = document.getElementById("toastContainer");
  const networkError = document.getElementById("network-error");
  const retryButton = document.getElementById("retry-button");

  let serverData = JSON.parse(localStorage.getItem("premium")) || [];
  const LOGGED_USER = JSON.parse(localStorage.getItem("userinfo"));
  let errorSource = "";
  let isEnabled = false;
  let debug = true;
  let authListener = null;

  await init();


  console.log({ LOGGED_USER })

  async function init() {
    validateUserPackage();
    updateProfileContainer();
    chrome.storage.local.get(["connection"], ({ connection }) => {
      if (!connection) {
        overlay.style.display = "flex";
        fetchServers();
      }
      isEnabled = !!connection;
      updatePowerButton(isEnabled);
      renderMainContent();
    });

    chrome.storage.local.get(["selectedLocation"], ({ selectedLocation }) => {
      if (selectedLocation && selectedLocation !== "smart-location") {
        updateSelectedLocation(
          selectedLocation._id,
          selectedLocation.locationName,
          selectedLocation.countryName,
          selectedLocation.flag
        );
      } else {
        selectedLocationText && (selectedLocationText.textContent = "Smart Location");
      }
    });

    attachUiListeners();
  }

  function updatePowerButton(connection) {
    const powerButtonImg = document.querySelector("#powerButton img");
    const status = document.querySelector(".status");
    if (status) {
      status.innerText = connection ? "Connected" : "Connect";
      status.style.color = connection ? "green" : "white";
    }
    if (powerButtonImg) {
      powerButtonImg.src = connection ? "/public/disconnect.svg" : "/public/connect.svg";
    }
  }

  async function validateUserPackage() {
    try {
      const response = await makeApiCall({ url: "user-package", auth: true });
      overlay.style.display = "none";
      if (response?.userPackage) {
        handleSubscriptionSuccess(response.userPackage);
      } else if (response?.status === 400 || response?.status) {
        handleNoSubscription();
      } else {
        handleNoSubscription();
      }
    } catch (error) {
      handleError(error.message || "Network error occurred");
    }
  }

  function handleSubscriptionSuccess(userPackage) {
    const subscriptionMenu = document.getElementById("subscriptionMenu");
    localStorage.setItem("userPackage", JSON.stringify(userPackage));
    subscriptionPlan.textContent = userPackage.title || "Premium";
    fetchServers();
    subscriptionMenu?.addEventListener("click", (event) => {
      event.preventDefault();
      window.location.href = "../html/upgradeSubscriptions.html";
    });
  }

  subscriptionPlan.addEventListener("click", (event) => {
    event.preventDefault();
    const userPackage = JSON.parse(localStorage.getItem("userPackage"));
    if (!userPackage) {
      window.location.href = "../html/upgradeToPremium.html";
    }
  });

  function handleNoSubscription() {
    subscriptionPlan.textContent = "No subscription";
    localStorage.setItem("userPackage", null);
    // disableProxy();
    // setPowerButtonState(false);
    // premiumOverlay.style.display = "flex"; // Uncommented to show the premium overlay
    showToast("No active subscription", toastContainer);
  }

  function handleError(errorMessage) {
    console.error("Error in validateUserPackage: ", errorMessage);
    overlay.style.display = "none";
    networkError.style.display = "flex";
    errorSource = "validateUserPackage";
    localStorage.setItem("userPackage", null);
    disableProxy();
    setPowerButtonState(false);
  }

  async function updateProfileContainer() {
    if (!LOGGED_USER) return;
    const profileImage = document.querySelector(".profile-image");
    const userName = document.querySelector(".user-name");
    const userEmail = document.querySelector(".user-email");
    if (profileImage) {
      profileImage.src = LOGGED_USER?.picture || "/public/default-profile.png";
      profileImage.alt = `${LOGGED_USER.name || "User"}'s Profile Image`;
    }
    if (userName) {
      userName.textContent = LOGGED_USER.name
        ? LOGGED_USER.name.length > 15
          ? `${LOGGED_USER.name.substring(0, 15)}...`
          : LOGGED_USER.name
        : "User";
    }
    if (userEmail) {
      userEmail.textContent = LOGGED_USER.email
        ? LOGGED_USER.email.length > 25
          ? `${LOGGED_USER.email.substring(0, 25)}...`
          : LOGGED_USER.email
        : "";
    }
  }

  async function fetchServers(isLoading = false) {
    try {
      if (isLoading) overlay.style.display = "flex";
      if (isLoading && loadingSpinner) loadingSpinner.style.display = "block";
      const response = await makeApiCall({ url: "server" });
      serverData = response?.success ? response?.data?.premium || [] : [];
      localStorage.setItem("premium", JSON.stringify(serverData));
      overlay.style.display = "none";
      if (loadingSpinner) loadingSpinner.style.display = "none";
      return serverData;
    } catch (error) {
      overlay.style.display = "none";
      networkError.style.display = "flex";
      errorSource = "fetchServers";
      showToast("Failed to load servers", toastContainer);
      return null;
    }
  }

  function displayServerList(servers) {
    mainContent.innerHTML = "";
    const smartLocationItem = document.createElement("div");
    smartLocationItem.innerHTML = `
      <div class="smart-location-item">
        <img src="/public/smart-location-icon.svg" class="country-icon" alt="Country Icon" />
        <span class="smart-location-text">Smart Location</span>
        <img src="/public/arrow.svg" class="arrow-icon" alt="Arrow Icon" />
      </div>
    `;
    const premiumHeading = document.createElement("h3");
    premiumHeading.textContent = "Premium Locations";
    premiumHeading.className = "premium-location-heading";
    smartLocationItem.addEventListener("click", () => {
      chrome.storage.local.set({ selectedLocation: "smart-location" }, () => {
        debug && console.log("smart location selected!");
      });
      renderSmartLocationContent();
    });
    const serverListContainer = document.createElement("div");
    serverListContainer.className = "server-list-container";
    serverListContainer.appendChild(smartLocationItem);
    serverListContainer.appendChild(premiumHeading);

    if (!servers || servers.length === 0) {
      const messageContainer = document.createElement("div");
      messageContainer.className = "message-container";
      const noServersMessage = document.createElement("p");
      noServersMessage.textContent = "No servers available.";
      noServersMessage.className = "no-servers-message";
      const image = document.createElement("img");
      image.src = "/public/reload.svg";
      image.alt = "reload-server-icon";
      image.className = "reload-server-icon";
      image.addEventListener("click", () => {
        debug && console.log("Reloading data...");
        fetchServers(true);
      });
      messageContainer.appendChild(image);
      messageContainer.appendChild(noServersMessage);
      serverListContainer.appendChild(messageContainer);
    } else {
      let activeLocationList = null;
      servers.forEach((country) => {
        const serverItem = document.createElement("div");
        serverItem.className = "server-item";
        serverItem.innerHTML = `
          <div class="country-details-container">
            <img src="${country.flag}" class="country-icon" alt="Country Icon" />
            <span class="server-text">${country.countryName}</span>
            <img src="/public/premium-icon.svg" class="premium-icon" alt="Premium Icon" />
            <img src="/public/drop-icon.svg" class="drop-icon" alt="Premium Icon" />
          </div>
        `;
        country.locations.forEach(() => { });
        serverItem.addEventListener("click", () => {
          if (activeLocationList) {
            activeLocationList.remove();
            activeLocationList = null;
            return;
          }
          const currentLocationList = createLocationList(country);
          serverItem.appendChild(currentLocationList);
          activeLocationList = currentLocationList;
        });
        serverListContainer.appendChild(serverItem);
      });
    }
    mainContent.appendChild(serverListContainer);
  }

  function createLocationList(country) {
    const locationList = document.createElement("div");
    locationList.className = "location-list-container";
    country.locations.forEach((loc) => {
      const locationItem = document.createElement("div");
      locationItem.className = "location-item";
      locationItem.innerHTML = `
        <input type="radio" name="location-${country.countryName}" value="${loc.name}" class="location-radio" />
        <label class="location-label">${loc.name}</label>
      `;
      locationItem.addEventListener("click", () => {
        updateSelectedLocation(loc._id, loc.name, country.countryName, country.flag);
        renderMainContent();
      });
      locationList.appendChild(locationItem);
    });
    return locationList;
  }

  function updateSelectedLocation(_id, locationName, countryName, flagUrl) {
    const fullText = `${countryName} - ${locationName}`;
    if (selectedLocationText) selectedLocationText.textContent = fullText.length > 17 ? `${fullText.substring(0, 17)}...` : fullText;
    if (selectedLocationIcon) selectedLocationIcon.src = flagUrl;
    chrome.storage.local.set({ selectedLocation: { _id, locationName, countryName, flag: flagUrl } }, () => {
      debug && console.log(`location selected to ${locationName}: ${_id}`);
    });
  }

  async function setPowerButtonState(enabled) {
    const powerButtonImg = document.querySelector("#powerButton img");
    const status = document.querySelector(".status");
    if (status) {
      status.innerText = enabled ? "Connected" : "Connect";
      status.style.color = enabled ? "green" : "white";
    }
    if (powerButtonImg) {
      powerButtonImg.src = `/public/${enabled ? "disconnect" : "connect"}.svg`;

      let getSelectedLocation = await new Promise((resolve) => {
        chrome.storage.local.get(["selectedLocation"], (result) => resolve(result.selectedLocation));
      });

      function getCountryCode(countryName) {
        console.log({ countryName })
        if (!countryName) return "ON";
        const parts = countryName.trim().split(/\s+/);

        if (parts.length === 1) {
          return parts[0].slice(0, 2).toUpperCase();
        }

        return parts.map(word => word[0].toUpperCase()).join("").toUpperCase();
      }



      if (getSelectedLocation) {
        console.log("Retrieved selected location:", getSelectedLocation);
      }



      chrome.action.setBadgeText({
        text: enabled ? `${getCountryCode(getSelectedLocation.countryName)}` : "Off"

      });



      chrome.action.setBadgeBackgroundColor({
        color: enabled ? "#34D399" : "#EF4444"
      });
    }

    chrome.storage.local.set({ connection: !!enabled }, () => {
      debug && console.log("Connection state updated!");
    });
  }

  async function toggleConnection() {
    try {
      overlay.style.display = "flex";
      if (isEnabled) {
        disableProxy();
        setPowerButtonState(false);
        isEnabled = false;
        showToast("Disconnected!", toastContainer);
        overlay.style.display = "none";
        renderMainContent();
        return;
      }

      let id = null;
      let selectedLocation = await new Promise((resolve) => {
        chrome.storage.local.get(["selectedLocation"], (result) => resolve(result.selectedLocation));
      });

      console.log({ selectedLocation, serverData })

      if (!selectedLocation) {
        console.log({ serverData })
        const defaultLocations = (serverData || []).map((server) => {
          const loc = server.locations && server.locations.length ? server.locations[Math.floor(Math.random() * server.locations.length)] : null;
          if (!loc) return null;
          return { countryName: server.countryName, flag: server.flag, locationName: loc.name, _id: loc._id };
        }).filter(Boolean);

        if (defaultLocations.length > 0) {
          console.log({ defaultLocations })
          const firstDefault = defaultLocations[0];
          updateSelectedLocation(firstDefault._id, firstDefault.locationName, firstDefault.countryName, firstDefault.flag);
          selectedLocation = { _id: firstDefault._id };
        } else {
          showToast("No default location available, please select manually.", toastContainer);
          overlay.style.display = "none";
          return;
        }
      }

      id = selectedLocation?._id || (serverData?.flatMap((item) => item.locations)?.find((location) => location.isDefault)?._id) || serverData?.flatMap((item) => item.locations)?.[0]?._id;

      if (!id) {
        showToast("Failed to load servers, reload extension", toastContainer);
        overlay.style.display = "none";
        return;
      }


      const response = await makeApiCall({ url: `request/ip?id=${id}` });
      const ip = response?.success ? response?.data?.serverUrl : null;

      if (!ip) {
        showToast("Failed to load servers, reload extension", toastContainer);
        overlay.style.display = "none";
        return;
      }

      await enableProxy(ip);




      setPowerButtonState(true);
      isEnabled = true;
      showToast("Connected!", toastContainer, "success");
      overlay.style.display = "none";
      renderMainContent();
    } catch (error) {
      showToast("Something went wrong, try again", toastContainer);
      console.error("Error toggling connection:", error);
      overlay.style.display = "none";
    }
  }



  let proxyConfig = null;
  let creds = { username: "", password: "" };

  function enableProxy(ipAddress, port = 443, username = "eeagle-vpn-root-user", password = "Pakistan@1234") {
    creds.username = ipAddress === "ny-1-eeagle.duckdns.org" ? "myuser" : username;
    creds.password = ipAddress === "ny-1-eeagle.duckdns.org" ? "mypassword" : password;

    console.log({ ipAddress, creds })
    
    proxyConfig = {
      mode: "fixed_servers",
      rules: {
        singleProxy: {
          scheme: "https",
          host: ipAddress,
          port: port
        },
        bypassList: ["<local>"]
      }
    };

    chrome.proxy.settings.set(
      { value: proxyConfig, scope: "regular" },
      () => {
        console.log("Proxy applied:", proxyConfig);
        isEnabled = true;
        setPowerButtonState?.(true); // keep compatibility with your UI
      }
    );


  }

  // Clear proxy
  function disableProxy() {
    try {
      if (authListener) {
        chrome.webRequest.onAuthRequired.removeListener(authListener);
        authListener = null;
      }
    } catch (_) { }

    chrome.proxy.settings.clear({ scope: "regular" }, () =>
      console.log("Proxy disabled")
    );

    creds = { username: "", password: "" };
    isEnabled = false;
    setPowerButtonState?.(false);
  }



  // chrome.webRequest.onAuthRequired.addListener(
  //   authListener,
  //   { urls: ["<all_urls>"] },
  //   ["blocking"]
  // );

  // Listen for popup messages
  chrome.runtime.onMessage.addListener((msg, sender, sendResponse) => {
    if (msg.action === "enableProxy") {
      enableProxy(msg.host, msg.port, msg.username, msg.password);
      sendResponse({ success: true });
    } else if (msg.action === "disableProxy") {
      disableProxy();
      sendResponse({ success: true });
    }
  });






  function renderMainContent() {
    mainContent.innerHTML = `
      <div class="img-status-div">
        <button class="power-button" id="powerButton">
          <img src="${isEnabled ? "/public/disconnect.svg" : "/public/connect.svg"}" alt="Power Button" class="power-button-img" />
        </button>
        <div class="status" style="color: ${isEnabled ? "green" : "white"}; font-weight: bold;">
          ${isEnabled ? "Connected" : "Connect"}
        </div>
      </div>
      <div class="location-container" id="locationContainer">
        <img src="${selectedLocationIcon?.src || '/public/smart-location.svg'}" class="location-icon" alt="Location Icon" />
        <span class="location-text">${selectedLocationText?.textContent || 'Smart Location'}</span>
        <span class="location-arrow">&rsaquo;</span>
      </div>
    `;
    const wrapper = document.querySelector(".wrapper");
    if (wrapper) wrapper.style.maxHeight = "450px";
    document.getElementById("powerButton")?.addEventListener("click", toggleConnection);
    document.getElementById("locationContainer")?.addEventListener("click", () => {
      if (isEnabled) {
        showToast("Disconnect to access another location.", toastContainer);
        return;
      }

      const userPackage = JSON.parse(localStorage.getItem("userPackage"));

      if (!userPackage) {
        showToast("No active subscription", toastContainer);
        premiumOverlay.style.display = "flex";
        return;
      }
      console.log({ userPackage })

      displayServerList(serverData);
    });
  }

  function renderSmartLocationContent() {
    mainContent.innerHTML = `
      <div class="img-status-div">
        <button class="power-button" id="powerButton">
          <img src="${isEnabled ? "/public/disconnect.svg" : "/public/connect.svg"}" alt="Power Button" class="power-button-img" />
        </button>
        <div class="status" style="color: ${isEnabled ? "green" : "white"}; font-weight: bold;">
          ${isEnabled ? "Connected" : "Connect"}
        </div>
      </div>
      <div class="location-container" id="locationContainer">
        <img src="/public/smart-location.svg" class="location-icon" alt="Location Icon" />
        <span class="location-text">Smart Location</span>
        <span class="location-arrow" id="locationArrow">&rsaquo;</span>
      </div>
    `;
    const wrapper = document.querySelector(".wrapper");
    if (wrapper) wrapper.style.maxHeight = "450px";
    document.getElementById("powerButton")?.addEventListener("click", toggleConnection);
    document.getElementById("locationContainer")?.addEventListener("click", () => {
      if (isEnabled) {
        showToast("Disconnect to access another locations.", toastContainer);
        return;
      }
      displayServerList(serverData);
    });
  }

  function logout() {
    try {
      overlay.style.display = "flex";
      chrome.identity.getAuthToken({ interactive: false }, (token) => {
        if (!token) {
          chrome.storage.local.clear(() => debug && console.log("Storage cleared!"));
          localStorage.clear();
          window.location.href = "login.html";
          return;
        }
        const revokeUrl = `https://accounts.google.com/o/oauth2/revoke?token=${token}`;
        fetch(revokeUrl)
          .then(() => {
            chrome.storage.local.clear(() => debug && console.log("Storage cleared!"));
            chrome.identity.clearAllCachedAuthTokens(() => {
              localStorage.clear();
              window.location.href = "login.html";
            });
          })
          .catch(() => {
            localStorage.clear();
            window.location.href = "login.html";
          });
      });
      disableProxy();
    } catch (error) {
      errorSource = "logout";
      networkError.style.display = "flex";
    }
  }

  function toggleSideMenu() {
    sideMenu.style.left = sideMenu.style.left === "0px" ? "-310px" : "0";
  }

  function attachUiListeners() {
    menuIcon?.addEventListener("click", toggleSideMenu);
    closeBtn?.addEventListener("click", toggleSideMenu);
    upgradeToPremiumButton?.addEventListener("click", () => window.location.href = "upgradeToPremium.html");
    powerButton?.addEventListener("click", toggleConnection);
    smartLocationContainer?.addEventListener("click", () => {
      if (isEnabled) {
        showToast("Disconnect to access another locations.", toastContainer);
        return;
      }
      displayServerList(serverData);
    });
    logoutButton?.addEventListener("click", logout);
    retryButton?.addEventListener("click", () => {
      networkError.style.display = "none";
      overlay.style.display = "flex";
      chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" });
      switch (errorSource) {
        case "fetchServers":
          fetchServers();
          break;
        case "validateUserPackage":
          validateUserPackage();
          break;
        case "logout":
          logout();
          break;
        default:
          break;
      }
    });
    document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") chrome.storage.local.set({ isNewPage: true });
    });
  }
});
