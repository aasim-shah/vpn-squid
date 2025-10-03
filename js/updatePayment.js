import { showToast } from "./common.js";
import { API_KEY, BASE_URL, makeApiCall, STRIPE_PUBLIC_KEY } from "./config.js";

document.addEventListener("DOMContentLoaded", async () => {

  const elements = {
    closeModal: document.querySelector(".close-modal"),
    closeButton: document.querySelector(".close-button"),
    attachedCard: document.getElementById("attachedCard"),
    modal: document.querySelector(".add-card-modal"),
    toastContainer: document.getElementById("toastContainer"),
    addCardButton: document.querySelector(".add-card-button"),
    addCardModal: document.getElementById("addCardModal"),
    addCardForm: document.getElementById("addCardForm"),
    overlay: document.querySelector(".overlay"),
    cardContainer: document.querySelector(".card-container"),
    popScreenOverlay: document.querySelector(".popup-screen-overlay"),
    popupCancelBtn: document.querySelector(".popup-cancel-btn"),
  };

  const data = [
    {
      id: "pm_1QXiIgRtDhEDhmjwAbUad62P",
      card: { brand: "visa", exp_month: 12, exp_year: 2034, last4: "4242" },
    },
    {
      id: "pm_1QXiIgRtD33453545hEDhmjwAbUad62P",
      card: { brand: "visa", exp_month: 12, exp_year: 2034, last4: "4242" },
    },
  ];

  // Open modal
  elements.addCardButton.addEventListener("click", async () => {
    // Hide the current card container and show the modal
    elements.cardContainer.style.display = "none";
    elements.addCardModal.style.display = "flex";
  });

  // Hide popup modal
  elements.popupCancelBtn.addEventListener("click", () => {
    elements.popScreenOverlay.style.display = "none";
  });

  elements.closeButton.addEventListener("click", () => {
    window.location.href = "../html/upgradeSubscriptions.html";
  });

  // Input restrictions
  const restrictInput = (selector, regex, maxLength) => {
    const input = document.getElementById(selector);
    input.addEventListener("input", (e) => {
      e.target.value = e.target.value.replace(/\D/g, "").slice(0, maxLength);
      if (regex) {
        e.target.value =
          e.target.value.match(regex)?.join(" ") || e.target.value;
      }
    });
  };

  restrictInput("cardNumber", /.{1,4}/g, 16); // Restrict card number to 16 digits
  restrictInput("cvc", null, 3); // Restrict CVC to 3 characters

  // Manage expiry date input as MM/YY
  const handleExpiryInput = (e) => {
    let value = e.target.value.replace(/\D/g, ""); // Remove non-numeric characters
    if (value.length > 2) {
      value = `${value.slice(0, 2)}/${value.slice(2, 4)}`; // Add slash after MM
    }
    e.target.value = value.slice(0, 5); // Limit to MM/YY format
  };

  document
    .getElementById("expMonth")
    .addEventListener("input", handleExpiryInput);

  // Render cards
  const renderCards = () => {
    elements.attachedCard.innerHTML = data
      .map(
        (item) => `
          <div class="card">
            ${
              data.length > 1
                ? `<img src="../public/delete-icon.svg" alt="Delete Icon" class="delete-icon" />`
                : ""
            }
            <div class="card-content">
              <img src="../public/master-card.svg" alt="Card Icon" class="card-icon"/>
              <p>
                <span class="circles">⬤⬤⬤⬤ ⬤⬤⬤⬤ ⬤⬤⬤⬤</span>
                <span class="last4">${item.card.last4}</span>
              </p>
            </div>
          </div>`
      )
      .join("");

    // Attach event listeners after rendering
    const removeCards = document.querySelectorAll(".delete-icon");
    removeCards.forEach((removeCard) => {
      removeCard.addEventListener("click", () => {
        elements.popScreenOverlay.style.display = "flex";
      });
    });
  };

  // Form submission
  elements.addCardForm.addEventListener("submit", async (e) => {
    e.preventDefault();

    const cardNumber = document
      .getElementById("cardNumber")
      .value.replace(/\s/g, "");
    const expiry = document.getElementById("expMonth").value.trim();
    const cvc = document.getElementById("cvc").value.trim();

    const validations = [
      {
        value: cardNumber,
        regex: /^\d{16}$/,
        message: "Card number must be 16 digits.",
      },
      {
        value: expiry,
        regex: /^(0[1-9]|1[0-2])\/\d{2}$/,
        message: "Expiry date must be in MM/YY format.",
      },
      {
        value: cvc,
        regex: /^\d{3}$/,
        message: "CVC must be exactly 3 digits.",
      },
    ];

    for (const { value, regex, message } of validations) {
      if (!regex.test(value)) {
        showToast(message, elements.toastContainer);
        return;
      }
    }

    try {
      const [expMonth, expYear] = expiry.split("/").map(Number);
      const response = await makeApiCall({
        url: "add-card",
        method: "POST",
        auth: true,
        data: { cardNumber, expMonth, expYear, cvc },
      });

      if (response.success) {
        showToast(
          "Card added successfully!",
          elements.toastContainer,
          "success"
        );
        elements.addCardModal.classList.add("hidden");
        await getUserCards();
      } else {
        showToast(
          response.message || "Failed to add card.",
          elements.toastContainer,
          "error"
        );
      }
    } catch (error) {
      console.error("Error adding card:", error.message);
      showToast(
        "An error occurred while adding the card.",
        elements.toastContainer,
        "error"
      );
    }
  });

  // Fetch user cards
  const getUserCards = async () => {
    try {
      const response = await makeApiCall({ url: "user-cards", auth: true });
      if (response.success) {
        renderCards();
      } else {
        showToast(
          response.message || "Failed to fetch cards.",
          elements.toastContainer,
          "error"
        );
      }
    } catch (error) {
      console.error("Error fetching cards:", error.message);
    } finally {
      elements.overlay.style.display = "none";
    }
  };


  // Remove card
  elements.attachedCard.addEventListener("click", (event) => {
    if (event.target.classList.contains("remove-card")) {
      const cardIndex = event.target.getAttribute("data-index");
      data.splice(cardIndex, 1);
      renderCards();
    }
  });

  // Initial fetch
  await getUserCards();
});
