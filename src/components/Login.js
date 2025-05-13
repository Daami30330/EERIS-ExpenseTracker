import React, { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import "../styles/styles.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";

const Login = () => {
    const [username, setUsername] = useState("");
    const [password, setPassword] = useState("");
    const navigate = useNavigate();
    const [loginError, setLoginError] = useState(false);

    const handleLogin = async () => {
        if (username && password) {
            try {
                const response = await fetch("http://127.0.0.1:5000/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ email: username, password: password }),
                });
    
                const data = await response.json();
    
                if (response.ok) {
                    localStorage.setItem("token", data.token);
                    localStorage.setItem("role", data.role);
                    navigate("/main");
                } else {
                    setLoginError(true); // 🛑 Trigger red border
                    toast.error(data.error || "Invalid username or password"); // 🚨 Show toast
                }
            } catch (error) {
                console.error("Login failed", error);
                setLoginError(true); 
                toast.error("Login request failed. Please try again.");
            }
        } else {
            setLoginError(true);
            toast.error("Please enter valid credentials");
        }
    };
    

    return (
        <div className="container">
            <h2>Login</h2>
            <input 
                type="text" 
                className={`input-field ${loginError ? 'input-error' : ''}`} 
                placeholder="Email" 
                value={username} 
                onChange={(e) => {
                    setUsername(e.target.value);
                    setLoginError(false);    // 🛠️ Reset error if typing again
                }}
            />
            <input 
                type="password" 
                className={`input-field ${loginError ? 'input-error' : ''}`}
                placeholder="Password" 
                value={password} 
                onChange={(e) => {
                    setPassword(e.target.value);
                    setLoginError(false);   // 🛠️ Reset error if typing again
                }}
            />
            <button onClick={handleLogin}>Login</button>

            {/* Register link */}
            <p style={{ marginTop: "10px" }}>
                Don't have an account? <Link to="/register">Register here</Link>
            </p>
            
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
        </div>
    );
};

export default Login;
