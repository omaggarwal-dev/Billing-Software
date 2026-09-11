import { useEffect, useState } from "react";

function App() {
  const [message, setMessage] = useState("Connecting...");

  useEffect(() => {
    fetch("http://localhost:5000/api/health")
      .then((response) => response.json())
      .then((data) => setMessage(data.message))
      .catch(() => setMessage("Backend connection failed"));
  }, []);

  return (
    <div className="min-h-screen bg-gray-100 flex items-center justify-center">
      <div className="bg-white p-8 rounded-xl shadow-lg">
        <h1 className="text-3xl font-bold">
          Restaurant Management System
        </h1>

        <p className="mt-4 text-gray-600">
          Backend status:
        </p>

        <p className="mt-1 font-semibold">
          {message}
        </p>
      </div>
    </div>
  );
}

export default App;