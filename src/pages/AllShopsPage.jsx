
// src/pages/AllShopsPage.jsx
import { useState, useEffect } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import "../styles/allShops.css";
import { useShop } from "../context/ShopContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AllShopsPage() {
  const [shops, setShops] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const { setSelectedShop } = useShop();
  const navigate = useNavigate();

  const token = localStorage.getItem("token");
  const headers = { Authorization: `Bearer ${token}` };

  // ✅ Fetch all shops (no limit)
  useEffect(() => {
    const fetchShops = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await axios.get(`${API}/api/shops?limit=0`, { headers });
        const data = Array.isArray(res.data.shops) ? res.data.shops : [];
        setShops(data);
      } catch (err) {
        console.error("Failed to fetch shops:", err);
        setError("Failed to load shops");
      } finally {
        setLoading(false);
      }
    };
    fetchShops();
  }, []);

  const selectShop = (shop) => {
    if (!shop?.shopname) return;

    // Persist the selected shop
    setSelectedShop(shop);
    try {
      localStorage.setItem("selectedShop", JSON.stringify(shop));
    } catch (e) {
      console.warn("Failed saving selectedShop to localStorage", e);
    }
    localStorage.setItem("shopname", shop.shopname);
    localStorage.setItem("shopId", shop._id || "");

    // Navigate and scroll to top
    navigate("/user-dashboard");
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  return (
    <div className="all-shops-page p-6 pt-10 sm:pt-10">
      <h1 className=" text-2xl sm:text-3xl font-bold mb-6   text-[28px]  text-[#00a76f]">
        Branches
      </h1>

      {loading && <p className="text-green-500 text-center">Loading Branch...</p>}
      {error && <p className="text-red-500 text-center">{error}</p>}


      <div className="shops-grid grid gap-6 grid-cols-1 sm:grid-cols-2 lg:grid-cols-3">
        {shops.map((shop) => (
          <div
            key={shop._id}
            className="shop-card p-6 border border-[#C8FAD6] shadow-md rounded-2xl transform transition duration-300 hover:-translate-y-2 hover:shadow-xl hover:bg-[#C8FAD6]/60"
            style={{
              background:
                "linear-gradient(320deg, rgba(211, 252, 210, 0.7) 0%, #ffffff 70%)",
              cursor: "default",
            }}
          >
            <h2 className="font-semibold text-xl text-[#007867] mb-4 text-center">
              {shop.shopname}
            </h2>


            <hr className="border-t-2 border-[#00A76F] w-full mb-4" />

            <div className="space-y-1 text-gray-700 break-words">
              {shop.designation && (
                <div className="flex">
                  <span className="font-medium text-[#00A76F] w-20 shrink-0">
                    Designation:
                  </span>
                  <span className="flex-1">{shop.designation}</span>
                </div>
              )}
              {shop.contact && (
                <div className="flex">
                  <span className="font-medium text-[#00A76F] w-20 shrink-0">
                    Contact:
                  </span>
                  <span className="flex-1">{shop.contact}</span>
                </div>
              )}
            


              {shop.address && (
                <div className="flex items-start">
                  <span className="font-medium text-[#00A76F] w-20 shrink-0">
                    Address:
                  </span>
                  <span className="flex-1 break-words whitespace-pre-wrap">
                    {shop.address}
                  </span>
                </div>
              )}



            </div>


            <div className="mt-4 w-full text-right">
              <span
                onClick={() => selectShop(shop)}
                className="text-[#00A76F] font-bold cursor-pointer hover:text-[#007867] active:text-[#007867]/90 transition duration-200 inline-block"
              >
                View Branch
              </span>
            </div>
          </div>
        ))}
        {shops.length === 0 && !loading && (
          <p className="text-gray-400 text-center">No shops found.</p>
        )}
      </div>



    </div>
  );
}
