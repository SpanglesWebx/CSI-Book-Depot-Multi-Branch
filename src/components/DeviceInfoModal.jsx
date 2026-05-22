import React, { useEffect } from "react";
import { FaTimes, FaDesktop } from "react-icons/fa";

export default function DeviceInfoModal({ show, onClose, bill }) {
    // ⭐ LOCK / UNLOCK SCROLL
    useEffect(() => {
        if (show) {
            document.body.style.overflow = "hidden";
        } else {
            document.body.style.overflow = "";
        }

        // cleanup (important)
        return () => {
            document.body.style.overflow = "";
        };
    }, [show]);

    if (!show || !bill) return null;

    const kv = (label, value) => (
        <div
            style={{
                display: "flex",
                justifyContent: "space-between",
                padding: "6px 0",
                borderBottom: "1px solid #eee",
                fontSize: 14,
            }}
        >
            <span style={{ color: "#666" }}>{label}</span>
            <strong>{value || "-"}</strong>
        </div>
    );

    return (
        <div
            className="modal fade-in"
            role="dialog"
            aria-modal="true"
            onWheel={(e) => e.stopPropagation()}
            onTouchMove={(e) => e.stopPropagation()}
            style={{
                position: "fixed",
                inset: 0,
                background: "rgba(0,0,0,0.35)",
                zIndex: 9999,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
            }}
        >
            <div
                className="modal-content"
                style={{
                    maxWidth: 420,
                    width: "100%",
                    padding: "1rem",
                    borderRadius: "12px",
                    background: "#fff",
                }}
            >
                {/* HEADER */}
                <div
                    style={{
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                        marginBottom: 12,
                    }}
                >
                    <h3
                        style={{
                            margin: 0,
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                        }}
                    >
                        <FaDesktop color="#007867" />
                        Device & User Info
                    </h3>

                    <button
                        onClick={onClose}
                        style={{
                            border: "none",
                            background: "transparent",
                            fontSize: 20,
                            cursor: "pointer",
                        }}
                    >
                        <FaTimes />
                    </button>
                </div>

                {/* SUB HEADING */}
                <div
                    style={{
                        fontSize: 13,
                        color: "#007867",
                        marginBottom: 10,
                        fontWeight: 600,
                    }}
                >
                    Bill No: {bill.billNo}
                </div>

                {/* KEY VALUE DATA */}
                {kv("Mac Address", bill.deviceInfo?.mac)}
                {kv("Created Name", bill.createdBy)}
                {kv("Counter", bill.counter)}
            </div>
        </div>
    );
}
