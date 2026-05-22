
// src/pages/Stock/AddStock.jsx
import { useState, useEffect, useContext, useCallback, useRef } from "react";
import axios from "axios";
import "../../styles/AddStock.css";
import { useAuth } from "../../context/AuthContext";
import { ShopContext } from "../../context/ShopContext";

const API = import.meta.env.VITE_API_URL || "http://localhost:5000";

export default function AddStock() {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);
  const shopname = selectedShop?.name || user?.shopname;
  const token = localStorage.getItem("token");

  const getApiUrl = useCallback(() => {
    if (selectedShop?._id) {
      return `${API}/api/shops/${selectedShop._id}/products`;
    }
    return `${API}/api/products`;
  }, [selectedShop]);

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
  const [loading, setLoading] = useState(true);

  // mode: "product" or "random" (used to decide rendering/selection behavior)
  const codeModeRef = useRef("product");

  // ✅ Always fetch ALL products (no pagination limit)
  const fetchProducts = useCallback(async () => {
    if (!shopname || !token) return;

    const API_URL = getApiUrl();
    if (!API_URL) return;

    setLoading(true);
    try {
      // 🔹 Always request all products using ?limit=0
      const { data } = await axios.get(`${API_URL}?limit=0`, {
        headers: {
          Authorization: `Bearer ${token}`,
          "x-shopname": shopname,
        },
      });

      // Normalize product data safely
      const list = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];

      setProducts(list);
      console.log(`✅ Loaded ${list.length} products`);
    } catch (err) {
      console.error("❌ Failed to fetch all products:", err);
      setProducts([]);
    } finally {
      setLoading(false);
    }
  }, [shopname, token, getApiUrl]);

  // Fetch products when shop changes
  useEffect(() => {
    fetchProducts();
  }, [fetchProducts]);

  const getMatchingProducts = (key, value) =>
    products.filter((p) => p[key]?.toLowerCase().includes(value.toLowerCase()));

  // --- network helpers ---

  // Search general products by text (product-code mode uses this)
  const fetchSuggestionsByText = async (text) => {
    if (!text || !getApiUrl() || !token) return [];
    try {
      const url = `${getApiUrl()}?limit=0&search=${encodeURIComponent(text)}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, "x-shopname": shopname },
      });
      const list = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
      return list;
    } catch (err) {
      console.error("fetchSuggestionsByText error:", err);
      return [];
    }
  };


  const fetchByRandomCodeApi = async (code) => {
    if (!code || !token) return [];
    try {
      const clean = (code || "").toString().replace(/\D/g, "").trim();
      if (!clean) return [];
      const url = `${API}/api/products/search-by-code?code=${encodeURIComponent(clean)}`;
      const { data } = await axios.get(url, {
        headers: { Authorization: `Bearer ${token}`, "x-shopname": shopname },
      });
      const list = Array.isArray(data?.products) ? data.products : Array.isArray(data) ? data : [];
      return list;
    } catch (err) {
      console.error("fetchByRandomCodeApi error:", err);
      return [];
    }
  };


  const onCodeChange = (val) => {
    setForm((f) => ({ ...f, code: val }));
    const trimmedVal = val.trim();
    const lower = trimmedVal.toLowerCase();

    if (!trimmedVal) {
      setShowCodeList(false);
      setForm((f) => ({
        ...f,
        name: "",
        batchNo: "",
        mrp: "",
        salePrice: "",
        qty: "",
        category: "",
      }));
      setAvailableBatches([]);
      setShowBatchList(false);
      setCodeSuggestions([]);
      codeModeRef.current = "product";
      return;
    }

    // Decide mode immediately: digits-only -> random mode, otherwise product mode
    const isDigitsOnly = /^\d+$/.test(trimmedVal);

    if (isDigitsOnly) {
      // RANDOM CODE MODE
      codeModeRef.current = "random";

      // Call API for random-code results (immediately after first digit as requested)
      (async () => {
        const productsMatched = await fetchByRandomCodeApi(trimmedVal);
        // flatten to batch-level suggestions: one entry per matching batch
        // Each entry: { product, batch }
        const flattened = [];
        for (const p of productsMatched) {
          if (!p.batches) continue;
          for (const b of p.batches) {
            // if batch has randomCode/ean/barcode and it contains typed digits -> include
            const rc = (b.randomCode || "").toString().toLowerCase();
            const ean = (b.ean || "").toString().toLowerCase();
            const barcode = (b.barcode || "").toString().toLowerCase();
            // include if any of these includes the typed value
            if (
              rc.includes(lower) ||
              ean.includes(lower) ||
              barcode.includes(lower)
            ) {
              flattened.push({ product: p, batch: b });
            }
          }
        }

        setCodeSuggestions(flattened);
        setShowCodeList(flattened.length > 0);
        setAvailableBatches([]); // wait until selection to show batch table
        setShowBatchList(false);

        // If there's an exact random-code match on any batch, auto-select that first match
        // (auto-fill product + batch)
        for (const entry of flattened) {
          const rc = (entry.batch.randomCode || "").toString().toLowerCase();
          const ean = (entry.batch.ean || "").toString().toLowerCase();
          const barcode = (entry.batch.barcode || "").toString().toLowerCase();
          if (rc === lower || ean === lower || barcode === lower) {
            // exact match -> autofill and stop
            const p = entry.product;
            const b = entry.batch;
            setForm((f) => ({
              ...f,
              code: p.code,
              name: p.name,
              category: p.category,
              batchNo: b.batchNo,
              mrp: b.mrp,
              salePrice: b.salePrice,
              qty: "",
            }));
            setAvailableBatches(p.batches || []);
            setShowBatchList(true);
            setShowCodeList(false);
            return;
          }
        }
      })();
    } else {
      // PRODUCT CODE MODE
      codeModeRef.current = "product";

      (async () => {
        const list = await fetchSuggestionsByText(trimmedVal);

        // For product-code-mode we only show product objects (no batch flattening)
        setCodeSuggestions(Array.isArray(list) ? list : []);
        setShowCodeList(Array.isArray(list) ? list.length > 0 : false);

        // If exact product.code match -> auto-select and show batches
        const exactProd = (Array.isArray(list) ? list : []).find(
          (p) => (p.code || "").toLowerCase() === lower
        );
        if (exactProd) {
          setForm((f) => ({
            ...f,
            code: exactProd.code,
            name: exactProd.name,
            category: exactProd.category,
            batchNo: "",
            mrp: "",
            salePrice: "",
            qty: "",
          }));
          setAvailableBatches(exactProd.batches || []);
          setShowBatchList(true);
          setShowCodeList(false);
          return;
        }

        // else keep suggestions open
        setAvailableBatches([]);
        setShowBatchList(false);
      })();
    }
  };

  const onCodeSelect = (item) => {
    if (!item) return;

    if (codeModeRef.current === "random") {
      // item is { product, batch }
      const p = item.product;
      const b = item.batch;
      setForm((f) => ({
        ...f,
        code: p.code,
        name: p.name,
        category: p.category,
        batchNo: b.batchNo,
        mrp: b.mrp,
        salePrice: b.salePrice,
        qty: "",
      }));
      setAvailableBatches(p.batches || []);
      setShowBatchList(true);
      setShowCodeList(false);
      // switch back to product mode after selecting so further typing behaves like product-mode
      codeModeRef.current = "product";
    } else {
      // product mode: item is product
      const p = item;
      setForm((f) => ({
        ...f,
        code: p.code,
        name: p.name,
        category: p.category,
        batchNo: "",
        mrp: "",
        salePrice: "",
        qty: "",
      }));
      setAvailableBatches(p.batches || []);
      setShowBatchList(true);
      setShowCodeList(false);
    }
  };

  const onNameChange = (val) => {
    setForm((f) => ({ ...f, name: val }));

    if (!val.trim()) {
      setShowNameList(false);
      setForm((f) => ({
        ...f,
        code: "",
        batchNo: "",
        mrp: "",
        salePrice: "",
        qty: "",
        category: "",
      }));
      setAvailableBatches([]);
      return;
    }

    // Use network-backed suggestions for names
    (async () => {
      const list = await fetchSuggestionsByText(val);
      setNameSuggestions(list);
      setShowNameList(list.length > 0);

      const exact = list.find((p) => p.name?.toLowerCase() === val.toLowerCase());
      if (exact) {
        setForm((f) => ({ ...f, code: exact.code, name: exact.name, category: exact.category }));
        setAvailableBatches(exact.batches || []);
        setShowBatchList(true);
      }
    })();
  };

  const onNameSelect = (prod) => {
    setForm((f) => ({
      ...f,
      code: prod.code,
      name: prod.name,
      category: prod.category,
      batchNo: "",
      mrp: "",
      salePrice: "",
      qty: "",
    }));
    setAvailableBatches(prod.batches || []);
    setShowBatchList(true);
    setShowNameList(false);
    // ensure codeMode is product for further typing
    codeModeRef.current = "product";
  };

  // Batch select handler
  const onBatchSelect = (batch) => {
    setForm((f) => ({
      ...f,
      batchNo: batch.batchNo,
      mrp: batch.mrp,
      salePrice: batch.salePrice,
      qty: "",
    }));
    setShowBatchList(false);
  };

  // Add stock
  const addStock = async (e) => {
    e.preventDefault();
    if (!form.code || !form.name || !form.batchNo || !form.qty) {
      return showPopup("error", "Please fill all required fields!");
    }

    try {
      await axios.put(
        `${getApiUrl()}/increment-stock`,
        {
          code: form.code,
          batchNo: form.batchNo,
          qty: Number(form.qty),
          mrp: Number(form.mrp),
          salePrice: Number(form.salePrice),
          name: form.name,
          category: form.category,
        },
        {
          headers: {
            Authorization: `Bearer ${token}`,
            "x-shopname": shopname,
          },
        }
      );

      showPopup("success", "Stock updated successfully!");
      setForm({
        code: "",
        name: "",
        batchNo: "",
        mrp: "",
        salePrice: "",
        qty: "",
        category: "",
      });
      setAvailableBatches([]);
      fetchProducts(); // refresh list
      // ensure code mode resets to product
      codeModeRef.current = "product";
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
                {codeModeRef.current === "random" ? (
                  // Render flattened random-code suggestions (each item: { product, batch })
                  codeSuggestions.map((entry, i) => {
                    const p = entry.product;
                    const b = entry.batch;
                    const rc = b.randomCode || b.ean || b.barcode || "";
                    return (
                      <div
                        key={i}
                        className="dropdown-item"
                        onMouseDown={() => onCodeSelect(entry)}
                      >
                        <div style={{ fontWeight: 600 }}>
                          {rc} → {p.name}
                        </div>
                        {/* <div style={{ fontSize: 12, color: "#777" }}>
                          {p.code} • Batch: {b.batchNo} • MRP: {Number(b.mrp).toFixed(2)}
                        </div> */}
                      </div>
                    );
                  })
                ) : (
                  // Render product-code suggestions (product objects)
                  codeSuggestions.map((p, i) => {
                    const randoms = (p.batches || [])
                      .filter((b) => b.randomCode)
                      .map((b) => b.randomCode)
                      .join(", ");
                    return (
                      <div
                        key={i}
                        className="dropdown-item"
                        onMouseDown={() => onCodeSelect(p)}
                      >
                        <div style={{ fontWeight: 600 }}>{p.code} - {p.name}</div>
                        {/* {randoms && (
                          <div style={{ fontSize: 12, color: "#777" }}>
                            {randoms}
                          </div>
                        )} */}
                      </div>
                    );
                  })
                )}
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
                      <tr
                        key={b._id || b.batchNo}
                        onMouseDown={() => onBatchSelect(b)}
                        className="batch-row"
                      >
                        <td>{b.batchNo}</td>
                        <td>{Number(b.mrp).toFixed(2)}</td>
                        <td>{Number(b.salePrice).toFixed(2)}</td>
                        <td>{b.qty}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Quantity */}
          <div className="form-row relative ">
            <label>Quantity</label>
            <input
              type="number"
              placeholder="Enter quantity"
              value={form.qty}
              onChange={(e) => setForm({ ...form, qty: e.target.value })}
              className="input"
            />
          </div>

          <button className="btn small primary">Add Stock</button>
        </form>
      </div>

      {/* Popup */}
      {popup.show && (
        <div className={`popup ${popup.type}`}>{popup.message}</div>
      )}
    </div>
  );
}



