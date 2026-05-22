// src/pages/SalesBill.jsx
import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
import ReactDOM from "react-dom";
import {
  FaPlus,
  FaEdit,
  FaTrash,
  FaTimes,
  FaCheck,
  FaEye,
  FaMoneyBillWave, FaMobileAlt, FaExchangeAlt,
  FaCheckCircle, FaTimesCircle,
} from "react-icons/fa";
import axios from "axios";
import { useAuth } from "../context/AuthContext";
import { getAuthHeaders, API } from "../utils/apiHeaders";
import Pagination from "../components/Pagination";
import "../styles/salesbill.css";
import { getApiUrl } from "../utils/api";
import apiClient from "../utils/apiClient";
import { ShopContext } from "../context/ShopContext";
import ViewOnlySaleModal from '../components/ViewOnlySaleModal';

import html2pdf from "html2pdf.js";


const axiosInstance = axios.create({ baseURL: API });



import { useReactToPrint } from "react-to-print";


export default function SalesBill() {
  const { user } = useAuth();
  const token = localStorage.getItem("token");
  const shopname = user?.shopname || localStorage.getItem("shopname");

  // ---------------- State ----------------
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);

  // const [rows, setRows] = useState([createEmptyRow()]);
  const [products, setProducts] = useState([]);

  const [popup, setPopup] = useState({ message: "", type: "" });
  const [batchRenderKey, setBatchRenderKey] = useState(0);
  const [version, setVersion] = React.useState(0);


  const [printView, setPrintView] = useState(false);

  const [activeSuggestionIndex, setActiveSuggestionIndex] = useState({});

  const [showViewModal, setShowViewModal] = useState(false);


  const [isModalOpen, setIsModalOpen] = useState(false);
  // const updateRowBlockedRef = useRef(false);


  const [customerSuggestions, setCustomerSuggestions] = useState([]);
  const [showCustomerList, setShowCustomerList] = useState(false);
  const [searchingField, setSearchingField] = useState("");
  const isClickInsideCustomerList = useRef(false);
  const { selectedShop } = useContext(ShopContext);
  const shopTitle = selectedShop?.shopname;

  const [counterFilter, setCounterFilter] = useState("");

  // ------------------ SCAN ENGINE REFS ------------------
  const scanLockRef = useRef(false);
  const lastRawBarcodeRef = useRef(null);

  const stockAppliedRef = useRef(false);


  const customerTypingRef = useRef(null); // debounce
  const isClickInsideCustomerDropdown = useRef(false);


  // ⭐ REQUIRED FIX — this removes "lastScan is not defined"
  const lastScan = useRef({ code: "", time: 0 });


  // 🔥 BARCODE BUFFER (REQUIRED)
  const scanBufferRef = useRef("");


  const isSavingRef = useRef(false);
  const [saving, setSaving] = useState(false);

  const [paymentMethod, setPaymentMethod] = useState("cash");  // "cash" | "upi"
  const [payment, setPayment] = useState({
    cash: 0,
    upi: 0,
  });

  const [hasCashInput, setHasCashInput] = useState(false);


  // If you use updateRow blocking
  const updateRowBlockedRef = useRef(false);


  //   const [rows, _setRows] = useState([createEmptyRow()]);
  const [rows, setRows] = useState([createEmptyRow()]);



  // ---------------------- SCAN LOCK & HELPERS ----------------------
  // Add these next to other useRef/useState declarations
  // const scanLockRef = React.useRef(false); // blocks duplicate burst processing
  // const lastRawBarcodeRef = React.useRef(null); // optional raw filter if needed
  const printRef = useRef();
  const [meta, setMeta] = useState({
    billNo: "",
    date: new Date().toISOString().split("T")[0],
    counter: 1,
    customerName: "",
    mobile: "",
    address: "",

  });





  const [totals, setTotals] = useState({
    total: 0,
    discount: 0,
    netAmount: 0,
    cashGiven: 0,
    balance: 0,
    cgst: 0,
    sgst: 0,
  });

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  const [showModal, setShowModal] = useState(false);
  const [viewBill, setViewBill] = useState(null);

  const [billEditMode, setBillEditMode] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null);

  const [editRowId, setEditRowId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");

  const [originalRowData, setOriginalRowData] = useState({});
  const [originalBillItems, setOriginalBillItems] = useState({});

  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 50;

  const [reservedStock, setReservedStock] = useState({});
  const [stockErrors, setStockErrors] = useState({});
  const [rowStockError, setRowStockError] = useState({});

  // suggestions state (per row)
  const [nameSuggestions, setNameSuggestions] = useState({});
  const [codeSuggestions, setCodeSuggestions] = useState({});
  const [showNameList, setShowNameList] = useState({});
  const [showCodeList, setShowCodeList] = useState({});
  const [batchesByRow, setBatchesByRow] = useState({});
  const [showBatchList, setShowBatchList] = useState({});

  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const suggestionRefs = useRef({});


  const isClickInsideBatchPortal = useRef(false);
  const suggestionClickRef = useRef(false);
  const isClickInsideSuggestion = useRef(false);
  const [allProducts, setAllProducts] = useState([]);



  const [pendingAddId, setPendingAddId] = useState(null);


  const [payCash, setPayCash] = useState(true);
  const [payUpi, setPayUpi] = useState(false);
  const syncPayment = (cashChecked, upiChecked, cashGiven) => {
    const net = Number(totals.netAmount || 0);

    let cashPay = 0;
    let upiPay = 0;

    if (cashChecked) {
      cashPay = Math.min(cashGiven || net, net);
    }

    if (upiChecked) {
      upiPay = Math.max(0, net - cashPay);
    }

    // If only UPI selected
    if (!cashChecked && upiChecked) {
      cashPay = 0;
      upiPay = net;
    }

    setPayment({
      cash: cashPay,
      upi: upiPay,
    });

    setPaymentMethod(
      cashChecked && upiChecked
        ? "mixed"
        : cashChecked
          ? "cash"
          : "upi"
    );

    setTotals((p) => ({
      ...p,
      balance: cashGiven - net + upiPay,
    }));
  };

  useEffect(() => {
    if (!pendingAddId) return;

    // call addRow with a microtask so React finishes current renders
    const id = pendingAddId;
    setTimeout(() => {
      addRow(id);
      setPendingAddId(null);
      // focus last input
      setTimeout(() => {
        const last = document.querySelectorAll('input[data-field="code"][data-row]');
        if (last && last.length) {
          const el = last[last.length - 1];
          try { el.focus(); } catch (e) { }
        }
      }, 40);
    }, 0);

  }, [pendingAddId]);


  const debounce = (fn, delay = 300) => {
    let timer;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  };


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


  const [currentShop, setCurrentShop] = useState(null);

  useEffect(() => {
    const fetchTenantShop = async () => {
      if (!user?.username) return;

      try {
        // Public route, no Authorization header needed
        const res = await axios.get(
          `${API}/api/shops/public/findByUsername/${user.username}`
        );

        if (res.data) {
          setCurrentShop(res.data);
        }
      } catch (err) {
        console.error("Failed to fetch tenant shop:", err);
      }
    };

    fetchTenantShop();
  }, [user]);


  // ---------------- Helpers ----------------
  function createEmptyRow() {
    return {
      id: "_" + Math.random().toString(36).slice(2, 10),
      code: "",
      name: "",
      batch: "",
      mrp: 0,
      rate: 0,
      gst: 0,
      qty: 0,
      amount: 0,
      value: 0,
      isNew: true,
    };
  }





  const keyFor = (code, batch) =>
    `${(code || "").toLowerCase()}|${(batch || "").toLowerCase()}`;

  const showPopup = (message, type = "success") => {
    setPopup({ message, type });
    setTimeout(() => setPopup({ message: "", type: "" }), 2500);
  };

  const preventWheel = (e) => {
    if (document.activeElement && document.activeElement.type === "number") {
      e.preventDefault();
    }
  };
  const enableWheelBlock = () =>
    document?.addEventListener("wheel", preventWheel, { passive: false });
  const disableWheelBlock = () =>
    document?.removeEventListener("wheel", preventWheel);

  const numberInputProps = { onWheel: (e) => e.target.blur() };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
  };


  const formatTime = (dateString) => {
    const date = new Date(dateString);
    const hours = date.getHours();
    const minutes = date.getMinutes();
    const seconds = date.getSeconds();

    const ampm = hours >= 12 ? "PM" : "AM";
    const h = hours % 12 || 12;
    const mm = minutes.toString().padStart(2, "0");
    const ss = seconds.toString().padStart(2, "0");

    return `${h}:${mm}:${ss} ${ampm}`;
  };

  // debounce helper
  const debounceFn = (fn, delay = 180) => {
    let t;
    return (...args) => {
      clearTimeout(t);
      t = setTimeout(() => fn(...args), delay);
    };
  };

  // ---------------- Data Fetch ----------------
  const fetchCustomerByMobile = async (mobile) => {
    if (!mobile.trim()) return null;
    try {
      const token = user?.token || localStorage.getItem("token");
      const res = await axios.get(`${API}/api/customers`, {
        params: { search: mobile, limit: 1 }, // fetch only one customer
        headers: {
          Authorization: `Bearer ${token}`,
          "x-shopname": shopTitle,
        },
      });
      const data = res.data?.customers || [];
      return data.length > 0 ? data[0] : null;
    } catch (err) {
      console.error("fetchCustomerByMobile failed:", err);
      return null;
    }
  };



  const fetchCustomerByName = async (name) => {
    if (!name.trim()) return [];

    try {
      const token = user?.token || localStorage.getItem("token");

      const res = await axios.get(`${API}/api/customers`, {
        params: { search: name, limit: 10 },
        headers: {
          Authorization: `Bearer ${token}`,
          "x-shopname": shopTitle,
        },
      });

      return res.data?.customers || [];
    } catch (err) {
      console.error("fetchCustomerByName:", err);
      return [];
    }
  };


  // ---------------- FETCH PRODUCTS ----------------
  const fetchProducts = async (searchText = "") => {
    if (!user) return [];

    try {
      const isSearching = !!searchText.trim();
      const limit = isSearching ? 0 : 10;

      const params = new URLSearchParams({ limit });
      if (isSearching) params.append("search", searchText);

      // ⭐ UPDATED: ONLY ACTIVE PRODUCTS+ACTIVE BATCHES
      const res = await axiosInstance.get(`/api/products/active?${params}`, {
        headers: getAuthHeaders(user),
      });


      const data = res?.data ?? {};

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data.products)
          ? data.products
          : [];

      const normalized = list.map((p) => ({
        ...p,

        batches: (Array.isArray(p.batches) ? p.batches : []).map((b) => ({
          batchNo: b.batchNo || "",
          qty: Number(b.qty ?? 0),

          mrp: Number(b.mrp ?? 0),
          salePrice: Number(b.salePrice ?? b.rate ?? 0),

          // ⭐ REQUIRED FOR RANDOMCODE, EAN, BARCODE MATCH
          randomCode: b.randomCode || "",
          ean: b.ean || "",
          barcode: b.barcode || "",

          // ⭐ ALWAYS PRODUCT TAX
          taxPercent: Number(p.taxPercent ?? 0),
          taxMode: (p.taxMode || "exclusive").toLowerCase(),

          // ⭐ keep batch status
          status: b.status || "active",
        })),
      }));

      setProducts(normalized);
      return normalized;
    } catch (err) {
      console.error("fetchProducts failed:", err);
      return [];
    }
  };





  // Fetch products matching product code OR batch randomCode (ACTIVE ONLY)
  const fetchProductsByCodeOrRandom = async (q = "") => {
    if (!user) return [];
    try {
      if (!q || !q.toString().trim()) return [];

      const params = new URLSearchParams({ code: q });

      // ⭐ UPDATED ROUTE
      const { data } = await axiosInstance.get(
        `/api/products/active/search-by-code?${params}`,
        { headers: getAuthHeaders(user) }
      );

      const list = Array.isArray(data)
        ? data
        : Array.isArray(data?.products)
          ? data.products
          : [];

      const normalized = list.map((p) => ({
        ...p,
        batches:
          Array.isArray(p.batches) && p.batches.length
            ? p.batches.map((b) => ({
              batchNo: b.batchNo || "",
              randomCode: b.randomCode || "",
              mrp: Number(b.mrp ?? 0),
              salePrice: Number(b.salePrice ?? b.rate ?? 0),
              rate: Number(b.salePrice ?? b.rate ?? 0),

              qty: Number(b.qty ?? 0),


              taxPercent: Number(b.taxPercent ?? p.taxPercent ?? 0),
              taxMode: (b.taxMode || p.taxMode || "exclusive").toLowerCase(),
            }))
            : [],
      }));

      return normalized;
    } catch (err) {
      console.error("fetchProductsByCodeOrRandom", err);
      return [];
    }
  };




  useEffect(() => {
    fetchProductsByCodeOrRandom(""); // Load all on mount
  }, []);

  useEffect(() => {
    fetchProducts(""); // Load all on mount
  }, []);




  const scanCache = new Map();

