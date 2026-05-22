
// src/pages/master/sidebar/Stock/MasterAddStock.jsx
import { useState, useEffect, useContext } from "react";
import axios from "axios";
import "../../../../styles/AddStock.css";
import { useAuth } from "../../../../context/AuthContext";
import { ShopContext } from "../../../../context/ShopContext";
import { StockContext } from "../../../../context/StockContext";


const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AddStock() {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  const { triggerRefresh } = useContext(StockContext);

  const shopname = selectedShop?.shopname || selectedShop?.name || user?.shopname || null;

  // Candidate base endpoints (robust)
  const buildProductEndpoints = () => {
    const list = [];
    if (shopname) {
      // tenant mounted variants
      list.push(`${API}/api/tenant/shops/${encodeURIComponent(shopname)}/products`);
      list.push(`${API}/api/shops/${encodeURIComponent(shopname)}/products`);
    }
    // tenant/global
    list.push(`${API}/api/tenant/products`);
    list.push(`${API}/api/products`);
    return list;
  };

  const [products, setProducts] = useState([]);
  const [form, setForm] = useState({
    code: "",
    name: "",
    batchNo: "",
    mrp: "",
    salePrice: "",
    qty: "",
    category: "",
  });

  const [codeSuggestions, setCodeSuggestions] = useState([]);
  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [availableBatches, setAvailableBatches] = useState([]);

  const [showCodeList, setShowCodeList] = useState(false);
  const [showNameList, setShowNameList] = useState(false);
  const [showBatchList, setShowBatchList] = useState(false);

  const [popup, setPopup] = useState({ show: false, type: "", message: "" });

  const getToken = () =>
    localStorage.getItem("tenantToken") || localStorage.getItem("masterToken") || localStorage.getItem("token") || null;

  // robust GET: try endpoints until success
  const tryGet = async (candidates, config = {}) => {
    let lastErr = null;
    for (const url of candidates) {
      try {
        const res = await axios.get(url, config);
        return res;
      } catch (err) {
        lastErr = err;
      }
    }
    throw lastErr;
  };

  useEffect(() => {
    const load = async () => {
      // if no token, show warning but allow UI to show - no crash
      const token = getToken();
      if (!token) {
        setPopup({ show: true, type: "warning", message: "No token found — please login to perform operations." });
        setTimeout(() => setPopup({ show: false, type: "", message: "" }), 3500);
        return;
      }

      const headers = { Authorization: `Bearer ${token}`, ...(shopname ? { "x-shopname": shopname } : {}) };
      try {
        const endpoints = buildProductEndpoints();
        const res = await tryGet(endpoints, { headers });
        // res.data might be array or { products: [...] }
        const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.products) ? res.data.products : res.data?.items || [];
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Failed to fetch products", err);
        setProducts([]);
        showPopup("error", "Failed to fetch products");
      }
    };

    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shopname]);

  const getMatchingProducts = (key, value) =>
    products.filter((p) => (p[key] || "").toLowerCase().includes(value.toLowerCase()));

  const onCodeChange = (val) => {
    setForm((f) => ({ ...f, code: val }));
    const trimmedVal = val.trim().toLowerCase();
    if (!trimmedVal) {
      setShowCodeList(false);
      setForm((f) => ({ ...f, name: "", batchNo: "", mrp: "", salePrice: "", qty: "", category: "" }));
      setAvailableBatches([]);
      setShowBatchList(false);
      return;
    }
    const matches = products.filter((p) => (p.code || "").toLowerCase().includes(trimmedVal));
    setCodeSuggestions(matches);
    setShowCodeList(true);

    const exact = products.find((p) => (p.code || "").toLowerCase() === trimmedVal);
    if (exact) {
      setForm((f) => ({ ...f, code: exact.code, name: exact.name, category: exact.category, batchNo: "", mrp: "", salePrice: "", qty: "" }));
      setAvailableBatches(products.filter((p) => p.code === exact.code));
      setShowBatchList(true);
    } else {
      setShowBatchList(false);
      setAvailableBatches([]);
    }
  };

  const onCodeSelect = (prod) => {
    setForm((f) => ({ ...f, code: prod.code, name: prod.name, category: prod.category, batchNo: "", mrp: "", salePrice: "", qty: "" }));
    setAvailableBatches(getMatchingProducts("code", prod.code));
    setShowBatchList(true);
    setShowCodeList(false);
  };

  const onNameChange = (val) => {
    setForm((f) => ({ ...f, name: val }));
    if (!val.trim()) {
      setShowNameList(false);
      setForm((f) => ({ ...f, code: "", batchNo: "", mrp: "", salePrice: "", qty: "", category: "" }));
      setAvailableBatches([]);
      return;
    }
    const matches = getMatchingProducts("name", val);
    setNameSuggestions(matches);
    setShowNameList(true);
    const exact = products.find((p) => (p.name || "").toLowerCase() === val.toLowerCase());
    if (exact) {
      setForm((f) => ({ ...f, code: exact.code, category: exact.category, name: exact.name }));
      setAvailableBatches(getMatchingProducts("name", exact.name));
      setShowBatchList(true);
    }
  };

  const onNameSelect = (prod) => {
    setForm((f) => ({ ...f, code: prod.code, name: prod.name, category: prod.category, batchNo: "", mrp: "", salePrice: "", qty: "" }));
    setAvailableBatches(getMatchingProducts("name", prod.name));
    setShowBatchList(true);
    setShowNameList(false);
  };

  const onBatchSelect = (batch) => {
    setForm((f) => ({ ...f, batchNo: batch.batchNo, mrp: batch.mrp, salePrice: batch.salePrice, qty: "" }));
    setShowBatchList(false);
  };

  const addStock = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.batchNo || !form.qty) {
      return showPopup("error", "Please fill all required fields!");
    }

    const token = getToken();
    if (!token) {
      showPopup("warning", "No token found. Please login to add stock.");
      return;
    }

    const headers = { Authorization: `Bearer ${token}`, ...(shopname ? { "x-shopname": shopname } : {}) };

    // candidate endpoints for increment-stock
    const endpoints = [
      ...(shopname ? [`${API}/api/tenant/shops/${encodeURIComponent(shopname)}/products/increment-stock`, `${API}/api/shops/${encodeURIComponent(shopname)}/products/increment-stock`] : []),
      `${API}/api/tenant/products/increment-stock`,
      `${API}/api/products/increment-stock`,
    ];

    try {
      let ok = false;
      let lastErr = null;
      for (const url of endpoints) {
        try {
          await axios.put(url, {
            code: form.code,
            batchNo: form.batchNo,
            qty: Number(form.qty),
            mrp: Number(form.mrp || 0),
            salePrice: Number(form.salePrice || 0),
            name: form.name,
            category: form.category,
          }, { headers });
          ok = true;
          break;
        } catch (err) {
          lastErr = err;
        }
      }
      if (!ok) throw lastErr;
      showPopup("success", "Stock updated successfully!");
      setForm({ code: "", name: "", batchNo: "", mrp: "", salePrice: "", qty: "", category: "" });
      setAvailableBatches([]);
      // refresh self products list
      // best: trigger global refresh for other components
      triggerRefresh();
      // also refetch local list so suggestions update
      // try to refetch products list
      const endpointsRead = buildProductEndpoints();
      try {
        const res = await tryGet(endpointsRead, { headers });
        const data = Array.isArray(res.data) ? res.data : Array.isArray(res.data?.products) ? res.data.products : res.data?.items || [];
        setProducts(Array.isArray(data) ? data : []);
      } catch (err) {
        // ignore
      }
    } catch (err) {
      console.error("AddStock error:", err);
      showPopup("error", "Failed to update stock.");
    }
  };

  const showPopup = (type, message) => {
    setPopup({ show: true, type, message });
    setTimeout(() => setPopup({ show: false, type: "", message: "" }), 3000);
  };

  return (
    <div className="stock-container p-8 pt-10 sm:pt-10">
      <h2 className="card-title">Add Stock</h2>
      <div className="card">


        <form className="form-grid" onSubmit={addStock}>
          {/* Product Code */}
          <div className="form-row relative">
            <label>Product Code</label>
            <input
              type="text"
              placeholder="Enter product code"
              value={form.code}
              onChange={(e) => onCodeChange(e.target.value)}
              onFocus={() => form.code && setShowCodeList(true)}
              onBlur={() => setTimeout(() => setShowCodeList(false), 150)}
              className="input"
            />
            {showCodeList && codeSuggestions.length > 0 && (
              <div className="dropdown animate-slide">
                {Array.from(
                  new Map(codeSuggestions.map((p) => [p.code, p])).values()
                ).map((p, i) => (
                  <div
                    key={i}
                    className="dropdown-item"
                    onMouseDown={() => onCodeSelect(p)}
                  >
                    {p.code} - {p.name}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Product Name */}
          <div className="form-row relative">
            <label>Product Name</label>
            <input
              type="text"
              placeholder="Enter product name"
              value={form.name}
              onChange={(e) => onNameChange(e.target.value)}
              onFocus={() => form.name && setShowNameList(true)}
              onBlur={() => setTimeout(() => setShowNameList(false), 150)}
              className="input"
            />
            {showNameList && nameSuggestions.length > 0 && (
              <div className="dropdown animate-slide">
                {Array.from(
                  new Map(nameSuggestions.map((p) => [p.code, p])).values()
                ).map((p, i) => (
                  <div
                    key={i}
                    className="dropdown-item"
                    onMouseDown={() => onNameSelect(p)}
                  >
                    {p.name} - {p.code}
                  </div>
                ))}
              </div>
            )}
          </div>


          {/* Batch No */}
          <div className="form-row relative">
            <label>Batch No</label>
            <input
              type="text"
              placeholder="Select batch"
              value={form.batchNo}
              onChange={(e) => setForm({ ...form, batchNo: e.target.value })}
              onFocus={() => setShowBatchList(true)}
              onBlur={() => setTimeout(() => setShowBatchList(false), 150)}
              className="input"
            />
            {showBatchList && availableBatches.length > 0 && (
              <div className="batch-suggestions animate-slide">
                <table className="batch-table">
                  <thead>
                    <tr>
                      <th>Batch No</th>
                      <th>MRP</th>
                      <th>Rate</th>
                      <th>Qty</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableBatches.map((b) => (
                      <tr key={b._id || b.batchNo} onMouseDown={() => onBatchSelect(b)} className="batch-row">
                        <td>{b.batchNo}</td>
                        <td>{Number(b.mrp || 0).toFixed(2)}</td>
                        <td>{Number(b.salePrice || 0).toFixed(2)}</td>
                        <td>{b.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="form-row">
            <label>Quantity</label>
            <input type="number" placeholder="Enter quantity" value={form.qty} onChange={(e) => setForm({ ...form, qty: e.target.value })} className="input" />
          </div>

          <button className="btn small primary">Add Stock</button>
        </form>
      </div>

      {/* Popup */}
      {popup.show && <div className={`popup ${popup.type}`}>{popup.message}</div>}
    </div>
  );
}
