
// src/pages/Stock/MasterProducts.jsx
import React from "react";
import { useMemo, useState, useEffect, useRef, useContext } from "react";
import { FaPlus, FaEye, FaTimes, FaChevronDown, FaTrash, FaEdit, FaBarcode, FaBan, FaCheckCircle } from "react-icons/fa";
import "../../../../styles/products.css";
import { useAuth } from "../../../../context/AuthContext";
import { ShopContext } from "../../../../context/ShopContext";
import apiClient from "../../../../utils/apiClient";
import { getApiUrl } from "../../../../utils/api";
import Pagination from "../../../../components/Pagination";

export default function MasterProducts() {
  const { user } = useAuth();
  const { selectedShop } = useContext(ShopContext);

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [nextCode, setNextCode] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryTemp, setCategoryTemp] = useState([]);

  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [availableBatches, setAvailableBatches] = useState([]);
  const [showBatchList, setShowBatchList] = useState(true);


  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);


  const [editBatch, setEditBatch] = useState(null);

  const [batchEditState, setBatchEditState] = React.useState({});


  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 100;





  const [selectedBarcode, setSelectedBarcode] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [taxFilter, setTaxFilter] = useState("all");


  // helper to open barcode modal


  const openBarcodeModal = (barcode, code, batchNo, name, salePrice, randomCode) => {
    setSelectedBarcode({
      barcode,
      code,
      batchNo,
      name,
      salePrice,
      randomCode,
    });
  };



  // helper to close
  const closeBarcodeModal = () => setSelectedBarcode(null);

  const [form, setForm] = useState({
    code: "",
    shortName: "",
    batchNo: "",
    salePrice: "",
    name: "",
    category: "",
    price: "",
    taxPercent: "",
    taxMode: "exclusive",
    qty: "",
    mrp: "",
    minQty: "",
  });

  const wheelPreventerRef = useRef(null);

  // -------------------------------
  // Toast helper
  // -------------------------------
  const pushToast = (msg) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, msg }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  };

  // -------------------------------
  // API path helper
  // -------------------------------
  // Keep API path consistent with tenant/master usage
  const getApiPath = (endpoint) => {
    const ep = endpoint.replace(/^\//, "");
    // tenant users: direct tenant endpoints
    if (user?.role === "tenant") return getApiUrl(`tenant/${ep}`);
    // manager / megaadmin: use selectedShop.shopname when available
    if ((user?.role === "manager" || user?.role === "megaadmin") && selectedShop) {
      const shopname = encodeURIComponent(selectedShop.shopname || selectedShop);
      return getApiUrl(`tenant/shops/${shopname}/${ep}`);
    }
    // fallback to tenant
    return getApiUrl(`tenant/${ep}`);
  };

  // -------------------------------
  // Fetch products & categories
  // -------------------------------

  const fetchProducts = async (page = 1, searchText = "", status = "all", taxMode = "all") => {
    if (!user) return;

    if ((user.role === "manager" || user.role === "megaadmin") && !selectedShop?.shopname) {
      console.warn("⚠️ No shop selected. Skipping product fetch.");
      setProducts([]);
      setTotalPages(1);
      return;
    }

    try {
      const token =
        localStorage.getItem("tenantToken") ||
        localStorage.getItem("masterToken") ||
        localStorage.getItem("token");

      const baseUrl =
        user.role === "tenant"
          ? getApiUrl("tenant/products")
          : getApiUrl(`tenant/shops/${encodeURIComponent(selectedShop.shopname)}/products`);

      const isSearching = !!searchText.trim();
      const queryParams = new URLSearchParams({
        page: isSearching ? 1 : page,
        limit,
        status,
        taxMode,
      });
      if (isSearching) queryParams.append("search", searchText.trim());

      const endpoint = `${baseUrl}?${queryParams.toString()}`;

      const res = await apiClient.get(endpoint, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
        },
      });

      const data = res.data || {};
      const fetchedProducts = Array.isArray(data.products) ? data.products : [];

      // ✅ Update UI state
      setProducts(fetchedProducts);
      setTotalPages(data.totalPages || 1);
      // setPage(data.page || 1);
    } catch (err) {
      console.error("fetchProducts error:", err);
      pushToast(
        `Failed to fetch products${selectedShop?.shopname ? ` for ${selectedShop.shopname}` : ""}`
      );
      setProducts([]);
      setTotalPages(1);
    }
  };


  // useEffect(() => {
  //   const timeout = setTimeout(() => {
  //     fetchProducts(1, search, statusFilter, taxFilter);
  //   }, 50); // debounce to avoid spamming API
  //   return () => clearTimeout(timeout);
  // }, [search, statusFilter, taxFilter]);

  // useEffect(() => {
  //   if (!search.trim()) fetchProducts(page, search, statusFilter, taxFilter); // pagination only when not searching
  // }, [page, selectedShop, user, statusFilter, taxFilter]);


  useEffect(() => {
    if (!user) return;

    fetchProducts(page, search, statusFilter, taxFilter);

  }, [page, search, statusFilter, taxFilter, selectedShop, user]);

  //   useEffect(() => {
  //   fetchProducts(page, search, statusFilter, taxFilter);
  // }, [page, selectedShop, user, statusFilter, taxFilter]);



  const fetchCategories = async () => {
    if (!user) return;
    if ((user.role === "manager" || user.role === "megaadmin") && !selectedShop?.shopname) {
      setCategories([]);
      return;
    }

    try {
      const token = localStorage.getItem("tenantToken") || localStorage.getItem("masterToken") || localStorage.getItem("token");
      const endpoint =
        user.role === "tenant"
          ? getApiUrl("tenant/categories")
          : getApiUrl(`tenant/shops/${encodeURIComponent(selectedShop.shopname)}/categories`);

      const res = await apiClient.get(endpoint, {
        headers: {
          Authorization: token ? `Bearer ${token}` : undefined,
          ...(selectedShop?.shopname ? { "x-shopname": selectedShop.shopname } : {}),
        },
      });

      const data = Array.isArray(res.data?.categories) ? res.data.categories : res.data || [];
      setCategories(data);
    } catch (err) {
      console.error("fetchCategories error:", err);
      pushToast("Failed to fetch categories");
      setCategories([]);
    }
  };

  useEffect(() => {
    fetchProducts();
    fetchCategories();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user, selectedShop]);


  const uniqueProducts = useMemo(() => {
    const map = new Map();

    for (const product of products || []) {
      const code = product.code || "";
      const name = product.name || "";
      const key = `${code}||${name}`;
      const category = product.category || "";

      const status = product.status || "active";   // ⭐ Add status
      //  const tax = product.taxMode || "exclusive";  

      // ⭐ CORRECT — TAKE TAX FIELDS FROM PRODUCT
      const taxPercent = Number(product.taxPercent || 0);
      const taxMode = product.taxMode || "exclusive";


      // Total qty from all batches
      const batches = Array.isArray(product.batches) ? product.batches : [];
      const totalQty = batches.reduce((sum, b) => sum + Number(b.qty || 0), 0);

      // product minQty
      const minQty = Number(product.minQty ?? 0);

      if (!map.has(key)) {
        map.set(key, {
          code,
          name,
          category,
          totalQty,
          minQty,
          batches,
          status,
          // ⭐ FIXED TAX FIELDS
          taxPercent,
          taxMode            // ⭐ ADD TO DATA
        });
      } else {
        const entry = map.get(key);
        entry.totalQty += totalQty;
        entry.minQty = Math.min(entry.minQty, minQty);
        entry.batches = [...entry.batches, ...batches];

        // ⭐ Keep original status (active always wins over disabled)
        if (entry.status !== "active" && status === "active") {
          entry.status = "active";
        }
      }
    }

    // ⭐ SORT: active first, disabled last
    return Array.from(map.values()).sort((a, b) => {
      if (a.status === b.status) return 0;
      if (a.status === "active") return -1;
      return 1; // disabled goes bottom
    });

  }, [products]);


  // -------------------------------
  // Filtered products (search operates on unique rows)
  // -------------------------------
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return uniqueProducts;
    return uniqueProducts.filter((p) =>
      [p.code, p.name, p.category].some((v) => String(v || "").toLowerCase().includes(s))
    );
  }, [search, uniqueProducts]);

  // -------------------------------
  // Helper: get batches for product (by code+name)
  // -------------------------------
  const getBatches = (prod) =>
    products.filter((p) => p.code === prod.code && p.name === prod.name);

  // -------------------------------
  // Apply decrements helper (used for local optimistic updates)
  // -------------------------------
  const applyDecrementsToProducts = (prevProducts, decrements) => {
    const copy = prevProducts.map((p) => ({ ...p }));
    for (const d of decrements) {
      const code = (d.code || "").toLowerCase();
      const batchNo = (d.batchNo || "").toLowerCase();
      let remaining = Number(d.qty || 0);
      for (let i = 0; i < copy.length && remaining > 0; i++) {
        const p = copy[i];
        if ((p.code || "").toLowerCase() === code && (p.batchNo || "").toLowerCase() === batchNo) {
          const available = Number(p.qty || 0);
          if (available <= 0) continue;
          const take = Math.min(available, remaining);
          p.qty = Math.max(0, available - take);
          remaining -= take;
        }
      }
    }
    return copy;
  };

  const decrementStockOnServer = async (items) => {
    if (!Array.isArray(items) || items.length === 0) return;
    try {
      await apiClient.put(getApiPath("products/decrement-stock"), { items });
      setProducts((prev) => applyDecrementsToProducts(prev, items));
      await fetchProducts();
      pushToast("Stock updated");
    } catch (err) {
      console.error("decrementStockOnServer:", err);
      pushToast("Failed to update stock on server");
    }
  };

  // -------------------------------
  // Get next code helper (robust)
  // -------------------------------


  const getNextCode = async () => {
    try {
      const res = await apiClient.get(getApiPath("products/next-code"));
      if (res?.data) {
        if (typeof res.data === "string") return { nextCode: res.data };
        if (res.data.nextCode) return { nextCode: res.data.nextCode };
        if (res.nextCode) return { nextCode: res.nextCode };
      }
      return { nextCode: "" }; // fallback
    } catch (err) {
      if (err.response?.status === 404) {
        console.warn("Next code API not found. Falling back to empty code.");
        return { nextCode: "" };
      }
      console.error("getNextCode error:", err);
      return { nextCode: "" };
    }
  };

  // -------------------------------
  // Create product (modal)
  // -------------------------------
  const resetForm = (code = "") => {
    setForm({
      code,
      shortName: "",
      batchNo: "",
      salePrice: "",
      name: "",
      category: "",
      price: "",
      taxPercent: "",
      taxMode: "exclusive",
      qty: "",
      mrp: "",
      minQty: "",
    });
    setAvailableBatches([]);
    setShowBatchList(true);
  };

  const openCreate = async () => {
    const data = await getNextCode();
    resetForm(data?.nextCode || "");
    setNextCode(data?.nextCode || "");
    setShowCreateModal(true);
  };
  const closeCreate = () => setShowCreateModal(false);
  // const openView = (prod) => setShowViewModal(prod);

  const openView = async (prod) => {
    try {
      const token =
        localStorage.getItem("tenantToken") ||
        localStorage.getItem("masterToken") ||
        localStorage.getItem("token");

      if (!prod?.code) return;

      const endpoint = getApiPath(`products/code/${encodeURIComponent(prod.code)}`);
      const res = await apiClient.get(endpoint, {
        headers: { Authorization: token ? `Bearer ${token}` : undefined },
      });

      setShowViewModal(res.data || prod);
    } catch (err) {
      console.error("Failed to fetch product details:", err);
      setShowViewModal(prod);
      pushToast("Product details not found.");
    }
  };




  const closeView = () => setShowViewModal(null);

  // -------------------------------
  // Product name suggestions
  // -------------------------------
  const onNameChange = async (val) => {
    setForm((f) => ({ ...f, name: val, batchNo: "" }));
    setAvailableBatches([]);
    setShowBatchList(true);

    if (!val.trim()) {
      const data = await getNextCode();
      resetForm(data?.nextCode || "");
      setNextCode(data?.nextCode || "");
      setShowSuggestions(false);
      return;
    }

    const matches = products.filter((p) => p.name?.toLowerCase().includes(val.toLowerCase()));
    setNameSuggestions(matches);
    setShowSuggestions(true);

    const exact = products.find((p) => p.name?.toLowerCase() === val.toLowerCase());
    if (exact) {
      const batches = getBatches(exact);
      setAvailableBatches(batches);
      setForm((f) => ({
        ...f,
        code: exact.code,
        shortName: exact.shortName,
        category: exact.category,
      }));
      setShowBatchList(true);
    } else {
      const data = await getNextCode();
      setForm((f) => ({ ...f, code: data?.nextCode || "" }));
      setNextCode(data?.nextCode || "");
    }
  };

  const selectSuggestion = (prod) => {
    const batches = getBatches(prod);
    setAvailableBatches(batches);
    setForm((f) => ({
      ...f,
      name: prod.name,
      code: prod.code,
      shortName: prod.shortName,
      category: prod.category,
      batchNo: "",
    }));
    setShowSuggestions(false);
    setShowBatchList(true);
  };

  const onBatchSelect = (batch) => {
    setForm((f) => ({
      ...f,
      batchNo: batch.batchNo,
      mrp: batch.mrp,
      salePrice: batch.salePrice,
      qty: batch.qty,
      taxPercent: batch.taxPercent,
      taxMode: batch.taxMode,
    }));
    setShowBatchList(true);
  };

  const onCreate = async (e) => {
    e.preventDefault();
    if (!form.name) return alert("Product name is required");
    if (!form.batchNo) return alert("Batch No is required");

    try {
      const payload = {
        ...form,
        shop: user.shop || selectedShop, // <-- add the shop
        qty: Number(form.qty || 0),
        mrp: Number(form.mrp || 0),
        salePrice: Number(form.salePrice || 0),
        taxPercent: Number(form.taxPercent || 0),
        minQty: Number(form.minQty || 0),
      };

      const { data } = await apiClient.post(getApiPath("products"), payload);
      setProducts((prev) => [data, ...prev]);
      if (data.name === form.name && data.code === form.code) {
        setAvailableBatches((prev) => [data, ...prev]);
      }
      setShowCreateModal(false);
      pushToast("Product / Batch saved");
    } catch (err) {
      console.error(err);
      alert(err.response?.data?.error || "Failed to create product");
    }
  };

  const openCategoryModal = () => {
    setCategoryTemp(categories);
    setCategoryDraft("");
    setShowCategoryModal(true);
  };
  const closeCategoryModal = () => setShowCategoryModal(false);

  const addCategoryDraft = () => {
    const name = categoryDraft.trim();
    if (!name) return;
    if (!categoryTemp.includes(name)) setCategoryTemp((x) => [...x, name]);
    setCategoryDraft("");
  };
  const removeTempCategory = (name) => setCategoryTemp((x) => x.filter((c) => c !== name));

  const saveCategories = async () => {
    if (!categoryTemp || categoryTemp.length === 0) {
      pushToast("No categories to save");
      return;
    }
    try {
      const res = await apiClient.put(getApiPath("categories"), { categories: categoryTemp });
      // server may return updated categories in different shapes
      const data = Array.isArray(res.data) ? res.data : res.data?.categories || [];
      setCategories(Array.isArray(data) ? data : []);
      if (form.category && !data.includes(form.category)) setForm((f) => ({ ...f, category: "" }));
      setShowCategoryModal(false);
      pushToast("Categories saved");
    } catch (err) {
      console.error("Failed to save categories:", err);
      pushToast("Failed to save categories");
    }
  };



  // -------------------------------
  // Wheel prevention
  // -------------------------------
  const wheelHandler = (e) => {
    if (
      document.activeElement &&
      (document.activeElement.type === "number" ||
        document.activeElement.inputMode === "decimal")
    )
      e.preventDefault();
  };
  const enableWheelBlock = () => {
    if (!wheelPreventerRef.current) {
      wheelPreventerRef.current = wheelHandler;
      window.addEventListener("wheel", wheelPreventerRef.current, { passive: false, capture: true });
    }
  };
  const disableWheelBlock = () => {
    if (wheelPreventerRef.current) {
      window.removeEventListener("wheel", wheelPreventerRef.current, { capture: true });
      wheelPreventerRef.current = null;
    }
  };

  // -------------------------------
  // Listen for product refresh event
  // -------------------------------
  useEffect(() => {
    const handler = async (e) => {
      const items = e?.detail?.items;
      if (Array.isArray(items) && items.length > 0) {
        setProducts((prev) => applyDecrementsToProducts(prev, items));
      }
      await fetchProducts();
      pushToast("Products refreshed");
    };
    window.addEventListener("products:refresh", handler);
    return () => window.removeEventListener("products:refresh", handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);


  // Handle typing in Product Code
  const onCodeChange = (val) => {
    setForm((f) => ({ ...f, code: val }));
    setShowCodeSuggestions(true);

    if (!val.trim()) {
      // Reset auto-fill if code is erased
      resetForm();
      setShowCodeSuggestions(false);
      return;
    }

    const matches = products.filter((p) =>
      p.code.toLowerCase().includes(val.toLowerCase())
    );
    setShowCodeSuggestions(matches.length > 0);

    const exact = products.find((p) => p.code.toLowerCase() === val.toLowerCase());
    if (exact) {
      const batches = getBatches(exact);
      setAvailableBatches(batches);
      setForm((f) => ({
        ...f,
        name: exact.name,
        shortName: exact.shortName,
        category: exact.category,
        batchNo: "",
      }));
      setShowBatchList(true);
    }
  };

  // Handle selecting a code suggestion
  const selectCodeSuggestion = (prod) => {
    const batches = getBatches(prod);
    setAvailableBatches(batches);
    setForm((f) => ({
      ...f,
      code: prod.code,
      name: prod.name,
      shortName: prod.shortName,
      category: prod.category,
      batchNo: "",
    }));
    setShowCodeSuggestions(false);
    setShowBatchList(true);
  };


  const uniqueCodeSuggestions = useMemo(() => {
    const seen = new Set();
    return products
      .filter((p) => {
        if (seen.has(p.code)) return false;
        seen.add(p.code);
        return true;
      })
      .filter((p) =>
        form.code ? p.code.toLowerCase().includes(form.code.toLowerCase()) : true
      )
      .slice(0, 5); // top 5 suggestions
  }, [products, form.code]);



  const renderProducts = () => {
    return Array.isArray(products) &&
      products.map((p) => (
        <div key={p.code}>
          {Array.isArray(p.batches) &&
            p.batches.map((b) => (
              <div key={b.batchNo}>{b.minQty}</div>
            ))}
        </div>
      ));
  };


  const handleSaveMinQty = async ({ code, batchNo, minQty }) => {
    if (!code || !batchNo) {
      pushToast("Missing code or batch number");
      return;
    }

    try {
      const payload = { code, batchNo, minQty: Number(minQty || 0) };

      // ✅ Corrected API call (patch to /products/min-qty)
      const res = await apiClient.patch(getApiPath("products/min-qty"), payload);
      const updated = res.data;

      // ✅ Update local product list (real-time UI update)
      setProducts((prev) =>
        prev.map((p) =>
          p.code === updated.code && p.batchNo === updated.batchNo
            ? { ...p, minQty: updated.minQty }
            : p
        )
      );

      pushToast(`Min Qty updated for batch ${batchNo}`);
    } catch (err) {
      console.error("handleSaveMinQty error:", err);
      pushToast(err.response?.data?.message || "Failed to update Min Qty");
    }
  };



  const BatchRow = ({ batch, idx, minQty, resultingStock, handleSaveMinQty }) => {
    const [editingMinQty, setEditingMinQty] = React.useState(false);
    const [newMinQty, setNewMinQty] = React.useState(minQty);

    // Reset local state if minQty changes externally
    React.useEffect(() => {
      setNewMinQty(minQty);
    }, [minQty]);

    return (
      <tr>
        <td>{idx + 1}</td>
        <td>{batch.batchNo}</td>
        <td className={resultingStock <= minQty ? "danger" : ""}>
          {resultingStock}
        </td>
        <td>
          {editingMinQty ? (
            <input
              type="number"
              value={newMinQty}
              min={0}
              onChange={(e) => setNewMinQty(Number(e.target.value))}
              style={{ width: "60px" }}
            />
          ) : (
            minQty || "-"
          )}
        </td>
        <td>{Number(batch.mrp || 0).toFixed(2)}</td>
        <td>{Number(batch.salePrice || batch.rate || 0).toFixed(2)}</td>
        <td>{batch.taxPercent || 0}%</td>
        <td>{batch.taxMode || "-"}</td>
        <td>
          {editingMinQty ? (
            <>
              <button
                className="btn btn-success btn-small"
                onClick={async () => {
                  await handleSaveMinQty({
                    code: batch.code,
                    batchNo: batch.batchNo,
                    minQty: newMinQty,
                  });
                  setEditingMinQty(false);
                }}
              >
                Save
              </button>
              <button
                className="btn btn-muted btn-small"
                onClick={() => {
                  setNewMinQty(minQty);
                  setEditingMinQty(false);
                }}
              >
                Cancel
              </button>
            </>
          ) : (
            <button
              className="btn btn-primary btn-small"
              onClick={() => setEditingMinQty(true)}
            >
              Edit
            </button>
          )}
        </td>
      </tr>
    );
  };




  return (
    <div className="products-page p-8 pt-10 sm:pt-10">
      {/* Toasts */}
      <div className="toasts">
        {toasts.map((t) => (
          <div key={t.id} className="toast">
            {t.msg}
          </div>
        ))}
      </div>

      {/* Header */}
      <div className="products-header">
        <h1 className="title">Products</h1>
        {/* <button className="btn btn-primary" onClick={openCreate}>
          <FaPlus /> Create Product
        </button> */}
      </div>

      {/* Toolbar */}


      <div className="products-toolbar flex items-center gap-2">

        {/* Search Input */}
        <input
          className="!w-[350px] !md:w-[350px] h-8 text-sm border border-gray-300 rounded-md px-2 
               focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867]
               placeholder-gray-400 transition"
          type="text"
          placeholder="Search by Product Code / Name / Category"
          value={search}
          // onChange={(e) => {
          //   const val = e.target.value;
          //   setSearch(val);
          //   fetchProducts(1, val, statusFilter, taxFilter);
          // }}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
        />

        {/* Status Filter */}
        <select
          value={statusFilter}
          onChange={(e) => {
            setStatusFilter(e.target.value);
            fetchProducts(1, search, e.target.value, taxFilter);
          }}
          className="w-[140px] h-8 text-sm border border-gray-300 rounded-md px-2 
               focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867]
               transition"
        >
          <option value="all">All</option>
          <option value="active">Active</option>
          <option value="disabled">Disabled</option>
        </select>

        {/* Tax Filter */}
        <select
          value={taxFilter}
          onChange={(e) => {
            setTaxFilter(e.target.value);
            fetchProducts(1, search, statusFilter, e.target.value);
          }}
          className="w-[140px] h-8 text-sm border border-gray-300 rounded-md px-2 
             focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867]
             transition"
        >
          <option value="all">Tax: All</option>
          <option value="inclusive">Inclusive</option>
          <option value="exclusive">Exclusive</option>
        </select>

      </div>

      {/* Table */}
      <div className="card table-card w-full" style={{ overflow: "hidden" }}>
        <div className="table-responsive w-full" style={{ overflowX: "hidden" }}>
          <table
            className="table clean"
            style={{
              width: "100%",
              borderCollapse: "collapse",
              tableLayout: "fixed",
              wordBreak: "break-word",
              whiteSpace: "normal",
            }}
          >
            <thead>
              <tr
                style={{
                  backgroundColor: "#007867",
                  color: "#fff",
                  textAlign: "left",
                }}
              >
                {/* <th style={{ padding: "0.75rem" }}>S.No</th>
                <th style={{ padding: "0.75rem" }}>Product Code</th>
                <th style={{ padding: "0.75rem" }}>Product Name</th>
                <th style={{ padding: "0.75rem" }}>Category</th>
                <th style={{ padding: "0.75rem" }}>Qty</th>
                <th style={{ padding: "0.75rem" }}>Min Qty</th> */}

                <th style={{ padding: "0.75rem", width: "70px" }}>S.No</th>
                <th style={{ padding: "0.75rem", width: "90px" }}>Product Code</th>
                <th style={{ padding: "0.75rem", width: "280px" }}>Product Name</th>
                <th style={{ padding: "0.75rem", width: "160px" }}>Category</th>
                <th style={{ padding: "0.75rem", width: "60px", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "0.75rem", width: "60px", textAlign: "center" }}>Min Qty</th>
                {/* TAX HEADER — 2-LINE HEADER WITH SPLIT COLUMNS */}
                <th style={{ padding: 0, textAlign: "center", width: "140px" }}>
                  <div style={{}}>
                    Tax
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 0.2fr 1fr",   // Middle column narrowed but centered
                      alignItems: "center",                   // Center contents vertically
                      textAlign: "center",                    // Center contents horizontally
                    }}
                  >
                    <span style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}>%</span>

                    {/* CENTERED "|" */}
                    <span
                      style={{
                        fontSize: "0.85rem",
                        padding: "0.75rem 0",
                        fontWeight: 600,
                      }}
                    >
                      |
                    </span>

                    <span style={{ padding: "0.4rem 0.75rem", fontSize: "0.85rem" }}>
                      Mode
                    </span>
                  </div>
                </th>
                <th style={{ padding: "0.75rem", width: "100px" }}>Status</th>
                <th style={{ padding: "0.75rem", width: "70px" }} className="text-center">
                  Action
                </th>
              </tr>
            </thead>

            <tbody>
              {(!filtered || filtered.length === 0) ? (
                <tr>
                  <td
                    colSpan="7"
                    style={{ textAlign: "center", padding: "1rem", color: "#777" }}
                  >
                    No products found
                  </td>
                </tr>
              ) : (

                Object.values(
                  (filtered || []).reduce((acc, product) => {
                    if (!product || !product.code) return acc;

                    const {
                      code,
                      name,
                      category,
                      batches = [],
                      minQty,
                      status,
                      taxPercent = 0,
                      taxMode = "exclusive"
                    } = product;

                    // CREATE PRODUCT ENTRY
                    if (!acc[code]) {
                      acc[code] = {
                        code,
                        name,
                        category,
                        minQty: Number(minQty) || 0,
                        status: status || "active",

                        // ⭐ CORRECT FIELDS HERE
                        taxPercent: Number(taxPercent),
                        taxMode: taxMode,

                        batches: []
                      };
                    }

                    // MERGE BATCHES
                    batches.forEach((batch) => {
                      acc[code].batches.push({
                        batchNo: batch.batchNo || "-",
                        qty: Number(batch.qty) || 0,
                        mrp: Number(batch.mrp) || 0,
                        salePrice: Number(batch.salePrice) || 0,

                        // ⭐ batch-level tax fallback to product-level
                        taxPercent: Number(taxPercent),
                        taxMode: taxMode,

                        status: batch.status || acc[code].status
                      });
                    });

                    return acc;
                  }, {})
                ).

                  map((p, idx) => {
                    const totalQty = (p.batches || []).reduce(
                      (sum, b) => sum + (Number(b.qty) || 0),
                      0
                    );

                    const minQty = Number(p.minQty || 0); // ✅ Now this works



                    return (
                      <tr
                        key={p.code || idx}
                        style={{
                          transition: "all 0.3s ease",
                          opacity: 0,
                          animation: "fadeIn 0.5s forwards",
                          cursor: "default",
                        }}
                        className="fade-in"
                      >
                        <td style={{ padding: "0.5rem" }}>
                          {(search ? 0 : (page - 1) * limit) + idx + 1}
                        </td>
                        <td style={{ padding: "0.5rem" }}>{p.code}</td>
                        <td style={{ padding: "0.5rem" }}>
                          <div
                            title={p.name}
                            style={{
                              display: "-webkit-box",
                              WebkitLineClamp: 2,
                              WebkitBoxOrient: "vertical",
                              overflow: "hidden",
                              textOverflow: "ellipsis",
                              whiteSpace: "normal",
                              wordBreak: "break-word",
                              lineHeight: "1.4",
                              maxHeight: "2.8em"
                            }}
                          >
                            {p.name}
                          </div>
                        </td>
                        <td style={{ padding: "0.5rem" }}>{p.category}</td>

                        {/* ✅ Total Qty now always displays */}
                        <td
                          style={{
                            padding: "0.5rem",
                            textAlign: "center",
                            color: totalQty <= minQty ? "#FF4C4C" : "#000",
                            fontWeight: totalQty <= minQty ? "bold" : "normal",
                          }}
                        >
                          {totalQty}
                        </td>

                        {/* ✅ Added Min Qty display */}
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>{minQty}</td>
                        {/* TAX COLUMN — SHOW % AND MODE */}
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          <span style={{ fontWeight: 600 }}>{p.taxPercent}%</span>
                          <span style={{ margin: "0 6px", color: "#888" }}>|</span>
                          <span style={{ textTransform: "capitalize" }}>{p.taxMode}</span>
                        </td>



                        {/* ⭐ UPDATED STATUS COLUMN WITH ICONS ⭐ */}
                        <td style={{ padding: "0.5rem" }}>
                          {p.status === "active" ? (
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <FaCheckCircle color="#0b7a3a" size={16} />
                              <span style={{ color: "#0b7a3a", fontWeight: 600 }}>Active</span>
                            </span>
                          ) : (
                            <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                              <FaBan color="#c53030" size={16} />
                              <span style={{ color: "#c53030", fontWeight: 600 }}>Disabled</span>
                            </span>
                          )}
                        </td>

                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          <button
                            onClick={() => openView(p)} // ✅ Pass merged product with batches
                            title="View"
                            style={{
                              border: "none",
                              backgroundColor: "#00A76F",
                              color: "#fff",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "0.5rem",
                              cursor: "pointer",
                              transition: "all 0.3s ease",
                            }}
                            onMouseEnter={(e) =>
                              (e.target.style.backgroundColor = "#007867")
                            }
                            onMouseLeave={(e) =>
                              (e.target.style.backgroundColor = "#00A76F")
                            }
                          >
                            <FaEye />
                          </button>
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        {/* ✅ Pagination */}
        {/* <Pagination page={page} totalPages={totalPages} onPageChange={fetchProducts} /> */}
        {!search && totalPages > 1 && (
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => {
              if (p === page) return;
              setPage(p);
            }}
          />
        )}

        {/* ✅ Fade-in animation + Responsive styles */}
        <style>
          {`
      @keyframes fadeIn {
        from { opacity: 0; transform: translateY(10px); }
        to { opacity: 1; transform: translateY(0); }
      }

      @media (max-width: 768px) {
        table {
          table-layout: auto;
          font-size: 0.9rem;
        }

        th, td {
          padding: 0.5rem;
          word-break: break-word;
          white-space: normal;
        }

        button {
          padding: 0.4rem 0.6rem;
        }
      }
    `}
        </style>
      </div>




   
   
         {/* 🔹 View Modal */}
         {showViewModal && (
           <Modal onClose={closeView} title="Product Details" className="wide-modal">
             {/* ✅ Top Info Section */}
             <div
               style={{
                 display: "flex",
                 justifyContent: "center",
                 width: "100%",
                 marginBottom: "1rem",
               }}
             >
               <div
                 style={{
                   display: "grid",
                   gridTemplateColumns: "repeat(2, 1fr)",
                   gap: "2rem",
                   width: "80%",
                   maxWidth: "700px",
                 }}
               >
                 {/* Left Column */}
                 <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                   {/* <div style={{ display: "flex", gap: "0.5rem" }}>
                     <p style={{ fontWeight: 600, minWidth: "120px" }}>Code:</p>
                     <p>{showViewModal.code || "-"}</p>
                   </div> */}
   
                   <div style={{ display: "flex", gap: "0.5rem", alignItems: "center" }}>
                     <p style={{ fontWeight: 600, minWidth: "120px" }}>Code:</p>
   
                     <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
                       <span>{showViewModal.code || "-"}</span>
   
                       {showViewModal.status === "disabled" ? (
                         <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                           (<FaBan size={14} /> Disabled)
                         </span>
                       ) : (         
                         <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                           (<FaCheckCircle size={14} /> Active)
                         </span>
                       )}
                     </div>
                   </div>
   
                   <div style={{ display: "flex", gap: "0.5rem" }}>
                     <p style={{ fontWeight: 600, minWidth: "120px" }}>Category:</p>
                     <p>{showViewModal.category || "-"}</p>
                   </div>
                 </div>
   
                 {/* Right Column */}
                 <div style={{ display: "flex", flexDirection: "column", gap: "0.6rem" }}>
                   <div style={{ display: "flex", gap: "0.5rem" }}>
                     <p style={{ fontWeight: 600, minWidth: "120px" }}>Name:</p>
                     <p
                       style={{
                         maxWidth: "250px",
                         wordBreak: "break-word",
                         overflowWrap: "anywhere",
                         lineHeight: "1.4"
                       }}
                     >
                       {showViewModal.name || "-"}
                     </p>
                   </div>
                   <div style={{ display: "flex", gap: "0.5rem" }}>
                     <p style={{ fontWeight: 600, minWidth: "120px" }}>Total Qty:</p>
                     <p>
                       {Array.isArray(showViewModal.batches)
                         ? showViewModal.batches.reduce(
                           (sum, b) => sum + (Number(b.qty) || 0),
                           0
                         )
                         : 0}
                     </p>
                   </div>
                 </div>
               </div>
             </div>
   
   
             {/* ✅ Batch Table Section */}
             <div
               className="batch-table-wrapper"
               style={{
                 maxHeight: "300px",
                 overflowY: "auto",
                 overflowX: "hidden",
                 border: "1px solid #eee",
                 borderRadius: "6px"
               }}
             >
               <table
                 className="table clean small"
                 style={{
                   width: "100%",
                   tableLayout: "fixed",
                   borderCollapse: "collapse"
                 }}
               >
                 <thead>
                   <tr>
                     <th style={{ width: "60px" }}>S.No</th>
                     <th style={{ width: "180px" }}>Batch No</th>
                     <th style={{ width: "80px", textAlign: "center" }}>Qty</th>
                     <th style={{ width: "90px" }}>MRP</th>
                     <th style={{ width: "90px" }}>Rate</th>
                     <th style={{ width: "120px" }}>Status</th>
                     <th style={{ width: "120px" }}>Action</th>
                   </tr>
                 </thead>
   
                 <tbody>
                   {(() => {
                     if (!showViewModal || !Array.isArray(showViewModal.batches)) return null;
   
                     // sort: active first, disabled bottom
                     const sortedBatches = [...showViewModal.batches].sort((a, b) =>
                       (a.status === "disabled") - (b.status === "disabled")
                     );
   
                     return sortedBatches.map((b, idx) => {
                       const qty = Number(b.qty || 0);
                       const minQty = Number(b.minQty || 0);
                       const status = b.status || "active";
                       const isDisabled = status === "disabled";
   
                       return (
                         <tr key={b.batchNo || idx}>
                           <td>{idx + 1}</td>
   
                           <td
                             style={{
                               wordBreak: "break-word",
                               overflowWrap: "anywhere",
                               whiteSpace: "normal",
                               lineHeight: "1.4"
                             }}
                           >
                             {b.batchNo}
                           </td>
   
                           {/* <td className={qty <= minQty ? "danger" : ""}>{qty}</td> */}
   
                           <td
                             style={{ textAlign: "center" }}
                             className={qty <= minQty ? "danger" : ""}
                           >
                             {qty}
                           </td>
   
                           <td>{Number(b.mrp || 0).toFixed(2)}</td>
   
                           <td>{Number(b.salePrice || b.rate || 0).toFixed(2)}</td>
                           {/* 
             <td>{b.taxPercent || 0}%</td>
   
             <td>
               {b.taxMode
                 ? b.taxMode.charAt(0).toUpperCase() + b.taxMode.slice(1)
                 : "-"}
             </td> */}
   
                           {/* STATUS */}
                           {/* <td>
               {isDisabled ? (
                 <span style={{ color: "#c53030", fontWeight: 600 }}>● Disabled</span>
               ) : (
                 <span style={{ color: "#0b7a3a", fontWeight: 600 }}>● Active</span>
               )}
             </td> */}
   
                           <td>
                             {status === "active" ? (
                               <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                 <FaCheckCircle color="#0b7a3a" size={16} />
                                 <span style={{ color: "#0b7a3a", fontWeight: 600 }}>Active</span>
                               </span>
                             ) : (
                               <span style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                                 <FaBan color="#c53030" size={16} />
                                 <span style={{ color: "#c53030", fontWeight: 600 }}>Disabled</span>
                               </span>
                             )}
                           </td>
   
   
                           {/* ACTIONS */}
                           <td>
                             {/* View Barcode */}
                             {b.barcode ? (
                               <button
                                 onClick={() =>
                                   openBarcodeModal(
                                     b.barcode,
                                     showViewModal.code,
                                     b.batchNo,
                                     b.name || showViewModal.name,
                                     b.salePrice,
                                     b.randomCode
                                   )
                                 }
                                 title="View Barcode"
                                 style={{
                                   border: "none",
                                   backgroundColor: "#00A76F",
                                   color: "#ffffff",
                                   padding: "0.4rem 0.6rem",
                                   borderRadius: "0.4rem",
                                   cursor: "pointer",
                                   marginRight: "0.4rem",
                                 }}
                               >
                                 <FaBarcode />
                               </button>
                             ) : (
                               <span style={{ color: "#888" }}>No barcode</span>
                             )}
   
                             {/* EDIT STATUS BUTTON (only if active) */}
                             {!isDisabled && (
                               <button
                                 onClick={() => setBatchEditModal({ productCode: showViewModal.code, productName: showViewModal.name, batch: b })}
                                 title="Edit Batch Status"
                                 style={{
                                   border: "none",
                                   backgroundColor: "#c53030",
                                   color: "#fff",
                                   // color:"#c53030",
                                   padding: "0.35rem 0.5rem",
                                   borderRadius: "0.35rem",
                                   cursor: "pointer",
                                 }}
                               >
                                 <FaEdit />
                               </button>
                             )}
                           </td>
                         </tr>
                       );
                     });
                   })()}
                 </tbody>
   
               </table>
             </div>
   
   
             {/* ✅ Modal Actions */}
             <div
               className="modal-actions"
               style={{
                 marginTop: "1rem",
                 display: "flex",
                 justifyContent: "flex-end",
               }}
             >
               <button className="btn btn-muted" onClick={closeView}>
                 Close
               </button>
             </div>
           </Modal>
         )}

      {/* 🔹 Barcode Modal */}
      {selectedBarcode && (
        <Modal onClose={closeBarcodeModal} title={null}>
          <div
            style={{
              display: "flex",
              justifyContent: "center",
              alignItems: "center",
              padding: "1rem",
            }}
          >

            <div
              style={{
                width: "320px",
                border: "1px solid #ccc",
                padding: "0.75rem",
                textAlign: "left",
                boxSizing: "border-box",
                position: "relative",
              }}
            >

              <div
                style={{
                  fontWeight: "bold",
                  fontSize: "1rem",
                  textAlign: "left",
                  marginBottom: "0.25rem",
                }}
              >
                CSI Book Depot
              </div>


              <div
                style={{
                  fontSize: "0.95rem",
                  fontWeight: "600",
                  marginBottom: "0.4rem",
                  textAlign: "left",
                }}
              >
                {selectedBarcode.name}
              </div>

              <div
                style={{
                  width: "100%",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "left",
                  margin: "0",
                  padding: 0,
                }}
              >

                <img
                  src={selectedBarcode.barcode}
                  alt="Product Barcode"
                  style={{
                    maxWidth: "100%",
                    height: "auto",
                    display: "block",
                    margin: 0,
                  }}
                />


                {selectedBarcode.randomCode && (
                  <div
                    style={{
                      marginTop: "6px",
                      fontSize: "1.1rem",
                      fontWeight: "700",
                      letterSpacing: "1px",
                      textAlign: "center",
                      width: "100%",
                    }}
                  >
                    {selectedBarcode.randomCode}
                  </div>
                )}
              </div>


              <div
                style={{
                  marginTop: "0.35rem",
                  fontSize: "0.9rem",
                  fontWeight: "bold",
                  textAlign: "left",
                }}
              >
                Rate: ₹{selectedBarcode.salePrice}
              </div>


            </div>
          </div>
        </Modal>
      )}




      {/* 🔹 Edit Min Qty Modal */}
      {editBatch && (
        <Modal
          onClose={() => setEditBatch(null)}
          title={`Edit Min Qty - ${editBatch.batchNo || "Unknown Batch"}`}
        >
          <div className="edit-minqty-form">
            <label className="block mb-1 font-medium">New Min Qty:</label>
            <input
              type="number"
              min={0}
              value={editBatch.minQty ?? 0}
              onChange={(e) =>
                setEditBatch((prev) => ({
                  ...prev,
                  minQty: Number(e.target.value),
                }))
              }
              className="input mt-1 border rounded p-1 w-full"
            />

            <div className="modal-actions mt-3 flex gap-2 justify-end">
              <button
                className="btn btn-success"
                onClick={async () => {
                  if (!editBatch.code || !editBatch.batchNo) {
                    pushToast("Missing product code or batch number");
                    return;
                  }

                  try {
                    // ✅ API call
                    await handleSaveMinQty({
                      code: editBatch.code,
                      batchNo: editBatch.batchNo,
                      minQty: editBatch.minQty ?? 0,
                    });

                    // ✅ Update batch list in product modal safely
                    setShowViewModal((prev) => {
                      if (!prev?.batches) return prev;
                      return {
                        ...prev,
                        batches: prev.batches.map((b) =>
                          b.batchNo === editBatch.batchNo
                            ? { ...b, minQty: editBatch.minQty ?? 0 }
                            : b
                        ),
                      };
                    });

                    pushToast("✅ Min Qty updated successfully");
                    setEditBatch(null);
                  } catch (err) {
                    console.error("handleSaveMinQty error:", err);
                    pushToast(
                      err.response?.data?.message ||
                      "❌ Failed to update Min Qty"
                    );
                  }
                }}
              >
                Save
              </button>

              <button
                className="btn btn-muted"
                onClick={() => setEditBatch(null)}
              >
                Cancel
              </button>
            </div>
          </div>
        </Modal>
      )}

      {/* Create Product Modal */}
      {showCreateModal && (
        <Modal onClose={closeCreate} title="Create Product">
          <form onSubmit={onCreate} className="product-form" autoComplete="off">
            <div className="form-grid">
              {/* Left */}
              <div className="form-col">
                <div className="form-row wide relative">
                  <label>Product Code</label>
                  <input
                    className="input"
                    value={form.code || ""}
                    onChange={(e) => onCodeChange(e.target.value)}
                    onFocus={() => form.code && setShowCodeSuggestions(true)}
                    placeholder="Type or select product code"
                  />

                  {showCodeSuggestions && uniqueCodeSuggestions.length > 0 && (
                    <div className="suggestions">
                      {uniqueCodeSuggestions.map((s) => (
                        <div
                          key={s._id || s.code}
                          className="suggestion"
                          onClick={() => selectCodeSuggestion(s)}
                        >
                          <span>{s.code}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <label>Short Name</label>
                  <input className="input" value={form.shortName} onChange={(e) => setForm((f) => ({ ...f, shortName: e.target.value }))} placeholder="e.g., Blue Pen" />
                </div>

                <div className="form-row wide relative">
                  <label>Batch No</label>
                  <input className="input" placeholder="Enter or select batch number" value={form.batchNo} onChange={(e) => { const v = e.target.value; setForm((f) => ({ ...f, batchNo: v })); setShowBatchList(v.trim() === ""); }} onFocus={() => setShowBatchList(true)} onBlur={() => { setTimeout(() => { setShowBatchList((prev) => (form.batchNo ? false : prev)); }, 150); }} />

                  {availableBatches.length > 0 && showBatchList && (
                    <div className="batch-suggestions">
                      <table className="table clean small">
                        <thead>
                          <tr>
                            <th>Batch No</th>
                            <th>MRP</th>
                            <th>Rate</th>
                            <th>Tax %</th>
                            <th>Tax Mode</th>
                            <th>Qty</th>
                          </tr>
                        </thead>
                        <tbody>
                          {availableBatches.map((b) => (
                            <tr key={b._id || b.batchNo} className="batch-row" onClick={() => { onBatchSelect(b); setShowBatchList(false); }}>
                              <td>{b.batchNo}</td>
                              <td>{Number(b.mrp || 0).toFixed(2)}</td>
                              <td>{Number(b.salePrice || 0).toFixed(2)}</td>
                              <td>{b.taxPercent}%</td>
                              <td>{b.taxMode}</td>
                              <td>{b.qty}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>

                <div className="form-row">
                  <label>Rate</label>
                  <input className="input" type="number" inputMode="decimal" value={form.salePrice} onChange={(e) => setForm((f) => ({ ...f, salePrice: e.target.value }))} placeholder="e.g., 100" />
                </div>
              </div>

              {/* Right */}
              <div className="form-col">
                <div className="form-row wide relative">
                  <label>Product Name</label>
                  <input className="input" value={form.name} onChange={(e) => onNameChange(e.target.value)} onFocus={() => form.name && setShowSuggestions(true)} placeholder="Type or select product" />

                  {showSuggestions && nameSuggestions.length > 0 && (
                    <div className="suggestions">
                      {nameSuggestions.map((s) => (
                        <div key={s._id || s.name} className="suggestion" onClick={() => selectSuggestion(s)}>
                          <span>{s.name}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="form-row with-action">
                  <div className="label-row">
                    <label>Category</label>
                    <button type="button" className="link-action" onClick={openCategoryModal} title="Add Category">+ Category</button>
                  </div>
                  <div className="select-wrap">
                    <select className="input select" value={form.category} onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}>
                      <option value="">Select category</option>
                      {categories.map((c) => (
                        <option key={c} value={c}>
                          {c}
                        </option>
                      ))}
                    </select>
                    <FaChevronDown className="chev" />
                  </div>
                </div>

                <div className="form-row">
                  <label>MRP</label>
                  <input className="input no-spin" type="number" inputMode="decimal" value={form.mrp} onChange={(e) => setForm((f) => ({ ...f, mrp: e.target.value }))} placeholder="e.g., 100" onFocus={enableWheelBlock} onBlur={disableWheelBlock} onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }} />
                </div>

                <div className="form-row">
                  <label>Tax %</label>
                  <input className="input no-spin" type="number" inputMode="decimal" value={form.taxPercent} onChange={(e) => setForm((f) => ({ ...f, taxPercent: e.target.value }))} placeholder="e.g., 18" onFocus={enableWheelBlock} onBlur={disableWheelBlock} onKeyDown={(e) => { if (e.key === "ArrowUp" || e.key === "ArrowDown") e.preventDefault(); }} />
                </div>
              </div>
            </div>

            {/* Tax Mode */}
            <div className="tax-mode">
              <label className="radio">
                <input type="radio" name="taxMode" value="inclusive" checked={form.taxMode === "inclusive"} onChange={(e) => setForm((f) => ({ ...f, taxMode: e.target.value }))} />
                <span>Tax Inclusive</span>
              </label>
              <label className="radio">
                <input type="radio" name="taxMode" value="exclusive" checked={form.taxMode === "exclusive"} onChange={(e) => setForm((f) => ({ ...f, taxMode: e.target.value }))} />
                <span>Tax Exclusive</span>
              </label>
            </div>

            {/* Summary */}
            <div className="card summary-card">
              {(() => {
                const basePrice = parseFloat(form.salePrice || 0);
                const taxPercent = parseFloat(form.taxPercent || 0);
                let taxAmount = 0;
                let total = basePrice;

                if (form.taxMode === "inclusive") {
                  taxAmount = basePrice - basePrice / (1 + taxPercent / 100);
                  total = basePrice;
                } else if (form.taxMode === "exclusive") {
                  taxAmount = (basePrice * taxPercent) / 100;
                  total = basePrice + taxAmount;
                }

                return (
                  <>
                    <div className="summary-line">
                      <span>Base Price</span>
                      <strong>{basePrice.toFixed(2)}</strong>
                    </div>
                    <div className="summary-line">
                      <span>Tax Amount ({taxPercent}%)</span>
                      <strong>{taxAmount.toFixed(2)}</strong>
                    </div>
                    <div className="summary-line total">
                      <span>Total ({form.taxMode})</span>
                      <strong>{total.toFixed(2)}</strong>
                    </div>
                  </>
                );
              })()}
            </div>


            {/* Qty & Minimum Qty */}
            <div className="form-row-inline">
              <div className="form-row small">
                <label>Qty</label>
                <input className="input" type="number" value={form.qty} onChange={(e) => setForm((f) => ({ ...f, qty: e.target.value }))} placeholder="e.g., 10" />
              </div>

              <div className="form-row small">
                <label>Minimum Qty</label>
                <input className="input" type="number" value={form.minQty || ""} onChange={(e) => setForm((f) => ({ ...f, minQty: e.target.value }))} placeholder="e.g., 5" />
              </div>
            </div>

            {/* Fixed Actions */}
            <div className="modal-actions fixed">
              <button type="submit" className="btn btn-primary">Create Product</button>
            </div>
          </form>
        </Modal>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        <Modal onClose={closeCategoryModal} title="Manage Categories" className="narrow-modal" style={{ width: "380px", maxWidth: "90%", margin: "0 auto" }}>
          <div className="category-panel">
            <div className="category-add">
              <input className="input" placeholder="Type a category name" value={categoryDraft} onChange={(e) => setCategoryDraft(e.target.value)} onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); addCategoryDraft(); } }} />
              {/* <button type="button" className="btn btn-dark" onClick={addCategoryDraft}>Add</button> */}
              <button
                type="button"
                className="btn btn-dark flex items-center gap-2"
                onClick={addCategoryDraft}
              >
                <FaPlus color="green" />
                <span className="text-green-500">Add</span>
              </button>

            </div>

            <div className="category-list">
              {categoryTemp.length === 0 ? (
                <p className="muted">No categories yet.</p>
              ) : (
                categoryTemp.map((c) => (
                  <div key={c} className="chip">
                    <span>{c}</span>
                    <button type="button" className="chip-del" title="Delete" onClick={() => removeTempCategory(c)}>
                      <FaTrash color="red" />
                    </button>
                  </div>
                ))
              )}
            </div>

            <div className="modal-actions">
              <button className="btn btn-primary" onClick={saveCategories}>Save</button>
            </div>
          </div>
        </Modal>
      )}
    </div>
  );
}

/* ---------- Small building blocks ---------- */
function Detail({ label, value }) {
  return (
    <div className="detail">
      <span className="detail-label">{label}</span>
      <span className="detail-value">{String(value ?? "-")}</span>
    </div>
  );
}

function Modal({ title, children, onClose, className = "", style = {}, width }) {
  return (
    <div className="modal-overlay" onMouseDown={onClose}>
      <div className={`modal-card slide-up ${className}`} style={{ width: width || "600px", ...style }} onMouseDown={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="icon-close" onClick={onClose} aria-label="Close"><FaTimes /></button>
        </div>
        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}












