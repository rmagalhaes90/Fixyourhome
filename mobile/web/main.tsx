import { createRoot } from "react-dom/client";
import "../../app/globals.css";
import Page from "../../app/page";

declare global {
  interface Window {
    TidyNextNative?: boolean;
  }
}

window.TidyNextNative = true;
document.documentElement.classList.add("native");

const root = document.getElementById("root");
if (!root) throw new Error("TidyNext root missing");
createRoot(root).render(<Page />);
