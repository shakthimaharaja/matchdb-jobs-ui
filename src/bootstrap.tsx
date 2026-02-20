import React from "react";
import { createRoot } from "react-dom/client";
import { Provider } from "react-redux";
import { store } from "./store";
import JobsApp from "./JobsApp";
import "primereact/resources/themes/md-light-indigo/theme.css";
import "primereact/resources/primereact.min.css";
import "primeicons/primeicons.css";
import "./styles/index.css";

// Standalone mode — for running matchdb-jobs-ui independently during development
const root = createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    <Provider store={store}>
      <JobsApp
        token={null}
        userType="candidate"
        userId="standalone-dev"
        userEmail="dev@matchdb.com"
        username="standalone-dev"
      />
    </Provider>
  </React.StrictMode>,
);
