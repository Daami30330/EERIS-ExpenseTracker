import React, { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../styles/admin.css";  // <-- ✅ import the new CSS

const Admin = () => {
    const [users, setUsers] = useState([]);
    const [loading, setLoading] = useState(true);
    const navigate = useNavigate();

    const fetchUsers = async () => {
        try {
            const response = await fetch("http://127.0.0.1:5000/all-users", {
                method: "GET",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            });

            if (response.ok) {
                const data = await response.json();
                setUsers(data.users);
                setLoading(false);
            } else {
                alert("Access forbidden or session expired.");
                navigate("/login");
            }
        } catch (error) {
            console.error("Error fetching users", error);
            alert("Failed to load users.");
            navigate("/login");
        }
    };

    const updateRole = async (userId, newRole) => {
        try {
            const response = await fetch(`http://127.0.0.1:5000/update-user-role/${userId}`, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                },
                body: JSON.stringify({ role: newRole })
            });

            if (response.ok) {
                alert("Role updated!");
                fetchUsers();
            } else {
                alert("Failed to update role");
            }
        } catch (error) {
            console.error("Error updating role", error);
        }
    };

    const deleteUser = async (userId) => {
        const confirmDelete = window.confirm("Are you sure you want to delete this account?");
        if (!confirmDelete) return;
    
        try {
            const response = await fetch(`http://127.0.0.1:5000/delete-user/${userId}`, {
                method: "DELETE",
                headers: {
                    "Authorization": `Bearer ${localStorage.getItem("token")}`
                }
            });
    
            if (response.ok) {
                alert("User deleted successfully.");
                fetchUsers(); // Refresh the list
            } else {
                alert("Failed to delete user.");
            }
        } catch (error) {
            console.error("Error deleting user", error);
            alert("Error deleting user.");
        }
    };
    

    useEffect(() => {
        fetchUsers();
    }, []);

    if (loading) {
        return <div className="container">Loading users...</div>;
    }

    return (
        <div className="admin-main-container">
            <div className="admin-container">
                <h2 className="admin-header">Admin Panel - User Management</h2>
                {users.map((user) => (
                    <div key={user.id} className="user-tile">
                        <p className="user-info"><strong>Name:</strong> {user.name}</p>
                        <p className="user-info"><strong>Email:</strong> {user.email}</p>
                        <p className="user-info"><strong>Role:</strong> {user.role}</p>
                        <select 
                            className="role-select"
                            value={user.role}
                            onChange={(e) => updateRole(user.id, e.target.value)}
                        >
                            <option>Employee</option>
                            <option>Supervisor</option>
                            <option>Admin</option>
                        </select>
                        <button
                            className="delete-user-button"
                            onClick={() => deleteUser(user.id)}
                        >
                            Delete User
                        </button>

                    </div>
                ))}
                <button 
                    className="input-field previous-uploads-button" 
                    onClick={() => navigate("/main")}
                >
                    Back to Main
                </button>
            </div>
        </div>
    );
};

export default Admin;
