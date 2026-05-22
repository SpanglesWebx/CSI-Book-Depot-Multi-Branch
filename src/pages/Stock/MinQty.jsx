// src/pages/Stock/MinQty.jsx
import { useEffect, useState, useMemo, useContext, useCallback } from "react";
import axios from "axios";
import "../../styles/products.css";
import "../../styles/Sidebar/MinQty.css";
import { useAuth } from "../../context/AuthContext";
import { ShopContext } from "../../context/ShopContext";
import Pagination from "../../components/Pagination";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function MinQty() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [limit] = useState(100);
  const [totalPages, setTotalPages] = useState(1);

  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  const shopname = selectedShop?.name || user?.shopname;
  const token = localStorage.getItem("token");
  const [totalProducts, setTotalProducts] = useState(0);

  // ✅ Build API URL based on tenant/master context
  const getApiUrl = useCallback(() => {
    if (selectedShop?._id) {
      return `${API}/api/shops/${selectedShop._id}/products`;
    }
    return `${API}/api/products`;
  }, [selectedShop]);

  const fetchLowStock = useCallback(async () => {
    if (!shopname || !token) return;

    setLoading(true);

    try {
      const res = await axios.get(`${API}/api/products/low-stock`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-shopname": shopname,
        },
        params: {
          page,
          limit,
          search,
        },
      });

      setProducts(res.data.products || []);
      setTotalPages(res.data.totalPages || 1);
      setTotalProducts(res.data.totalProducts || 0);
    } catch (error) {
      console.error("Error fetching low stock products:", error);
      setProducts([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  }, [shopname, token, page, limit, search]);

  // ✅ Fetch when dependencies change
  useEffect(() => {
    fetchLowStock();
  }, [fetchLowStock]);

  // ✅ Reset page when search changes
  const handleSearchChange = (e) => {
    setSearch(e.target.value);
    setPage(1);
  };


  return (
    <div className="products-page p-8 pt-10 sm:pt-10">


      {/* Header */}
      <div className="products-header flex items-center justify-between mb-4">
        <h1 className="title">Low Stock</h1>


      </div>


      {/* Search */}
      {/* Search + Notification */}
      <div className="flex items-center justify-between mb-3 gap-4">
        {/* Search */}
        <input
          type="text"
          placeholder="Search by Product Code or Name"
          value={search}
          onChange={handleSearchChange}
          className="!w-[300px] md:!w-[320px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
        />

        
        {/* Notification Banner */}
        {totalProducts > 0 && (
          <div className="alert-box danger px-4 py-2 text-sm font-semibold whitespace-nowrap">
            ⚠️ {totalProducts} product
            {totalProducts > 1 ? "s are" : " is"} below minimum stock!
          </div>
        )}
      </div>



      {/* Table */}
      <div className="card table-card">


        {/* Notification Banner */}


        <div className="table-responsive">
          {loading ? (
            <p className="muted text-center">Loading...</p>
          ) : products.length === 0 ? (
            <p className="muted text-center">All products are above minimum stock.</p>
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
                {products.map((p, idx) => (
                  <tr key={p._id} className="danger">
                    <td data-label="S.No">{idx + 1 + (page - 1) * limit}</td>
                    <td data-label="Product Code">{p.code}</td>
                    <td data-label="Product Name">{p.name}</td>
                    <td data-label="Category">{p.category}</td>
                    <td data-label="Total Qty" style={{ color: "red", fontWeight: 600 }}>
                      {p.totalQty}
                    </td>
                    <td data-label="Min Qty">{p.minQty}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>



      {/* Pagination */}
      <div className="mt-3 flex justify-center">
        <Pagination
          page={page}
          totalPages={totalPages}
          onPageChange={(newPage) => setPage(newPage)}
        />
      </div>
    </div>
  );
}

