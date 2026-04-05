import { BrowserRouter, Navigate, Route, Routes } from "react-router-dom";
import { ExplainPage } from "./pages/ExplainPage";
import { GoodbyePage } from "./pages/GoodbyePage";
import { HomePage } from "./pages/HomePage";

export default function App() {
  return (
    <BrowserRouter>
      <div className="min-h-svh bg-white font-sans text-gray-900 antialiased">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/explain" element={<ExplainPage />} />
          <Route path="/goodbye" element={<GoodbyePage />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </div>
    </BrowserRouter>
  );
}
