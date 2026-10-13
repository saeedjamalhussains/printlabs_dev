import { createContext, useContext } from 'react';

/** See useAuth.js — same split, same reason. */
export const CartContext = createContext(null);

export const useCart = () => {
  const ctx = useContext(CartContext);
  if (!ctx) throw new Error('useCart must be used within CartProvider');
  return ctx;
};
