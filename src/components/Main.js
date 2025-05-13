import React, { useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/styles.css";
import jsPDF from "jspdf";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { User } from "lucide-react"; // 🧩 Human Icon
import autoTable from "jspdf-autotable";
import html2canvas from "html2canvas";
import Chart from "chart.js/auto";



const categoryOptions = {
    Groceries: ["Food", "Meals", "Drinks", "Non-Food Items"],
    Gas: ["Regular", "Premium", "Diesel"],
    Furniture: ["Chairs", "Tables", "Beds"],
    Transportation: ["Flight", "Taxi", "Train"]
};

const matchCategoryCase = (category) => {
    const categoryKeys = Object.keys(categoryOptions);
    const match = categoryKeys.find(
        (key) => key.toLowerCase() === category?.toLowerCase()
    );
    return match || "";
};

const Main = () => {
    const [formData, setFormData] = useState({
        category: "Groceries",
        subcategory: "Vegetables",
        store: "",
        items: []
    });

    const [totalAmount, setTotalAmount] = useState(0.00);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
    const [showDropdown, setShowDropdown] = useState(false); 
    const navigate = useNavigate();

    const handleSubmit = async (e) => {
        e.preventDefault();
        console.log(formData);
        try {
            const response = await fetch("http://127.0.0.1:5000/manual-receipt", {
                method: "POST",
                headers: { 
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify(formData)
            });
    
            if (response.ok) {
                toast.success("Expense submitted successfully!");
                setTimeout(() => {
                    window.location.reload();
                }, 3000);  // 2 second pause to let toast show
            } else {
                const errorText = await response.text();
                console.log('Backend error:', errorText);
                toast.error("Error submitting expense.");
            }
        } catch (error) {
            toast.error("Failed to connect to the server.");
        }
    };
    

    const handleItemChange = (index, field, value) => {
        const newItems = [...formData.items];
        newItems[index][field] = value;
        setFormData({ ...formData, items: newItems });
    
        let newTotal = 0;
        newItems.forEach(item => {
            if (item.amount) {
                newTotal += parseFloat(item.amount) || 0;
            }
        });
        setTotalAmount(newTotal.toFixed(2));
    };

    const removeItem = (index) => {
        const newItems = [...formData.items];
        newItems.splice(index, 1);
        setFormData({ ...formData, items: newItems });
    
        let newTotal = 0;
        newItems.forEach(item => {
            if (item.amount) {
                newTotal += parseFloat(item.amount) || 0;
            }
        });
        setTotalAmount(newTotal.toFixed(2));
    };

    const addNewItem = () => {
        setFormData({ ...formData, items: [...formData.items, { name: "", amount: "" }] });
    };

    const uploadReceipt = async (file) => {
        if (!file) return;

        setUploadedImageUrl(URL.createObjectURL(file));
        setIsUploading(true);
    
        const formDataFile = new FormData();
        formDataFile.append("receipt", file);
    
        try {
            const response = await fetch("http://127.0.0.1:5000/upload-receipt", {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: formDataFile
            });
    
            const data = await response.json();
    
            if (response.ok) {
                toast.success("Receipt uploaded successfully!");
    
                const extractedItems = data.items.length > 0 
                    ? data.items.map(item => ({
                        name: item.name,
                        amount: parseFloat(item.amount).toFixed(2)
                      }))
                    : [{ name: "Extracted Item", amount: parseFloat(data.total_amount || 0).toFixed(2) }];
    
                setFormData((prevData) => ({
                    ...prevData,
                    store: data.store_name || "",
                    category: matchCategoryCase(data.category) || "Groceries",
                    items: extractedItems
                }));

                console.log("Category from backend:", data.category);
                console.log("Matched to:", matchCategoryCase(data.category));

                let newTotal = 0;
                extractedItems.forEach(item => {
                    if (item.amount) {
                        newTotal += parseFloat(item.amount) || 0;
                    }
                });
                setTotalAmount(newTotal.toFixed(2));
                setIsUploading(false);

            } else {
                toast.error("Upload failed: " + (data.error || "Unknown error"));
            }
        } catch (error) {
            console.error("Upload error:", error);
            setIsUploading(false);
            alert("Error uploading receipt.");
        }
    };

    const fetchAuditLogs = async () => {
        try {
            const role = localStorage.getItem("role");
            const endpoint = role === "admin" || role === "supervisor"
                ? "http://127.0.0.1:5000/all-expense-history"
                : "http://127.0.0.1:5000/user-expense-history";
    
            console.log(`📡 Fetching expense history for ${role}...`);
    
            const response = await fetch(endpoint, {
                method: "GET",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            });
    
            const data = await response.json();
            const logs = data.history;
            console.log("✅ Fetched logs:", logs);
    
            if (!logs || logs.length === 0) {
                toast.info("No expenses available.");
                return;
            }
    
            const doc = new jsPDF();
            doc.text("Expense History", 14, 10);
    
            const tableData = logs.map((entry, i) => [
                i + 1,
                role === "admin" || role === "supervisor" ? entry.user_name : undefined,
                entry.store_name,
                entry.category,
                `$${parseFloat(entry.amount).toFixed(2)}`,
                entry.status,
                entry.uploaded_at
            ]);
    
            const headColumns = role === "admin" || role === "supervisor"
                ? ["#", "User", "Store", "Category", "Amount", "Status", "Uploaded"]
                : ["#", "Store", "Category", "Amount", "Status", "Uploaded"];
    
            console.log("📊 Creating table...");
            autoTable(doc, {
                startY: 20,
                head: [headColumns],
                body: tableData
            });
    
            console.log("📈 Rendering chart in hidden container...");
            const ctx = document.getElementById("chart-canvas").getContext("2d");
    
            const categories = {};
            logs.forEach(log => {
                categories[log.category] = (categories[log.category] || 0) + parseFloat(log.amount);
            });
    
            new Chart(ctx, {
                type: "bar",
                data: {
                    labels: Object.keys(categories),
                    datasets: [{
                        label: "Amount Spent ($)",
                        data: Object.values(categories),
                        backgroundColor: "rgba(75, 192, 192, 0.6)",
                        borderColor: "rgba(75, 192, 192, 1)",
                        borderWidth: 1
                    }]
                },
                options: {
                    animation: false,
                    responsive: false,
                    plugins: {
                        legend: { display: false }
                    }
                }
            });
    
            console.log("⏳ Waiting for chart render...");
            await new Promise(resolve => setTimeout(resolve, 800));
    
            console.log("📷 Taking screenshot of chart-container...");
            const chartContainer = document.getElementById("chart-container");
    
            html2canvas(chartContainer).then(canvas => {
                const imgData = canvas.toDataURL("image/png");
    
                try {
                    doc.addPage();
                    doc.text("Spending by Category", 14, 15);
                    doc.addImage(imgData, "JPEG", 10, 25, 180, 100);
                    doc.save("expense_history.pdf");
                } catch (error) {
                    console.error("💥 Error adding image to PDF:", error);
                    toast.error("Failed to embed chart in PDF.");
                }
            }).catch(err => {
                console.error("💥 Error capturing chart div:", err);
                toast.error("Chart rendering failed.");
            });
    
        } catch (error) {
            console.error("🔥 Error in fetchAuditLogs:", error);
            toast.error("Failed to generate PDF.");
        }
    };
    

    const changePassword = async (currentPassword, newPassword) => {
        try {
            const response = await fetch("http://127.0.0.1:5000/change-password", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({
                    current_password: currentPassword,
                    new_password: newPassword
                })
            });
    
            const data = await response.json();
            if (response.ok) {
                toast.success(data.message || "Password changed successfully!");
    
                setTimeout(() => {
                    localStorage.removeItem("token");
                    navigate("/");
                }, 3000); // ⏳ Wait 3s to let user see toast, then logout
            } else {
                toast.error(data.error || "Error changing password.");
            }
        } catch (error) {
            console.error("Password change error:", error);
            toast.error("Failed to change password.");
        }
    };
    
    const deleteAccount = async () => {
        if (!window.confirm("Are you sure you want to delete your account? This cannot be undone.")) {
            return;
        }
    
        try {
            const response = await fetch("http://127.0.0.1:5000/delete-account", {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            });
    
            const data = await response.json();
    
            if (response.ok) {
                toast.success(data.message || "Account deleted!");
                setTimeout(() => {
                    localStorage.removeItem("token");
                    localStorage.removeItem("role");
                    window.location.href = "/"; // Redirect to login
                }, 3000);
            } else {
                toast.error(data.error || "Error deleting account.");
            }
        } catch (error) {
            console.error("Delete account error:", error);
            toast.error("Failed to delete account.");
        }
    };
    

    return (
        <div>
            <div className="logout-container">
                <button 
                    className="logout-button"
                    onClick={() => {
                        localStorage.removeItem("token");
                        navigate("/");
                    }}
                >
                    Logout
                </button>
            </div>
            {/* Profile Icon */}
            <div style={{ position: 'absolute', top: 20, left: 30 }}>
                <div 
                    style={{ cursor: 'pointer' }} 
                    onClick={() => setShowDropdown(!showDropdown)}
                >
                    <User size={30} />
                </div>

                {showDropdown && (
                <div 
                    style={{ 
                        backgroundColor: 'white', 
                        boxShadow: '0 0 10px rgba(0,0,0,0.1)', 
                        padding: '10px', 
                        borderRadius: '8px', 
                        marginTop: '8px' 
                    }}
                >
                    <button
                        onClick={async () => {
                            setShowDropdown(false);
                            const currentPassword = prompt("Enter your current password:");
                            if (!currentPassword) {
                                toast.error("Password change canceled.");
                                return; // ⛔ Immediately stop here if canceled
                            }

                            const newPassword1 = prompt("Enter your new password:");
                            if (!newPassword1) {
                                toast.error("Password change canceled.");
                                return;
                            }

                            const newPassword2 = prompt("Confirm your new password:");
                            if (!newPassword2) {
                                toast.error("Password change canceled.");
                                return;
                            }

                            if (newPassword1 !== newPassword2) {
                                toast.error("New passwords do not match.");
                                return;
                            }

                            await changePassword(currentPassword, newPassword1);
                        }}
                        style={{
                            background: "#007bff",
                            color: "white",
                            padding: "8px 12px",
                            borderRadius: "6px",
                            border: "none",
                            width: "100%",
                            cursor: "pointer"
                        }}
                    >
                        Change Password
                    </button>
                    
                     {/* 🔴 Delete Account Button */}
                    <button
                        onClick={async () => {
                        setShowDropdown(false);
                        await deleteAccount();
                    }}
                    style={{
                        background: "#dc3545",
                        color: "white",
                        padding: "8px 12px",
                        borderRadius: "6px",
                        border: "none",
                        width: "100%",
                        cursor: "pointer"
                    }}
                >
                    Delete Account
                </button>

            </div>
            )}
        </div>
            {/* 🆕 Wrap main-container inside a safety check */}
            {formData && formData.items && (
              <div className="main-container">
                <div className="form-section">
                    <h2>Expense Form</h2>
                    <form onSubmit={handleSubmit}>
                        <label htmlFor="category">Category</label>
                        <select 
                            id="category" 
                            className="input-field" 
                            value={formData.category} 
                            onChange={(e) => setFormData({ 
                                ...formData, 
                                category: e.target.value, 
                                subcategory: categoryOptions[e.target.value][0] 
                            })}
                        >
                            {Object.keys(categoryOptions).map(cat => (
                                <option key={cat} value={cat}>{cat}</option>
                            ))}
                        </select>

                        <label htmlFor="subcategory">Subcategory</label>
                        <select
                            id="subcategory"
                            className="input-field"
                            value={formData.subcategory}
                            onChange={(e) => setFormData({ ...formData, subcategory: e.target.value })}
                        >
                            {categoryOptions[formData.category]?.map(sub => ( // 🆕 safer with optional chaining
                                <option key={sub} value={sub}>{sub}</option>
                            ))}
                        </select>

                        <label htmlFor="store">Store Name</label>
                        <input 
                            type="text" 
                            id="store" 
                            className="input-field" 
                            placeholder="Enter store name" 
                            value={formData.store} 
                            onChange={(e) => setFormData({ ...formData, store: e.target.value })}
                            required 
                        />

                        <label>Receipt Items</label>
                        <div className="items-container">
                            {/* 🆕 Safe .map() */}
                            {Array.isArray(formData.items) && formData.items.map((item, index) => (
                                <div key={index} className="item-row">
                                    <input
                                        type="text"
                                        className="item-name"
                                        placeholder="Item Name"
                                        value={item.name}
                                        onChange={(e) => handleItemChange(index, "name", e.target.value)}
                                    />
                                    <input
                                        type="number"
                                        className="item-amount"
                                        placeholder="Amount"
                                        step="0.01"
                                        value={item.amount}
                                        onChange={(e) => handleItemChange(index, "amount", e.target.value)}
                                    />
                                    <button 
                                        type="button" 
                                        onClick={() => removeItem(index)}
                                        className="remove-item-button"
                                    >
                                        ❌
                                    </button>
                                </div>
                            ))}
                            <button type="button" onClick={addNewItem} className="add-item-button">Add Item</button>
                        </div>

                        <div className="total-amount">
                            <strong>Total Amount: ${totalAmount}</strong>
                        </div>

                        <button 
                            type="submit"
                            disabled={
                                !formData.items.length ||   
                                formData.items.every(item => !item.name || !item.amount) ||  
                                parseFloat(totalAmount) <= 0  
                            }
                        >
                            Submit
                        </button>

                    </form>
                </div>

                <div className="upload-section">
                    <h2>Upload File</h2>
                    <input type="file" className="input-field" onChange={(e) => uploadReceipt(e.target.files[0])} />
                    {uploadedImageUrl && (
                        <div className="uploaded-image-preview">
                            <img src={uploadedImageUrl} alt="Uploaded receipt preview" />
                        </div>
                    )}

                    {isUploading && (
                        <div className="upload-spinner">
                            <p>Uploading file...</p>
                            <div className="spinner"></div>
                        </div>
                    )}
                </div>
              </div>
            )}

            <button onClick={() => navigate("/history")} className="input-field previous-uploads-button">
                Previous Uploads
            </button>

            {localStorage.getItem("role") === "admin" && (
                <button 
                    className="input-field previous-uploads-button"
                    onClick={() => navigate("/admin")}
                >
                    Admin Panel
                </button>
            )}



            <button 
                onClick={fetchAuditLogs}
                className="input-field previous-uploads-button"
            >
                View Audit Logs
            </button>
            <ToastContainer
                position="top-center"
                autoClose={3000}
                hideProgressBar={false}
                newestOnTop
                closeOnClick
                rtl={false}
                pauseOnFocusLoss
                draggable
                pauseOnHover
            />

             {/* 🔒 Hidden chart for PDF generation */}
             <div id="chart-container" style={{ width: "600px", height: "400px", display: "none" }}>
                <canvas id="chart-canvas" width="600" height="400"></canvas>
            </div>

        </div>
    );
};

export default Main;

