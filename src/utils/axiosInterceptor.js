import axios from "axios";

axios.interceptors.response.use(
  (response) => response,

  (error) => {

    if (error.response?.status === 401) {

      // token expired or invalid
      window.dispatchEvent(new Event("tokenExpired"));

    }

    return Promise.reject(error);
  }
);