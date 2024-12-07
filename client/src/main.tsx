import * as React from "react";
import { createRoot } from "react-dom/client";
import { Switch, Route } from "wouter";
import "./index.css";
import { QueryClientProvider } from "@tanstack/react-query";
import { queryClient } from "./lib/queryClient";
import { Toaster } from "@/components/ui/toaster";

import Dashboard from "./pages/Dashboard";
import VideoEditor from "./pages/VideoEditor";
import VideoProcessing from "./pages/VideoProcessing";

import NavBar from "./components/NavBar";

function Router() {
  return (
    <div className="min-h-screen bg-background">
      <NavBar />
      <Switch>
        <Route path="/" component={Dashboard} />
        <Route path="/video/:id" component={VideoEditor} />
        <Route path="/processing" component={VideoProcessing} />
        <Route path="/analysis" component={Dashboard} />
        <Route>404 Page Not Found</Route>
      </Switch>
    </div>
  );
}

createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <Router />
      <Toaster />
    </QueryClientProvider>
  </React.StrictMode>,
);
