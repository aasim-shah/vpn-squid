export const AUTH_TOKEN = JSON.parse(localStorage.getItem("token"));
export const LOGGED_USER = JSON.parse(localStorage.getItem("userinfo"));
export const CURRENT_PACKAGE =
  JSON.parse(localStorage.getItem("userPackage")) || {};

export const API_KEY = "svhhdbhweuydhscwhbduy7823ouyewebdhvhhas";
export const BASE_URL = "http://localhost:9000";


export const STRIPE_PUBLIC_KEY='pk_test_51QMSPPRtDhEDhmjwwYKfFokdeNlDMgpDeprjiaKfISEiDDHKI4RXk8UujE5up1l8Ls6drooYQzj9jJEjHxIKmBoS00DvTW2ZtU'
export const makeApiCall = async ({
  url,
  method = "GET",
  headers = {},
  body = null,
  auth = false,
}) => {
  // Make the API request
  const response = await fetch(`${BASE_URL}/${url}`, {
    method,
    headers: {
      ...headers,
      "Content-Type": "application/json",
      "x-api-key": API_KEY,
      Authorization: auth ? `Bearer ${AUTH_TOKEN}` : undefined,
    },
    body: body ? JSON.stringify(body) : null,
  });

  // Parse the response JSON
  const data = await response.json();

  // Return the response data
  return data;
};

/*
       "https://dev.eeaglevpn.com"
       "http://localhost:3000"
      "https://evpn-api.eeaglevpn.com"

      */
