

// src/pages/master/sidebar/MasterSalesBill.jsx

import React, {
  useState,
  useEffect,
  useMemo,
  useRef,
  useCallback,
  useContext,
} from "react";
import { FaEye, FaTrash, FaTimes, FaPlus, FaCheckCircle, FaTimesCircle, FaEdit, FaExchangeAlt, FaMoneyBillWave, FaMobileAlt } from "react-icons/fa";
import axios from "axios";
import "../../../styles/salesbill.css";
import { useAuth } from "../../../context/AuthContext";
import { ShopContext } from "../../../context/ShopContext";
import Pagination from "../../../components/Pagination";
import { useParams } from "react-router-dom";
import ViewOnlySaleModal from "../../../components/ViewOnlySaleModal";

const API_BASE = import.meta.env.VITE_API_URL || "http://localhost:5000";
const axiosInstance = axios.create({ baseURL: API_BASE });

export default function MasterSalesBill() {
  const { user } = useAuth();
  const { selectedShop, setSelectedShop } = useContext(ShopContext);
  const { shopId } = useParams();

  // Master token from localStorage (user must be master)
  const token = localStorage.getItem("token");
  const shopname = selectedShop?.shopname || "";

  // ---------- State ----------
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState([createEmptyRow()]);
  const [products, setProducts] = useState([]);
  const [meta, setMeta] = useState({
    billNo: "",
    date: "",
    counter: 1,
    customerName: "",
    mobile: "",
  });
  const [totals, setTotals] = useState({
    total: 0,
    discount: 0,
    discountPercent: 0,
    netAmount: 0,
    cashGiven: 0,
    balance: 0,
    cgst: 0,
    sgst: 0,
  });
  const [reservedStock, setReservedStock] = useState({});
  const [popup, setPopup] = useState({ message: "", type: "" });
  const [showModal, setShowModal] = useState(false);
  const [billEditMode, setBillEditMode] = useState(false);
  const [editingBillId, setEditingBillId] = useState(null);
  const [nameSuggestions, setNameSuggestions] = useState({});
  const [codeSuggestions, setCodeSuggestions] = useState({});
  const [batchesByRow, setBatchesByRow] = useState({});
  const [showBatchList, setShowBatchList] = useState({});
  const [showNameList, setShowNameList] = useState({});
  const [showCodeList, setShowCodeList] = useState({});
  const [stockErrors, setStockErrors] = useState({});
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [viewBill, setViewBill] = useState(null);
  const [editRowId, setEditRowId] = useState(null);
  const [errorMsg, setErrorMsg] = useState("");
  const [originalBillItems, setOriginalBillItems] = useState({});
  const debounceRef = useRef({});
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const limit = 100;
  const [counterFilter, setCounterFilter] = useState("");
  const [showViewModal, setShowViewModal] = useState(false);

  const portalRoot = typeof document !== "undefined" ? document.body : null;
  const suggestionRefs = useRef({});


  const [paymentMethod, setPaymentMethod] = useState("cash"); // cash | upi | mixed

  const [payment, setPayment] = useState({
    cash: 0,
    upi: 0,
  });


  const [hasCashInput, setHasCashInput] = useState(false);
  const [saving, setSaving] = useState(false);


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

    // Only UPI
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
    const hasCash = payment.cash > 0;
    const hasUpi = payment.upi > 0;

    setPayCash(hasCash || !hasUpi);
    setPayUpi(hasUpi || !hasCash);
  }, [payment.cash, payment.upi]);


  // ---------- Helpers ----------
  function createEmptyRow() {
    return {
      id: Date.now() + Math.random(),
      code: "",
      name: "",
      batch: "",
      mrp: 0,
      rate: 0,
      qty: 0,
      gst: 0,
      amount: 0,
      taxable: 0,
      gstAmount: 0,
      value: 0,
      isNew: true,
      isInclusive: true,
    };
  }

  const normalizeKey = (str = "") =>
    str.toString().trim().toLowerCase().replace(/\s+/g, "");

  const getStockKey = (code, batch) =>
    `${normalizeKey(code)}_${normalizeKey(batch)}`;

  const getAuthHeaders = () => ({
    Authorization: token ? `Bearer ${token}` : "",
    "x-shop-id": selectedShop?._id || "",
    "x-shop-name": shopname ? encodeURIComponent(shopname) : "",
  });

  const debounce = useCallback(
    (key, fn, delay = 250) =>
      (...args) => {
        clearTimeout(debounceRef.current[key]);
        debounceRef.current[key] = setTimeout(() => fn(...args), delay);
      },
    []
  );

  const showPopup = (message, type = "error") => {
    setPopup({ message, type });
    setTimeout(() => setPopup({ message: "", type: "" }), 2500);
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return `${String(d.getDate()).padStart(2, "0")}-${String(
      d.getMonth() + 1
    ).padStart(2, "0")}-${d.getFullYear()}`;
  };

  const tenantProductsApi = shopname
    ? `/api/tenant/shops/${encodeURIComponent(shopname)}/products`
    : null;
  const tenantBillsApi = shopname
    ? `/api/tenant/shops/${encodeURIComponent(shopname)}/master-sales-bills`
    : null;

  // ---------- Fetch Products (all) ----------
  const fetchProducts = async () => {
    if (!tenantProductsApi) return;

    try {
      const url = `${tenantProductsApi}?limit=0`;
      const { data } = await axiosInstance.get(url, {
        headers: getAuthHeaders(),
      });

      const list = Array.isArray(data?.products)
        ? data.products
        : Array.isArray(data)
          ? data
          : [];

      const normalized = list.map((p) => ({
        ...p,
        code: p.code?.trim() || "",
        name: p.name?.trim() || "",
        category: p.category?.trim() || "",
        batches:
          Array.isArray(p.batches) && p.batches.length
            ? p.batches.map((b) => ({
              batchNo: b.batchNo || b.batch || "",
              qty: Number(b.qty ?? 0),
              mrp: Number(b.mrp ?? 0),
              salePrice: Number(b.salePrice ?? b.rate ?? 0),
              gst: Number(b.taxPercent ?? b.gst ?? 0),
              taxMode: (b.taxMode || "").toString().toLowerCase(),
              isInclusive:
                (b.taxMode || "").toString().toLowerCase() === "inclusive",
            }))
            : [
              {
                batchNo: p.batchNo || "",
                qty: Number(p.qty ?? 0),
                mrp: Number(p.mrp ?? p.price ?? 0),
                salePrice: Number(p.salePrice ?? p.rate ?? 0),
                gst: Number(p.taxPercent ?? p.gst ?? 0),
                taxMode: (p.taxMode || "").toString().toLowerCase(),
                isInclusive:
                  (p.taxMode || "").toString().toLowerCase() === "inclusive",
              },
            ],
      }));

      setProducts(normalized);
    } catch (err) {
      console.error("❌ Error fetching tenant products:", err);
      setProducts([]);
    }
  };

  // ---------- Get stock from products (current DB qty) ----------
  const getBatchDbStock = (code, batch) => {
    if (!code || !batch) return 0;
    const nCode = normalizeKey(code);
    const nBatch = normalizeKey(batch);

    const product = products.find((p) => normalizeKey(p.code) === nCode);
    if (!product) return 0;

    const batchObj = product.batches?.find(
      (b) => normalizeKey(b.batchNo) === nBatch
    );
    return Number(batchObj?.qty ?? 0);
  };

  // ---------- Shop fetch ----------
  useEffect(() => {
    if (shopId && (!selectedShop || selectedShop._id !== shopId)) {
      axiosInstance
        .get(`${API_BASE}/api/shops/${shopId}`, {
          headers: { Authorization: token ? `Bearer ${token}` : "" },
        })
        .then((res) =>
          setSelectedShop ? setSelectedShop(res.data.shop) : null
        )
        .catch((err) => console.error("Failed to fetch shop:", err));
    }
  }, [shopId, selectedShop, token, setSelectedShop]);

  // ---------- Fetch bills ----------
  const fetchBills = async (pageNumber = 1) => {
    if (!tenantBillsApi) return;
    setLoading(true);

    try {
      const tokenLocal =
        localStorage.getItem("tenantToken") ||
        localStorage.getItem("masterToken") ||
        localStorage.getItem("token");

      const params = new URLSearchParams({
        page: pageNumber,
        limit,
        search: search.trim(),
        filter,
        fromDate,
        toDate,
        counter: counterFilter ? String(counterFilter).trim() : "",
        statusFilter: statusFilter || "all",
      });

      const { data } = await axiosInstance.get(
        `${tenantBillsApi}?${params.toString()}`,
        {
          headers: {
            Authorization: tokenLocal ? `Bearer ${tokenLocal}` : undefined,
          },
        }
      );

      const list = Array.isArray(data?.salesBills) ? data.salesBills : [];
      setBills(list);
      
      setTotalPages(Number(data.totalPages || 1));
    } catch (err) {
      console.error("Error fetching bills:", err);
      setBills([]);
      setTotalPages(1);
    } finally {
      setLoading(false);
    }
  };

  // ---------- Initial fetch when shop changes ----------
  useEffect(() => {
    if (shopname && token) {
      fetchProducts();
      fetchBills(1);
    }

    setRows([createEmptyRow()]);
    setShowModal(false);
    setBillEditMode(false);
    setEditingBillId(null);
  }, [shopname, token]);

  // useEffect(() => {
  //   fetchBills(1);
  // }, [tenantBillsApi, search, filter, fromDate, toDate, counterFilter, statusFilter]);

  useEffect(() => {
  setPage(1);
}, [tenantBillsApi, search, filter, fromDate, toDate, counterFilter, statusFilter]);

  useEffect(() => {
  if (!tenantBillsApi) return;
  fetchBills(page);
}, [page]);

  // ---------- Perfect GST calc for each row ----------
  const recalcRow = (r) => {
    const rate = Number(r.rate || 0);
    const qty = Number(r.qty || 0);
    const gst = Number(r.gst || 0);

    const isInclusive =
      typeof r.isInclusive === "boolean"
        ? r.isInclusive
        : (r.taxMode || "").toLowerCase() === "inclusive";

    if (qty <= 0 || rate <= 0) {
      return {
        ...r,
        taxable: 0,
        amount: 0,
        gstAmount: 0,
        value: 0,
        isInclusive,
      };
    }

    let taxable = 0;
    let amount = 0;
    let gstAmount = 0;
    let value = 0;

    if (isInclusive) {
      const gross = rate * qty;
      taxable = +(gross / (1 + gst / 100)).toFixed(2);
      amount = taxable;
      gstAmount = +(gross - taxable).toFixed(2);
      value = +gross.toFixed(2);
    } else {
      taxable = +(rate * qty).toFixed(2);
      amount = taxable;
      gstAmount = +((taxable * gst) / 100).toFixed(2);
      value = +(taxable + gstAmount).toFixed(2);
    }

    return {
      ...r,
      taxable,
      amount,
      gstAmount,
      value,
      isInclusive,
    };
  };

  // ---------- Totals from rows ----------
  const recalcTotals = () => {
    const total = rows
      .filter((r) => !r.isNew)
      .reduce((s, r) => s + Number(r.value || 0), 0);

    const gstTotal = rows
      .filter((r) => !r.isNew)
      .reduce((s, r) => s + Number(r.gstAmount || 0), 0);

    const discount = Number(totals.discount || 0);
    const cashGiven = Number(totals.cashGiven || 0);

    const netAmount = +(total - discount).toFixed(2);
    const balance = +(cashGiven - netAmount).toFixed(2);
    const cgst = +(gstTotal / 2).toFixed(2);
    const sgst = +(gstTotal / 2).toFixed(2);

    setTotals((prev) => ({
      ...prev,
      total,
      discount,
      netAmount,
      cashGiven,
      balance,
      cgst,
      sgst,
    }));
  };

  useEffect(() => {
    if (showModal) recalcTotals();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rows, showModal]);

  // ---------- Suggestions ----------
  const suggestNamesDebounced = debounce(
    "name",
    (rowId, query) => {
      if (!query)
        return setNameSuggestions((s) => ({ ...s, [rowId]: [] }));
      const matches = products.filter((p) =>
        (p.name || "").toLowerCase().includes(query.toLowerCase())
      );
      setNameSuggestions((s) => ({ ...s, [rowId]: matches }));
    },
    200
  );

  const suggestCodesDebounced = debounce(
    "code",
    (rowId, query) => {
      if (!query)
        return setCodeSuggestions((s) => ({ ...s, [rowId]: [] }));
      const matches = products.filter((p) =>
        (p.code || "").toLowerCase().includes(query.toLowerCase())
      );
      setCodeSuggestions((s) => ({ ...s, [rowId]: matches }));
    },
    200
  );

  const handleSelectSuggestion = (rowId, product) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? recalcRow({
            ...r,
            code: product.code,
            name: product.name,
            batch: "",
            mrp: Number(product.mrp || 0),
            rate: Number(product.salePrice || product.rate || 0),
            gst: Number(product.gst || product.taxPercent || 0),
            qty: 0,
            taxMode: product.taxMode,
            isInclusive:
              (product.taxMode || "").toString().toLowerCase() ===
              "inclusive",
          })
          : r
      )
    );
    setShowCodeList((prev) => ({ ...prev, [rowId]: false }));
    setShowNameList((prev) => ({ ...prev, [rowId]: false }));
    const batches = getBatchesForCode(product.code);
    setBatchesByRow((prev) => ({ ...prev, [rowId]: batches }));
    setShowBatchList((prev) => ({ ...prev, [rowId]: batches.length > 0 }));
  };

  const getBatchesForCode = (code) => {
    if (!code) return [];
    const nCode = code.toLowerCase();
    const product = products.find(
      (p) => (p.code || "").toLowerCase() === nCode
    );
    if (!product || !Array.isArray(product.batches)) return [];
    return product.batches.map((b) => ({
      ...b,
      code: product.code,
      name: product.name,
    }));
  };

  const getBatchesForName = (name) => {
    if (!name) return [];
    const nName = name.toLowerCase();
    const product = products.find(
      (p) => (p.name || "").toLowerCase() === nName
    );
    if (!product || !Array.isArray(product.batches)) return [];
    return product.batches.map((b) => ({
      ...b,
      code: product.code,
      name: product.name,
    }));
  };

  const handleBatchPick = (rowId, batch) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? recalcRow({
            ...r,
            batch: batch.batchNo || "",
            mrp: Number(batch.mrp || 0),
            rate: Number(batch.salePrice || 0),
            gst: Number(batch.gst || 0),
            qty: 0,
            taxMode: batch.taxMode || r.taxMode,
            isInclusive:
              typeof batch.isInclusive !== "undefined"
                ? batch.isInclusive
                : r.isInclusive,
          })
          : r
      )
    );
    setShowBatchList((prev) => ({ ...prev, [rowId]: false }));
  };

  // ---------- Update row ----------
  const updateRow = (id, field, value, skipRecalc = false) => {
    setRows((prev) =>
      prev.map((r) => {
        if (r.id !== id) return r;
        let val = value;

        if (["mrp", "rate", "gst", "qty"].includes(field)) {
          val = value === "" ? "" : Number(value);
        }

        let updated = { ...r, [field]: val };

        if ((field === "code" || field === "name") && !val) {
          updated = {
            ...updated,
            batch: "",
            mrp: 0,
            rate: 0,
            gst: 0,
            qty: 0,
            taxable: 0,
            amount: 0,
            gstAmount: 0,
            value: 0,
          };
        }

        return skipRecalc ? updated : recalcRow(updated);
      })
    );
  };

  // ---------- Add row (only for normal add; master you can ignore) ----------
  const addRow = (id) => {
    const row = rows.find((r) => r.id === id);
    if (!row) return showPopup("Row not found", "error");

    if (!row.code || !row.name || !row.batch || !row.qty || !row.rate)
      return showPopup("Fill required fields", "error");

    const totalStock = getBatchDbStock(row.code, row.batch);
    if (totalStock <= 0) return showPopup("Out of stock!", "error");
    if (row.qty > totalStock)
      return showPopup(`Only ${totalStock} units available.`, "error");

    const k = getStockKey(row.code, row.batch);
    setReservedStock((rs) => ({
      ...rs,
      [k]: (rs[k] || 0) + Number(row.qty),
    }));

    setRows((prev) =>
      prev
        .map((r) => (r.id === id ? { ...r, isNew: false } : r))
        .concat(createEmptyRow())
    );

    showPopup("Product added successfully.", "success");
  };

  // ---------- Delete row in edit mode ----------

  const deleteRow = (rowId) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === rowId
          ? {
            ...r,
            status: "cancelled", // mark row as cancelled
            qty: 0,              // qty zero -> backend returns stock
            value: 0,
            taxable: 0,
          }
          : r
      )
    );

    showPopup("Item cancelled (kept in bill).", "info");
  };



  // ---------- Qty handlers (EDIT MODE - main logic) ----------
  const handleQtyKeyDown = (e, row) => {
    if (!billEditMode) return; // only special logic in edit mode

    const currentQty = Number(row.qty || 0);
    const dbStock = getBatchDbStock(row.code, row.batch);
    const oldQty = Number(originalBillItems?.[row.id]?.qty || 0);
    const maxAllowed = dbStock + oldQty; // ensure no negative stock at save

    if (e.key === "ArrowUp") {
      e.preventDefault();
      let newQty = currentQty + 1;
      if (newQty > maxAllowed) {
        showPopup(`Only ${maxAllowed} available`, "error");
        newQty = maxAllowed;
      }
      updateRow(row.id, "qty", newQty);
    }

    if (e.key === "ArrowDown") {
      e.preventDefault();
      const newQty = Math.max(0, currentQty - 1);
      updateRow(row.id, "qty", newQty);
    }
  };

  const handleQtyChange = (e, row) => {
    let newQty = Number(e.target.value) || 0;

    if (billEditMode) {
      const dbStock = getBatchDbStock(row.code, row.batch);
      const oldQty = Number(originalBillItems?.[row.id]?.qty || 0);
      const maxAllowed = dbStock + oldQty;

      if (newQty > maxAllowed) {
        showPopup(`Only ${maxAllowed} available`, "error");
        newQty = maxAllowed;
      }
    }

    updateRow(row.id, "qty", newQty);
  };

  // ---------- Cancel row edit helpers (no row-edit mode now, so minimal) ----------
  const cancelRowEdit = () => {
    setEditRowId(null);
  };



  const markRowCancelled = (id) => {
    setRows((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, status: "cancelled", qty: 0 } : r
      )
    );

    showPopup("Item cancelled (kept in bill).", "info");
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



  // ---------- SAVE (Master – EDIT ONLY) ----------
  const handleSaveAndPrint = async () => {
    if (saving) return;
    setSaving(true);
    try {
      // Master page = only edit existing bill
      if (!billEditMode || !editingBillId) {
        showPopup("Master screen can only edit existing bills.", "error");
        return;
      }

      if (!rows.length) {
        setErrorMsg("No items found in bill.");
        return;
      }

      const headers = getAuthHeaders(user);

      // ---------- Helper: resolve inclusive/exclusive ----------
      const resolveIsInclusive = (row) => {
        if (typeof row.isInclusive === "boolean") return row.isInclusive;

        const prod = products.find(
          (p) =>
            (p.code || "").toLowerCase() === (row.code || "").toLowerCase()
        );
        if (!prod) return true;

        const batch = (prod.batches || []).find(
          (b) =>
            (b.batchNo || "").toLowerCase() ===
            (row.batch || "").toLowerCase()
        );

        if (batch && typeof batch.taxMode === "string")
          return batch.taxMode.toLowerCase() === "inclusive";

        if (typeof prod.taxMode === "string")
          return prod.taxMode.toLowerCase() === "inclusive";

        return true;
      };

      // ---------- Build items for DB (all rows: active + cancelled) ----------
      const itemsForDb = rows
        .filter((r) => r.code && r.batch)
        .map((r) => {
          const qty = Number(r.qty || 0);
          const rate = Number(r.rate || 0);
          const gst = Number(r.gst || 0);
          const inclusive = resolveIsInclusive(r);
          const status = r.status || (qty > 0 ? "active" : "cancelled");

          let taxable = 0;
          let gstAmount = 0;
          let value = 0;

          if (qty > 0 && rate > 0) {
            if (inclusive) {
              const gross = rate * qty;
              taxable = +(gross / (1 + gst / 100)).toFixed(2);
              gstAmount = +(gross - taxable).toFixed(2);
              value = +gross.toFixed(2);
            } else {
              taxable = +(rate * qty).toFixed(2);
              gstAmount = +((taxable * gst) / 100).toFixed(2);
              value = +(taxable + gstAmount).toFixed(2);
            }
          }

          return {
            code: r.code,
            name: r.name,
            batch: r.batch,
            mrp: Number(r.mrp || 0),
            rate,
            gst,
            qty,
            taxable,
            gstAmount,
            value,
            isInclusive: inclusive,
            status,
            // openingStock / closingStock are computed in backend
          };
        });

      const activeItems = itemsForDb.filter(
        (it) => it.status === "active" && it.qty > 0
      );

      const isCancelled = activeItems.length === 0;

      // ---------- Totals (only from active items) ----------
      const totalValue = activeItems.reduce((s, it) => s + (it.value || 0), 0);
      const totalGst = activeItems.reduce(
        (s, it) => s + (it.gstAmount || 0),
        0
      );

      let discount = Number(totals.discount || 0);
      let cashGiven = Number(totals.cashGiven || 0);

      if (isCancelled) {
        discount = 0;
        cashGiven = 0;
      }

      const total = isCancelled ? 0 : +totalValue.toFixed(2);
      const netAmount = isCancelled
        ? 0
        : +(totalValue - discount).toFixed(2);
      // const balance = isCancelled
      //   ? 0
      //   : +(cashGiven - netAmount).toFixed(2);

      const amountPaid =
        Number(payment.cash || 0) + Number(payment.upi || 0);


      const balance = isCancelled
        ? 0
        : +(netAmount - amountPaid).toFixed(2);




      const cgst = isCancelled ? 0 : +((totalGst / 2) || 0).toFixed(2);
      const sgst = isCancelled ? 0 : +((totalGst / 2) || 0).toFixed(2);

      setTotals((prev) => ({
        ...prev,
        total,
        discount,
        netAmount,
        cashGiven,
        balance,
        cgst,
        sgst,
      }));


      // ---- PAYMENT COMPUTATION ----


      // const balanceDue = +(netAmount - amountPaid).toFixed(2);

      const balanceDue = balance;

      const paymentStatus =
        isCancelled
          ? "cancelled"
          : balanceDue <= 0
            ? "paid"
            : amountPaid > 0
              ? "partial"
              : "unpaid";

      // ---------- Payload ----------
      const payload = {
        billNo: meta.billNo,
        date: meta.date || new Date(),
        counter: meta.counter || 1,
        customerName: meta.customerName || "Cash Customer",
        mobile: meta.mobile || "",
        items: itemsForDb, // includes cancelled items with qty=0
        total,
        discount,
        netAmount,
        cashGiven,
        balance,
        cgst,
        sgst,

        // ⭐ PAYMENT (EDIT MODE)
        paymentMethod,
        payment,
        amountPaid,
        // balanceDue,
        balanceDue: balance,
        paymentStatus,



        status: isCancelled ? "cancelled" : "active",
      };

      // ---------- API CALL (EDIT ONLY) ----------
      const response = await axiosInstance.put(
        `/api/tenant/shops/${encodeURIComponent(
          shopname
        )}/master-sales-bills/${editingBillId}`,
        payload,
        { headers }
      );

      const savedBill =
        response.data?.updated || response.data?.saved || response.data;

      setBills((prev) =>
        prev.map((b) => (b._id === editingBillId ? savedBill : b))
      );

      // NO PRINT ON MASTER SCREEN

      // Snapshot for future edits
      const newOriginalMap = {};
      (savedBill.items || []).forEach((it) => {
        newOriginalMap[it._id] = {
          code: it.code,
          batch: it.batch,
          qty: Number(it.qty || 0),
        };
      });
      setOriginalBillItems(newOriginalMap);

      // Reset UI
      setShowModal(false);
      setRows([createEmptyRow()]);
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
      setMeta((p) => ({ ...p, customerName: "", mobile: "" }));
      setBillEditMode(false);
      setEditingBillId(null);
      setErrorMsg("");

      showPopup(
        isCancelled ? "Bill cancelled successfully." : "Bill saved successfully.",
        "success"
      );
      await fetchBills(1);
    } catch (err) {
      console.error("handleSaveAndPrint MASTER ERROR:", err);
      setErrorMsg(err.response?.data?.message || "Failed to save/print");
    }
    finally {
      setSaving(false);
    }
  };

  // ---------- Edit bill: populate rows + totals from DB ----------
  const handleEditBill = (bill) => {
    if (!bill) return;
    setBillEditMode(true);
    setEditingBillId(bill._id);
    setShowModal(true);

    const rowsWithId = (bill.items || []).map((item, idx) =>
      recalcRow({
        ...item,
        id: item._id || `item-${idx}-${Date.now()}`,
        qty: Number(item.qty || 0),
        rate: Number(item.rate || 0),
        gst: Number(item.gst || 0),
        taxable: Number(item.taxable || 0),
        value: Number(item.value || 0),
        isInclusive:
          typeof item.isInclusive === "boolean"
            ? item.isInclusive
            : true,
        isNew: false,
      })
    );

    setRows(rowsWithId);

    setMeta({
      billNo: bill.billNo || "",
      date: bill.date
        ? new Date(bill.date).toISOString().split("T")[0]
        : "",
      counter: bill.counter || 1,
      customerName: bill.customerName || "",
      mobile: bill.mobile || "",
    });

    setTotals({
      total: Number(bill.total || 0),
      discount: Number(bill.discount || 0),
      discountPercent: Number(bill.discountPercent || 0),
      netAmount: Number(bill.netAmount || 0),
      cashGiven: Number(bill.cashGiven || 0),
      balance: Number(bill.balance || 0),
      cgst: Number(bill.cgst || 0),
      sgst: Number(bill.sgst || 0),
    });


    // ---- PAYMENT (EDIT MODE LOAD) ----
    setPaymentMethod(bill.paymentMethod || "cash");

    setPayment({
      cash: Number(bill.payment?.cash || 0),
      upi: Number(bill.payment?.upi || 0),
    });


    const origItems = {};
    (bill.items || []).forEach((item) => {
      const id = item._id || item.id;
      if (!id) return;
      origItems[id] = {
        code: item.code,
        batch: item.batch,
        qty: Number(item.qty) || 0,
      };
    });
    setOriginalBillItems(origItems);

    setTimeout(() => {
      document
        .querySelector('input[name="customerName"]')
        ?.focus();
    }, 200);
  };

  const handleViewBill = (bill) => {
    setViewBill(bill);
  };

  // ---------- Delete whole bill (NOT cancel) ----------
  const deleteBill = async (id) => {
    try {
      const bill = bills.find((b) => b._id === id);
      if (!bill) {
        showPopup("Bill not found");
        return;
      }
      const incItems = (bill.items || []).map((it) => ({
        code: it.code,
        batchNo: it.batch || it.batchNo || "",
        qty: Number(it.qty || 0),
      }));
      if (incItems.length) {
        await axiosInstance.put(
          `/api/tenant/shops/${encodeURIComponent(
            shopname
          )}/products/increment-stock`,
          { items: incItems },
          { headers: getAuthHeaders() }
        );
      }
      await axiosInstance.delete(
        `/api/tenant/shops/${encodeURIComponent(
          shopname
        )}/master-sales-bills/${id}`,
        { headers: getAuthHeaders() }
      );
      setBills((prev) => prev.filter((b) => b._id !== id));
      showPopup("Bill deleted", "success");
    } catch (err) {
      console.error("Failed to delete bill:", err);
      showPopup("Failed to delete bill", "error");
    }
  };

  const filteredBills = useMemo(() => {
    if (!bills) return [];
    const term = (search || "").toLowerCase();
    return bills.filter((b) => {
      const name = (
        b.customerName ||
        b.meta?.customerName ||
        ""
      )
        .toString()
        .toLowerCase();
      const mobile = (
        b.mobile ||
        b.meta?.mobile ||
        ""
      )
        .toString()
        .toLowerCase();
      const billno = (b.billNo || "").toString().toLowerCase();
      return (
        name.includes(term) ||
        mobile.includes(term) ||
        billno.includes(term)
      );
    });
  }, [bills, search]);

  // ---------- Portals (code/name/batch) ----------
  const renderCodeSuggestionPortal = (rowId) => {
    if (!portalRoot) return null;
    const list = codeSuggestions[rowId] || [];
    if (!showCodeList[rowId] || list.length === 0) return null;

    const inputEl = document.querySelector(
      `input[data-row="${rowId}"][data-field="code"]`
    );
    const rect =
      inputEl?.getBoundingClientRect() || {
        top: 0,
        left: 0,
        width: 240,
        height: 24,
      };
    const style = {
      position: "fixed",
      top: rect.top + rect.height + 6,
      left: rect.left,
      minWidth: Math.max(240, rect.width),
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #ddd",
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      maxHeight: 320,
      overflowY: "auto",
      padding: "6px 0",
    };

    return (
      <div className="suggestions-portal" style={style} role="listbox">
        {list.map((p, i) => (
          <div
            key={p._id || `${p.code}-${p.name}-${i}`}
            className="suggestion"
            role="option"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectSuggestion(rowId, p);
            }}
            style={{
              padding: "8px 10px",
              cursor: "pointer",
              borderBottom: "1px solid #f4f4f4",
            }}
          >
            <div style={{ fontWeight: 700 }}>{p.code}</div>
            <div style={{ fontSize: 12 }}>{p.name}</div>
          </div>
        ))}
      </div>
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
      inputEl?.getBoundingClientRect() || {
        top: 0,
        left: 0,
        width: 240,
        height: 24,
      };
    const style = {
      position: "fixed",
      top: rect.top + rect.height + 6,
      left: rect.left,
      minWidth: Math.max(240, rect.width),
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #ddd",
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      maxHeight: 320,
      overflowY: "auto",
      padding: "6px 0",
    };

    return (
      <div className="suggestions-portal" style={style} role="listbox">
        {list.map((p, i) => (
          <div
            key={p._id || `${p.code}-${p.name}-${i}`}
            className="suggestion"
            role="option"
            onMouseDown={(e) => {
              e.preventDefault();
              handleSelectSuggestion(rowId, p);
            }}
            style={{
              padding: "8px 10px",
              cursor: "pointer",
              borderBottom: "1px solid #f4f4f4",
            }}
          >
            <div style={{ fontWeight: 700 }}>{p.name}</div>
            <div style={{ fontSize: 12 }}>{p.code}</div>
          </div>
        ))}
      </div>
    );
  };

  const renderBatchPortal = (rowId) => {
    if (!portalRoot) return null;
    const list = batchesByRow[rowId] || [];
    if (!showBatchList[rowId] || list.length === 0) return null;

    const inputEl = document.querySelector(
      `input[data-row="${rowId}"][data-field="batch"]`
    );
    const rect =
      inputEl?.getBoundingClientRect() || {
        top: 0,
        left: 0,
        width: 300,
        height: 24,
      };

    const style = {
      position: "fixed",
      top: rect.top + rect.height + 6,
      left: rect.left,
      minWidth: Math.max(480, rect.width),
      zIndex: 9999,
      background: "#fff",
      border: "1px solid #eee",
      boxShadow: "0 6px 18px rgba(0,0,0,0.08)",
      maxHeight: 320,
      overflowY: "auto",
      padding: 8,
    };

    const currentRow = rows.find((r) => r.id === rowId);
    const productCode = currentRow?.code;

    return (
      <div className="batch-portal" style={style}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead>
            <tr style={{ background: "#fafafa", fontSize: 13 }}>
              <th style={{ padding: 6, textAlign: "left" }}>Batch</th>
              <th style={{ padding: 6, textAlign: "left" }}>MRP</th>
              <th style={{ padding: 6, textAlign: "left" }}>Rate</th>
              <th style={{ padding: 6, textAlign: "left" }}>GST%</th>
              <th style={{ padding: 6, textAlign: "right" }}>
                Stock (DB)
              </th>
            </tr>
          </thead>
          <tbody>
            {list.map((b, i) => {
              const nb = {
                batchNo: b.batchNo || "",
                mrp: Number(b.mrp || 0),
                rate: Number(b.salePrice || b.rate || 0),
                gst: Number(b.gst || 0),
                qty: Number(b.qty || 0),
                taxMode: b.taxMode,
                isInclusive: b.isInclusive,
              };

              const available = getBatchDbStock(productCode, nb.batchNo);

              return (
                <tr
                  key={`${nb.batchNo}-${i}`}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    handleBatchPick(rowId, nb);
                  }}
                  style={{
                    cursor: "pointer",
                    borderBottom: "1px solid #f4f4f4",
                    background:
                      available <= 0
                        ? "rgba(255,0,0,0.05)"
                        : "transparent",
                  }}
                >
                  <td style={{ padding: 6, fontWeight: 600 }}>
                    {nb.batchNo || "(no batch)"}
                  </td>
                  <td style={{ padding: 6 }}>{nb.mrp.toFixed(2)}</td>
                  <td style={{ padding: 6 }}>{nb.rate.toFixed(2)}</td>
                  <td style={{ padding: 6 }}>{nb.gst}%</td>
                  <td
                    style={{
                      padding: 6,
                      textAlign: "right",
                      color: available <= 0 ? "red" : "inherit",
                      fontWeight: available <= 0 ? 600 : 400,
                    }}
                  >
                    {available}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    );
  };

  const handleSuggestionKey = (e, rowId, field) => {
    const key = e.key;
    const list =
      field === "code"
        ? codeSuggestions[rowId] || []
        : nameSuggestions[rowId] || [];

    suggestionRefs.current[rowId] =
      suggestionRefs.current[rowId] || {};
    const state = suggestionRefs.current[rowId][field] || { index: -1 };
    let idx = state.index;

    if (key === "ArrowDown") {
      e.preventDefault();
      idx = Math.min(list.length - 1, idx + 1);
    } else if (key === "ArrowUp") {
      e.preventDefault();
      idx = Math.max(0, idx - 1);
    } else if (key === "Enter") {
      if (idx >= 0 && list[idx]) {
        e.preventDefault();
        handleSelectSuggestion(rowId, list[idx]);
        suggestionRefs.current[rowId][field] = { index: -1 };
      }
      return;
    } else if (key === "Escape") {
      setShowCodeList((s) => ({ ...s, [rowId]: false }));
      setShowNameList((s) => ({ ...s, [rowId]: false }));
      suggestionRefs.current[rowId][field] = { index: -1 };
      return;
    } else {
      suggestionRefs.current[rowId][field] = { index: -1 };
      return;
    }
    suggestionRefs.current[rowId][field] = { index: idx };
  };

  const preventWheel = (e) => {
    if (
      document.activeElement &&
      document.activeElement.type === "number"
    ) {
      e.preventDefault();
    }
  };
  const enableWheelBlock = () =>
    document?.addEventListener("wheel", preventWheel, { passive: false });
  const disableWheelBlock = () =>
    document?.removeEventListener("wheel", preventWheel);
  useEffect(() => {
    enableWheelBlock();
    return () => disableWheelBlock();
  }, []);

  const numberInputProps = { onWheel: (e) => e.target.blur() };

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

  // ---------- Render ----------
  return (
    <div className="salesbill-container pt-10 sm:pt-10">
      {popup.message && (
        <div
          className="popup-message"
          style={{
            display: "inline-block",
            padding: "10px 14px",
            borderRadius: 8,
            color:
              popup.type === "success" ? "#065f46" : "#7f1d1d",
            backgroundColor:
              popup.type === "success" ? "#d1fae5" : "#fee2e2",
            border:
              popup.type === "success"
                ? "1px solid #10b981"
                : "1px solid #ef4444",
            boxShadow: "0 6px 18px rgba(2,6,23,0.06)",
            fontWeight: 600,
            marginBottom: "12px",
          }}
        >
          {popup.message}
        </div>
      )}

      <div className="salesbill-header">
        <div>
          <h1 className="salesbill-title">Sales Bill</h1>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center p-4 space-x-3 space-y-3 lg:space-y-0 lg:space-x-3">
        <div className="flex min-w-[360px]">
          <input
            type="text"
            placeholder="Search: Bill No / Customer / Mobile "
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px] h-8 text-sm border rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-[#007867] transition placeholder-gray-400"
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

      {/* Bills table */}
      <div className="salesbill-table-wrapper overflow-x-auto bg-white rounded-lg shadow p-4">
        {loading ? (
          <p className="text-gray-400 text-center py-4">Loading…</p>
        ) : bills.length === 0 ? (
          <p className="text-gray-400 text-center py-4">
            No records found
          </p>
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
                {filteredBills.map((bill, i) => (
                  <tr
                    key={bill._id}
                    className="hover:bg-green-80 transition-colors"
                  >
                    <td className="px-4 py-2">
                      {(page - 1) * limit + i + 1}
                    </td>
                    <td className="px-4 py-2">
                      Counter - {bill.counter || "-"}
                    </td>
                    <td className="px-4 py-2">{bill.billNo}</td>
                    <td className="px-4 py-2">
                      {formatDate(bill.date)}
                    </td>
                    <td className="px-4 py-2">
                      {bill.customerName}
                    </td>
                    <td className="px-4 py-2">
                      {bill.mobile || "-"}
                    </td>
                    {/* <td className="px-4 py-2">
                      {bill.status || "active"}
                    </td> */}

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
                        <button
                          onClick={() => {
                            setViewBill(bill);
                            setShowViewModal(true);
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
                          onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "#007867")
                          }
                          onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "#00A76F")
                          }
                        >
                          <FaEye />
                        </button>

                        <button
                          onClick={() => handleEditBill(bill)}
                          title="Edit"
                          style={{
                            border: "none",
                            backgroundColor: "orange",
                            color: "#fff",
                            padding: "0.5rem 0.75rem",
                            borderRadius: "0.5rem",
                            cursor: "pointer",
                            transition: "all 0.3s ease",
                          }}
                          onMouseEnter={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "#cc8400")
                          }
                          onMouseLeave={(e) =>
                          (e.currentTarget.style.backgroundColor =
                            "orange")
                          }
                        >
                          <FaEdit />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            <div className="mt-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={(p) => {
                  if (p === page) return;
                  setPage(p);
                }}
              />
            </div>
          </>
        )}
      </div>

      {/* ---------- Edit Bill Modal ---------- */}
      {showModal && (
        <div className="modal fade-in">
          <div className="modal-content slide-up large relative">
            {/* {saving && (
              <div className="absolute inset-0 z-[999] flex items-center justify-center bg-white/70 backdrop-blur-sm rounded-xl">
                <div className="flex flex-col items-center gap-3 text-center">

                  <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>

                  <span className="text-green-700 font-semibold text-base">
                    Saving Bill...
                  </span>

                </div>
              </div>
            )} */}

            {saving && (
              <div className="absolute inset-0 z-[999] flex items-center justify-center pointer-events-none">
                <div className="flex flex-col items-center gap-3 text-center">
                  <div className="w-10 h-10 border-4 border-green-700 border-t-transparent rounded-full animate-spin"></div>

                  <span className="text-green-700 font-semibold text-base">
                    Saving Bill...
                  </span>
                </div>
              </div>
            )}




            <div className={`${saving ? "pointer-events-none opacity-60" : ""}`}>
              <div className="modal-header">
                <h2>Edit Bill</h2>
                <button
                  className="icon-close"
                  onClick={() => {
                    setEditRowId(null);
                    setShowModal(false);
                    setBillEditMode(false);
                    setEditingBillId(null);
                  }}
                >
                  ×
                </button>
              </div>

              {/* Meta */}
              <form className="bill-meta">
                <div className="meta-grid">
                  <label>
                    Counter:
                    <input
                      type="text"
                      value={meta.counter || ""}
                      readOnly
                      style={{ background: "#f8f8f8", width: "150px" }}
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1"
                    />
                  </label>

                  <label>
                    Bill No:
                    <input
                      type="text"
                      value={meta.billNo || ""}
                      readOnly
                      style={{ background: "#f8f8f8", width: "150px" }}
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1"
                    />
                  </label>

                  <label>
                    Date
                    <input
                      type="date"
                      value={meta.date}
                      readOnly
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1"
                    />
                  </label>

                  <label style={{ flex: "2" }}>
                    Customer Name
                    <input
                      value={meta.customerName}
                      onKeyDown={handleEnterKey}
                      onChange={(e) =>
                        setMeta({
                          ...meta,
                          customerName: e.target.value,
                        })
                      }
                      placeholder="Enter a Customer Name"
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1"
                    />
                  </label>

                  <label>
                    Mobile
                    <input
                      type="text"
                      value={meta.mobile}
                      maxLength={10}
                      onKeyDown={handleEnterKey}
                      onChange={(e) => {
                        let value = e.target.value.replace(/\D/g, "");
                        if (value.length > 10)
                          value = value.slice(0, 10);
                        setMeta({ ...meta, mobile: value });
                      }}
                      placeholder="Enter a Mobile number"
                      className="!w-[200px] !md:w-[300px] h-8 text-sm border border-gray-300 rounded-md px-2 py-1"
                    />
                  </label>
                </div>
              </form>

              {/* Items Table */}
              <table
                className="salesbill-table clean full-width"
                style={{ tableLayout: "fixed" }}
              >
                <thead>
                  <tr>
                    <th style={{ width: "50px" }}>S.No</th>
                    <th style={{ width: "140px" }}>Product Code</th>
                    <th style={{ width: "190px" }}>Product Name</th>
                    <th style={{ width: "200px" }}>Batch</th>
                    <th style={{ width: "100px" }}>MRP</th>
                    <th style={{ width: "90px" }}>Rate</th>
                    <th style={{ width: "80px" }}>GST%</th>
                    <th style={{ width: "80px" }}>Qty</th>
                    <th style={{ width: "120px" }}>Value</th>
                    <th style={{ width: "90px" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, index) => (
                    <React.Fragment key={row.id}>
                      <tr>
                        <td>{index + 1}</td>

                        <td className="relative">
                          <input
                            data-row={row.id}
                            data-field="code"
                            value={row.code || ""}
                            onKeyDown={(e) => {
                              handleSuggestionKey(e, row.id, "code");
                              handleEnterKey(e);
                            }}
                            disabled
                            readOnly
                            placeholder="Code"
                          />
                          {showCodeList[row.id] &&
                            (codeSuggestions[row.id] || [])
                              .length > 0 &&
                            renderCodeSuggestionPortal(row.id)}
                        </td>

                        <td className="relative">
                          <input
                            data-row={row.id}
                            data-field="name"
                            value={row.name || ""}
                            onKeyDown={(e) => {
                              handleSuggestionKey(e, row.id, "name");
                              handleEnterKey(e);
                            }}
                            disabled
                            readOnly
                            placeholder="Product"
                          />
                          {showNameList[row.id] &&
                            (nameSuggestions[row.id] || [])
                              .length > 0 &&
                            renderNameSuggestionPortal(row.id)}
                        </td>

                        <td className="relative">
                          <input
                            className="input"
                            data-row={row.id}
                            data-field="batch"
                            placeholder="Batch"
                            readOnly
                            value={row.batch}
                            disabled
                          />
                          {Array.isArray(batchesByRow[row.id]) &&
                            batchesByRow[row.id].length > 0 &&
                            showBatchList[row.id] &&
                            renderBatchPortal(row.id)}
                        </td>

                        <td>
                          <input
                            type="number"
                            {...numberInputProps}
                            value={row.mrp || 0}
                            readOnly
                            disabled
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            {...numberInputProps}
                            value={row.rate || 0}
                            readOnly
                            disabled
                          />
                        </td>

                        <td>
                          <input
                            type="number"
                            {...numberInputProps}
                            value={row.gst || 0}
                            readOnly
                            disabled
                          />
                        </td>

                        {/* QTY – always editable in EDIT mode */}
                        <td>
                          <input
                            type="number"
                            {...numberInputProps}
                            data-row={row.id}
                            data-field="qty"
                            value={row.qty || ""}
                            onKeyDown={(e) => handleQtyKeyDown(e, row)}
                            onChange={(e) => handleQtyChange(e, row)}
                          />
                        </td>

                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 600,
                          }}
                        >
                          {Number(row.value || 0).toFixed(2)}
                        </td>

                        <td className="row-actions">
                          {row.isNew ? (
                            <button
                              onClick={() => addRow(row.id)}
                              className="plus"
                            >
                              <FaPlus />
                            </button>
                          ) : (
                            <>
                              <button
                                onClick={() => deleteRow(row.id)}
                                className="danger"
                              >
                                <FaTrash />
                              </button>

                              {/* <button
  onClick={() => markRowCancelled(row.id)}
  className="danger"
  title="Cancel Item"
>
  <FaTrash />
</button> */}

                            </>
                          )}
                        </td>
                      </tr>

                      {stockErrors[row.id] && (
                        <tr>
                          <td
                            colSpan="10"
                            style={{
                              color: "red",
                              fontSize: 13,
                            }}
                          >
                            ❌ {stockErrors[row.id]}
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))}
                </tbody>
              </table>

              {/* Totals / Bill Summary */}
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
                {/* Left - GST summary */}
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

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>CGST</span>
                    <strong>
                      {Number(totals.cgst || 0).toFixed(2)}
                    </strong>
                  </div>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>SGST</span>
                    <strong>
                      {Number(totals.sgst || 0).toFixed(2)}
                    </strong>
                  </div>

                  <hr style={{ border: "0.5px solid #ddd" }} />

                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                    }}
                  >
                    <span>GST</span>
                    <strong >{(Number(totals.cgst || 0) + Number(totals.sgst || 0)).toFixed(2)}</strong>
                  </div>

                  {(() => {
                    const gstSummary = {};

                    rows.forEach((r) => {
                      const gstRate = Number(r.gst || 0);
                      if (gstRate <= 0) return;

                      const rate = Number(r.rate || 0);
                      const qty = Number(r.qty || 0);
                      if (qty <= 0 || rate <= 0) return;

                      let taxable = 0;
                      let gstAmt = 0;

                      if (r.isInclusive) {
                        const gross = rate * qty;
                        taxable = +(
                          gross /
                          (1 + gstRate / 100)
                        ).toFixed(2);
                        gstAmt = +(gross - taxable).toFixed(2);
                      } else {
                        taxable = +(rate * qty).toFixed(2);
                        gstAmt = +(
                          (taxable * gstRate) /
                          100
                        ).toFixed(2);
                      }

                      gstSummary[gstRate] =
                        (gstSummary[gstRate] || 0) + gstAmt;
                    });

                    const sortedRates = Object.keys(gstSummary)
                      .map(Number)
                      .sort((a, b) => a - b);

                    return sortedRates.map((rate, idx) => (
                      <div
                        key={idx}
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                        }}
                      >
                        <span>{rate.toFixed(2)}%</span>
                        <strong>
                          {gstSummary[rate].toFixed(2)}
                        </strong>
                      </div>
                    ));
                  })()}
                </div>

                {/* Right - Totals */}
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
                    <span
                      style={{
                        fontWeight: 300,
                        minWidth: "100px",
                      }}
                    >
                      Total
                    </span>
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

                  {/* DISCOUNT (% + value) */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      gap: "10px",
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 300,
                        minWidth: "100px",
                      }}
                    >
                      Discount
                    </span>

                    <input
                      type="number"
                      placeholder="%"
                      value={totals.discountPercent || ""}
                      onChange={(e) => {
                        const perc = Number(e.target.value) || 0;
                        const amt = (
                          (Number(totals.total) * perc) /
                          100
                        ).toFixed(2);
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

                    <input
                      type="number"
                      placeholder="₹"
                      value={
                        totals.discount === 0
                          ? ""
                          : totals.discount
                      }
                      onChange={(e) => {
                        const val = Number(e.target.value) || 0;
                        const perc =
                          totals.total > 0
                            ? (
                              (val / totals.total) *
                              100
                            ).toFixed(2)
                            : 0;
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
                    <span
                      style={{
                        fontWeight: 300,
                        minWidth: "100px",
                      }}
                    >
                      Net Amount
                    </span>
                    <input
                      type="number"
                      readOnly
                      value={Number(
                        totals.netAmount || 0
                      ).toFixed(2)}
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
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>
                      Cash Given
                    </span>

                    <input
                      type="number"
                      value={totals.cashGiven === 0 ? "" : totals.cashGiven}
                      onChange={(e) => {
                        const cashGiven = Number(e.target.value) || 0;
                        const net = Number(totals.netAmount || 0);

                        setHasCashInput(e.target.value !== "");

                        // 🔥 Cap cash payment to net amount
                        const cashPay = Math.min(cashGiven, net);

                        // 🔥 Update totals
                        setTotals((prev) => ({
                          ...prev,
                          cashGiven,
                          balance: cashGiven - net,
                        }));

                        // 🔥 Sync payment like USER ADD SALE
                        setPayment({
                          cash: cashPay,
                          upi: 0,
                        });

                        setPaymentMethod("cash");
                      }}
                      onBlur={(e) => {
                        if (e.target.value === "") {
                          setTotals((prev) => ({
                            ...prev,
                            cashGiven: 0,
                          }));
                          setHasCashInput(false);
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

                  {/* BALANCE */}
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                    }}
                  >
                    <span style={{ fontWeight: 300, minWidth: "100px" }}>
                      Balance
                    </span>

                    <input
                      type="number"
                      readOnly
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



              {/* ---------------- Payment Method (EDIT MODE) ---------------- */}
              <div
                className="mt-4 p-4 rounded-lg bg-[#eef8f3]
             transform transition-all duration-300
             animate-[fadeUp_0.4s_ease-out]
             hover:shadow-lg"
              >

                <div className="flex items-center justify-between gap-6">

                  {/* LEFT SIDE */}
                  <div className="flex flex-col gap-4">

                    {/* HEADER */}
                    <label className="font-semibold flex items-center gap-2 text-sm">
                      <FaExchangeAlt className="text-green-700" />
                      Payment Method
                    </label>

                    {/* CASH + UPI */}
                    <div className="flex gap-8">

                      {/* ================= CASH ================= */}
                      <div className="flex flex-col gap-2 w-40">

                        {/* HIDDEN CHECKBOX */}
                        <input
                          type="checkbox"
                          checked={payCash}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPayCash(checked);

                            if (!checked) setPayUpi(true);

                            syncPayment(
                              checked,
                              payUpi || !checked,
                              payment.cash
                            );
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

                              syncPayment(
                                checked,
                                payUpi || !checked,
                                payment.cash
                              );
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
                          className="w-full p-2 rounded-md border text-sm text-right
                       disabled:bg-gray-100"
                        />

                        {/* CASH DISPLAY */}
                        <div className="text-xs text-gray-700 text-right">
                          Cash: ₹{payment.cash.toFixed(2)}
                        </div>
                      </div>

                      {/* ================= UPI ================= */}
                      <div className="flex flex-col gap-2 w-40">

                        {/* HIDDEN CHECKBOX */}
                        <input
                          type="checkbox"
                          checked={payUpi}
                          onChange={(e) => {
                            const checked = e.target.checked;
                            setPayUpi(checked);

                            if (!checked) setPayCash(true);

                            syncPayment(
                              payCash || !checked,
                              checked,
                              payment.cash
                            );
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

                              syncPayment(
                                payCash || !checked,
                                checked,
                                payment.cash
                              );
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
                            syncPayment(
                              payCash,
                              true,
                              totals.netAmount - entered
                            );
                          }}
                          onWheel={(e) => e.target.blur()}
                          disabled={!payUpi}
                          placeholder="UPI Amount"
                          className="w-full p-2 rounded-md border text-sm text-right
                       disabled:bg-gray-100"
                        />

                        {/* UPI DISPLAY */}
                        <div className="text-xs text-gray-700 text-right">
                          UPI: ₹{payment.upi.toFixed(2)}
                        </div>
                      </div>

                    </div>
                  </div>

                  {/* RIGHT SIDE — SAVE */}
                  {/* <button
                  type="button"
                  className="bg-green-700 text-white px-4 py-2 rounded-md text-sm
                 hover:bg-green-800 transition-all duration-200
                 hover:scale-110 shadow-md"
                  onClick={handleSaveAndPrint}
                >
                  Save
                </button> */}

                  <button
                    type="button"
                    onClick={handleSaveAndPrint}
                    disabled={saving}
                    className={`px-4 py-2 rounded-md text-sm flex items-center gap-2
    bg-green-700 text-white shadow-md transition-all duration-200
    ${saving
                        ? "opacity-50 cursor-not-allowed"
                        : "hover:bg-green-800 hover:scale-110"
                      }
  `}
                  >
                    {saving && (
                      <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin"></span>
                    )}

                    {saving ? "Saving..." : "Save"}
                  </button>


                </div>
              </div>

            </div>
          </div>
        </div>
      )}

      {/* VIEW-ONLY MODAL */}
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
          rows={viewBill.items}
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
          bill={viewBill}

          paymentMethod={viewBill.paymentMethod}
          payment={viewBill.payment}
          selectedShop={selectedShop}
          titlePrefix="View Bill"
        />
      )}
    </div>
  );
}






















