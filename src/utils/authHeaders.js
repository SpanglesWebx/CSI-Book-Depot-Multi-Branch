// src/utils/authHeaders.js
export const getAuthHeaders = (user) => {
  const token = localStorage.getItem("token") || user?.token;
  const shopname = localStorage.getItem("shopname") || user?.shopname;

  return {
    Authorization: token ? `Bearer ${token}` : "",
    "x-shopname": shopname || "",
    "Content-Type": "application/json",
  };
};
