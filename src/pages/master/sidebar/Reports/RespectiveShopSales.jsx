import React, { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { useAuth } from "../../../../context/AuthContext";
import Pagination from "../../../../components/Pagination";
import ViewOnlySaleModal from "../../../../components/ViewOnlySaleModal";
import { FaEye, FaCheckCircle, FaTimesCircle } from "react-icons/fa";



const API = import.meta.env.VITE_API_URL;

export default function RespectiveShopSales() {
  const { shopname } = useParams();        // ← get shop name from URL
  const navigate = useNavigate();
  const { getToken, user } = useAuth();

  // Page State
  const [bills, setBills] = useState([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");

  const [counterFilter, setCounterFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");

  // Pagination
  const [page, setPage] = useState(1);
  const [limit] = useState(10);
  const [totalPages, setTotalPages] = useState(1);

  // View Modal
  const [showViewModal, setShowViewModal] = useState(false);
  const [viewBill, setViewBill] = useState(null);

  // Date Formatter
  const formatDate = (d) =>
    new Date(d).toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });

  //   // Fetch bills for selected shop

  const fetchBills = async (nextPage = page) => {
    try {
      setLoading(true);
      const token = getToken();

      const params = {
        page: nextPage,
        limit,
        search,
        filter,
        fromDate,
        toDate,
        counter: counterFilter ? String(counterFilter).trim() : "",
        statusFilter: statusFilter || "all",
      };

      const res = await axios.get(
        `${API}/api/shops/${encodeURIComponent(shopname)}/master-sales-bills`,
        { params, headers: { Authorization: `Bearer ${token}` } }
      );

      setBills(res.data?.salesBills || []);
      setTotalPages(res.data?.totalPages || 1);
      setPage(nextPage);
    } catch (err) {
      console.error("Error fetching bills:", err);
    } finally {
      setLoading(false);
    }
  };


  // On first load
  useEffect(() => {
    fetchBills(1);
  }, [search, filter, fromDate, toDate, counterFilter, statusFilter]);

  return (
    <div className="pt-10">

      {/* 🔙 BACK BUTTON */}
      <button
        onClick={() => navigate("/reports/sales")}
        className="mb-4 ml-4 px-4 py-2 text- "
      >
        ← Back to Sales Report
      </button>

      <div className="salesbill-header">
        <h1 className="salesbill-title">{shopname} — Sales Bills</h1>
      </div>

      {/*  Search + Filters */}
      <div className="flex flex-wrap items-center p-4 space-x-3 space-y-3 lg:space-y-0 lg:space-x-3">

        {/* SEARCH */}
        <div className="flex min-w-[360px]">
          <input
            type="text"
            placeholder="Search: Bill No / Customer / Mobile"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-[200px] h-8 text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-[#007867]"
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

        {/* FILTER */}
        <div className="flex items-center gap-2 min-w-[100px]">
          <select
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            className="w-[100px] h-8 text-sm border rounded px-2 py-1 focus:ring-2 focus:ring-[#007867]"
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
                className="w-[100px] h-8 text-sm border rounded px-1 py-1 focus:ring-2 focus:ring-[#007867]"
              />
              <span className="self-center text-sm">to</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="w-[100px] h-8 text-sm border rounded px-1 py-1 focus:ring-2 focus:ring-[#007867]"
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

      {/* 📄 TABLE */}
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
                  <th className="px-4 py-2 text-center">S.No</th>
                  <th className="px-4 py-2 text-center">Counter</th>
                  <th className="px-4 py-2 text-center">Bill No</th>
                  <th className="px-4 py-2 text-center">Date</th>
                  <th className="px-4 py-2 text-center">Customer</th>
                  <th className="px-4 py-2 text-center">Mobile</th>
                  <th className="px-4 py-2 text-center">Status</th>
                  <th className="px-4 py-2 text-right">Net Amount</th>
                  <th className="px-4 py-2 text-center">Action</th>
                </tr>
              </thead>

              <tbody>
                {bills.map((bill, i) => (
                  <tr key={bill._id} className="hover:bg-green-50">
                    <td className="px-4 py-2">
                      {(page - 1) * limit + i + 1}
                    </td>

                    <td className="px-4 py-2">Counter : {bill.counter || "-"}</td>
                    <td className="px-4 py-2">{bill.billNo}</td>
                    <td className="px-4 py-2">{formatDate(bill.date)}</td>
                    <td className="px-4 py-2">{bill.customerName}</td>
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
                          padding: "0.45rem 0.55rem",  // exact match to sales reports
                          borderRadius: "0.35rem",     // same rounding
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          transition: "all 0.3s ease",
                        }}
                        onMouseEnter={(e) => (e.currentTarget.style.backgroundColor = "#007867")}
                        onMouseLeave={(e) => (e.currentTarget.style.backgroundColor = "#00A76F")}
                      >
                        <FaEye size={14} />   {/* exact icon size */}
                      </button>


                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {/* Pagination */}
            <div className="mt-3">
              <Pagination
                page={page}
                totalPages={totalPages}
                onPageChange={fetchBills}
              />
            </div>
          </>
        )}
      </div>

      {/* View Bill Modal */}
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

          titlePrefix="View Bill"
        />
      )}
    </div>
  );
}
