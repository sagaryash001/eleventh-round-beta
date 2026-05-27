import React, { createContext, useContext, useReducer, useEffect } from 'react'

export type CartItem = {
  key: string       // `${productId}-${size}`
  productId: string
  name: string
  variant: string
  size: string
  price: number
  image: string
  quantity: number
}

type State = { items: CartItem[]; open: boolean }

type Action =
  | { type: 'ADD';    item: Omit<CartItem, 'key' | 'quantity'> }
  | { type: 'REMOVE'; key: string }
  | { type: 'SET_QTY'; key: string; qty: number }
  | { type: 'CLEAR' }
  | { type: 'OPEN' }
  | { type: 'CLOSE' }

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'ADD': {
      const key = `${action.item.productId}-${action.item.size}`
      const existing = state.items.find(i => i.key === key)
      const items = existing
        ? state.items.map(i => i.key === key ? { ...i, quantity: i.quantity + 1 } : i)
        : [...state.items, { ...action.item, key, quantity: 1 }]
      return { items, open: true }
    }
    case 'REMOVE':
      return { ...state, items: state.items.filter(i => i.key !== action.key) }
    case 'SET_QTY':
      return {
        ...state,
        items: action.qty < 1
          ? state.items.filter(i => i.key !== action.key)
          : state.items.map(i => i.key === action.key ? { ...i, quantity: action.qty } : i),
      }
    case 'CLEAR':
      return { ...state, items: [] }
    case 'OPEN':
      return { ...state, open: true }
    case 'CLOSE':
      return { ...state, open: false }
    default:
      return state
  }
}

const STORAGE_KEY = 'er_cart'

function loadCart(): CartItem[] {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]')
  } catch {
    return []
  }
}

interface CartContextType {
  items: CartItem[]
  open: boolean
  count: number
  total: number
  add: (item: Omit<CartItem, 'key' | 'quantity'>) => void
  remove: (key: string) => void
  setQty: (key: string, qty: number) => void
  clear: () => void
  openCart: () => void
  closeCart: () => void
}

const CartContext = createContext<CartContextType>(null!)

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, { items: loadCart(), open: false })

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state.items))
  }, [state.items])

  const count = state.items.reduce((s, i) => s + i.quantity, 0)
  const total = state.items.reduce((s, i) => s + i.price * i.quantity, 0)

  return (
    <CartContext.Provider value={{
      items:     state.items,
      open:      state.open,
      count,
      total,
      add:       item => dispatch({ type: 'ADD', item }),
      remove:    key  => dispatch({ type: 'REMOVE', key }),
      setQty:    (key, qty) => dispatch({ type: 'SET_QTY', key, qty }),
      clear:     ()   => dispatch({ type: 'CLEAR' }),
      openCart:  ()   => dispatch({ type: 'OPEN' }),
      closeCart: ()   => dispatch({ type: 'CLOSE' }),
    }}>
      {children}
    </CartContext.Provider>
  )
}

export function useCart() {
  return useContext(CartContext)
}
