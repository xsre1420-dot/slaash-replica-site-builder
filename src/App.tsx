
import React, { Suspense, lazy, memo } from "react";
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider, QueryCache, MutationCache } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { reportError } from "@/lib/observability";
import RouteObserver from "./components/RouteObserver";
import { CartProvider } from "./context/CartContext";
import { StoreProvider } from "./context/StoreContext";
import { AuthProvider } from "./context/AuthContext";
import { SubscriptionProvider } from "./context/SubscriptionContext";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { AdminRoute } from "./components/AdminRoute";
import ErrorBoundary from "./components/ErrorBoundary";
import OfflineBanner from "./components/OfflineBanner";
import RecoveryBanner from "./components/RecoveryBanner";
import { StoreBootstrapProvider } from '@/context/StoreBootstrapContext';
import SubdomainRouter from "./components/SubdomainRouter";
import StorefrontRouteShell from "./components/StorefrontRouteShell";

// Lazy load ALL pages
const Index = lazy(() => import("./pages/Index"));
const Login = lazy(() => import("./pages/Login"));
const RequestAccess = lazy(() => import("./pages/RequestAccess"));
const SubscriptionExpired = lazy(() => import("./pages/SubscriptionExpired"));
const AdminLogin = lazy(() => import("./pages/admin/AdminLogin"));
const AdminLeads = lazy(() => import("./pages/admin/AdminLeads"));
const AdminLeadDetail = lazy(() => import("./pages/admin/AdminLeadDetail"));
const AdminSubscriptions = lazy(() => import("./pages/admin/AdminSubscriptions"));
const AdminCustomers = lazy(() => import("./pages/admin/AdminCustomers"));
const AdminPlatformHealth = lazy(() => import("./pages/admin/AdminPlatformHealth"));
const ResetPassword = lazy(() => import("./pages/ResetPassword"));
const AuthCallback = lazy(() => import("./pages/AuthCallback"));
const Builder = lazy(() => import("./pages/Builder"));
const AddProduct = lazy(() => import("./pages/AddProduct"));
const EditProduct = lazy(() => import("./pages/EditProduct"));
const NotFound = lazy(() => import("./pages/NotFound"));
const PreviewStore = lazy(() => import("./pages/PreviewStore"));
const Store = lazy(() => import("./pages/Store"));
const ProductDetails = lazy(() => import("./pages/ProductDetails"));
const Products = lazy(() => import("./pages/Products"));
const Checkout = lazy(() => import("./pages/Checkout"));
const Orders = lazy(() => import("./pages/Orders"));
const OrderDetails = lazy(() => import("./pages/OrderDetails"));
const Settings = lazy(() => import("./pages/Settings"));
const Statistics = lazy(() => import("./pages/Statistics"));
const Marketing = lazy(() => import("./pages/Marketing"));
const Inventory = lazy(() => import("./pages/Inventory"));
const Sitemap = lazy(() => import("./pages/Sitemap"));

const queryClient = new QueryClient({
  queryCache: new QueryCache({
    onError: (error, query) => {
      reportError(error, { source: 'react-query', queryKey: JSON.stringify(query.queryKey) });
    },
  }),
  mutationCache: new MutationCache({
    onError: (error, _vars, _ctx, mutation) => {
      reportError(error, {
        source: 'react-query-mutation',
        mutationKey: JSON.stringify(mutation.options.mutationKey),
      });
    },
  }),
  defaultOptions: {
    queries: {
      staleTime: 5 * 60 * 1000,
      gcTime: 10 * 60 * 1000,
      retry: 1,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
      refetchOnWindowFocus: false,
    },
  },
});

const PageLoader = memo(() => (
  <div className="min-h-screen flex items-center justify-center bg-background">
    <div className="flex flex-col items-center gap-4">
      <div className="w-10 h-10 border-3 border-primary border-t-transparent rounded-full animate-spin" />
      <p className="text-muted-foreground text-sm font-arabic">جارٍ التحميل...</p>
    </div>
  </div>
));

const App = () => (
  <ErrorBoundary>
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <SubscriptionProvider>
        <StoreProvider>
          <TooltipProvider>
            <CartProvider>
              <OfflineBanner />
              <RecoveryBanner />
              <Toaster />
              <Sonner />
              <BrowserRouter>
              <StoreBootstrapProvider>
                <RouteObserver />
                <SubdomainRouter />
                <Suspense fallback={<PageLoader />}>
                  <Routes>
                    <Route path="/" element={<Index />} />
                    <Route path="/login" element={<Login />} />
                    <Route path="/request-access" element={<RequestAccess />} />
                    <Route path="/signup" element={<RequestAccess />} />
                    <Route path="/subscription-expired" element={<SubscriptionExpired />} />
                    <Route path="/auth/callback" element={<AuthCallback />} />
                    <Route path="/reset-password" element={<ResetPassword />} />
                    <Route path="/builder" element={<ProtectedRoute><Builder /></ProtectedRoute>} />
                    <Route path="/settings" element={<ProtectedRoute><Settings /></ProtectedRoute>} />
                    <Route path="/statistics" element={<ProtectedRoute><Statistics /></ProtectedRoute>} />
                    <Route path="/add-product" element={<ProtectedRoute><AddProduct /></ProtectedRoute>} />
                    <Route path="/edit-product/:productId" element={<ProtectedRoute><EditProduct /></ProtectedRoute>} />
                    <Route path="/products" element={<ProtectedRoute><Products /></ProtectedRoute>} />
                    <Route path="/orders" element={<ProtectedRoute><Orders /></ProtectedRoute>} />
                    <Route path="/orders/:orderId" element={<ProtectedRoute><OrderDetails /></ProtectedRoute>} />
                    <Route path="/marketing" element={<ProtectedRoute><Marketing /></ProtectedRoute>} />
                    <Route path="/inventory" element={<ProtectedRoute><Inventory /></ProtectedRoute>} />
                    <Route path="/admin/login" element={<AdminLogin />} />
                    <Route path="/admin" element={<AdminRoute><Navigate to="/admin/leads" replace /></AdminRoute>} />
                    <Route path="/admin/leads" element={<AdminRoute><AdminLeads /></AdminRoute>} />
                    <Route path="/admin/leads/:leadId" element={<AdminRoute><AdminLeadDetail /></AdminRoute>} />
                    <Route path="/admin/subscriptions" element={<AdminRoute><AdminSubscriptions /></AdminRoute>} />
                    <Route path="/admin/customers" element={<AdminRoute><AdminCustomers /></AdminRoute>} />
                    <Route path="/admin/health" element={<AdminRoute><AdminPlatformHealth /></AdminRoute>} />
                    <Route element={<StorefrontRouteShell />}>
                      <Route path="/store/:username" element={<Store />} />
                      <Route path="/store/:username/product/:productId" element={<ProductDetails />} />
                      <Route path="/store/:username/checkout" element={<Checkout />} />
                    </Route>
                    <Route path="/product-details/:productId" element={<ProductDetails />} />
                    <Route path="/checkout" element={<Checkout />} />
                    <Route path="/preview" element={<ProtectedRoute><PreviewStore /></ProtectedRoute>} />
                    <Route path="/sitemap.xml" element={<Sitemap />} />
                    <Route path="*" element={<NotFound />} />
                  </Routes>
                </Suspense>
              </StoreBootstrapProvider>
              </BrowserRouter>
            </CartProvider>
          </TooltipProvider>
        </StoreProvider>
        </SubscriptionProvider>
      </AuthProvider>
    </QueryClientProvider>
  </ErrorBoundary>
);

export default App;