const fetchByScanRandomCode = async (code = "") => {
  if (!user) return [];

  try {
    if (!code.trim()) return [];

    // 🚀 CACHE HIT
    if (scanCache.has(code)) {
      return [scanCache.get(code)];
    }

    const res = await axiosInstance.get(
      `/api/products/scan/${code}`,
      { headers: getAuthHeaders(user) }
    );

    const product = res.data;
    if (!product) return [];

    const formatted = {
      ...product,
      batches: (product.batches || []).map((b) => ({
        batchNo: b.batchNo || "",
        status: b.status,

        randomCode: b.randomCode || "",
        barcode: b.barcode || "",
        qty: Number(b.qty ?? 0),
        mrp: Number(b.mrp ?? 0),
          salePrice: Number(b.salePrice ?? b.rate ?? 0),
            taxPercent: Number(
      b.taxPercent !== undefined
        ? b.taxPercent
        : product.taxPercent ?? 0
    ),

    taxMode: (
      b.taxMode !== undefined
        ? b.taxMode
        : product.taxMode || "exclusive"
    ).toLowerCase(),
  })),
     
    };

    // 🚀 SAVE CACHE
    scanCache.set(code, formatted);

    return [formatted];

  } catch (err) {
    console.error("SCAN ERROR:", err);
    return [];
  }
};


  // =============================
  //  MANUAL PRODUCT SEARCH
  // =============================
  const fetchByManualSearch = async (text = "") => {
    return await fetchProducts(text);
  };

  // =============================
  //  FIND MATCHING BATCH BY RANDOMCODE
  // =============================
  const findBatchByRandomCode = (product, randomCode) => {
    if (!product?.batches) return null;
    return (
      product.batches.find((b) => b.randomCode == randomCode) ||
      product.batches[0]
    );
  };


  useEffect(() => {
    if (!isModalOpen) {
      setRows((prev) =>
        prev.map((r) => ({
          ...r,
          qty: 0,
          batch: "",
        }))
      );
      refreshBatchLists();
    }
  }, [isModalOpen]);


  // -------------------- Keyboard Navigation for Batch Dropdown --------------------
  const handleBatchKey = (e, rowId) => {
    // If scan mode → DO NOT allow keyboard batch selection
    const row = rows.find(r => r.id === rowId);
    if (row?._scanMode) {
      e.preventDefault();
      return;
    }

    const list = batchesByRow[rowId] || [];
    if (!showBatchList[rowId] || list.length === 0) return;

    const key = e.key;

    // Prevent arrow keys from jumping to next table cell
    if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(key)) {
      e.preventDefault();
    }

    let curIdx = activeSuggestionIndex[`batch-${rowId}`] ?? -1;
    let newIdx = curIdx;

    // Move down
    if (key === "ArrowDown") {
      newIdx = Math.min(list.length - 1, curIdx + 1);
    }

    // Move up
    else if (key === "ArrowUp") {
      newIdx = Math.max(0, curIdx - 1);
    }

    // Page down (skip 5 rows)
    else if (key === "PageDown") {
      newIdx = Math.min(list.length - 1, curIdx + 5);
    }

    // Page up (skip 5 rows)
    else if (key === "PageUp") {
      newIdx = Math.max(0, curIdx - 5);
    }

    // ENTER → pick selected batch
    else if (key === "Enter") {
      e.preventDefault();

      const selected = list[curIdx];
      if (!selected) return;

      handleBatchPick(rowId, normalizeBatch(selected));

      // close popup
      setShowBatchList((m) => ({ ...m, [rowId]: false }));

      // return focus to qty (best workflow)
      setTimeout(() => {
        const qtyInput = document.querySelector(
          `input[data-row="${rowId}"][data-field="qty"]`
        );
        if (qtyInput) qtyInput.focus();
      }, 30);

      return;
    }

    // ESC → close dropdown safely
    else if (key === "Escape") {
      e.preventDefault();
      setShowBatchList((m) => ({ ...m, [rowId]: false }));

      // return to batch input
      setTimeout(() => {
        const batchInput = document.querySelector(
          `input[data-row="${rowId}"][data-field="batch"]`
        );
        if (batchInput) batchInput.focus();
      }, 30);

      return;
    }

    setActiveSuggestionIndex((s) => ({
      ...s,
      [`batch-${rowId}`]: newIdx,
    }));
  };




  useEffect(() => {
    const savedCounter = localStorage.getItem("counter");
    if (savedCounter) {
      setMeta(prev => ({
        ...prev,
        counter: Number(savedCounter)
      }));
    }
  }, []);




  const fetchBills = async (pageNum = 1) => {
    try {
      setLoading(true);
      const params = new URLSearchParams({
        page: pageNum,
        limit,
        search,
        filter,
        fromDate,
        toDate,
        counter: counterFilter ? Number(counterFilter) : "",
        statusFilter: statusFilter || "all",
      });
      const { data } = await axiosInstance.get(`/api/sales?${params}`, {
        headers: getAuthHeaders(user),
      });
      setBills(Array.isArray(data?.bills) ? data.bills : []);
      setTotalPages(Number(data?.totalPages || 1));
      // setPage(Number(data?.page || pageNum));
    } catch (e) {
      console.error("fetchBills", e);
      setBills([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  const fetchBillNo = async () => {
    try {
      if (!token || !shopname) return;

      const currentCounter =
  Number(localStorage.getItem("counter")) || 1;

const { data } = await axiosInstance.get(
  `/api/sales/next-billno?counter=${currentCounter}`,
  {
    headers: {
      ...getAuthHeaders(user),
      "x-shopname": shopname,
    },
  }
);

      console.log("✅ API BillNo:", data); // Should show { billNo: 'B070' }

      const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);

      setMeta((prev) => {
        const updated = {
          ...prev,
          billNo: data?.billNo || "", // ✅ FIXED: Use correct key
          date: istDate.toISOString().slice(0, 10),
        };
        console.log("🟢 Meta updated:", updated);
        return updated;
      });
    } catch (e) {
      console.error("fetchBillNo error:", e);
    }
  };

  useEffect(() => {
    console.log("🟢 Meta updated:", meta);
  }, [meta]);


  useEffect(() => {
    const init = async () => {
      if (token && shopname) {
        // await fetchProducts();
        await fetchBillNo();
        await fetchBills();
      }
    };
    init();
  }, [token, shopname]);


 
  useEffect(() => {
    if (!token || !shopname) return;

    fetchBills(page);

  }, [page, search, filter, fromDate, toDate, counterFilter, statusFilter]);


  const refreshBatchLists = () => {
    setRows((prev) =>
      prev.map((r) => {
        const batches = r.name
          ? getBatchesForName(r.name)
          : r.code
            ? getBatchesForCode(r.code)
            : [];
        return { ...r, availableBatches: batches };
      })
    );
  };

  // ---------------- Row math ----------------
  const recalcRow = (r) => {
    const rate = Number(r.rate || 0); // displayed rate (may be inclusive or exclusive)
    const qty = Number(r.qty || 0);
    const gst = Number(r.gst || 0); // e.g. 5 for 5%
    // determine mode: prefer row.isInclusive, fallback to row.taxMode string
    const isInclusive =
      typeof r.isInclusive !== "undefined"
        ? Boolean(r.isInclusive)
        : (r.taxMode || "").toString().toLowerCase() === "inclusive";

    // amount = base * qty (base = price before gst)
    let baseUnit = 0;
    let gstAmount = 0;
    let amount = 0;
    let value = 0;

    if (isInclusive) {
      // rate includes GST. baseUnit = rate / (1 + gst/100)
      const divisor = 1 + gst / 100;
      baseUnit = divisor > 0 ? +(rate / divisor).toFixed(6) : 0; // keep extra precision
      amount = +(baseUnit * qty).toFixed(2); // base * qty
      const gross = +(rate * qty).toFixed(2); // shown value
      gstAmount = +(gross - amount).toFixed(2);
      value = gross; // inclusive value is the shown total
    } else {
      // exclusive: rate is baseUnit
      baseUnit = +rate;
      amount = +(baseUnit * qty).toFixed(2);
      gstAmount = +((amount * gst) / 100).toFixed(2);
      value = +(amount + gstAmount).toFixed(2);
    }


    // ⭐ FIXED STOCK CALCULATION
    const opening = Number(r.openingStock || 0);
    const closing = Math.max(0, opening - qty);

    console.log(
      "%cRECALC → STOCK UPDATE",
      "color: orange; font-weight: bold;",
      { code: r.code, batch: r.batch, opening, qty, closing }
    );

    // return computed fields; keep backwards compat fields amount/value
    return {
      ...r,
      baseUnit,
      amount,
      gstAmount,
      value,
      isInclusive,


      // ⭐ FIXED – always return the NEW computed values
      openingStock: opening,
      closingStock: closing,
    };
  };

  const updateRow = (id, field, value) => {
    if (updateRowBlockedRef.current) return;

    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;

        // ❌ Prevent overwrites during scan fill
        if (r._scanMode) return r;

        let v = value;
        if (["mrp", "rate", "gst", "qty"].includes(field)) {
          v = Number(value) || 0;
        }

        let updated = { ...r, [field]: v };

        // -----------------------------------------------
        //  PRODUCT / NAME AUTO-FILL (manual only)
        // -----------------------------------------------
        if ((field === "code" || field === "name") && v) {
          const finder = findProductByKey(v);

          if (finder && finder.product) {
            const prod = finder.product;
            const batch = finder.matchedBatch;

            updated.code = prod.code;
            updated.name = prod.name;

            // ⭐ TAX TAKEN ONLY FROM PRODUCT ALWAYS
            updated.gst = Number(prod.taxPercent || 0);
            updated.taxMode = (prod.taxMode || "exclusive").toLowerCase();
            updated.isInclusive = updated.taxMode === "inclusive";

            if (batch) {
              updated.batch = batch.batchNo;
              updated.mrp = Number(batch.mrp || 0);
              updated.rate = Number(batch.salePrice || 0);
              updated.qty = updated.qty || 1;
            } else {
              updated.batch = "";
              updated.mrp = 0;
              updated.rate = 0;
              updated.qty = 0;
            }
          }
        }

        // --------------------------------------------------------------------
        // 🔥 FULL STOCK VALIDATION 
        // --------------------------------------------------------------------
        if (field === "qty") {
          const product = products.find(
            (p) => normalizeKey(p.code) === normalizeKey(r.code)
          );
          const batchObj = product?.batches?.find(
            (b) => normalizeKey(b.batchNo) === normalizeKey(r.batch)
          );

          if (product && batchObj) {
            const baseStock = Number(batchObj.qty || 0); // available in DB
            const k = getStockKey(r.code, r.batch);

            // reserved by other UI rows
            const rowsReservedExcludingThis = getRowsReservedForKey(
              r.code,
              r.batch,
              r.id
            );

            // reservedStock = external reservations (other invoices)
            const rawReserved = Number(reservedStock[k] || 0);
            const externalReserved = Math.max(
              0,
              rawReserved - rowsReservedExcludingThis
            );

            // what remains for this row
            const availableOutside = Math.max(
              0,
              baseStock - (rowsReservedExcludingThis + externalReserved)
            );

            const newQty = Number(v || 0);
            const oldQty = Number(r.qty || 0);
            const diff = newQty - oldQty;

            if (diff > 0 && diff > availableOutside) {
              showPopup(`Only ${baseStock} available`, "error");

              // ❌ Reject update → keep old qty
              return recalcRow({ ...r });
            }
          }
        }



        return recalcRow(updated);
      })
    );
  };



  // ---------------- Stock helpers ----------------

  useEffect(() => {
    const valid = rows.filter(r => !r.isNew);

    let totalValue = 0;  // sum of row.value (gross)
    let totalGST = 0;

    valid.forEach(r => {
      totalValue += Number(r.value || 0);
      totalGST += Number(r.gstAmount || 0);
    });

    const cgst = +(totalGST / 2).toFixed(2);
    const sgst = +(totalGST / 2).toFixed(2);

    const discount = Number(totals.discount || 0);
    const netAmount = +(totalValue - discount).toFixed(2);

    const cashGiven = Number(totals.cashGiven || 0);
    const balance = +(cashGiven - netAmount).toFixed(2);

    setTotals(prev => ({
      ...prev,
      total: +totalValue.toFixed(2),
      gst: +totalGST.toFixed(2),
      cgst,
      sgst,
      discount,
      netAmount,
      cashGiven,
      balance,
    }));
  }, [rows, totals.discount, totals.cashGiven]);


  const normalize = (s) => (s || "").trim().toLowerCase();

  const uniqueProducts = (arr) => {
    const seen = new Set();
    return arr.filter((p) => {
      const k = `${(p.code || "").trim()}|${(p.name || "").trim()}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
  };


  // 🔄 Suggest by Product Name — full backend search (limit = 0 when searching)
  const suggestNamesDebounced = useMemo(
    () =>
      debounceFn(async (rowId, query) => {
        const q = (query || "").trim();
        if (!q) {
          setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
          setShowNameList((s) => ({ ...s, [rowId]: false }));
          return;
        }

        try {
          // 🔍 fetch all matches from backend (no pagination limit)
          const isSearching = !!q.trim();
          const limit = isSearching ? 0 : 10;
          let queryStr = `${getApiPath("products")}?limit=${limit}`;
          if (isSearching) queryStr += `&search=${encodeURIComponent(q)}`;

          const res = await apiClient.get(queryStr);
          const data = res?.data || {};
          const allProducts = Array.isArray(data.products)
            ? data.products
            : Array.isArray(data)
              ? data
              : [];

          // ✅ filter & deduplicate by name
          const matches = Array.from(
            new Map(
              allProducts
                .filter((p) =>
                  (p.name || "").toLowerCase().includes(q.toLowerCase())
                )
                .map((p) => [p.name.toLowerCase(), p])
            ).values()
          ).slice(0, 20);

          setNameSuggestions((s) => ({ ...s, [rowId]: matches }));
          setShowNameList((s) => ({ ...s, [rowId]: matches.length > 0 }));
        } catch (err) {
          console.error("❌ Error fetching name suggestions:", err);
          setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
          setShowNameList((s) => ({ ...s, [rowId]: false }));
        }
      }, 300),
    []
  );

  // 🔄 Suggest by Product Code — full backend search (limit = 0 when searching)
  const suggestCodesDebounced = useMemo(
    () =>
      debounceFn(async (rowId, query) => {
        const q = (query || "").trim();
        if (!q) {
          setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
          setShowCodeList((s) => ({ ...s, [rowId]: false }));
          return;
        }

        try {
          const isSearching = !!q.trim();
          const limit = isSearching ? 0 : 10;
          let queryStr = `${getApiPath("products")}?limit=${limit}`;
          if (isSearching) queryStr += `&search=${encodeURIComponent(q)}`;

          const res = await apiClient.get(queryStr);
          const data = res?.data || {};
          const allProducts = Array.isArray(data.products)
            ? data.products
            : Array.isArray(data)
              ? data
              : [];

          // ✅ filter & deduplicate by code
          const matches = Array.from(
            new Map(
              allProducts
                .filter((p) =>
                  (p.code || "").toLowerCase().includes(q.toLowerCase())
                )
                .map((p) => [p.code.toLowerCase(), p])
            ).values()
          ).slice(0, 20);

          setCodeSuggestions((s) => ({ ...s, [rowId]: matches }));
          setShowCodeList((s) => ({ ...s, [rowId]: matches.length > 0 }));
        } catch (err) {
          console.error("❌ Error fetching code suggestions:", err);
          setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
          setShowCodeList((s) => ({ ...s, [rowId]: false }));
        }
      }, 300),
    []
  );


  const getBatchesForCode = (code) => {
    const matches = products.filter(
      (p) => (p.code || "").toLowerCase() === (code || "").toLowerCase()
    );
    return matches.flatMap((p) => p.batches || []);
  };

  const getBatchesForName = (name) => {
    const matches = products.filter(
      (p) => (p.name || "").toLowerCase() === (name || "").toLowerCase()
    );
    return matches.flatMap((p) => p.batches || []);
  };

  const normalizeBatch = (m) => ({
    ...m,
    batchNo: m.batchNo || "",
    mrp: Number(m.mrp || 0),
    rate: Number(m.rate || m.salePrice || 0),
    gst: Number(m.gst || m.taxPercent || 0),
    qty: Number(m.qty || 0),
  });




  const handleSelectSuggestion = (rowId, product, isRandom = false) => {

    // Update row
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== rowId) return r;

        const isInclusive =
          (product.taxMode || "").toLowerCase() === "inclusive";

        return recalcRow({
          ...r,
          code: product.code || "",
          name: product.name || "",
          batch: "",
          mrp: Number(product.mrp ?? 0),
          rate: Number(product.salePrice ?? 0),
          gst: Number(product.taxPercent ?? 0),
          qty: 0,
          taxMode: (product.taxMode || "exclusive").toLowerCase(),
          isInclusive
        });
      })
    );

    if (isRandom) {
      // Random selection → auto-fill first batch
      const firstBatch =
        product.batches?.[0] ||
        getBatchesForCode(product.code)?.[0] ||
        {};

      const tMode = (firstBatch.taxMode || product.taxMode || "exclusive").toLowerCase();

      setRows((prev) =>
        prev.map((r) => {
          if (r.id !== rowId) return r;
          return recalcRow({
            ...r,
            batch: firstBatch.batchNo || "",
            mrp: Number(firstBatch.mrp ?? 0),
            rate: Number(firstBatch.salePrice ?? 0),
            gst: Number(firstBatch.taxPercent ?? 0),
            qty: 1,
            taxMode: tMode,
            isInclusive: tMode === "inclusive",
            // ⭐ FIX STOCK
            openingStock: Number(firstBatch.qty || 0),
            closingStock: Math.max(0, Number(firstBatch.qty || 0) - 1),
          });
        })
      );




      // Hide batch dropdown
      setBatchesByRow((p) => ({ ...p, [rowId]: [] }));
      setShowBatchList((p) => ({ ...p, [rowId]: false }));

      // Blur batch input to avoid flicker
      setTimeout(() => {
        const batchInput = document.querySelector(
          `input[data-row="${rowId}"][data-field="batch"]`
        );
        batchInput?.blur();
      }, 20);

      // ⭐ FOCUS QTY FOR RANDOM CODE ⭐
      setTimeout(() => {
        const qtyInput = document.querySelector(
          `input[data-row="${rowId}"][data-field="qty"]`
        );
        qtyInput?.focus();
      }, 60);

    }


    // Hide suggestions


    else {

      // Normal product → show batch list
      const batches = product.batches?.length
        ? product.batches
        : getBatchesForCode(product.code);

      setBatchesByRow((p) => ({ ...p, [rowId]: batches || [] }));
      setShowBatchList((p) => ({
        ...p,
        [rowId]: (batches || []).length > 0
      }));

      // ⭐ AUTO-FILL STOCK FROM FIRST BATCH (soft fill)
      const firstBatch = (batches || [])[0];

      if (firstBatch) {
        setRows((prev) =>
          prev.map((r) => {
            if (r.id !== rowId) return r;
            return {
              ...r,
              openingStock: Number(firstBatch.qty || 0),
              closingStock: Math.max(
                0,
                Number(firstBatch.qty || 0) - Number(r.qty || 0)
              ),
            };
          })
        );
      }

      // ⭐ FOCUS BATCH FOR NORMAL SELECTION ⭐
      setTimeout(() => {
        const batchInput = document.querySelector(
          `input[data-row="${rowId}"][data-field="batch"]`
        );
        batchInput?.focus();
      }, 30);
    }


    setShowCodeList((p) => ({ ...p, [rowId]: false }));
    setShowNameList((p) => ({ ...p, [rowId]: false }));
  };


  function getAvailableForQtyInput(row) {
    const product = products.find(
      (p) => normalizeKey(p.code) === normalizeKey(row.code)
    );
    const batchObj = product?.batches?.find(
      (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
    );

    const baseStock = Number(batchObj?.qty || 0);

    // reserved except this row
    const reservedOtherRows = getRowsReservedForKey(row.code, row.batch, row.id);

    return Math.max(0, baseStock - reservedOtherRows);
  }


  /* -------------------- HANDLE BATCH PICK (FINAL PATCH) -------------------- */
  const handleBatchPick = (rowId, batch) => {
    if (!batch) return;

    const nb = normalizeBatch(batch);
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const available = getAvailableStock(row.code, nb.batchNo);
    if (available <= 0) {
      showPopup(`Batch ${nb.batchNo} is OUT OF STOCK.`, "error");
      return;
    }

    const isScan = row._scanMode === true;

    // Update row fields
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? recalcRow({
            ...r,
            batch: nb.batchNo,
            mrp: nb.mrp,
            rate: nb.rate,
            gst: nb.gst,
            qty: isScan ? (r.qty > 0 ? r.qty : 1) : r.qty,
            _scanMode: isScan,
            isInclusive: (nb.taxMode || "").toLowerCase() === "inclusive",

          })
          : r
      )
    );

    // Keep external reserved key alive
    const key = getStockKey(row.code, nb.batchNo);
    setReservedStock((rs) => {
      if (typeof rs[key] === "undefined") {
        return { ...rs, [key]: 0 };
      }
      return rs;
    });

    setShowBatchList((s) => ({ ...s, [rowId]: false }));

    // --------------------------------------------------------
    // 🔥 NEW FEATURE: WHEN USER PICKS BATCH → JUMP TO QTY INPUT
    // --------------------------------------------------------
    setTimeout(() => {
      const qtyInput = document.querySelector(
        `input[data-row="${rowId}"][data-field="qty"]`
      );
      if (qtyInput) qtyInput.focus();
    }, 30);
  };


  const handlePrint = useReactToPrint({
    content: () => printRef.current,
    pageStyle: `
    @page {
      size: 7.5cm auto !important;
      margin: 0 !important;
    }
    @media print {
      body {
        background: transparent !important;
        -webkit-print-color-adjust: exact;
      }
      .print-area {
        width: 7.5cm !important;
        background: transparent !important;
        margin: 0 !important;
        padding: 0 !important;
        font-family: 'Courier New', monospace;
        font-size: 10px;
        color: #000 !important;
      }
    }
  `,
  });

  const openBillPrintWindow = (bill, selectedShop) => {

    const itemsHtml = (bill.items || [])
      .map(
        (it) => `
      <div style="display:flex;font-size:10px;">
        <span style="flex:3;text-align:left;">${it.name}</span>
        <span style="flex:1;text-align:center;">${it.batch}</span>
        <span style="flex:1;text-align:right;">${Number(it.mrp).toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${Number(it.rate).toFixed(2)}</span>
        <span style="flex:0.8;text-align:right;">${it.qty}</span>
        <span style="flex:1.2;text-align:right;">${Number(it.value).toFixed(2)}</span>
      </div>
    `
      )
      .join("");

    // ---------- GST SUMMARY ----------
    let totalGST = 0;
    const gstSummary = {};

    (bill.items || []).forEach((r) => {
      const gstRate = Number(r.gst || 0);
      const qty = Number(r.qty || 0);
      const rate = Number(r.rate || 0);
      if (!gstRate || !qty || !rate) return;

      const inclusive = r.isInclusive !== false;
      const gross = rate * qty;
      const taxable = inclusive ? gross / (1 + gstRate / 100) : gross;
      const gstAmt = inclusive ? gross - taxable : taxable * (gstRate / 100);

      totalGST += gstAmt;
      gstSummary[gstRate] = (gstSummary[gstRate] || 0) + gstAmt;
    });

    const gstHtml = Object.keys(gstSummary)
      .map(
        (rate) => `
      <div style="display:flex;justify-content:space-between;font-size:10px;">
        <span>${rate}%</span>
        <span>${gstSummary[rate].toFixed(2)}</span>
      </div>
    `
      )
      .join("");

    // ---------- HTML ----------
    const html = `
<html>
<head>
<meta charset="UTF-8" />
<style>
@page { size: 76mm auto; margin: 0; }
body {
  width: 76mm;
  margin: 0;
  padding: 2mm;
  font-family: Arial, sans-serif;
  color: #000;
}
hr {
  border: 0.5px dashed #000;
  margin: 4px 0;
}
</style>
</head>

<body>

  <div style="text-align:center;margin-bottom:6px;">
    <img src="/logo-icon.png" width="40" style="display:block;margin:auto;" />
    <div style="font-weight:600;color:#006400;">CSI Diocese Book Depot</div>
    <div style="font-weight:600;color:#006400;">${selectedShop?.shopname || ""}</div>

    <div style="font-size:10px;margin-top:2px;">
      ${selectedShop?.address || ""}
    </div>

    <div style="font-size:10px;">
      Phone: ${selectedShop?.contact || "N/A"}
    </div>
  </div>

  <div style="text-align:center;font-weight:700;font-size:12px;color:#006400;margin:4px 0;">
    BILL
  </div>

  <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;">
   <div style="text-align:left;">
    <div>GSTIN NO: 123456789</div>
    <div>Bill No: ${bill.billNo}</div>
    </div>
    <div style="text-align:right;">
      <div>Date: ${new Date(bill.date).toLocaleDateString("en-GB")}</div>
      <div>Time: ${new Date(bill.createdAt).toLocaleTimeString()}</div>
    </div>
  </div>

  <hr />

  <div style="width:90%;margin:auto;display:flex;font-weight:700;color:#006400;font-size:10px;">
    <span style="flex:3;text-align:left;">Product Name</span>
    <span style="flex:1;text-align:center;">Batch</span>
    <span style="flex:1;text-align:right;">MRP</span>
    <span style="flex:1;text-align:right;">Rate</span>
    <span style="flex:0.8;text-align:right;">Qty</span>
    <span style="flex:1.2;text-align:right;">Value</span>
  </div>

  <hr />

  <div style="width:90%;margin:auto;">
    ${itemsHtml}
  </div>

  <hr />

  <div style="width:90%;margin:auto;display:flex;font-weight:700;font-size:10px;">
    <span style="flex:3;text-align:center;">TOTAL</span>
    <span style="flex:1;"></span>
    <span style="flex:1;"></span>
    <span style="flex:1;"></span>
    <span style="flex:0.8;text-align:right;">
      ${bill.items.reduce((a, c) => a + Number(c.qty), 0)}
    </span>
    <span style="flex:1.2;text-align:right;">
      ${(bill.items.reduce((a, c) => a + Number(c.value), 0)).toFixed(2)}
    </span>
  </div>

  <hr />

 <div style="color:#000;">
  
  <!-- GST Title -->
  <div style="font-weight:700;color:#006400;margin-top:4px;">GST</div>

  <!-- Header Row -->
  <div style="display:flex;font-size:10px;font-weight:700;color:#006400;">
    <span style="flex:1;text-align:left;">GST%</span>
    <span style="flex:1;text-align:right;">GST Value</span>
    <span style="flex:1;text-align:right;">CGST</span>
    <span style="flex:1;text-align:right;">SGST</span>
    <span style="flex:1;text-align:right;">GST</span>
  </div>
  <hr />

  <!-- GST Rate Rows -->
  ${Object.keys(gstSummary)
        .map(rate => {
          const gstValue = gstSummary[rate];
          const cgst = gstValue / 2;
          const sgst = gstValue / 2;
          const total = gstValue;

          return `
      <div style="display:flex;font-size:10px;">
        <span style="flex:1;text-align:left;">${rate}%</span>
        <span style="flex:1;text-align:right;">${gstValue.toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${cgst.toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${sgst.toFixed(2)}</span>
        <span style="flex:1;text-align:right;">${total.toFixed(2)}</span>
      </div>
      
      `;
        })
        .join("")}
    <hr />

  <!-- Total GST Row -->
  <div style="display:flex;font-size:10px;font-weight:700;">
    <span style="flex:1;text-align:left;">Total</span>
    <span style="flex:1;text-align:right;">${totalGST.toFixed(2)}</span>
    <span style="flex:1;text-align:right;">${(totalGST / 2).toFixed(2)}</span>
    <span style="flex:1;text-align:right;">${(totalGST / 2).toFixed(2)}</span>
    <span style="flex:1;text-align:right;">${totalGST.toFixed(2)}</span>
  </div>
  <hr />

</div>


  <hr />

  <div style="text-align:left;color:#000;font-weight:600;padding:4px 0 4px 10px;font-size:11px;">
    <div style="display:flex;justify-content:space-between;width:90%;">
      <span>Total Amount:</span>
      <span>${Number(bill.total).toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;width:90%;">
      <span>Net Bill Amount:</span>
      <span>${Number(bill.netAmount).toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;width:90%;">
      <span>Tendered Amount:</span>
      <span>${Number(bill.cashGiven).toFixed(2)}</span>
    </div>
    <div style="display:flex;justify-content:space-between;width:90%;">
      <span>Balance:</span>
      <span>${Number(bill.balance).toFixed(2)}</span>
    </div>
  </div>

  <hr />

  <div style="margin-top:10px;text-align:center;color:#006400;font-weight:600;font-size:11px;">
    GOD IS OUR REFUGE AND STRENGTH
  </div>

  <script>
    window.onload = () => setTimeout(() => window.print(), 200);
  </script>

</body>
</html>
`;

    const win = window.open("", "_blank", "width=400,height=600");
    win.document.write(html);
    win.document.close();
  };





  // -----------------------------------------------------------
  // ⭐ Determine whether a row uses inclusive tax or exclusive
  // -----------------------------------------------------------
  const resolveIsInclusive = (row) => {
    if (typeof row.isInclusive === "boolean") return row.isInclusive;

    const prod = products.find(
      (p) => (p.code || "").toLowerCase() === (row.code || "").toLowerCase()
    );
    if (!prod) return true;

    const batch = (prod.batches || []).find(
      (b) =>
        (b.batchNo || "").toLowerCase() ===
        (row.batch || "").toLowerCase()
    );

    if (batch && typeof batch.taxMode === "string") {
      return batch.taxMode.toLowerCase() === "inclusive";
    }

    if (typeof prod.taxMode === "string") {
      return prod.taxMode.toLowerCase() === "inclusive";
    }

    return false;
  };




  const handleSaveAndPrint = async () => {
    if (saving || isSavingRef.current) {
      console.warn("⛔ Prevented duplicate save");
      return;
    }
    try {
      setSaving(true);              // ✅ UI LOCK
      isSavingRef.current = true;   // ✅ Hard lock


      if (!rows.length) {
        setErrorMsg("Add items before saving.");
        setSaving(false);
        isSavingRef.current = false;
        return;
      }

      const validItems = rows.filter(
        (r) => r.code && r.batch && Number(r.qty) >= 0
      );
      if (!validItems.length) {
        setErrorMsg("No valid items to save.");
        isSavingRef.current = false;
        setSaving(false);
        return;
      }

      const headers = getAuthHeaders(user);


      // ⭐ RUN STOCK UPDATES ONLY ON FIRST CLICK
      if (!stockAppliedRef.current) {
        try {
          if (!billEditMode) {
            // 🔥 NEW BILL → decrement ONCE
            for (const r of validItems) {
              const qty = Number(r.qty);
              if (qty > 0) {
                await axiosInstance.put(
                  "/api/products/decrement-stock",
                  { items: [{ code: r.code, batchNo: r.batch, qty }] },
                  { headers }
                );
              }
            }
          }

          if (billEditMode && editingBillId) {
            // 🔥 EDIT BILL → apply qty DIFFERENCE ONCE
            for (const r of validItems) {
              const newQty = Number(r.qty);
              const oldQty = Number(originalBillItems?.[r.id]?.qty || 0);
              if (newQty === oldQty) continue;

              let api = "";
              let qty = 0;

              if (newQty > oldQty) {
                api = "/api/products/decrement-stock";
                qty = newQty - oldQty;
              } else {
                api = "/api/products/increment-stock";
                qty = oldQty - newQty;
              }

              await axiosInstance.put(
                api,
                { items: [{ code: r.code, batchNo: r.batch, qty }] },
                { headers }
              );
            }
          }

          // ⭐ Prevent future stock changes
          stockAppliedRef.current = true;
        } catch (err) {
          console.error("Stock update failed", err);
          stockAppliedRef.current = false; // 🔥 rollback lock
          throw err; // rethrow so main catch handles it
        }
      }


      /* ------------------------------------------------------------------
          ⭐ Build processed items (with opening & closing stock)
         ------------------------------------------------------------------ */
      const processedItems = validItems.map((r) => {
        const qty = Number(r.qty || 0);
        const rate = Number(r.rate || 0);
        const gst = Number(r.gst || 0);

        const inclusive = resolveIsInclusive(r);

        let taxable = 0;
        let gstAmount = 0;
        let value = 0;

        if (inclusive) {
          const gross = +(rate * qty);
          taxable = +(gross / (1 + gst / 100));
          taxable = +taxable.toFixed(2);
          gstAmount = +(gross - taxable);
          gstAmount = +gstAmount.toFixed(2);
          value = +gross.toFixed(2);
        } else {
          taxable = +(rate * qty);
          taxable = +taxable.toFixed(2);
          gstAmount = +(taxable * (gst / 100));
          gstAmount = +gstAmount.toFixed(2);
          value = +(taxable + gstAmount);
          value = +value.toFixed(2);
        }

        // ⭐ since stock decremented in frontend,
        // PREVIOUS qty must be saved before it was reduced
        const opening = Number(r.openingStock || 0);
        const closing = Math.max(0, opening - qty);

        return {
          code: r.code,
          name: r.name,
          batch: r.batch,
          mrp: Number(r.mrp || 0),
          rate,
          gst,
          qty,
          taxable,
          gstAmount: Number(gstAmount || 0),

          value,
          isInclusive: inclusive,

          // ⭐ Snapshot values
          openingStock: opening,
          closingStock: closing,
        };
      });

      /* ------------------------------------------------------------------
          ⭐ Compute totals
         ------------------------------------------------------------------ */
      const totalTaxable = processedItems.reduce(
        (s, it) => s + Number(it.taxable || 0),
        0
      );
      const totalGst = processedItems.reduce(
        (s, it) => s + Number(it.gstAmount || 0),
        0
      );

      const totalValue = +(totalTaxable + totalGst).toFixed(2);


      const discount = Number(totals.discount || 0);
      const netAmount = +(
        totalTaxable +
        totalGst -
        discount
      ).toFixed(2);

      // const cashGiven = Number(totals.cashGiven || 0);
      // const balance = +(
      //   cashGiven >= netAmount
      //     ? cashGiven - netAmount
      //     : netAmount - cashGiven
      // ).toFixed(2);


      const cashGiven = Number(totals.cashGiven || 0);

      // ⭐ IMPORTANT: use PAYMENT, not cashGiven
      const amountPaid =
        Number(payment.cash || 0) + Number(payment.upi || 0);

      // ⭐ POS-CORRECT BALANCE
      const balance = +(netAmount - amountPaid).toFixed(2);


      const cgst = +((totalGst / 2) || 0).toFixed(2);
      const sgst = +((totalGst / 2) || 0).toFixed(2);

      //------------------------------------------------
      // AUTO-DETECT PAYMENT METHOD
      //------------------------------------------------
      let finalPaymentMethod = paymentMethod;
      let total = Number(netAmount || 0);

      // Case 1: Full Cash
      if (payment.cash === total && payment.upi === 0) {
        finalPaymentMethod = "cash";
      }

      // Case 2: Full UPI
      else if (payment.upi === total && payment.cash === 0) {
        finalPaymentMethod = "upi";
      }

      // Case 3: Mixed payments → partial
      else if (payment.cash > 0 && payment.upi > 0) {
        finalPaymentMethod = "mixed";
      }

      // Case 4: No amount entered → keep selected button
      else {
        finalPaymentMethod = paymentMethod;
      }

      //------------------------------------------------
      // AUTO-DETECT PAYMENT STATUS
      //------------------------------------------------
      let finalPaymentStatus =
        payment.cash + payment.upi >= total ? "paid" : "partial";




      const salesPayload = {
        billNo: meta.billNo,
        date: meta.date || new Date(),
        counter: meta.counter || 1,

        customerName: meta.customerName || "Cash Customer",
        mobile: meta.mobile || "",

        items: processedItems,

        // ⭐ TOTAL = FULL AMOUNT (value)
        total: Number(totalValue.toFixed(2)),

        // ⭐ TOTAL GST
        totalGst: Number(totalGst.toFixed(2)),

        // ⭐ DISCOUNT & NET AMOUNT
        discount,
        discountPercent: Number(totals.discountPercent || 0),
        netAmount: Number(netAmount.toFixed(2)),

        cashGiven,
        balance,

        // ⭐ TAX SPLIT
        cgst,
        sgst,

        // ⭐ VERY IMPORTANT — stop backend stock update
        skipStockUpdate: true,

        // ⭐ AUDIT FIELDS
        createdBy: user?.username || "",
        createdById: user?._id || "",
        counterUser: user?.username || "",
        deviceInfo: {
          ip: window?.clientIP || "",
          userAgent: navigator.userAgent || "",
        },
        editedBy: billEditMode ? (user?.username || "") : null,

        // ⭐ PAYMENT FIELDS
        paymentMethod: finalPaymentMethod,
        payment: {
          cash: Number(payment.cash || 0),
          upi: Number(payment.upi || 0),
        },
        paymentStatus: finalPaymentStatus,
      };


      let savedBill;
      if (billEditMode && editingBillId) {
        const { data } = await axiosInstance.put(
          `/api/sales/${editingBillId}`,
          salesPayload,
          { headers }
        );
        savedBill = data;
      } else {
        const { data } = await axiosInstance.post(
          "/api/sales",
          salesPayload,
          { headers }
        );
        savedBill = data;
      }

      /* ------------------------------------------------------------------
          ⭐ Show bill & print
         ------------------------------------------------------------------ */
      setViewBill(savedBill);
      setPrintView(true);


      /* ⭐ PRINT BILL (IMPORTANT FIX) */
      openBillPrintWindow(savedBill, selectedShop);

      try {
        const billToPrint = {
          billNo: savedBill.billNo,
          date: new Date(savedBill.date).toLocaleString(),
          customerName: savedBill.customerName || "Cash Customer",
          items: savedBill.items || [],
          total: savedBill.total,
          netAmount: savedBill.netAmount,
          cashGiven: savedBill.cashGiven,
          balance: savedBill.balance,
        };

        await axiosInstance.post("/api/print-bill", {
          bill: billToPrint,
        });
      } catch (printErr) {
        console.error("Print error:", printErr);
      }

      const newOriginalMap = {};
      validItems.forEach((r) => {
        newOriginalMap[r.id] = {
          code: r.code,
          batch: r.batch,
          qty: Number(r.qty),
        };
      });
      setOriginalBillItems(newOriginalMap);

      setShowModal(false);
      setRows([createEmptyRow()]);
      setTotals({
        total: 0,
        discount: 0,
        netAmount: 0,
        cashGiven: 0,
        balance: 0,
        cgst: 0,
        sgst: 0,
      });
      setMeta((prev) => ({ ...prev, customerName: "", mobile: "" }));
      setErrorMsg("");
      setBillEditMode(false);
      setEditingBillId(null);

      showPopup("Bill saved.");
      await fetchBills(1);

      // 3) Open thermal print window
      // openBillPrintWindow(data.bill);
    } catch (err) {
      console.error("handleSaveAndPrint", err);
      setErrorMsg(err.response?.data?.message || "Failed to save/print");
    } finally {
      isSavingRef.current = false;
      setSaving(false);
    }
  };


  const handleEditBill = (bill) => {
    if (!bill) return;
    setBillEditMode(true);
    setEditingBillId(bill._id);
    setShowModal(true);

    // Ensure rows keep isInclusive & computed fields if present in bill.items
    const rowsWithId = (bill.items || []).map((item, idx) => {
      // If the incoming item has isInclusive or taxMode info use it, else infer later
      const constructed = {
        ...item,
        id: item._id || `item-${idx}-${Date.now()}`,
        isNew: false,
      };
      // keep numeric types consistent
      constructed.qty = Number(constructed.qty || 0);
      constructed.rate = Number(constructed.rate || 0);
      constructed.gst = Number(constructed.gst || 0);
      // If the server already sent taxable/gstAmount/value use those; otherwise recalc in UI via recalcRow logic
      return constructed;
    });
    setRows(rowsWithId);

    setMeta({
      billNo: bill.billNo || "",
      date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : "",
      counter: bill.counter || 1,
      customerName: bill.customerName || bill.meta?.customerName || "",
      mobile: bill.mobile || bill.meta?.mobile || "",
    });

    // Prefer server totals, but fallback to computing
    setTotals({
      total: Number(bill.total || bill.totals?.total || 0),
      discount: Number(bill.discount || bill.totals?.discount || 0),
      netAmount: Number(bill.netAmount || bill.totals?.netAmount || 0),
      cashGiven: Number(bill.cashGiven || 0),
      balance: Number(bill.balance || 0),
      cgst: Number(bill.cgst || 0),
      sgst: Number(bill.sgst || 0),
    });

    const origItemsMap = {};
    rowsWithId.forEach((item) => {
      origItemsMap[item.id] = {
        code: item.code,
        batch: item.batch,
        qty: Number(item.qty) || 0,
      };
    });
    setOriginalBillItems(origItemsMap);

    setTimeout(() => {
      document.querySelector('input[name="customerName"]')?.focus();
    }, 200);
  };


  useEffect(() => {
    const closeAll = (e) => {
      if (
        !e.target.closest(".suggestions-portal") &&
        !e.target.closest(".batch-portal") &&
        !e.target.closest("input")
      ) {
        setShowCodeList({});
        setShowNameList({});
        setShowBatchList({});
      }
    };
    document.addEventListener("click", closeAll);
    return () => document.removeEventListener("click", closeAll);
  }, []);


  // keyboard support (replace existing)
  const handleSuggestionKey = (e, rowId, field) => {
    const key = e.key;
    const list =
      field === "code"
        ? codeSuggestions[rowId] || []
        : nameSuggestions[rowId] || [];

    // Build flattened list for keyboard navigation (randomCode items first, then product code)
    const inputValue = (rows.find((r) => r.id === rowId)?.[field] || "").toLowerCase();

    const flattened = list.flatMap((p) => {
      const randomMatches = (p.batches || [])
        .filter((b) => b.randomCode?.toLowerCase().includes(inputValue))
        .map((b) => ({ product: p, batch: b, isRandom: true }));
      const codeMatch = p.code?.toLowerCase().includes(inputValue)
        ? [{ product: p, batch: null, isRandom: false }]
        : [];
      return [...randomMatches, ...codeMatch];
    });

    const len = flattened.length;
    const curIdx = activeSuggestionIndex[rowId] ?? -1;
    let idx = curIdx;

    // page size for PageUp/PageDown
    const PAGE_STEP = 5;

    if (key === "ArrowDown") {
      e.preventDefault();
      idx = Math.min(len - 1, idx + 1);
    } else if (key === "ArrowUp") {
      e.preventDefault();
      idx = Math.max(0, idx - 1);
    } else if (key === "PageDown") {
      e.preventDefault();
      idx = Math.min(len - 1, idx + PAGE_STEP);
    } else if (key === "PageUp") {
      e.preventDefault();
      idx = Math.max(0, idx - PAGE_STEP);
    } else if (key === "Enter") {
      if (idx >= 0 && flattened[idx]) {
        e.preventDefault();
        const selected = flattened[idx];
        const inputVal = (rows.find((r) => r.id === rowId)?.code || "").trim();
        const isBarcode = /^\d{6,}$/.test(inputVal);

        if (isBarcode && selected.isRandom) {
          // barcode flow — auto-fill from batch, hide batch dropdown
          const b = selected.batch;
          updateRow(rowId, "code", b.randomCode || selected.product.code);
          updateRow(rowId, "name", selected.product.name);
          updateRow(rowId, "batch", b.batchNo || "");
          updateRow(rowId, "mrp", b.mrp || 0);
          updateRow(rowId, "rate", b.rate || 0);
          updateRow(rowId, "gst", b.taxPercent || 0);
          updateRow(rowId, "qty", 0); // default 0 per your request
          setShowBatchList((prev) => ({ ...prev, [rowId]: false }));
        } else {
          // normal product/select flow
          handleSelectSuggestion(
            rowId,
            selected.isRandom ? { ...selected.product, batches: [selected.batch] } : selected.product,
            selected.isRandom
          );
          // if normal product, ensure batch dropdown shows (handleSelectSuggestion sets it)
          if (!selected.isRandom) {
            setShowBatchList((s) => ({ ...s, [rowId]: true }));
          }
        }

        // reset states
        setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
        setShowCodeList((s) => ({ ...s, [rowId]: false }));
        setShowNameList((s) => ({ ...s, [rowId]: false }));
      }
      return;
    } else if (key === "Escape") {
      setShowCodeList((s) => ({ ...s, [rowId]: false }));
      setShowNameList((s) => ({ ...s, [rowId]: false }));
      setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
      return;
    } else {
      // any other key -> reset index
      setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
      return;
    }

    // update active index so UI highlight updates
    setActiveSuggestionIndex((s) => ({ ...s, [rowId]: idx }));
  };


  // ---------------- Portals (render near inputs) ----------------

  const openAddModal = async () => {


    // 🔥 first reset everything to fresh state
    resetBillState();

    setBillEditMode(false);

    // 🔥 FETCH NEW BILL FROM BACKEND
    await fetchBillNo();  // ⬅ your backend API


    // setBillEditMode(false);
    setMeta((prev) => ({
      ...prev,
      billNo: prev.billNo || "",
      customerName: "",
      mobile: "",
      counter: prev.counter,
      date: new Date().toISOString().slice(0, 10),
    }));
    setTotals({
      total: 0,
      discount: 0,
      netAmount: 0,
      cashGiven: 0,
      balance: 0,
      cgst: 0,
      sgst: 0,
    });
    setRows([createEmptyRow()]);
    setStockErrors({});
    setErrorMsg("");
    setShowModal(true);
    resetPayment();

    // 🧭 Auto-focus first Product Code input after modal opens
    setTimeout(() => {
      const firstCodeInput = document.querySelector(
        'input[data-field="code"]'
      );
      if (firstCodeInput) {
        firstCodeInput.focus();
        firstCodeInput.select(); // optional: highlight previous text
      }
    }, 300); // delay to ensure modal is rendered
  };


  const resetBillState = () => {
    // --- reset meta ---
    setMeta({
      billNo: "",
      customerName: "",
      mobile: "",
      counter: Number(localStorage.getItem("counter")) || 1,
      date: new Date().toISOString().slice(0, 10),
    });

    // --- reset totals ---
    setTotals({
      total: 0,
      discount: 0,
      discountPercent: 0,
      netAmount: 0,
      cashGiven: 0,
      balance: 0,
      cgst: 0,
      sgst: 0,
    });

    // --- reset rows ---
    setRows([createEmptyRow()]);

    // --- reset flags ---
    setStockErrors({});
    setErrorMsg("");

    // --- reset scanning locks ---
    scanLockRef.current = false;
    lastRawBarcodeRef.current = null;
    lastScan.current = { code: "", time: 0 };

    // --- reset suggestion lists ---
    setShowCodeList({});
    setShowNameList({});
    setShowBatchList({});
    setCodeSuggestions({});
    setNameSuggestions({});
    setBatchesByRow({});
    // set default payment = cash with current netAmount
    setPaymentMethod("cash");
    setPayment({
      cash: Number(0),   // will be synced after totals update
      upi: 0
    });

  };





  const resetPayment = () => {
    setPaymentMethod("cash");
    setPayment({
      cash: Number(totals?.netAmount || 0),
      upi: 0
    });
  };

  useEffect(() => {
    if (paymentMethod === "cash") {
      setPayment((p) => ({
        ...p,
        cash: Number(totals.netAmount || 0),
        upi: 0
      }));
    }
  }, [totals.netAmount]);



  const renderCodeSuggestionPortal = (rowId) => {
    if (!portalRoot) return null;

    const list = codeSuggestions[rowId] || [];
    if (!showCodeList[rowId] || list.length === 0) return null;

    const inputEl = document.querySelector(`input[data-row="${rowId}"][data-field="code"]`);
    const rect = inputEl?.getBoundingClientRect() || { top: 0, left: 0, width: 240, height: 24 };

    const style = {
      position: "fixed",
      top: rect.top + rect.height + 6,
      left: rect.left,
      // minWidth: Math.max(240, rect.width),

        width: 320,          
  maxWidth: 360,
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #ddd",
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      maxHeight: 320,
      overflowY: "auto",
      padding: "6px 0",
    };

    const inputValue = (rows.find((r) => r.id === rowId)?.code || "").toLowerCase();

    const flattened = list.flatMap((p) => {
      const randomMatches = (p.batches || [])
        .filter((b) => b.randomCode?.toLowerCase().includes(inputValue))
        .map((b) => ({ product: p, batch: b, isRandom: true }));
      const codeMatch = p.code?.toLowerCase().includes(inputValue)
        ? [{ product: p, batch: null, isRandom: false }]
        : [];
      return [...randomMatches, ...codeMatch];
    });

    const activeIdx = activeSuggestionIndex[rowId] ?? -1;

    return ReactDOM.createPortal(
      <div
        style={style}
        className="suggestions-portal"
        role="listbox"
        onMouseDown={() => (isClickInsideSuggestion.current = true)}
      >
        {flattened.map((item, i) => (
          <div
            key={`${item.product._id}-${i}`}
            className="suggestion"
            role="option"
            onMouseEnter={() => setActiveSuggestionIndex((s) => ({ ...s, [rowId]: i }))}
            onMouseDown={(e) => {
              e.preventDefault();
              const inputVal = (rows.find((r) => r.id === rowId)?.code || "").trim();
              const isBarcode = /^\d{6,}$/.test(inputVal);



              if (isBarcode && item.isRandom) {
                const b = item.batch;

                // 🔥 Fill row
                updateRow(rowId, "code", b.randomCode || item.product.code);
                updateRow(rowId, "name", item.product.name);
                updateRow(rowId, "batch", b.batchNo || "");
                updateRow(rowId, "mrp", b.mrp || 0);
                updateRow(rowId, "rate", b.salePrice || b.rate || 0);
                updateRow(rowId, "gst", b.taxPercent || 0);

                // qty EMPTY for manual mode
                updateRow(rowId, "qty", "");

                // close batch list
                setShowBatchList((s) => ({ ...s, [rowId]: false }));

                // 🔥🔥 Focus qty input after fill
                setTimeout(() => {
                  const q = document.querySelector(
                    `input[data-row="${rowId}"][data-field="qty"]`
                  );
                  if (q) q.focus();
                }, 20);

              } else {
                // normal suggestion flow
                handleSelectSuggestion(
                  rowId,
                  item.isRandom ? { ...item.product, batches: [item.batch] } : item.product,
                  item.isRandom
                );

                // Show batches to let user pick manually
                setShowBatchList((s) => ({ ...s, [rowId]: true }));

                // 🔥 If suggestion selection is RANDOM → jump to qty
                if (item.isRandom) {
                  setTimeout(() => {
                    const q = document.querySelector(
                      `input[data-row="${rowId}"][data-field="qty"]`
                    );
                    if (q) q.focus();
                  }, 20);
                }
              }


              setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
              setShowCodeList((s) => ({ ...s, [rowId]: false }));
            }}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              borderBottom: "1px solid #f4f4f4",
              background: activeIdx === i ? "#E6FFE6" : item.isRandom ? "#f6fff6" : "#fff",
            }}
          >
            {item.isRandom ? (
              <div style={{ fontWeight: 700 }}>{item.batch.randomCode}</div>
            ) : (
              <>
                <div style={{ fontWeight: 700 }}>{item.product.code}</div>
                {/* <div style={{ fontSize: 12, color: "#444" }}>{item.product.name}</div> */}

    <div
  title={item.product.name}   // ✅ hover full text
  style={{
    fontSize: 12,
    color: "#444",
    marginTop: 2,

    whiteSpace: "normal",
    wordBreak: "break-word",

    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",

    overflow: "hidden",
    textOverflow: "ellipsis",

    lineHeight: "16px",
    maxHeight: "48px",
  }}
>
  {item.product.name}
</div>
              </>
            )}
          </div>
        ))}
      </div>,
      portalRoot
    );
  };

  const renderNameSuggestionPortal = (rowId) => {
    if (!portalRoot) return null;
    const list = nameSuggestions[rowId] || [];
    if (!showNameList[rowId] || list.length === 0) return null;

    const inputEl = document.querySelector(
      `input[data-row="${rowId}"][data-field="name"]`
    );
    const rect =
      inputEl?.getBoundingClientRect() || { top: 0, left: 0, width: 240, height: 24 };

    const style = {
      position: "fixed",
      top: rect.top + rect.height + 6,
      left: rect.left,
      // minWidth: Math.max(240, rect.width),

      

  width: 320,        
  maxWidth: 360,
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #ddd",
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      maxHeight: 320,
      overflowY: "auto",
      padding: "6px 0",
    };

    // flattened for name is simply product matches (no randomCode priority for name)
    const inputValue = (rows.find((r) => r.id === rowId)?.name || "").toLowerCase();
    const flattened = list.filter((p) => p.name?.toLowerCase().includes(inputValue));

    const activeIdx = activeSuggestionIndex[rowId] ?? -1;

    return ReactDOM.createPortal(
      <div
        className="suggestions-portal"
        style={style}
        role="listbox"
        onMouseDown={() => {
          isClickInsideSuggestion.current = true;
        }}
      >
        {flattened.map((p, i) => (
          <div
            key={p._id || `${p.code}-${p.name}-${i}`}
            className="suggestion"
            role="option"
            onMouseEnter={() => setActiveSuggestionIndex((s) => ({ ...s, [rowId]: i }))}
            onMouseDown={(e) => {
              e.preventDefault();
              isClickInsideSuggestion.current = true;
              handleSelectSuggestion(rowId, p);
              setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
              setShowNameList((s) => ({ ...s, [rowId]: false }));
            }}
            style={{
              padding: "10px 12px",
              cursor: "pointer",
              borderBottom: "1px solid #f4f4f4",
              background: activeIdx === i ? "#E6FFE6" : "white",
            }}
          >
            {/* <div style={{ fontWeight: 700 }}>{p.name}</div> */}

            <div
  title={p.name}   // ✅ full text on hover
  style={{
    fontWeight: 700,

    // ✅ MULTI LINE SUPPORT
    whiteSpace: "normal",
    wordBreak: "break-word",

    // ✅ MAX 3 LINES
    display: "-webkit-box",
    WebkitLineClamp: 3,
    WebkitBoxOrient: "vertical",

    overflow: "hidden",
    textOverflow: "ellipsis",

    lineHeight: "16px",
    maxHeight: "48px",
  }}
>
  {p.name}
</div>
            <div style={{ fontSize: 12 }}>{p.code}</div>
          </div>
        ))}
      </div>,
      portalRoot
    );
  };


  const normalizeKey = (str = "") =>
    str.toString().trim().toLowerCase().replace(/\s+/g, "");

  const getStockKey = (code, batch) =>
    `${normalizeKey(code)}_${normalizeKey(batch)}`;








  /* -------------------- TRUE AVAILABLE STOCK -------------------- */
  const getRowsReservedForKey = (code, batch, excludeRowId = null) => {
    // Sum of quantities in the UI rows (this is ALWAYS the UI's view of reserved qty)
    // excludeRowId: optional — if provided we exclude that row (useful during editing checks)
    if (!code || !batch) return 0;

    const nCode = normalizeKey(code);
    const nBatch = normalizeKey(batch);

    let sum = 0;
    for (const r of rows) {
      if (
        excludeRowId && r.id === excludeRowId
      ) {
        // skip this row when explicitly asked
        continue;
      }
      if (
        normalizeKey(r.code) === nCode &&
        normalizeKey(r.batch) === nBatch &&
        Number(r.qty) > 0
      ) {
        sum += Number(r.qty || 0);
      }
    }
    return sum;
  };




  /* -------------------- TRUE AVAILABLE STOCK (SCAN-AWARE) -------------------- */
  const getAvailableStock = (code, batch) => {
    if (!code || !batch) return 0;

    const nC = normalizeKey(code);
    const nB = normalizeKey(batch);

    const product = products.find((p) => normalizeKey(p.code) === nC);
    if (!product) return 0;

    const batchObj = (product.batches || []).find(
      (b) => normalizeKey(b.batchNo) === nB
    );
    if (!batchObj) return 0;

    const baseStock = Number(batchObj.qty || 0);

    // UI rows always reflect TRUE reservations
    const rowsReserved = getRowsReservedForKey(code, batch);

    // DO NOT subtract reservedStock again → this caused double subtraction
    return Math.max(0, baseStock - rowsReserved);
  };




  /* -------------------- RENDER BATCH PORTAL (patched) -------------------- */
  const renderBatchPortal = (rowId) => {
    if (!portalRoot) return null;

    const list = batchesByRow[rowId] || [];
    if (!showBatchList[rowId] || list.length === 0) return null;

    const inputEl = document.querySelector(
      `input[data-row="${rowId}"][data-field="batch"]`
    );
    const rect =
      inputEl?.getBoundingClientRect() || { top: 0, left: 0, width: 300, height: 24 };

    const style = {
      position: "fixed",
      top: rect.top + rect.height + 6,
      left: rect.left,
      // minWidth: Math.max(480, rect.width),

        width: 550,        
  maxWidth: 600,
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #eee",
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      maxHeight: 320,
      overflowY: "auto",
      padding: 8,
    };

    const activeIdx = activeSuggestionIndex[`batch-${rowId}`] ?? -1;
    const codeForRow = rows.find((r) => r.id === rowId)?.code || "";

    return ReactDOM.createPortal(
      <div
        key={`${rowId}-${batchRenderKey}`}
        className="batch-portal"
        style={style}
        onMouseDown={() => (isClickInsideBatchPortal.current = true)}
      >
        <table style={{ width: "100%", borderCollapse: "collapse",  tableLayout: "fixed" }}>
          <thead>
            <tr style={{ background: "#fafafa", fontSize: 13 }}>
              <th style={{ padding: 6, width: "50%" }}>Batch</th>
              <th style={{ padding: 6 , width: "15%"}}>MRP</th>
              <th style={{ padding: 6, width: "15%" }}>Rate</th>
              <th style={{ padding: 6, width: "10%" }}>GST%</th>
              <th style={{ padding: 6,  width: "15%",textAlign: "right" }}>Stock</th>
            </tr>
          </thead>

          <tbody>
            {list.map((b, i) => {
              const nb = normalizeBatch(b);
              const baseQty = Number(nb.qty || 0);

              // 🔥 TRUE rowsReserved: all UI rows for same code+batch
              const rowsReserved = getRowsReservedForKey(codeForRow, nb.batchNo);

              // 🔥 FINAL available stock (NO externalReserved!)
              const available = Math.max(0, baseQty - rowsReserved);

              const outOfStock = available <= 0;

              return (
                <tr
                  key={`${nb.batchNo}-${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    isClickInsideBatchPortal.current = true;

                    if (outOfStock) {
                      showPopup(`Batch ${nb.batchNo} is OUT OF STOCK.`, "error");
                      return;
                    }

                    handleBatchPick(rowId, nb);
                  }}
                  onMouseEnter={() =>
                    setActiveSuggestionIndex((s) => ({
                      ...s,
                      [`batch-${rowId}`]: i,
                    }))
                  }
                  style={{
                    cursor: outOfStock ? "not-allowed" : "pointer",
                    borderBottom: "1px solid #f4f4f4",
                    background:
                      activeIdx === i
                        ? "#E6FFE6"
                        : outOfStock
                          ? "rgba(255,0,0,0.05)"
                          : "transparent",
                    opacity: outOfStock ? 0.6 : 1,
                     lineHeight: "25px", 
                  }}
                >

                  <td
  style={{
    padding: 6,
    fontWeight: 600,

    whiteSpace: "normal",
    wordBreak: "break-word",

    display: "-webkit-box",
    WebkitLineClamp: 4,          // ✅ max 2 lines
    WebkitBoxOrient: "vertical",

    overflow: "hidden",
    textOverflow: "ellipsis",

    lineHeight: "16px",
    maxHeight: "75px",
  }}
  title={nb.batchNo}   // ✅ hover full value
>
  {nb.batchNo}
</td>
                  {/* <td style={{ padding: 6, fontWeight: 600 }}>{nb.batchNo}</td> */}
                  <td style={{ padding: 6 }}>{Number(nb.mrp || 0).toFixed(2)}</td>
                  <td style={{ padding: 6 }}>{Number(nb.rate || 0).toFixed(2)}</td>
                  <td style={{ padding: 6 }}>{nb.gst}%</td>
                  <td
                    style={{
                      padding: 6,
                      color: outOfStock ? "red" : "inherit",
                      fontWeight: outOfStock ? 700 : 400,
                      textAlign: "right",
                    }}
                  >
                    {available}
                  </td>
                </tr>
              );
            })}

          </tbody>
        </table>
      </div>,
      portalRoot
    );
  };






  // helper: resolve by code, name, randomCode (normalized)
  const findProductByKey = (key) => {
    if (!key) return null;

    const k = normalizeKey(key);

    // 1) randomCode FIRST (highest priority)
    for (const p of products) {
      const batch = (p.batches || []).find(
        b => normalizeKey(b.randomCode) === k
      );
      if (batch) return { product: p, matchedBatch: batch };
    }

    // 2) match product code
    const byCode = products.find(
      p => normalizeKey(p.code) === k
    );
    if (byCode) return { product: byCode, matchedBatch: null };

    // 3) match product name
    const byName = products.find(
      p => normalizeKey(p.name) === k
    );
    if (byName) return { product: byName, matchedBatch: null };

    return null;
  };





  function finalizeRow(rowId) {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    const isScan = row._scanMode === true;

    const filledRow = {
      ...row,
      isNew: false,
      _scanMode: false,
    };

    setRows((prev) => {
      const updated = prev.map((r) =>
        r.id === rowId ? recalcRow(filledRow) : r
      );

      const last = updated[updated.length - 1];
      if (last && (last.code || last.name || last.batch)) {
        updated.push(createEmptyRow());
      }

      return updated;
    });

    const k = getStockKey(filledRow.code, filledRow.batch);
    setReservedStock((rs) => ({ ...rs, [k]: Number(rs[k] || 0) }));
  }





  // finalizeRowWithData(rowId, rowData)


  function finalizeRowWithData(rowId, filledRow) {
    const k = getStockKey(filledRow.code, filledRow.batch);

    setRows((prev) => {
      const updated = prev.map((r) =>
        r.id === rowId
          ? recalcRow({
            ...filledRow,
            isNew: false,
            _scanMode: false,
          })
          : r
      );

      console.log(
        "%cFINALIZE → BEFORE recalcRow",
        "color: purple",
        filledRow
      );


      const last = updated[updated.length - 1];
      if (last && (last.code || last.name || last.batch)) {
        updated.push(createEmptyRow());
      }

      return updated;
    });

    setReservedStock((rs) => ({ ...rs, [k]: Number(rs[k] || 0) }));
  }



  // -------------------- TRUE AVAILABLE STOCK FOR MANUAL ENTRY --------------------
  // Manual mode should NOT subtract `reservedStock` (scanner reservations).
  // It should only consider already-finalized rows (non-new) so typing qty is
  // validated against actual stock minus already-finalized quantities.
  const getAvailableStockManual = (code, batch, excludeRowId = null) => {
    if (!code || !batch) return 0;

    const nC = normalizeKey(code);
    const nB = normalizeKey(batch);

    const product = products.find((p) => normalizeKey(p.code) === nC);
    if (!product) return 0;

    const batchObj = (product.batches || []).find(
      (b) => normalizeKey(b.batchNo) === nB
    );
    if (!batchObj) return 0;

    const baseStock = Number(batchObj.qty || 0);

    // Sum qty only for finalized rows (isNew === false). Optionally exclude row being edited.
    const finalizedReserved = (rows || [])
      .filter((r) => !r.isNew && r.id !== excludeRowId)
      .reduce((acc, r) => {
        if (
          normalizeKey(r.code) === nC &&
          normalizeKey(r.batch) === nB &&
          Number(r.qty)
        ) {
          return acc + Number(r.qty || 0);
        }
        return acc;
      }, 0);

    return Math.max(0, baseStock - finalizedReserved);
  };




  const addRow = (id) => {
    setRows((prev) => {
      const row = prev.find((r) => r.id === id);
      if (!row) return prev;

      const isScan = row._scanMode === true;

      // ------------------------------
      // MANUAL VALIDATION
      // ------------------------------
      if (!isScan) {
        if (!row.code || !row.name || !row.batch) {
          showPopup("Fill required fields", "error");
          return prev;
        }
        if (!(Number(row.qty) > 0)) {
          showPopup("Fill required fields", "error");
          return prev;
        }
        if (!(Number(row.rate) > 0)) {
          showPopup("Fill required fields", "error");
          return prev;
        }
      }

      const qtyValue = Number(row.qty || 0);

      const product = products.find(
        (p) => normalizeKey(p.code) === normalizeKey(row.code)
      );
      const batchObj = product?.batches?.find(
        (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
      );

      const baseStock = Number(batchObj?.qty || 0);
      const k = getStockKey(row.code, row.batch);

      // SCAN uses live stock
      // MANUAL uses reserved-row-based stock
      const available = isScan
        ? getAvailableStock(row.code, row.batch)
        : getAvailableStockManual(row.code, row.batch);

      if (qtyValue > available) {
        showPopup(`Only ${available} available`, "error");
        return prev;
      }

      let updated = [...prev];

      // -------------------------------------
      // Merge duplicate rows
      // -------------------------------------
      const existingIndex = updated.findIndex(
        (r) =>
          !r.isNew &&
          normalizeKey(r.code) === normalizeKey(row.code) &&
          normalizeKey(r.batch) === normalizeKey(row.batch)
      );

      if (existingIndex !== -1) {
        const exRow = updated[existingIndex];
        const mergedQty = Number(exRow.qty || 0) + qtyValue;

        if (mergedQty > baseStock) {
          showPopup(`Only ${baseStock} available`, "error");
          return prev;
        }

        updated = updated
          .map((r, i) =>
            i === existingIndex ? recalcRow({ ...r, qty: mergedQty }) : r
          )
          .filter((r) => r.id !== id);

        const last = updated[updated.length - 1];
        if (last.code || last.name || last.batch) {
          updated.push(createEmptyRow());
        }

        setReservedStock((rs) => ({
          ...rs,
          [k]: Number(rs[k] || 0) + qtyValue,
        }));

        return updated;
      }

      // -------------------------------------
      // Mark as filled row
      // -------------------------------------
      updated = updated.map((r) =>
        r.id === id ? { ...r, isNew: false, _scanMode: false } : r
      );

      const lastRow = updated[updated.length - 1];
      if (lastRow.code || lastRow.name || lastRow.batch) {
        updated.push(createEmptyRow());
      }

      setReservedStock((rs) => ({ ...rs, [k]: Number(rs[k] || 0) }));

      return updated;
    });
  };

  const deleteRow = (id) => {
    const row = rows.find((r) => r.id === id);
    if (row && !row.isNew) {
      const k = getStockKey(row.code, row.batch);
      setReservedStock((rs) => ({ ...rs, [k]: Math.max(0, Number(rs[k] || 0) - Number(row.qty || 0)) }));
    }
    setRows((prev) => prev.filter((r) => r.id !== id));
  };



  // -------------------- CANCEL EDIT (rollback) --------------------

  const cancelRowEdit = () => {
    if (!editRowId) return;
    setRows((prev) => prev.map((r) => (r.id === editRowId ? { ...originalRowData[editRowId] } : r)));
    setOriginalRowData((prev) => {
      const copy = { ...prev };
      delete copy[editRowId];
      return copy;
    });
    setEditRowId(null);
  };




  /* -------------------- SAVE EDIT -------------------- */
  const saveRowEdit = async (rowId) => {
    const row = rows.find((r) => r.id === rowId);
    if (!row) return;

    if (!row.code || !row.name || !row.batch) {
      showPopup("Please fill all required fields.", "error");
      return;
    }

    const oldQty = Number(originalBillItems?.[rowId]?.qty ?? originalRowData?.[rowId]?.qty ?? 0);
    const newQty = Number(row.qty || 0);
    const diff = newQty - oldQty;

    const k = getStockKey(row.code, row.batch);

    const product = products.find((p) => normalizeKey(p.code) === normalizeKey(row.code));
    const batchObj = product?.batches?.find((b) => normalizeKey(b.batchNo) === normalizeKey(row.batch));
    const baseStock = Number(batchObj?.qty || 0);

    // rowsReserved includes current row. For availability check we need to
    // consider reserved by other UI rows (exclude current row).
    const rowsReservedExcludingThis = getRowsReservedForKey(row.code, row.batch, rowId);
    const rawReserved = Number(reservedStock[k] || 0);
    const externalReserved = Math.max(0, rawReserved - rowsReservedExcludingThis);

    // available outside this row (what others + external have left)
    const availableOutside = Math.max(0, baseStock - (rowsReservedExcludingThis + externalReserved));

    if (diff > 0 && diff > availableOutside) {
      showPopup(`Only ${baseStock} available`, "error");
      setStockErrors((prev) => ({ ...prev, [rowId]: `Only ${baseStock} available` }));
      return;
    }

    // Apply update to UI
    setRows((prev) =>
      prev.map((r) => (r.id === rowId ? { ...r, qty: newQty, isNew: false, edited: true } : r))
    );

    // Update originalBillItems baseline
    setOriginalBillItems((prev) => ({ ...prev, [rowId]: { code: row.code, batch: row.batch, qty: newQty } }));

    // reservedStock is external; we must not re-write it to rows sum.
    // However if reservedStock previously included this row (due to older buggy behavior)
    // we adjust it to ensure it still represents only external reservations:
    setReservedStock((rs) => {
      const prevRaw = Number(rs[k] || 0);
      // compute current UI rows reserved (including this row after update)
      const rowsReservedNow = getRowsReservedForKey(row.code, row.batch);
      // if reservedStock contained UI sum (prevRaw === rowsReservedNow - newQty etc) we leave it as-is,
      // otherwise just ensure the key exists (defensive).
      return { ...rs, [k]: prevRaw };
    });

    showPopup("Row updated.", "success");
    setEditRowId(null);
  };


  // -------------------- AUTO RERENDER BATCH LIST --------------------
  useEffect(() => {
    setBatchRenderKey((k) => k + 1);
  }, [products, reservedStock]);

  function handleEnterKey(e) {
    if (e.key === "Enter") {
      e.preventDefault();
      const form = e.target.form;
      if (!form) return;
      const elements = Array.from(form.elements).filter(
        (el) => el.tagName === "INPUT" && el.type !== "hidden"
      );
      const index = elements.indexOf(e.target);
      if (elements[index + 1]) {
        elements[index + 1].focus();
      }
    }
  }








  async function processBarcodeScan(code, input) {
    if (scanLockRef.current) return;
    scanLockRef.current = true;

    try {
      const results = await fetchByScanRandomCode(code);
      const product = results?.[0];
      if (!product) {
        showPopup("Invalid barcode", "error");
        return;
      }

      const batch = findBatchByRandomCode(product, code);
      if (!batch) {
        showPopup("Batch not found", "error");
        return;
      }

      const activeRowId = input.dataset.row;

      setRows((prev) => {
        const existingRow = prev.find(
          (r) =>
            !r.isNew &&
            normalizeKey(r.code) === normalizeKey(product.code) &&
            normalizeKey(r.batch) === normalizeKey(batch.batchNo)
        );

        // 🔁 DUPLICATE SCAN → INCREMENT QTY
        if (existingRow) {
          return prev.map((r) => {
            if (r.id === existingRow.id) {
              const nextQty = Number(r.qty || 0) + 1;
              return recalcRow({
                ...r,
                qty: nextQty,
                openingStock: Number(batch.qty || 0),
                closingStock: Math.max(
                  0,
                  Number(batch.qty || 0) - nextQty
                ),
              });
            }

            // clear active scan row only
            if (r.id === activeRowId) {
              return {
                ...r,
                code: "",
                name: "",
                batch: "",
                mrp: 0,
                rate: 0,
                gst: 0,
                qty: 0,
                isNew: true,
              };
            }

            return r;
          });
        }

        // 🆕 NEW SCAN → FILL ACTIVE ROW
        return prev.map((r) =>
          r.id === activeRowId
            ? recalcRow({
              code: product.code,
              name: product.name,
              batch: batch.batchNo,
              mrp: Number(batch.mrp),
              rate: Number(batch.salePrice),
              qty: 1,
              gst: Number(product.taxPercent || 0),
              taxMode: product.taxMode,
              isInclusive: product.taxMode === "inclusive",
              openingStock: Number(batch.qty || 0),
              closingStock: Number(batch.qty || 0) - 1,
              isNew: false,
            })
            : r
        );
      });
    } finally {
      scanBufferRef.current = "";
      scanLockRef.current = false;

      requestAnimationFrame(() => {
        document
          .querySelector('input[data-field="code"][data-row]:last-of-type')
          ?.focus();
      });
    }
  }



  const focusNextEmptyRow = () => {
    setTimeout(() => {
      const next = rows.find(r => r.isNew && (!r.code && !r.name));
      if (next) {
        const input = document.querySelector(
          `input[data-row="${next.id}"][data-field="code"]`
        );
        if (input) input.focus();
      }
    }, 80);
  };


  useEffect(() => {
    const savedCounter = localStorage.getItem("counter");

    setMeta((prev) => ({
      ...prev,
      counter: Number(savedCounter) || 1,  // default counter 1
    }));
  }, []);






  return (
    <div className="salesbill-container p-8 pt-10 sm:pt-10">
      {/* ✅ Popup Message */}
      {popup.message && (
        <div className={`popup-message ${popup.type}`}>{popup.message}</div>
      )}

      {/* Header */}
      <div className="salesbill-header">
        <div>
          <h1 className="salesbill-title" style={{ color: "#008f5e" }}>Sales Bill</h1>
        </div>
        <button className="  
      
       inline-flex items-center gap-2
       px-[14px] py-[10px]
      
       
      rounded-lg 
    font-semibold
    text-[#007867]
    bg-[#c8fad6]
    shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
    transition-all duration-150
    hover:-translate-y-[1px]
    active:translate-y-0 " onClick={openAddModal}>
          <FaPlus /> Add Sale Bill
        </button>

      </div>

      {/* Toolbar */}

      <div className="flex flex-wrap items-center p-4 space-x-3 space-y-3 lg:space-y-0 lg:space-x-3">
        {/* Left: Search Box */}
        <div className="flex min-w-[200px]">
          <input
            type="text"
            placeholder="Search: Bill No / Customer / Mobile "
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="!w-[350px] !md:w-[350px]  h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition placeholder-gray-400"
          />
        </div>



        <div className="flex min-w-[200px]">
          <input
            type="number"
            placeholder="Counter No"
            value={counterFilter}
            onChange={(e) => setCounterFilter(e.target.value)}
            className="!w-[200px] !md:w-[350px]  h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition placeholder-gray-400"
          />

        </div>

        {/* Middle: Filter */}

        <div className="flex items-center gap-2 min-w-[100px]">

          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-[100px] h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
          >
            <option value="">All Date</option>
            <option value="today">Today</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
            <option value="custom">Custom Date</option>
          </select>



          {filter === "custom" && (
            <div className="flex gap-1 animate-fadeIn">
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="w-[100px] h-8 text-sm border rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
              />
              <span className="self-center text-sm">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[100px] h-8 text-sm border rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
              />
            </div>
          )}
        </div>

        <div className="flex items-center gap-2 min-w-[100px]">
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="w-[120px] h-8 border rounded px-2 text-sm"
          >
            <option value="all">All Status</option>
            <option value="active">Active</option>
            <option value="cancelled">Cancelled</option>

          </select>
        </div>

      </div>




      {/* Table List */}
      <div className="salesbill-table-wrapper overflow-x-auto bg-white rounded-lg shadow p-4">
        {loading ? (
          <p className="text-gray-400 text-center py-4">Loading…</p>
        ) : bills.length === 0 ? (
          <p className="text-gray-400 text-center py-4">No records found</p>
        ) : (
          <>
            <table className="table-auto w-full min-w-[900px] border-collapse">
              <thead className="bg-gray-100">
                <tr>
                  <th className="px-4 py-2 text-left">S.No</th>
                  <th className="px-4 py-2 text-left">Counter</th>
                  <th className="px-4 py-2 text-left">Bill No</th>
                  <th className="px-4 py-2 text-left">Date</th>
                  <th className="px-4 py-2 text-left">Customer</th>
                  <th className="px-4 py-2 text-left">Mobile</th>
                  <th className="px-4 py-2 text-left">Status</th>
                  <th className="px-4 py-2 text-right">Net Amount</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>
              <tbody>
                {bills.map((bill, i) => (
                  <tr key={bill._id} className="hover:bg-green-80 transition-colors">
                    <td className="px-4 py-2">{(Number(page) - 1) * Number(limit) + i + 1}</td>

                    {/* ⭐ NEW: Counter */}
                    <td className="px-4 py-2">Counter -  {bill.counter || "-"}</td>

                    <td className="px-4 py-2">{bill.billNo}</td>
                    <td className="px-4 py-2">{formatDate(bill.date)}</td>
                    <td className="px-4 py-2">{bill.customerName}</td>

                    {/* ⭐ NEW: Mobile */}
                    <td className="px-4 py-2">{bill.mobile || "-"}</td>



                    <td className="px-4 py-2">
                      {bill.status?.toLowerCase() === "active" ? (
                        (() => {
                          const cancelledCount = bill.items.filter(i => i.status === "cancelled").length;

                          return (
                            <div className="flex flex-col">
                              {/* Main status */}
                              <span className="flex items-center gap-1 text-green-600 font-semibold">
                                <FaCheckCircle />
                                Active
                              </span>

                              {/* Show cancelled count if > 0 */}
                              {cancelledCount > 0 && (
                                <span className="text-red-500 text-xs ml-6">
                                  ({cancelledCount} product{cancelledCount > 1 ? "s" : ""} cancelled)
                                </span>
                              )}
                            </div>
                          );
                        })()
                      ) : (
                        <span className="flex items-center gap-1 text-red-600 font-semibold">
                          <FaTimesCircle />
                          Cancelled
                        </span>
                      )}
                    </td>



                    <td className="px-4 py-2 text-right">
                      ₹{Number(bill.netAmount || 0).toFixed(2)}
                    </td>

                    <td className="px-4 py-2 text-center">
                      <div className="flex justify-center gap-2">
                        {/* <button
                    onClick={() => setViewBill(bill)}
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
                    onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#007867")}
                    onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00A76F")}
                  >
                    <FaEye />
                  </button> */}

                        <button
                          // onClick={() => setViewBill(bill)}
                          onClick={() => {
                            setViewBill(bill);
                            setShowViewModal(true);   // <-- this opens the modal
                          }}
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
                          onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#007867")}
                          onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00A76F")}
                        >
                          <FaEye />
                        </button>

                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="mt-3">
              {/* <Pagination page={page} totalPages={totalPages} onPageChange={fetchBills} /> */}
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => {
                  if (p === page) return; // prevent duplicate click
                  setPage(p);
                }}
              />
            </div>
          </>
        )}
      </div>


      {/* Add Modal */}
      {showModal && (
        <div className="modal fade-in">
          <div className="modal-content slide-up large relative">
            {saving && (
              <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>

                  <span className="text-green-700 font-semibold text-base">
                    Printing Bill...
                  </span>
                </div>
              </div>
            )}




            <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>

              <div className="modal-header">
                <h2>{billEditMode ? "Edit Bill" : "Add Sales"}</h2>
                <button className="icon-close" onClick={() => {
                  resetBillState();    // 🔥 FULL PAGE RESET
                  setShowModal(false);
                }}
                >
                  ×
                </button>
              </div>

              {/* Meta */}
              <form className="bill-meta">
                <div className="meta-grid">


                  <label className="">
                    Counter:
                    <input
                      type="text"
                      value={meta.counter || ""}
                      readOnly
                      style={{ background: "#f8f8f8", width: "150px" }}
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
                    />
                  </label>

                  <label className="">
                    Bill No:
                    <input
                      type="text"
                      value={meta.billNo || ""}
                      readOnly
                      style={{ background: "#f8f8f8", width: "150px" }}
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
                    />
                  </label>



                  <label>
                    Date <input type="date" value={meta.date} readOnly className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400" />
                  </label>



                  <label style={{ flex: "2", position: "relative" }}>
                    Customer Name
                    <input
                      value={meta.customerName}
                      maxLength={50}
                      placeholder="Enter Customer Name"
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1
               focus:outline-none focus:ring-2 focus:ring-[#007867]"
                      onChange={(e) => {
                        const name = e.target.value;

                        // Update UI immediately
                        setMeta((prev) => ({
                          ...prev,
                          customerName: name,
                        }));

                        // If user ERASED name → also erase mobile
                        if (!name.trim()) {
                          setMeta((prev) => ({
                            ...prev,
                            customerName: "",
                            mobile: "", // RESET MOBILE
                          }));
                          setShowCustomerList(false);
                          return;
                        }

                        // ⏳ Debounce fetching
                        if (customerTypingRef.current) {
                          clearTimeout(customerTypingRef.current);
                        }

                        customerTypingRef.current = setTimeout(async () => {
                          const list = await fetchCustomerByName(name);
                          setCustomerSuggestions(list);
                          setShowCustomerList(true);
                        }, 300); // debounce 300ms
                      }}
                      onBlur={() => {
                        setTimeout(() => {
                          if (!isClickInsideCustomerDropdown.current) {
                            setShowCustomerList(false);
                          }
                          isClickInsideCustomerDropdown.current = false;
                        }, 150);
                      }}
                    />

                    {/* Suggestion dropdown */}
                    {showCustomerList && customerSuggestions.length > 0 && (
                      <div
                        style={{
                          position: "absolute",
                          top: "60px",
                          left: 0,
                          width: "100%",
                          background: "white",
                          border: "1px solid #ccc",
                          zIndex: 1000,
                          borderRadius: "6px",
                          maxHeight: "200px",
                          overflowY: "auto",
                        }}
                        onMouseDown={() => {
                          isClickInsideCustomerDropdown.current = true;
                        }}
                      >
                        {customerSuggestions.map((cust) => (
                          <div
                            key={cust._id}
                            style={{
                              padding: "8px 10px",
                              cursor: "pointer",
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                            }}
                            onClick={() => {
                              // Auto fill on select
                              setMeta((prev) => ({
                                ...prev,
                                customerName: cust.name,
                                mobile: cust.mobile,
                              }));

                              setShowCustomerList(false);
                            }}
                          >
                            <span>{cust.name}</span>
                            <span style={{ color: "#888", fontSize: "12px" }}>
                              {cust.mobile}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </label>




                  <label>
                    Mobile
                    <input
                      type="text"
                      value={meta.mobile}
                      maxLength={10}


                      onChange={async (e) => {
                        const v = e.target.value.replace(/\D/g, ""); // only digits

                        // Always update mobile while typing
                        setMeta((prev) => ({ ...prev, mobile: v }));

                        // Case: less than 10 digits → do nothing
                        if (v.length < 10) {
                          return;
                        }

                        // Case: exactly 10 digits
                        if (v.length === 10) {
                          const customer = await fetchCustomerByMobile(v);

                          if (customer) {
                            // ✔ Existing customer → reset name + auto-fill
                            setMeta((prev) => ({
                              ...prev,
                              customerName: customer.name,
                              mobile: customer.mobile,
                            }));
                          } else {
                            // ✔ New number → keep user-typed name, do NOT reset
                            setMeta((prev) => ({
                              ...prev,
                              mobile: v,
                            }));
                          }
                        }
                      }}


                      placeholder="Enter Mobile Number"
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 
               focus:outline-none focus:ring-2 focus:ring-[#007867]"
                    />
                  </label>


                </div>
              </form>



              {/* ------------------ Items Table ------------------ */}
              <table
                className="salesbill-table clean full-width"
                style={{ tableLayout: "fixed" }}
              >
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>S.No</th>
                    <th style={{ width: "130px" }}>Product Code</th>
                    <th style={{ width: "170px" }}>Product Name</th>
                    <th style={{ width: "170px" }}>Batch</th>
                    <th style={{ width: "100px" }}>MRP</th>
                    <th style={{ width: "90px" }}>Rate</th>
                    <th style={{ width: "60px" }}>GST%</th>
                    <th style={{ width: "80px" }}>Qty</th>
                    <th style={{ width: "100px" }}>GST Value</th>
                    <th style={{ width: "120px" }}>Amount</th>
                    <th style={{ width: "90px" }}>Action</th>
                  </tr>
                </thead>

                <tbody>
                  {rows.map((row, index) => {
                    const rate = Number(row.rate || 0);
                    const qty = Number(row.qty || 0);
                    const gst = Number(row.gst || 0);

                    return (
                      <React.Fragment key={row.id}>
                        <tr>
                          <td>{index + 1}</td>

                          {/* ============================================ */}
                          {/*  PRODUCT CODE 
                        {/* ============================================ */}

                          <td className="relative">
                            <input
                              data-row={row.id}
                              data-field="code"
                              value={row.code || ""}
                              placeholder="Type or scan code"
                              // disabled={!row.isNew && editRowId !== row.id}
                              onKeyDown={(e) => {
                                handleSuggestionKey(e, row.id, "code");
                                handleEnterKey(e);
                              }}

                              onChange={async (e) => {
                                const input = e.target;
                                let v = input.value.toString().trim();
                                // // ✅ Limit to 50 characters (paste safe)
                                // let v = input.value.slice(0, 50);
                                // input.value = v;



                                updateRow(row.id, "code", v);

                                if (!v) {
                                  updateRow(row.id, "name", "");
                                  updateRow(row.id, "batch", "");
                                  updateRow(row.id, "mrp", 0);
                                  updateRow(row.id, "rate", 0);
                                  updateRow(row.id, "gst", 0);
                                  updateRow(row.id, "qty", 0);

                                  row._scanMode = false;
                                  setShowCodeList((s) => ({ ...s, [row.id]: false }));
                                  lastRawBarcodeRef.current = null;
                                  //  scanBufferRef.current = ""; 
                                  return;
                                }



                                const now = Date.now();
                                const last = input._lastKeyTime || now;
                                const dt = now - last;
                                input._lastKeyTime = now;

                                // const isNumeric = /^\d+$/.test(v);
                                // // const isScan = isNumeric && v.length >= 10 && dt < 60;
                                // const isScan = isNumeric && v.length === 13;

                                if (input._scanTimer) clearTimeout(input._scanTimer);
                                if (input._manualTimer) clearTimeout(input._manualTimer);



                                // =====================================================
                                //  SCAN MODE
                                // =====================================================
                                const isNumeric = /^\d+$/.test(v);
                                const isScan = isNumeric && v.length === 13;


                                if (row._scanMode && !isScan) return;

                                if (isScan) {
                                  // allow burst scans, but prevent overlap
                                  if (scanLockRef.current) return;

                                  scanLockRef.current = true;
                                  row._scanMode = true;

                                  (async () => {
                                    try {
                                      const results = await fetchByScanRandomCode(v);
                                      const product = results?.[0];
                                      if (!product) {
                                        showPopup("Invalid barcode", "error");
                                        return;
                                      }

                                      const batch = findBatchByRandomCode(product, v);
                                      if (!batch) {
                                        showPopup("Batch not found", "error");
                                        return;
                                      }

                                      const existingIndex = rows.findIndex(
                                        (r) =>
                                          !r.isNew &&
                                          normalizeKey(r.code) === normalizeKey(product.code) &&
                                          normalizeKey(r.batch) === normalizeKey(batch.batchNo)
                                      );

                                      // 🔁 SAME PRODUCT → QTY++
                                      if (existingIndex !== -1) {
                                        setRows((prev) =>
                                          prev.map((r, i) => {
                                            if (i === existingIndex) {
                                              const currentQty = Number(r.qty || 0);
                                              const opening = Number(r.openingStock ?? batch.qty ?? 0);
                                              const nextQty = currentQty + 1;

                                              // 🚫 STOCK GUARD (IMPORTANT)
                                              if (nextQty > opening) {
                                                showPopup(`Stock only ${opening}`, "error");
                                                return r;
                                              }

                                              return recalcRow({
                                                ...r,
                                                qty: nextQty,

                                                // ✅ DO NOT RESET openingStock
                                                openingStock: opening,
                                                closingStock: Math.max(0, opening - nextQty),
                                              });
                                            }

                                            // reset scanning row
                                            if (r.id === row.id) {
                                              return {
                                                ...r,
                                                code: "",
                                                name: "",
                                                batch: "",
                                                mrp: 0,
                                                rate: 0,
                                                gst: 0,
                                                qty: 0,
                                                _scanMode: false,
                                              };
                                            }

                                            return r;
                                          })
                                        );

                                        return;
                                      }


                                      // 🆕 NEW PRODUCT → ADD ROW
                                      finalizeRowWithData(row.id, {
                                        ...row,
                                        code: product.code,
                                        name: product.name,
                                        batch: batch.batchNo,
                                        mrp: Number(batch.mrp),
                                        rate: Number(batch.salePrice),
                                        qty: 1,
                                        gst: Number(product.taxPercent || 0),
                                        taxMode: (product.taxMode || "exclusive").toLowerCase(),
                                        isInclusive:
                                          (product.taxMode || "exclusive").toLowerCase() === "inclusive",
                                        openingStock: Number(batch.qty || 0),
                                        closingStock: Math.max(0, Number(batch.qty || 0) - 1),
                                        isNew: false,
                                        _scanMode: false,
                                      });
                                    } catch (err) {
                                      console.error("SCAN ERROR", err);
                                    } finally {
                                      scanLockRef.current = false;
                                      row._scanMode = false;
                                      input.value = "";

                                      // 🔥 focus stays correct
                                      requestAnimationFrame(() => {
                                        const inputs = document.querySelectorAll(
                                          'input[data-field="code"][data-row]'
                                        );
                                        inputs?.[inputs.length - 1]?.focus();
                                      });
                                    }
                                  })();

                                  return; // ⛔ stop manual logic
                                }

                                // =====================================================
                                // ✏️ FIXED MANUAL RANDOM-CODE MATCHING
                                // =====================================================
                                row._scanMode = false;

                                input._manualTimer = setTimeout(async () => {
                                  const list = await fetchByManualSearch(v);

                                  let exactProduct = null;
                                  let exactBatch = null;

                                  const typedNorm = v.toLowerCase().trim();

                                  for (const p of list) {
                                    for (const b of p.batches || []) {
                                      const rc = (b.randomCode || "").toLowerCase().trim();
                                      const ean = (b.ean || "").toLowerCase().trim();
                                      const bc = (b.barcode || "").toLowerCase().trim();

                                      // exact match first
                                      if (rc === typedNorm) {
                                        exactProduct = p;
                                        exactBatch = b;
                                        break;
                                      }

                                      // partial match allowed only if length >= 8
                                      if (typedNorm.length >= 8) {
                                        if (
                                          rc.includes(typedNorm) ||
                                          ean.includes(typedNorm) ||
                                          bc.includes(typedNorm)
                                        ) {
                                          exactProduct = p;
                                          exactBatch = b;
                                          break;
                                        }
                                      }
                                    }
                                    if (exactProduct) break;
                                  }

                                  if (exactProduct && exactBatch) {
                                    const filledRow = {
                                      ...row,
                                      code: exactProduct.code,
                                      name: exactProduct.name,
                                      batch: exactBatch.batchNo,
                                      mrp: Number(exactBatch.mrp),
                                      rate: Number(exactBatch.salePrice),
                                      qty: 1,

                                      // gst: Number(exactProduct.taxPercent || 0),
                                      // taxMode: (exactProduct.taxMode || "exclusive").toLowerCase(),
                                      // isInclusive:
                                      //   (exactProduct.taxMode || "exclusive").toLowerCase() === "inclusive",

                                      gst: Number(exactProduct.taxPercent ?? exactBatch.taxPercent ?? 0),
                                      taxMode: (exactProduct.taxMode || exactBatch.taxMode || "exclusive").toLowerCase(),
                                      isInclusive: (exactProduct.taxMode || exactBatch.taxMode || "exclusive").toLowerCase() === "inclusive",
                                      // ⭐ REQUIRED FOR STOCK TRACKING
                                      openingStock: Number(exactBatch.qty || 0),
                                      closingStock: Math.max(0, Number(exactBatch.qty || 0) - 1),

                                      isNew: false,
                                      _scanMode: false,
                                    };

                                    finalizeRowWithData(row.id, filledRow);

                                    setShowCodeList((s) => ({ ...s, [row.id]: false }));

                                    // requestAnimationFrame(() => {
                                    //   const qtyInput = document.querySelector(
                                    //     `input[data-row="${row.id}"][data-field="qty"]`
                                    //   );
                                    //   qtyInput?.focus();
                                    // });
                                    setTimeout(() => {
                                      requestAnimationFrame(() => {
                                        const qtyInput = document.querySelector(
                                          `input[data-row="${row.id}"][data-field="qty"]`
                                        );
                                        if (qtyInput) qtyInput.focus();
                                      });
                                    }, 30);
                                    return;
                                  }

                                  // no match → show suggestions
                                  setCodeSuggestions((s) => ({
                                    ...s,
                                    [row.id]: list.slice(0, 20),
                                  }));
                                  setShowCodeList((s) => ({ ...s, [row.id]: true }));
                                }, 220);
                              }}




                              onBlur={() => {
                                requestAnimationFrame(() => {
                                  if (isClickInsideSuggestion.current) {
                                    isClickInsideSuggestion.current = false;
                                    return;
                                  }
                                  setShowCodeList((v) => ({ ...v, [row.id]: false }));
                                });
                              }}
                            />
                            {showCodeList[row.id] &&
                              (codeSuggestions[row.id] || []).length > 0 &&
                              renderCodeSuggestionPortal(row.id)}
                          </td>






                          {/* ================== Product Name ================== */}


                          <td className="relative">
                            <input
                              data-row={row.id}
                              data-field="name"
                              value={row.name || ""}
                              placeholder="Type or select product"
                              // disabled={!row.isNew && editRowId !== row.id}
                              // disabled={false}

                              onKeyDown={(e) => {
                                handleSuggestionKey(e, row.id, "name");
                                handleEnterKey(e);
                              }}
                              onChange={async (e) => {
                                const v = e.target.value.trim();
                                // let v = e.target.value.slice(0, 50);


                                updateRow(row.id, "name", v);

                                // 🛑 EMPTY → HIDE dropdown
                                if (!v) {
                                  updateRow(row.id, "code", "");
                                  updateRow(row.id, "batch", "");
                                  updateRow(row.id, "mrp", 0);
                                  updateRow(row.id, "rate", 0);
                                  updateRow(row.id, "gst", 0);
                                  updateRow(row.id, "qty", 0);
                                  setShowNameList((s) => ({ ...s, [row.id]: false }));
                                  return;
                                }

                                // 🛑 Only letters + numbers allowed
                                if (!/^[a-zA-Z0-9 ]+$/.test(v)) {
                                  setShowNameList((s) => ({ ...s, [row.id]: false }));
                                  return;
                                }

                                // fetch
                                const all = await fetchProducts(v);
                                setNameSuggestions((s) => ({
                                  ...s,
                                  [row.id]: all.slice(0, 20),
                                }));
                                setShowNameList((s) => ({ ...s, [row.id]: true }));
                              }}
                              onBlur={() => {
                                requestAnimationFrame(() => {
                                  if (isClickInsideSuggestion.current) {
                                    isClickInsideSuggestion.current = false;
                                    return;
                                  }
                                  setShowNameList((v) => ({ ...v, [row.id]: false }));
                                });
                              }}
                            />
                            {showNameList[row.id] &&
                              (nameSuggestions[row.id] || []).length > 0 &&
                              renderNameSuggestionPortal(row.id)}
                          </td>


                          {/* ================== Batch ================== */}
                          <td className="relative">
                            <input
                              className="input"
                              data-row={row.id}
                              data-field="batch"
                              placeholder="Enter or select batch number"
                              value={row.batch}
                              onChange={(e) => {
                                // If we're in scan mode (randomCode filled), do not open batch dropdown while scanning
                                if (row._scanMode) return;

                                const v = e.target.value;
                                // let v = e.target.value.slice(0, 50);

                                setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, batch: v } : r)));

                                const valid = row.name && row.code;
                                if (!valid) {
                                  setShowBatchList((m) => ({ ...m, [row.id]: false }));
                                  return;
                                }

                                if (v.trim() === "") {
                                  const batches = row.name ? getBatchesForName(row.name) : getBatchesForCode(row.code);
                                  setBatchesByRow((b) => ({ ...b, [row.id]: batches }));
                                  setShowBatchList((m) => ({ ...m, [row.id]: true }));
                                } else {
                                  setShowBatchList((m) => ({ ...m, [row.id]: true }));
                                }
                              }}

                              onFocus={(e) => {
                                if (row._scanMode) return; // do not show batch dropdown after a scan fill
                                if (!(row.name && row.code)) return;
                                const batches = row.name ? getBatchesForName(row.name) : getBatchesForCode(row.code);
                                setBatchesByRow((b) => ({ ...b, [row.id]: batches }));
                                setShowBatchList((m) => ({ ...m, [row.id]: true }));
                              }}


                              onBlur={() => {
                                requestAnimationFrame(() => {
                                  if (isClickInsideBatchPortal.current) {
                                    isClickInsideBatchPortal.current = false;
                                    return;
                                  }
                                  setShowBatchList((m) => ({ ...m, [row.id]: false }));
                                });
                              }}
                              onKeyDown={(e) => handleBatchKey(e, row.id)}
                            />

                            {row.name &&
                              row.code &&
                              Array.isArray(batchesByRow[row.id]) &&
                              batchesByRow[row.id].length > 0 &&
                              showBatchList[row.id] &&
                              !row._scanMode &&      // 🔥 BLOCK BATCH LIST DURING SCANNING
                              renderBatchPortal(row.id)}

                          </td>

                          {/* ================== MRP ================== */}
                          <td>
                            <input
                              type="number"
                              {...numberInputProps}
                              value={row.mrp || 0}
                              onChange={(e) => updateRow(row.id, "mrp", e.target.value)}
                              // disabled={!row.isNew && editRowId !== row.id}
                              disabled={!row.isNew}
                              readOnly
                            // disabled
                            />
                          </td>

                          {/* ================== Rate ================== */}
                          <td>
                            <input
                              type="number"
                              {...numberInputProps}
                              value={row.rate || 0}
                              onChange={(e) => updateRow(row.id, "rate", e.target.value)}
                              // disabled={!row.isNew && editRowId !== row.id}
                              disabled={!row.isNew}
                              readOnly
                            // disabled
                            />
                          </td>

                          {/* ================== GST ================== */}
                          <td>
                            <input
                              type="number"
                              {...numberInputProps}
                              value={row.gst || 0}
                              onChange={(e) => updateRow(row.id, "gst", e.target.value)}
                              disabled={!row.isNew && editRowId !== row.id}
                              // disabled={!row.isNew} 
                              readOnly
                            // disabled
                            />
                          </td>

                          {/* ================== Qty ================== */}
                          <td>
                            <input
                              data-row={row.id}
                              data-field="qty"
                              type="number"
                              {...numberInputProps}
                              value={row.qty || ""}
                              onKeyDown={(e) => {
                                let currentQty = Number(row.qty || 0);

                                // 🔼 ARROW UP → increase qty
                                if (e.key === "ArrowUp") {
                                  e.preventDefault();
                                  const newQty = currentQty + 1;

                                  // Validate stock before increment
                                  const prod = products.find(
                                    (p) => normalizeKey(p.code) === normalizeKey(row.code)
                                  );
                                  const batch = prod?.batches?.find(
                                    (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
                                  );
                                  const baseStock = Number(batch?.qty || 0);

                                  const reservedUI = getRowsReservedForKey(row.code, row.batch, row.id);
                                  const maxAllowed = Math.max(0, baseStock - reservedUI);

                                  if (newQty > maxAllowed) {
                                    showPopup(`Only ${maxAllowed} available`, "error");
                                    return;
                                  }

                                  updateRow(row.id, "qty", newQty);
                                }

                                // 🔽 ARROW DOWN → decrease qty
                                if (e.key === "ArrowDown") {
                                  e.preventDefault();
                                  const newQty = Math.max(0, currentQty - 1);

                                  if (newQty === 0) {
                                    showPopup("No available stock", "error");
                                  }

                                  updateRow(row.id, "qty", newQty);
                                }
                              }}
                              onChange={(e) => {
                                let newQty = Number(e.target.value) || 0;





                                // ⚠️ Show "No available stock" when qty becomes 0
                                if (newQty === 0) {
                                  showPopup("No available stock", "error");
                                }

                                const baseStock = (() => {
                                  const prod = products.find(
                                    (p) => normalizeKey(p.code) === normalizeKey(row.code)
                                  );
                                  if (!prod) return 0;
                                  const batch = prod.batches?.find(
                                    (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
                                  );
                                  return Number(batch?.qty || 0);
                                })();

                                const reservedUI = getRowsReservedForKey(row.code, row.batch, row.id);
                                const maxAllowed = Math.max(0, baseStock - reservedUI);

                                if (newQty > maxAllowed) {
                                  showPopup(`Only ${maxAllowed} available`, "error");
                                  e.target.value = maxAllowed;
                                  updateRow(row.id, "qty", maxAllowed);
                                  return;
                                }

                                updateRow(row.id, "qty", newQty);
                              }}
                            />
                          </td>


                          {/* ================== GST VALUE COLUMN (NEW) ================== */}
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {row.taxMode === "inclusive"
                              ? "0.00"                               // ⭐ Inclusive → 0
                              : Number(row.gstAmount || 0).toFixed(2)}
                          </td>



                          {/* ================== GST VALUE COLUMN (FIXED) ================== */}
                          {/* <td style={{ textAlign: "right", fontWeight: 600 }}>
  {Number(row.gstAmount || 0).toFixed(2)}
</td> */}



                          {/* ================== Value ================== */}
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {Number(row.value || 0).toFixed(2)}
                            {row.taxMode && (
                              <div className="text-xs text-gray-400 mt-1">
                                {row.taxMode === "inclusive" ? "Inclusive" : "Exclusive"}
                              </div>
                            )}
                          </td>


                          {/* ================== Actions ================== */}
                          <td className="row-actions">
                            {row.isNew ? (
                              <button
                                className="plus"
                                onClick={() => {
                                  // read the latest row directly and call addRow synchronously
                                  const r = rows.find((x) => x.id === row.id);

                                  if (
                                    r?.code?.toString().trim() &&
                                    r?.name?.toString().trim() &&
                                    r?.batch?.toString().trim() &&
                                    Number(r?.qty) > 0 &&
                                    Number(r?.rate) > 0
                                  ) {
                                    // call addRow immediately — this uses current state and keeps behavior predictable
                                    addRow(row.id);
                                  } else {
                                    showPopup("Fill required fields", "error");
                                  }
                                }}
                              >
                                <FaPlus />
                              </button>
                            ) : editRowId === row.id ? (
                              <>
                                <button
                                  onClick={() => saveRowEdit(row.id)}
                                  className="success"
                                  style={{ color: "green" }}
                                >
                                  <FaCheck />
                                </button>
                                <button onClick={cancelRowEdit} className="danger">
                                  <FaTimes />
                                </button>
                              </>
                            ) : (
                              <>
                                {/* <button
        onClick={() => {
          const rowObj = rows.find((r) => r.id === row.id);
          if (rowObj) {
            const k = getStockKey(rowObj.code, rowObj.batch);

            // STORE reserved at beginning of editing
            setOriginalRowData((prev) => ({
              ...prev,
              [row.id]: {
                ...rowObj,
                reservedAtEdit: Number(reservedStock[k] || 0),
              },
            }));
          }

          setEditRowId(row.id);
        }}
        className="edit"
      >
        <FaEdit />
      </button> */}

                                <button
                                  onClick={() => deleteRow(row.id)}
                                  className="danger"
                                >
                                  <FaTrash />
                                </button>
                              </>
                            )}
                          </td>

                        </tr>

                        {stockErrors[row.id] && (
                          <tr>
                            <td colSpan="10" style={{ color: "red", fontSize: 13 }}>
                              ❌ {stockErrors[row.id]}
                            </td>
                          </tr>
                        )}
                      </React.Fragment>
                    );
                  })}
                </tbody>
              </table>



              {/* ------------------ Totals / Bill Summary ------------------ */}
              <div
                className="totals-layout"
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  gap: "2rem",
                  marginTop: "2rem",
                  flexWrap: "wrap",
                }}
              >
                {/* Left column - Bill Summary + GST Breakdown */}
                <div
                  className="totals-left"
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    backgroundColor: "#f0f8f5",
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >
                  <h3
                    style={{
                      margin: 0,
                      fontSize: "1.2rem",
                      fontWeight: 600,
                      color: "#007867",
                    }}
                  >
                    Bill Summary
                  </h3>

                  {/* Calculate GST / CGST / SGST */}
                  {
                    (() => {
                      let gstSummary = {};

                      rows.forEach((r) => {
                        const gstRate = Number(r.gst || 0);
                        const gstAmt = Number(r.gstAmount || 0);

                        if (gstRate > 0 && gstAmt > 0) {
                          gstSummary[gstRate] = (gstSummary[gstRate] || 0) + gstAmt;
                        }
                      });

                      return (
                        <>
                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>CGST</span>
                            <strong>{Number(totals.cgst || 0).toFixed(2)}</strong>
                          </div>

                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>SGST</span>
                            <strong>{Number(totals.sgst || 0).toFixed(2)}</strong>
                          </div>

                          <hr />

                          <div style={{ display: "flex", justifyContent: "space-between" }}>
                            <span>GST</span>
                            <strong >{(Number(totals.cgst || 0) + Number(totals.sgst || 0)).toFixed(2)}</strong>
                          </div>



                          {/* Show GST breakup only after item added */}
                          {Object.keys(gstSummary).length > 0 && (
                            <>
                              {Object.keys(gstSummary)
                                .map(Number)
                                .sort((a, b) => a - b)
                                .map((rate) => (
                                  <div
                                    key={rate}
                                    style={{ display: "flex", justifyContent: "space-between" }}
                                  >
                                    <span>{rate.toFixed(2)}%</span>
                                    <strong>{gstSummary[rate].toFixed(2)}</strong>
                                  </div>
                                ))}
                            </>
                          )}

                        </>
                      );
                    })()}

                </div>

                {/* Right column - Totals */}
                <div
                  className="totals-right"
                  style={{
                    flex: 1,
                    minWidth: "200px",
                    backgroundColor: "#f9f9f9",
                    padding: "1rem",
                    borderRadius: "0.75rem",
                    boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
                    display: "flex",
                    flexDirection: "column",
                    gap: "0.75rem",
                  }}
                >

                  {/* TOTAL */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>Total</span>
                    <input
                      type="number"
                      readOnly
                      value={Number(totals.total || 0).toFixed(2)}
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "1px solid #ccc",
                        textAlign: "right",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>

                  {/* GST (CGST + SGST) */}
                  {/* <div
    style={{
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
    }}
  >
    <span style={{ fontWeight: 300, minWidth: "100px" }}>GST</span>
    <input
      type="number"
      readOnly
      value={(Number(totals.cgst || 0) + Number(totals.sgst || 0)).toFixed(2)}
      style={{
        flex: 1,
        padding: "0.75rem 1rem",
        fontSize: "1rem",
        fontWeight: 500,
        borderRadius: "0.5rem",
        border: "1px solid #ccc",
        textAlign: "right",
        backgroundColor: "#fff",
      }}
    />
  </div> */}

                  {/* DISCOUNT →  ( % + VALUE ) */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>Discount</span>

                    {/* % BOX */}
                    <input
                      type="number"
                      placeholder="%"
                      value={totals.discountPercent || ""}
                      onChange={(e) => {
                        const perc = Number(e.target.value) || 0;

                        // ⭐ UPDATED: Calculate discount using Net Amount, not Total
                        const amt = ((Number(totals.netAmount) * perc) / 100).toFixed(2);

                        setTotals((prev) => ({
                          ...prev,
                          discountPercent: perc,
                          discount: Number(amt),
                        }));
                      }}
                      onWheel={(e) => {
                        e.preventDefault();
                        e.target.blur();
                      }}
                      style={{
                        width: "105px",
                        padding: "0.75rem 0.5rem",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "1px solid #ccc",
                        textAlign: "right",
                        backgroundColor: "#fff",
                      }}
                    />

                    {/* DISCOUNT AMOUNT BOX */}
                    <input
                      type="number"
                      placeholder="₹"
                      value={totals.discount === 0 ? "" : totals.discount}
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;

                        // ⭐ UPDATED: discount% = discount / netAmount
                        const perc =
                          totals.netAmount > 0 ? ((val / totals.netAmount) * 100).toFixed(2) : 0;

                        setTotals((prev) => ({
                          ...prev,
                          discount: val,
                          discountPercent: Number(perc),
                        }));
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          setTotals((prev) => ({
                            ...prev,
                            discount: 0,
                            discountPercent: 0,
                          }));
                        }
                      }}
                      onWheel={(e) => {
                        e.preventDefault();
                        e.target.blur();
                      }}
                      style={{
                        width: "105px",
                        padding: "0.75rem 0.5rem",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "1px solid #ccc",
                        textAlign: "right",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>

                  {/* NET AMOUNT */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>Net Amount</span>
                    <input
                      type="number"
                      readOnly
                      value={Number(totals.netAmount || 0).toFixed(2)}
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "1px solid #ccc",
                        textAlign: "right",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>

                  {/* CASH GIVEN */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>Cash Given</span>
                    <input
                      type="number"
                      value={totals.cashGiven === 0 ? "" : totals.cashGiven}
                      // onChange={(e) => {
                      //   const val = Number(e.target.value) || 0;
                      //    setHasCashInput(e.target.value !== "");
                      //   setTotals((prev) => ({ ...prev, cashGiven: val }));
                      // }}

                      onChange={(e) => {
                        const cashGiven = Number(e.target.value) || 0;
                        const net = Number(totals.netAmount || 0);

                        setHasCashInput(e.target.value !== "");

                        // 🔥 Cap cash payment to netAmount
                        const cashPay = Math.min(cashGiven, net);

                        // 🔥 Update totals
                        setTotals((prev) => ({
                          ...prev,
                          cashGiven,
                          balance: cashGiven - net,
                        }));

                        // 🔥 Live update payment method
                        setPayment({
                          cash: cashPay,
                          upi: 0, // reset UPI when cash changes
                        });

                        setPaymentMethod("cash");
                      }}


                      onBlur={(e) => {
                        if (e.target.value === "") {
                          setTotals((prev) => ({ ...prev, cashGiven: 0 }));
                        }
                      }}
                      onWheel={(e) => {
                        e.preventDefault();
                        e.target.blur();
                      }}
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "1px solid #ccc",
                        textAlign: "right",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>

                  {/* BALANCE (CAN BE NEGATIVE) */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>Balance</span>
                    <input
                      type="number"
                      readOnly
                      // value={Number(totals.balance || 0).toFixed(2)}
                      value={
                        hasCashInput
                          ? Number(totals.balance || 0).toFixed(2)
                          : "0.00"
                      }
                      style={{
                        flex: 1,
                        padding: "0.75rem 1rem",
                        fontSize: "1rem",
                        fontWeight: 500,
                        borderRadius: "0.5rem",
                        border: "1px solid #ccc",
                        textAlign: "right",
                        backgroundColor: "#fff",
                      }}
                    />
                  </div>
                </div>




              </div>


              {/* ---------------- Payment Method ---------------- */}
              <div
                className="mt-4 p-4 rounded-lg bg-[#eef8f3]
             transform transition-all duration-300
             animate-[fadeUp_0.4s_ease-out]
             hover:shadow-lg"
              >
                <div className="flex items-center justify-between gap-6">

                  {/* LEFT */}
                  <div className="flex flex-col gap-4">

                    {/* HEADER */}
                    <label className="font-semibold flex items-center gap-2 text-sm">
                      <FaExchangeAlt className="text-green-700" />
                      Payment Method
                    </label>

                    {/* PAYMENT OPTIONS */}
                    <div className="flex gap-8">

                      {/* ================= CASH ================= */}
                      <div className="flex flex-col gap-2 w-40">

                        {/* HIDDEN CHECKBOX (LOGIC PRESERVED) */}
                        <input
                          type="checkbox"
                          checked={payCash}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPayCash(checked);

                            if (!checked) setPayUpi(true);

                            syncPayment(checked, payUpi || !checked, totals.cashGiven);
                          }}
                          hidden
                        />

                        {/* CASH TOGGLE */}
                        <div className="flex bg-gray-100 rounded-full p-1">
                          <button
                            type="button"
                            onClick={() => {
                              const checked = !payCash;
                              setPayCash(checked);

                              if (!checked) setPayUpi(true);

                              syncPayment(checked, payUpi || !checked, totals.cashGiven);
                            }}
                            className={`
                w-full px-4 py-1 text-sm rounded-full transition-all
                flex items-center justify-center gap-2
                ${payCash
                                ? "bg-[#c8fad6] text-[#007867] shadow"
                                : "text-gray-700"
                              }
              `}
                          >
                            <FaMoneyBillWave />
                            Cash
                          </button>
                        </div>

                        {/* CASH INPUT */}
                        <input
                          type="number"
                          value={payment.cash === 0 ? "" : payment.cash.toFixed(2)}
                          onChange={(e) => {
                            const entered = Number(e.target.value) || 0;
                            syncPayment(true, payUpi, entered);
                          }}
                          onWheel={(e) => e.target.blur()}
                          disabled={!payCash}
                          placeholder="Cash Amount"
                          className="w-full p-2 rounded-md border text-sm text-right disabled:bg-gray-100"
                        />

                        {/* CASH VALUE */}
                        <div className="text-xs text-gray-700 text-right">
                          Cash: ₹{payment.cash.toFixed(2)}
                        </div>
                      </div>

                      {/* ================= UPI ================= */}
                      <div className="flex flex-col gap-2 w-40">

                        {/* HIDDEN CHECKBOX (LOGIC PRESERVED) */}
                        <input
                          type="checkbox"
                          checked={payUpi}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPayUpi(checked);

                            if (!checked) setPayCash(true);

                            syncPayment(payCash || !checked, checked, totals.cashGiven);
                          }}
                          hidden
                        />

                        {/* UPI TOGGLE */}
                        <div className="flex bg-gray-100 rounded-full p-1">
                          <button
                            type="button"
                            onClick={() => {
                              const checked = !payUpi;
                              setPayUpi(checked);

                              if (!checked) setPayCash(true);

                              syncPayment(payCash || !checked, checked, totals.cashGiven);
                            }}
                            className={`
                w-full px-4 py-1 text-sm rounded-full transition-all
                flex items-center justify-center gap-2
                ${payUpi
                                ? "bg-[#c8fad6] text-[#007867] shadow"
                                : "text-gray-700"
                              }
              `}
                          >
                            <FaMobileAlt />
                            UPI
                          </button>
                        </div>

                        {/* UPI INPUT */}
                        <input
                          type="number"
                          value={payment.upi === 0 ? "" : payment.upi.toFixed(2)}
                          onChange={(e) => {
                            const entered = Number(e.target.value) || 0;
                            syncPayment(payCash, true, totals.cashGiven - entered);
                          }}
                          onWheel={(e) => e.target.blur()}
                          disabled={!payUpi}
                          placeholder="UPI Amount"
                          className="w-full p-2 rounded-md border text-sm text-right disabled:bg-gray-100"
                        />

                        {/* UPI VALUE */}
                        <div className="text-xs text-gray-700 text-right">
                          UPI: ₹{payment.upi.toFixed(2)}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* RIGHT */}
                  {/* <button
                  className="bg-green-700 text-white px-4 py-2 rounded-md text-sm
                 hover:bg-green-800 transition-all duration-200
                 hover:scale-110 shadow-md"
                  onClick={handleSaveAndPrint}
                >
                  Print
                </button> */}
                  <button
                    onClick={handleSaveAndPrint}
                    disabled={saving}
                    className={`px-4 py-2 rounded-md text-sm flex items-center gap-2
    bg-green-700 text-white shadow-md transition-all duration-200
    ${saving
                        ? "opacity-60 cursor-not-allowed"
                        : "hover:bg-green-800 hover:scale-110"
                      }
  `}
                  >
                    {saving && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    )}

                    {saving ? "Printing..." : "Print"}
                  </button>


                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ==================== VIEW BILL MODAL ==================== */}
      {showViewModal && viewBill && (
        <ViewOnlySaleModal
          showModal={showViewModal}
          onClose={() => setShowViewModal(false)}
          meta={{
            counter: viewBill.counter,
            billNo: viewBill.billNo,
            date: viewBill.date,
            customerName: viewBill.customerName,
            mobile: viewBill.mobile,
          }}
          rows={viewBill.items}   // ← your bill items array
          movements={viewBill.movements}
          totals={{
            total: viewBill.total,
            netAmount: viewBill.netAmount,
            discount: viewBill.discount,
            discountPercent: viewBill.discountPercent,
            cgst: viewBill.cgst,
            sgst: viewBill.sgst,
            cashGiven: viewBill.cashGiven,
            balance: viewBill.balance,
          }}

          loggedInUser={user}

          paymentMethod={viewBill.paymentMethod}
          payment={viewBill.payment}

          selectedShop={selectedShop}
          titlePrefix="View Bill"
        />
      )}



    </div>
  );

}









//1 15/04/26 

// // src/pages/SalesBill.jsx
// import React, { useEffect, useMemo, useRef, useState, useContext } from "react";
// import ReactDOM from "react-dom";
// import {
//   FaPlus,
//   FaEdit,
//   FaTrash,
//   FaTimes,
//   FaCheck,
//   FaEye,
//   FaMoneyBillWave, FaMobileAlt, FaExchangeAlt,
//   FaCheckCircle, FaTimesCircle,
// } from "react-icons/fa";
// import axios from "axios";
// import { useAuth } from "../context/AuthContext";
// import { getAuthHeaders, API } from "../utils/apiHeaders";
// import Pagination from "../components/Pagination";
// import "../styles/salesbill.css";
// import { getApiUrl } from "../utils/api";
// import apiClient from "../utils/apiClient";
// import { ShopContext } from "../context/ShopContext";
// import ViewOnlySaleModal from '../components/ViewOnlySaleModal';

// import html2pdf from "html2pdf.js";


// const axiosInstance = axios.create({ baseURL: API });



// import { useReactToPrint } from "react-to-print";


// export default function SalesBill() {
//   const { user } = useAuth();
//   const token = localStorage.getItem("token");
//   const shopname = user?.shopname || localStorage.getItem("shopname");

//   // ---------------- State ----------------
//   const [bills, setBills] = useState([]);
//   const [loading, setLoading] = useState(true);

//   // const [rows, setRows] = useState([createEmptyRow()]);
//   const [products, setProducts] = useState([]);

//   const [popup, setPopup] = useState({ message: "", type: "" });
//   const [batchRenderKey, setBatchRenderKey] = useState(0);
//   const [version, setVersion] = React.useState(0);


//   const [printView, setPrintView] = useState(false);

//   const [activeSuggestionIndex, setActiveSuggestionIndex] = useState({});

//   const [showViewModal, setShowViewModal] = useState(false);


//   const [isModalOpen, setIsModalOpen] = useState(false);
//   // const updateRowBlockedRef = useRef(false);


//   const [customerSuggestions, setCustomerSuggestions] = useState([]);
//   const [showCustomerList, setShowCustomerList] = useState(false);
//   const [searchingField, setSearchingField] = useState("");
//   const isClickInsideCustomerList = useRef(false);
//   const { selectedShop } = useContext(ShopContext);
//   const shopTitle = selectedShop?.shopname;

//   const [counterFilter, setCounterFilter] = useState("");

//   // ------------------ SCAN ENGINE REFS ------------------
//   const scanLockRef = useRef(false);
//   const lastRawBarcodeRef = useRef(null);

//   const stockAppliedRef = useRef(false);


//   const customerTypingRef = useRef(null); // debounce
//   const isClickInsideCustomerDropdown = useRef(false);


//   // ⭐ REQUIRED FIX — this removes "lastScan is not defined"
//   const lastScan = useRef({ code: "", time: 0 });


//   // 🔥 BARCODE BUFFER (REQUIRED)
//   const scanBufferRef = useRef("");


//   const isSavingRef = useRef(false);
//   const [saving, setSaving] = useState(false);

//   const [paymentMethod, setPaymentMethod] = useState("cash");  // "cash" | "upi"
//   const [payment, setPayment] = useState({
//     cash: 0,
//     upi: 0,
//   });

//   const [hasCashInput, setHasCashInput] = useState(false);


//   // If you use updateRow blocking
//   const updateRowBlockedRef = useRef(false);


//   //   const [rows, _setRows] = useState([createEmptyRow()]);
//   const [rows, setRows] = useState([createEmptyRow()]);



//   // ---------------------- SCAN LOCK & HELPERS ----------------------
//   // Add these next to other useRef/useState declarations
//   // const scanLockRef = React.useRef(false); // blocks duplicate burst processing
//   // const lastRawBarcodeRef = React.useRef(null); // optional raw filter if needed
//   const printRef = useRef();
//   const [meta, setMeta] = useState({
//     billNo: "",
//     date: new Date().toISOString().split("T")[0],
//     counter: 1,
//     customerName: "",
//     mobile: "",
//     address: "",

//   });





//   const [totals, setTotals] = useState({
//     total: 0,
//     discount: 0,
//     netAmount: 0,
//     cashGiven: 0,
//     balance: 0,
//     cgst: 0,
//     sgst: 0,
//   });

//   const [search, setSearch] = useState("");
//   const [filter, setFilter] = useState("");
//   const [fromDate, setFromDate] = useState("");
//   const [toDate, setToDate] = useState("");
//   const [statusFilter, setStatusFilter] = useState("all");

//   const [showModal, setShowModal] = useState(false);
//   const [viewBill, setViewBill] = useState(null);

//   const [billEditMode, setBillEditMode] = useState(false);
//   const [editingBillId, setEditingBillId] = useState(null);

//   const [editRowId, setEditRowId] = useState(null);
//   const [errorMsg, setErrorMsg] = useState("");

//   const [originalRowData, setOriginalRowData] = useState({});
//   const [originalBillItems, setOriginalBillItems] = useState({});

//   const [page, setPage] = useState(1);
//   const [totalPages, setTotalPages] = useState(1);
//   const limit = 50;

//   const [reservedStock, setReservedStock] = useState({});
//   const [stockErrors, setStockErrors] = useState({});
//   const [rowStockError, setRowStockError] = useState({});

//   // suggestions state (per row)
//   const [nameSuggestions, setNameSuggestions] = useState({});
//   const [codeSuggestions, setCodeSuggestions] = useState({});
//   const [showNameList, setShowNameList] = useState({});
//   const [showCodeList, setShowCodeList] = useState({});
//   const [batchesByRow, setBatchesByRow] = useState({});
//   const [showBatchList, setShowBatchList] = useState({});

//   const portalRoot = typeof document !== "undefined" ? document.body : null;
//   const suggestionRefs = useRef({});


//   const isClickInsideBatchPortal = useRef(false);
//   const suggestionClickRef = useRef(false);
//   const isClickInsideSuggestion = useRef(false);
//   const [allProducts, setAllProducts] = useState([]);



//   const [pendingAddId, setPendingAddId] = useState(null);


//   const [payCash, setPayCash] = useState(true);
//   const [payUpi, setPayUpi] = useState(false);
//   const syncPayment = (cashChecked, upiChecked, cashGiven) => {
//     const net = Number(totals.netAmount || 0);

//     let cashPay = 0;
//     let upiPay = 0;

//     if (cashChecked) {
//       cashPay = Math.min(cashGiven || net, net);
//     }

//     if (upiChecked) {
//       upiPay = Math.max(0, net - cashPay);
//     }

//     // If only UPI selected
//     if (!cashChecked && upiChecked) {
//       cashPay = 0;
//       upiPay = net;
//     }

//     setPayment({
//       cash: cashPay,
//       upi: upiPay,
//     });

//     setPaymentMethod(
//       cashChecked && upiChecked
//         ? "mixed"
//         : cashChecked
//           ? "cash"
//           : "upi"
//     );

//     setTotals((p) => ({
//       ...p,
//       balance: cashGiven - net + upiPay,
//     }));
//   };

//   useEffect(() => {
//     if (!pendingAddId) return;

//     // call addRow with a microtask so React finishes current renders
//     const id = pendingAddId;
//     setTimeout(() => {
//       addRow(id);
//       setPendingAddId(null);
//       // focus last input
//       setTimeout(() => {
//         const last = document.querySelectorAll('input[data-field="code"][data-row]');
//         if (last && last.length) {
//           const el = last[last.length - 1];
//           try { el.focus(); } catch (e) { }
//         }
//       }, 40);
//     }, 0);

//   }, [pendingAddId]);


//   const debounce = (fn, delay = 300) => {
//     let timer;
//     return (...args) => {
//       clearTimeout(timer);
//       timer = setTimeout(() => fn(...args), delay);
//     };
//   };


//   // -------------------------------
//   // API path helper
//   // -------------------------------
//   const getApiPath = (endpoint) => {
//     const ep = endpoint.replace(/^\//, "");
//     if (!user) return getApiUrl(ep);



//     // Tenant user: send normal endpoint, header includes shopname
//     if (user.role === "tenant") return getApiUrl(ep);

//     // Manager/Megaadmin: include selectedShop in path
//     if ((user.role === "manager" || user.role === "megaadmin") && selectedShop) {
//       return getApiUrl(`api/shops/${selectedShop}/${ep}`);
//     }

//     return getApiUrl(ep);
//   };


//   const [currentShop, setCurrentShop] = useState(null);

//   useEffect(() => {
//     const fetchTenantShop = async () => {
//       if (!user?.username) return;

//       try {
//         // Public route, no Authorization header needed
//         const res = await axios.get(
//           `${API}/api/shops/public/findByUsername/${user.username}`
//         );

//         if (res.data) {
//           setCurrentShop(res.data);
//         }
//       } catch (err) {
//         console.error("Failed to fetch tenant shop:", err);
//       }
//     };

//     fetchTenantShop();
//   }, [user]);


//   // ---------------- Helpers ----------------
//   function createEmptyRow() {
//     return {
//       id: "_" + Math.random().toString(36).slice(2, 10),
//       code: "",
//       name: "",
//       batch: "",
//       mrp: 0,
//       rate: 0,
//       gst: 0,
//       qty: 0,
//       amount: 0,
//       value: 0,
//       isNew: true,
//     };
//   }





//   const keyFor = (code, batch) =>
//     `${(code || "").toLowerCase()}|${(batch || "").toLowerCase()}`;

//   const showPopup = (message, type = "success") => {
//     setPopup({ message, type });
//     setTimeout(() => setPopup({ message: "", type: "" }), 2500);
//   };

//   const preventWheel = (e) => {
//     if (document.activeElement && document.activeElement.type === "number") {
//       e.preventDefault();
//     }
//   };
//   const enableWheelBlock = () =>
//     document?.addEventListener("wheel", preventWheel, { passive: false });
//   const disableWheelBlock = () =>
//     document?.removeEventListener("wheel", preventWheel);

//   const numberInputProps = { onWheel: (e) => e.target.blur() };

//   const formatDate = (dateStr) => {
//     if (!dateStr) return "";
//     const d = new Date(dateStr);
//     return `${String(d.getDate()).padStart(2, "0")}-${String(d.getMonth() + 1).padStart(2, "0")}-${d.getFullYear()}`;
//   };


//   const formatTime = (dateString) => {
//     const date = new Date(dateString);
//     const hours = date.getHours();
//     const minutes = date.getMinutes();
//     const seconds = date.getSeconds();

//     const ampm = hours >= 12 ? "PM" : "AM";
//     const h = hours % 12 || 12;
//     const mm = minutes.toString().padStart(2, "0");
//     const ss = seconds.toString().padStart(2, "0");

//     return `${h}:${mm}:${ss} ${ampm}`;
//   };

//   // debounce helper
//   const debounceFn = (fn, delay = 180) => {
//     let t;
//     return (...args) => {
//       clearTimeout(t);
//       t = setTimeout(() => fn(...args), delay);
//     };
//   };

//   // ---------------- Data Fetch ----------------
//   const fetchCustomerByMobile = async (mobile) => {
//     if (!mobile.trim()) return null;
//     try {
//       const token = user?.token || localStorage.getItem("token");
//       const res = await axios.get(`${API}/api/customers`, {
//         params: { search: mobile, limit: 1 }, // fetch only one customer
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "x-shopname": shopTitle,
//         },
//       });
//       const data = res.data?.customers || [];
//       return data.length > 0 ? data[0] : null;
//     } catch (err) {
//       console.error("fetchCustomerByMobile failed:", err);
//       return null;
//     }
//   };



//   const fetchCustomerByName = async (name) => {
//     if (!name.trim()) return [];

//     try {
//       const token = user?.token || localStorage.getItem("token");

//       const res = await axios.get(`${API}/api/customers`, {
//         params: { search: name, limit: 10 },
//         headers: {
//           Authorization: `Bearer ${token}`,
//           "x-shopname": shopTitle,
//         },
//       });

//       return res.data?.customers || [];
//     } catch (err) {
//       console.error("fetchCustomerByName:", err);
//       return [];
//     }
//   };


//   // ---------------- FETCH PRODUCTS ----------------
//   const fetchProducts = async (searchText = "") => {
//     if (!user) return [];

//     try {
//       const isSearching = !!searchText.trim();
//       const limit = isSearching ? 0 : 10;

//       const params = new URLSearchParams({ limit });
//       if (isSearching) params.append("search", searchText);

//       // ⭐ UPDATED: ONLY ACTIVE PRODUCTS+ACTIVE BATCHES
//       const res = await axiosInstance.get(`/api/products/active?${params}`, {
//         headers: getAuthHeaders(user),
//       });


//       const data = res?.data ?? {};

//       const list = Array.isArray(data)
//         ? data
//         : Array.isArray(data.products)
//           ? data.products
//           : [];

//       const normalized = list.map((p) => ({
//         ...p,

//         batches: (Array.isArray(p.batches) ? p.batches : []).map((b) => ({
//           batchNo: b.batchNo || "",
//           qty: Number(b.qty ?? 0),

//           mrp: Number(b.mrp ?? 0),
//           salePrice: Number(b.salePrice ?? b.rate ?? 0),

//           // ⭐ REQUIRED FOR RANDOMCODE, EAN, BARCODE MATCH
//           randomCode: b.randomCode || "",
//           ean: b.ean || "",
//           barcode: b.barcode || "",

//           // ⭐ ALWAYS PRODUCT TAX
//           taxPercent: Number(p.taxPercent ?? 0),
//           taxMode: (p.taxMode || "exclusive").toLowerCase(),

//           // ⭐ keep batch status
//           status: b.status || "active",
//         })),
//       }));

//       setProducts(normalized);
//       return normalized;
//     } catch (err) {
//       console.error("fetchProducts failed:", err);
//       return [];
//     }
//   };





//   // Fetch products matching product code OR batch randomCode (ACTIVE ONLY)
//   const fetchProductsByCodeOrRandom = async (q = "") => {
//     if (!user) return [];
//     try {
//       if (!q || !q.toString().trim()) return [];

//       const params = new URLSearchParams({ code: q });

//       // ⭐ UPDATED ROUTE
//       const { data } = await axiosInstance.get(
//         `/api/products/active/search-by-code?${params}`,
//         { headers: getAuthHeaders(user) }
//       );

//       const list = Array.isArray(data)
//         ? data
//         : Array.isArray(data?.products)
//           ? data.products
//           : [];

//       const normalized = list.map((p) => ({
//         ...p,
//         batches:
//           Array.isArray(p.batches) && p.batches.length
//             ? p.batches.map((b) => ({
//               batchNo: b.batchNo || "",
//               randomCode: b.randomCode || "",
//               mrp: Number(b.mrp ?? 0),
//               salePrice: Number(b.salePrice ?? b.rate ?? 0),
//               rate: Number(b.salePrice ?? b.rate ?? 0),

//               qty: Number(b.qty ?? 0),


//               taxPercent: Number(b.taxPercent ?? p.taxPercent ?? 0),
//               taxMode: (b.taxMode || p.taxMode || "exclusive").toLowerCase(),
//             }))
//             : [],
//       }));

//       return normalized;
//     } catch (err) {
//       console.error("fetchProductsByCodeOrRandom", err);
//       return [];
//     }
//   };




//   useEffect(() => {
//     fetchProductsByCodeOrRandom(""); // Load all on mount
//   }, []);

//   useEffect(() => {
//     fetchProducts(""); // Load all on mount
//   }, []);





//   // =============================
//   //  RANDOMCODE SCAN SEARCH
//   // =============================
//   const fetchByScanRandomCode = async (code = "") => {
//     if (!user) return [];
//     try {
//       if (!code.trim()) return [];

//       const params = new URLSearchParams({ code });
//       const res = await axiosInstance.get(
//         `/api/products/search-by-code?${params}`,
//         { headers: getAuthHeaders(user) }
//       );

//       const list = Array.isArray(res.data)
//         ? res.data
//         : Array.isArray(res.data?.products)
//           ? res.data.products
//           : [];

//       return list.map((p) => ({
//         ...p,
//         batches: (p.batches || []).map((b) => ({
//           batchNo: b.batchNo || "",
//           randomCode: b.randomCode || "",
//           ean: b.ean || "",
//           barcode: b.barcode || "",


//           qty: Number(b.qty ?? 0),
//           status: b.status,

//           mrp: Number(b.mrp ?? 0),
//           salePrice: Number(b.salePrice ?? b.rate ?? 0),

//           taxPercent: Number(b.taxPercent ?? p.taxPercent ?? 0),
//           taxMode: (b.taxMode || p.taxMode || "exclusive").toLowerCase(),
//         })),
//       }));
//     } catch (err) {
//       console.error("SCAN ERROR:", err);
//       return [];
//     }
//   };


//   // =============================
//   //  MANUAL PRODUCT SEARCH
//   // =============================
//   const fetchByManualSearch = async (text = "") => {
//     return await fetchProducts(text);
//   };

//   // =============================
//   //  FIND MATCHING BATCH BY RANDOMCODE
//   // =============================
//   const findBatchByRandomCode = (product, randomCode) => {
//     if (!product?.batches) return null;
//     return (
//       product.batches.find((b) => b.randomCode == randomCode) ||
//       product.batches[0]
//     );
//   };


//   useEffect(() => {
//     if (!isModalOpen) {
//       setRows((prev) =>
//         prev.map((r) => ({
//           ...r,
//           qty: 0,
//           batch: "",
//         }))
//       );
//       refreshBatchLists();
//     }
//   }, [isModalOpen]);


//   // -------------------- Keyboard Navigation for Batch Dropdown --------------------
//   const handleBatchKey = (e, rowId) => {
//     // If scan mode → DO NOT allow keyboard batch selection
//     const row = rows.find(r => r.id === rowId);
//     if (row?._scanMode) {
//       e.preventDefault();
//       return;
//     }

//     const list = batchesByRow[rowId] || [];
//     if (!showBatchList[rowId] || list.length === 0) return;

//     const key = e.key;

//     // Prevent arrow keys from jumping to next table cell
//     if (["ArrowDown", "ArrowUp", "PageDown", "PageUp"].includes(key)) {
//       e.preventDefault();
//     }

//     let curIdx = activeSuggestionIndex[`batch-${rowId}`] ?? -1;
//     let newIdx = curIdx;

//     // Move down
//     if (key === "ArrowDown") {
//       newIdx = Math.min(list.length - 1, curIdx + 1);
//     }

//     // Move up
//     else if (key === "ArrowUp") {
//       newIdx = Math.max(0, curIdx - 1);
//     }

//     // Page down (skip 5 rows)
//     else if (key === "PageDown") {
//       newIdx = Math.min(list.length - 1, curIdx + 5);
//     }

//     // Page up (skip 5 rows)
//     else if (key === "PageUp") {
//       newIdx = Math.max(0, curIdx - 5);
//     }

//     // ENTER → pick selected batch
//     else if (key === "Enter") {
//       e.preventDefault();

//       const selected = list[curIdx];
//       if (!selected) return;

//       handleBatchPick(rowId, normalizeBatch(selected));

//       // close popup
//       setShowBatchList((m) => ({ ...m, [rowId]: false }));

//       // return focus to qty (best workflow)
//       setTimeout(() => {
//         const qtyInput = document.querySelector(
//           `input[data-row="${rowId}"][data-field="qty"]`
//         );
//         if (qtyInput) qtyInput.focus();
//       }, 30);

//       return;
//     }

//     // ESC → close dropdown safely
//     else if (key === "Escape") {
//       e.preventDefault();
//       setShowBatchList((m) => ({ ...m, [rowId]: false }));

//       // return to batch input
//       setTimeout(() => {
//         const batchInput = document.querySelector(
//           `input[data-row="${rowId}"][data-field="batch"]`
//         );
//         if (batchInput) batchInput.focus();
//       }, 30);

//       return;
//     }

//     setActiveSuggestionIndex((s) => ({
//       ...s,
//       [`batch-${rowId}`]: newIdx,
//     }));
//   };




//   useEffect(() => {
//     const savedCounter = localStorage.getItem("counter");
//     if (savedCounter) {
//       setMeta(prev => ({
//         ...prev,
//         counter: Number(savedCounter)
//       }));
//     }
//   }, []);




//   const fetchBills = async (pageNum = 1) => {
//     try {
//       setLoading(true);
//       const params = new URLSearchParams({
//         page: pageNum,
//         limit,
//         search,
//         filter,
//         fromDate,
//         toDate,
//         counter: counterFilter ? Number(counterFilter) : "",
//         statusFilter: statusFilter || "all",
//       });
//       const { data } = await axiosInstance.get(`/api/sales?${params}`, {
//         headers: getAuthHeaders(user),
//       });
//       setBills(Array.isArray(data?.bills) ? data.bills : []);
//       setTotalPages(Number(data?.totalPages || 1));
//       // setPage(Number(data?.page || pageNum));
//     } catch (e) {
//       console.error("fetchBills", e);
//       setBills([]);
//       setTotalPages(1);
//     } finally {
//       setLoading(false);
//     }
//   };

//   const fetchBillNo = async () => {
//     try {
//       if (!token || !shopname) return;

//       const { data } = await axiosInstance.get("/api/sales/next-billno", {
//         headers: { ...getAuthHeaders(user), "x-shopname": shopname },
//       });

//       console.log("✅ API BillNo:", data); // Should show { billNo: 'B070' }

//       const istDate = new Date(Date.now() + 5.5 * 60 * 60 * 1000);

//       setMeta((prev) => {
//         const updated = {
//           ...prev,
//           billNo: data?.billNo || "", // ✅ FIXED: Use correct key
//           date: istDate.toISOString().slice(0, 10),
//         };
//         console.log("🟢 Meta updated:", updated);
//         return updated;
//       });
//     } catch (e) {
//       console.error("fetchBillNo error:", e);
//     }
//   };

//   useEffect(() => {
//     console.log("🟢 Meta updated:", meta);
//   }, [meta]);


//   useEffect(() => {
//     const init = async () => {
//       if (token && shopname) {
//         // await fetchProducts();
//         await fetchBillNo();
//         await fetchBills();
//       }
//     };
//     init();
//   }, [token, shopname]);


 
//   useEffect(() => {
//     if (!token || !shopname) return;

//     fetchBills(page);

//   }, [page, search, filter, fromDate, toDate, counterFilter, statusFilter]);


//   const refreshBatchLists = () => {
//     setRows((prev) =>
//       prev.map((r) => {
//         const batches = r.name
//           ? getBatchesForName(r.name)
//           : r.code
//             ? getBatchesForCode(r.code)
//             : [];
//         return { ...r, availableBatches: batches };
//       })
//     );
//   };

//   // ---------------- Row math ----------------
//   const recalcRow = (r) => {
//     const rate = Number(r.rate || 0); // displayed rate (may be inclusive or exclusive)
//     const qty = Number(r.qty || 0);
//     const gst = Number(r.gst || 0); // e.g. 5 for 5%
//     // determine mode: prefer row.isInclusive, fallback to row.taxMode string
//     const isInclusive =
//       typeof r.isInclusive !== "undefined"
//         ? Boolean(r.isInclusive)
//         : (r.taxMode || "").toString().toLowerCase() === "inclusive";

//     // amount = base * qty (base = price before gst)
//     let baseUnit = 0;
//     let gstAmount = 0;
//     let amount = 0;
//     let value = 0;

//     if (isInclusive) {
//       // rate includes GST. baseUnit = rate / (1 + gst/100)
//       const divisor = 1 + gst / 100;
//       baseUnit = divisor > 0 ? +(rate / divisor).toFixed(6) : 0; // keep extra precision
//       amount = +(baseUnit * qty).toFixed(2); // base * qty
//       const gross = +(rate * qty).toFixed(2); // shown value
//       gstAmount = +(gross - amount).toFixed(2);
//       value = gross; // inclusive value is the shown total
//     } else {
//       // exclusive: rate is baseUnit
//       baseUnit = +rate;
//       amount = +(baseUnit * qty).toFixed(2);
//       gstAmount = +((amount * gst) / 100).toFixed(2);
//       value = +(amount + gstAmount).toFixed(2);
//     }


//     // ⭐ FIXED STOCK CALCULATION
//     const opening = Number(r.openingStock || 0);
//     const closing = Math.max(0, opening - qty);

//     console.log(
//       "%cRECALC → STOCK UPDATE",
//       "color: orange; font-weight: bold;",
//       { code: r.code, batch: r.batch, opening, qty, closing }
//     );

//     // return computed fields; keep backwards compat fields amount/value
//     return {
//       ...r,
//       baseUnit,
//       amount,
//       gstAmount,
//       value,
//       isInclusive,


//       // ⭐ FIXED – always return the NEW computed values
//       openingStock: opening,
//       closingStock: closing,
//     };
//   };

//   const updateRow = (id, field, value) => {
//     if (updateRowBlockedRef.current) return;

//     setRows((prev) =>
//       prev.map((r) => {
//         if (r.id !== id) return r;

//         // ❌ Prevent overwrites during scan fill
//         if (r._scanMode) return r;

//         let v = value;
//         if (["mrp", "rate", "gst", "qty"].includes(field)) {
//           v = Number(value) || 0;
//         }

//         let updated = { ...r, [field]: v };

//         // -----------------------------------------------
//         //  PRODUCT / NAME AUTO-FILL (manual only)
//         // -----------------------------------------------
//         if ((field === "code" || field === "name") && v) {
//           const finder = findProductByKey(v);

//           if (finder && finder.product) {
//             const prod = finder.product;
//             const batch = finder.matchedBatch;

//             updated.code = prod.code;
//             updated.name = prod.name;

//             // ⭐ TAX TAKEN ONLY FROM PRODUCT ALWAYS
//             updated.gst = Number(prod.taxPercent || 0);
//             updated.taxMode = (prod.taxMode || "exclusive").toLowerCase();
//             updated.isInclusive = updated.taxMode === "inclusive";

//             if (batch) {
//               updated.batch = batch.batchNo;
//               updated.mrp = Number(batch.mrp || 0);
//               updated.rate = Number(batch.salePrice || 0);
//               updated.qty = updated.qty || 1;
//             } else {
//               updated.batch = "";
//               updated.mrp = 0;
//               updated.rate = 0;
//               updated.qty = 0;
//             }
//           }
//         }

//         // --------------------------------------------------------------------
//         // 🔥 FULL STOCK VALIDATION 
//         // --------------------------------------------------------------------
//         if (field === "qty") {
//           const product = products.find(
//             (p) => normalizeKey(p.code) === normalizeKey(r.code)
//           );
//           const batchObj = product?.batches?.find(
//             (b) => normalizeKey(b.batchNo) === normalizeKey(r.batch)
//           );

//           if (product && batchObj) {
//             const baseStock = Number(batchObj.qty || 0); // available in DB
//             const k = getStockKey(r.code, r.batch);

//             // reserved by other UI rows
//             const rowsReservedExcludingThis = getRowsReservedForKey(
//               r.code,
//               r.batch,
//               r.id
//             );

//             // reservedStock = external reservations (other invoices)
//             const rawReserved = Number(reservedStock[k] || 0);
//             const externalReserved = Math.max(
//               0,
//               rawReserved - rowsReservedExcludingThis
//             );

//             // what remains for this row
//             const availableOutside = Math.max(
//               0,
//               baseStock - (rowsReservedExcludingThis + externalReserved)
//             );

//             const newQty = Number(v || 0);
//             const oldQty = Number(r.qty || 0);
//             const diff = newQty - oldQty;

//             if (diff > 0 && diff > availableOutside) {
//               showPopup(`Only ${baseStock} available`, "error");

//               // ❌ Reject update → keep old qty
//               return recalcRow({ ...r });
//             }
//           }
//         }



//         return recalcRow(updated);
//       })
//     );
//   };



//   // ---------------- Stock helpers ----------------

//   useEffect(() => {
//     const valid = rows.filter(r => !r.isNew);

//     let totalValue = 0;  // sum of row.value (gross)
//     let totalGST = 0;

//     valid.forEach(r => {
//       totalValue += Number(r.value || 0);
//       totalGST += Number(r.gstAmount || 0);
//     });

//     const cgst = +(totalGST / 2).toFixed(2);
//     const sgst = +(totalGST / 2).toFixed(2);

//     const discount = Number(totals.discount || 0);
//     const netAmount = +(totalValue - discount).toFixed(2);

//     const cashGiven = Number(totals.cashGiven || 0);
//     const balance = +(cashGiven - netAmount).toFixed(2);

//     setTotals(prev => ({
//       ...prev,
//       total: +totalValue.toFixed(2),
//       gst: +totalGST.toFixed(2),
//       cgst,
//       sgst,
//       discount,
//       netAmount,
//       cashGiven,
//       balance,
//     }));
//   }, [rows, totals.discount, totals.cashGiven]);


//   const normalize = (s) => (s || "").trim().toLowerCase();

//   const uniqueProducts = (arr) => {
//     const seen = new Set();
//     return arr.filter((p) => {
//       const k = `${(p.code || "").trim()}|${(p.name || "").trim()}`;
//       if (seen.has(k)) return false;
//       seen.add(k);
//       return true;
//     });
//   };


//   // 🔄 Suggest by Product Name — full backend search (limit = 0 when searching)
//   const suggestNamesDebounced = useMemo(
//     () =>
//       debounceFn(async (rowId, query) => {
//         const q = (query || "").trim();
//         if (!q) {
//           setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
//           setShowNameList((s) => ({ ...s, [rowId]: false }));
//           return;
//         }

//         try {
//           // 🔍 fetch all matches from backend (no pagination limit)
//           const isSearching = !!q.trim();
//           const limit = isSearching ? 0 : 10;
//           let queryStr = `${getApiPath("products")}?limit=${limit}`;
//           if (isSearching) queryStr += `&search=${encodeURIComponent(q)}`;

//           const res = await apiClient.get(queryStr);
//           const data = res?.data || {};
//           const allProducts = Array.isArray(data.products)
//             ? data.products
//             : Array.isArray(data)
//               ? data
//               : [];

//           // ✅ filter & deduplicate by name
//           const matches = Array.from(
//             new Map(
//               allProducts
//                 .filter((p) =>
//                   (p.name || "").toLowerCase().includes(q.toLowerCase())
//                 )
//                 .map((p) => [p.name.toLowerCase(), p])
//             ).values()
//           ).slice(0, 20);

//           setNameSuggestions((s) => ({ ...s, [rowId]: matches }));
//           setShowNameList((s) => ({ ...s, [rowId]: matches.length > 0 }));
//         } catch (err) {
//           console.error("❌ Error fetching name suggestions:", err);
//           setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
//           setShowNameList((s) => ({ ...s, [rowId]: false }));
//         }
//       }, 300),
//     []
//   );

//   // 🔄 Suggest by Product Code — full backend search (limit = 0 when searching)
//   const suggestCodesDebounced = useMemo(
//     () =>
//       debounceFn(async (rowId, query) => {
//         const q = (query || "").trim();
//         if (!q) {
//           setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
//           setShowCodeList((s) => ({ ...s, [rowId]: false }));
//           return;
//         }

//         try {
//           const isSearching = !!q.trim();
//           const limit = isSearching ? 0 : 10;
//           let queryStr = `${getApiPath("products")}?limit=${limit}`;
//           if (isSearching) queryStr += `&search=${encodeURIComponent(q)}`;

//           const res = await apiClient.get(queryStr);
//           const data = res?.data || {};
//           const allProducts = Array.isArray(data.products)
//             ? data.products
//             : Array.isArray(data)
//               ? data
//               : [];

//           // ✅ filter & deduplicate by code
//           const matches = Array.from(
//             new Map(
//               allProducts
//                 .filter((p) =>
//                   (p.code || "").toLowerCase().includes(q.toLowerCase())
//                 )
//                 .map((p) => [p.code.toLowerCase(), p])
//             ).values()
//           ).slice(0, 20);

//           setCodeSuggestions((s) => ({ ...s, [rowId]: matches }));
//           setShowCodeList((s) => ({ ...s, [rowId]: matches.length > 0 }));
//         } catch (err) {
//           console.error("❌ Error fetching code suggestions:", err);
//           setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
//           setShowCodeList((s) => ({ ...s, [rowId]: false }));
//         }
//       }, 300),
//     []
//   );


//   const getBatchesForCode = (code) => {
//     const matches = products.filter(
//       (p) => (p.code || "").toLowerCase() === (code || "").toLowerCase()
//     );
//     return matches.flatMap((p) => p.batches || []);
//   };

//   const getBatchesForName = (name) => {
//     const matches = products.filter(
//       (p) => (p.name || "").toLowerCase() === (name || "").toLowerCase()
//     );
//     return matches.flatMap((p) => p.batches || []);
//   };

//   const normalizeBatch = (m) => ({
//     ...m,
//     batchNo: m.batchNo || "",
//     mrp: Number(m.mrp || 0),
//     rate: Number(m.rate || m.salePrice || 0),
//     gst: Number(m.gst || m.taxPercent || 0),
//     qty: Number(m.qty || 0),
//   });




//   const handleSelectSuggestion = (rowId, product, isRandom = false) => {

//     // Update row
//     setRows((prev) =>
//       prev.map((r) => {
//         if (r.id !== rowId) return r;

//         const isInclusive =
//           (product.taxMode || "").toLowerCase() === "inclusive";

//         return recalcRow({
//           ...r,
//           code: product.code || "",
//           name: product.name || "",
//           batch: "",
//           mrp: Number(product.mrp ?? 0),
//           rate: Number(product.salePrice ?? 0),
//           gst: Number(product.taxPercent ?? 0),
//           qty: 0,
//           taxMode: (product.taxMode || "exclusive").toLowerCase(),
//           isInclusive
//         });
//       })
//     );

//     if (isRandom) {
//       // Random selection → auto-fill first batch
//       const firstBatch =
//         product.batches?.[0] ||
//         getBatchesForCode(product.code)?.[0] ||
//         {};

//       const tMode = (firstBatch.taxMode || product.taxMode || "exclusive").toLowerCase();

//       setRows((prev) =>
//         prev.map((r) => {
//           if (r.id !== rowId) return r;
//           return recalcRow({
//             ...r,
//             batch: firstBatch.batchNo || "",
//             mrp: Number(firstBatch.mrp ?? 0),
//             rate: Number(firstBatch.salePrice ?? 0),
//             gst: Number(firstBatch.taxPercent ?? 0),
//             qty: 1,
//             taxMode: tMode,
//             isInclusive: tMode === "inclusive",
//             // ⭐ FIX STOCK
//             openingStock: Number(firstBatch.qty || 0),
//             closingStock: Math.max(0, Number(firstBatch.qty || 0) - 1),
//           });
//         })
//       );




//       // Hide batch dropdown
//       setBatchesByRow((p) => ({ ...p, [rowId]: [] }));
//       setShowBatchList((p) => ({ ...p, [rowId]: false }));

//       // Blur batch input to avoid flicker
//       setTimeout(() => {
//         const batchInput = document.querySelector(
//           `input[data-row="${rowId}"][data-field="batch"]`
//         );
//         batchInput?.blur();
//       }, 20);

//       // ⭐ FOCUS QTY FOR RANDOM CODE ⭐
//       setTimeout(() => {
//         const qtyInput = document.querySelector(
//           `input[data-row="${rowId}"][data-field="qty"]`
//         );
//         qtyInput?.focus();
//       }, 60);

//     }


//     // Hide suggestions


//     else {

//       // Normal product → show batch list
//       const batches = product.batches?.length
//         ? product.batches
//         : getBatchesForCode(product.code);

//       setBatchesByRow((p) => ({ ...p, [rowId]: batches || [] }));
//       setShowBatchList((p) => ({
//         ...p,
//         [rowId]: (batches || []).length > 0
//       }));

//       // ⭐ AUTO-FILL STOCK FROM FIRST BATCH (soft fill)
//       const firstBatch = (batches || [])[0];

//       if (firstBatch) {
//         setRows((prev) =>
//           prev.map((r) => {
//             if (r.id !== rowId) return r;
//             return {
//               ...r,
//               openingStock: Number(firstBatch.qty || 0),
//               closingStock: Math.max(
//                 0,
//                 Number(firstBatch.qty || 0) - Number(r.qty || 0)
//               ),
//             };
//           })
//         );
//       }

//       // ⭐ FOCUS BATCH FOR NORMAL SELECTION ⭐
//       setTimeout(() => {
//         const batchInput = document.querySelector(
//           `input[data-row="${rowId}"][data-field="batch"]`
//         );
//         batchInput?.focus();
//       }, 30);
//     }


//     setShowCodeList((p) => ({ ...p, [rowId]: false }));
//     setShowNameList((p) => ({ ...p, [rowId]: false }));
//   };


//   function getAvailableForQtyInput(row) {
//     const product = products.find(
//       (p) => normalizeKey(p.code) === normalizeKey(row.code)
//     );
//     const batchObj = product?.batches?.find(
//       (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
//     );

//     const baseStock = Number(batchObj?.qty || 0);

//     // reserved except this row
//     const reservedOtherRows = getRowsReservedForKey(row.code, row.batch, row.id);

//     return Math.max(0, baseStock - reservedOtherRows);
//   }


//   /* -------------------- HANDLE BATCH PICK (FINAL PATCH) -------------------- */
//   const handleBatchPick = (rowId, batch) => {
//     if (!batch) return;

//     const nb = normalizeBatch(batch);
//     const row = rows.find((r) => r.id === rowId);
//     if (!row) return;

//     const available = getAvailableStock(row.code, nb.batchNo);
//     if (available <= 0) {
//       showPopup(`Batch ${nb.batchNo} is OUT OF STOCK.`, "error");
//       return;
//     }

//     const isScan = row._scanMode === true;

//     // Update row fields
//     setRows((prev) =>
//       prev.map((r) =>
//         r.id === rowId
//           ? recalcRow({
//             ...r,
//             batch: nb.batchNo,
//             mrp: nb.mrp,
//             rate: nb.rate,
//             gst: nb.gst,
//             qty: isScan ? (r.qty > 0 ? r.qty : 1) : r.qty,
//             _scanMode: isScan,
//             isInclusive: (nb.taxMode || "").toLowerCase() === "inclusive",

//           })
//           : r
//       )
//     );

//     // Keep external reserved key alive
//     const key = getStockKey(row.code, nb.batchNo);
//     setReservedStock((rs) => {
//       if (typeof rs[key] === "undefined") {
//         return { ...rs, [key]: 0 };
//       }
//       return rs;
//     });

//     setShowBatchList((s) => ({ ...s, [rowId]: false }));

//     // --------------------------------------------------------
//     // 🔥 NEW FEATURE: WHEN USER PICKS BATCH → JUMP TO QTY INPUT
//     // --------------------------------------------------------
//     setTimeout(() => {
//       const qtyInput = document.querySelector(
//         `input[data-row="${rowId}"][data-field="qty"]`
//       );
//       if (qtyInput) qtyInput.focus();
//     }, 30);
//   };


//   const handlePrint = useReactToPrint({
//     content: () => printRef.current,
//     pageStyle: `
//     @page {
//       size: 7.5cm auto !important;
//       margin: 0 !important;
//     }
//     @media print {
//       body {
//         background: transparent !important;
//         -webkit-print-color-adjust: exact;
//       }
//       .print-area {
//         width: 7.5cm !important;
//         background: transparent !important;
//         margin: 0 !important;
//         padding: 0 !important;
//         font-family: 'Courier New', monospace;
//         font-size: 10px;
//         color: #000 !important;
//       }
//     }
//   `,
//   });

//   const openBillPrintWindow = (bill, selectedShop) => {

//     const itemsHtml = (bill.items || [])
//       .map(
//         (it) => `
//       <div style="display:flex;font-size:10px;">
//         <span style="flex:3;text-align:left;">${it.name}</span>
//         <span style="flex:1;text-align:center;">${it.batch}</span>
//         <span style="flex:1;text-align:right;">${Number(it.mrp).toFixed(2)}</span>
//         <span style="flex:1;text-align:right;">${Number(it.rate).toFixed(2)}</span>
//         <span style="flex:0.8;text-align:right;">${it.qty}</span>
//         <span style="flex:1.2;text-align:right;">${Number(it.value).toFixed(2)}</span>
//       </div>
//     `
//       )
//       .join("");

//     // ---------- GST SUMMARY ----------
//     let totalGST = 0;
//     const gstSummary = {};

//     (bill.items || []).forEach((r) => {
//       const gstRate = Number(r.gst || 0);
//       const qty = Number(r.qty || 0);
//       const rate = Number(r.rate || 0);
//       if (!gstRate || !qty || !rate) return;

//       const inclusive = r.isInclusive !== false;
//       const gross = rate * qty;
//       const taxable = inclusive ? gross / (1 + gstRate / 100) : gross;
//       const gstAmt = inclusive ? gross - taxable : taxable * (gstRate / 100);

//       totalGST += gstAmt;
//       gstSummary[gstRate] = (gstSummary[gstRate] || 0) + gstAmt;
//     });

//     const gstHtml = Object.keys(gstSummary)
//       .map(
//         (rate) => `
//       <div style="display:flex;justify-content:space-between;font-size:10px;">
//         <span>${rate}%</span>
//         <span>${gstSummary[rate].toFixed(2)}</span>
//       </div>
//     `
//       )
//       .join("");

//     // ---------- HTML ----------
//     const html = `
// <html>
// <head>
// <meta charset="UTF-8" />
// <style>
// @page { size: 76mm auto; margin: 0; }
// body {
//   width: 76mm;
//   margin: 0;
//   padding: 2mm;
//   font-family: Arial, sans-serif;
//   color: #000;
// }
// hr {
//   border: 0.5px dashed #000;
//   margin: 4px 0;
// }
// </style>
// </head>

// <body>

//   <div style="text-align:center;margin-bottom:6px;">
//     <img src="/logo-icon.png" width="40" style="display:block;margin:auto;" />
//     <div style="font-weight:600;color:#006400;">CSI Diocese Book Depot</div>
//     <div style="font-weight:600;color:#006400;">${selectedShop?.shopname || ""}</div>

//     <div style="font-size:10px;margin-top:2px;">
//       ${selectedShop?.address || ""}
//     </div>

//     <div style="font-size:10px;">
//       Phone: ${selectedShop?.contact || "N/A"}
//     </div>
//   </div>

//   <div style="text-align:center;font-weight:700;font-size:12px;color:#006400;margin:4px 0;">
//     BILL
//   </div>

//   <div style="display:flex;justify-content:space-between;font-size:10px;margin-bottom:4px;">
//    <div style="text-align:left;">
//     <div>GSTIN NO: 123456789</div>
//     <div>Bill No: ${bill.billNo}</div>
//     </div>
//     <div style="text-align:right;">
//       <div>Date: ${new Date(bill.date).toLocaleDateString("en-GB")}</div>
//       <div>Time: ${new Date(bill.createdAt).toLocaleTimeString()}</div>
//     </div>
//   </div>

//   <hr />

//   <div style="width:90%;margin:auto;display:flex;font-weight:700;color:#006400;font-size:10px;">
//     <span style="flex:3;text-align:left;">Product Name</span>
//     <span style="flex:1;text-align:center;">Batch</span>
//     <span style="flex:1;text-align:right;">MRP</span>
//     <span style="flex:1;text-align:right;">Rate</span>
//     <span style="flex:0.8;text-align:right;">Qty</span>
//     <span style="flex:1.2;text-align:right;">Value</span>
//   </div>

//   <hr />

//   <div style="width:90%;margin:auto;">
//     ${itemsHtml}
//   </div>

//   <hr />

//   <div style="width:90%;margin:auto;display:flex;font-weight:700;font-size:10px;">
//     <span style="flex:3;text-align:center;">TOTAL</span>
//     <span style="flex:1;"></span>
//     <span style="flex:1;"></span>
//     <span style="flex:1;"></span>
//     <span style="flex:0.8;text-align:right;">
//       ${bill.items.reduce((a, c) => a + Number(c.qty), 0)}
//     </span>
//     <span style="flex:1.2;text-align:right;">
//       ${(bill.items.reduce((a, c) => a + Number(c.value), 0)).toFixed(2)}
//     </span>
//   </div>

//   <hr />

//  <div style="color:#000;">
  
//   <!-- GST Title -->
//   <div style="font-weight:700;color:#006400;margin-top:4px;">GST</div>

//   <!-- Header Row -->
//   <div style="display:flex;font-size:10px;font-weight:700;color:#006400;">
//     <span style="flex:1;text-align:left;">GST%</span>
//     <span style="flex:1;text-align:right;">GST Value</span>
//     <span style="flex:1;text-align:right;">CGST</span>
//     <span style="flex:1;text-align:right;">SGST</span>
//     <span style="flex:1;text-align:right;">GST</span>
//   </div>
//   <hr />

//   <!-- GST Rate Rows -->
//   ${Object.keys(gstSummary)
//         .map(rate => {
//           const gstValue = gstSummary[rate];
//           const cgst = gstValue / 2;
//           const sgst = gstValue / 2;
//           const total = gstValue;

//           return `
//       <div style="display:flex;font-size:10px;">
//         <span style="flex:1;text-align:left;">${rate}%</span>
//         <span style="flex:1;text-align:right;">${gstValue.toFixed(2)}</span>
//         <span style="flex:1;text-align:right;">${cgst.toFixed(2)}</span>
//         <span style="flex:1;text-align:right;">${sgst.toFixed(2)}</span>
//         <span style="flex:1;text-align:right;">${total.toFixed(2)}</span>
//       </div>
      
//       `;
//         })
//         .join("")}
//     <hr />

//   <!-- Total GST Row -->
//   <div style="display:flex;font-size:10px;font-weight:700;">
//     <span style="flex:1;text-align:left;">Total</span>
//     <span style="flex:1;text-align:right;">${totalGST.toFixed(2)}</span>
//     <span style="flex:1;text-align:right;">${(totalGST / 2).toFixed(2)}</span>
//     <span style="flex:1;text-align:right;">${(totalGST / 2).toFixed(2)}</span>
//     <span style="flex:1;text-align:right;">${totalGST.toFixed(2)}</span>
//   </div>
//   <hr />

// </div>


//   <hr />

//   <div style="text-align:left;color:#000;font-weight:600;padding:4px 0 4px 10px;font-size:11px;">
//     <div style="display:flex;justify-content:space-between;width:90%;">
//       <span>Total Amount:</span>
//       <span>${Number(bill.total).toFixed(2)}</span>
//     </div>
//     <div style="display:flex;justify-content:space-between;width:90%;">
//       <span>Net Bill Amount:</span>
//       <span>${Number(bill.netAmount).toFixed(2)}</span>
//     </div>
//     <div style="display:flex;justify-content:space-between;width:90%;">
//       <span>Tendered Amount:</span>
//       <span>${Number(bill.cashGiven).toFixed(2)}</span>
//     </div>
//     <div style="display:flex;justify-content:space-between;width:90%;">
//       <span>Balance:</span>
//       <span>${Number(bill.balance).toFixed(2)}</span>
//     </div>
//   </div>

//   <hr />

//   <div style="margin-top:10px;text-align:center;color:#006400;font-weight:600;font-size:11px;">
//     GOD IS OUR REFUGE AND STRENGTH
//   </div>

//   <script>
//     window.onload = () => setTimeout(() => window.print(), 200);
//   </script>

// </body>
// </html>
// `;

//     const win = window.open("", "_blank", "width=400,height=600");
//     win.document.write(html);
//     win.document.close();
//   };





//   // -----------------------------------------------------------
//   // ⭐ Determine whether a row uses inclusive tax or exclusive
//   // -----------------------------------------------------------
//   const resolveIsInclusive = (row) => {
//     if (typeof row.isInclusive === "boolean") return row.isInclusive;

//     const prod = products.find(
//       (p) => (p.code || "").toLowerCase() === (row.code || "").toLowerCase()
//     );
//     if (!prod) return true;

//     const batch = (prod.batches || []).find(
//       (b) =>
//         (b.batchNo || "").toLowerCase() ===
//         (row.batch || "").toLowerCase()
//     );

//     if (batch && typeof batch.taxMode === "string") {
//       return batch.taxMode.toLowerCase() === "inclusive";
//     }

//     if (typeof prod.taxMode === "string") {
//       return prod.taxMode.toLowerCase() === "inclusive";
//     }

//     return false;
//   };




//   const handleSaveAndPrint = async () => {
//     if (saving || isSavingRef.current) {
//       console.warn("⛔ Prevented duplicate save");
//       return;
//     }
//     try {
//       setSaving(true);              // ✅ UI LOCK
//       isSavingRef.current = true;   // ✅ Hard lock


//       if (!rows.length) {
//         setErrorMsg("Add items before saving.");
//         setSaving(false);
//         isSavingRef.current = false;
//         return;
//       }

//       const validItems = rows.filter(
//         (r) => r.code && r.batch && Number(r.qty) >= 0
//       );
//       if (!validItems.length) {
//         setErrorMsg("No valid items to save.");
//         isSavingRef.current = false;
//         setSaving(false);
//         return;
//       }

//       const headers = getAuthHeaders(user);


//       // ⭐ RUN STOCK UPDATES ONLY ON FIRST CLICK
//       if (!stockAppliedRef.current) {
//         try {
//           if (!billEditMode) {
//             // 🔥 NEW BILL → decrement ONCE
//             for (const r of validItems) {
//               const qty = Number(r.qty);
//               if (qty > 0) {
//                 await axiosInstance.put(
//                   "/api/products/decrement-stock",
//                   { items: [{ code: r.code, batchNo: r.batch, qty }] },
//                   { headers }
//                 );
//               }
//             }
//           }

//           if (billEditMode && editingBillId) {
//             // 🔥 EDIT BILL → apply qty DIFFERENCE ONCE
//             for (const r of validItems) {
//               const newQty = Number(r.qty);
//               const oldQty = Number(originalBillItems?.[r.id]?.qty || 0);
//               if (newQty === oldQty) continue;

//               let api = "";
//               let qty = 0;

//               if (newQty > oldQty) {
//                 api = "/api/products/decrement-stock";
//                 qty = newQty - oldQty;
//               } else {
//                 api = "/api/products/increment-stock";
//                 qty = oldQty - newQty;
//               }

//               await axiosInstance.put(
//                 api,
//                 { items: [{ code: r.code, batchNo: r.batch, qty }] },
//                 { headers }
//               );
//             }
//           }

//           // ⭐ Prevent future stock changes
//           stockAppliedRef.current = true;
//         } catch (err) {
//           console.error("Stock update failed", err);
//           stockAppliedRef.current = false; // 🔥 rollback lock
//           throw err; // rethrow so main catch handles it
//         }
//       }


//       /* ------------------------------------------------------------------
//           ⭐ Build processed items (with opening & closing stock)
//          ------------------------------------------------------------------ */
//       const processedItems = validItems.map((r) => {
//         const qty = Number(r.qty || 0);
//         const rate = Number(r.rate || 0);
//         const gst = Number(r.gst || 0);

//         const inclusive = resolveIsInclusive(r);

//         let taxable = 0;
//         let gstAmount = 0;
//         let value = 0;

//         if (inclusive) {
//           const gross = +(rate * qty);
//           taxable = +(gross / (1 + gst / 100));
//           taxable = +taxable.toFixed(2);
//           gstAmount = +(gross - taxable);
//           gstAmount = +gstAmount.toFixed(2);
//           value = +gross.toFixed(2);
//         } else {
//           taxable = +(rate * qty);
//           taxable = +taxable.toFixed(2);
//           gstAmount = +(taxable * (gst / 100));
//           gstAmount = +gstAmount.toFixed(2);
//           value = +(taxable + gstAmount);
//           value = +value.toFixed(2);
//         }

//         // ⭐ since stock decremented in frontend,
//         // PREVIOUS qty must be saved before it was reduced
//         const opening = Number(r.openingStock || 0);
//         const closing = Math.max(0, opening - qty);

//         return {
//           code: r.code,
//           name: r.name,
//           batch: r.batch,
//           mrp: Number(r.mrp || 0),
//           rate,
//           gst,
//           qty,
//           taxable,
//           gstAmount: Number(gstAmount || 0),

//           value,
//           isInclusive: inclusive,

//           // ⭐ Snapshot values
//           openingStock: opening,
//           closingStock: closing,
//         };
//       });

//       /* ------------------------------------------------------------------
//           ⭐ Compute totals
//          ------------------------------------------------------------------ */
//       const totalTaxable = processedItems.reduce(
//         (s, it) => s + Number(it.taxable || 0),
//         0
//       );
//       const totalGst = processedItems.reduce(
//         (s, it) => s + Number(it.gstAmount || 0),
//         0
//       );

//       const totalValue = +(totalTaxable + totalGst).toFixed(2);


//       const discount = Number(totals.discount || 0);
//       const netAmount = +(
//         totalTaxable +
//         totalGst -
//         discount
//       ).toFixed(2);

//       // const cashGiven = Number(totals.cashGiven || 0);
//       // const balance = +(
//       //   cashGiven >= netAmount
//       //     ? cashGiven - netAmount
//       //     : netAmount - cashGiven
//       // ).toFixed(2);


//       const cashGiven = Number(totals.cashGiven || 0);

//       // ⭐ IMPORTANT: use PAYMENT, not cashGiven
//       const amountPaid =
//         Number(payment.cash || 0) + Number(payment.upi || 0);

//       // ⭐ POS-CORRECT BALANCE
//       const balance = +(netAmount - amountPaid).toFixed(2);


//       const cgst = +((totalGst / 2) || 0).toFixed(2);
//       const sgst = +((totalGst / 2) || 0).toFixed(2);

//       //------------------------------------------------
//       // AUTO-DETECT PAYMENT METHOD
//       //------------------------------------------------
//       let finalPaymentMethod = paymentMethod;
//       let total = Number(netAmount || 0);

//       // Case 1: Full Cash
//       if (payment.cash === total && payment.upi === 0) {
//         finalPaymentMethod = "cash";
//       }

//       // Case 2: Full UPI
//       else if (payment.upi === total && payment.cash === 0) {
//         finalPaymentMethod = "upi";
//       }

//       // Case 3: Mixed payments → partial
//       else if (payment.cash > 0 && payment.upi > 0) {
//         finalPaymentMethod = "mixed";
//       }

//       // Case 4: No amount entered → keep selected button
//       else {
//         finalPaymentMethod = paymentMethod;
//       }

//       //------------------------------------------------
//       // AUTO-DETECT PAYMENT STATUS
//       //------------------------------------------------
//       let finalPaymentStatus =
//         payment.cash + payment.upi >= total ? "paid" : "partial";




//       const salesPayload = {
//         billNo: meta.billNo,
//         date: meta.date || new Date(),
//         counter: meta.counter || 1,

//         customerName: meta.customerName || "Cash Customer",
//         mobile: meta.mobile || "",

//         items: processedItems,

//         // ⭐ TOTAL = FULL AMOUNT (value)
//         total: Number(totalValue.toFixed(2)),

//         // ⭐ TOTAL GST
//         totalGst: Number(totalGst.toFixed(2)),

//         // ⭐ DISCOUNT & NET AMOUNT
//         discount,
//         discountPercent: Number(totals.discountPercent || 0),
//         netAmount: Number(netAmount.toFixed(2)),

//         cashGiven,
//         balance,

//         // ⭐ TAX SPLIT
//         cgst,
//         sgst,

//         // ⭐ VERY IMPORTANT — stop backend stock update
//         skipStockUpdate: true,

//         // ⭐ AUDIT FIELDS
//         createdBy: user?.username || "",
//         createdById: user?._id || "",
//         counterUser: user?.username || "",
//         deviceInfo: {
//           ip: window?.clientIP || "",
//           userAgent: navigator.userAgent || "",
//         },
//         editedBy: billEditMode ? (user?.username || "") : null,

//         // ⭐ PAYMENT FIELDS
//         paymentMethod: finalPaymentMethod,
//         payment: {
//           cash: Number(payment.cash || 0),
//           upi: Number(payment.upi || 0),
//         },
//         paymentStatus: finalPaymentStatus,
//       };


//       let savedBill;
//       if (billEditMode && editingBillId) {
//         const { data } = await axiosInstance.put(
//           `/api/sales/${editingBillId}`,
//           salesPayload,
//           { headers }
//         );
//         savedBill = data;
//       } else {
//         const { data } = await axiosInstance.post(
//           "/api/sales",
//           salesPayload,
//           { headers }
//         );
//         savedBill = data;
//       }

//       /* ------------------------------------------------------------------
//           ⭐ Show bill & print
//          ------------------------------------------------------------------ */
//       setViewBill(savedBill);
//       setPrintView(true);


//       /* ⭐ PRINT BILL (IMPORTANT FIX) */
//       openBillPrintWindow(savedBill, selectedShop);

//       try {
//         const billToPrint = {
//           billNo: savedBill.billNo,
//           date: new Date(savedBill.date).toLocaleString(),
//           customerName: savedBill.customerName || "Cash Customer",
//           items: savedBill.items || [],
//           total: savedBill.total,
//           netAmount: savedBill.netAmount,
//           cashGiven: savedBill.cashGiven,
//           balance: savedBill.balance,
//         };

//         await axiosInstance.post("/api/print-bill", {
//           bill: billToPrint,
//         });
//       } catch (printErr) {
//         console.error("Print error:", printErr);
//       }

//       const newOriginalMap = {};
//       validItems.forEach((r) => {
//         newOriginalMap[r.id] = {
//           code: r.code,
//           batch: r.batch,
//           qty: Number(r.qty),
//         };
//       });
//       setOriginalBillItems(newOriginalMap);

//       setShowModal(false);
//       setRows([createEmptyRow()]);
//       setTotals({
//         total: 0,
//         discount: 0,
//         netAmount: 0,
//         cashGiven: 0,
//         balance: 0,
//         cgst: 0,
//         sgst: 0,
//       });
//       setMeta((prev) => ({ ...prev, customerName: "", mobile: "" }));
//       setErrorMsg("");
//       setBillEditMode(false);
//       setEditingBillId(null);

//       showPopup("Bill saved.");
//       await fetchBills(1);

//       // 3) Open thermal print window
//       // openBillPrintWindow(data.bill);
//     } catch (err) {
//       console.error("handleSaveAndPrint", err);
//       setErrorMsg(err.response?.data?.message || "Failed to save/print");
//     } finally {
//       isSavingRef.current = false;
//       setSaving(false);
//     }
//   };


//   const handleEditBill = (bill) => {
//     if (!bill) return;
//     setBillEditMode(true);
//     setEditingBillId(bill._id);
//     setShowModal(true);

//     // Ensure rows keep isInclusive & computed fields if present in bill.items
//     const rowsWithId = (bill.items || []).map((item, idx) => {
//       // If the incoming item has isInclusive or taxMode info use it, else infer later
//       const constructed = {
//         ...item,
//         id: item._id || `item-${idx}-${Date.now()}`,
//         isNew: false,
//       };
//       // keep numeric types consistent
//       constructed.qty = Number(constructed.qty || 0);
//       constructed.rate = Number(constructed.rate || 0);
//       constructed.gst = Number(constructed.gst || 0);
//       // If the server already sent taxable/gstAmount/value use those; otherwise recalc in UI via recalcRow logic
//       return constructed;
//     });
//     setRows(rowsWithId);

//     setMeta({
//       billNo: bill.billNo || "",
//       date: bill.date ? new Date(bill.date).toISOString().split("T")[0] : "",
//       counter: bill.counter || 1,
//       customerName: bill.customerName || bill.meta?.customerName || "",
//       mobile: bill.mobile || bill.meta?.mobile || "",
//     });

//     // Prefer server totals, but fallback to computing
//     setTotals({
//       total: Number(bill.total || bill.totals?.total || 0),
//       discount: Number(bill.discount || bill.totals?.discount || 0),
//       netAmount: Number(bill.netAmount || bill.totals?.netAmount || 0),
//       cashGiven: Number(bill.cashGiven || 0),
//       balance: Number(bill.balance || 0),
//       cgst: Number(bill.cgst || 0),
//       sgst: Number(bill.sgst || 0),
//     });

//     const origItemsMap = {};
//     rowsWithId.forEach((item) => {
//       origItemsMap[item.id] = {
//         code: item.code,
//         batch: item.batch,
//         qty: Number(item.qty) || 0,
//       };
//     });
//     setOriginalBillItems(origItemsMap);

//     setTimeout(() => {
//       document.querySelector('input[name="customerName"]')?.focus();
//     }, 200);
//   };


//   useEffect(() => {
//     const closeAll = (e) => {
//       if (
//         !e.target.closest(".suggestions-portal") &&
//         !e.target.closest(".batch-portal") &&
//         !e.target.closest("input")
//       ) {
//         setShowCodeList({});
//         setShowNameList({});
//         setShowBatchList({});
//       }
//     };
//     document.addEventListener("click", closeAll);
//     return () => document.removeEventListener("click", closeAll);
//   }, []);


//   // keyboard support (replace existing)
//   const handleSuggestionKey = (e, rowId, field) => {
//     const key = e.key;
//     const list =
//       field === "code"
//         ? codeSuggestions[rowId] || []
//         : nameSuggestions[rowId] || [];

//     // Build flattened list for keyboard navigation (randomCode items first, then product code)
//     const inputValue = (rows.find((r) => r.id === rowId)?.[field] || "").toLowerCase();

//     const flattened = list.flatMap((p) => {
//       const randomMatches = (p.batches || [])
//         .filter((b) => b.randomCode?.toLowerCase().includes(inputValue))
//         .map((b) => ({ product: p, batch: b, isRandom: true }));
//       const codeMatch = p.code?.toLowerCase().includes(inputValue)
//         ? [{ product: p, batch: null, isRandom: false }]
//         : [];
//       return [...randomMatches, ...codeMatch];
//     });

//     const len = flattened.length;
//     const curIdx = activeSuggestionIndex[rowId] ?? -1;
//     let idx = curIdx;

//     // page size for PageUp/PageDown
//     const PAGE_STEP = 5;

//     if (key === "ArrowDown") {
//       e.preventDefault();
//       idx = Math.min(len - 1, idx + 1);
//     } else if (key === "ArrowUp") {
//       e.preventDefault();
//       idx = Math.max(0, idx - 1);
//     } else if (key === "PageDown") {
//       e.preventDefault();
//       idx = Math.min(len - 1, idx + PAGE_STEP);
//     } else if (key === "PageUp") {
//       e.preventDefault();
//       idx = Math.max(0, idx - PAGE_STEP);
//     } else if (key === "Enter") {
//       if (idx >= 0 && flattened[idx]) {
//         e.preventDefault();
//         const selected = flattened[idx];
//         const inputVal = (rows.find((r) => r.id === rowId)?.code || "").trim();
//         const isBarcode = /^\d{6,}$/.test(inputVal);

//         if (isBarcode && selected.isRandom) {
//           // barcode flow — auto-fill from batch, hide batch dropdown
//           const b = selected.batch;
//           updateRow(rowId, "code", b.randomCode || selected.product.code);
//           updateRow(rowId, "name", selected.product.name);
//           updateRow(rowId, "batch", b.batchNo || "");
//           updateRow(rowId, "mrp", b.mrp || 0);
//           updateRow(rowId, "rate", b.rate || 0);
//           updateRow(rowId, "gst", b.taxPercent || 0);
//           updateRow(rowId, "qty", 0); // default 0 per your request
//           setShowBatchList((prev) => ({ ...prev, [rowId]: false }));
//         } else {
//           // normal product/select flow
//           handleSelectSuggestion(
//             rowId,
//             selected.isRandom ? { ...selected.product, batches: [selected.batch] } : selected.product,
//             selected.isRandom
//           );
//           // if normal product, ensure batch dropdown shows (handleSelectSuggestion sets it)
//           if (!selected.isRandom) {
//             setShowBatchList((s) => ({ ...s, [rowId]: true }));
//           }
//         }

//         // reset states
//         setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
//         setShowCodeList((s) => ({ ...s, [rowId]: false }));
//         setShowNameList((s) => ({ ...s, [rowId]: false }));
//       }
//       return;
//     } else if (key === "Escape") {
//       setShowCodeList((s) => ({ ...s, [rowId]: false }));
//       setShowNameList((s) => ({ ...s, [rowId]: false }));
//       setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
//       return;
//     } else {
//       // any other key -> reset index
//       setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
//       return;
//     }

//     // update active index so UI highlight updates
//     setActiveSuggestionIndex((s) => ({ ...s, [rowId]: idx }));
//   };


//   // ---------------- Portals (render near inputs) ----------------

//   const openAddModal = async () => {


//     // 🔥 first reset everything to fresh state
//     resetBillState();

//     setBillEditMode(false);

//     // 🔥 FETCH NEW BILL FROM BACKEND
//     await fetchBillNo();  // ⬅ your backend API


//     // setBillEditMode(false);
//     setMeta((prev) => ({
//       ...prev,
//       billNo: prev.billNo || "",
//       customerName: "",
//       mobile: "",
//       counter: prev.counter,
//       date: new Date().toISOString().slice(0, 10),
//     }));
//     setTotals({
//       total: 0,
//       discount: 0,
//       netAmount: 0,
//       cashGiven: 0,
//       balance: 0,
//       cgst: 0,
//       sgst: 0,
//     });
//     setRows([createEmptyRow()]);
//     setStockErrors({});
//     setErrorMsg("");
//     setShowModal(true);
//     resetPayment();

//     // 🧭 Auto-focus first Product Code input after modal opens
//     setTimeout(() => {
//       const firstCodeInput = document.querySelector(
//         'input[data-field="code"]'
//       );
//       if (firstCodeInput) {
//         firstCodeInput.focus();
//         firstCodeInput.select(); // optional: highlight previous text
//       }
//     }, 300); // delay to ensure modal is rendered
//   };


//   const resetBillState = () => {
//     // --- reset meta ---
//     setMeta({
//       billNo: "",
//       customerName: "",
//       mobile: "",
//       counter: Number(localStorage.getItem("counter")) || 1,
//       date: new Date().toISOString().slice(0, 10),
//     });

//     // --- reset totals ---
//     setTotals({
//       total: 0,
//       discount: 0,
//       discountPercent: 0,
//       netAmount: 0,
//       cashGiven: 0,
//       balance: 0,
//       cgst: 0,
//       sgst: 0,
//     });

//     // --- reset rows ---
//     setRows([createEmptyRow()]);

//     // --- reset flags ---
//     setStockErrors({});
//     setErrorMsg("");

//     // --- reset scanning locks ---
//     scanLockRef.current = false;
//     lastRawBarcodeRef.current = null;
//     lastScan.current = { code: "", time: 0 };

//     // --- reset suggestion lists ---
//     setShowCodeList({});
//     setShowNameList({});
//     setShowBatchList({});
//     setCodeSuggestions({});
//     setNameSuggestions({});
//     setBatchesByRow({});
//     // set default payment = cash with current netAmount
//     setPaymentMethod("cash");
//     setPayment({
//       cash: Number(0),   // will be synced after totals update
//       upi: 0
//     });

//   };





//   const resetPayment = () => {
//     setPaymentMethod("cash");
//     setPayment({
//       cash: Number(totals?.netAmount || 0),
//       upi: 0
//     });
//   };

//   useEffect(() => {
//     if (paymentMethod === "cash") {
//       setPayment((p) => ({
//         ...p,
//         cash: Number(totals.netAmount || 0),
//         upi: 0
//       }));
//     }
//   }, [totals.netAmount]);



//   const renderCodeSuggestionPortal = (rowId) => {
//     if (!portalRoot) return null;

//     const list = codeSuggestions[rowId] || [];
//     if (!showCodeList[rowId] || list.length === 0) return null;

//     const inputEl = document.querySelector(`input[data-row="${rowId}"][data-field="code"]`);
//     const rect = inputEl?.getBoundingClientRect() || { top: 0, left: 0, width: 240, height: 24 };

//     const style = {
//       position: "fixed",
//       top: rect.top + rect.height + 6,
//       left: rect.left,
//       minWidth: Math.max(240, rect.width),
//       zIndex: 9999,
//       background: "#fff",
//       border: "1px solid #ddd",
//       boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
//       maxHeight: 320,
//       overflowY: "auto",
//       padding: "6px 0",
//     };

//     const inputValue = (rows.find((r) => r.id === rowId)?.code || "").toLowerCase();

//     const flattened = list.flatMap((p) => {
//       const randomMatches = (p.batches || [])
//         .filter((b) => b.randomCode?.toLowerCase().includes(inputValue))
//         .map((b) => ({ product: p, batch: b, isRandom: true }));
//       const codeMatch = p.code?.toLowerCase().includes(inputValue)
//         ? [{ product: p, batch: null, isRandom: false }]
//         : [];
//       return [...randomMatches, ...codeMatch];
//     });

//     const activeIdx = activeSuggestionIndex[rowId] ?? -1;

//     return ReactDOM.createPortal(
//       <div
//         style={style}
//         className="suggestions-portal"
//         role="listbox"
//         onMouseDown={() => (isClickInsideSuggestion.current = true)}
//       >
//         {flattened.map((item, i) => (
//           <div
//             key={`${item.product._id}-${i}`}
//             className="suggestion"
//             role="option"
//             onMouseEnter={() => setActiveSuggestionIndex((s) => ({ ...s, [rowId]: i }))}
//             onMouseDown={(e) => {
//               e.preventDefault();
//               const inputVal = (rows.find((r) => r.id === rowId)?.code || "").trim();
//               const isBarcode = /^\d{6,}$/.test(inputVal);



//               if (isBarcode && item.isRandom) {
//                 const b = item.batch;

//                 // 🔥 Fill row
//                 updateRow(rowId, "code", b.randomCode || item.product.code);
//                 updateRow(rowId, "name", item.product.name);
//                 updateRow(rowId, "batch", b.batchNo || "");
//                 updateRow(rowId, "mrp", b.mrp || 0);
//                 updateRow(rowId, "rate", b.salePrice || b.rate || 0);
//                 updateRow(rowId, "gst", b.taxPercent || 0);

//                 // qty EMPTY for manual mode
//                 updateRow(rowId, "qty", "");

//                 // close batch list
//                 setShowBatchList((s) => ({ ...s, [rowId]: false }));

//                 // 🔥🔥 Focus qty input after fill
//                 setTimeout(() => {
//                   const q = document.querySelector(
//                     `input[data-row="${rowId}"][data-field="qty"]`
//                   );
//                   if (q) q.focus();
//                 }, 20);

//               } else {
//                 // normal suggestion flow
//                 handleSelectSuggestion(
//                   rowId,
//                   item.isRandom ? { ...item.product, batches: [item.batch] } : item.product,
//                   item.isRandom
//                 );

//                 // Show batches to let user pick manually
//                 setShowBatchList((s) => ({ ...s, [rowId]: true }));

//                 // 🔥 If suggestion selection is RANDOM → jump to qty
//                 if (item.isRandom) {
//                   setTimeout(() => {
//                     const q = document.querySelector(
//                       `input[data-row="${rowId}"][data-field="qty"]`
//                     );
//                     if (q) q.focus();
//                   }, 20);
//                 }
//               }


//               setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
//               setShowCodeList((s) => ({ ...s, [rowId]: false }));
//             }}
//             style={{
//               padding: "8px 10px",
//               cursor: "pointer",
//               borderBottom: "1px solid #f4f4f4",
//               background: activeIdx === i ? "#E6FFE6" : item.isRandom ? "#f6fff6" : "#fff",
//             }}
//           >
//             {item.isRandom ? (
//               <div style={{ fontWeight: 700 }}>{item.batch.randomCode}</div>
//             ) : (
//               <>
//                 <div style={{ fontWeight: 700 }}>{item.product.code}</div>
//                 <div style={{ fontSize: 12, color: "#444" }}>{item.product.name}</div>
//               </>
//             )}
//           </div>
//         ))}
//       </div>,
//       portalRoot
//     );
//   };

//   const renderNameSuggestionPortal = (rowId) => {
//     if (!portalRoot) return null;
//     const list = nameSuggestions[rowId] || [];
//     if (!showNameList[rowId] || list.length === 0) return null;

//     const inputEl = document.querySelector(
//       `input[data-row="${rowId}"][data-field="name"]`
//     );
//     const rect =
//       inputEl?.getBoundingClientRect() || { top: 0, left: 0, width: 240, height: 24 };

//     const style = {
//       position: "fixed",
//       top: rect.top + rect.height + 6,
//       left: rect.left,
//       minWidth: Math.max(240, rect.width),
//       zIndex: 9999,
//       background: "#fff",
//       border: "1px solid #ddd",
//       boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
//       maxHeight: 320,
//       overflowY: "auto",
//       padding: "6px 0",
//     };

//     // flattened for name is simply product matches (no randomCode priority for name)
//     const inputValue = (rows.find((r) => r.id === rowId)?.name || "").toLowerCase();
//     const flattened = list.filter((p) => p.name?.toLowerCase().includes(inputValue));

//     const activeIdx = activeSuggestionIndex[rowId] ?? -1;

//     return ReactDOM.createPortal(
//       <div
//         className="suggestions-portal"
//         style={style}
//         role="listbox"
//         onMouseDown={() => {
//           isClickInsideSuggestion.current = true;
//         }}
//       >
//         {flattened.map((p, i) => (
//           <div
//             key={p._id || `${p.code}-${p.name}-${i}`}
//             className="suggestion"
//             role="option"
//             onMouseEnter={() => setActiveSuggestionIndex((s) => ({ ...s, [rowId]: i }))}
//             onMouseDown={(e) => {
//               e.preventDefault();
//               isClickInsideSuggestion.current = true;
//               handleSelectSuggestion(rowId, p);
//               setActiveSuggestionIndex((s) => ({ ...s, [rowId]: -1 }));
//               setShowNameList((s) => ({ ...s, [rowId]: false }));
//             }}
//             style={{
//               padding: "8px 10px",
//               cursor: "pointer",
//               borderBottom: "1px solid #f4f4f4",
//               background: activeIdx === i ? "#E6FFE6" : "white",
//             }}
//           >
//             <div style={{ fontWeight: 700 }}>{p.name}</div>
//             <div style={{ fontSize: 12 }}>{p.code}</div>
//           </div>
//         ))}
//       </div>,
//       portalRoot
//     );
//   };


//   const normalizeKey = (str = "") =>
//     str.toString().trim().toLowerCase().replace(/\s+/g, "");

//   const getStockKey = (code, batch) =>
//     `${normalizeKey(code)}_${normalizeKey(batch)}`;








//   /* -------------------- TRUE AVAILABLE STOCK -------------------- */
//   const getRowsReservedForKey = (code, batch, excludeRowId = null) => {
//     // Sum of quantities in the UI rows (this is ALWAYS the UI's view of reserved qty)
//     // excludeRowId: optional — if provided we exclude that row (useful during editing checks)
//     if (!code || !batch) return 0;

//     const nCode = normalizeKey(code);
//     const nBatch = normalizeKey(batch);

//     let sum = 0;
//     for (const r of rows) {
//       if (
//         excludeRowId && r.id === excludeRowId
//       ) {
//         // skip this row when explicitly asked
//         continue;
//       }
//       if (
//         normalizeKey(r.code) === nCode &&
//         normalizeKey(r.batch) === nBatch &&
//         Number(r.qty) > 0
//       ) {
//         sum += Number(r.qty || 0);
//       }
//     }
//     return sum;
//   };




//   /* -------------------- TRUE AVAILABLE STOCK (SCAN-AWARE) -------------------- */
//   const getAvailableStock = (code, batch) => {
//     if (!code || !batch) return 0;

//     const nC = normalizeKey(code);
//     const nB = normalizeKey(batch);

//     const product = products.find((p) => normalizeKey(p.code) === nC);
//     if (!product) return 0;

//     const batchObj = (product.batches || []).find(
//       (b) => normalizeKey(b.batchNo) === nB
//     );
//     if (!batchObj) return 0;

//     const baseStock = Number(batchObj.qty || 0);

//     // UI rows always reflect TRUE reservations
//     const rowsReserved = getRowsReservedForKey(code, batch);

//     // DO NOT subtract reservedStock again → this caused double subtraction
//     return Math.max(0, baseStock - rowsReserved);
//   };




//   /* -------------------- RENDER BATCH PORTAL (patched) -------------------- */
//   const renderBatchPortal = (rowId) => {
//     if (!portalRoot) return null;

//     const list = batchesByRow[rowId] || [];
//     if (!showBatchList[rowId] || list.length === 0) return null;

//     const inputEl = document.querySelector(
//       `input[data-row="${rowId}"][data-field="batch"]`
//     );
//     const rect =
//       inputEl?.getBoundingClientRect() || { top: 0, left: 0, width: 300, height: 24 };

//     const style = {
//       position: "fixed",
//       top: rect.top + rect.height + 6,
//       left: rect.left,
//       minWidth: Math.max(480, rect.width),
//       zIndex: 9999,
//       background: "#fff",
//       border: "1px solid #eee",
//       boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
//       maxHeight: 320,
//       overflowY: "auto",
//       padding: 8,
//     };

//     const activeIdx = activeSuggestionIndex[`batch-${rowId}`] ?? -1;
//     const codeForRow = rows.find((r) => r.id === rowId)?.code || "";

//     return ReactDOM.createPortal(
//       <div
//         key={`${rowId}-${batchRenderKey}`}
//         className="batch-portal"
//         style={style}
//         onMouseDown={() => (isClickInsideBatchPortal.current = true)}
//       >
//         <table style={{ width: "100%", borderCollapse: "collapse" }}>
//           <thead>
//             <tr style={{ background: "#fafafa", fontSize: 13 }}>
//               <th style={{ padding: 6 }}>Batch</th>
//               <th style={{ padding: 6 }}>MRP</th>
//               <th style={{ padding: 6 }}>Rate</th>
//               <th style={{ padding: 6 }}>GST%</th>
//               <th style={{ padding: 6, textAlign: "right" }}>Stock</th>
//             </tr>
//           </thead>

//           <tbody>
//             {list.map((b, i) => {
//               const nb = normalizeBatch(b);
//               const baseQty = Number(nb.qty || 0);

//               // 🔥 TRUE rowsReserved: all UI rows for same code+batch
//               const rowsReserved = getRowsReservedForKey(codeForRow, nb.batchNo);

//               // 🔥 FINAL available stock (NO externalReserved!)
//               const available = Math.max(0, baseQty - rowsReserved);

//               const outOfStock = available <= 0;

//               return (
//                 <tr
//                   key={`${nb.batchNo}-${i}`}
//                   onMouseDown={(e) => {
//                     e.preventDefault();
//                     isClickInsideBatchPortal.current = true;

//                     if (outOfStock) {
//                       showPopup(`Batch ${nb.batchNo} is OUT OF STOCK.`, "error");
//                       return;
//                     }

//                     handleBatchPick(rowId, nb);
//                   }}
//                   onMouseEnter={() =>
//                     setActiveSuggestionIndex((s) => ({
//                       ...s,
//                       [`batch-${rowId}`]: i,
//                     }))
//                   }
//                   style={{
//                     cursor: outOfStock ? "not-allowed" : "pointer",
//                     borderBottom: "1px solid #f4f4f4",
//                     background:
//                       activeIdx === i
//                         ? "#E6FFE6"
//                         : outOfStock
//                           ? "rgba(255,0,0,0.05)"
//                           : "transparent",
//                     opacity: outOfStock ? 0.6 : 1,
//                   }}
//                 >
//                   <td style={{ padding: 6, fontWeight: 600 }}>{nb.batchNo}</td>
//                   <td style={{ padding: 6 }}>{Number(nb.mrp || 0).toFixed(2)}</td>
//                   <td style={{ padding: 6 }}>{Number(nb.rate || 0).toFixed(2)}</td>
//                   <td style={{ padding: 6 }}>{nb.gst}%</td>
//                   <td
//                     style={{
//                       padding: 6,
//                       color: outOfStock ? "red" : "inherit",
//                       fontWeight: outOfStock ? 700 : 400,
//                       textAlign: "right",
//                     }}
//                   >
//                     {available}
//                   </td>
//                 </tr>
//               );
//             })}

//           </tbody>
//         </table>
//       </div>,
//       portalRoot
//     );
//   };






//   // helper: resolve by code, name, randomCode (normalized)
//   const findProductByKey = (key) => {
//     if (!key) return null;

//     const k = normalizeKey(key);

//     // 1) randomCode FIRST (highest priority)
//     for (const p of products) {
//       const batch = (p.batches || []).find(
//         b => normalizeKey(b.randomCode) === k
//       );
//       if (batch) return { product: p, matchedBatch: batch };
//     }

//     // 2) match product code
//     const byCode = products.find(
//       p => normalizeKey(p.code) === k
//     );
//     if (byCode) return { product: byCode, matchedBatch: null };

//     // 3) match product name
//     const byName = products.find(
//       p => normalizeKey(p.name) === k
//     );
//     if (byName) return { product: byName, matchedBatch: null };

//     return null;
//   };





//   function finalizeRow(rowId) {
//     const row = rows.find((r) => r.id === rowId);
//     if (!row) return;

//     const isScan = row._scanMode === true;

//     const filledRow = {
//       ...row,
//       isNew: false,
//       _scanMode: false,
//     };

//     setRows((prev) => {
//       const updated = prev.map((r) =>
//         r.id === rowId ? recalcRow(filledRow) : r
//       );

//       const last = updated[updated.length - 1];
//       if (last && (last.code || last.name || last.batch)) {
//         updated.push(createEmptyRow());
//       }

//       return updated;
//     });

//     const k = getStockKey(filledRow.code, filledRow.batch);
//     setReservedStock((rs) => ({ ...rs, [k]: Number(rs[k] || 0) }));
//   }





//   // finalizeRowWithData(rowId, rowData)


//   function finalizeRowWithData(rowId, filledRow) {
//     const k = getStockKey(filledRow.code, filledRow.batch);

//     setRows((prev) => {
//       const updated = prev.map((r) =>
//         r.id === rowId
//           ? recalcRow({
//             ...filledRow,
//             isNew: false,
//             _scanMode: false,
//           })
//           : r
//       );

//       console.log(
//         "%cFINALIZE → BEFORE recalcRow",
//         "color: purple",
//         filledRow
//       );


//       const last = updated[updated.length - 1];
//       if (last && (last.code || last.name || last.batch)) {
//         updated.push(createEmptyRow());
//       }

//       return updated;
//     });

//     setReservedStock((rs) => ({ ...rs, [k]: Number(rs[k] || 0) }));
//   }



//   // -------------------- TRUE AVAILABLE STOCK FOR MANUAL ENTRY --------------------
//   // Manual mode should NOT subtract `reservedStock` (scanner reservations).
//   // It should only consider already-finalized rows (non-new) so typing qty is
//   // validated against actual stock minus already-finalized quantities.
//   const getAvailableStockManual = (code, batch, excludeRowId = null) => {
//     if (!code || !batch) return 0;

//     const nC = normalizeKey(code);
//     const nB = normalizeKey(batch);

//     const product = products.find((p) => normalizeKey(p.code) === nC);
//     if (!product) return 0;

//     const batchObj = (product.batches || []).find(
//       (b) => normalizeKey(b.batchNo) === nB
//     );
//     if (!batchObj) return 0;

//     const baseStock = Number(batchObj.qty || 0);

//     // Sum qty only for finalized rows (isNew === false). Optionally exclude row being edited.
//     const finalizedReserved = (rows || [])
//       .filter((r) => !r.isNew && r.id !== excludeRowId)
//       .reduce((acc, r) => {
//         if (
//           normalizeKey(r.code) === nC &&
//           normalizeKey(r.batch) === nB &&
//           Number(r.qty)
//         ) {
//           return acc + Number(r.qty || 0);
//         }
//         return acc;
//       }, 0);

//     return Math.max(0, baseStock - finalizedReserved);
//   };




//   const addRow = (id) => {
//     setRows((prev) => {
//       const row = prev.find((r) => r.id === id);
//       if (!row) return prev;

//       const isScan = row._scanMode === true;

//       // ------------------------------
//       // MANUAL VALIDATION
//       // ------------------------------
//       if (!isScan) {
//         if (!row.code || !row.name || !row.batch) {
//           showPopup("Fill required fields", "error");
//           return prev;
//         }
//         if (!(Number(row.qty) > 0)) {
//           showPopup("Fill required fields", "error");
//           return prev;
//         }
//         if (!(Number(row.rate) > 0)) {
//           showPopup("Fill required fields", "error");
//           return prev;
//         }
//       }

//       const qtyValue = Number(row.qty || 0);

//       const product = products.find(
//         (p) => normalizeKey(p.code) === normalizeKey(row.code)
//       );
//       const batchObj = product?.batches?.find(
//         (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
//       );

//       const baseStock = Number(batchObj?.qty || 0);
//       const k = getStockKey(row.code, row.batch);

//       // SCAN uses live stock
//       // MANUAL uses reserved-row-based stock
//       const available = isScan
//         ? getAvailableStock(row.code, row.batch)
//         : getAvailableStockManual(row.code, row.batch);

//       if (qtyValue > available) {
//         showPopup(`Only ${available} available`, "error");
//         return prev;
//       }

//       let updated = [...prev];

//       // -------------------------------------
//       // Merge duplicate rows
//       // -------------------------------------
//       const existingIndex = updated.findIndex(
//         (r) =>
//           !r.isNew &&
//           normalizeKey(r.code) === normalizeKey(row.code) &&
//           normalizeKey(r.batch) === normalizeKey(row.batch)
//       );

//       if (existingIndex !== -1) {
//         const exRow = updated[existingIndex];
//         const mergedQty = Number(exRow.qty || 0) + qtyValue;

//         if (mergedQty > baseStock) {
//           showPopup(`Only ${baseStock} available`, "error");
//           return prev;
//         }

//         updated = updated
//           .map((r, i) =>
//             i === existingIndex ? recalcRow({ ...r, qty: mergedQty }) : r
//           )
//           .filter((r) => r.id !== id);

//         const last = updated[updated.length - 1];
//         if (last.code || last.name || last.batch) {
//           updated.push(createEmptyRow());
//         }

//         setReservedStock((rs) => ({
//           ...rs,
//           [k]: Number(rs[k] || 0) + qtyValue,
//         }));

//         return updated;
//       }

//       // -------------------------------------
//       // Mark as filled row
//       // -------------------------------------
//       updated = updated.map((r) =>
//         r.id === id ? { ...r, isNew: false, _scanMode: false } : r
//       );

//       const lastRow = updated[updated.length - 1];
//       if (lastRow.code || lastRow.name || lastRow.batch) {
//         updated.push(createEmptyRow());
//       }

//       setReservedStock((rs) => ({ ...rs, [k]: Number(rs[k] || 0) }));

//       return updated;
//     });
//   };

//   const deleteRow = (id) => {
//     const row = rows.find((r) => r.id === id);
//     if (row && !row.isNew) {
//       const k = getStockKey(row.code, row.batch);
//       setReservedStock((rs) => ({ ...rs, [k]: Math.max(0, Number(rs[k] || 0) - Number(row.qty || 0)) }));
//     }
//     setRows((prev) => prev.filter((r) => r.id !== id));
//   };



//   // -------------------- CANCEL EDIT (rollback) --------------------

//   const cancelRowEdit = () => {
//     if (!editRowId) return;
//     setRows((prev) => prev.map((r) => (r.id === editRowId ? { ...originalRowData[editRowId] } : r)));
//     setOriginalRowData((prev) => {
//       const copy = { ...prev };
//       delete copy[editRowId];
//       return copy;
//     });
//     setEditRowId(null);
//   };




//   /* -------------------- SAVE EDIT -------------------- */
//   const saveRowEdit = async (rowId) => {
//     const row = rows.find((r) => r.id === rowId);
//     if (!row) return;

//     if (!row.code || !row.name || !row.batch) {
//       showPopup("Please fill all required fields.", "error");
//       return;
//     }

//     const oldQty = Number(originalBillItems?.[rowId]?.qty ?? originalRowData?.[rowId]?.qty ?? 0);
//     const newQty = Number(row.qty || 0);
//     const diff = newQty - oldQty;

//     const k = getStockKey(row.code, row.batch);

//     const product = products.find((p) => normalizeKey(p.code) === normalizeKey(row.code));
//     const batchObj = product?.batches?.find((b) => normalizeKey(b.batchNo) === normalizeKey(row.batch));
//     const baseStock = Number(batchObj?.qty || 0);

//     // rowsReserved includes current row. For availability check we need to
//     // consider reserved by other UI rows (exclude current row).
//     const rowsReservedExcludingThis = getRowsReservedForKey(row.code, row.batch, rowId);
//     const rawReserved = Number(reservedStock[k] || 0);
//     const externalReserved = Math.max(0, rawReserved - rowsReservedExcludingThis);

//     // available outside this row (what others + external have left)
//     const availableOutside = Math.max(0, baseStock - (rowsReservedExcludingThis + externalReserved));

//     if (diff > 0 && diff > availableOutside) {
//       showPopup(`Only ${baseStock} available`, "error");
//       setStockErrors((prev) => ({ ...prev, [rowId]: `Only ${baseStock} available` }));
//       return;
//     }

//     // Apply update to UI
//     setRows((prev) =>
//       prev.map((r) => (r.id === rowId ? { ...r, qty: newQty, isNew: false, edited: true } : r))
//     );

//     // Update originalBillItems baseline
//     setOriginalBillItems((prev) => ({ ...prev, [rowId]: { code: row.code, batch: row.batch, qty: newQty } }));

//     // reservedStock is external; we must not re-write it to rows sum.
//     // However if reservedStock previously included this row (due to older buggy behavior)
//     // we adjust it to ensure it still represents only external reservations:
//     setReservedStock((rs) => {
//       const prevRaw = Number(rs[k] || 0);
//       // compute current UI rows reserved (including this row after update)
//       const rowsReservedNow = getRowsReservedForKey(row.code, row.batch);
//       // if reservedStock contained UI sum (prevRaw === rowsReservedNow - newQty etc) we leave it as-is,
//       // otherwise just ensure the key exists (defensive).
//       return { ...rs, [k]: prevRaw };
//     });

//     showPopup("Row updated.", "success");
//     setEditRowId(null);
//   };


//   // -------------------- AUTO RERENDER BATCH LIST --------------------
//   useEffect(() => {
//     setBatchRenderKey((k) => k + 1);
//   }, [products, reservedStock]);

//   function handleEnterKey(e) {
//     if (e.key === "Enter") {
//       e.preventDefault();
//       const form = e.target.form;
//       if (!form) return;
//       const elements = Array.from(form.elements).filter(
//         (el) => el.tagName === "INPUT" && el.type !== "hidden"
//       );
//       const index = elements.indexOf(e.target);
//       if (elements[index + 1]) {
//         elements[index + 1].focus();
//       }
//     }
//   }








//   async function processBarcodeScan(code, input) {
//     if (scanLockRef.current) return;
//     scanLockRef.current = true;

//     try {
//       const results = await fetchByScanRandomCode(code);
//       const product = results?.[0];
//       if (!product) {
//         showPopup("Invalid barcode", "error");
//         return;
//       }

//       const batch = findBatchByRandomCode(product, code);
//       if (!batch) {
//         showPopup("Batch not found", "error");
//         return;
//       }

//       const activeRowId = input.dataset.row;

//       setRows((prev) => {
//         const existingRow = prev.find(
//           (r) =>
//             !r.isNew &&
//             normalizeKey(r.code) === normalizeKey(product.code) &&
//             normalizeKey(r.batch) === normalizeKey(batch.batchNo)
//         );

//         // 🔁 DUPLICATE SCAN → INCREMENT QTY
//         if (existingRow) {
//           return prev.map((r) => {
//             if (r.id === existingRow.id) {
//               const nextQty = Number(r.qty || 0) + 1;
//               return recalcRow({
//                 ...r,
//                 qty: nextQty,
//                 openingStock: Number(batch.qty || 0),
//                 closingStock: Math.max(
//                   0,
//                   Number(batch.qty || 0) - nextQty
//                 ),
//               });
//             }

//             // clear active scan row only
//             if (r.id === activeRowId) {
//               return {
//                 ...r,
//                 code: "",
//                 name: "",
//                 batch: "",
//                 mrp: 0,
//                 rate: 0,
//                 gst: 0,
//                 qty: 0,
//                 isNew: true,
//               };
//             }

//             return r;
//           });
//         }

//         // 🆕 NEW SCAN → FILL ACTIVE ROW
//         return prev.map((r) =>
//           r.id === activeRowId
//             ? recalcRow({
//               code: product.code,
//               name: product.name,
//               batch: batch.batchNo,
//               mrp: Number(batch.mrp),
//               rate: Number(batch.salePrice),
//               qty: 1,
//               gst: Number(product.taxPercent || 0),
//               taxMode: product.taxMode,
//               isInclusive: product.taxMode === "inclusive",
//               openingStock: Number(batch.qty || 0),
//               closingStock: Number(batch.qty || 0) - 1,
//               isNew: false,
//             })
//             : r
//         );
//       });
//     } finally {
//       scanBufferRef.current = "";
//       scanLockRef.current = false;

//       requestAnimationFrame(() => {
//         document
//           .querySelector('input[data-field="code"][data-row]:last-of-type')
//           ?.focus();
//       });
//     }
//   }



//   const focusNextEmptyRow = () => {
//     setTimeout(() => {
//       const next = rows.find(r => r.isNew && (!r.code && !r.name));
//       if (next) {
//         const input = document.querySelector(
//           `input[data-row="${next.id}"][data-field="code"]`
//         );
//         if (input) input.focus();
//       }
//     }, 80);
//   };


//   useEffect(() => {
//     const savedCounter = localStorage.getItem("counter");

//     setMeta((prev) => ({
//       ...prev,
//       counter: Number(savedCounter) || 1,  // default counter 1
//     }));
//   }, []);






//   return (
//     <div className="salesbill-container p-8 pt-10 sm:pt-10">
//       {/* ✅ Popup Message */}
//       {popup.message && (
//         <div className={`popup-message ${popup.type}`}>{popup.message}</div>
//       )}

//       {/* Header */}
//       <div className="salesbill-header">
//         <div>
//           <h1 className="salesbill-title" style={{ color: "#008f5e" }}>Sales Bill</h1>
//         </div>
//         <button className="  
      
//        inline-flex items-center gap-2
//        px-[14px] py-[10px]
      
       
//       rounded-lg 
//     font-semibold
//     text-[#007867]
//     bg-[#c8fad6]
//     shadow-[0_8px_24px_rgba(0,0,0,0.08)]
    
//     transition-all duration-150
//     hover:-translate-y-[1px]
//     active:translate-y-0 " onClick={openAddModal}>
//           <FaPlus /> Add Sale Bill
//         </button>

//       </div>

//       {/* Toolbar */}

//       <div className="flex flex-wrap items-center p-4 space-x-3 space-y-3 lg:space-y-0 lg:space-x-3">
//         {/* Left: Search Box */}
//         <div className="flex min-w-[200px]">
//           <input
//             type="text"
//             placeholder="Search: Bill No / Customer / Mobile "
//             value={search}
//             onChange={(e) => setSearch(e.target.value)}
//             className="!w-[350px] !md:w-[350px]  h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition placeholder-gray-400"
//           />
//         </div>



//         <div className="flex min-w-[200px]">
//           <input
//             type="number"
//             placeholder="Counter No"
//             value={counterFilter}
//             onChange={(e) => setCounterFilter(e.target.value)}
//             className="!w-[200px] !md:w-[350px]  h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition placeholder-gray-400"
//           />

//         </div>

//         {/* Middle: Filter */}

//         <div className="flex items-center gap-2 min-w-[100px]">

//           <select
//             value={filter}
//             onChange={(e) => setFilter(e.target.value)}
//             className="w-[100px] h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
//           >
//             <option value="">All Date</option>
//             <option value="today">Today</option>
//             <option value="this-week">This Week</option>
//             <option value="this-month">This Month</option>
//             <option value="custom">Custom Date</option>
//           </select>



//           {filter === "custom" && (
//             <div className="flex gap-1 animate-fadeIn">
//               <input
//                 type="date"
//                 value={fromDate}
//                 onChange={(e) => setFromDate(e.target.value)}
//                 className="w-[100px] h-8 text-sm border rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
//               />
//               <span className="self-center text-sm">to</span>
//               <input
//                 type="date"
//                 value={toDate}
//                 onChange={(e) => setToDate(e.target.value)}
//                 className="w-[100px] h-8 text-sm border rounded px-1 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition"
//               />
//             </div>
//           )}
//         </div>

//         <div className="flex items-center gap-2 min-w-[100px]">
//           <select
//             value={statusFilter}
//             onChange={(e) => setStatusFilter(e.target.value)}
//             className="w-[120px] h-8 border rounded px-2 text-sm"
//           >
//             <option value="all">All Status</option>
//             <option value="active">Active</option>
//             <option value="cancelled">Cancelled</option>

//           </select>
//         </div>

//       </div>




//       {/* Table List */}
//       <div className="salesbill-table-wrapper overflow-x-auto bg-white rounded-lg shadow p-4">
//         {loading ? (
//           <p className="text-gray-400 text-center py-4">Loading…</p>
//         ) : bills.length === 0 ? (
//           <p className="text-gray-400 text-center py-4">No records found</p>
//         ) : (
//           <>
//             <table className="table-auto w-full min-w-[900px] border-collapse">
//               <thead className="bg-gray-100">
//                 <tr>
//                   <th className="px-4 py-2 text-left">S.No</th>
//                   <th className="px-4 py-2 text-left">Counter</th>
//                   <th className="px-4 py-2 text-left">Bill No</th>
//                   <th className="px-4 py-2 text-left">Date</th>
//                   <th className="px-4 py-2 text-left">Customer</th>
//                   <th className="px-4 py-2 text-left">Mobile</th>
//                   <th className="px-4 py-2 text-left">Status</th>
//                   <th className="px-4 py-2 text-right">Net Amount</th>
//                   <th className="px-4 py-2 text-center">Action</th>
//                 </tr>
//               </thead>
//               <tbody>
//                 {bills.map((bill, i) => (
//                   <tr key={bill._id} className="hover:bg-green-80 transition-colors">
//                     <td className="px-4 py-2">{(Number(page) - 1) * Number(limit) + i + 1}</td>

//                     {/* ⭐ NEW: Counter */}
//                     <td className="px-4 py-2">Counter -  {bill.counter || "-"}</td>

//                     <td className="px-4 py-2">{bill.billNo}</td>
//                     <td className="px-4 py-2">{formatDate(bill.date)}</td>
//                     <td className="px-4 py-2">{bill.customerName}</td>

//                     {/* ⭐ NEW: Mobile */}
//                     <td className="px-4 py-2">{bill.mobile || "-"}</td>



//                     <td className="px-4 py-2">
//                       {bill.status?.toLowerCase() === "active" ? (
//                         (() => {
//                           const cancelledCount = bill.items.filter(i => i.status === "cancelled").length;

//                           return (
//                             <div className="flex flex-col">
//                               {/* Main status */}
//                               <span className="flex items-center gap-1 text-green-600 font-semibold">
//                                 <FaCheckCircle />
//                                 Active
//                               </span>

//                               {/* Show cancelled count if > 0 */}
//                               {cancelledCount > 0 && (
//                                 <span className="text-red-500 text-xs ml-6">
//                                   ({cancelledCount} product{cancelledCount > 1 ? "s" : ""} cancelled)
//                                 </span>
//                               )}
//                             </div>
//                           );
//                         })()
//                       ) : (
//                         <span className="flex items-center gap-1 text-red-600 font-semibold">
//                           <FaTimesCircle />
//                           Cancelled
//                         </span>
//                       )}
//                     </td>



//                     <td className="px-4 py-2 text-right">
//                       ₹{Number(bill.netAmount || 0).toFixed(2)}
//                     </td>

//                     <td className="px-4 py-2 text-center">
//                       <div className="flex justify-center gap-2">
//                         {/* <button
//                     onClick={() => setViewBill(bill)}
//                     title="View"
//                     style={{
//                       border: "none",
//                       backgroundColor: "#00A76F",
//                       color: "#fff",
//                       padding: "0.5rem 0.75rem",
//                       borderRadius: "0.5rem",
//                       cursor: "pointer",
//                       transition: "all 0.3s ease",
//                     }}
//                     onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#007867")}
//                     onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00A76F")}
//                   >
//                     <FaEye />
//                   </button> */}

//                         <button
//                           // onClick={() => setViewBill(bill)}
//                           onClick={() => {
//                             setViewBill(bill);
//                             setShowViewModal(true);   // <-- this opens the modal
//                           }}
//                           title="View"
//                           style={{
//                             border: "none",
//                             backgroundColor: "#00A76F",
//                             color: "#fff",
//                             padding: "0.5rem 0.75rem",
//                             borderRadius: "0.5rem",
//                             cursor: "pointer",
//                             transition: "all 0.3s ease",
//                           }}
//                           onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#007867")}
//                           onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00A76F")}
//                         >
//                           <FaEye />
//                         </button>

//                       </div>
//                     </td>
//                   </tr>
//                 ))}
//               </tbody>
//             </table>

//             {/* Pagination */}
//             <div className="mt-3">
//               {/* <Pagination page={page} totalPages={totalPages} onPageChange={fetchBills} /> */}
//               <Pagination
//                 page={page}
//                 totalPages={totalPages}
//                 onPageChange={(p) => {
//                   if (p === page) return; // prevent duplicate click
//                   setPage(p);
//                 }}
//               />
//             </div>
//           </>
//         )}
//       </div>


//       {/* Add Modal */}
//       {showModal && (
//         <div className="modal fade-in">
//           <div className="modal-content slide-up large relative">
//             {saving && (
//               <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
//                 <div className="flex flex-col items-center gap-3 text-center">
//                   <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>

//                   <span className="text-green-700 font-semibold text-base">
//                     Printing Bill...
//                   </span>
//                 </div>
//               </div>
//             )}




//             <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>

//               <div className="modal-header">
//                 <h2>{billEditMode ? "Edit Bill" : "Add Sales"}</h2>
//                 <button className="icon-close" onClick={() => {
//                   resetBillState();    // 🔥 FULL PAGE RESET
//                   setShowModal(false);
//                 }}
//                 >
//                   ×
//                 </button>
//               </div>

//               {/* Meta */}
//               <form className="bill-meta">
//                 <div className="meta-grid">


//                   <label className="">
//                     Counter:
//                     <input
//                       type="text"
//                       value={meta.counter || ""}
//                       readOnly
//                       style={{ background: "#f8f8f8", width: "150px" }}
//                       className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
//                     />
//                   </label>

//                   <label className="">
//                     Bill No:
//                     <input
//                       type="text"
//                       value={meta.billNo || ""}
//                       readOnly
//                       style={{ background: "#f8f8f8", width: "150px" }}
//                       className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400"
//                     />
//                   </label>



//                   <label>
//                     Date <input type="date" value={meta.date} readOnly className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] focus:border-[#007867] transition duration-200 placeholder-gray-400" />
//                   </label>



//                   <label style={{ flex: "2", position: "relative" }}>
//                     Customer Name
//                     <input
//                       value={meta.customerName}
//                       maxLength={50}
//                       placeholder="Enter Customer Name"
//                       className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1
//                focus:outline-none focus:ring-2 focus:ring-[#007867]"
//                       onChange={(e) => {
//                         const name = e.target.value;

//                         // Update UI immediately
//                         setMeta((prev) => ({
//                           ...prev,
//                           customerName: name,
//                         }));

//                         // If user ERASED name → also erase mobile
//                         if (!name.trim()) {
//                           setMeta((prev) => ({
//                             ...prev,
//                             customerName: "",
//                             mobile: "", // RESET MOBILE
//                           }));
//                           setShowCustomerList(false);
//                           return;
//                         }

//                         // ⏳ Debounce fetching
//                         if (customerTypingRef.current) {
//                           clearTimeout(customerTypingRef.current);
//                         }

//                         customerTypingRef.current = setTimeout(async () => {
//                           const list = await fetchCustomerByName(name);
//                           setCustomerSuggestions(list);
//                           setShowCustomerList(true);
//                         }, 300); // debounce 300ms
//                       }}
//                       onBlur={() => {
//                         setTimeout(() => {
//                           if (!isClickInsideCustomerDropdown.current) {
//                             setShowCustomerList(false);
//                           }
//                           isClickInsideCustomerDropdown.current = false;
//                         }, 150);
//                       }}
//                     />

//                     {/* Suggestion dropdown */}
//                     {showCustomerList && customerSuggestions.length > 0 && (
//                       <div
//                         style={{
//                           position: "absolute",
//                           top: "60px",
//                           left: 0,
//                           width: "100%",
//                           background: "white",
//                           border: "1px solid #ccc",
//                           zIndex: 1000,
//                           borderRadius: "6px",
//                           maxHeight: "200px",
//                           overflowY: "auto",
//                         }}
//                         onMouseDown={() => {
//                           isClickInsideCustomerDropdown.current = true;
//                         }}
//                       >
//                         {customerSuggestions.map((cust) => (
//                           <div
//                             key={cust._id}
//                             style={{
//                               padding: "8px 10px",
//                               cursor: "pointer",
//                               display: "flex",
//                               justifyContent: "space-between",
//                               alignItems: "center",
//                             }}
//                             onClick={() => {
//                               // Auto fill on select
//                               setMeta((prev) => ({
//                                 ...prev,
//                                 customerName: cust.name,
//                                 mobile: cust.mobile,
//                               }));

//                               setShowCustomerList(false);
//                             }}
//                           >
//                             <span>{cust.name}</span>
//                             <span style={{ color: "#888", fontSize: "12px" }}>
//                               {cust.mobile}
//                             </span>
//                           </div>
//                         ))}
//                       </div>
//                     )}
//                   </label>




//                   <label>
//                     Mobile
//                     <input
//                       type="text"
//                       value={meta.mobile}
//                       maxLength={10}


//                       onChange={async (e) => {
//                         const v = e.target.value.replace(/\D/g, ""); // only digits

//                         // Always update mobile while typing
//                         setMeta((prev) => ({ ...prev, mobile: v }));

//                         // Case: less than 10 digits → do nothing
//                         if (v.length < 10) {
//                           return;
//                         }

//                         // Case: exactly 10 digits
//                         if (v.length === 10) {
//                           const customer = await fetchCustomerByMobile(v);

//                           if (customer) {
//                             // ✔ Existing customer → reset name + auto-fill
//                             setMeta((prev) => ({
//                               ...prev,
//                               customerName: customer.name,
//                               mobile: customer.mobile,
//                             }));
//                           } else {
//                             // ✔ New number → keep user-typed name, do NOT reset
//                             setMeta((prev) => ({
//                               ...prev,
//                               mobile: v,
//                             }));
//                           }
//                         }
//                       }}


//                       placeholder="Enter Mobile Number"
//                       className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1 
//                focus:outline-none focus:ring-2 focus:ring-[#007867]"
//                     />
//                   </label>


//                 </div>
//               </form>



//               {/* ------------------ Items Table ------------------ */}
//               <table
//                 className="salesbill-table clean full-width"
//                 style={{ tableLayout: "fixed" }}
//               >
//                 <thead>
//                   <tr>
//                     <th style={{ width: "50px" }}>S.No</th>
//                     <th style={{ width: "130px" }}>Product Code</th>
//                     <th style={{ width: "170px" }}>Product Name</th>
//                     <th style={{ width: "170px" }}>Batch</th>
//                     <th style={{ width: "100px" }}>MRP</th>
//                     <th style={{ width: "90px" }}>Rate</th>
//                     <th style={{ width: "60px" }}>GST%</th>
//                     <th style={{ width: "80px" }}>Qty</th>
//                     <th style={{ width: "100px" }}>GST Value</th>
//                     <th style={{ width: "120px" }}>Amount</th>
//                     <th style={{ width: "90px" }}>Action</th>
//                   </tr>
//                 </thead>

//                 <tbody>
//                   {rows.map((row, index) => {
//                     const rate = Number(row.rate || 0);
//                     const qty = Number(row.qty || 0);
//                     const gst = Number(row.gst || 0);

//                     return (
//                       <React.Fragment key={row.id}>
//                         <tr>
//                           <td>{index + 1}</td>

//                           {/* ============================================ */}
//                           {/*  PRODUCT CODE 
//                         {/* ============================================ */}

//                           <td className="relative">
//                             <input
//                               data-row={row.id}
//                               data-field="code"
//                               value={row.code || ""}
//                               placeholder="Type or scan code"
//                               // disabled={!row.isNew && editRowId !== row.id}
//                               onKeyDown={(e) => {
//                                 handleSuggestionKey(e, row.id, "code");
//                                 handleEnterKey(e);
//                               }}

//                               onChange={async (e) => {
//                                 const input = e.target;
//                                 let v = input.value.toString().trim();
//                                 // // ✅ Limit to 50 characters (paste safe)
//                                 // let v = input.value.slice(0, 50);
//                                 // input.value = v;



//                                 updateRow(row.id, "code", v);

//                                 if (!v) {
//                                   updateRow(row.id, "name", "");
//                                   updateRow(row.id, "batch", "");
//                                   updateRow(row.id, "mrp", 0);
//                                   updateRow(row.id, "rate", 0);
//                                   updateRow(row.id, "gst", 0);
//                                   updateRow(row.id, "qty", 0);

//                                   row._scanMode = false;
//                                   setShowCodeList((s) => ({ ...s, [row.id]: false }));
//                                   lastRawBarcodeRef.current = null;
//                                   //  scanBufferRef.current = ""; 
//                                   return;
//                                 }



//                                 const now = Date.now();
//                                 const last = input._lastKeyTime || now;
//                                 const dt = now - last;
//                                 input._lastKeyTime = now;

//                                 // const isNumeric = /^\d+$/.test(v);
//                                 // // const isScan = isNumeric && v.length >= 10 && dt < 60;
//                                 // const isScan = isNumeric && v.length === 13;

//                                 if (input._scanTimer) clearTimeout(input._scanTimer);
//                                 if (input._manualTimer) clearTimeout(input._manualTimer);



//                                 // =====================================================
//                                 //  SCAN MODE
//                                 // =====================================================
//                                 const isNumeric = /^\d+$/.test(v);
//                                 const isScan = isNumeric && v.length === 13;


//                                 if (row._scanMode && !isScan) return;

//                                 if (isScan) {
//                                   // allow burst scans, but prevent overlap
//                                   if (scanLockRef.current) return;

//                                   scanLockRef.current = true;
//                                   row._scanMode = true;

//                                   (async () => {
//                                     try {
//                                       const results = await fetchByScanRandomCode(v);
//                                       const product = results?.[0];
//                                       if (!product) {
//                                         showPopup("Invalid barcode", "error");
//                                         return;
//                                       }

//                                       const batch = findBatchByRandomCode(product, v);
//                                       if (!batch) {
//                                         showPopup("Batch not found", "error");
//                                         return;
//                                       }

//                                       const existingIndex = rows.findIndex(
//                                         (r) =>
//                                           !r.isNew &&
//                                           normalizeKey(r.code) === normalizeKey(product.code) &&
//                                           normalizeKey(r.batch) === normalizeKey(batch.batchNo)
//                                       );

//                                       // 🔁 SAME PRODUCT → QTY++
//                                       if (existingIndex !== -1) {
//                                         setRows((prev) =>
//                                           prev.map((r, i) => {
//                                             if (i === existingIndex) {
//                                               const currentQty = Number(r.qty || 0);
//                                               const opening = Number(r.openingStock ?? batch.qty ?? 0);
//                                               const nextQty = currentQty + 1;

//                                               // 🚫 STOCK GUARD (IMPORTANT)
//                                               if (nextQty > opening) {
//                                                 showPopup(`Stock only ${opening}`, "error");
//                                                 return r;
//                                               }

//                                               return recalcRow({
//                                                 ...r,
//                                                 qty: nextQty,

//                                                 // ✅ DO NOT RESET openingStock
//                                                 openingStock: opening,
//                                                 closingStock: Math.max(0, opening - nextQty),
//                                               });
//                                             }

//                                             // reset scanning row
//                                             if (r.id === row.id) {
//                                               return {
//                                                 ...r,
//                                                 code: "",
//                                                 name: "",
//                                                 batch: "",
//                                                 mrp: 0,
//                                                 rate: 0,
//                                                 gst: 0,
//                                                 qty: 0,
//                                                 _scanMode: false,
//                                               };
//                                             }

//                                             return r;
//                                           })
//                                         );

//                                         return;
//                                       }


//                                       // 🆕 NEW PRODUCT → ADD ROW
//                                       finalizeRowWithData(row.id, {
//                                         ...row,
//                                         code: product.code,
//                                         name: product.name,
//                                         batch: batch.batchNo,
//                                         mrp: Number(batch.mrp),
//                                         rate: Number(batch.salePrice),
//                                         qty: 1,
//                                         gst: Number(product.taxPercent || 0),
//                                         taxMode: (product.taxMode || "exclusive").toLowerCase(),
//                                         isInclusive:
//                                           (product.taxMode || "exclusive").toLowerCase() === "inclusive",
//                                         openingStock: Number(batch.qty || 0),
//                                         closingStock: Math.max(0, Number(batch.qty || 0) - 1),
//                                         isNew: false,
//                                         _scanMode: false,
//                                       });
//                                     } catch (err) {
//                                       console.error("SCAN ERROR", err);
//                                     } finally {
//                                       scanLockRef.current = false;
//                                       row._scanMode = false;
//                                       input.value = "";

//                                       // 🔥 focus stays correct
//                                       requestAnimationFrame(() => {
//                                         const inputs = document.querySelectorAll(
//                                           'input[data-field="code"][data-row]'
//                                         );
//                                         inputs?.[inputs.length - 1]?.focus();
//                                       });
//                                     }
//                                   })();

//                                   return; // ⛔ stop manual logic
//                                 }

//                                 // =====================================================
//                                 // ✏️ FIXED MANUAL RANDOM-CODE MATCHING
//                                 // =====================================================
//                                 row._scanMode = false;

//                                 input._manualTimer = setTimeout(async () => {
//                                   const list = await fetchByManualSearch(v);

//                                   let exactProduct = null;
//                                   let exactBatch = null;

//                                   const typedNorm = v.toLowerCase().trim();

//                                   for (const p of list) {
//                                     for (const b of p.batches || []) {
//                                       const rc = (b.randomCode || "").toLowerCase().trim();
//                                       const ean = (b.ean || "").toLowerCase().trim();
//                                       const bc = (b.barcode || "").toLowerCase().trim();

//                                       // exact match first
//                                       if (rc === typedNorm) {
//                                         exactProduct = p;
//                                         exactBatch = b;
//                                         break;
//                                       }

//                                       // partial match allowed only if length >= 8
//                                       if (typedNorm.length >= 8) {
//                                         if (
//                                           rc.includes(typedNorm) ||
//                                           ean.includes(typedNorm) ||
//                                           bc.includes(typedNorm)
//                                         ) {
//                                           exactProduct = p;
//                                           exactBatch = b;
//                                           break;
//                                         }
//                                       }
//                                     }
//                                     if (exactProduct) break;
//                                   }

//                                   if (exactProduct && exactBatch) {
//                                     const filledRow = {
//                                       ...row,
//                                       code: exactProduct.code,
//                                       name: exactProduct.name,
//                                       batch: exactBatch.batchNo,
//                                       mrp: Number(exactBatch.mrp),
//                                       rate: Number(exactBatch.salePrice),
//                                       qty: 1,

//                                       // gst: Number(exactProduct.taxPercent || 0),
//                                       // taxMode: (exactProduct.taxMode || "exclusive").toLowerCase(),
//                                       // isInclusive:
//                                       //   (exactProduct.taxMode || "exclusive").toLowerCase() === "inclusive",

//                                       gst: Number(exactProduct.taxPercent ?? exactBatch.taxPercent ?? 0),
//                                       taxMode: (exactProduct.taxMode || exactBatch.taxMode || "exclusive").toLowerCase(),
//                                       isInclusive: (exactProduct.taxMode || exactBatch.taxMode || "exclusive").toLowerCase() === "inclusive",
//                                       // ⭐ REQUIRED FOR STOCK TRACKING
//                                       openingStock: Number(exactBatch.qty || 0),
//                                       closingStock: Math.max(0, Number(exactBatch.qty || 0) - 1),

//                                       isNew: false,
//                                       _scanMode: false,
//                                     };

//                                     finalizeRowWithData(row.id, filledRow);

//                                     setShowCodeList((s) => ({ ...s, [row.id]: false }));

//                                     // requestAnimationFrame(() => {
//                                     //   const qtyInput = document.querySelector(
//                                     //     `input[data-row="${row.id}"][data-field="qty"]`
//                                     //   );
//                                     //   qtyInput?.focus();
//                                     // });
//                                     setTimeout(() => {
//                                       requestAnimationFrame(() => {
//                                         const qtyInput = document.querySelector(
//                                           `input[data-row="${row.id}"][data-field="qty"]`
//                                         );
//                                         if (qtyInput) qtyInput.focus();
//                                       });
//                                     }, 30);
//                                     return;
//                                   }

//                                   // no match → show suggestions
//                                   setCodeSuggestions((s) => ({
//                                     ...s,
//                                     [row.id]: list.slice(0, 20),
//                                   }));
//                                   setShowCodeList((s) => ({ ...s, [row.id]: true }));
//                                 }, 220);
//                               }}




//                               onBlur={() => {
//                                 requestAnimationFrame(() => {
//                                   if (isClickInsideSuggestion.current) {
//                                     isClickInsideSuggestion.current = false;
//                                     return;
//                                   }
//                                   setShowCodeList((v) => ({ ...v, [row.id]: false }));
//                                 });
//                               }}
//                             />
//                             {showCodeList[row.id] &&
//                               (codeSuggestions[row.id] || []).length > 0 &&
//                               renderCodeSuggestionPortal(row.id)}
//                           </td>






//                           {/* ================== Product Name ================== */}


//                           <td className="relative">
//                             <input
//                               data-row={row.id}
//                               data-field="name"
//                               value={row.name || ""}
//                               placeholder="Type or select product"
//                               // disabled={!row.isNew && editRowId !== row.id}
//                               // disabled={false}

//                               onKeyDown={(e) => {
//                                 handleSuggestionKey(e, row.id, "name");
//                                 handleEnterKey(e);
//                               }}
//                               onChange={async (e) => {
//                                 const v = e.target.value.trim();
//                                 // let v = e.target.value.slice(0, 50);


//                                 updateRow(row.id, "name", v);

//                                 // 🛑 EMPTY → HIDE dropdown
//                                 if (!v) {
//                                   updateRow(row.id, "code", "");
//                                   updateRow(row.id, "batch", "");
//                                   updateRow(row.id, "mrp", 0);
//                                   updateRow(row.id, "rate", 0);
//                                   updateRow(row.id, "gst", 0);
//                                   updateRow(row.id, "qty", 0);
//                                   setShowNameList((s) => ({ ...s, [row.id]: false }));
//                                   return;
//                                 }

//                                 // 🛑 Only letters + numbers allowed
//                                 if (!/^[a-zA-Z0-9 ]+$/.test(v)) {
//                                   setShowNameList((s) => ({ ...s, [row.id]: false }));
//                                   return;
//                                 }

//                                 // fetch
//                                 const all = await fetchProducts(v);
//                                 setNameSuggestions((s) => ({
//                                   ...s,
//                                   [row.id]: all.slice(0, 20),
//                                 }));
//                                 setShowNameList((s) => ({ ...s, [row.id]: true }));
//                               }}
//                               onBlur={() => {
//                                 requestAnimationFrame(() => {
//                                   if (isClickInsideSuggestion.current) {
//                                     isClickInsideSuggestion.current = false;
//                                     return;
//                                   }
//                                   setShowNameList((v) => ({ ...v, [row.id]: false }));
//                                 });
//                               }}
//                             />
//                             {showNameList[row.id] &&
//                               (nameSuggestions[row.id] || []).length > 0 &&
//                               renderNameSuggestionPortal(row.id)}
//                           </td>


//                           {/* ================== Batch ================== */}
//                           <td className="relative">
//                             <input
//                               className="input"
//                               data-row={row.id}
//                               data-field="batch"
//                               placeholder="Enter or select batch number"
//                               value={row.batch}
//                               onChange={(e) => {
//                                 // If we're in scan mode (randomCode filled), do not open batch dropdown while scanning
//                                 if (row._scanMode) return;

//                                 const v = e.target.value;
//                                 // let v = e.target.value.slice(0, 50);

//                                 setRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, batch: v } : r)));

//                                 const valid = row.name && row.code;
//                                 if (!valid) {
//                                   setShowBatchList((m) => ({ ...m, [row.id]: false }));
//                                   return;
//                                 }

//                                 if (v.trim() === "") {
//                                   const batches = row.name ? getBatchesForName(row.name) : getBatchesForCode(row.code);
//                                   setBatchesByRow((b) => ({ ...b, [row.id]: batches }));
//                                   setShowBatchList((m) => ({ ...m, [row.id]: true }));
//                                 } else {
//                                   setShowBatchList((m) => ({ ...m, [row.id]: true }));
//                                 }
//                               }}

//                               onFocus={(e) => {
//                                 if (row._scanMode) return; // do not show batch dropdown after a scan fill
//                                 if (!(row.name && row.code)) return;
//                                 const batches = row.name ? getBatchesForName(row.name) : getBatchesForCode(row.code);
//                                 setBatchesByRow((b) => ({ ...b, [row.id]: batches }));
//                                 setShowBatchList((m) => ({ ...m, [row.id]: true }));
//                               }}


//                               onBlur={() => {
//                                 requestAnimationFrame(() => {
//                                   if (isClickInsideBatchPortal.current) {
//                                     isClickInsideBatchPortal.current = false;
//                                     return;
//                                   }
//                                   setShowBatchList((m) => ({ ...m, [row.id]: false }));
//                                 });
//                               }}
//                               onKeyDown={(e) => handleBatchKey(e, row.id)}
//                             />

//                             {row.name &&
//                               row.code &&
//                               Array.isArray(batchesByRow[row.id]) &&
//                               batchesByRow[row.id].length > 0 &&
//                               showBatchList[row.id] &&
//                               !row._scanMode &&      // 🔥 BLOCK BATCH LIST DURING SCANNING
//                               renderBatchPortal(row.id)}

//                           </td>

//                           {/* ================== MRP ================== */}
//                           <td>
//                             <input
//                               type="number"
//                               {...numberInputProps}
//                               value={row.mrp || 0}
//                               onChange={(e) => updateRow(row.id, "mrp", e.target.value)}
//                               // disabled={!row.isNew && editRowId !== row.id}
//                               disabled={!row.isNew}
//                               readOnly
//                             // disabled
//                             />
//                           </td>

//                           {/* ================== Rate ================== */}
//                           <td>
//                             <input
//                               type="number"
//                               {...numberInputProps}
//                               value={row.rate || 0}
//                               onChange={(e) => updateRow(row.id, "rate", e.target.value)}
//                               // disabled={!row.isNew && editRowId !== row.id}
//                               disabled={!row.isNew}
//                               readOnly
//                             // disabled
//                             />
//                           </td>

//                           {/* ================== GST ================== */}
//                           <td>
//                             <input
//                               type="number"
//                               {...numberInputProps}
//                               value={row.gst || 0}
//                               onChange={(e) => updateRow(row.id, "gst", e.target.value)}
//                               disabled={!row.isNew && editRowId !== row.id}
//                               // disabled={!row.isNew} 
//                               readOnly
//                             // disabled
//                             />
//                           </td>

//                           {/* ================== Qty ================== */}
//                           <td>
//                             <input
//                               data-row={row.id}
//                               data-field="qty"
//                               type="number"
//                               {...numberInputProps}
//                               value={row.qty || ""}
//                               onKeyDown={(e) => {
//                                 let currentQty = Number(row.qty || 0);

//                                 // 🔼 ARROW UP → increase qty
//                                 if (e.key === "ArrowUp") {
//                                   e.preventDefault();
//                                   const newQty = currentQty + 1;

//                                   // Validate stock before increment
//                                   const prod = products.find(
//                                     (p) => normalizeKey(p.code) === normalizeKey(row.code)
//                                   );
//                                   const batch = prod?.batches?.find(
//                                     (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
//                                   );
//                                   const baseStock = Number(batch?.qty || 0);

//                                   const reservedUI = getRowsReservedForKey(row.code, row.batch, row.id);
//                                   const maxAllowed = Math.max(0, baseStock - reservedUI);

//                                   if (newQty > maxAllowed) {
//                                     showPopup(`Only ${maxAllowed} available`, "error");
//                                     return;
//                                   }

//                                   updateRow(row.id, "qty", newQty);
//                                 }

//                                 // 🔽 ARROW DOWN → decrease qty
//                                 if (e.key === "ArrowDown") {
//                                   e.preventDefault();
//                                   const newQty = Math.max(0, currentQty - 1);

//                                   if (newQty === 0) {
//                                     showPopup("No available stock", "error");
//                                   }

//                                   updateRow(row.id, "qty", newQty);
//                                 }
//                               }}
//                               onChange={(e) => {
//                                 let newQty = Number(e.target.value) || 0;





//                                 // ⚠️ Show "No available stock" when qty becomes 0
//                                 if (newQty === 0) {
//                                   showPopup("No available stock", "error");
//                                 }

//                                 const baseStock = (() => {
//                                   const prod = products.find(
//                                     (p) => normalizeKey(p.code) === normalizeKey(row.code)
//                                   );
//                                   if (!prod) return 0;
//                                   const batch = prod.batches?.find(
//                                     (b) => normalizeKey(b.batchNo) === normalizeKey(row.batch)
//                                   );
//                                   return Number(batch?.qty || 0);
//                                 })();

//                                 const reservedUI = getRowsReservedForKey(row.code, row.batch, row.id);
//                                 const maxAllowed = Math.max(0, baseStock - reservedUI);

//                                 if (newQty > maxAllowed) {
//                                   showPopup(`Only ${maxAllowed} available`, "error");
//                                   e.target.value = maxAllowed;
//                                   updateRow(row.id, "qty", maxAllowed);
//                                   return;
//                                 }

//                                 updateRow(row.id, "qty", newQty);
//                               }}
//                             />
//                           </td>


//                           {/* ================== GST VALUE COLUMN (NEW) ================== */}
//                           <td style={{ textAlign: "right", fontWeight: 600 }}>
//                             {row.taxMode === "inclusive"
//                               ? "0.00"                               // ⭐ Inclusive → 0
//                               : Number(row.gstAmount || 0).toFixed(2)}
//                           </td>



//                           {/* ================== GST VALUE COLUMN (FIXED) ================== */}
//                           {/* <td style={{ textAlign: "right", fontWeight: 600 }}>
//   {Number(row.gstAmount || 0).toFixed(2)}
// </td> */}



//                           {/* ================== Value ================== */}
//                           <td style={{ textAlign: "right", fontWeight: 600 }}>
//                             {Number(row.value || 0).toFixed(2)}
//                             {row.taxMode && (
//                               <div className="text-xs text-gray-400 mt-1">
//                                 {row.taxMode === "inclusive" ? "Inclusive" : "Exclusive"}
//                               </div>
//                             )}
//                           </td>


//                           {/* ================== Actions ================== */}
//                           <td className="row-actions">
//                             {row.isNew ? (
//                               <button
//                                 className="plus"
//                                 onClick={() => {
//                                   // read the latest row directly and call addRow synchronously
//                                   const r = rows.find((x) => x.id === row.id);

//                                   if (
//                                     r?.code?.toString().trim() &&
//                                     r?.name?.toString().trim() &&
//                                     r?.batch?.toString().trim() &&
//                                     Number(r?.qty) > 0 &&
//                                     Number(r?.rate) > 0
//                                   ) {
//                                     // call addRow immediately — this uses current state and keeps behavior predictable
//                                     addRow(row.id);
//                                   } else {
//                                     showPopup("Fill required fields", "error");
//                                   }
//                                 }}
//                               >
//                                 <FaPlus />
//                               </button>
//                             ) : editRowId === row.id ? (
//                               <>
//                                 <button
//                                   onClick={() => saveRowEdit(row.id)}
//                                   className="success"
//                                   style={{ color: "green" }}
//                                 >
//                                   <FaCheck />
//                                 </button>
//                                 <button onClick={cancelRowEdit} className="danger">
//                                   <FaTimes />
//                                 </button>
//                               </>
//                             ) : (
//                               <>
//                                 {/* <button
//         onClick={() => {
//           const rowObj = rows.find((r) => r.id === row.id);
//           if (rowObj) {
//             const k = getStockKey(rowObj.code, rowObj.batch);

//             // STORE reserved at beginning of editing
//             setOriginalRowData((prev) => ({
//               ...prev,
//               [row.id]: {
//                 ...rowObj,
//                 reservedAtEdit: Number(reservedStock[k] || 0),
//               },
//             }));
//           }

//           setEditRowId(row.id);
//         }}
//         className="edit"
//       >
//         <FaEdit />
//       </button> */}

//                                 <button
//                                   onClick={() => deleteRow(row.id)}
//                                   className="danger"
//                                 >
//                                   <FaTrash />
//                                 </button>
//                               </>
//                             )}
//                           </td>

//                         </tr>

//                         {stockErrors[row.id] && (
//                           <tr>
//                             <td colSpan="10" style={{ color: "red", fontSize: 13 }}>
//                               ❌ {stockErrors[row.id]}
//                             </td>
//                           </tr>
//                         )}
//                       </React.Fragment>
//                     );
//                   })}
//                 </tbody>
//               </table>



//               {/* ------------------ Totals / Bill Summary ------------------ */}
//               <div
//                 className="totals-layout"
//                 style={{
//                   display: "flex",
//                   justifyContent: "space-between",
//                   gap: "2rem",
//                   marginTop: "2rem",
//                   flexWrap: "wrap",
//                 }}
//               >
//                 {/* Left column - Bill Summary + GST Breakdown */}
//                 <div
//                   className="totals-left"
//                   style={{
//                     flex: 1,
//                     minWidth: "200px",
//                     backgroundColor: "#f0f8f5",
//                     padding: "1rem",
//                     borderRadius: "0.75rem",
//                     boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
//                     display: "flex",
//                     flexDirection: "column",
//                     gap: "0.75rem",
//                   }}
//                 >
//                   <h3
//                     style={{
//                       margin: 0,
//                       fontSize: "1.2rem",
//                       fontWeight: 600,
//                       color: "#007867",
//                     }}
//                   >
//                     Bill Summary
//                   </h3>

//                   {/* Calculate GST / CGST / SGST */}
//                   {
//                     (() => {
//                       let gstSummary = {};

//                       rows.forEach((r) => {
//                         const gstRate = Number(r.gst || 0);
//                         const gstAmt = Number(r.gstAmount || 0);

//                         if (gstRate > 0 && gstAmt > 0) {
//                           gstSummary[gstRate] = (gstSummary[gstRate] || 0) + gstAmt;
//                         }
//                       });

//                       return (
//                         <>
//                           <div style={{ display: "flex", justifyContent: "space-between" }}>
//                             <span>CGST</span>
//                             <strong>{Number(totals.cgst || 0).toFixed(2)}</strong>
//                           </div>

//                           <div style={{ display: "flex", justifyContent: "space-between" }}>
//                             <span>SGST</span>
//                             <strong>{Number(totals.sgst || 0).toFixed(2)}</strong>
//                           </div>

//                           <hr />

//                           <div style={{ display: "flex", justifyContent: "space-between" }}>
//                             <span>GST</span>
//                             <strong >{(Number(totals.cgst || 0) + Number(totals.sgst || 0)).toFixed(2)}</strong>
//                           </div>



//                           {/* Show GST breakup only after item added */}
//                           {Object.keys(gstSummary).length > 0 && (
//                             <>
//                               {Object.keys(gstSummary)
//                                 .map(Number)
//                                 .sort((a, b) => a - b)
//                                 .map((rate) => (
//                                   <div
//                                     key={rate}
//                                     style={{ display: "flex", justifyContent: "space-between" }}
//                                   >
//                                     <span>{rate.toFixed(2)}%</span>
//                                     <strong>{gstSummary[rate].toFixed(2)}</strong>
//                                   </div>
//                                 ))}
//                             </>
//                           )}

//                         </>
//                       );
//                     })()}

//                 </div>

//                 {/* Right column - Totals */}
//                 <div
//                   className="totals-right"
//                   style={{
//                     flex: 1,
//                     minWidth: "200px",
//                     backgroundColor: "#f9f9f9",
//                     padding: "1rem",
//                     borderRadius: "0.75rem",
//                     boxShadow: "0 4px 12px rgba(0,0,0,0.05)",
//                     display: "flex",
//                     flexDirection: "column",
//                     gap: "0.75rem",
//                   }}
//                 >

//                   {/* TOTAL */}
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                       alignItems: "center",
//                     }}
//                   >
//                     <span style={{ fontWeight: 300, minWidth: "100px" }}>Total</span>
//                     <input
//                       type="number"
//                       readOnly
//                       value={Number(totals.total || 0).toFixed(2)}
//                       style={{
//                         flex: 1,
//                         padding: "0.75rem 1rem",
//                         fontSize: "1rem",
//                         fontWeight: 500,
//                         borderRadius: "0.5rem",
//                         border: "1px solid #ccc",
//                         textAlign: "right",
//                         backgroundColor: "#fff",
//                       }}
//                     />
//                   </div>

//                   {/* GST (CGST + SGST) */}
//                   {/* <div
//     style={{
//       display: "flex",
//       justifyContent: "space-between",
//       alignItems: "center",
//     }}
//   >
//     <span style={{ fontWeight: 300, minWidth: "100px" }}>GST</span>
//     <input
//       type="number"
//       readOnly
//       value={(Number(totals.cgst || 0) + Number(totals.sgst || 0)).toFixed(2)}
//       style={{
//         flex: 1,
//         padding: "0.75rem 1rem",
//         fontSize: "1rem",
//         fontWeight: 500,
//         borderRadius: "0.5rem",
//         border: "1px solid #ccc",
//         textAlign: "right",
//         backgroundColor: "#fff",
//       }}
//     />
//   </div> */}

//                   {/* DISCOUNT →  ( % + VALUE ) */}
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                       alignItems: "center",
//                       gap: "10px",
//                     }}
//                   >
//                     <span style={{ fontWeight: 300, minWidth: "100px" }}>Discount</span>

//                     {/* % BOX */}
//                     <input
//                       type="number"
//                       placeholder="%"
//                       value={totals.discountPercent || ""}
//                       onChange={(e) => {
//                         const perc = Number(e.target.value) || 0;

//                         // ⭐ UPDATED: Calculate discount using Net Amount, not Total
//                         const amt = ((Number(totals.netAmount) * perc) / 100).toFixed(2);

//                         setTotals((prev) => ({
//                           ...prev,
//                           discountPercent: perc,
//                           discount: Number(amt),
//                         }));
//                       }}
//                       onWheel={(e) => {
//                         e.preventDefault();
//                         e.target.blur();
//                       }}
//                       style={{
//                         width: "105px",
//                         padding: "0.75rem 0.5rem",
//                         fontSize: "1rem",
//                         fontWeight: 500,
//                         borderRadius: "0.5rem",
//                         border: "1px solid #ccc",
//                         textAlign: "right",
//                         backgroundColor: "#fff",
//                       }}
//                     />

//                     {/* DISCOUNT AMOUNT BOX */}
//                     <input
//                       type="number"
//                       placeholder="₹"
//                       value={totals.discount === 0 ? "" : totals.discount}
//                       onChange={(e) => {
//                         const val = Number(e.target.value) || 0;

//                         // ⭐ UPDATED: discount% = discount / netAmount
//                         const perc =
//                           totals.netAmount > 0 ? ((val / totals.netAmount) * 100).toFixed(2) : 0;

//                         setTotals((prev) => ({
//                           ...prev,
//                           discount: val,
//                           discountPercent: Number(perc),
//                         }));
//                       }}
//                       onBlur={(e) => {
//                         if (e.target.value === "") {
//                           setTotals((prev) => ({
//                             ...prev,
//                             discount: 0,
//                             discountPercent: 0,
//                           }));
//                         }
//                       }}
//                       onWheel={(e) => {
//                         e.preventDefault();
//                         e.target.blur();
//                       }}
//                       style={{
//                         width: "105px",
//                         padding: "0.75rem 0.5rem",
//                         fontSize: "1rem",
//                         fontWeight: 500,
//                         borderRadius: "0.5rem",
//                         border: "1px solid #ccc",
//                         textAlign: "right",
//                         backgroundColor: "#fff",
//                       }}
//                     />
//                   </div>

//                   {/* NET AMOUNT */}
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                       alignItems: "center",
//                     }}
//                   >
//                     <span style={{ fontWeight: 300, minWidth: "100px" }}>Net Amount</span>
//                     <input
//                       type="number"
//                       readOnly
//                       value={Number(totals.netAmount || 0).toFixed(2)}
//                       style={{
//                         flex: 1,
//                         padding: "0.75rem 1rem",
//                         fontSize: "1rem",
//                         fontWeight: 500,
//                         borderRadius: "0.5rem",
//                         border: "1px solid #ccc",
//                         textAlign: "right",
//                         backgroundColor: "#fff",
//                       }}
//                     />
//                   </div>

//                   {/* CASH GIVEN */}
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                       alignItems: "center",
//                     }}
//                   >
//                     <span style={{ fontWeight: 300, minWidth: "100px" }}>Cash Given</span>
//                     <input
//                       type="number"
//                       value={totals.cashGiven === 0 ? "" : totals.cashGiven}
//                       // onChange={(e) => {
//                       //   const val = Number(e.target.value) || 0;
//                       //    setHasCashInput(e.target.value !== "");
//                       //   setTotals((prev) => ({ ...prev, cashGiven: val }));
//                       // }}

//                       onChange={(e) => {
//                         const cashGiven = Number(e.target.value) || 0;
//                         const net = Number(totals.netAmount || 0);

//                         setHasCashInput(e.target.value !== "");

//                         // 🔥 Cap cash payment to netAmount
//                         const cashPay = Math.min(cashGiven, net);

//                         // 🔥 Update totals
//                         setTotals((prev) => ({
//                           ...prev,
//                           cashGiven,
//                           balance: cashGiven - net,
//                         }));

//                         // 🔥 Live update payment method
//                         setPayment({
//                           cash: cashPay,
//                           upi: 0, // reset UPI when cash changes
//                         });

//                         setPaymentMethod("cash");
//                       }}


//                       onBlur={(e) => {
//                         if (e.target.value === "") {
//                           setTotals((prev) => ({ ...prev, cashGiven: 0 }));
//                         }
//                       }}
//                       onWheel={(e) => {
//                         e.preventDefault();
//                         e.target.blur();
//                       }}
//                       style={{
//                         flex: 1,
//                         padding: "0.75rem 1rem",
//                         fontSize: "1rem",
//                         fontWeight: 500,
//                         borderRadius: "0.5rem",
//                         border: "1px solid #ccc",
//                         textAlign: "right",
//                         backgroundColor: "#fff",
//                       }}
//                     />
//                   </div>

//                   {/* BALANCE (CAN BE NEGATIVE) */}
//                   <div
//                     style={{
//                       display: "flex",
//                       justifyContent: "space-between",
//                       alignItems: "center",
//                     }}
//                   >
//                     <span style={{ fontWeight: 300, minWidth: "100px" }}>Balance</span>
//                     <input
//                       type="number"
//                       readOnly
//                       // value={Number(totals.balance || 0).toFixed(2)}
//                       value={
//                         hasCashInput
//                           ? Number(totals.balance || 0).toFixed(2)
//                           : "0.00"
//                       }
//                       style={{
//                         flex: 1,
//                         padding: "0.75rem 1rem",
//                         fontSize: "1rem",
//                         fontWeight: 500,
//                         borderRadius: "0.5rem",
//                         border: "1px solid #ccc",
//                         textAlign: "right",
//                         backgroundColor: "#fff",
//                       }}
//                     />
//                   </div>
//                 </div>




//               </div>


//               {/* ---------------- Payment Method ---------------- */}
//               <div
//                 className="mt-4 p-4 rounded-lg bg-[#eef8f3]
//              transform transition-all duration-300
//              animate-[fadeUp_0.4s_ease-out]
//              hover:shadow-lg"
//               >
//                 <div className="flex items-center justify-between gap-6">

//                   {/* LEFT */}
//                   <div className="flex flex-col gap-4">

//                     {/* HEADER */}
//                     <label className="font-semibold flex items-center gap-2 text-sm">
//                       <FaExchangeAlt className="text-green-700" />
//                       Payment Method
//                     </label>

//                     {/* PAYMENT OPTIONS */}
//                     <div className="flex gap-8">

//                       {/* ================= CASH ================= */}
//                       <div className="flex flex-col gap-2 w-40">

//                         {/* HIDDEN CHECKBOX (LOGIC PRESERVED) */}
//                         <input
//                           type="checkbox"
//                           checked={payCash}
//                           onChange={(e) => {
//                             const checked = e.target.checked;
//                             setPayCash(checked);

//                             if (!checked) setPayUpi(true);

//                             syncPayment(checked, payUpi || !checked, totals.cashGiven);
//                           }}
//                           hidden
//                         />

//                         {/* CASH TOGGLE */}
//                         <div className="flex bg-gray-100 rounded-full p-1">
//                           <button
//                             type="button"
//                             onClick={() => {
//                               const checked = !payCash;
//                               setPayCash(checked);

//                               if (!checked) setPayUpi(true);

//                               syncPayment(checked, payUpi || !checked, totals.cashGiven);
//                             }}
//                             className={`
//                 w-full px-4 py-1 text-sm rounded-full transition-all
//                 flex items-center justify-center gap-2
//                 ${payCash
//                                 ? "bg-[#c8fad6] text-[#007867] shadow"
//                                 : "text-gray-700"
//                               }
//               `}
//                           >
//                             <FaMoneyBillWave />
//                             Cash
//                           </button>
//                         </div>

//                         {/* CASH INPUT */}
//                         <input
//                           type="number"
//                           value={payment.cash === 0 ? "" : payment.cash.toFixed(2)}
//                           onChange={(e) => {
//                             const entered = Number(e.target.value) || 0;
//                             syncPayment(true, payUpi, entered);
//                           }}
//                           onWheel={(e) => e.target.blur()}
//                           disabled={!payCash}
//                           placeholder="Cash Amount"
//                           className="w-full p-2 rounded-md border text-sm text-right disabled:bg-gray-100"
//                         />

//                         {/* CASH VALUE */}
//                         <div className="text-xs text-gray-700 text-right">
//                           Cash: ₹{payment.cash.toFixed(2)}
//                         </div>
//                       </div>

//                       {/* ================= UPI ================= */}
//                       <div className="flex flex-col gap-2 w-40">

//                         {/* HIDDEN CHECKBOX (LOGIC PRESERVED) */}
//                         <input
//                           type="checkbox"
//                           checked={payUpi}
//                           onChange={(e) => {
//                             const checked = e.target.checked;
//                             setPayUpi(checked);

//                             if (!checked) setPayCash(true);

//                             syncPayment(payCash || !checked, checked, totals.cashGiven);
//                           }}
//                           hidden
//                         />

//                         {/* UPI TOGGLE */}
//                         <div className="flex bg-gray-100 rounded-full p-1">
//                           <button
//                             type="button"
//                             onClick={() => {
//                               const checked = !payUpi;
//                               setPayUpi(checked);

//                               if (!checked) setPayCash(true);

//                               syncPayment(payCash || !checked, checked, totals.cashGiven);
//                             }}
//                             className={`
//                 w-full px-4 py-1 text-sm rounded-full transition-all
//                 flex items-center justify-center gap-2
//                 ${payUpi
//                                 ? "bg-[#c8fad6] text-[#007867] shadow"
//                                 : "text-gray-700"
//                               }
//               `}
//                           >
//                             <FaMobileAlt />
//                             UPI
//                           </button>
//                         </div>

//                         {/* UPI INPUT */}
//                         <input
//                           type="number"
//                           value={payment.upi === 0 ? "" : payment.upi.toFixed(2)}
//                           onChange={(e) => {
//                             const entered = Number(e.target.value) || 0;
//                             syncPayment(payCash, true, totals.cashGiven - entered);
//                           }}
//                           onWheel={(e) => e.target.blur()}
//                           disabled={!payUpi}
//                           placeholder="UPI Amount"
//                           className="w-full p-2 rounded-md border text-sm text-right disabled:bg-gray-100"
//                         />

//                         {/* UPI VALUE */}
//                         <div className="text-xs text-gray-700 text-right">
//                           UPI: ₹{payment.upi.toFixed(2)}
//                         </div>
//                       </div>

//                     </div>
//                   </div>

//                   {/* RIGHT */}
//                   {/* <button
//                   className="bg-green-700 text-white px-4 py-2 rounded-md text-sm
//                  hover:bg-green-800 transition-all duration-200
//                  hover:scale-110 shadow-md"
//                   onClick={handleSaveAndPrint}
//                 >
//                   Print
//                 </button> */}
//                   <button
//                     onClick={handleSaveAndPrint}
//                     disabled={saving}
//                     className={`px-4 py-2 rounded-md text-sm flex items-center gap-2
//     bg-green-700 text-white shadow-md transition-all duration-200
//     ${saving
//                         ? "opacity-60 cursor-not-allowed"
//                         : "hover:bg-green-800 hover:scale-110"
//                       }
//   `}
//                   >
//                     {saving && (
//                       <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
//                     )}

//                     {saving ? "Printing..." : "Print"}
//                   </button>


//                 </div>
//               </div>
//             </div>
//           </div>
//         </div>
//       )}

//       {/* ==================== VIEW BILL MODAL ==================== */}
//       {showViewModal && viewBill && (
//         <ViewOnlySaleModal
//           showModal={showViewModal}
//           onClose={() => setShowViewModal(false)}
//           meta={{
//             counter: viewBill.counter,
//             billNo: viewBill.billNo,
//             date: viewBill.date,
//             customerName: viewBill.customerName,
//             mobile: viewBill.mobile,
//           }}
//           rows={viewBill.items}   // ← your bill items array
//           movements={viewBill.movements}
//           totals={{
//             total: viewBill.total,
//             netAmount: viewBill.netAmount,
//             discount: viewBill.discount,
//             discountPercent: viewBill.discountPercent,
//             cgst: viewBill.cgst,
//             sgst: viewBill.sgst,
//             cashGiven: viewBill.cashGiven,
//             balance: viewBill.balance,
//           }}

//           loggedInUser={user}

//           paymentMethod={viewBill.paymentMethod}
//           payment={viewBill.payment}

//           selectedShop={selectedShop}
//           titlePrefix="View Bill"
//         />
//       )}



//     </div>
//   );

// }


















