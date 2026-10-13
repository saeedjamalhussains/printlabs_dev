import { useEffect, useRef, useState } from 'react';
import { useAuth } from '../hooks/useAuth';
import { CartContext } from '../hooks/useCart';

export const CartProvider = ({ children }) => {
  const [cart, setCart] = useState(() => {
    try {
      const savedCart = localStorage.getItem('cart');
      return savedCart ? JSON.parse(savedCart) : [];
    } catch {
      localStorage.removeItem('cart');
      return [];
    }
  });

  useEffect(() => {
    localStorage.setItem('cart', JSON.stringify(cart));
  }, [cart]);

  /**
   * The cart belongs to whoever is signed in, so it is emptied when that
   * changes.
   *
   * Logging out cleared the token but left the basket in localStorage, so
   * on a shared machine the next person to sign in inherited the previous
   * customer's cart. Now that adding to the cart requires an account, the
   * cart is account-scoped and has to follow the session.
   */
  const { user, loading: authLoading } = useAuth();
  // `undefined` means "we have not seen a settled session yet" — distinct
  // from `null`, which means "signed out". Without that distinction the
  // first render after a refresh looks like a logout and wipes a cart the
  // customer legitimately still owns.
  const lastUserId = useRef(undefined);

  useEffect(() => {
    if (authLoading) return;
    const currentId = user?._id ?? null;

    if (lastUserId.current === undefined) {
      lastUserId.current = currentId;
      return;
    }
    if (lastUserId.current !== currentId) {
      lastUserId.current = currentId;
      setCart([]);
    }
  }, [user, authLoading]);

  /**
   * Largest quantity of `product` the cart may hold.
   *
   * A product with no stock figure (an older cart entry, say) is left
   * unclamped rather than treated as zero — the server checks stock again
   * at checkout, so the cart erring generous is safe, but the cart
   * silently emptying itself would not be.
   */
  const stockLimit = (product) => {
    const stock = Number(product?.stock);
    return Number.isFinite(stock) && stock >= 0 ? stock : Infinity;
  };

  /**
   * Add to the cart, never exceeding available stock.
   *
   * Quantities used to accumulate unchecked, so clicking "Add to Cart"
   * six times on a product with three in stock put six in the basket.
   * Nothing objected until checkout, where the server rejected the whole
   * order — the worst possible moment to find out.
   *
   * @returns {{ added: number, quantity: number, capped: boolean }}
   *          so the caller can tell the customer what actually happened.
   */
  const addToCart = (product) => {
    const max = stockLimit(product);
    const requested = Math.max(1, Number(product.quantity) || 1);
    let result = { added: 0, quantity: 0, capped: false };

    setCart((prev) => {
      const existing = prev.find((item) => item._id === product._id);
      const current = existing?.quantity || 0;
      const next = Math.min(current + requested, max);

      result = { added: next - current, quantity: next, capped: next < current + requested };

      if (next === current) return prev; // already at the ceiling

      if (existing) {
        return prev.map((item) =>
          item._id === product._id ? { ...item, quantity: next, stock: product.stock ?? item.stock } : item
        );
      }

      const imageUrl = product.imageUrl || product.images?.[0]?.url || '';
      return [...prev, { ...product, imageUrl, quantity: next }];
    });

    return result;
  };

  const removeFromCart = (id) => {
    setCart((prev) => prev.filter((item) => item._id !== id));
  };

  const updateQty = (id, qty) => {
    if (qty <= 0) {
      removeFromCart(id);
      return;
    }
    setCart((prev) =>
      prev.map((item) =>
        item._id === id ? { ...item, quantity: Math.min(qty, stockLimit(item)) } : item
      )
    );
  };

  /** The cart line for a product, if it has one. */
  const getCartItem = (id) => cart.find((item) => item._id === id);

  /** Whether a product is already in the cart — drives "Go to Cart". */
  const isInCart = (id) => cart.some((item) => item._id === id);

  const clearCart = () => setCart([]);

  const totalAmount = cart.reduce((total, item) => total + item.price * item.quantity, 0);
  const totalItems = cart.reduce((total, item) => total + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        cart,
        addToCart,
        removeFromCart,
        updateQty,
        clearCart,
        getCartItem,
        isInCart,
        totalAmount,
        totalItems,
      }}
    >
      {children}
    </CartContext.Provider>
  );
};
