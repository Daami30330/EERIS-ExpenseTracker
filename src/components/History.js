import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import Plot from "react-plotly.js";
import "../styles/history.css";
import ReceiptTile from "./ReceiptTile";

const categoryColors = {
    groceries: "#d4edda",
    gas: "#d1ecf1",
    furniture: "#fff3cd"
};
const categoryColorsPie = {
    groceries: "#8bc34a",
    gas: "#03a9f4",
    furniture: "#ff9800"
};

const History = () => {
    const [receipts, setReceipts] = useState([]);
    const [categoryData, setCategoryData] = useState(null);
    const [storeData, setStoreData] = useState(null);
    const [storeCategories, setStoreCategories] = useState(null);
    const [userTotals, setUserTotals] = useState(null);
    const [approvalData, setApprovalData] = useState([]);
    const [isSupervisor, setIsSupervisor] = useState(false);

    const navigate = useNavigate();

    const fetchReceipts = async () => {
        try {
            const response = await fetch("http://127.0.0.1:5000/fetch-receipts", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setReceipts(data.receipts);
                setIsSupervisor(data.role === "supervisor" || data.role === "admin");
                if (data.user_totals) {
                    setUserTotals(data.user_totals);
                }
            } else {
                console.error("Failed to fetch receipts");
            }
        } catch (error) {
            console.error("Error fetching receipts:", error);
        }
    };

    useEffect(() => {
        const fetchStatistics = async () => {
            try {
                const response = await fetch("http://127.0.0.1:5000/statistics", {
                    method: "GET",
                    headers: {
                        "Content-Type": "application/json",
                        "Authorization": `Bearer ${localStorage.getItem("token")}`
                    }
                });

                if (response.ok) {
                    const data = await response.json();
                    setCategoryData(data.category_totals);
                    if (data.store_totals) {
                        setStoreData(data.store_totals);
                        setStoreCategories(data.store_main_categories);
                        if (data.user_totals) {
                            setUserTotals(data.user_totals);
                        }
                    }
                    const total = (data.approvals || 0) + (data.rejections || 0) + (data.pending || 0);

                    const approvalStats = [
                        { status: "Approved", count: data.approvals || 0, percent: total ? (data.approvals / total) * 100 : 0 },
                        { status: "Rejected", count: data.rejections || 0, percent: total ? (data.rejections / total) * 100 : 0 },
                        { status: "Pending", count: data.pending || 0, percent: total ? (data.pending / total) * 100 : 0 }
                    ];

                    setApprovalData(approvalStats);
                } else {
                    console.error("Failed to fetch statistics");
                }
            } catch (error) {
                console.error("Error fetching statistics:", error);
            }
        };

        fetchReceipts();
        fetchStatistics();
    }, []);

    return (
        <div>
            <div className="history-container">
                <div className="history-left">
                    <h2>Previous Uploads</h2>
                    <div className="receipts-listt">
                        {receipts.length > 0 ? (
                            receipts.map((receipt) => (
                                <ReceiptTile
                                    key={receipt.id}
                                    receipt={receipt}
                                    isSupervisor={isSupervisor}
                                    refreshReceipts={fetchReceipts}
                                />
                            ))
                        ) : (
                            <p>No receipts found.</p>
                        )}
                    </div>
                </div>
                <div className="history-right">
                    <h2>Statistics</h2>

                    {categoryData && (
                        <Plot
                            data={[{
                                type: 'pie',
                                labels: Object.keys(categoryData),
                                values: Object.values(categoryData),
                                hole: 0.3,
                                marker: {
                                    colors: Object.keys(categoryData).map(category =>
                                        categoryColorsPie[category.toLowerCase()] || "#c0c0c0"
                                    ),
                                    line: { color: 'black', width: 2 }
                                },
                                hoverinfo: 'label+percent+value'
                            }]}
                            layout={{
                                title: 'Spending by Category',
                                margin: { t: 50, l: 10, r: 10, b: 10 },
                                autosize: true,
                                legend: { orientation: "h", y: -0.2 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                plot_bgcolor: "rgba(0,0,0,0)"
                            }}
                            useResizeHandler
                            style={{ width: "100%", height: "300px" }}
                            config={{ displayModeBar: false }}
                        />
                    )}

                    {storeData && storeCategories && (
                        <Plot
                            data={[{
                                type: 'bar',
                                x: Object.keys(storeData),
                                y: Object.values(storeData),
                                marker: {
                                    color: Object.keys(storeData).map(store =>
                                        categoryColorsPie[storeCategories[store]?.toLowerCase() || "unknown"] || "#c0c0c0"
                                    ),
                                    line: { color: 'black', width: 2 }
                                }
                            }]}
                            layout={{
                                title: 'Total Spendings by Store',
                                margin: { t: 50, l: 30, r: 10, b: 50 },
                                autosize: true,
                                xaxis: { title: "Stores", tickangle: -45, automargin: true },
                                yaxis: { title: "Amount ($)" },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                plot_bgcolor: "rgba(0,0,0,0)",
                                bargap: 0.3
                            }}
                            useResizeHandler
                            style={{ width: "100%", height: "300px" }}
                            config={{ displayModeBar: false }}
                        />
                    )}

                    {userTotals && (
                        <Plot
                            data={[{
                                type: 'pie',
                                labels: Object.keys(userTotals),
                                values: Object.values(userTotals),
                                textinfo: "label+percent",
                                insidetextorientation: "radial",
                                marker: { line: { color: 'black', width: 2 } }
                            }]}
                            layout={{
                                title: 'Spending by Category',
                                margin: { t: 50, l: 10, r: 10, b: 10 },
                                autosize: true,
                                legend: { orientation: "h", y: -0.2 },
                                paper_bgcolor: "rgba(0,0,0,0)",
                                plot_bgcolor: "rgba(0,0,0,0)"
                            }}
                            useResizeHandler
                            style={{ width: "100%", height: "300px" }}
                            config={{ displayModeBar: false }}
                        />
                    )}

                    {approvalData && approvalData.length > 0 && (
                        <Plot
                            data={[{
                                type: "bar",
                                x: approvalData.map(d => d.status),
                                y: approvalData.map(d => d.count),
                                marker: {
                                    color: approvalData.map(d => {
                                        if (d.status === "Approved") return "#4caf50";
                                        if (d.status === "Rejected") return "#f44336";
                                        return "#ffeb3b";
                                    }),
                                    line: { color: 'black', width: 2 }
                                },
                                text: approvalData.map(d => `${d.percent.toFixed(1)}%`),
                                textposition: "inside",
                                insidetextanchor: "middle",
                                hoverinfo: "text+y",
                                opacity: 0.9
                            }]}
                            layout={{
                                title: "Receipt Status Breakdown",
                                margin: { t: 50, l: 30, r: 10, b: 50 },
                                autosize: true,
                                xaxis: {
                                    title: "",
                                    tickvals: approvalData.map(d => d.status),
                                    ticktext: approvalData.map(d => `${d.status}\n${d.percent.toFixed(1)}%`),
                                    tickangle: 0,
                                    automargin: true
                                },
                                yaxis: { title: "Count" },
                                bargap: 0.4,
                                paper_bgcolor: "rgba(0,0,0,0)",
                                plot_bgcolor: "rgba(0,0,0,0)"
                            }}
                            useResizeHandler
                            style={{ width: "100%", height: "300px" }}
                            config={{ displayModeBar: false }}
                        />
                    )}

                </div>
            </div>
            <button onClick={() => navigate("/main")} className="input-field previous-uploads-button">
                Go to upload page
            </button>
        </div>
    );
};

export default History;
