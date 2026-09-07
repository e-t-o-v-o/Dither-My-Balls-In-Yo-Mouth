import React from "react";
import ReactDOM from "react-dom/client";
import "./index.css";
import App from "./App";
class ErrorBoundary extends React.Component {
  state = { error: false };
  static getDerivedStateFromError() {
    return { error: true };
  }
  render() {
    if (this.state.error)
      return (
        <main style={{ padding: 32, maxWidth: 600, margin: "10vh auto" }}>
          <h1>Dither couldn’t open this workspace.</h1>
          <p>
            Your media files are safe. Reset the saved effect settings and
            reload to recover.
          </p>
          <button
            onClick={() => {
              try {
                localStorage.removeItem("dither.config.v2");
                localStorage.removeItem("config");
              } catch {}
              window.location.reload();
            }}
          >
            Reset settings and reload
          </button>
        </main>
      );
    return this.props.children;
  }
}
ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <ErrorBoundary>
      <App />
    </ErrorBoundary>
  </React.StrictMode>,
);
