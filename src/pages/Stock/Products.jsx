
// src/pages/Stock/Products.jsx
import React from "react";
import { useMemo, useState, useEffect, useRef } from "react";
import { FaPlus, FaEye, FaTimes, FaChevronDown, FaTrash, FaEdit, FaBarcode, FaCheckCircle, FaBan } from "react-icons/fa";
import "../../styles/products.css";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../utils/apiClient";
import { getApiUrl } from "../../utils/api";
import Pagination from "../../components/Pagination";
import { toast } from "react-toastify";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

export default function Products() {
  const { user } = useAuth();

  const [products, setProducts] = useState([]);
  const [categories, setCategories] = useState([]);
  const [search, setSearch] = useState("");
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showViewModal, setShowViewModal] = useState(null);
  // const [toasts, setToasts] = useState([]);
  const [nextCode, setNextCode] = useState("");

  const [showCategoryModal, setShowCategoryModal] = useState(false);
  const [categoryDraft, setCategoryDraft] = useState("");
  const [categoryTemp, setCategoryTemp] = useState([]);


  const [nameSuggestions, setNameSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const [availableBatches, setAvailableBatches] = useState([]);
  const [showBatchList, setShowBatchList] = useState(true);

  const [codeSearchResults, setCodeSearchResults] = useState([]);


  const [showCodeSuggestions, setShowCodeSuggestions] = useState(false);
  const wrapperRef = useRef(null);

  const [editBatch, setEditBatch] = useState(null);

  const [filteredUnique, setFilteredUnique] = useState([]);

  const [isExistingProduct, setIsExistingProduct] = useState(false);
  const [existingMinQty, setExistingMinQty] = useState("");

  const [taxFilter, setTaxFilter] = useState("all");

  const [batchEditState, setBatchEditState] = React.useState({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 100;
  // 🔹 Suggestion & batch states (MUST be declared before resetForm)
  // const [uniqueCodeSuggestions, setUniqueCodeSuggestions] = useState([]);


  const [codeHighlightIndex, setCodeHighlightIndex] = useState(-1);
  const [nameHighlightIndex, setNameHighlightIndex] = useState(-1);
  const [batchHighlightIndex, setBatchHighlightIndex] = useState(-1);
  const [batchEditModal, setBatchEditModal] = React.useState(null);


  // inside your component:
  const [selectedBarcode, setSelectedBarcode] = useState(null);
  const [statusFilter, setStatusFilter] = useState("all");

  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState("");

  const [saving, setSaving] = useState(false);

  const [formErrors, setFormErrors] = useState({});
  const [activeField, setActiveField] = useState(null);
  const [backendError, setBackendError] = useState("");

  const [editErrors, setEditErrors] = useState({});


  const [productName, setProductName] = useState("");
  const [showTamilKeyboard, setShowTamilKeyboard] = useState(false);
  const [isTamilMode, setIsTamilMode] = useState(false);
  const tamilInputRef = useRef(null);
  const tamilWrapperRef = useRef(null);
  const categoryDropdownRef = useRef(null);
  const [showCategoryList, setShowCategoryList] = useState(false);

  const [editMode, setEditMode] = useState(false);



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

  const prevSelectedProductRef = useRef(null); // remembers last selected product (if any)



  const toggleEditing = (batchNo, value, initialQty = 0) => {
    setBatchEditState((prev) => ({
      ...prev,
      [batchNo]: { ...prev[batchNo], editing: value, newMinQty: prev[batchNo]?.newMinQty ?? initialQty }
    }));
  };

  const updateMinQty = (batchNo, value) => {
    setBatchEditState((prev) => ({
      ...prev,
      [batchNo]: { ...prev[batchNo], newMinQty: value }
    }));
  };

  // For manager/megaadmin: selected shop
  const [selectedShop, setSelectedShop] = useState("");

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
  // const pushToast = (msg) => {
  //   const id = Date.now();
  //   setToasts((t) => [...t, { id, msg }]);
  //   setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 2500);
  // };

  // -------------------------------
  // API path helper
  // -------------------------------
  const getApiPath = (endpoint) => {
    const ep = endpoint.replace(/^\//, "");
    if (!user) return getApiUrl(ep);

    // Tenant user: send normal endpoint, header includes shopname
    if (user.role === "tenant") return getApiUrl(ep);

    // Manager/Megaadmin: include selectedShop in path
    if ((user.role === "manager" || user.role === "megaadmin") && selectedShop) {
      return getApiUrl(`api/shops/${selectedShop}/${ep}`);
    }

    return getApiUrl(ep);
  };


  const fetchProducts = async (page = 1, searchText = "", status = "all", taxMode = "all") => {
    if (!user) return;

    try {
      const isSearching = !!searchText.trim();
      const limit = isSearching ? 0 : 100; // 0 → fetch all
      // let query = `${getApiPath("products")}?limit=${limit}`;
      // let query = `${getApiPath("products")}?limit=${limit}&status=${status}`;
      let query = `${getApiPath("products")}?limit=${limit}&status=${status}&taxMode=${taxMode}`;



      if (isSearching) {
        query += `&search=${encodeURIComponent(searchText)}`;
      } else {
        query += `&page=${page}`;
      }

      const res = await apiClient.get(query);
      const data = res?.data || {};

      const allProducts = Array.isArray(data.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];

      if (isSearching) {
        // 🟢 client-side pagination OR show all at once
        setProducts(allProducts);
        setTotalPages(1);
        setPage(1);
        return;
      }

      // Normal (server pagination)
      setProducts(allProducts);
      setTotalPages(Number(data.totalPages || 1));
      setPage(Number(data.page || page));
    } catch (err) {
      console.error("fetchProducts error:", err);
      // pushToast(`Failed to fetch products${selectedShop ? ` for ${selectedShop}` : ""}`);
      toast.error(`Failed to fetch products${selectedShop ? ` for ${selectedShop}` : ""}`);
    }
  };

  const fetchCategories = async () => {
    if (!user) return;

    try {
      const res = await apiClient.get(getApiPath("categories"));

      // Normalize categories to an array
      const cats = Array.isArray(res.data)
        ? res.data
        : Array.isArray(res.data?.categories)
          ? res.data.categories
          : [];

      setCategories(cats);
    } catch (err) {
      console.error("fetchCategories error:", err);
      // pushToast("Failed to fetch categories");
      toast.error("Failed to fetch categories");
    }
  };

  // Load data whenever user or selectedShop changes
  useEffect(() => {
    if (!user) return;

    const loadData = async () => {
      // await Promise.all([fetchProducts(), fetchCategories()]);
      await Promise.all([
        fetchProducts(1, search, statusFilter, taxFilter),
        fetchCategories(),
      ]);

    };

    loadData();
  }, [user, selectedShop]);

  // Optionally, refresh products when page changes
  useEffect(() => {
    if (!user) return;
    fetchProducts(page, search, statusFilter, taxFilter);
  }, [page, user, selectedShop]);
  // -------------------------------
  // Filtered products
  // -------------------------------
  const filtered = useMemo(() => {
    const s = search.trim().toLowerCase();
    if (!s) return products;
    return products.filter((p) =>
      [p.code, p.name, p.category].some((v) => v?.toLowerCase().includes(s))
    );
  }, [search, products, taxFilter]);

  // -------------------------------
  // Apply decrements helper
  // -------------------------------
  const applyDecrementsToProducts = (prevProducts, decrements) => {
    const productsCopy = prevProducts.map((p) => ({ ...p }));
    for (const d of decrements) {
      const code = (d.code || "").toLowerCase();
      const batchNo = (d.batchNo || "").toLowerCase();
      let remaining = Number(d.qty || 0);

      for (let i = 0; i < productsCopy.length && remaining > 0; i++) {
        const p = productsCopy[i];
        if ((p.code || "").toLowerCase() === code && (p.batchNo || "").toLowerCase() === batchNo) {
          const available = Number(p.qty || 0);
          if (available <= 0) continue;
          const take = Math.min(available, remaining);
          p.qty = Math.max(0, available - take);
          remaining -= take;
        }
      }
    }
    return productsCopy;
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
  // Unique products by code + name
  // -------------------------------


  const uniqueProducts = useMemo(() => {
    const map = new Map();

    filtered.forEach((p) => {
      const code = p.code?.trim().toLowerCase();
      const name = p.name?.trim().toLowerCase();
      const key = `${code}-${name}`;

      if (!map.has(key)) {
        map.set(key, {
          ...p,
          batches: [
            {
              batchNo: p.batchNo,
              qty: Number(p.qty) || 0,
              minQty: Number(p.minQty) || 0,
              mrp: Number(p.mrp) || 0,
              salePrice: Number(p.salePrice) || 0,
              taxPercent: Number(p.taxPercent) || 0,
              taxMode: p.taxMode || "-",
            },
          ],
        });
      } else {
        const existing = map.get(key);
        existing.batches.push({
          batchNo: p.batchNo,
          qty: Number(p.qty) || 0,
          minQty: Number(p.minQty) || 0,
          mrp: Number(p.mrp) || 0,
          salePrice: Number(p.salePrice) || 0,
          taxPercent: Number(p.taxPercent) || 0,
          taxMode: p.taxMode || "-",
        });
      }
    });

    return Array.from(map.values());
  }, [filtered]);



  const uniqueNameSuggestions = useMemo(() => {
    const seen = new Set();
    return uniqueProducts.filter((p) => {
      if (seen.has(p.name.toLowerCase())) return false;
      seen.add(p.name.toLowerCase());
      return true;
    });
  }, [uniqueProducts]);

  // -------------------------------
  // Tax summary
  // -------------------------------
  const taxSummary = useMemo(() => {
    const priceNum = parseFloat(form.salePrice || form.price || 0) || 0;
    const tax = parseFloat(form.taxPercent || 0) || 0;
    if (!priceNum || !tax) return { base: priceNum, taxAmt: 0, total: priceNum, mode: form.taxMode };
    if (form.taxMode === "exclusive") {
      const taxAmt = +(priceNum * (tax / 100)).toFixed(2);
      const total = +(priceNum + taxAmt).toFixed(2);
      return { base: priceNum, taxAmt, total, mode: "exclusive" };
    } else {
      const base = +((priceNum * 100) / (100 + tax)).toFixed(2);
      const taxAmt = +(priceNum - base).toFixed(2);
      return { base, taxAmt, total: priceNum, mode: "inclusive" };
    }
  }, [form.salePrice, form.price, form.taxPercent, form.taxMode]);

  // -------------------------------
  // Form & modal helpers
  // -------------------------------

  // ✅ Safe Reset Function
  const resetForm = (code = "", category = "") => {
    setForm({
      code: code || "",
      name: "",
      shortName: "",
      category: "",
      batchNo: "",
      mrp: "",
      salePrice: "",
      qty: "",
      taxPercent: "",
      taxMode: "exclusive",
      minQty: "",
      status: "active",
    });

    setShowCodeSuggestions(false);
    setShowSuggestions(false);
    setShowBatchList(false);
    setAvailableBatches([]);
    setNameSuggestions([]);
    setCodeSearchResults([]);

    setIsExistingProduct(false);
    setExistingMinQty("");
  };

  const openCreate = async () => {
    try {
      // ✅ Always get the *latest* next code from backend
      const { data } = await apiClient.get(getApiPath("products/next-code"));

      // ✅ Extract the new code properly
      const nextCode = data?.nextCode || "";

      // ✅ Preserve currently selected category (if any)
      const currentCategory = form?.category || "";


      setEditMode(false);

      // ✅ Reset form with fresh code and same category
      resetForm(nextCode, currentCategory);

      // ✅ Update local state
      setNextCode(nextCode);

      // reset tamil mode
      setIsTamilMode(false);
      setShowTamilKeyboard(false);

      // ✅ Open the modal
      setShowCreateModal(true);
    } catch (err) {
      console.error("Failed to get next code", err);
      // pushToast("Failed to generate product code");
      toast.error("Failed to generate product code");
    }
  };

  // const closeCreate = () => setShowCreateModal(false);
  const closeCreate = () => {
    setShowCreateModal(false);
    setEditMode(false);

    resetForm();   // ✅ ONE SOURCE OF TRUTH

    setIsTamilMode(false);
    setShowTamilKeyboard(false);
  };

  const openEditProduct = (product) => {
    setEditMode(true);

    setForm({
      code: product.code || "",
      name: product.name || "",
      shortName: product.shortName || "",
      category: product.category || "",
      taxPercent: product.taxPercent ?? "",
      taxMode: product.taxMode || "exclusive",
      minQty: product.minQty ?? "",
      status: product.status || "active",   // ⭐ IMPORTANT
    });

    setIsExistingProduct(false);
    setExistingMinQty(product.minQty ?? "");

    setShowCreateModal(true);
  };

  // ✅ openView now always includes product + all its batches
  const openView = (product) => {
    // product already grouped with batches in the table
    const batches = product.batches || getBatches(product) || [];

    // merge live stock (if cached)
    const mergedBatches = batches.map((b) => ({
      ...b,
      qty:
        typeof getStockCache === "function"
          ? getStockCache(product.code, b.batchNo)
          : Number(b.qty || 0),
    }));

    setShowViewModal({ ...product, batches: mergedBatches });
  };


  const closeView = () => setShowViewModal(null);

  const getBatches = (prod) => {
    if (!prod) return [];
    // ensure batches array exists and sorted (optional)
    return Array.isArray(prod.batches) ? prod.batches : [];
  };

  // -------------------------------
  // Category modal helpers
  // -------------------------------


  // --- Handle selecting a batch from availableBatches ---
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

    setShowBatchList(false); // close dropdown after select
  };



  const showError = (message) => {
    const popup = document.createElement("div");
    popup.innerText = message;
    popup.style.position = "fixed";
    popup.style.top = "20px";
    popup.style.right = "20px";
    popup.style.backgroundColor = "#FF4C4C";
    popup.style.color = "#fff";
    popup.style.padding = "1rem 1.5rem";
    popup.style.borderRadius = "0.5rem";
    popup.style.zIndex = 9999;
    popup.style.boxShadow = "0 2px 8px rgba(0,0,0,0.2)";
    document.body.appendChild(popup);

    setTimeout(() => {
      try {
        document.body.removeChild(popup);
      } catch { }
    }, 3000);
  };



  // 🔒 Prevent refresh while saving
  useEffect(() => {
    const blockRefresh = (e) => {
      if (saving) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", blockRefresh);
    return () => window.removeEventListener("beforeunload", blockRefresh);
  }, [saving]);


  // const onCreate = async (e) => {
  //   e.preventDefault();

  //   if (saving) return;          // 🔒 block double submit


  //   // 🔹 Resolve Min Qty correctly
  //   const minQtyValue = isExistingProduct ? existingMinQty : form.minQty;

  //   // 🔹 Required validation
  //   const requiredFields = [
  //     { field: "name", label: "Product Name" },
  //     { field: "code", label: "Product Code" },
  //     { field: "category", label: "Category" },
  //     // { field: "shortName", label: "Short Name" },
  //     { field: "taxPercent", label: "Tax %" },
  //     { field: "taxMode", label: "Tax Mode" },
  //   ];

  //   for (const { field, label } of requiredFields) {
  //     const value = form[field];
  //     if (value === undefined || value === null || value.toString().trim() === "") {
  //       showError(`${label} is required`);
  //       return;
  //     }
  //   }

  //   // 🔹 Min Qty numeric validation
  //   // if (!minQtyValue || Number(minQtyValue) <= 0) {
  //   //   showError("Minimum Qty must be greater than 0");
  //   //   return;
  //   // }

  //   setSaving(true);

  //   try {
  //     const payload = {
  //       name: form.name.trim(),
  //       shortName: form.shortName.trim(),
  //       code: form.code.trim(),
  //       category: form.category.trim(),
  //       shop: user?.shop || selectedShop,
  //       taxPercent: Number(form.taxPercent),
  //       taxMode: form.taxMode,
  //       minQty: Number(minQtyValue),
  //       status: form.status || "active",
  //     };

  //     // const { data } = await apiClient.post(getApiPath("products"), payload);

  //     let data;

  //     if (editMode) {
  //       const res = await apiClient.patch(
  //         getApiPath("products/update-product"),
  //         payload
  //       );
  //       data = res.data;
  //       pushToast("Product updated");
  //     } else {
  //       const res = await apiClient.post(
  //         getApiPath("products"),
  //         payload
  //       );
  //       data = res.data;
  //       pushToast("Product created");
  //     }



  //     // refresh products so pagination recalculates

  //     await fetchProducts(1, search, statusFilter, taxFilter);
  //     setPage(1);

  //     setShowCreateModal(false);
  //     setIsExistingProduct(false);
  //     setExistingMinQty("");
  //     pushToast("Product saved");
  //   } catch (err) {
  //     showError(
  //       err.response?.data?.error ||
  //       err.message ||
  //       "Failed to create product"
  //     );
  //   }
  //   finally {
  //     setSaving(false);          // ✅ always unlock UI
  //   }
  // };
  const onCreate = async (e) => {
    e.preventDefault();

    if (saving) return;

    const minQtyValue = isExistingProduct ? existingMinQty : form.minQty;

    const requiredFields = [
      { field: "name", label: "Product Name" },
      { field: "code", label: "Product Code" },
      { field: "category", label: "Category" },
      { field: "taxPercent", label: "Tax %" },
      { field: "taxMode", label: "Tax Mode" },
    ];

    for (const { field, label } of requiredFields) {
      const value = form[field];
      if (value === undefined || value === null || value.toString().trim() === "") {
        showError(`${label} is required`);
        return;
      }
    }

    setSaving(true);

    try {
      const payload = {
        code: form.code.trim(),
        name: form.name.trim(),
        shortName: form.shortName?.trim() || "",
        category: form.category,
        taxPercent: Number(form.taxPercent || 0),
        taxMode: form.taxMode || "exclusive",
        minQty: Number(minQtyValue || 0),
        status: form.status || "active",
      };

      console.log("PRODUCT PAYLOAD:", payload);   // ⭐ debug

      let res;

      if (editMode) {
        res = await apiClient.patch(
          getApiPath("products/update-product"),
          payload
        );
        // pushToast("Product updated");
        toast.success("Product updated Successful! 🎉");
      } else {
        res = await apiClient.post(
          getApiPath("products"),
          payload
        );
        toast.success("Product created Successful! 🎉");
      }

      const data = res.data;

      await fetchProducts(1, search, statusFilter, taxFilter);
      setPage(1);

      setShowCreateModal(false);
      setIsExistingProduct(false);
      setExistingMinQty("");

    } catch (err) {
      showError(
        err.response?.data?.error ||
        err.message ||
        "Failed to save product"
      );
    } finally {
      setSaving(false);
    }
  };



  const openCategoryModal = () => {
    // setCategoryTemp(categories); // temporary modal copy
    setCategoryDraft("");
    setShowCategoryModal(true);
  };

  const closeCategoryModal = () => setShowCategoryModal(false)





  const addCategoryDraft = async () => {
    const name = categoryDraft.trim();

    if (!name) {
      setFormErrors((prev) => ({
        ...prev,
        categoryDraft: "Category name is required",
      }));
      return;
    }

    if (categories.includes(name)) {
      setFormErrors((prev) => ({
        ...prev,
        categoryDraft: "Category already exists",
      }));
      return;
    }

    try {
      setSaving(true);

      const updatedCategories = [...categories, name];

      await apiClient.put(getApiPath("categories"), {
        categories: updatedCategories,
      });

      setCategories(updatedCategories);
      setForm((f) => ({ ...f, category: name }));
      setCategoryDraft("");

      // clear error
      setFormErrors((prev) => {
        const copy = { ...prev };
        delete copy.categoryDraft;
        return copy;
      });

    } catch (err) {
      console.error(err);
    } finally {
      setSaving(false);
    }
  };


  const removeCategory = async (categoryName) => {
    try {
      const updatedCategories = categories.filter((c) => c !== categoryName);

      // Update backend via PUT
      await apiClient.put(getApiPath("categories"), { categories: updatedCategories });

      // Update frontend state
      setCategories(updatedCategories);

      if (form.category === categoryName) {
        setForm((f) => ({ ...f, category: "" }));
      }

      // pushToast(`Category "${categoryName}" deleted`);
      toast.success(`Category "${categoryName}" deleted`);
    } catch (err) {
      console.error("Failed to delete category", err);
      // pushToast("Failed to delete category");
      toast.error("Failed to delete category");
    }
  };


  const removeTempCategory = (name) => {
    setCategoryTemp((prev) => prev.filter((c) => c !== name));

    // Optionally remove from main categories if you want live update
    setCategories((prev) => prev.filter((c) => c !== name));

    // If the removed category is selected in the form, clear it
    setForm((f) => (f.category === name ? { ...f, category: "" } : f));
  };


  const saveCategories = async () => {
    try {
      const { data } = await apiClient.put(getApiPath("categories"), { categories: categoryTemp });

      // Use server response to update categories
      const updatedCategories = Array.isArray(data) ? data : [];
      setCategories(updatedCategories); // ensures local state matches server

      // Auto-select last added
      if (categoryTemp.length > 0) {
        const lastAdded = categoryTemp[categoryTemp.length - 1];
        setForm((f) => ({ ...f, category: lastAdded }));
      }

      setShowCategoryModal(false);
      pushToast("Categories saved");
    } catch (err) {
      console.error("Failed to save categories:", err);
      pushToast("Failed to save categories");
    }
  };

  const wheelHandler = (e) => {
    if (
      document.activeElement &&
      (document.activeElement.type === "number" || document.activeElement.inputMode === "decimal")
    ) e.preventDefault();
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
      // pushToast("Products refreshed");
      toast.success("Products refreshed");
    };
    window.addEventListener("products:refresh", handler);
    return () => window.removeEventListener("products:refresh", handler);
  }, []);

  // -------------------------------
  // Listen for sales bill updates (live stock decrement)
  // -------------------------------
  useEffect(() => {
    const handleSalesBillUpdate = async (e) => {
      const { newItems = [], oldItems = [] } = e?.detail || {};

      if (!Array.isArray(newItems)) return;

      // Calculate net decrements (new qty - old qty if editing)
      const decrements = newItems.map((item) => {
        let prevQty = 0;
        if (oldItems.length > 0) {
          const match = oldItems.find((o) => o.code === item.code && o.batch === item.batch);
          if (match) prevQty = Number(match.qty || 0);
        }
        const netQty = Number(item.qty || 0) - prevQty;
        return netQty > 0
          ? { code: item.code, batchNo: item.batch, qty: netQty }
          : null;
      }).filter(Boolean);

      if (decrements.length === 0) return;

      // Apply decrements locally
      setProducts((prev) => applyDecrementsToProducts(prev, decrements));

      // Optional: refresh from server
      await fetchProducts();
      // pushToast("Stock updated from sales bill");
      toast.success("Stock updated from sales bill");
    };

    window.addEventListener("salesbill:updated", handleSalesBillUpdate);
    return () => window.removeEventListener("salesbill:updated", handleSalesBillUpdate);
  }, []);


  // --- Handle typing in Product Code ---
  const onCodeChange = async (val) => {
    setForm((f) => ({ ...f, code: val }));
    setShowCodeSuggestions(true);

    // 🧠 If user clears the input, reset + fetch next available code
    if (!val.trim()) {
      resetForm();
      setShowCodeSuggestions(false);
      setIsExistingProduct(false);
      setExistingMinQty("");
      setCodeSearchResults([]);

      // ⚡ Fetch next available product code immediately
      try {
        const res = await apiClient.get(`${getApiPath("products")}/next-code`);
        const nextCode = res.data?.nextCode;
        if (nextCode) {
          setForm((f) => ({ ...f, code: nextCode }));
        }
      } catch (err) {
        console.error("❌ Failed to fetch next product code:", err);
      }

      return;
    }

    try {
      // 🔥 Fetch all matches for code
      const { data } = await apiClient.get(
        `${getApiPath("products")}?limit=0&search=${encodeURIComponent(val)}`
      );
      const matches = Array.isArray(data?.products) ? data.products : [];
      setCodeSearchResults(matches);
      setShowCodeSuggestions(matches.length > 0);

      // ✅ Detect exact match
      const exact = matches.find(
        (p) => p.code?.toLowerCase() === val.toLowerCase()
      );

      if (exact) {
        const batches = getBatches(exact);
        setAvailableBatches(batches);
        setIsExistingProduct(true);
        setExistingMinQty(exact.minQty || 0);

        setForm((f) => ({
          ...f,
          name: exact.name,
          shortName: exact.shortName,
          category: exact.category,
          batchNo: "",
          minQty: exact.minQty || 0,
        }));

        if (batches.length > 0) setShowBatchList(true);
      } else {
        setIsExistingProduct(false);
        setExistingMinQty("");
        setAvailableBatches([]);
        setShowBatchList(false);
      }
    } catch (err) {
      console.error("❌ Error fetching code suggestions:", err);
      setCodeSearchResults([]);
      setShowCodeSuggestions(false);
    }
  };


  // --- Handle typing in Product Name ---

  const onNameChange = async (val) => {
    setForm((f) => ({ ...f, name: val }));
    setAvailableBatches([]);
    setShowBatchList(false);

    if (!val.trim()) {
      setNameSuggestions([]);
      setShowSuggestions(false);
      return;
    }

    try {
      const { data } = await apiClient.get(
        `${getApiPath("products")}?limit=0&search=${encodeURIComponent(val)}`
      );

      const matches = Array.isArray(data?.products) ? data.products : [];

      const uniqueMatches = Array.from(
        new Map(matches.map((m) => [m.name?.toLowerCase(), m])).values()
      );

      setNameSuggestions(uniqueMatches);
      setShowSuggestions(uniqueMatches.length > 0);

      // ❌ REMOVE auto-fill on exact match
      setIsExistingProduct(false);
      setExistingMinQty("");
      setAvailableBatches([]);
      setShowBatchList(false);

    } catch (err) {
      console.error("❌ Error fetching name suggestions:", err);
      setNameSuggestions([]);
      setShowSuggestions(false);
    }
  };



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
    setIsExistingProduct(true);
    setExistingMinQty(prod.minQty || 0);
    if (batches.length > 0) setShowBatchList(true);
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
      minQty: prod.minQty || 0,
      batchNo: "",
    }));
    setIsExistingProduct(true);
    setExistingMinQty(prod.minQty || 0);
    setShowSuggestions(false);
    if (batches.length > 0) setShowBatchList(true);
  };

  // --- Memoized code suggestions (no duplicate codes) ---
  const uniqueCodeSuggestions = useMemo(() => {
    const seen = new Set();
    return codeSearchResults
      .filter((p) => {
        if (seen.has(p.code)) return false;
        seen.add(p.code);
        return true;
      })
      .filter((p) =>
        form.code ? p.code.toLowerCase().includes(form.code.toLowerCase()) : true
      )
      .slice(0, 10);
  }, [codeSearchResults, form.code]);


  const saveProductDetails = async ({ code, minQty, status, taxPercent, taxMode }) => {
    if (saving) return;

    if (minQty === "" || minQty < 0) {
      setEditErrors({
        minQty: "Minimum Qty is required and must be 0 or more",
      });
      return;
    }
    setSaving(true);
    setEditErrors({});
    try {
      const payload = {
        code,
        minQty: Number(minQty || 0),
        status,
        taxPercent: Number(taxPercent || 0),
        taxMode,
      };

      const res = await apiClient.patch(getApiPath("products/update-product"), payload);
      const updated = res.data;

      // Update local UI
      setProducts((prev) =>
        prev.map((p) =>
          p.code === updated.code
            ? {
              ...p,
              minQty: updated.minQty,
              status: updated.status,
              taxPercent: updated.taxPercent,
              taxMode: updated.taxMode,
            }
            : p
        )
      );

      pushToast(`Product updated`);
    } catch (err) {
      console.error("saveProductDetails error:", err);
      pushToast(err.response?.data?.message || "Failed to update product");
    }
    finally {
      setSaving(false);
    }
  };



  const handleSaveMinQty = async ({ code, minQty }) => {
    if (!code) {
      pushToast("Missing product code");
      return;
    }

    try {
      const payload = { code, minQty: Number(minQty || 0) };

      // ✅ API call (make sure your backend route supports this)
      const res = await apiClient.patch(getApiPath("products/min-qty"), payload);
      const updated = res.data;

      // ✅ Update local product list (main minQty only)
      setProducts((prev) =>
        prev.map((p) =>
          p.code === updated.code ? { ...p, minQty: updated.minQty } : p
        )
      );

      pushToast(`Min Qty updated for ${code}`);
    } catch (err) {
      console.error("handleSaveMinQty error:", err);
      pushToast(err.response?.data?.message || "Failed to update Min Qty");
    }
  };

  const BatchRow = ({ batch, idx, minQty, resultingStock, handleSaveMinQty }) => {
    const [editingMinQty, setEditingMinQty] = React.useState(false);
    const [newMinQty, setNewMinQty] = React.useState(minQty);

    const batchStatus = b.status || "active";
    const isBatchDisabled = batchStatus === "disabled";


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






  /* -------------------- */
  /* Subcomponent Section */
  /* -------------------- */

  const BatchTableView = ({ product, getBatches, getStockCache, handleSaveMinQty }) => {
    // ✅ Keep all edit states in one place
    const [editState, setEditState] = React.useState({});

    const toggleEdit = (batchNo, value) => {
      setEditState((prev) => ({
        ...prev,
        [batchNo]: { ...prev[batchNo], editing: value },
      }));
    };

    const updateMinQty = (batchNo, newValue) => {
      setEditState((prev) => ({
        ...prev,
        [batchNo]: { ...prev[batchNo], newMinQty: newValue },
      }));
    };

    const batches = getBatches(product);

    return (
      <div className="batch-table-wrapper">


        {/* inside the View Modal batch-table-wrapper */}
        <table className="table clean small">
          <thead>
            <tr>
              <th>S.No</th>
              <th>Batch No</th>
              <th>Qty</th>
              <th>MRP</th>
              <th>Rate</th>
              <th>Tax %</th>
              <th>Tax Mode</th>
              <th>Status</th> {/* NEW */}
              <th>Action</th>
            </tr>
          </thead>

          <tbody>
            {Array.isArray(showViewModal.batches) && showViewModal.batches.length > 0 ? (
              [...new Map(
                showViewModal.batches.map((b) => [b.batchNo?.trim().toLowerCase(), b])
              ).values()].map((b, idx) => {
                const minQty = Number(b.minQty || 0);
                const qty = Number(b.qty || 0);
                const batchStatus = b.status || "active";

                return (
                  <tr key={b.batchNo || idx}>
                    <td>{idx + 1}</td>
                    <td>{b.batchNo || "-"}</td>
                    <td className={qty <= minQty ? "danger" : ""}>{qty}</td>
                    <td>{Number(b.mrp || 0).toFixed(2)}</td>
                    <td>{Number(b.salePrice || b.rate || 0).toFixed(2)}</td>
                    <td>{b.taxPercent || 0}%</td>
                    <td>
                      {b.taxMode ? b.taxMode.charAt(0).toUpperCase() + b.taxMode.slice(1) : "-"}
                    </td>

                    {/* status cell */}
                    <td>
                      {batchStatus === "active" ? (
                        <span style={{ color: "#0b7a3a", fontWeight: 600 }}>● Active</span>
                      ) : (
                        <span style={{ color: "#c53030", fontWeight: 600 }}>● Disabled</span>
                      )}
                    </td>

                    <td>
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
                        <span style={{ color: "#888", marginRight: "0.4rem" }}>No barcode</span>
                      )}

                      {/* batch edit button: only show when batch active */}
                      {batchStatus !== "disabled" && (
                        <button
                          onClick={async () => {
                            const newStatus = batchStatus === "active" ? "disabled" : "active";
                            // Optimistic update in view modal
                            setShowViewModal((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                batches: prev.batches.map(bx => bx.batchNo === b.batchNo ? { ...bx, status: newStatus } : bx)
                              };
                            });
                            await toggleBatchStatus({ code: showViewModal.code, batchNo: b.batchNo, status: newStatus });
                          }}
                          title="Toggle Batch Status"
                          style={{
                            border: "none",
                            backgroundColor: "#f59e0b",
                            color: "#fff",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "0.35rem",
                            cursor: "pointer",
                          }}
                        >
                          <FaEdit />
                        </button>
                      )}

                      {/* If batch disabled, show enable button */}
                      {batchStatus === "disabled" && (
                        <button
                          onClick={async () => {
                            // enable batch
                            setShowViewModal((prev) => {
                              if (!prev) return prev;
                              return {
                                ...prev,
                                batches: prev.batches.map(bx => bx.batchNo === b.batchNo ? { ...bx, status: "active" } : bx)
                              };
                            });
                            await toggleBatchStatus({ code: showViewModal.code, batchNo: b.batchNo, status: "active" });
                          }}
                          title="Enable Batch"
                          style={{
                            border: "none",
                            backgroundColor: "#06b6d4",
                            color: "#fff",
                            padding: "0.35rem 0.5rem",
                            borderRadius: "0.35rem",
                            cursor: "pointer",
                          }}
                        >
                          <FaPlus />
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            ) : (
              <tr>
                <td colSpan="9" style={{ textAlign: "center", color: "#777" }}>
                  No batch records found
                </td>
              </tr>
            )}
          </tbody>
        </table>

      </div>
    );
  };




  // Toggle product status (active / disabled)
  const toggleProductStatus = async ({ code, status }) => {
    try {
      const res = await apiClient.patch(getApiPath("products/status"), { code, status });
      const updated = res.data;
      // Update local list: replace the product with updated one
      setProducts((prev) =>
        Array.isArray(prev)
          ? prev.map((p) => (p.code === updated.code ? { ...p, status: updated.status } : p))
          : prev
      );
      pushToast(`Product ${code} set to ${status}`);
    } catch (err) {
      console.error("toggleProductStatus error:", err);
      pushToast("Failed to update product status");
    }
  };




  // Toggle batch status



  const BatchStatusModal = ({ productCode, productName, batch, onClose }) => {
    const [status, setStatus] = useState(batch.status || "active");

    return (
      <Modal title="Edit Batch Status" onClose={onClose} width="520px">
        <div className="space-y-5 text-sm">

          {/* Product Code */}
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-gray-600 font-medium">Product Code</span>
            <span className="col-span-2 font-semibold text-gray-900">
              {productCode}
            </span>
          </div>

          {/* Product Name */}
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-gray-600 font-medium">Product Name</span>
            <span className="col-span-2 font-semibold text-gray-900">
              {productName || "-"}
            </span>
          </div>

          {/* Batch No */}
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-gray-600 font-medium">Batch No</span>
            <span className="col-span-2 font-semibold text-gray-900">
              {batch.batchNo}
            </span>
          </div>

          {/* Status */}
          <div className="grid grid-cols-3 items-center gap-4">
            <span className="text-gray-600 font-medium">Status</span>

            <div className="col-span-2 flex items-center gap-3">
              <select
                value={status}
                onChange={(e) => setStatus(e.target.value)}
                className="px-3 py-2 rounded-md border border-gray-300
                         focus:outline-none focus:ring-2 focus:ring-[#007867]
                         focus:border-[#007867]"
              >
                <option value="active">Active</option>
                <option value="disabled">Disabled</option>
              </select>

              {/* Status Indicator */}
              {status === "active" ? (
                <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                  <FaCheckCircle /> Active
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                  <FaBan /> Disabled
                </span>
              )}
            </div>
          </div>

          {/* Footer */}
          <div className="border-t pt-4 mt-6 flex justify-end gap-3">


            <button
              type="button"
              // className="px-5 py-2 rounded-md bg-[#007867] text-white
              //            font-semibold hover:bg-[#006457] transition"


              className="inline-flex items-center gap-2 px-4 py-2 
             rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0 "
              onClick={async () => {
                await toggleBatchStatus({
                  code: productCode,
                  batchNo: batch.batchNo,
                  status,
                });
                onClose();
              }}
            >
              Save Changes
            </button>
          </div>
        </div>
      </Modal>
    );
  };

  const toggleBatchStatus = async ({ code, batchNo, status }) => {
    if (saving) return;
    setSaving(true);
    try {
      console.log("PATCH Payload SENT:", {
        code,
        batchNo,
        status,
        loweredStatus: status?.toLowerCase(),
        typeCode: typeof code,
        typeBatchNo: typeof batchNo,
        typeStatus: typeof status
      });



      const res = await apiClient.patch(getApiPath("products/batch-status"), {
        code,
        batchNo,
        status: status.toLowerCase(),
      });



      // await apiClient.patch(getApiPath("products/batch-status"), { code, batchNo, status });
      // reflect change in local products list
      const { code: pcode, batchNo: bno, status: newStatus } = res.data;





      setProducts((prev) =>
        prev.map((prod) => {
          if (prod.code !== pcode) return prod;
          return {
            ...prod,
            batches: Array.isArray(prod.batches)
              ? prod.batches.map((b) => (b.batchNo === bno ? { ...b, status: newStatus } : b))
              : prod.batches,
          };
        })
      );

      // If currently showing view modal for this product, update it
      setShowViewModal((prev) => {
        if (!prev || prev.code !== pcode) return prev;
        return {
          ...prev,
          batches: prev.batches.map((b) => (b.batchNo === bno ? { ...b, status: newStatus } : b)),
        };
      });

      // pushToast(`Batch ${batchNo} set to ${status}`);
      toast.success(`Batch ${batchNo} set to ${status}`);
    } catch (err) {
      console.error("toggleBatchStatus error:", err);
      // pushToast("Failed to update batch status");
      toast.error("Failed to update batch status");
    }
    finally {
      setSaving(false);
    }
  };




  const openBarcodePrintWindow = (barcodeData, quantity) => {
    // Ensure quantity is at least 1
    const qty = Math.max(1, parseInt(quantity || 1, 10));

    // Build rows of 3 slots. For each slot: either filled (label) or empty placeholder.
    const slotsPerRow = 3;
    const rows = Math.ceil(qty / slotsPerRow);
    let gridHtml = "";

    for (let r = 0; r < rows; r++) {
      gridHtml += `<div class="row">`;
      for (let c = 0; c < slotsPerRow; c++) {
        const index = r * slotsPerRow + c;
        if (index < qty) {
          // filled slot
          gridHtml += `
          <div class="slot">
           <div class="slot-inner">

  <!-- TOP -->
  <div class="top">
    <div class="store">CSI Book Depot</div>
    <div class="prod">${escapeHtml(barcodeData.name)}</div>
  </div>

  <!-- MIDDLE -->
  <div class="middle">
    <div class="barcode">
      <img src="${barcodeData.barcode}" />
    </div>
  </div>

  <!-- BOTTOM -->
  <div class="bottom">
    <div class="rand">${escapeHtml(barcodeData.randomCode || "")}</div>
    <div class="rate">Rate: ₹${escapeHtml(String(barcodeData.salePrice || ""))}</div>
  </div>

</div>
          </div>
        `;
        } else {
          // blank slot (keeps spacing)
          gridHtml += `<div class="slot slot-empty"><div class="slot-inner"></div></div>`;
        }
      }
      gridHtml += `</div>`;
    }






    const html = `
<html>
  <head>
    <meta charset="utf-8"/>
    <style>
      @page {
        size: 110mm auto;
        margin: 0;
      }

      html, body {
        margin: 0;
        padding: 0;
        width: 110mm;
        -webkit-print-color-adjust: exact;
        print-color-adjust: exact;
      }

      body {
        font-family: Arial, sans-serif;
        box-sizing: border-box;
      }

      /* ===== ROW ===== */
      .row {
        width: 105mm;                 /* 110 - 2.5 - 2.5 */
        height: 20mm;
        display: flex;
        flex-direction: row;
        margin: 0 auto;               /* centers → 2.5mm margins */
        box-sizing: border-box;
      }



 .top {
  flex: 1;
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.middle {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
}

.bottom {
  display: flex;
  flex-direction: column;
  align-items: flex-start;   /* left align */
  gap: 0;                    /* 🔥 remove space */
}
      /* ===== SLOT (35mm each) ===== */
      .slot {
        width: 35mm;
        height: 20mm;
        box-sizing: border-box;
        display: flex;
        justify-content: center;
        align-items: center;
        page-break-inside: avoid;
        break-inside: avoid;
      }

      /* ===== SLOT INNER (32mm content) ===== */
.slot-inner {
  width: 32mm;
   height: 100%;
  box-sizing: border-box;
 
  padding: 1mm 1.5mm;   /* 1.5mm left & right */
  display: flex;
  flex-direction: column;
  // justify-content: space-between;
}

      .slot-left {
        width: 100%;
        text-align: left;
      }

      .slot-center {
        width: 100%;
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
      }

      .slot-empty .slot-inner {
        visibility: hidden;
      }

      /* ===== TEXT STYLES ===== */
      .store {
        font-size: 6pt;
        font-weight: 700;
        // line-height: 1;
      }


      .prod {
  font-size: 5pt;
  font-weight: 650;

  display: -webkit-box;
  -webkit-line-clamp: 2;        /* ✅ max 2 lines */
  -webkit-box-orient: vertical;

  overflow: hidden;
  text-overflow: ellipsis;

  word-break: break-word;       /* ✅ Tamil support */
  overflow-wrap: anywhere;

  text-align: left;           /* ✅ center align */
  line-height: 1.2;
max-height: 2.4em;
}

      .barcode {
        width: 100%;
        display: flex;
        justify-content: center;
        // margin: 2px 0;
 
      }

.barcode img {
  max-width: 100%;
  height: 7mm;
  object-fit: contain;
  display: block;
}


 .rand {
  font-size: 6pt;
  font-weight: 800;
  line-height: 1;     /* 🔥 tight */
  margin: 0;
}

.rate {
  font-size: 5pt;
  font-weight: 700;
  line-height: 1;     /* 🔥 tight */
  margin: 0;
}

 
    </style>
  </head>

  <body>
    ${gridHtml}

    <script>
      window.onload = () => {
        setTimeout(() => { window.print(); }, 150);
      };

      function escapeHtml(s) {
        if (!s) return "";
        return s.replace(/[&<>"]/g, c =>
          ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;' }[c])
        );
      }
    </script>
  </body>
</html>
`;



    const win = window.open("", "_blank", "toolbar=0,status=0,width=700,height=600");
    if (!win) { alert("Popup blocked - allow popups for this site to print labels."); return; }
    win.document.open();
    win.document.write(html);
    win.document.close();

    function escapeHtml(s) {
      if (!s) return "";
      return s.replace(/[&<>"]/g, function (c) { return ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]); });
    }
  };



  const validateMaxLength = (name, value, max = 50) => {
    if (value.length > max) {
      setFormErrors((prev) => ({
        ...prev,
        [name]: `Maximum ${max} characters allowed`,
      }));

      setTimeout(() => {
        setFormErrors((prev) => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
        });
      }, 3000);

      return false;
    }

    setFormErrors((prev) => {
      const copy = { ...prev };
      delete copy[name];
      return copy;
    });

    return true;
  };


  const CharCounter = ({ value = "", max = 50, show }) => {
    if (!show) return null;

    return (
      <span className="absolute bottom-1 right-2 text-xs text-gray-400">
        {value.length}/{max}
      </span>
    );
  };



  const tamilKeys = [
    "அ", "ஆ", "இ", "ஈ", "உ", "ஊ",
    "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ",
    "க", "ங", "ச", "ஞ", "ட", "ண",
    "த", "ந", "ப", "ம", "ய", "ர",
    "ல", "வ", "ழ", "ள", "ற", "ன",
    "ஷ", "ஸ", "ஹ",
    "்", "ா", "ி", "ீ", "ு", "ூ", "ெ", "ே", "ை", "ொ", "ோ", "ௌ"
  ];

  const insertTamilAtCursor = (letter) => {
    const input = tamilInputRef.current;
    if (!input) return;

    const start = input.selectionStart;
    const end = input.selectionEnd;

    // Backspace support
    if (letter === "BACKSPACE") {
      if (start === end && start > 0) {
        const updated =
          form.name.slice(0, start - 1) + form.name.slice(end);

        setForm((prev) => ({
          ...prev,
          name: updated,
        }));

        requestAnimationFrame(() => {
          input.selectionStart = input.selectionEnd = start - 1;
          input.focus();
        });
      }
      return;
    }

    const updated =
      form.name.slice(0, start) +
      letter +
      form.name.slice(end);

    setForm((prev) => ({
      ...prev,
      name: updated,
    }));

    requestAnimationFrame(() => {
      input.selectionStart = input.selectionEnd = start + letter.length;
      input.focus();
    });
  };

  const toggleTamilMode = () => {
    if (isTamilMode) {
      setIsTamilMode(false);
      setShowTamilKeyboard(false);
    } else {
      setIsTamilMode(true);
      setShowTamilKeyboard(true);
    }
  };




  const TamilKeyboard = ({ onClose }) => {




    const keys = [
      // Uyir (Vowels)
      "அ", "ஆ", "இ", "ஈ", "உ", "ஊ",
      "எ", "ஏ", "ஐ", "ஒ", "ஓ", "ஔ",

      // Mei (Consonants)
      "க", "ங", "ச", "ஞ", "ட", "ண",
      "த", "ந", "ப", "ம", "ய", "ர",
      "ல", "வ", "ழ", "ள", "ற", "ன",

      // Grantha letters
      "ஜ", "ஷ", "ஸ", "ஹ", "க்ஷ", "ஸ்ரீ",

      // Special symbols
      "ஃ",

      // Uyir-mei modifiers
      "்", "ா", "ி", "ீ", "ு", "ூ", "ெ", "ே", "ை", "ொ", "ோ", "ௌ",

      // // Tamil numbers (optional)
      // "௦", "௧", "௨", "௩", "௪", "௫", "௬", "௭", "௮", "௯"
    ];

    return (
      <div
        className="absolute z-50 w-full bg-white border border-gray-300 rounded-md shadow-lg p-3 mt-1"
        onMouseDown={(e) => e.stopPropagation()}
      >

        <div className="flex flex-wrap gap-1 justify-center">

          {keys.map((k) => (
            <button
              key={k}
              type="button"
              className="px-2 py-1 bg-green-100 hover:bg-green-200 rounded text-xs font-semibold"
              onMouseDown={(e) => {
                e.preventDefault();
                insertTamilAtCursor(k);
              }}
            >
              {k}
            </button>
          ))}

        </div>

        <div className="flex justify-between mt-3">

          <button
            type="button"
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
            onMouseDown={(e) => {
              e.preventDefault();
              insertTamilAtCursor("BACKSPACE");
            }}
          >
            Backspace
          </button>

          <button
            type="button"
            className="px-3 py-1 bg-gray-500 text-white rounded text-sm"
            onMouseDown={(e) => {
              e.preventDefault();
              onClose();
            }}
          >
            Close
          </button>

        </div>

      </div>
    );
  };


  useEffect(() => {
    const handleClickOutside = (e) => {
      if (!tamilWrapperRef.current) return;

      if (!tamilWrapperRef.current.contains(e.target)) {
        setShowTamilKeyboard(false);   // close keyboard only
        setIsTamilMode(false);         // switch back to English
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);



  useEffect(() => {
    const handleClickOutside = (e) => {
      if (
        categoryDropdownRef.current &&
        !categoryDropdownRef.current.contains(e.target)
      ) {
        setShowCategoryList(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);
  return (


    <div className="products-page p-8 pt-10 sm:pt-10">



      {/* Header */}
      <div className="products-header">
        <h1 className="title">Products</h1>

        <button className="btn btn-primary" onClick={openCreate}>
          <FaPlus /> Create Product
        </button>


      </div>


      <div className="products-toolbar flex items-center gap-2">

        {/* Search Input */}
        <input
          className="!w-[350px] !md:w-[350px] h-8 text-sm border border-gray-300 rounded-md px-2 
               focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867]
               placeholder-gray-400 transition"
          type="text"
          placeholder="Search by Product Code / Name / Category"
          value={search}
          onChange={(e) => {
            const val = e.target.value;
            setSearch(val);
            fetchProducts(1, val, statusFilter, taxFilter);
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
          <option value="all">Status: All</option>
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
          <table className="table clean" style={{ width: "100%", borderCollapse: "collapse", tableLayout: "fixed" }}>
            <thead>
              <tr style={{ backgroundColor: "#007867", color: "#fff", textAlign: "left" }}>
                <th style={{ padding: "0.75rem", width: "70px" }}>S.No</th>
                <th style={{ padding: "0.75rem", width: "90px" }}>Product Code</th>
                <th style={{ padding: "0.75rem", width: "280px" }}>Product Name</th>
                <th style={{ padding: "0.75rem", width: "160px" }}>Category</th>
                <th style={{ padding: "0.75rem", width: "60px", textAlign: "center" }}>Qty</th>
                <th style={{ padding: "0.75rem", width: "60px", textAlign: "center" }}>Min Qty</th>

                {/* TAX HEADER — 2-LINE HEADER WITH SPLIT COLUMNS */}
                <th style={{ padding: 0, textAlign: "center", width: "140px" }}>
                  <div>
                    Tax
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "1fr 0.2fr 1fr",
                      alignItems: "center",
                      textAlign: "center",
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

                <th style={{ padding: "0.75rem", width: "120px" }}>Status</th>
                <th style={{ padding: "0.75rem", width: "100px" }} className="text-center">Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" style={{ textAlign: "center", padding: "1rem", color: "#777" }}>
                    No products found
                  </td>
                </tr>
              ) : (
                Object.values(
                  filtered.reduce((acc, product) => {
                    const { code, name, category, batches = [], minQty = 0, status = "active" } = product;
                    if (!acc[code]) acc[code] = {
                      code, name, category, shortName: product.shortName || "", batches: [], minQty, status, taxPercent: product.taxPercent,
                      taxMode: product.taxMode,
                    };
                    batches.forEach((batch) => acc[code].batches.push(batch));
                    return acc;
                  }, {})
                )
                  .sort((a, b) => {
                    if ((a.status || "active") === (b.status || "active")) return 0;
                    return a.status === "active" ? -1 : 1;
                  })
                  .map((p, idx) => {
                    const totalQty = p.batches.reduce((sum, b) => sum + Number(b.qty || 0), 0);
                    const isLow = totalQty <= p.minQty;
                    const isDisabled = p.status === "disabled";

                    return (
                      <tr key={p.code} className="fade-in" style={{ transition: "all 0.3s ease" }}>
                        <td style={{ padding: "0.5rem" }}>{(page - 1) * limit + idx + 1}</td>
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

                        <td
                          style={{
                            padding: "0.5rem",
                            color: isLow ? "#FF4C4C" : "#000",
                            fontWeight: isLow ? "bold" : "normal",
                            textAlign: "center"
                          }}
                        >
                          {totalQty}
                        </td>

                        <td style={{ padding: "0.5rem", textAlign: "center" }}>{p.minQty}</td>

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

                        {/* ACTION BUTTONS */}
                        <td style={{ padding: "0.5rem", textAlign: "center" }}>
                          <button
                            onClick={() => openView(p)}
                            title="View"
                            style={{
                              border: "none",
                              backgroundColor: "#00A76F",
                              color: "#fff",
                              padding: "0.5rem 0.75rem",
                              borderRadius: "0.5rem",
                              cursor: "pointer",
                              marginRight: "0.5rem",
                            }}
                          >
                            <FaEye />
                          </button>

                          {p.status !== "disabled" && (
                            <button
                              // onClick={() => setEditBatch(p)}
                              onClick={() => openEditProduct(p)}
                              title="Edit Min Qty"
                              style={{
                                border: "none",
                                backgroundColor: "#f59e0b",
                                color: "#fff",
                                padding: "0.5rem 0.75rem",
                                borderRadius: "0.5rem",
                                cursor: "pointer",
                                marginRight: "0.5rem",
                              }}
                            >
                              <FaEdit />
                            </button>
                          )}
                        </td>
                      </tr>
                    );
                  })
              )}
            </tbody>
          </table>
        </div>

        <div>
          <Pagination
            page={page}
            totalPages={totalPages}
            onPageChange={(p) => fetchProducts(p, search)}
          />
        </div>
      </div>




      {editBatch && (
        <Modal
          onClose={() => setEditBatch(null)}
          title="Edit Product Details"
          width="520px"
        >
          <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
            <div className="space-y-5 text-sm">

              {/* Product Code */}
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-gray-600 font-medium">Product Code</span>
                <span className="col-span-2 font-semibold text-gray-900">
                  {editBatch.code}
                </span>
              </div>

              {/* Product Name */}
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-gray-600 font-medium">Product Name</span>
                <span className="col-span-2 font-semibold text-gray-900">
                  {editBatch.name}
                </span>
              </div>

              {/* Min Qty */}
              {/* <div className="grid grid-cols-3 items-center gap-4">
              <span className="text-gray-600 font-medium">Minimum Qty</span>

              <input
                type="number"
                min="0"
                value={editBatch.minQty === 0 ? "" : editBatch.minQty}
                onChange={(e) =>
                  setEditBatch((prev) => ({
                    ...prev,
                    minQty: e.target.value === "" ? "" : Number(e.target.value),
                  }))
                }
                onBlur={(e) => {
                  if (e.target.value === "") {
                    setEditBatch((prev) => ({
                      ...prev,
                      minQty: 0,
                    }));
                  }
                }}
                className="col-span-2 w-28 px-3 py-2 rounded-md border border-gray-300
                     focus:outline-none focus:ring-2 focus:ring-[#007867]
                     focus:border-[#007867] no-spin"
              />
            </div> */}

              <div className="grid grid-cols-3 items-start gap-4 relative">
                <span className="text-gray-600 font-medium">Minimum Qty</span>

                <div className="col-span-2 relative flex flex-col">
                  <input
                    type="number"

                    min="0"
                    value={editBatch.minQty === 0 ? "" : editBatch.minQty}

                    onFocus={() => setActiveField("minQty")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = e.target.value;

                      if (validateMaxLength("minQty", val, 7)) {
                        setEditBatch((prev) => ({
                          ...prev,
                          minQty: val === "" ? "" : Number(val),
                        }));
                      }
                    }}
                    className={`w-28 px-3 py-2 rounded-md border
        ${editErrors.minQty ? "border-red-500" : "border-gray-300"}
        focus:outline-none focus:ring-2 focus:ring-[#007867]
        focus:border-[#007867] no-spin`}
                  />

                  {/* Character Counter */}
                  <CharCounter
                    value={String(editBatch.minQty || "")}
                    max={7}
                    show={activeField === "minQty"}
                  />

                  {/* Error Message */}
                  {editErrors.minQty && (
                    <span className="text-red-600 text-xs mt-1">
                      {editErrors.minQty}
                    </span>
                  )}
                </div>
              </div>


              {/* Status */}
              <div className="grid grid-cols-3 items-center gap-4">
                <span className="text-gray-600 font-medium">Status</span>

                <div className="col-span-2 flex items-center gap-3">
                  <select
                    value={editBatch.status || "active"}
                    onChange={(e) =>
                      setEditBatch((prev) => ({
                        ...prev,
                        status: e.target.value,
                      }))
                    }
                    className="px-3 py-2 rounded-md border border-gray-300
                       focus:outline-none focus:ring-2 focus:ring-[#007867]
                       focus:border-[#007867]"
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>

                  {/* Status Preview */}
                  {editBatch.status === "disabled" ? (
                    <span className="inline-flex items-center gap-1 text-red-600 font-semibold">
                      <FaBan /> Disabled
                    </span>
                  ) : (
                    <span className="inline-flex items-center gap-1 text-green-700 font-semibold">
                      <FaCheckCircle /> Active
                    </span>
                  )}
                </div>
              </div>

              {/* Footer */}
              <div className="border-t pt-4 mt-6 flex justify-end gap-3">


                {/* <button
                  type="button"
                  // className="px-5 py-2 rounded-md bg-[#007867] text-white
                  //            font-semibold hover:bg-[#006457] transition"



                  className="inline-flex items-center gap-2 px-4 py-2 
             rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0 "
                  onClick={async () => {
                    await saveProductDetails(editBatch);
                    setEditBatch(null);
                  }}
                >
                  Save Changes
                </button> */}

                <button
                  type="button"
                  disabled={saving || Object.keys(editErrors).length > 0}
                  className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg
    font-semibold text-[#007867] bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    transition-all duration-150
    ${saving || Object.keys(editErrors).length > 0
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:-translate-y-[1px]"
                    }`}
                  onClick={async () => {
                    if (Object.keys(editErrors).length > 0) return;

                    await saveProductDetails({
                      code: editBatch.code,
                      minQty: editBatch.minQty,
                      status: editBatch.status,
                      taxPercent: editBatch.taxPercent,
                      taxMode: editBatch.taxMode,
                    });
                    setEditBatch(null);
                  }}
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>

              </div>
            </div>
          </div>
        </Modal>
      )}




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

      {/* 🔹 Barcode Modal (updated) */}
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


              <div
                style={{
                  marginTop: "0.6rem",
                  display: "flex",
                  gap: "0.5rem",
                  alignItems: "center",
                  justifyContent: "space-between",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: "0.4rem" }}>
                  <label style={{ fontSize: "0.85rem" }}>Copies</label>

                  <input
                    type="number"
                    min="1"
                    defaultValue={1}
                    id="print-qty-input"
                    onWheel={(e) => e.target.blur()}
                    onKeyDown={(e) =>
                      ["ArrowUp", "ArrowDown"].includes(e.key)
                        ? e.preventDefault()
                        : null
                    }
                    style={{
                      width: "4.5rem",
                      padding: "0.25rem 0.4rem",
                      borderRadius: "0.3rem",
                      border: "1px solid #ccc",
                    }}
                  />
                </div>

                <div style={{ textAlign: "right" }}>
                  <button



                    className="inline-flex items-center justify-center gap-2 px-4 py-2 
         rounded-lg     
    font-semibold
    text-[#007867]
    bg-[#c8fad6]     
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
        
    transition-all duration-150
    hover:-translate-y-[1px]    
    active:translate-y-0      "


                    onClick={() => {
                      const qtyInput = document.getElementById("print-qty-input");
                      let quantity = parseInt(qtyInput?.value || "1", 10);
                      if (quantity < 1) quantity = 1;

                      openBarcodePrintWindow(selectedBarcode, quantity);
                      closeBarcodeModal();
                    }}

                  >
                    Print Barcode
                  </button>
                </div>
              </div>
            </div>
          </div>
        </Modal>
      )}




      {batchEditModal && (
        <BatchStatusModal
          productCode={batchEditModal.productCode}
          productName={batchEditModal.productName}
          batch={batchEditModal.batch}
          onClose={() => setBatchEditModal(null)}
          onSave={async (newStatus) => {
            const { productCode, batch } = batchEditModal;

            // Update backend
            await toggleBatchStatus({
              code: productCode,
              batchNo: batch.batchNo,
              status: newStatus.toLowerCase(),
            });


            // Update UI instantly
            setShowViewModal((prev) => ({
              ...prev,
              batches: prev.batches.map((bx) =>
                bx.batchNo === batch.batchNo ? { ...bx, status: newStatus } : bx
              ),
            }));

            setBatchEditModal(null);
          }}
        />
      )}








      {/* Create Product Modal */}
      {showCreateModal && (
        <Modal onClose={closeCreate} title={editMode ? "Edit Product" : "Create Product"}>
          <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
            <form onSubmit={onCreate} className="product-form" autoComplete="off">
              <div className="form-grid">

                <div className="form-col">

                  {/* Product Code */}
                  <div className="form-row wide relative" style={{ position: "relative" }}>
                    {/* <label>Product Code</label> */}
                    <RequiredLabel>Product Code</RequiredLabel>
                    <input
                      className="input"
                      value={form.code || ""}
                      onChange={(e) => onCodeChange(e.target.value)}
                      onFocus={() =>
                        form.code || uniqueCodeSuggestions.length > 0
                          ? setShowCodeSuggestions(true)
                          : null
                      }
                      onBlur={() => setTimeout(() => setShowCodeSuggestions(false), 150)}
                      onKeyDown={(e) => {
                        if (!showCodeSuggestions || uniqueCodeSuggestions.length === 0) return;
                        if (e.key === "ArrowDown") {
                          e.preventDefault();
                          setCodeHighlightIndex((i) =>
                            i < uniqueCodeSuggestions.length - 1 ? i + 1 : 0
                          );
                        } else if (e.key === "ArrowUp") {
                          e.preventDefault();
                          setCodeHighlightIndex((i) =>
                            i > 0 ? i - 1 : uniqueCodeSuggestions.length - 1
                          );
                        } else if (e.key === "Enter") {
                          e.preventDefault();
                          const selected = uniqueCodeSuggestions[codeHighlightIndex];
                          if (selected) selectCodeSuggestion(selected);
                          setShowCodeSuggestions(false);
                        } else if (e.key === "Escape") {
                          setShowCodeSuggestions(false);
                        }
                      }}
                      placeholder="Enter a Product Code"
                      style={{
                        width: "100%",
                        padding: "0.5rem 0.75rem",
                        border: "1px solid #ccc",
                        borderRadius: "0.5rem",
                        fontSize: "1rem",
                      }}
                      readOnly
                    />

                  </div>


                  <div className="form-row flex flex-col">
                    {/* <RequiredLabel>Short Name</RequiredLabel> */}
                    <label htmlFor="">Short Name</label>

                    <input
                      className={`input pr-10 pb-5 border 
      ${formErrors.shortName ? "border-red-500" : "border-gray-300"}`}
                      value={form.shortName ?? ""}

                      onFocus={() => setActiveField("shortName")}
                      onBlur={() => setActiveField(null)}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (validateMaxLength("shortName", val, 100)) {
                          setForm((f) => ({ ...f, shortName: val }));
                        }
                      }}
                      placeholder="Enter a Short Name"
                    />

                    <CharCounter
                      value={form.shortName}
                      max={100}
                      show={activeField === "shortName"}
                    />

                    {formErrors.shortName && (
                      <span className="text-red-600 text-xs mt-1">
                        {formErrors.shortName}
                      </span>
                    )}
                  </div>

                  <div className="form-row relative flex flex-col">
                    <RequiredLabel>Minimum Qty</RequiredLabel>
                    <input
                      className={`input pr-10 pb-5 border ${formErrors.minQty ? "border-red-500" : "border-gray-300"
                        }`}
                      type="number"
                      // value={isExistingProduct ? existingMinQty : form.minQty || ""}
                      value={editMode ? form.minQty ?? "" : (isExistingProduct ? existingMinQty : form.minQty || "")}
                      // onChange={(e) =>
                      //   !isExistingProduct && setForm((f) => ({ ...f, minQty: e.target.value }))
                      // }

                      onChange={(e) => {
                        const val = e.target.value;

                        if (!isExistingProduct) {
                          if (validateMaxLength("minQty", val, 10)) {
                            setForm((f) => ({ ...f, minQty: val }));
                          }
                        }
                      }}
                      disabled={isExistingProduct}
                      placeholder="Enter a Minimum Qty"
                      onFocus={(e) => {
                        setActiveField("minQty");

                        e.target.addEventListener("wheel", (event) => event.preventDefault(), {
                          passive: false,
                        });
                      }}
                      onBlur={(e) => {
                        setActiveField(null);
                        e.target.removeEventListener("wheel", (event) => event.preventDefault());
                      }}

                    />



                    {formErrors.minQty && (
                      <span className="text-red-600 text-xs mt-1">
                        {formErrors.minQty}
                      </span>
                    )}
                  </div>




                </div>

                <div className="form-col  ">


                  <div className="form-row wide relative flex flex-col" ref={tamilWrapperRef}>

                    {/* Label + Tamil toggle */}
                    <div className="flex justify-between items-center mb-1">
                      <RequiredLabel>Product Name</RequiredLabel>

                      <button
                        type="button"
                        onClick={toggleTamilMode}
                        className="text-sm text-green-400 font-semibold hover:underline"
                      >
                        {isTamilMode ? "English" : "தமிழ்"}
                      </button>
                    </div>

                    {/* Input */}
                    <input
                      ref={tamilInputRef}
                      className={`input pb-5 ${formErrors.name ? "border-red-500" : ""}`}
                      value={form.name}
                      onChange={(e) => {
                        const val = e.target.value;
                        if (validateMaxLength("name", val, 100)) {
                          setForm((f) => ({ ...f, name: val }));
                        }
                      }}
                      onFocus={() => setActiveField("name")}
                      onBlur={() => setActiveField(null)}
                      placeholder="Enter a Product Name"
                    />

                    <CharCounter
                      value={form.name}
                      max={100}
                      show={activeField === "name"}
                    />

                    {formErrors.name && (
                      <span className="text-red-600 text-xs mt-1">
                        {formErrors.name}
                      </span>
                    )}

                    {/* Tamil keyboard dropdown */}
                    {showTamilKeyboard && (
                      <div className="relative mt-2">
                        <TamilKeyboard
                          onClose={() => {
                            setShowTamilKeyboard(false);
                            setIsTamilMode(false);
                          }}
                        />
                      </div>
                    )}

                  </div>


                  <div className="form-row with-action">
                    <div className="label-row">
                      <RequiredLabel>Category</RequiredLabel>

                      <button
                        type="button"
                        className="link-action"
                        onClick={openCategoryModal}
                        title="Add Category"
                      >
                        + Category
                      </button>
                    </div>

                    <div className="category-dropdown" ref={categoryDropdownRef}>

                      {/* Selected value */}
                      <div
                        className="dropdown-input"
                        onClick={() => setShowCategoryList((prev) => !prev)}
                      >
                        {form.category || "Select category"}
                        <FaChevronDown className="chev" />
                      </div>

                      {/* Dropdown list */}
                      {showCategoryList && (
                        <div className="dropdown-list">
                          {categories.map((c) => (
                            <div
                              key={c}
                              className={`dropdown-item ${form.category === c ? "active" : ""
                                }`}
                              onClick={() => {
                                setForm((f) => ({ ...f, category: c }));
                                setShowCategoryList(false);
                              }}
                            >
                              {c}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  </div>




                  <div className="form-row wide relative flex flex-col">
                    <RequiredLabel> Tax %</RequiredLabel>

                    <input
                      className={`input pr-10 pb-5 ${formErrors.taxPercent ? "border-red-500" : ""
                        }`}
                      type="number"
                      inputMode="decimal"
                      placeholder="Enter Tax %"
                      value={form.taxPercent ?? ""}
                      maxLength={5}
                      onFocus={(e) => {
                        setActiveField("taxPercent");
                        enableWheelBlock(e);
                      }}

                      onChange={(e) => {
                        const val = e.target.value;

                        // Prevent more than 100%
                        if (Number(val) > 100) {
                          setFormErrors((prev) => ({
                            ...prev,
                            taxPercent: "Tax cannot exceed 100%",
                          }));

                          setTimeout(() => {
                            setFormErrors((prev) => {
                              const copy = { ...prev };
                              delete copy.taxPercent;
                              return copy;
                            });
                          }, 3000);

                          return;
                        }

                        // Apply max length validation (5 digits max)
                        if (validateMaxLength("taxPercent", val, 3)) {
                          setForm((f) => ({ ...f, taxPercent: val }));
                        }
                      }}

                      onBlur={(e) => {
                        disableWheelBlock();
                        setActiveField(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === "ArrowUp" || e.key === "ArrowDown") {
                          e.preventDefault();
                        }
                      }}
                    />




                    {/* Error Message */}
                    {formErrors.taxPercent && (
                      <span className="text-red-600 text-xs mt-1">
                        {formErrors.taxPercent}
                      </span>
                    )}
                  </div>

                </div>
              </div>





              {/* TAX MODE */}
              <div
                className="tax-mode"
                style={{ display: "flex", gap: "0.5rem", flexWrap: "nowrap", flexDirection: "column" }}
              >
                {/* LABEL ABOVE */}


                <RequiredLabel>  <span style={{ fontWeight: 300 }}>Tax Mode</span></RequiredLabel>

                {/* TOGGLE */}
                <div className="w-1/2 min-w-[240px] flex bg-gray-100 rounded-full p-1">
                  {/* INCLUSIVE */}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, taxMode: "inclusive" }))
                    }
                    className={`
        w-1/2 text-center px-4 py-1 text-sm rounded-full transition-all
        ${form.taxMode === "inclusive"
                        ? "bg-[#c8fad6] text-[#007867] shadow"
                        : "text-gray-700"
                      }
      `}
                  >
                    Inclusive
                  </button>

                  {/* EXCLUSIVE */}
                  <button
                    type="button"
                    onClick={() =>
                      setForm((f) => ({ ...f, taxMode: "exclusive" }))
                    }
                    className={`
        w-1/2 text-center px-4 py-1 text-sm rounded-full transition-all
        ${form.taxMode === "exclusive"
                        ? "bg-[#c8fad6] text-[#007867] shadow"
                        : "text-gray-700"
                      }
      `}
                  >
                    Exclusive
                  </button>
                </div>
              </div>




              {/* STATUS (only for edit mode) */}
              {editMode && (
                <div className="form-row wide relative flex flex-col">
                  <RequiredLabel>Status</RequiredLabel>

                  <select
                    className="input"
                    value={form.status || "active"}
                    onChange={(e) =>
                      setForm((f) => ({ ...f, status: e.target.value }))
                    }
                  >
                    <option value="active">Active</option>
                    <option value="disabled">Disabled</option>
                  </select>
                </div>
              )}






              <div className="modal-actions">


                <button
                  type="submit"
                  disabled={saving}
                  className={`btn btn-primary flex items-center gap-2
    ${saving ? "opacity-70 cursor-not-allowed" : ""}
  `}
                >
                  {saving && (
                    <span className="w-4 h-4 border-2 border-green-700 border-t-transparent rounded-full animate-spin"></span>
                  )}
                  {saving
                    ? (editMode ? "Updating..." : "Creating...")
                    : (editMode ? "Update Product" : "Create Product")
                  }
                </button>

              </div>
            </form>
          </div>
        </Modal>
      )}

      {/* Category Modal */}
      {showCategoryModal && (
        // <Modal
        //   onClose={closeCategoryModal}
        //   title="Manage Categories"
        //   className="narrow-modal"
        //   style={{ width: "380px", maxWidth: "90%", margin: "0 auto" }}
        // >
        //   <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
        //     <div className="category-panel">
        //       <div className="category-add">
        //         <div className="relative flex flex-col w-full">
        //           <input
        //             className={`input pr-10 pb-5 ${formErrors.categoryDraft ? "border-red-500" : ""
        //               }`}
        //             placeholder="Type a category name"
        //             value={categoryDraft}

        //             onFocus={() => setActiveField("categoryDraft")}
        //             onBlur={() => setActiveField(null)}
        //             onChange={(e) => {
        //               const val = e.target.value;

        //               if (validateMaxLength("categoryDraft", val, 50)) {
        //                 setCategoryDraft(val);
        //               }
        //             }}

        //             onKeyDown={(e) => {
        //               if (e.key === "Enter" || e.key === "Tab") {
        //                 e.preventDefault();
        //                 addCategoryDraft();
        //               }
        //             }}
        //           />

        //           <CharCounter
        //             value={categoryDraft}
        //             max={50}
        //             show={activeField === "categoryDraft"}
        //           />


        //           {formErrors.categoryDraft && (
        //             <span className="text-red-600 text-xs mt-1">
        //               {formErrors.categoryDraft}
        //             </span>
        //           )}
        //         </div>

        //         <button
        //           type="button"
        //           className="btn btn-dark flex items-center gap-2"
        //           onClick={addCategoryDraft}
        //         >
        //           <FaPlus color="green" />
        //           <span className="text-green-500">Add</span>
        //         </button>
        //       </div>

        //       <div className="category-list">
        //         {categories.length === 0 ? (
        //           <p className="muted">No categories yet.</p>
        //         ) : (
        //           categories.map((c) => (
        //             <div key={c} className="chip">
        //               <span>{c}</span>



        //               <button
        //                 type="button"
        //                 className="chip-del"
        //                 title="Delete"
        //                 onClick={() => {
        //                   setDeleteTarget(c);
        //                   setShowDeleteModal(true);
        //                 }}
        //               >
        //                 <FaTrash color="red" />
        //               </button>


        //             </div>
        //           ))
        //         )}
        //       </div>
        //     </div>
        //   </div>
        // </Modal>




        <Modal
          onClose={closeCategoryModal}
          title="Manage Categories"
          className="narrow-modal"
          style={{ width: "500px", maxWidth: "90%", margin: "0 auto" }}
        >
          <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>

            {/* Added flex layout + height */}
            <div className="category-panel flex flex-col h-[320px]">

              {/* ✅ Scrollable Category List (moved UP) */}
              <div className="category-list flex-1 overflow-y-auto mb-2">
                {categories.length === 0 ? (
                  <p className="muted">No categories yet.</p>
                ) : (
                  categories.map((c) => (
                    <div key={c} className="chip">
                      <span>{c}</span>

                      <button
                        type="button"
                        className="chip-del"
                        title="Delete"
                        onClick={() => {
                          setDeleteTarget(c);
                          setShowDeleteModal(true);
                        }}
                      >
                        <FaTrash color="red" />
                      </button>
                    </div>
                  ))
                )}
              </div>

              {/* ✅ Input section (now fixed at bottom) */}
              <div className="category-add border-t pt-2">
                <div className="relative flex flex-col w-full">
                  <input
                    className={`input pr-10 pb-5 ${formErrors.categoryDraft ? "border-red-500" : ""
                      }`}
                    placeholder="Type a category name"
                    value={categoryDraft}
                    onFocus={() => setActiveField("categoryDraft")}
                    onBlur={() => setActiveField(null)}
                    onChange={(e) => {
                      const val = e.target.value;

                      if (validateMaxLength("categoryDraft", val, 50)) {
                        setCategoryDraft(val);
                      }
                    }}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === "Tab") {
                        e.preventDefault();
                        addCategoryDraft();
                      }
                    }}
                  />

                  <CharCounter
                    value={categoryDraft}
                    max={50}
                    show={activeField === "categoryDraft"}
                  />

                  {formErrors.categoryDraft && (
                    <span className="text-red-600 text-xs mt-1">
                      {formErrors.categoryDraft}
                    </span>
                  )}
                </div>

                <button
                  type="button"
                  className="btn btn-dark flex items-center gap-2 mt-2"
                  onClick={addCategoryDraft}
                >
                  <FaPlus color="green" />
                  <span className="text-green-500">Add</span>
                </button>
              </div>

            </div>
          </div>
        </Modal>
      )
      }



      {
        showDeleteModal && (
          <Modal
            onClose={() => setShowDeleteModal(false)}
            title="Confirm Delete"
            style={{ width: "350px", maxWidth: "90%", margin: "0 auto" }}
          >
            <p className="text-sm mb-4">
              Are you sure you want to delete the category:
              <strong> {deleteTarget}</strong>?
            </p>

            <div className="flex justify-end gap-3">
              <button
                type="button"
                className="btn btn-light"
                onClick={() => setShowDeleteModal(false)}
              >
                Cancel
              </button>

              <button
                type="button"
                className="btn btn-dark text-red-500"
                onClick={() => {
                  removeCategory(deleteTarget);
                  setShowDeleteModal(false);
                }}
              >
                Delete
              </button>
            </div>
          </Modal>
        )
      }



    </div >



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
    <div className="modal-overlay">
      <div
        className={`modal-card slide-up ${className}`}
        style={{ width: width || "800px", ...style }}
      >
        <div className="modal-header">
          <h3>{title}</h3>

          <button
            className="icon-close"
            onClick={onClose}
            aria-label="Close"
          >
            <FaTimes />
          </button>

        </div>

        <div className="modal-body">{children}</div>
      </div>
    </div>
  );
}




const RequiredLabel = ({ children }) => (
  <label className="flex items-center gap-1 font-medium">
    <span>{children}</span>
    <span className="text-red-500">*</span>
  </label>
);






















