









// src/pages/purchase/addpurchase.jsx
import React, { useCallback, useEffect, useRef, useState } from "react";
import { FaArrowLeft, FaPlus, FaTrash, FaEdit, FaCheck, FaTimes } from "react-icons/fa";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../utils/apiClient";
import { getApiUrl } from "../../utils/api";
import clsx from "clsx";
import { createPortal } from "react-dom";


/* -------------------------
   Helpers
   ------------------------- */
const createEmptyRow = (idSeed = Math.random().toString(36).slice(2, 9)) => ({
  id: idSeed,
  code: "",
  name: "",
  batch: "",
  mrp: 0,
  rate: 0,
  gst: 0,
  taxMode: "exclusive",
  isInclusive: false,
  qty: "",
  value: 0,
  isNew: true, // true until saved locally with plus
});

const formatCurrency = (n = 0) => Number(n || 0).toFixed(2);

/* Tax calculation:
   - If inclusive: rate includes tax. For display compute base and tax portion.
   - If exclusive: tax is added on top of rate.
*/
const calcRowValues = (row) => {
  const rate = Number(row.rate || 0);
  const gst = Number(row.gst || 0);
  const qty = Number(row.qty || 0);
  const mode = (row.taxMode || "exclusive").toLowerCase();
  let base = rate;
  let taxAmtPerUnit = 0;
  let totalPerUnit = rate;

  if (mode === "inclusive") {
    // rate = base + tax, so base = rate / (1 + gst/100)
    const denom = 1 + gst / 100;
    base = denom > 0 ? rate / denom : rate;
    taxAmtPerUnit = rate - base;
    totalPerUnit = rate;
  } else {
    // exclusive
    base = rate;
    taxAmtPerUnit = (base * gst) / 100;
    totalPerUnit = base + taxAmtPerUnit;
  }

  const value = qty * totalPerUnit;
  return {
    base,
    taxAmtPerUnit,
    totalPerUnit,
    value,
  };
};


const formatDDMMYYYY = (date = new Date()) => {
  const d = String(date.getDate()).padStart(2, "0");
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const y = date.getFullYear();
  return `${d}/${m}/${y}`;
};



/* -------------------------
   Component
   ------------------------- */
