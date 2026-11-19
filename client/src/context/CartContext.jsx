import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { cartAPI } from '../services/api';
import { useAuth } from './AuthContext';

const CartContext = createContext(null);

const EMPTY_CART = {
  restaurant_id: null,
  restaurant_name: null,
  items: [],
  subtotal: 0,
  delivery_fee: 0,
  tax_amount: 0,
  total_amount: 0,
  item_count: 0,
};

export function CartProvider({ children }) {
  const { user, isAuthenticated } = useAuth();
  const [cart, setCart] = useState(EMPTY_CART);
  const [loading, setLoading] = useState(false);
  const [flyingItems, setFlyingItems] = useState([]);
  const [cartBounce, setCartBounce] = useState(false);

  const fetchCart = useCallback(async () => {
    if (!isAuthenticated || user?.role !== 'CUSTOMER') {
      setCart(EMPTY_CART);
      return;
    }
    setLoading(true);
    try {
      const res = await cartAPI.getCart();
      setCart(res.data.cart || EMPTY_CART);
    } catch {
      setCart(EMPTY_CART);
    } finally {
      setLoading(false);
    }
  }, [isAuthenticated, user?.role]);

  useEffect(() => {
    fetchCart();
  }, [fetchCart]);

  const triggerFlyToCart = useCallback((imageUrl, sourceRect) => {
    if (!imageUrl || !sourceRect) return;
    if (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      return;
    }
    const targetEl = document.querySelector('[data-cart-target="true"]');
    if (!targetEl) return;
    const targetRect = targetEl.getBoundingClientRect();

    const id = Date.now() + Math.random();
    setFlyingItems((prev) => [
      ...prev,
      {
        id,
        imageUrl,
        fromX: sourceRect.left + sourceRect.width / 2 - 28,
        fromY: sourceRect.top + sourceRect.height / 2 - 28,
        toX: targetRect.left + targetRect.width / 2 - 14,
        toY: targetRect.top + targetRect.height / 2 - 14,
      },
    ]);

    setTimeout(() => {
      setCartBounce(true);
      setTimeout(() => setCartBounce(false), 450);
    }, 520);

    setTimeout(() => {
      setFlyingItems((prev) => prev.filter((item) => item.id !== id));
    }, 750);
  }, []);

  const addItem = async (foodItemId, quantity = 1, replaceCart = false) => {
    const res = await cartAPI.addItem({
      food_item_id: foodItemId,
      quantity,
      replace_cart: replaceCart,
    });
    setCart(res.data.cart);
    return res.data.cart;
  };

  const updateQuantity = async (foodItemId, quantity) => {
    const res = await cartAPI.updateItem(foodItemId, { quantity });
    setCart(res.data.cart);
    return res.data.cart;
  };

  const removeItem = async (foodItemId) => {
    const res = await cartAPI.removeItem(foodItemId);
    setCart(res.data.cart);
    return res.data.cart;
  };

  const clear = async () => {
    await cartAPI.clearCart();
    setCart(EMPTY_CART);
  };

  return (
    <CartContext.Provider
      value={{
        cart,
        loading,
        flyingItems,
        cartBounce,
        triggerFlyToCart,
        fetchCart,
        addItem,
        updateQuantity,
        removeItem,
        clear,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export const useCart = () => useContext(CartContext);
