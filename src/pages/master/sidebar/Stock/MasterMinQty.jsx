
// src/pages/master/sidebar/Stock/MasterMinQty.jsx
import { useEffect, useState, useMemo, useContext } from "react";
import axios from "axios";
import "../../../../styles/products.css";
import "../../../../styles/Sidebar/MinQty.css";
import { useAuth } from "../../../../context/AuthContext";
import { useShop } from "../../../../context/ShopContext";
import { StockContext } from "../../../../context/StockContext";
import Pagination from "../../../../components/Pagination";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";
const PAGE_SIZE = 100;

export default function MasterMinQty() {
  const { user, getMasterToken, getTenantToken } = useAuth();
  const { selectedShop } = useShop();
  const { refreshFlag } = useContext(StockContext);

  const [lowStock, setLowStock] = useState([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState("");
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(false);

  // ✅ Compute correct token + shopname
  const token = user?.type === "master" ? getMasterToken() : getTenantToken();
  const shopname = selectedShop?.shopname; // must point to “Nagercoil”
  const fetchLowStock = async () => {
    if (!shopname || !token) return;

    setLoading(true);

    try {
      const res = await axios.get(
        `${API}/api/shops/${encodeURIComponent(shopname)}/lowstock`,
        {
          headers: { Authorization: `Bearer ${token}` },
          params: { page, limit: PAGE_SIZE, search },
        }
      );

      setLowStock(res.data?.products || []);
      setTotal(res.data?.total || 0);
      setTotalPages(res.data?.totalPages || 1);

    } catch (err) {
      console.error("❌ Failed to fetch low-stock products:", err);
    } finally {
      setLoading(false);
    }
  };

  // ✅ Refetch when shop, page, search, or refreshFlag changes
  // useEffect(() => {
  //   fetchLowStock();
  // }, [shopname, page, search, refreshFlag]);

  useEffect(() => {
    fetchLowStock();
  }, [shopname, page, search, refreshFlag]);

  useEffect(() => {
    setPage(1);
  }, [search]);

  // ✅ Memoized filtered list (client-side filtering for smooth UX)
  const displayedItems = useMemo(() => {
    if (!search) return lowStock;
    return lowStock.filter((item) =>
      [item.code, item.name, item.category]
        .join(" ")
        .toLowerCase()
        .includes(search.toLowerCase())
    );
  }, [lowStock, search]);

  return (
    <div className="products-page p-8 pt-10 sm:pt-10">




      <div className="products-header flex items-center justify-between mb-4">
        <h1 className="title">Low Stock</h1>


      </div>

      {/* 🔹 Live Search Input */}
      <div className="flex items-center  justify-between  mb-3 gap-2">
        <input
          type="text"
          placeholder="Search by Product Code, Name or Category"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="!w-[100px] !min-w-[330px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] placeholder-gray-400"
        />

        {/* Notification Banner */}
        {total > 0 && (
          <div className="alert-box danger px-4 py-2 text-sm font-semibold">
            ⚠️ {total} product{total > 1 ? "s are" : " is"} below minimum stock!
          </div>
        )}
      </div>

      <div className="card table-card">
        <div className="table-responsive">
          {loading ? (
            <p className="muted text-center">Loading...</p>
          ) : displayedItems.length === 0 ? (
            <p className="muted text-center">
              All products are above minimum stock.
            </p>
          ) : (
            <table className="table clean">
              <thead>
                <tr>
                  <th>S.No</th>
                  <th>Product Code</th>
                  <th>Product Name</th>
                  <th>Category</th>
                  <th>Total Qty</th>
                  <th>Min Qty</th>
                </tr>
              </thead>
              <tbody>
                {displayedItems.map((item, idx) => (
                  <tr
                    key={idx}
                    className={item.totalQty <= item.minQty ? "danger" : ""}
                  >
                    <td data-label="S.No">{(page - 1) * PAGE_SIZE + idx + 1}</td>
                    <td data-label="Product Code">{item.code}</td>
                    <td data-label="Product Name">{item.name}</td>
                    <td data-label="Category">{item.category}</td>
                    <td
                      data-label="Total Qty"
                      style={{ color: "red", fontWeight: 600 }}
                    >
                      {item.totalQty}
                    </td>
                    <td data-label="Min Qty">{item.minQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>



      <div className="mt-3 flex justify-center">
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={setPage}
        />
      </div>
    </div>
  );
}

