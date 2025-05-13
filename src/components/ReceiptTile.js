import React, { useState } from "react";
import "../styles/receiptTile.css"; // ✅ make sure you import your CSS

const categoryColors = {
    groceries: "#d4edda",
    gas: "#d1ecf1",
    furniture: "#fff3cd"
};

const ReceiptTile = ({ receipt, isSupervisor, refreshReceipts }) => {
    const [expanded, setExpanded] = useState(false);
    const [items, setItems] = useState([]);
    const [userName, setUserName] = useState("");
    const [localStatus, setLocalStatus] = useState(receipt.status);

    const toggleExpand = async () => {
        if (!expanded) {
            try {
                const res = await fetch(`http://127.0.0.1:5000/receipt-details/${receipt.id}`, {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}`
                    }
                });
                if (res.ok) {
                    const data = await res.json();
                    setItems(data.items);
                    setUserName(data.user_name);
                } else {
                    console.error("Failed to fetch receipt details");
                }
            } catch (error) {
                console.error("Error fetching receipt details:", error);
            }
        }
        setExpanded(!expanded);
    };

    const handleUpdateStatus = async (status) => {
        try {
            const res = await fetch(`http://127.0.0.1:5000/update-receipt-status/${receipt.id}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ status })
            });

            if (res.ok) {
                setLocalStatus(status);
                refreshReceipts();
            } else {
                console.error("Failed to update receipt status");
            }
        } catch (error) {
            console.error("Error updating receipt status:", error);
        }
    };

    const formattedDate = new Date(receipt.uploadDate).toLocaleDateString("en-US", {
        year: "numeric",
        month: "short",
        day: "numeric",
    });

    const color = (localStatus === "Rejected")
        ? "#cccccc"
        : (categoryColors[receipt.category.toLowerCase()] || "#f8f9fa");

    return (
        <div 
            className={`receipt-tile ${expanded ? "expanded" : "collapsed"}`}
            style={{ backgroundColor: color, cursor: "pointer" }}
            onClick={toggleExpand}
        >
            <div className="receipt-header">
                <span className="receipt-id">#{receipt.id}</span>
                <span className="receipt-date">{formattedDate}</span>
            </div>
            <div className="receipt-store">
                <strong>{receipt.storeName}</strong>
            </div>
            <div className="receipt-amount">
                <span>${receipt.amount}</span>
            </div>

            <div className="receipt-details">
                {expanded && (
                    <>
                        <p><strong>Submitted by:</strong> {userName}</p>
                        <p><strong>Date:</strong> {formattedDate}</p>
                        <h4>Items:</h4>
                        <ul>
                            {items.map((item, index) => (
                                <li key={index}>
                                    {item.item_name}: ${item.amount}
                                </li>
                            ))}
                        </ul>

                        {isSupervisor && localStatus === "Pending" && (
                            <div className="buttons-container">
                                <button className="accept-button" onClick={(e) => { e.stopPropagation(); handleUpdateStatus("Approved"); }}>Accept</button>
                                <button className="reject-button" onClick={(e) => { e.stopPropagation(); handleUpdateStatus("Rejected"); }}>Reject</button>
                            </div>
                        )}
                    </>
                )}
            </div>

            {localStorage.getItem("role") === "admin" && (
                <button
                    className="delete-button"
                    onClick={async () => {
                        if (window.confirm("Are you sure you want to delete this receipt?")) {
                            try {
                                const response = await fetch(`http://127.0.0.1:5000/delete-receipt/${receipt.id}`, {
                                    method: "DELETE",
                                    headers: {
                                        "Authorization": `Bearer ${localStorage.getItem("token")}`
                                    }
                                });

                                if (response.ok) {
                                    alert("Receipt deleted.");
                                    refreshReceipts();  // Trigger re-fetch
                                } else {
                                    alert("Failed to delete receipt.");
                                }
                            } catch (err) {
                                console.error("Delete failed", err);
                                alert("Error deleting receipt.");
                            }
                        }
                    }}
                >
                    🗑 Delete
                </button>
            )}



        </div>
    );
};

export default ReceiptTile;
