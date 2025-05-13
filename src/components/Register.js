import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import "../styles/styles.css";  // ✅ Make sure to import your stylesheet if not imported globally

function Register() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role_id, setRoleId] = useState(1); // default to Employee
  const [message, setMessage] = useState('');

  const navigate = useNavigate();

  const handleSubmit = async (e) => {
    e.preventDefault();

    try {
      const res = await fetch('http://127.0.0.1:5000/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, email, password, role_id }),
      });

      const data = await res.json();

      if (res.ok) {
        setMessage('Registered successfully!');
        setTimeout(() => navigate('/'), 1500); // redirect to login
      } else {
        setMessage(data.error || 'Registration failed.');
      }
    } catch (err) {
      setMessage('Request failed. Is the backend running?');
      console.error(err);
    }
  };

  return (
    <div className="container" style={{ marginTop: '20px', width: '450px' }}>
      <h2>Register</h2>
      <form onSubmit={handleSubmit}>
        <input
          className="input-field"
          type="text"
          placeholder="Full Name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          required
        />
        <input
          className="input-field"
          type="email"
          placeholder="Email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
        <input
          className="input-field"
          type="password"
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
        <select
          className="input-field"
          value={role_id}
          onChange={(e) => setRoleId(Number(e.target.value))}
        >
          <option value={1}>Employee</option>
          <option value={2}>Supervisor</option>
          <option value={3}>Admin</option>
        </select>
        <button type="submit">Register</button>
      </form>
      <p>{message}</p>
    </div>
  );
}

export default Register;
