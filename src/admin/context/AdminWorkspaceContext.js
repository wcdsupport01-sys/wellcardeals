import { createContext, useContext } from 'react';
export const AdminWorkspaceContext=createContext(null);
export function useAdminWorkspace(){return useContext(AdminWorkspaceContext);}
