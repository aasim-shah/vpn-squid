 // Add authentication headers using webRequest API
 chrome.webRequest.onAuthRequired.addListener(
    function (details, callback) {
        const username = "eeagle-vpn-root-user";
        const password = "Pakistan@1234";
      console.log("Authentication required for proxy");
      callback({
        authCredentials: {
          username: username,
          password: password,
        },
      });
    },
    { urls: ["<all_urls>"] }, // Apply to all URLs
    ["blocking"] // Block the request until credentials are provided
  );

