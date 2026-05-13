import React from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Floating from "./Floating";
import Summon from "./Summon";
import PetWindow from "./PetWindow";
import ControlPanel from "./ControlPanel";
import "./App.css";

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <BrowserRouter>
      <Routes>
        <Route path="/floating" element={<Floating />} />
        <Route path="/summon" element={<Summon />} />
        <Route path="/pet" element={<PetWindow />} />
        <Route path="/control" element={<ControlPanel />} />
      </Routes>
    </BrowserRouter>
  </React.StrictMode>,
);
