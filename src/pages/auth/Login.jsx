
// // src/pages/auth/Login.jsx
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import { FaEye, FaEyeSlash } from "react-icons/fa";
import logo from "../../assets/logo-icon.png";
import { useAuth } from "../../context/AuthContext";
import { useShop } from "../../context/ShopContext";
import { toast } from "react-toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";


const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function Login() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { login, user } = useAuth();
  const { setSelectedShop } = useShop();
  const [selectedCounter, setSelectedCounter] = useState("");
  const [availableCounters, setAvailableCounters] = useState([]);
  const [showCounterSelection, setShowCounterSelection] = useState(false);
  const [pendingShop, setPendingShop] = useState(null);
  const [confirmCounter, setConfirmCounter] = useState(null);




  useEffect(() => {
    if (!user) return;

    if (user.role === "megaadmin" || user.role === "manager") {
      navigate("/master-dashboard", { replace: true });
    } else {
      navigate("/dashboard", { replace: true });
    }
  }, [user]);


  const persistUser = (token, user) => {
    localStorage.setItem("token", token);
    localStorage.setItem("user", JSON.stringify(user));

    if (user?.shopname) {
      localStorage.setItem("shopname", user.shopname);
    }

    // ⭐ NEW: Save counter returned by backend
    if (user?.counter) {
      localStorage.setItem("counter", user.counter);
    }
  };


  //   useEffect(() => {
  //   const user = localStorage.getItem("user");
  //   const masterToken = localStorage.getItem("masterToken");
  //   const tenantToken = localStorage.getItem("tenantToken");

  //   if (!user) return;

  //   const parsedUser = JSON.parse(user);

  //   if (parsedUser.type === "master" && masterToken) {
  //     navigate("/master-dashboard", { replace: true });
  //   }

  //   if (parsedUser.type !== "master" && tenantToken) {
  //     navigate("/dashboard", { replace: true });
  //   }
  // }, [navigate]);





  const handleLogin = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);


    try {
      const masterRes = await axios.post(`${API}/api/master/auth/login`, {
        username,
        password,
      });

      const { token, user } = masterRes.data;

      persistUser(token, user);
      login(user, token);

      // ⭐ IMPORTANT FIX
      setSelectedShop(null);
      localStorage.removeItem("selectedShop");
      localStorage.removeItem("shopname");
      localStorage.removeItem("counter");
      localStorage.setItem("exitShop", "true");

      toast.success("Master Login Successful! 🎉");

      // navigate("/master-dashboard", { replace: true });
      navigate("/master-dashboard");
      return;

    } catch (masterErr) {
      console.warn("Master login failed → checking tenant...");
    }




    // 2️⃣ TENANT LOGIN
    try {
      const shopRes = await axios.get(
        `${API}/api/shops/public/findByUsername/${username}`
      );

      const shopname = shopRes.data?.shopname;
      if (!shopname) throw new Error("User not found");

      const totalCounters = Number(shopRes.data.counters || 1);

      const counters = Array.from(
        { length: totalCounters },
        (_, i) => i + 1
      );

      setPendingShop({
        shopname: shopRes.data.shopname,
        shopData: shopRes.data,
      });

      setAvailableCounters(counters);

      setShowCounterSelection(true);

      setLoading(false);

      return;




      // ⭐ USE shopRes.data (NOT user)
      setSelectedShop({
        shopId: shopRes.data.shopId,
        shopname: shopRes.data.shopname,
        address: shopRes.data.address || "",
        contact: shopRes.data.contact || "",
        tenantDbUri: shopRes.data.tenantDbUri || ""
      });



      toast.success("Login Successful! 🎉");

      // navigate("/dashboard", { replace: true });
      navigate("/dashboard");
    } catch (tenantErr) {
      console.error("Tenant login failed:", tenantErr);

      let message =
        tenantErr.response?.data?.message ||
        tenantErr.message ||
        "Login failed";

      if (message.includes("User not found in any shop")) {
        message = "User not found";
      }

      // Custom error handling
      if (tenantErr.response?.status === 403) {
        if (
          tenantErr.response?.data?.message?.includes(
            "Counter authentication failed"
          )
        ) {
          toast.error(
            "This system is not allowed to login for this branch. (Counter authentication failed)"
          );
        } else {
          toast.error("Your account is INACTIVE. Please contact the Manager.");
        }
      } else {
        toast.error(message);
      }
    } finally {
      setLoading(false);
    }
  };

  const continueTenantLogin = async () => {
    try {
      if (!selectedCounter) {
        toast.error("Please select counter");
        return;
      }

      setLoading(true);

      const tenantRes = await axios.post(
        `${API}/api/tenant/auth/login`,
        {
          username,
          password,
          shopname: pendingShop.shopname,
          counter: selectedCounter,
        }
      );

      const { token, user } = tenantRes.data;

      persistUser(token, user);

      login(user, token);

      setSelectedShop({
        shopId: pendingShop.shopData.shopId,
        shopname: pendingShop.shopData.shopname,
        address: pendingShop.shopData.address || "",
        contact: pendingShop.shopData.contact || "",
        tenantDbUri: pendingShop.shopData.tenantDbUri || "",
      });

      toast.success("Login Successful!");

      setShowCounterSelection(false);

      navigate("/dashboard");

    } catch (err) {
      console.error(err);

      toast.error(
        err.response?.data?.message || "Login failed"
      );
    } finally {
      setLoading(false);
    }
  };



  return (
    <div
      style={{
        display: "flex",
        minHeight: "100vh",
        alignItems: "center",
        justifyContent: "center",
        backgroundColor: "#C8FAD6",
        // background: "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 100%)",
        padding: "1rem",
      }}
    >
      <ToastContainer position="top-right" autoClose={3000} />
      <form
        onSubmit={handleLogin}
        autoComplete="off"
        style={{
          background:
            "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 90%)",
          padding: "2rem",
          borderRadius: "1rem",
          boxShadow: "0 8px 20px rgba(0,0,0,0.15)",
          width: "100%",
          maxWidth: "400px",
          display: "flex",
          flexDirection: "column",
          gap: "1rem",
          transition: "all 0.3s ease-in-out",
          animation: "fadeIn 0.5s ease-in-out",
          alignItems: "center",
        }}
      >

        {/* Chrome Autofill Blockers */}
        <input
          type="text"
          name="fake-user"
          autoComplete="new-username"
          style={{ display: "none" }}
        />
        <input
          type="password"
          name="fake-pass"
          autoComplete="new-password"
          style={{ display: "none" }}
        />

        {/* Logo */}
        <img src={logo} alt="Logo" style={{ width: "130px" }} />

        {/* Main Heading */}
        <h2
          style={{
            fontSize: "1.25rem",
            fontWeight: "bold",
            textAlign: "center",
            margin: 0,
            background: "linear-gradient(320deg, #007867, #00C896, #007867)",
            backgroundSize: "200% 200%",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            animation: "gradientMove 6s ease infinite",
            display: "inline-block",
          }}
        >
          CSI Diocese Book Depot
        </h2>

        <style>
          {`
      @keyframes gradientMove {
        0% { background-position: 0% 50%; }
        50% { background-position: 100% 50%; }
        100% { background-position: 0% 50%; }
      }
    `}
        </style>
        {!showCounterSelection && (
          <>
            {/* Username Input */}
            <input
              type="text"
              placeholder="Username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
              name="username"
              autoComplete="off"
              autoCorrect="off"
              spellCheck="false"
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                border: "1px solid #007867",
                fontSize: "1rem",
                transition: "all 0.3s ease",
              }}
              onFocus={(e) => (e.target.style.borderColor = "#00A76F")}
              onBlur={(e) => (e.target.style.borderColor = "#007867")}
            />

            {/* Password Input */}
            <div className="relative w-full max-w-sm">
              <input
                type={showPassword ? "text" : "password"}
                placeholder="Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                name="password"
                autoComplete="new-password"
                autoCorrect="off"
                spellCheck="false"
                className="w-full px-4 py-3 border border-[#007867] rounded-lg text-base outline-none transition-all duration-300 focus:border-[#00A76F]"
              />
              <button
                type="button"
                onClick={() => setShowPassword(!showPassword)}
                className="absolute inset-y-0 right-3 flex items-center text-gray-500 hover:text-[#007867] focus:outline-none"
              >
                {showPassword ? <FaEyeSlash size={20} /> : <FaEye size={20} />}
              </button>
            </div>

            {/* Error Message */}
            {error && (
              <p
                style={{
                  color: "red",
                  fontSize: "0.85rem",
                  textAlign: "center",
                  marginTop: "-0.5rem",
                }}
              >
                {error}
              </p>
            )}

            {/* Login Button */}
            <button
              type="submit"
              disabled={loading}
              style={{
                padding: "0.75rem",
                borderRadius: "0.5rem",
                backgroundColor: "#00A76F",
                color: "#fff",
                fontWeight: "bold",
                fontSize: "1rem",
                cursor: loading ? "not-allowed" : "pointer",
                transition: "all 0.3s ease",
              }}
              onMouseEnter={(e) => (e.target.style.backgroundColor = "#007867")}
              onMouseLeave={(e) => (e.target.style.backgroundColor = "#00A76F")}
            >
              {loading ? "Logging in..." : "Login"}
            </button>
          </>)}

        {showCounterSelection && (
          <div className="w-full flex flex-col gap-4 mt-2">

            <h2
              style={{
                fontSize: "1.1rem",
                fontWeight: "600",
                textAlign: "center",
                color: "#007867",
              }}
            >
              Select Counter
            </h2>

            <div className="w-full max-h-[180px] overflow-y-auto pr-1">

              <div className="grid grid-cols-2 gap-3 w-[250px] mx-auto">

                {availableCounters.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => {
                      setSelectedCounter(c);
                      setConfirmCounter(c);
                    }}
                    className="border-2 border-[#007867] rounded-xl py-2 text-lg font-bold text-[#007867] hover:bg-[#007867] hover:text-white transition-all duration-200"
                  >
                    Counter {c}
                  </button>
                ))}

              </div>

            </div>

            <button
              type="button"
              onClick={() => {
                setShowCounterSelection(false);
                setSelectedCounter("");
              }}
              className="text-sm text-gray-500 hover:text-black"
            >
              Back
            </button>
          </div>
        )}
      </form>

      {confirmCounter && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50">

          <div className="bg-white rounded-2xl p-6 w-[320px] shadow-xl">

            <h2 className="text-lg font-semibold text-center text-[#007867]">
              Confirm Login
            </h2>

            <p className="text-center mt-3 text-gray-700">
              Are you sure you want to login as
            </p>

            <div className="text-center text-2xl font-bold text-[#007867] mt-2">
              Counter {confirmCounter} ?
            </div>

            <div className="flex gap-3 mt-6">

              <button
                type="button"
                onClick={continueTenantLogin}
                className="flex-1 bg-[#00A76F] text-white py-2 rounded-lg font-semibold hover:bg-[#007867]"
              >
                Yes
              </button>

              <button
                type="button"
                onClick={() => {
                  setConfirmCounter(null);

                  setShowCounterSelection(false);

                  setSelectedCounter("");
                }}
                className="flex-1 border border-gray-300 py-2 rounded-lg font-semibold hover:bg-gray-100"
              >
                No
              </button>

            </div>
          </div>
        </div>
      )}

      <style>
        {`
          @keyframes fadeIn {
            from { opacity: 0; transform: translateY(-20px); }
            to { opacity: 1; transform: translateY(0); }
          }

          @media (max-width: 768px) {
            form {
              padding: 1.5rem;
              width: 90%;
            }

            h2 {
              font-size: 1.75rem;
            }

            input, button {
              font-size: 0.95rem;
            }
          }
        `}
      </style>
    </div>
  );
}
