import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';

export type Role = 'admin' | 'field_worker';
export type CollectionType = 'daily' | 'weekly' | 'monthly';

export type User = { id: number; username: string; password: string; role: Role; employeeId?: number };
export type Group = { id: number; name: string; code: string };
export type Employee = {
  id: number; name: string; mobile: string; age: number; address: string;
  username: string; password: string; groupId?: number; photoPath?: string;
};
export type Member = {
  id: number; memberNo: string; name: string; fatherName: string; motherName: string;
  spouseName: string; birthDate: string; nid: string; mobile: string; groupName: string;
  groupCode: string; groupId?: number; admissionDate: string; comment: string;
  village: string; unionName: string; upazila: string; district: string; photoPath?: string;
  nomineeName?: string; profession?: string;
};
export type Loan = {
  id: number; memberId: number; loanAmount: number; munafa: number; totalPayable: number;
  collectionType: CollectionType; munafaPercent: number; startDate: string; paid: number;
  installmentAmount?: number; collectibleAmount?: number; duration?: string;
};
export type Collection = {
  id: number; memberId: number; employeeId?: number; amount: number; date: string;
  status: 'draft' | 'posted'; collectionType?: CollectionType; memberName?: string;
  memberPhoto?: string; loanAmount?: number; totalCollectedSoFar?: number;
  remaining?: number; todayCollection?: number;
};
export type BankTransaction = {
  id: number; direction: 'deposit' | 'withdrawal'; sourceType: 'employee' | 'member';
  sourceId?: number; amount: number; date: string;
};
export type MunafaSettings = Record<CollectionType, number>;
type AppData = {
  users: User[]; groups: Group[]; employees: Employee[]; members: Member[];
  loans: Loan[]; collections: Collection[]; bankTransactions: BankTransaction[];
  munafa: MunafaSettings;
};
export type SyncStatus = 'loading' | 'online' | 'syncing' | 'offline' | 'setup_required';

type Store = {
  hydrated: boolean; syncStatus: SyncStatus; syncError: string | null;
  currentUser: User | null; users: User[]; groups: Group[];
  employees: Employee[]; members: Member[]; loans: Loan[]; collections: Collection[];
  bankTransactions: BankTransaction[]; munafa: MunafaSettings;
  login: (username: string, password: string, role: Role) => boolean;
  logout: () => void; changeAdminPassword: (oldPassword: string, newPassword: string) => boolean;
  addGroup: (name: string, code: string, id?: number) => void; deleteGroup: (id: number) => void;
  addEmployee: (employee: Omit<Employee, 'id'>) => void; updateEmployee: (id: number, employee: Partial<Omit<Employee, 'id'>>) => void; deleteEmployee: (id: number) => void;
  addMember: (member: Omit<Member, 'id'>) => boolean;
  addLoan: (loan: Omit<Loan, 'id' | 'paid'>) => boolean;
  updateMember: (id: number, member: Partial<Omit<Member, 'id'>>) => void;
  updateLoan: (id: number, loan: Partial<Omit<Loan, 'id'>>) => void;
  addCollection: (collection: Omit<Collection, 'id' | 'status'>, status?: Collection['status']) => void;
  postCollection: (id: number) => void;
  postCollections: (ids: number[]) => void;
  deleteCollection: (id: number) => void;
  addBankTransaction: (transaction: Omit<BankTransaction, 'id'>) => void;
  updateMunafa: (type: CollectionType, percent: number) => void;
};

const STORAGE_KEY = 'somobay-somiti-state-v1';
const API_BASE = process.env.EXPO_PUBLIC_DOMAIN ? `https://${process.env.EXPO_PUBLIC_DOMAIN}` : '';
const emptyData: AppData = {
  users: [
    { id: 1, username: 'admin', password: '123456', role: 'admin' },
    { id: 2, username: 'field', password: '1234', role: 'field_worker' },
  ],
  groups: [], employees: [], members: [], loans: [], collections: [], bankTransactions: [],
  munafa: { daily: 5, weekly: 7, monthly: 10 },
};

