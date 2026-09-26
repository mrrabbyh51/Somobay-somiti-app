import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

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

type Store = {
  hydrated: boolean; currentUser: User | null; users: User[]; groups: Group[];
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
  addBankTransaction: (transaction: Omit<BankTransaction, 'id'>) => void;
  updateMunafa: (type: CollectionType, percent: number) => void;
};

const STORAGE_KEY = 'somobay-somiti-state-v1';
const emptyData = {
  users: [
    { id: 1, username: 'admin', password: '123456', role: 'admin' as Role },
    { id: 2, username: 'field', password: '1234', role: 'field_worker' as Role },
  ] as User[],
  groups: [] as Group[], employees: [] as Employee[], members: [] as Member[],
  loans: [] as Loan[], collections: [] as Collection[], bankTransactions: [] as BankTransaction[],
  munafa: { daily: 5, weekly: 7, monthly: 10 } as MunafaSettings,
};

const AppContext = createContext<Store | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [data, setData] = useState(emptyData);

  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((stored) => {
      if (stored) {
        try { setData({ ...emptyData, ...JSON.parse(stored) }); } catch { setData(emptyData); }
      }
      setHydrated(true);
    });
  }, []);

  useEffect(() => {
    if (hydrated) AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(data));
  }, [data, hydrated]);

  const nextId = (items: { id: number }[]) => items.reduce((max, item) => Math.max(max, item.id), 0) + 1;
  const store = useMemo<Store>(() => ({
    hydrated, currentUser, ...data,
    login: (username, password, role) => {
      const user = data.users.find((item) => item.username === username && item.password === password && item.role === role);
      if (!user) return false;
      setCurrentUser(user); return true;
    },
    logout: () => setCurrentUser(null),
    changeAdminPassword: (oldPassword, newPassword) => {
      const admin = data.users.find((item) => item.role === 'admin' && item.password === oldPassword);
      if (!admin) return false;
      setData((previous) => ({ ...previous, users: previous.users.map((item) => item.id === admin.id ? { ...item, password: newPassword } : item) }));
      return true;
    },
    addGroup: (name, code, id) => setData((previous) => ({
      ...previous, groups: id ? previous.groups.map((item) => item.id === id ? { ...item, name, code } : item) : [...previous.groups, { id: nextId(previous.groups), name, code }],
    })),
    deleteGroup: (id) => setData((previous) => ({ ...previous, groups: previous.groups.filter((item) => item.id !== id) })),
    addEmployee: (employee) => setData((previous) => ({
      ...previous, employees: [...previous.employees, { ...employee, id: nextId(previous.employees) }],
      users: [...previous.users, { id: nextId(previous.users), username: employee.username, password: employee.password, role: 'field_worker', employeeId: nextId(previous.employees) }],
    })),
    updateEmployee: (id, employee) => setData((previous) => ({
      ...previous,
      employees: previous.employees.map((item) => item.id === id ? { ...item, ...employee, id } : item),
      users: previous.users.map((user) => user.employeeId === id ? { ...user, username: employee.username ?? user.username, password: employee.password ?? user.password } : user),
    })),
    deleteEmployee: (id) => setData((previous) => ({
      ...previous,
      employees: previous.employees.filter((item) => item.id !== id),
      users: previous.users.filter((user) => user.employeeId !== id),
    })),
    addMember: (member) => {
      setData((previous) => ({ ...previous, members: [...previous.members, { ...member, id: nextId(previous.members) }] }));
      return true;
    },
    addLoan: (loan) => {
      setData((previous) => ({ ...previous, loans: [...previous.loans, { ...loan, id: nextId(previous.loans), paid: 0 }] }));
      return true;
    },
    updateMember: (id, member) => setData((previous) => ({ ...previous, members: previous.members.map((item) => item.id === id ? { ...item, ...member, id } : item) })),
    updateLoan: (id, loan) => setData((previous) => ({ ...previous, loans: previous.loans.map((item) => item.id === id ? { ...item, ...loan, id } : item) })),
    addCollection: (collection, status = 'draft') => setData((previous) => ({
      ...previous, collections: [...previous.collections, { ...collection, id: nextId(previous.collections), status }],
    })),
    postCollection: (id) => setData((previous) => ({ ...previous, collections: previous.collections.map((item) => item.id === id ? { ...item, status: 'posted' } : item) })),
    postCollections: (ids) => setData((previous) => {
      const idSet = new Set(ids);
      return { ...previous, collections: previous.collections.map((item) => idSet.has(item.id) ? { ...item, status: 'posted' } : item) };
    }),
    addBankTransaction: (transaction) => setData((previous) => ({ ...previous, bankTransactions: [...previous.bankTransactions, { ...transaction, id: nextId(previous.bankTransactions) }] })),
    updateMunafa: (type, percent) => setData((previous) => ({ ...previous, munafa: { ...previous.munafa, [type]: percent } })),
  }), [data, hydrated, currentUser]);

  return <AppContext.Provider value={store}>{children}</AppContext.Provider>;
}

export function useApp() {
  const value = useContext(AppContext);
  if (!value) throw new Error('useApp must be used inside AppProvider');
  return value;
}