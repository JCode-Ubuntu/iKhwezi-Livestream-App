import React, { createContext, useContext, useMemo } from 'react';

/**
 * CreateFlowContext — the single entry point to iKHWEZI's CREATE hub.
 *
 * Pages never mount their own composer / wizard. They call
 *   openCreateSheet()        → the CREATE menu
 *   openCreate('story')      → jump straight into one hub action
 *
 * Valid actions: signal · video · image · story · group · message · live · meeting
 * (see CREATE_ACTIONS). App.jsx owns the state for all of them.
 */

export const CREATE_ACTIONS = Object.freeze([
  'signal', 'video', 'image', 'story', 'group', 'message', 'live', 'meeting',
]);

const CreateFlowContext = createContext(null);

export function CreateFlowProvider({ openCreateSheet, openCreate, children }) {
  const value = useMemo(() => ({
    openCreateSheet,
    openCreate: (action, options) => {
      if (!CREATE_ACTIONS.includes(action)) {
        console.warn(`[CreateFlow] unknown action "${action}"`);
        return;
      }
      openCreate?.(action, options);
    },
  }), [openCreateSheet, openCreate]);

  return (
    <CreateFlowContext.Provider value={value}>
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
