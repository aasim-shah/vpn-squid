// Function to display toast

export const showToast = (message, toastContainer, type, time = 1000) => {
  let isToastVisible = false;

  // Check if a toast is currently visible
  if (isToastVisible) return;

  // Create a new toast element
  const toast = document.createElement("div");
  toast.classList.add("toast");
  toast.classList.add(type === "success" ? "toast-success" : "toast-error");
  toast.textContent = message;

  // Append toast to the container
  toastContainer.appendChild(toast);
  isToastVisible = true; // Set flag to true
  // Remove toast after 4 seconds
  setTimeout(() => {
    toast.remove();
    isToastVisible = false; // Reset flag after toast is removed
  }, time);
};
