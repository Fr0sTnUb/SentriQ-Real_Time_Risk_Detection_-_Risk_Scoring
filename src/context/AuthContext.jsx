import { createContext, useContext, useReducer } from 'react';

const AuthContext = createContext(null);

const initialState = {
  token: window.localStorage.getItem('sentriq_token') || '',
};

function reducer(state, action) {
  switch (action.type) {
    case 'login':
      window.localStorage.setItem('sentriq_token', action.token);
      return { ...state, token: action.token };
    case 'logout':
      window.localStorage.removeItem('sentriq_token');
      return { ...state, token: '' };
    default:
      return state;
  }
}

export function AuthProvider({ children }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  return <AuthContext.Provider value={{ state, dispatch }}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const value = useContext(AuthContext);
  if (!value) throw new Error('useAuth must be used within AuthProvider');
  return value;
}
