import { showToast } from "./common.js";
import { makeApiCall } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {
  // DOM Elements
  const closeButton = document.querySelector(".close-button");
  const overlay = document.getElementById("overlay");
  const networkError = document.getElementById("network-error");
  const retryButton = document.getElementById("retry-button");
  const planDetailsElement = document.querySelector(".plan-details");
  const priceElement = document.querySelector(".current-plan-details div");
  const renewalDateElement = document.querySelector(".plan-renewal");
  const upgradeButton = document.querySelector(".btn-upgrade");
  const cancelSubscriptionBtn = document.querySelector(".btn-cancel");
  const confirmationModal = document.querySelector(".upgrade-restriction");
  const upgradeSubModalOk = document.querySelector(".upgrade-sub-ok-btn");
  const updatePaymentBtn = document.querySelector(".btn-update-payment");
  const subModalCloseBtn = document.querySelector(".sub-modal-close-btn");
  const confirmSubCancelBtn = document.querySelector(".sub-confirm-btn");
  const toastContainer = document.getElementById("toastContainer");

  const errorMessage = document.querySelector(".error-message");
  // User data
  const currentPackage = JSON.parse(localStorage.getItem("userPackage")) || {};

  // Variables
  let updatedPackage = null;
  let errorSource = null;
  // ========== Utility Functions ========== //

  // Helper to show/hide elements
  function toggleElementVisibility(element, show) {
    element.style.display = show ? "flex" : "none";
  }

  // Helper to format date
  function formatDate(dateString) {
    if (!dateString) return "N/A";
    const date = new Date(dateString);
    return date
      .toLocaleDateString("en-US", {
        year: "numeric",
        month: "2-digit",
        day: "2-digit",
      })
      .replace(/\//g, "-"); // Replace all slashes with dashes
  }

  // Update UI with package details
  function updatePackageDetails(packageData) {
    const isCancelled = packageData?.cancellationInitialized === true;

    planDetailsElement.innerHTML = `
      <img src="/public/premium-icon.svg" alt="diamond" class="diamond-icon" />
      ${
        packageData.name
          ? `${packageData.name} Subscription`
          : "No Subscription"
      }
    `;

    priceElement.textContent = `$${packageData.price || "0.00"}`;
    const expiryDate = packageData?.expiry
    const activatedDate = packageData?.activatedAt
      //  renewal date logic => activated date + 30 days
      const renewalDate = activatedDate
        ? new Date(new Date(activatedDate).getTime() + 30 * 24 * 60 * 60 * 1000)
        : null;


    renewalDateElement.textContent = `${
      isCancelled ? "Expires on" : "Renews on"
    } ${formatDate(expiryDate || renewalDate)}`;
  }

  // ========== Core Functions ========== //

  // Fetch user package data
  async function validateUserPackage() {
    toggleElementVisibility(overlay, true);

    try {
      const response = await makeApiCall({
        url: "products/list",
        auth: true,
      });

      if (response?.data) {
        updatedPackage = response?.data.find(
          (item) => item.productId === currentPackage.identifier
        );

        if (updatedPackage) {
          updatedPackage = { ...updatedPackage, ...currentPackage };
          updatePackageDetails(updatedPackage);
        }
      }

      toggleElementVisibility(overlay, false);
    } catch (error) {
      console.error("Error:", error.message);
      errorSource = "validateUserPackage";
      toggleElementVisibility(overlay, false);
      toggleElementVisibility(networkError, true);
    }
  }

  // Retry failed operations
  async function retryFailedOperation() {
    toggleElementVisibility(networkError, false);
    toggleElementVisibility(overlay, true);

    if (errorSource === "validateUserPackage") {
      await validateUserPackage();
    }

    if (errorSource === "cancelSubscription") {
      toggleElementVisibility(overlay, false);
    }
  }

  // ========== Event Listeners ========== //
  closeButton.addEventListener("click", () => {
    window.location.href = "../html/home.html";
  });

  retryButton.addEventListener("click", retryFailedOperation);

  const toggleModal = (message, options = {}) => {
    const {
      showConfirmBtn = true,
      showCloseBtn = true,
      showOkBtn = false,
    } = options;

    errorMessage.textContent = message;
    confirmSubCancelBtn.style.display = showConfirmBtn ? "block" : "none";
    subModalCloseBtn.style.display = showCloseBtn ? "block" : "none";
    upgradeSubModalOk.style.display = showOkBtn ? "block" : "none";
    confirmationModal.style.display = "flex";
  };

  const hideModal = () => {
    confirmationModal.style.display = "none";
  };

  // Attach event listeners once to avoid multiple bindings
  upgradeSubModalOk.addEventListener("click", hideModal);
  subModalCloseBtn.addEventListener("click", hideModal);

  upgradeButton.addEventListener("click", () => {
    if (currentPackage?.subscriptionPlatform !== "stripe") {
      toggleModal(
        "Kindly upgrade your subscription from the platform it was purchased.",
        {
          showConfirmBtn: false,
          showCloseBtn: false,
          showOkBtn: true,
        }
      );
    } else if (currentPackage?.cancellationInitialized === true) {
      toggleModal(
        "Your subscription has been canceled and cannot be upgraded.",
        {
          showConfirmBtn: false,
          showCloseBtn: false,
          showOkBtn: true,
        }
      );
    } else {
      window.location.href = "upgradeToPremium.html";
    }
  });

  cancelSubscriptionBtn.addEventListener("click", () => {
    if (currentPackage?.cancellationInitialized === true) {
      toggleModal(
        "Your subscription has already been canceled and will remain active until the paid period ends.",
        { showConfirmBtn: false, showOkBtn: false }
      );
    } else if (currentPackage?.subscriptionPlatform !== "stripe") {
      toggleModal(
        "Kindly cancel your subscription from the platform it was purchased.",
        { showConfirmBtn: false, showOkBtn: false }
      );
    } else {
      toggleModal("Are you sure you want to cancel your subscription?", {
        showConfirmBtn: true,
        showOkBtn: false,
      });

      confirmSubCancelBtn.onclick = () => {
        cancelSubscription();
      };
    }
  });

  // Function to handle cancel subscription
  async function cancelSubscription() {
    try {
      toggleElementVisibility(overlay, true);

      const response = await makeApiCall({
        url: "cancel-subscription",
        auth: true,
      });

      if (response?.success) {
        hideModal();
        toggleElementVisibility(overlay, false);
        showToast(
          "Your subscription has been cancelled",
          toastContainer,
          "success",
          2000
        );
        window.location.href = "../html/home.html";
      }
    } catch (error) {
      toggleElementVisibility(networkError, true);
      showToast("Something went wrong, try again.", toastContainer, "", 2000);
      errorSource = "cancelSubscription";
      console.error("Error123:", error.message);
    } finally {
      toggleElementVisibility(overlay, false);
    }
  }
  updatePaymentBtn.addEventListener("click", () => {
    window.location.href = "../html/updatePayment.html";
  });

  // ========== Initial Call ========== //
  await validateUserPackage();
});
