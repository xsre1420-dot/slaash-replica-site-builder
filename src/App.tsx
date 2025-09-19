
import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import Index from "./pages/Index";
import Login from "./pages/Login";
import Signup from "./pages/Signup";
import Builder from "./pages/Builder";
import AddProduct from "./pages/AddProduct";
import EditProduct from "./pages/EditProduct";
import NotFound from "./pages/NotFound";
import PreviewStore from "./pages/PreviewStore";
import Store from "./pages/Store";
import ProductDetails from "./pages/ProductDetails";

import Products from "./pages/Products";
import Checkout from "./pages/Checkout";
import Orders from "./pages/Orders";
import OrderDetails from "./pages/OrderDetails";
import Settings from "./pages/Settings";
import Statistics from "./pages/Statistics";
import Marketing from "./pages/Marketing";
import Inventory from "./pages/Inventory";
import { CartProvider } from "./context/CartContext";
import { StoreProvider } from "./context/StoreContext";
import { AuthProvider } from "./context/AuthContext";
import { ProtectedRoute } from "./components/ProtectedRoute";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <AuthProvider>
      <StoreProvider>
        <TooltipProvider>
          <CartProvider>
            <Toaster />
            <Sonner />
            <BrowserRouter>
              <Routes>
                <Route path="/" element={<Index />} />
                <Route path="/login" element={<Login />} />
                <Route path="/signup" element={<Signup />} />
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
                <Route path="/store/:username" element={<Store />} />
                <Route path="/store/:username/product/:productId" element={<ProductDetails />} />
                <Route path="/product-details/:productId" element={<ProductDetails />} />
                <Route path="/store/:username/checkout" element={<Checkout />} />
                <Route path="/checkout" element={<Checkout />} />
                <Route path="/preview" element={<ProtectedRoute><PreviewStore /></ProtectedRoute>} />
                <Route path="*" element={<NotFound />} />
              </Routes>
            </BrowserRouter>
          </CartProvider>
        </TooltipProvider>
      </StoreProvider>
    </AuthProvider>
  </QueryClientProvider>
);

export default App;
