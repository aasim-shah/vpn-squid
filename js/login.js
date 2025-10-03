import { showToast } from "./common.js";
import { makeApiCall } from "./config.js";

document.addEventListener("DOMContentLoaded", () => {
  const LOGGED_USER = JSON.parse(localStorage.getItem("userinfo"));
  const toastContainer = document.getElementById("toastContainer");
  const signInButton = document.getElementById("googleSignInButton");
  const overlay = document.getElementById("overlay");
  const networkError = document.getElementById("network-error");
  const retryButton = document.getElementById("retry-button");

  if (LOGGED_USER) {
    window.location.href = "../html/home.html";
  }

  const showError = (message) => {
    showToast(message, toastContainer);
    networkError.style.display = "flex";
    overlay.style.display = "none";
  };

  // const authenticateWithGoogle = () => {
  //   overlay.style.display = "flex";
  //   chrome.identity.getAuthToken({ interactive: true }, handleToken);
  // };

  const authenticateWithGoogle = () => {
    overlay.style.display = "flex";
  
    chrome.identity.getAuthToken({ interactive: true }, (token) => {
      if (chrome.runtime.lastError || !token) {
        console.error(
          "Google authentication failed:",
          chrome.runtime.lastError || "No token received"
        );
        showError("Google authentication failed");
        overlay.style.display = "none"; // Hide overlay on error
        return;
      }
  
      // Proceed to fetch user data with the token
      handleToken(token);
    });
  };

  const handleToken = (token) => {
    console.log({ token})
    if (chrome.runtime.lastError || !token) {
      console.error(
        "Google authentication failed:",
        chrome.runtime.lastError || "No token received"
      );
      showError("Google authentication failed");
      return;
    }
    fetchGoogleUserData(token);
  };

  const fetchGoogleUserData = async (token) => {
    try {
      alert(`You have successfully logged in with Google.`);
      const response = await makeApiCall({
        url: "login/chrome",
        method: "POST",
        body: { provider: "google", accessToken: token },
      });

      console.log({ response})
      if (response?.user) {
        chrome.storage.local.set(
          { connection: false, selectedLocation: "smart-location" },
          () => {
            console.log("Default settings applied!");
          }
        );
        localStorage.setItem("userinfo", JSON.stringify(response?.user));
        localStorage.setItem("token", JSON.stringify(response?.token));
        overlay.style.display = "none";
        window.location.href = "../html/home.html"; 
      } else {
        showError("Invalid user data received");
      }
    } catch (error) {
      console.error("Error fetching Google user data:", error);
      showError("Error fetching Google user data");
    }
  };

  signInButton.addEventListener("click", authenticateWithGoogle);

  retryButton.addEventListener("click", () => {
    networkError.style.display = "none";
    overlay.style.display = "flex";
    chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" });
    authenticateWithGoogle();
  });
});
