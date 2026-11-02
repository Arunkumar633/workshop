import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import "./index.css";
import Inverter from "./Inverter.jsx";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Inverter />
  </StrictMode>
);