export default function AddPurchase() {
  const navigate = useNavigate();
  const { user } = useAuth();

  const getApiPath = (endpoint) => {
    const ep = endpoint.replace(/^\//, "");
    return getApiUrl(ep, user, user?.shopname);
  };

  /* -------------------------
     Purchase Card state
     ------------------------- */
  const [orderNo, setOrderNo] = useState("");
  const [supplierId, setSupplierId] = useState("");
  const [supplierName, setSupplierName] = useState("");
  const [supplierMobile, setSupplierMobile] = useState("");
  const [invoiceNo, setInvoiceNo] = useState("");
  const [invoiceDate, setInvoiceDate] = useState("");
  // const [stockedDate, setStockedDate] = useState("");
  const [stockedDate, setStockedDate] = useState(() =>
    formatDDMMYYYY(new Date())
  );

  const [noOfItems, setNoOfItems] = useState("");
  const [totalAmount, setTotalAmount] = useState("");

  const [errors, setErrors] = useState({});
  const [toast, setToast] = useState(null);

  /* Supplier suggestions */
  const [supplierQuery, setSupplierQuery] = useState("");
  const [supplierSuggestions, setSupplierSuggestions] = useState([]);
  const [showSupplierDropdown, setShowSupplierDropdown] = useState(false);

  const mountedRef = useRef(true);
  const supplierDebounce = useRef(null);
  const dropdownSupplierRef = useRef(null);

  /* -------------------------
     Batch Add Card state
     ------------------------- */
  const [rows, setRows] = useState([createEmptyRow()]);
  const rowsRef = useRef(rows);
  rowsRef.current = rows;

  const [editRowId, setEditRowId] = useState(null);
  const [codeQueryMap, setCodeQueryMap] = useState({}); // { rowId: query }
  const [nameQueryMap, setNameQueryMap] = useState({});
  const [codeSuggestions, setCodeSuggestions] = useState({}); // { rowId: [products] }
  const [nameSuggestions, setNameSuggestions] = useState({});
  const [showCodeList, setShowCodeList] = useState({});
  const [showNameList, setShowNameList] = useState({});
  const [batchesByRow, setBatchesByRow] = useState({}); // for batch dropdown suggestions
  const [showBatchList, setShowBatchList] = useState({});

  const [filteredBatches, setFilteredBatches] = useState({});

  const suggestionsDebounce = useRef({}); // keyed by `${type}_${rowId}`
  const suggestionRefs = useRef({}); // dom refs for click-outside

  /* Loading states */
  const [loadingProducts, setLoadingProducts] = useState(false);
  const [savingPurchase, setSavingPurchase] = useState(false);

  /* Products cache (fetch all) */
  const [products, setProducts] = useState([]);
  const productsRef = useRef(products);
  productsRef.current = products;

  const isSavingPurchaseRef = useRef(false);
  const [fieldErrors, setFieldErrors] = useState({});
  const [activeField, setActiveField] = useState(null);





  /* -------------------------
     fetchProducts — ACTIVE PRODUCTS ONLY (limit=0)
     ------------------------- */
  const fetchProducts = useCallback(async () => {
    try {
      setLoadingProducts(true);

      const res = await apiClient.get("/api/products/active?limit=0");

      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.products)
          ? res.data.products
          : [];

      // normalize (safe for purchase + batch UI)
      const normalized = list.map((p) => ({
        ...p,
        batches: (Array.isArray(p.batches) ? p.batches : []).map((b) => ({
          batchNo: b.batchNo || "",
          qty: Number(b.qty ?? 0),

          mrp: Number(b.mrp ?? 0),
          salePrice: Number(b.salePrice ?? b.rate ?? 0),

          randomCode: b.randomCode || "",
          barcode: b.barcode || "",
          ean: b.ean || "",

          // ⭐ ALWAYS PRODUCT TAX
          taxPercent: Number(p.taxPercent ?? 0),
          taxMode: (p.taxMode || "exclusive").toLowerCase(),

          status: b.status || "active",
        })),
      }));

      setProducts(normalized);
    } catch (err) {
      console.error("Failed to fetch active products", err);
      setProducts([]);
    } finally {
      setLoadingProducts(false);
    }
  }, []);


  useEffect(() => {
    mountedRef.current = true;
    fetchProducts();
    // fetch order no
    (async () => {
      try {
        const base = getApiPath("purchases/next-order-no");
        const res = await apiClient.get(base);
        const next =
          res?.data?.nextOrderNo ||
          res?.data?.data?.nextOrderNo ||
          res?.data?.nextOrder ||
          res?.data?.data?.nextOrder;
        if (mountedRef.current && next) setOrderNo(next);
      } catch (err) {
        console.error("Order No fetch error", err);
      }
    })();

    return () => {
      mountedRef.current = false;
      clearTimeout(supplierDebounce.current);
      Object.values(suggestionsDebounce.current).forEach((t) => clearTimeout(t));
    };
  }, [fetchProducts]);

  /* -------------------------
     Toast helper
     ------------------------- */
  const showToast = (type, message) => {
    setToast({ type, message });
    setTimeout(() => setToast(null), 3000);
  };

  function Toast({ type = "success", message }) {
    return (
      <div
        style={{
          position: "fixed",
          top: 20,
          right: 20,
          background: type === "success" ? "#16a34a" : "#dc2626",
          color: "white",
          padding: "12px 18px",
          borderRadius: 8,
          fontSize: 14,
          zIndex: 9999,
          boxShadow: "0 6px 20px rgba(0,0,0,0.12)",
          transform: "translateY(0)",
          transition: "all 220ms ease",
        }}
      >
        {message}
      </div>
    );
  }


  /* -------------------------
     Supplier search (top card)
  ------------------------- */
  const searchSuppliers = async (text) => {
    if (!text || !text.trim()) {
      // 🔥 Hide dropdown if input is empty
      setSupplierSuggestions([]);
      setShowSupplierDropdown(false);
      return;
    }

    try {
      const base = getApiPath("suppliers");
      const url = `${base}?search=${encodeURIComponent(text)}&status=active&limit=10&page=1`;

      const res = await apiClient.get(url);
      const list =
        res?.data?.suppliers ||
        res?.data?.data?.suppliers ||
        [];

      const normalized = Array.isArray(list) ? list : [];

      setSupplierSuggestions(normalized);
      setShowSupplierDropdown(normalized.length > 0); // show only if results
    } catch (err) {
      console.error("Supplier search error", err);
      setSupplierSuggestions([]);
      setShowSupplierDropdown(false);
    }
  };

  const onSupplierType = (field, value) => {
    const trimmed = value || "";

    // Update fields
    if (field === "supplierId") {
      setSupplierId(trimmed);
      if (!trimmed.trim()) {
        setSupplierName("");
        setSupplierMobile("");
      }
    }
    if (field === "supplierName") {
      setSupplierName(trimmed);
      if (!trimmed.trim()) {
        setSupplierId("");
        setSupplierMobile("");
      }
    }
    if (field === "supplierMobile") {
      setSupplierMobile(trimmed);
      if (!trimmed.trim()) {
        setSupplierId("");
        setSupplierName("");
      }
    }

    setSupplierQuery(trimmed);

    // Always clear old debounce
    clearTimeout(supplierDebounce.current);

    // 🔥 If input empty → hide dropdown IMMEDIATELY
    if (!trimmed.trim()) {
      setSupplierSuggestions([]);
      setShowSupplierDropdown(false);
      return;
    }

    // Normal typing → debounce API request
    supplierDebounce.current = setTimeout(() => {
      searchSuppliers(trimmed.trim());
    }, 300);
  };


  const pickSupplier = (s) => {
    setSupplierId(s.supplierId || "");
    setSupplierName(s.name || "");
    setSupplierMobile(s.mobile || "");
    setSupplierQuery("");
    setSupplierSuggestions([]);
    setShowSupplierDropdown(false);
  };

  /* click outside supplier dropdown */
  useEffect(() => {
    const handleClick = (e) => {
      if (dropdownSupplierRef.current && !dropdownSupplierRef.current.contains(e.target)) {
        setShowSupplierDropdown(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);












  const ddmmyyyyToISO = (value) => {
    if (!value) return "";
    const [dd, mm, yyyy] = value.split("/");
    return `${yyyy}-${mm}-${dd}`;
  };


  /* -------------------------
   Prevent refresh while saving
------------------------- */
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (savingPurchase) {
        e.preventDefault();
        e.returnValue = "";
      }
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => window.removeEventListener("beforeunload", handleBeforeUnload);
  }, [savingPurchase]);


  const createPurchase = async () => {

    // ✅ Prevent multiple clicks safely
    if (savingPurchase) return;

    // Lock immediately
    setSavingPurchase(true);

    try {
      // -------------------------
      // Basic validation
      // -------------------------
      let hasError = false;

      if (!supplierName) {
        showToast("error", "Supplier name required");
        hasError = true;
      }

      if (!invoiceNo) {
        showToast("error", "Invoice no required");
        hasError = true;
      }

      if (!invoiceDate) {
        showToast("error", "Invoice date required");
        hasError = true;
      }

      if (!stockedDate) {
        showToast("error", "Stocked date required");
        hasError = true;
      }

      if (hasError) {
        return; // finally will unlock
      }

      // -------------------------
      // Collect saved rows
      // -------------------------
      const savedRows = (rowsRef.current || []).filter((r) => !r.isNew);

      if (!savedRows.length) {
        showToast("error", "Add at least one batch row (press + on a row)");
        return;
      }

      // -------------------------
      // Prepare batches
      // -------------------------
      const batches = savedRows.map((r) => {
        const calc = calcRowValues(r);
        return {
          code: r.code,
          name: r.name,
          batchNo: r.batch,
          mrp: Number(r.mrp || 0),
          rate: Number(r.rate || 0),
          gst: Number(r.gst || 0),
          taxMode: r.taxMode || "exclusive",
          qty: Number(r.qty || 0),
          value: Number(calc.value || 0),
        };
      });

      const computedTotal = batches.reduce(
        (acc, b) => acc + Number(b.value || 0),
        0
      );

      const computedItems = batches.length;

      const payload = {
        orderNo,
        supplierId,
        supplierName,
        supplierMobile,
        invoiceNo,
        invoiceDate,
        stockedDate: ddmmyyyyToISO(stockedDate),
        noOfItems: computedItems,
        totalAmount: computedTotal,
        batches,
      };

      // -------------------------
      // API Call
      // -------------------------
      const base = getApiPath("purchases");
      await apiClient.post(base, payload);

      showToast("success", "Purchase saved and batches updated");

      // -------------------------
      // Reset Form
      // -------------------------
      setSupplierId("");
      setSupplierName("");
      setSupplierMobile("");
      setInvoiceNo("");
      setInvoiceDate("");
      setStockedDate("");
      setNoOfItems("");
      setTotalAmount("");
      setSupplierQuery("");
      setSupplierSuggestions([]);
      setRows([createEmptyRow()]);

      // Refresh products
      try {
        await fetchProducts();
      } catch { }

      // Fetch next order no
      try {
        const res2 = await apiClient.get(
          getApiPath("purchases/next-order-no")
        );

        const next =
          res2?.data?.nextOrderNo ||
          res2?.data?.data?.nextOrderNo ||
          res2?.data?.nextOrder ||
          res2?.data?.data?.nextOrder;

        if (next) setOrderNo(next);
      } catch { }

    } catch (err) {
      console.error("Create purchase error", err);
      showToast(
        "error",
        err?.response?.data?.message || "Failed to save purchase"
      );
    } finally {
      // ✅ Always unlock
      setSavingPurchase(false);
    }
  };




  /* -------------------------
     Product Suggestions — ACTIVE ONLY
     ------------------------- */
  const fetchProductsSuggest = async (q) => {
    try {
      const url = `/api/products/active?search=${encodeURIComponent(q)}&limit=20`;
      const res = await apiClient.get(url);

      const list = Array.isArray(res?.data)
        ? res.data
        : Array.isArray(res?.data?.products)
          ? res.data.products
          : [];

      return list;
    } catch (err) {
      console.error("Active product suggest error", err);
      return [];
    }
  };



  const triggerSuggest = (type, rowId, query) => {
    const key = `${type}_${rowId}`;

    if (suggestionsDebounce.current[key]) {
      clearTimeout(suggestionsDebounce.current[key]);
    }

    if (!query || !query.trim()) {
      if (type === "code") {
        setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
        setShowCodeList((v) => ({ ...v, [rowId]: false }));
      } else {
        setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
        setShowNameList((v) => ({ ...v, [rowId]: false }));
      }
      return;
    }

    suggestionsDebounce.current[key] = setTimeout(async () => {
      if (!query.trim()) return;
      const list = await fetchProductsSuggest(query.trim());
      if (type === "code") {
        setCodeSuggestions((s) => ({ ...s, [rowId]: list }));
        setShowCodeList((v) => ({ ...v, [rowId]: list.length > 0 }));
      } else {
        setNameSuggestions((s) => ({ ...s, [rowId]: list }));
        setShowNameList((v) => ({ ...v, [rowId]: list.length > 0 }));
      }
    }, 300);
  };

  /* when selecting a product from suggestions, fill row fields,
     also prepare batch list for that product (existing batches) */
  const applyProductToRow = (rowId, product) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
            ...r,
            code: product.code || "",
            name: product.name || "",
            gst: Number(product.taxPercent || product.taxPercent === 0 ? product.taxPercent : 0),
            taxMode: (product.taxMode || "exclusive").toLowerCase(),
            isInclusive: ((product.taxMode || "exclusive").toLowerCase() === "inclusive"),
          }
          : r
      )
    );

    const batches = Array.isArray(product.batches) ? product.batches : [];
    setBatchesByRow((b) => ({ ...b, [rowId]: batches }));
    setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
    setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
    setShowCodeList((v) => ({ ...v, [rowId]: false }));
    setShowNameList((v) => ({ ...v, [rowId]: false }));
  };


  const applyBatchToRow = (rowId, batch) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
            ...r,

            // fill batch fields
            batch: batch.batchNo || r.batch,
            mrp: Number(batch.mrp || 0),
            rate: Number(batch.salePrice || batch.rate || 0),
            gst: Number(batch.taxPercent || r.gst || 0),
            taxMode: (batch.taxMode || r.taxMode || "exclusive").toLowerCase(),
            isInclusive: ((batch.taxMode || r.taxMode || "exclusive").toLowerCase() === "inclusive"),

            qty: "",

            // ⭐ IMPORTANT: Mark that this is an existing batch
            isExistingBatch: true,

            // ⭐ Keep the identity (helps your logic)
            randomCode: batch.randomCode || null,
            barcode: batch.barcode || null,
          }
          : r
      )
    );

    setShowBatchList((s) => ({ ...s, [rowId]: false }));
  };

  /* -------------------------
     Row operations: updateRow, addRow, deleteRow, saveRowEdit, cancelRowEdit
     ------------------------- */
  const updateRow = (rowId, field, value) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;
        const next = { ...r, [field]: value };

        // recompute derived values for qty/rate/gst/taxMode changes
        if (["qty", "rate", "gst", "taxMode"].includes(field)) {
          const calc = calcRowValues(next);
          next.value = calc.value;
          next.isInclusive = (next.taxMode || "exclusive").toLowerCase() === "inclusive";
        }

        return next;
      })
    );
  };

  const addRow = (fromRowId) => {
    // validate the row
    const row = rowsRef.current.find((r) => r.id === fromRowId);
    if (!row) return;
    if (!row.code || !row.name || !row.batch || Number(row.qty) <= 0 || Number(row.rate) <= 0) {
      showToast("error", "Fill required fields for the row");
      return;
    }

    // set isNew false for that row (becomes saved locally)
    setRows((prev) => {
      const newRows = prev.map((r) => (r.id === fromRowId ? { ...r, isNew: false } : r));
      // ensure exactly one empty row at end
      const last = newRows[newRows.length - 1];
      if (last.code || last.name || last.batch) {
        newRows.push(createEmptyRow());
      }
      return newRows;
    });

    showToast("success", "Row added");
  };


  const loadBatchesForProduct = async (rowId, productCode) => {
    if (!productCode) return;

    try {
      const base = getApiPath("products");
      const url = `${base}?search=${encodeURIComponent(productCode)}&limit=1`;

      const res = await apiClient.get(url);

      const list =
        res?.data?.products ||
        res?.data?.data?.products ||
        res?.data ||
        [];

      if (!Array.isArray(list) || list.length === 0) return;

      const product = list[0];
      const batches = Array.isArray(product.batches)
        ? product.batches
        : [];

      setBatchesByRow((prev) => ({
        ...prev,
        [rowId]: batches,
      }));

      if (batches.length > 0) {
        setShowBatchList((prev) => ({
          ...prev,
          [rowId]: true,
        }));
      }
    } catch (err) {
      console.error("Failed to load batches", err);
    }
  };


  const deleteRow = (rowId) => {
    setRows((prev) => {
      const filtered = prev.filter((r) => r.id !== rowId);
      // ensure at least one empty row remains
      if (filtered.length === 0) filtered.push(createEmptyRow());
      return filtered;
    });
    showToast("success", "Row removed");
  };

  const saveRowEdit = (rowId) => {
    // just end edit mode
    setEditRowId(null);
    showToast("success", "Row updated");
  };

  const cancelRowEdit = () => {
    setEditRowId(null);
    showToast("info", "Edit cancelled");
  };

  /* -------------------------
     Suggestion UI handlers (focus/blur click-outside)
     ------------------------- */
  useEffect(() => {
    const handleClick = (e) => {
      // if clicked outside any suggestion ref hide them
      Object.keys(suggestionRefs.current).forEach((k) => {
        const node = suggestionRefs.current[k];
        if (!node) return;
        if (!node.contains(e.target)) {
          const [type, rowId] = k.split("__");
          if (type === "code") setShowCodeList((v) => ({ ...v, [rowId]: false }));
          if (type === "name") setShowNameList((v) => ({ ...v, [rowId]: false }));
        }
      });
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  /* -------------------------
     Render helpers for suggestion portals
     ------------------------- */
  const getPortalRoot = () => {
    return document.getElementById("global-suggestion-root");
  };

  const renderCodeSuggestionPortal = (rowId) => {
    const list = codeSuggestions[rowId] || [];
    if (!list.length || !showCodeList[rowId]) return null;

    const input = document.querySelector(`[aria-label="product-code-${rowId}"]`);
    if (!input) return null;

    const rect = input.getBoundingClientRect();
    const root = getPortalRoot();
    if (!root) return null;

    return createPortal(
      <div
        className="bg-white border rounded-lg shadow-xl absolute z-[999999]"
        style={{
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          maxHeight: 240,
          overflowY: "auto",
          animation: "fadeIn 160ms ease",
        }}
      >
        {list.map((p) => (
          <button
            key={p._id || p.code}
            onMouseDown={(e) => {
              e.preventDefault();
              applyProductToRow(rowId, p);
            }}
            className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{p.code}</div>
              <div className="text-xs text-gray-500">{p.name}</div>
            </div>
          </button>
        ))}
      </div>,
      root
    );
  };

  const renderNameSuggestionPortal = (rowId) => {
    const list = nameSuggestions[rowId] || [];
    if (!list.length || !showNameList[rowId]) return null;

    const input = document.querySelector(`[aria-label="product-name-${rowId}"]`);
    if (!input) return null;

    const rect = input.getBoundingClientRect();
    const root = getPortalRoot();
    if (!root) return null;

    return createPortal(
      <div
        className="bg-white border rounded-lg shadow-xl absolute z-[999999]"
        style={{
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,
          maxHeight: 240,
          overflowY: "auto",
          animation: "fadeIn 160ms ease",
        }}
      >
        {list.map((p) => (
          <button
            key={p._id || p.code}
            onMouseDown={(e) => {
              e.preventDefault();
              applyProductToRow(rowId, p);
            }}
            className="w-full text-left px-3 py-2 hover:bg-emerald-50 flex justify-between items-center"
          >
            <div>
              <div className="font-semibold">{p.name}</div>
              <div className="text-xs text-gray-500">{p.code}</div>
            </div>
          </button>
        ))}
      </div>,
      root
    );
  };



  const renderBatchPortal = (rowId) => {
    const list = batchesByRow[rowId] || [];
    if (!list.length || !showBatchList[rowId]) return null;

    const input = document.querySelector(`[aria-label="batch-${rowId}"]`);
    if (!input) return null;

    const tdBatch = input.closest("td");
    if (!tdBatch) return null;

    // Previous column = Product Name <td>
    const tdName = tdBatch.previousElementSibling;
    if (!tdName) return null;

    // Next column = MRP <td>
    const tdMRP = tdBatch.nextElementSibling;
    if (!tdMRP) return null;

    // Get precise positions
    const rectName = tdName.getBoundingClientRect();
    const rectBatch = tdBatch.getBoundingClientRect();
    const rectMRP = tdMRP.getBoundingClientRect();

    // Total width = Name + Batch + MRP
    const totalWidth = rectName.width + rectBatch.width + rectMRP.width;

    const root = document.getElementById("global-suggestion-root");
    if (!root) return null;

    // Height auto-limit to avoid page scroll
    const viewportH = window.innerHeight;
    const spaceBelow = viewportH - rectBatch.bottom - 10;
    const maxHeight = Math.max(120, Math.min(spaceBelow, 300));

    return createPortal(
      <div
        className="bg-white border rounded-lg shadow-xl fixed z-[99999]"
        style={{
          top: rectBatch.bottom + window.scrollY + 6,
          left: rectName.left + window.scrollX, // start from Product Name column
          width: totalWidth, // span 3 columns
          maxHeight,
          overflowY: "auto",
          overflowX: "hidden",
        }}
      >
        <table
          className="w-full text-sm border-collapse"
          style={{ tableLayout: "fixed" }}
        >
          <thead>
            <tr className="bg-gray-100 text-gray-700 border-b">
              <th className="p-2 border">Batch No</th>
              <th className="p-2 border">MRP</th>
              <th className="p-2 border">Rate</th>
              <th className="p-2 border">Qty</th>
            </tr>
          </thead>
          <tbody>
            {list.map((b) => (
              <tr
                key={b.batchNo}
                onMouseDown={(e) => {
                  e.preventDefault();
                  applyBatchToRow(rowId, b);
                }}
                className="cursor-pointer hover:bg-emerald-50"
              >
                <td className="p-2 border">{b.batchNo}</td>
                <td className="p-2 border">{formatCurrency(b.mrp)}</td>
                <td className="p-2 border">{formatCurrency(b.salePrice)}</td>
                <td className="p-2 border">{b.qty}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>,
      root
    );
  };





  const renderSupplierPortal = () => {
    if (!showSupplierDropdown || supplierSuggestions.length === 0)
      return null;

    // detect which field is currently typed
    let inputEl = null;

    if (supplierQuery === supplierId) {
      inputEl = document.querySelector('[aria-label="supplier-id-input"]');
    } else if (supplierQuery === supplierName) {
      inputEl = document.querySelector('[aria-label="supplier-name-input"]');
    } else if (supplierQuery === supplierMobile) {
      inputEl = document.querySelector('[aria-label="supplier-mobile-input"]');
    }

    if (!inputEl) return null;

    const rect = inputEl.getBoundingClientRect();
    const root = document.getElementById("global-suggestion-root");
    if (!root) return null;

    return createPortal(
      <div
        className="absolute bg-white border rounded-lg shadow-xl z-[99999]"
        style={{
          position: "absolute",
          top: rect.bottom + window.scrollY,
          left: rect.left + window.scrollX,
          width: rect.width,        // ✔ same width as input
          maxHeight: 260,
          overflowY: "auto",
        }}
      >
        {supplierSuggestions.map((s) => (
          <button
            key={s._id}
            onMouseDown={(e) => {
              e.preventDefault();
              pickSupplier(s);
            }}
            className="w-full text-left px-3 py-2 hover:bg-emerald-50"
          >
            <div className="font-semibold">
              {s.supplierId} — {s.name}
            </div>
            <div className="text-xs text-gray-600">{s.mobile}</div>
          </button>
        ))}
      </div>,
      root
    );
  };

  const isExistingBatch = (row) => {
    return row.randomCode || row.barcode;
  };



  const validateMaxLength = (name, value, max = 50) => {
    if (value.length > max) {
      setErrors((prev) => ({
        ...prev,
        [name]: `Maximum ${max} characters allowed`,
      }));

      setTimeout(() => {
        setErrors((prev) => {
          const copy = { ...prev };
          delete copy[name];
          return copy;
        });
      }, 3000);

      return false;
    }

    setErrors((prev) => {
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


  /* -------------------------
     Component render
     ------------------------- */
  const inputClass =
    "w-full h-11 rounded border border-[#e5e7eb] px-3 focus:ring-2 focus:ring-[#00A76F] transition";

  return (
    <div
      className={`p-6 sm:p-8 space-y-6 transition-all duration-200
      ${savingPurchase ? "pointer-events-none opacity-60" : ""}
    `}
    >
      {/* TOP: Header */}
      <div className="flex justify-between items-start mb-2">
        <div>
          <button
            onClick={() => navigate("/stock/purchase")}
            className="inline-flex items-center gap-2 text-sm text-[#00A76F] hover:underline"
          >
            <FaArrowLeft /> Back
          </button>
          <h1 className="text-2xl sm:text-[28px] font-bold text-[#00A76F] mt-3">New Purchase</h1>
        </div>

        <div className="text-right">
          <div className="text-sm font-medium mb-1">Order Number</div>
          <div
            style={{
              background: "linear-gradient(320deg, rgba(211,252,210,0.7) 0%, #ffffff 90%)",
              padding: "8px 14px",
              borderRadius: 10,
              border: "1px solid #e5e7eb",
              fontWeight: 700,
              minWidth: 120,
            }}
          >
            {orderNo || "—"}
          </div>
        </div>
      </div>

      {/* Purchase Card */}
      <div className="bg-white border rounded-2xl shadow-md p-5 max-w-6xl mx-auto">
        <div ref={dropdownSupplierRef} className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4 relative">
          {/* <div className="relative">
            <label className="text-sm font-medium mb-1 block">Supplier ID</label>

            <input
              aria-label="supplier-id-input"
              
              className={inputClass}
              value={supplierId}
              onChange={(e) => onSupplierType("supplierId", e.target.value)}
              placeholder="Type supplier id"
              onFocus={() => setShowSupplierDropdown(false)}
            />
          </div> */}

          <div className="relative">
            <label className="text-sm font-medium mb-1 block">
              Supplier ID
            </label>

            <input
              aria-label="supplier-id-input"
              className={inputClass}   // ✅ unchanged
              value={supplierId}
              placeholder="Type supplier id"
              onFocus={() => {
                setActiveField("supplierId");
                setShowSupplierDropdown(false);
              }}
              onBlur={() => setActiveField(null)}
              onChange={(e) => {
                const val = e.target.value;

                if (validateMaxLength("supplierId", val, 30)) {
                  onSupplierType("supplierId", val);
                }
              }}
            />

            {/* Character Counter */}
            <CharCounter
              value={supplierId}
              max={30}
              show={activeField === "supplierId"}
            />

            {/* Error message */}
            {errors.supplierId && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.supplierId}
              </span>
            )}
          </div>


          <div className="relative">
            {/* <label >Supplier Name</label> */}
            <RequiredLabel className="text-sm font-medium mb-1 block">Supplier Name</RequiredLabel>


            <input
              aria-label="supplier-name-input"
              className={inputClass}
              value={supplierName}
              // onChange={(e) => onSupplierType("supplierName", e.target.value)}
              onChange={(e) => {
                const val = e.target.value;

                if (validateMaxLength("supplierName", val, 50)) {
                  onSupplierType("supplierName", val);
                }
              }}
              onFocus={() => {
                setActiveField("supplierName");
                setShowSupplierDropdown(false);
              }}
              onBlur={() => setActiveField(null)}
              placeholder="Type name"
            />

            {/* Character Counter */}
            <CharCounter
              value={supplierName}
              max={50}
              show={activeField === "supplierName"}
            />

            {/* Error message */}
            {errors.supplierName && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.supplierName}
              </span>
            )}
          </div>

          <div className="relative">
            <label className="text-sm font-medium mb-1 block">Mobile</label>



            <input
              aria-label="supplier-mobile-input"
              className={inputClass}
              value={supplierMobile}
              // onChange={(e) => onSupplierType("supplierMobile", e.target.value)}

              onChange={(e) => {
                const val = e.target.value;

                // Optional: allow only numbers
                const numeric = val.replace(/\D/g, "");

                if (validateMaxLength("supplierMobile", numeric, 20)) {
                  onSupplierType("supplierMobile", numeric);
                }
              }}

              onFocus={() => {
                setActiveField("supplierMobile");
                setShowSupplierDropdown(false);
              }}
              onBlur={() => setActiveField(null)}
              placeholder="Type mobile"

            />

            {/* Character Counter */}
            {/* <CharCounter
              value={supplierMobile}
              max={20}
              show={activeField === "supplierMobile"}
            /> */}

            {/* Error Message */}
            {errors.supplierMobile && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.supplierMobile}
              </span>
            )}

          </div>

          {/* Supplier dropdown */}
          {/* {showSupplierDropdown && supplierSuggestions.length > 0 && (
            <div
              className="absolute left-0 right-0 mt-2 bg-white border rounded-lg shadow-lg z-50"
              style={{ gridColumn: "1 / 4", maxHeight: 220, overflow: "auto" }}
            >
              {supplierSuggestions.map((s) => (
                <button
                  key={s._id}
                  onClick={() => pickSupplier(s)}
                  className="w-full text-left px-3 py-2 hover:bg-emerald-50"
                >
                  <div className="font-semibold">{s.supplierId} — {s.name}</div>
                  <div className="text-xs text-gray-500">{s.mobile}</div>
                </button>
              ))}
            </div>
          )} */}
        </div>

        {/* Invoice row: plain input for invoiceNo (no suggestions) */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
          <div className="relative">
            <RequiredLabel className="text-sm font-medium mb-1 block">
              Invoice No
            </RequiredLabel>

            <input
              className={inputClass}
              value={invoiceNo}
              placeholder="Type invoice no"
              onFocus={() => setActiveField("invoiceNo")}
              onBlur={() => setActiveField(null)}
              onChange={(e) => {
                const val = e.target.value;

                if (validateMaxLength("invoiceNo", val, 30)) {
                  setInvoiceNo(val);
                }
              }}
            />

            {/* Character Counter */}
            <CharCounter
              value={invoiceNo}
              max={30}
              show={activeField === "invoiceNo"}
            />

            {/* Error Message */}
            {errors.invoiceNo && (
              <span className="text-red-600 text-xs mt-1 block">
                {errors.invoiceNo}
              </span>
            )}
          </div>


          <div>
            <RequiredLabel className="text-sm font-medium mb-1 block">Invoice Date</RequiredLabel>
            {/* <label className="text-sm font-medium mb-1 block">Invoice Date</label> */}
            <input
              type="date"
              className={inputClass}
              value={invoiceDate}
              onChange={(e) => setInvoiceDate(e.target.value)}
            />
          </div>

          <div>

            <RequiredLabel className="text-sm font-medium mb-1 block">Stocked Date</RequiredLabel>

            <input
              type="text"
              className={inputClass}
              value={stockedDate}
              readOnly
              placeholder="DD/MM/YYYY"
            />

          </div>
        </div>

        {/* Errors */}
        <div className="mb-3">
          {errors.supplier && <div className="text-red-600 mb-1">{errors.supplier}</div>}
          {/* {errors.invoiceNo && <div className="text-red-600">{errors.invoiceNo}</div>} */}
          {errors.invoiceDate && <div className="text-red-600">{errors.invoiceDate}</div>}
          {errors.stockedDate && <div className="text-red-600">{errors.stockedDate}</div>}
        </div>



      </div>

      {renderSupplierPortal()}

      {/* Batch Add Card*/}
      {/* <h1 className="text-2xl sm:text-[25px] font-bold text-[#00A76F] mt-3">Add Batch</h1> */}
      <div className="bg-white border rounded-2xl shadow-md p-5 max-w-6xl mx-auto">
        {/* Table */}
        <div className="relative w-full overflow-visible">
          <table className="min-w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                <th className="p-2 w-[40px]">S.No</th>
                <th className="p-2 w-[140px]">Product Code</th>
                <th className="p-2 w-[190px]">Product Name</th>
                <th className="p-2 w-[190px]">Batch</th>
                <th className="p-2 w-[90px]">MRP</th>
                <th className="p-2 w-[80px]">Rate</th>
                <th className="p-2 w-[80px]">GST%</th>
                <th className="p-2 w-[80px]">Qty</th>
                <th className="p-2 w-[100px] text-right">Value</th>
                <th className="p-2 w-[90px]">Action</th>
              </tr>
            </thead>

            <tbody>
              {rows.map((row, idx) => {
                const calc = calcRowValues(row);
                return (
                  <React.Fragment key={row.id}>
                    <tr className={clsx(idx % 2 === 0 ? "bg-white" : "bg-gray-50")}>
                      <td className="p-2 align-top">{idx + 1}</td>

                      {/* Product Code */}
                      <td className="p-2 align-top relative">
                        <input
                          className="w-full rounded border px-2 h-10"
                          value={row.code}
                          placeholder="Type product code"
                          onChange={(e) => {
                            let v = e.target.value;
                            if (v.length > 50) {
                              v = v.slice(0, 50);
                            }

                            const key = `code_${row.id}`;
                            if (suggestionsDebounce.current[key]) {
                              clearTimeout(suggestionsDebounce.current[key]);
                            }

                            if (!v.trim()) {
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                      ...r,
                                      code: "",
                                      name: "",
                                      batch: "",
                                      gst: 0,
                                      mrp: 0,
                                      rate: 0,
                                      qty: "",
                                    }
                                    : r
                                )
                              );

                              setCodeSuggestions((s) => ({ ...s, [row.id]: [] }));
                              setShowCodeList((s) => ({ ...s, [row.id]: false }));
                              setBatchesByRow((b) => ({ ...b, [row.id]: [] }));
                              setShowBatchList((s) => ({ ...s, [row.id]: false }));
                              return;
                            }

                            updateRow(row.id, "code", v);
                            triggerSuggest("code", row.id, v);
                          }}
                          onFocus={() => { }}
                          onBlur={() => {
                            setTimeout(() => setShowCodeList((s) => ({ ...s, [row.id]: false })), 150);
                          }}
                          aria-label={`product-code-${row.id}`}
                        />
                        {showCodeList[row.id] && renderCodeSuggestionPortal(row.id)}
                      </td>

                      {/* Product Name */}
                      <td className="p-2 align-top relative">
                        <input
                          className="w-full rounded border px-2 h-10"
                          value={row.name}
                          placeholder="Type product name"
                          onChange={(e) => {
                            const v = e.target.value;

                         
                            const key = `name_${row.id}`;
                            if (suggestionsDebounce.current[key]) {
                              clearTimeout(suggestionsDebounce.current[key]);
                            }

                            if (!v.trim()) {
                              setRows((prev) =>
                                prev.map((r) =>
                                  r.id === row.id
                                    ? {
                                      ...r,
                                      code: "",
                                      name: "",
                                      batch: "",
                                      gst: 0,
                                      mrp: 0,
                                      rate: 0,
                                      qty: "",
                                    }
                                    : r
                                )
                              );
                              setNameSuggestions((s) => ({ ...s, [row.id]: [] }));
                              setShowNameList((s) => ({ ...s, [row.id]: false }));
                              setBatchesByRow((b) => ({ ...b, [row.id]: [] }));
                              setShowBatchList((s) => ({ ...s, [row.id]: false }));
                              return;
                            }

                            updateRow(row.id, "name", v);
                            triggerSuggest("name", row.id, v);
                          }}
                          onFocus={() => { }}
                          onBlur={() => {
                            setTimeout(() => setShowNameList((s) => ({ ...s, [row.id]: false })), 150);
                          }}
                          aria-label={`product-name-${row.id}`}
                        />
                        {showNameList[row.id] && renderNameSuggestionPortal(row.id)}
                      </td>

                      {/* Batch */}
                      <td className="p-2 align-top relative">
                        <input
                          className="w-full rounded border px-2 h-10"
                          value={row.batch}
                          placeholder="Enter or select batch"
                          onChange={(e) => {
                            const v = e.target.value;

                     

                            if (!v.trim()) {
                              // Reset row fields completely
                              updateRow(row.id, "batch", "");
                              updateRow(row.id, "mrp", "");
                              updateRow(row.id, "rate", "");

                              updateRow(row.id, "qty", "");
                              updateRow(row.id, "value", 0);

                              // Mark this as a NEW (manual) batch
                              updateRow(row.id, "isExistingBatch", false);
                              updateRow(row.id, "randomCode", null);
                              updateRow(row.id, "barcode", null);

                              setShowBatchList((s) => ({ ...s, [row.id]: false }));
                              setFilteredBatches((prev) => ({ ...prev, [row.id]: [] }));
                              return;
                            }

                            // User is typing → this is a new batch
                            updateRow(row.id, "batch", v);
                            updateRow(row.id, "isExistingBatch", false);
                            updateRow(row.id, "randomCode", null);
                            updateRow(row.id, "barcode", null);

                            const fullList = batchesByRow[row.id] || [];

                            const filtered = fullList.filter((b) =>
                              (b.batchNo || "").toLowerCase().includes(v.toLowerCase())
                            );

                            // Update filtered batches for dropdown
                            setFilteredBatches((prev) => ({ ...prev, [row.id]: filtered }));

                            setShowBatchList((s) => ({ ...s, [row.id]: filtered.length > 0 }));
                          }}




                          onFocus={() => {
                            const list = batchesByRow[row.id];

                            // 1) Load fresh batches again if list is empty
                            if (!list || list.length === 0) {
                              loadBatchesForProduct(row.id, row.code); // ⬅️ new function
                              return;
                            }

                            // 2) Show dropdown if list exists
                            setShowBatchList((s) => ({ ...s, [row.id]: true }));
                          }}


                          onBlur={() => {
                            setTimeout(() => setShowBatchList((s) => ({ ...s, [row.id]: false })), 160);
                          }}
                          aria-label={`batch-${row.id}`}
                        />

                        {renderBatchPortal(row.id)}
                      </td>

                      {/* MRP */}
                      <td className="p-2 align-top">

                        <input
                          type="number"
                          className="w-full rounded border px-2 h-10"
                          value={row.mrp || ""}
                          placeholder="MRP"
                          readOnly={row.isExistingBatch}
                          style={{ background: row.isExistingBatch ? "#f3f4f6" : "white" }}

                          // Prevent mouse scroll change
                          onWheel={(e) => e.target.blur()}

                          // Prevent arrow up/down from changing number
                          onKeyDown={(e) => {
                            if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                          }}

                          // onChange={(e) => {
                          //   let v = Number(e.target.value || 0);


                          //   if (v < 0) v = 0; // block negative MRP
                          //   updateRow(row.id, "mrp", v);



                          //   // ensure rate never exceeds mrp
                          //   if (row.rate > v) {
                          //     updateRow(row.id, "rate", v);
                          //   }
                          // }}


                          onChange={(e) => {
                            let raw = e.target.value;

                            // 🔒 Limit to 50 characters
                            if (raw.length > 10) return;

                            let v = Number(raw || 0);
                            if (v < 0) v = 0; // block negative MRP

                            updateRow(row.id, "mrp", v);

                            // ensure rate never exceeds mrp
                            if (row.rate > v) {
                              updateRow(row.id, "rate", v);
                            }
                          }}

                        />


                      </td>

                      {/* Rate */}
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          className="w-full rounded border px-2 h-10"
                          value={row.rate || ""}
                          placeholder="Rate"
                          readOnly={row.isExistingBatch}
                          style={{ background: row.isExistingBatch ? "#f3f4f6" : "white" }}

                          // Disable mouse scroll change
                          onWheel={(e) => e.target.blur()}

                          // Disable arrow key change
                          onKeyDown={(e) => {
                            if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                          }}

                          onChange={(e) => {
                            let v = Number(e.target.value || 0);

                            // 🔒 Limit to 10 characters
                            if (v.length > 10) {
                              v = v.slice(0, 10);
                            }
                            if (v < 0) v = 0; // block negative

                            const mrp = Number(row.mrp || 0);

                            if (v > mrp) {
                              v = mrp; // ❌ block rate above MRP
                            }

                            updateRow(row.id, "rate", v);
                          }}
                        />




                      </td>

                      {/* GST */}
                      <td className="p-2 align-top">

                        <input
                          type="number"
                          className="w-full rounded border px-2 h-10"
                          value={row.gst || ""}
                          onChange={(e) => updateRow(row.id, "gst", Number(e.target.value || 0))}
                          placeholder="%"
                          aria-label={`gst-${row.id}`}
                          readOnly={row.code || row.name ? true : false}
                          style={row.code || row.name ? { background: "#f3f4f6", cursor: "not-allowed" } : {}}
                          // Disable mouse scroll change
                          onWheel={(e) => e.target.blur()}

                          // Disable arrow key change
                          onKeyDown={(e) => {
                            if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                          }}
                        />

                      </td>

                      {/* Qty */}
                      <td className="p-2 align-top">
                        <input
                          type="number"
                          className="w-full rounded border px-2 h-10"
                          value={row.qty || ""}
                          // onChange={(e) => updateRow(row.id, "qty", e.target.value === "" ? "" : Number(e.target.value))}
                          onChange={(e) => {
                            let raw = e.target.value;

                            // 🔒 Limit to 10 characters
                            if (raw.length > 10) {
                              raw = raw.slice(0, 10);
                            }

                            updateRow(
                              row.id,
                              "qty",
                              raw === "" ? "" : Number(raw)
                            );
                          }}

                          placeholder="Qty"
                          aria-label={`qty-${row.id}`}
                          // Disable mouse scroll change
                          onWheel={(e) => e.target.blur()}

                          // Disable arrow key change
                          onKeyDown={(e) => {
                            if (["ArrowUp", "ArrowDown"].includes(e.key)) e.preventDefault();
                          }}
                        />
                      </td>

                      {/* Value */}
                      <td className="p-2 align-top text-right font-semibold">
                        {formatCurrency(calc.value)}
                        <div className="text-xs text-gray-400 mt-1">
                          {row.taxMode === "inclusive" ? "Inclusive" : "Exclusive"}
                        </div>
                      </td>

                      {/* Actions */}
                      <td className="p-2 align-top">
                        {row.isNew ? (
                          <button
                            onClick={() => addRow(row.id)}
                            title="Add this row"
                            style={{
                              background: "#00A76F",
                              color: "white",
                              padding: "8px",
                              borderRadius: "6px",
                            }}
                          >
                            <FaPlus />
                          </button>
                        ) : editRowId === row.id ? (
                          <div className="flex gap-2">
                            <button
                              onClick={() => saveRowEdit(row.id)}
                              title="Save"
                              style={{
                                background: "#16A34A",
                                color: "white",
                                padding: "8px",
                                borderRadius: "6px",
                              }}
                            >
                              <FaCheck />
                            </button>

                            <button
                              onClick={cancelRowEdit}
                              title="Cancel"
                              style={{
                                background: "#DC2626",
                                color: "white",
                                padding: "8px",
                                borderRadius: "6px",
                              }}
                            >
                              <FaTimes />
                            </button>
                          </div>
                        ) : (
                          <div className="flex gap-2">
                            {/* <button
        onClick={() => setEditRowId(row.id)}
        title="Edit"
        style={{
          background: "#FACC15",
          color: "black",
          padding: "8px",
          borderRadius: "6px",
        }}
      >
        <FaEdit />
      </button> */}

                            <button
                              onClick={() => deleteRow(row.id)}
                              title="Delete"
                              style={{
                                background: "#DC2626",
                                color: "white",
                                padding: "8px",
                                borderRadius: "6px",
                              }}
                            >
                              <FaTrash />
                            </button>
                          </div>
                        )}
                      </td>

                    </tr>
                  </React.Fragment>
                );
              })}
            </tbody>
          </table>
        </div>



      </div>

      {/* Toast */}
      {toast && <Toast type={toast.type} message={toast.message} />}

      {/* tiny animations */}
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }
      `}</style>

      {/* Footer actions */}
      <div className="mt-4 flex justify-end items-center gap-3">
        {/* <button
            onClick={() => setRows([createEmptyRow()])}
            className="px-4 py-2 rounded border"
            title="Reset rows"
          >
            Reset
          </button> */}

        {/* SAVE PURCHASE — main unified action (Save all) */}
        <button
          onClick={createPurchase}
          disabled={savingPurchase}
          className="px-4 py-2 
            
            
                     rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0  
            
            disabled:opacity-60"
        >
          {savingPurchase ? "Saving..." : "Save Purchase"}
        </button>
      </div>
    </div>


  );
}


const RequiredLabel = ({ children }) => (
  <label className="text-sm font-medium mb-1 block">
    {children}
    <span className="text-red-500 ml-0.5">*</span>
  </label>
);
