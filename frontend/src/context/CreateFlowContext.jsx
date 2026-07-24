import React, { createContext, useContext } from 'react';

const CreateFlowContext = createContext(null);

export function CreateFlowProvider({ openCreateSheet, children }) {
  return (
    <CreateFlowContext.Provider value={{ openCreateSheet }}>
      {children}
    </CreateFlowContext.Provider>
  );
}

export function useCreateFlow() {
  const ctx = useContext(CreateFlowContext);
  if (!ctx) {
    throw new Error('useCreateFlow must be used within CreateFlowProvider');
  }
  return ctx;
}
