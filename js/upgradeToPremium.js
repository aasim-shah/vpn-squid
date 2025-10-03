import { makeApiCall } from "./config.js";
export const CURRENT_PACKAGE =
  JSON.parse(localStorage.getItem("userPackage")) || {};

document.addEventListener("DOMContentLoaded", () => {
  // Fetch server data
  const loader = document.getElementById("subscription-loader");
  const productListContainer = document.querySelector(".product-list");
  const closeButton = document.querySelector(".close-button");
  const premiumTitle = document.querySelector(".get-premium");
  // =============== Error Handling ========= //
  const networkError = document.getElementById("network-error");
  const retryButton = document.getElementById("retry-button");
  let errorSource = null;

  if (CURRENT_PACKAGE?._id) {
    premiumTitle.textContent = `Upgrade Premium! `;
  }
  // Function to render products
  async function fetchProducts() {
    loader.style.display = "flex";
    try {
      const response = await makeApiCall({ url: "products/list", auth: true });
      console.log({ response})

      if (Array.isArray(response?.data) && response.data.length > 0) {
        renderProductList(response.data);
      } else {
        productListContainer.innerHTML = `<p>No products available</p>`;
      }
    } catch (error) {
      errorSource = "fetchProducts";
      networkError.style.display = "flex";
    } finally {
      loader.style.display = "none";
    }
  }

  function renderProductList(products) {
    // Clear existing content
    productListContainer.innerHTML = "";

    // Loop through each product to create the custom list
    products.forEach((product) => {
      const isCurrentPackage =
        product.productId === CURRENT_PACKAGE?.identifier;

      // Render the product item HTML
      productListContainer.innerHTML += `
<div class="product-item ${isCurrentPackage ? "disabled" : ""}" 
     style="${isCurrentPackage ? " cursor: not-allowed;" : ""}">
  ${
    isCurrentPackage
      ? '<div class="current-package-label">Current Plan</div>'
      : ""
  }
  <input 
    type="radio" 
    name="product" 
    value="${product.productId}" 
    class="product-radio" 
    ${isCurrentPackage ? "disabled" : ""} 
  />
  <div class="product-content">
    <div class="product-details">
      <span class="product-name">${product.name}</span>
      <span class="product-description">${product.description || "Sign in Upto 5 Devices"}</span>
    </div>
    <div class="product-price">$${product.price}</div>
  </div>
</div>
`;
    });

    // Add the Continue button at the end
    productListContainer.innerHTML += `
    <button id="subscribe-button" class="subscribe-button" disabled>
      Continue
    </button>
  `;

    // Add event listeners for radio button changes
    const productItems = document.querySelectorAll(".product-item");
    const subscribeButton = document.getElementById("subscribe-button");

    productItems.forEach((item) => {
      const radio = item.querySelector(".product-radio");

      // Skip disabled items
      if (radio.disabled) return;

      item.addEventListener("click", () => {
        // Check the radio button
        radio.checked = true;

        // Update styles
        productItems.forEach((el) => el.classList.remove("selected"));
        item.classList.add("selected");

        // Get the selected item's name
        const selectedProductName =
          item.querySelector(".product-name").textContent;

        // Update the Subscribe button text with the selected item's name
        subscribeButton.textContent = `Continue (${selectedProductName})`;

        // Enable the Subscribe button
        subscribeButton.disabled = false;
      });
    });

    // Select the first item by default
    const firstProductItem = document.querySelector(
      ".product-item:not(.disabled)"
    );
    if (firstProductItem) {
      const firstRadio = firstProductItem.querySelector(".product-radio");
      firstRadio.checked = true; // Select the first radio button
      firstProductItem.classList.add("selected");

      const firstProductName =
        firstProductItem.querySelector(".product-name").textContent;

      // Update the Subscribe button text with the first product name
      subscribeButton.textContent = `Continue (${firstProductName})`;

      // Enable the Subscribe button
      subscribeButton.disabled = false;
    }

    // Handle Subscribe button click
    subscribeButton.addEventListener("click", async (event) => {
      event.preventDefault();

      // Get the selected radio button
      const selectedRadio = document.querySelector(".product-radio:checked");
      if (!selectedRadio) return;
      // Extract the product ID
      const productId = selectedRadio.value;
      if (!productId) {
        console.error("Product ID is undefined");
        return;
      }

      try {
        loader.style.display = "flex";

        const response = await makeApiCall({
          url: "create-checkout-session",
          method: "POST",
          auth: true,
          body: {
            productId,
            upgrade: CURRENT_PACKAGE?._id ? true : undefined,
          },
        });

        if (response?.success) {
          window.open(response.url);
          window.close();
        } else {
          console.error("Error creating checkout session:", data.error);
        }
      } catch (error) {
        console.error("Error subscribing to product:", error);
      } finally {
        loader.style.display = "none";
      }
    });
  }

  closeButton.addEventListener("click", () => {
    window.location.href = "../html/home.html";
  });

  // Function to handle retry button
  retryButton.addEventListener("click", () => {
    networkError.style.display = "none";
    loader.style.display = "flex";

    // Set proxy to "direct"
    chrome.proxy.settings.set({ value: { mode: "direct" }, scope: "regular" });

    // Switch logic
    switch (errorSource) {
      case "fetchProducts":
        fetchProducts();
        break;

      default:
        // Reload the current page in default case
        location.reload();
        break;
    }
  });

  // Fetch and render products on page load
  fetchProducts();
});