class RemoteError extends Error {
  code?: string;
  constructor(message: string, code?: string) {
    super(message);
    this.name = 'RemoteError';
    this.code = code;
  }
}

async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 8000);
  try {
    const response = await fetch(`${API_BASE}/api${path}`, {
      ...init,
      signal: controller.signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    });
    const text = await response.text();
    let body: unknown = null;
    try { body = text ? JSON.parse(text) : null; } catch { body = text; }
    if (!response.ok) {
      const payload = body as { message?: string; code?: string } | null;
      throw new RemoteError(payload?.message ?? `Remote request failed (${response.status})`, payload?.code);
    }
    return body as T;
  } finally {
    clearTimeout(timeout);
  }
}

const AppContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [data, setData] = useState<AppData>(emptyData);
  const [syncStatus, setSyncStatus] = useState<SyncStatus>('loading');
  const [syncError, setSyncError] = useState<string | null>(null);
  const dataRef = useRef(data);
  const pendingSyncRef = useRef(0);
  const syncQueueRef = useRef(Promise.resolve());

  const persistLocal = useCallback(async (next: AppData) => {
    try { await AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)); } catch { /* cache failure must not block remote sync */ }
  }, []);

  const pushRemote = useCallback(async (next: AppData) => {
    setSyncStatus('syncing');
    try {
      await apiRequest('/somobay/state', { method: 'PUT', body: JSON.stringify({ state: next }) });
      setSyncError(null);
      setSyncStatus('online');
    } catch (error) {
      const remoteError = error as RemoteError;
      setSyncError(remoteError.message);
      setSyncStatus(remoteError.code === 'SUPABASE_SCHEMA_MISSING' ? 'setup_required' : 'offline');
    } finally {
      pendingSyncRef.current = Math.max(0, pendingSyncRef.current - 1);
    }
  }, []);

  const queueRemoteSync = useCallback((next: AppData) => {
    pendingSyncRef.current += 1;
    syncQueueRef.current = syncQueueRef.current
      .catch(() => undefined)
      .then(() => pushRemote(next));
  }, [pushRemote]);

  const commit = useCallback((update: (previous: AppData) => AppData) => {
    const next = update(dataRef.current);
    dataRef.current = next;
    setData(next);
    void persistLocal(next);
    queueRemoteSync(next);
  }, [persistLocal, queueRemoteSync]);

  const refreshRemote = useCallback(async () => {
    if (pendingSyncRef.current > 0) return;
    try {
      const remote = await apiRequest<{ state: AppData | null }>('/somobay/state');
      if (remote.state) {
        dataRef.current = remote.state;
        setData(remote.state);
        await persistLocal(remote.state);
      }
      setSyncError(null);
      setSyncStatus('online');
    } catch (error) {
      const remoteError = error as RemoteError;
      setSyncError(remoteError.message);
      setSyncStatus(remoteError.code === 'SUPABASE_SCHEMA_MISSING' ? 'setup_required' : 'offline');
    }
  }, [persistLocal]);

  useEffect(() => {
    let active = true;
    const bootstrap = async () => {
      let localData = emptyData;
      try {
        const stored = await AsyncStorage.getItem(STORAGE_KEY);
        if (stored) localData = { ...emptyData, ...JSON.parse(stored) } as AppData;
      } catch {
        localData = emptyData;
      }
      if (!active) return;
      dataRef.current = localData;
      setData(localData);

      try {
        const remote = await apiRequest<{ state: AppData | null }>('/somobay/state');
        if (remote.state) {
          dataRef.current = remote.state;
          setData(remote.state);
          await persistLocal(remote.state);
        } else {
          pendingSyncRef.current += 1;
          await pushRemote(localData);
          await persistLocal(localData);
        }
        setSyncError(null);
        setSyncStatus('online');
      } catch (error) {
        const remoteError = error as RemoteError;
        setSyncError(remoteError.message);
        setSyncStatus(remoteError.code === 'SUPABASE_SCHEMA_MISSING' ? 'setup_required' : 'offline');
      } finally {
        if (active) setHydrated(true);
      }
    };
    void bootstrap();
    return () => { active = false; };
  }, [persistLocal, pushRemote]);

  useEffect(() => {
    if (!hydrated) return;
    const interval = setInterval(() => { void refreshRemote(); }, 5000);
    return () => clearInterval(interval);
  }, [hydrated, refreshRemote]);

  const nextId = (items: { id: number }[]) => items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const store = useMemo<Store>(() => ({
    hydrated, syncStatus, syncError, currentUser, ...data,
    login: (username, password, role) => {
      const user = data.users.find((item) => item.username === username && item.password === password && item.role === role);
      if (!user) return false;
      setCurrentUser(user); return true;
    },
    logout: () => setCurrentUser(null),
    changeAdminPassword: (oldPassword, newPassword) => {
      const admin = data.users.find((item) => item.role === 'admin' && item.password === oldPassword);
      if (!admin) return false;
      commit((previous) => ({ ...previous, users: previous.users.map((item) => item.id === admin.id ? { ...item, password: newPassword } : item) }));
      return true;
    },
    addGroup: (name, code, id) => commit((previous) => ({
      ...previous, groups: id ? previous.groups.map((item) => item.id === id ? { ...item, name, code } : item) : [...previous.groups, { id: nextId(previous.groups), name, code }],
    })),
    deleteGroup: (id) => commit((previous) => ({ ...previous, groups: previous.groups.filter((item) => item.id !== id) })),
    addEmployee: (employee) => commit((previous) => {
      const employeeId = nextId(previous.employees);
      return {
        ...previous,
        employees: [...previous.employees, { ...employee, id: employeeId }],
        users: [...previous.users, { id: nextId(previous.users), username: employee.username, password: employee.password, role: 'field_worker', employeeId }],
      };
    }),
    updateEmployee: (id, employee) => commit((previous) => ({
      ...previous,
      employees: previous.employees.map((item) => item.id === id ? { ...item, ...employee, id } : item),
      users: previous.users.map((user) => user.employeeId === id ? { ...user, username: employee.username ?? user.username, password: employee.password ?? user.password } : user),
    })),
    deleteEmployee: (id) => commit((previous) => ({
      ...previous,
      employees: previous.employees.filter((item) => item.id !== id),
      users: previous.users.filter((user) => user.employeeId !== id),
    })),
    addMember: (member) => {
      commit((previous) => ({ ...previous, members: [...previous.members, { ...member, id: nextId(previous.members) }] }));
      return true;
    },
    addLoan: (loan) => {
      commit((previous) => ({ ...previous, loans: [...previous.loans, { ...loan, id: nextId(previous.loans), paid: 0 }] }));
      return true;
    },
    updateMember: (id, member) => commit((previous) => ({ ...previous, members: previous.members.map((item) => item.id === id ? { ...item, ...member, id } : item) })),
    updateLoan: (id, loan) => commit((previous) => ({ ...previous, loans: previous.loans.map((item) => item.id === id ? { ...item, ...loan, id } : item) })),
    addCollection: (collection, status = 'draft') => commit((previous) => ({
      ...previous, collections: [...previous.collections, { ...collection, id: nextId(previous.collections), status }],
    })),
    postCollection: (id) => commit((previous) => ({ ...previous, collections: previous.collections.map((item) => item.id === id ? { ...item, status: 'posted' } : item) })),
    postCollections: (ids) => commit((previous) => {
      const idSet = new Set(ids);
      return { ...previous, collections: previous.collections.map((item) => idSet.has(item.id) ? { ...item, status: 'posted' } : item) };
    }),
    deleteCollection: (id) => commit((previous) => ({ ...previous, collections: previous.collections.filter((item) => item.id !== id) })),
    addBankTransaction: (transaction) => commit((previous) => ({ ...previous, bankTransactions: [...previous.bankTransactions, { ...transaction, id: nextId(previous.bankTransactions) }] })),
    updateMunafa: (type, percent) => commit((previous) => ({ ...previous, munafa: { ...previous.munafa, [type]: percent } })),
  }), [commit, currentUser, data, hydrated, syncError, syncStatus]);

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}