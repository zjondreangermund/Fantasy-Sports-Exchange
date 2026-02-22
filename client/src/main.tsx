import { createRoot } from "react-dom/client";
import App from "./App";
import "./index.css";
import { patchFetchForApiBase } from "./lib/api-base";

patchFetchForApiBase();

createRoot(document.getElementById("root")!).render(<App />);
