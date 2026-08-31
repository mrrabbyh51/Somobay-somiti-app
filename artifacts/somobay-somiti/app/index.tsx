import * as ImagePicker from 'expo-image-picker';
import { Feather, MaterialCommunityIcons } from '@expo/vector-icons';
import DateTimePicker from '@react-native-community/datetimepicker';
import { Picker } from '@react-native-picker/picker';
import React, { useMemo, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, FlatList, Image, KeyboardAvoidingView, Modal, Platform,
  Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import colors from '@/constants/colors';
import { Collection, CollectionType, Employee, Group, Member, Role, useApp } from '@/context/AppContext';

type Screen =
  | 'home' | 'groups' | 'employees' | 'members' | 'loans' | 'bank' | 'overview'
  | 'dailyReport' | 'fieldWorkerDetails' | 'settings' | 'collection' | 'posting' | 'groupReport'
  | 'allMembers' | 'memberDetails';

type WorkerCollectionData = {
  fieldWorker: string;
  employeeId?: number;
  totalMembers: number;
  totalAmount: number;
  transactions: Collection[];
};

type GroupReportListItem = {
  member: Member;
  amount: number;
  date?: string;
};

const purple = colors.light.primary;
const formatLocalDate = (date: Date) => `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
const today = () => formatLocalDate(new Date());
const dateFromValue = (value: string) => value ? new Date(`${value}T12:00:00`) : new Date();
const money = (amount: number) => `৳ ${Math.round(amount).toLocaleString('en-IN')}`;
const bnNumber = (value: number) => value.toLocaleString('bn-BD');
const collectionTypeText = (type?: CollectionType) => type === 'daily' ? 'দৈনিক' : type === 'weekly' ? 'সাপ্তাহিক' : type === 'monthly' ? 'মাসিক' : 'নির্ধারিত নয়';
const webDateInputStyle: React.CSSProperties = {
  flex: 1,
  border: 'none',
  outline: 'none',
  backgroundColor: 'transparent',
  color: colors.light.foreground,
  fontFamily: 'Inter_400Regular',
  fontSize: 14,
  padding: 0,
};
const webHiddenDateInputStyle: React.CSSProperties = {
  position: 'absolute',
  width: 1,
  height: 1,
  opacity: 0,
  pointerEvents: 'none',
};

function Icon({ name, size = 20, color = purple }: { name: React.ComponentProps<typeof Feather>['name']; size?: number; color?: string }) {
  return <Feather name={name} size={size} color={color} />;
}

function ScreenShell({ title, onBack, children, action }: { title: string; onBack: () => void; children: React.ReactNode; action?: React.ReactNode }) {
  const insets = useSafeAreaInsets();
  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 12) }]}>
      <Pressable style={styles.headerBack} onPress={onBack} hitSlop={12}><Icon name="arrow-left" color="#fff" size={22} /></Pressable>
      <Text style={styles.headerTitle}>{title}</Text>
      {action ?? <View style={styles.headerBack} />}
    </View>
    <ScrollView contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 24) }]} keyboardShouldPersistTaps="handled">
      {children}
    </ScrollView>
  </View>;
}

function Button({ label, onPress, kind = 'primary', icon, disabled = false, small = false }: { label: string; onPress: () => void; kind?: 'primary' | 'outline' | 'soft' | 'danger'; icon?: React.ComponentProps<typeof Feather>['name']; disabled?: boolean; small?: boolean }) {
  return <Pressable onPress={onPress} disabled={disabled} style={({ pressed }) => [styles.button, kind === 'primary' ? null : styles[`button_${kind}`], small && styles.buttonSmall, disabled && styles.disabled, pressed && styles.pressed]}>
    {icon && <Icon name={icon} color={kind === 'primary' || kind === 'danger' ? '#fff' : purple} size={small ? 15 : 18} />}
    <Text style={[styles.buttonText, kind !== 'primary' && kind !== 'danger' && styles.buttonTextDark, small && styles.buttonTextSmall]}>{label}</Text>
  </Pressable>;
}

function Field({ label, placeholder, value, onChangeText, secureTextEntry, keyboardType, multiline = false, readOnly = false, icon }: { label?: string; placeholder?: string; value: string; onChangeText?: (value: string) => void; secureTextEntry?: boolean; keyboardType?: 'default' | 'numeric' | 'phone-pad'; multiline?: boolean; readOnly?: boolean; icon?: React.ComponentProps<typeof Feather>['name'] }) {
  return <View style={styles.fieldWrap}>
    {label && <Text style={styles.fieldLabel}>{label}</Text>}
    <View style={[styles.inputShell, multiline && styles.inputMulti, readOnly && styles.inputReadOnly]}>
      {icon && <Icon name={icon} size={18} color={colors.light.mutedForeground} />}
      <TextInput style={styles.input} placeholder={placeholder} placeholderTextColor="#9B8EAA" value={value} onChangeText={onChangeText} secureTextEntry={secureTextEntry} keyboardType={keyboardType} multiline={multiline} editable={!readOnly} />
    </View>
  </View>;
}

function StatCard({ icon, label, value, color = purple, onPress }: { icon: React.ComponentProps<typeof Feather>['name']; label: string; value: string; color?: string; onPress?: () => void }) {
  return <Pressable disabled={!onPress} onPress={onPress} style={({ pressed }) => [styles.statCard, pressed && onPress ? styles.pressed : null]}><View style={[styles.statIcon, { backgroundColor: `${color}18` }]}><Icon name={icon} color={color} size={20} /></View><Text style={styles.statValue}>{value}</Text><Text style={styles.statLabel}>{label}</Text></Pressable>;
}

function EmptyState({ icon = 'inbox', title, detail }: { icon?: React.ComponentProps<typeof Feather>['name']; title: string; detail: string }) {
  return <View style={styles.empty}><View style={styles.emptyIcon}><Icon name={icon} size={28} color={purple} /></View><Text style={styles.emptyTitle}>{title}</Text><Text style={styles.emptyDetail}>{detail}</Text></View>;
}

function SelectModal({ visible, title, options, onClose, onSelect }: { visible: boolean; title: string; options: { label: string; value: string }[]; onClose: () => void; onSelect: (value: string) => void }) {
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.modalBackdrop} onPress={onClose}><Pressable style={styles.sheet} onPress={() => undefined}><View style={styles.sheetHandle} /><Text style={styles.sheetTitle}>{title}</Text>{options.map((option) => <Pressable key={option.value} style={styles.optionRow} onPress={() => { onSelect(option.value); onClose(); }}><Text style={styles.optionText}>{option.label}</Text><Icon name="chevron-right" size={18} color={colors.light.mutedForeground} /></Pressable>)}<Button label="বন্ধ করুন" kind="outline" onPress={onClose} /></Pressable></Pressable></Modal>;
}

function DateModal({ visible, title, value, onClose, onSelect }: { visible: boolean; title: string; value: string; onClose: () => void; onSelect: (value: string) => void }) {
  const [month, setMonth] = useState(new Date());
  const first = new Date(month.getFullYear(), month.getMonth(), 1).getDay();
  const count = new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate();
  const months = ['জানুয়ারি', 'ফেব্রুয়ারি', 'মার্চ', 'এপ্রিল', 'মে', 'জুন', 'জুলাই', 'আগস্ট', 'সেপ্টেম্বর', 'অক্টোবর', 'নভেম্বর', 'ডিসেম্বর'];
  const days = ['রবি', 'সোম', 'মঙ্গল', 'বুধ', 'বৃহস্পতি', 'শুক্র', 'শনি'];
  return <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}><Pressable style={styles.modalBackdrop} onPress={onClose}><Pressable style={styles.sheet} onPress={() => undefined}><Text style={styles.sheetTitle}>{title}</Text><View style={styles.calendarTop}><Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}><Icon name="chevron-left" /></Pressable><Text style={styles.calendarMonth}>{months[month.getMonth()]} {month.getFullYear()}</Text><Pressable onPress={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}><Icon name="chevron-right" /></Pressable></View><View style={styles.weekRow}>{days.map((day) => <Text style={styles.weekDay} key={day}>{day.slice(0, 2)}</Text>)}</View><View style={styles.calendarGrid}>{Array.from({ length: first }).map((_, i) => <View key={`blank-${i}`} style={styles.dayCell} />)}{Array.from({ length: count }).map((_, i) => { const day = i + 1; const date = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`; return <Pressable key={date} style={[styles.dayCell, value === date && styles.daySelected]} onPress={() => { onSelect(date); onClose(); }}><Text style={[styles.dayText, value === date && styles.dayTextSelected]}>{bnNumber(day)}</Text></Pressable>; })}</View><Button label="বন্ধ করুন" kind="outline" onPress={onClose} /></Pressable></Pressable></Modal>;
}

function Login({ onLogin }: { onLogin: (role: Role, username: string, password: string) => void }) {
  const [role, setRole] = useState<Role | null>(null);
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  return <View style={styles.loginScreen}><View style={styles.loginGlow} /><View style={styles.loginContent}><View style={styles.brandMark}><MaterialCommunityIcons name="account-group-outline" size={34} color="#fff" /></View><Text style={styles.brandTitle}>সমবায় সমিতি</Text><Text style={styles.brandSubtitle}>আপনার সমিতি, আরও সহজ ব্যবস্থাপনায়</Text>{!role ? <><Text style={styles.loginPrompt}>আপনি কীভাবে প্রবেশ করতে চান?</Text><View style={styles.roleRow}><Pressable style={({ pressed }) => [styles.roleCard, styles.roleAdmin, pressed && styles.pressed]} onPress={() => setRole('admin')}><View style={styles.roleIcon}><Icon name="shield" color={purple} size={25} /></View><Text style={styles.roleTitle}>এডমিন লগইন</Text><Text style={styles.roleHint}>সম্পূর্ণ ব্যবস্থাপনা</Text></Pressable><Pressable style={({ pressed }) => [styles.roleCard, styles.roleField, pressed && styles.pressed]} onPress={() => setRole('field_worker')}><View style={[styles.roleIcon, { backgroundColor: '#E9F7EE' }]}><Icon name="user" color="#198754" size={25} /></View><Text style={styles.roleTitle}>মাঠকর্মী লগইন</Text><Text style={styles.roleHint}>আদায় ও পোস্টিং</Text></Pressable></View><View style={styles.loginNote}><Icon name="lock" size={15} color={colors.light.mutedForeground} /><Text style={styles.loginNoteText}>নিরাপদ ও সহজ প্রবেশ</Text></View></> : <View style={styles.loginForm}><Pressable style={styles.changeRole} onPress={() => { setRole(null); setError(''); }}><Icon name="arrow-left" size={16} /><Text style={styles.changeRoleText}>অন্য লগইন বেছে নিন</Text></Pressable><Text style={styles.formHeading}>{role === 'admin' ? 'এডমিন লগইন' : 'মাঠকর্মী লগইন'}</Text><Field label="ইউজারনেম" placeholder="ইউজারনেম লিখুন" value={username} onChangeText={setUsername} icon="user" /><Field label="পাসওয়ার্ড" placeholder="পাসওয়ার্ড লিখুন" value={password} onChangeText={setPassword} secureTextEntry icon="lock" />{error ? <Text style={styles.errorText}>{error}</Text> : null}<Button label="লগইন করুন" icon="log-in" onPress={() => { if (!username || !password) { setError('ইউজারনেম ও পাসওয়ার্ড লিখুন'); return; } onLogin(role, username, password); }} /><Text style={styles.demoText}>ডেমো: {role === 'admin' ? 'admin / 123456' : 'field / 1234'}</Text></View>}</View></View>;
}

const menuAdmin = [
  { key: 'groups', label: 'গ্রুপ ব্যবস্থাপনা', icon: 'users' as const, color: '#6C3BAA', detail: 'গ্রুপ ও সদস্য সংখ্যা' },
  { key: 'employees', label: 'কর্মচারীগণের তথ্য', icon: 'briefcase' as const, color: '#198754', detail: 'মাঠকর্মী পরিচালনা' },
  { key: 'members', label: 'নতুন সদস্য ভর্তি', icon: 'user-plus' as const, color: '#E17B24', detail: 'নতুন সদস্য যোগ করুন' },
  { key: 'loans', label: 'ঋণ বিতরণ', icon: 'credit-card' as const, color: '#2D7FC1', detail: 'লোন ও মুনাফা' },
  { key: 'bank', label: 'ব্যাংক লেনদেন', icon: 'dollar-sign' as const, color: '#B44875', detail: 'জমা ও উত্তোলন' },
  { key: 'dailyReport', label: 'দৈনিক আদায় রিপোর্ট', icon: 'bar-chart-2' as const, color: '#5B2C83', detail: 'আজকের সংগ্রহ' },
  { key: 'overview', label: 'এক নজরে', icon: 'pie-chart' as const, color: '#128C8C', detail: 'সমিতির সারাংশ' },
  { key: 'settings', label: 'সেটিংস', icon: 'settings' as const, color: '#756A82', detail: 'অ্যাডমিন সেটিংস' },
];
const menuField = [
  { key: 'collection', label: 'আদায়', icon: 'download' as const, color: '#198754', detail: 'সদস্যের কিস্তি নিন' },
  { key: 'posting', label: 'পোস্টিং দিন', icon: 'send' as const, color: '#5B2C83', detail: 'ড্রাফট পোস্ট করুন' },
  { key: 'groupReport', label: 'গ্রুপের রিপোর্ট', icon: 'bar-chart-2' as const, color: '#2D7FC1', detail: 'আদায়ের রিপোর্ট' },
];

function Home({ go, onLogout }: { go: (screen: Screen) => void; onLogout: () => void }) {
  const { currentUser, members, loans, collections, bankTransactions } = useApp();
  const admin = currentUser?.role === 'admin';
  const balance = bankTransactions.reduce((sum, item) => sum + (item.direction === 'deposit' ? item.amount : -item.amount), 0);
  const items = admin ? menuAdmin : menuField;
  return <View style={styles.screen}><View style={styles.homeTop}><View><Text style={styles.eyebrow}>সুপ্রভাত, {admin ? 'এডমিন' : 'মাঠকর্মী'}</Text><Text style={styles.homeTitle}>সমিতির ড্যাশবোর্ড</Text></View><Pressable style={styles.avatarButton} onPress={onLogout}><Text style={styles.avatarText}>{admin ? 'এ' : 'মা'}</Text></Pressable></View><ScrollView contentContainerStyle={styles.homeScroll}><View style={styles.heroCard}><View><Text style={styles.heroEyebrow}>আজকের কার্যক্রম</Text><Text style={styles.heroTitle}>{admin ? 'সমিতির সবকিছু এক নজরে' : 'আপনার মাঠকর্মের তালিকা'}</Text><Text style={styles.heroDetail}>{admin ? 'ডেটা দেখুন, সিদ্ধান্ত নিন, এগিয়ে চলুন' : 'আজকের আদায় ও পোস্টিং সম্পন্ন করুন'}</Text></View><View style={styles.heroShape}><MaterialCommunityIcons name="bank-outline" size={55} color="#DCC9FF" /></View></View>{admin && <View style={styles.statsRow}><StatCard icon="users" label="সদস্য" value={bnNumber(members.length)} /><StatCard icon="credit-card" label="ঋণ" value={money(loans.reduce((sum, item) => sum + item.loanAmount, 0))} color="#2D7FC1" /><StatCard icon="trending-up" label="আদায়" value={money(collections.reduce((sum, item) => sum + item.amount, 0))} color="#198754" /></View>}<Text style={styles.sectionHeading}>{admin ? 'প্রধান কাজগুলো' : 'আজকের কাজ'}</Text><View style={styles.menuGrid}>{items.map((item) => <Pressable key={item.key} style={({ pressed }) => [styles.menuCard, pressed && styles.pressed]} onPress={() => go(item.key as Screen)}><View style={[styles.menuIcon, { backgroundColor: `${item.color}16` }]}><Icon name={item.icon} color={item.color} size={22} /></View><Text style={styles.menuLabel}>{item.label}</Text><Text style={styles.menuDetail}>{item.detail}</Text><Icon name="chevron-right" color="#B3A6C1" size={17} /></Pressable>)}</View><View style={styles.tipCard}><Icon name="info" color={purple} size={18} /><Text style={styles.tipText}>সকল তথ্য আপনার এই ডিভাইসেই নিরাপদে সংরক্ষিত হচ্ছে।</Text></View></ScrollView></View>;
}

function GroupScreen({ go }: { go: () => void }) {
  const { groups, members, addGroup, deleteGroup } = useApp();
  const [modal, setModal] = useState(false); const [editing, setEditing] = useState<Group | null>(null);
  const [name, setName] = useState(''); const [code, setCode] = useState('');
  const open = (group?: Group) => { setEditing(group ?? null); setName(group?.name ?? ''); setCode(group?.code ?? ''); setModal(true); };
  return <ScreenShell title="গ্রুপ ব্যবস্থাপনা" onBack={go} action={<Pressable style={styles.headerAction} onPress={() => open()}><Icon name="plus" color="#fff" /></Pressable>}><View style={styles.listHeading}><View style={styles.titleWithIcon}><View style={styles.miniCircle}><Icon name="users" color="#fff" size={16} /></View><Text style={styles.pageHeading}>গ্রুপ তালিকা</Text></View><Text style={styles.countText}>মোট {bnNumber(groups.length)} টি</Text></View>{groups.length === 0 ? <EmptyState icon="users" title="এখনও কোনো গ্রুপ নেই" detail="উপরের + বাটনে চাপ দিয়ে প্রথম গ্রুপ তৈরি করুন" /> : groups.map((group) => <View key={group.id} style={styles.listCard}><View style={styles.listIcon}><Icon name="users" color={purple} size={22} /></View><View style={styles.listBody}><Text style={styles.listTitle}>{group.name}</Text><Text style={styles.listMeta}>কোড: {group.code}  ·  সদস্য {bnNumber(members.filter((m) => m.groupId === group.id).length)} জন</Text></View><View style={styles.verticalActions}><Pressable onPress={() => open(group)} hitSlop={8}><Icon name="edit-2" size={17} color="#756A82" /></Pressable><Pressable onPress={() => Alert.alert('গ্রুপ মুছে ফেলবেন?', 'এই কাজটি ফিরিয়ে আনা যাবে না।', [{ text: 'বাতিল', style: 'cancel' }, { text: 'মুছুন', style: 'destructive', onPress: () => deleteGroup(group.id) }])} hitSlop={8}><Icon name="trash-2" size={17} color="#C65353" /></Pressable></View></View>)}<Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}><Pressable style={styles.modalBackdrop} onPress={() => setModal(false)}><Pressable style={styles.dialog} onPress={() => undefined}><View style={styles.dialogTop}><Text style={styles.dialogTitle}>{editing ? 'গ্রুপ সম্পাদনা' : 'নতুন গ্রুপ তৈরি করুন'}</Text><Pressable onPress={() => setModal(false)}><Icon name="x" /></Pressable></View><Field label="গ্রুপ নাম" placeholder="গ্রুপের নাম লিখুন" value={name} onChangeText={setName} /><Field label="গ্রুপ কোড" placeholder="যেমন: GR-0001" value={code} onChangeText={setCode} /><Button label={editing ? 'আপডেট করুন' : 'সংরক্ষণ করুন'} icon="check" onPress={() => { if (!name.trim() || !code.trim()) { Alert.alert('অসম্পূর্ণ তথ্য', 'গ্রুপ নাম ও কোড লিখুন'); return; } addGroup(name.trim(), code.trim(), editing?.id); setModal(false); }} /></Pressable></Pressable></Modal></ScreenShell>;
}

function EmployeeScreen({ go }: { go: () => void }) {
  const { employees, groups, addEmployee } = useApp();
  const [modal, setModal] = useState(false); const [photo, setPhoto] = useState<string>(); const [groupId, setGroupId] = useState(''); const [groupSelect, setGroupSelect] = useState(false);
  const [name, setName] = useState(''), [mobile, setMobile] = useState(''), [age, setAge] = useState(''), [address, setAddress] = useState(''), [username, setUsername] = useState(''), [password, setPassword] = useState('');
  const reset = () => { setModal(false); setName(''); setMobile(''); setAge(''); setAddress(''); setUsername(''); setPassword(''); setPhoto(undefined); setGroupId(''); };
  const pick = async (camera: boolean) => { try { const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 }); if (!result.canceled) setPhoto(result.assets[0].uri); } catch { Alert.alert('ছবি নেওয়া যায়নি', 'ডিভাইসের ক্যামেরা বা গ্যালারি ব্যবহার করা সম্ভব হয়নি।'); } };
  return <><ScreenShell title="কর্মচারীগণের তথ্য" onBack={go} action={<Pressable style={styles.headerAction} onPress={() => setModal(true)}><Icon name="plus" color="#fff" /></Pressable>}><View style={styles.listHeading}><View style={styles.titleWithIcon}><View style={[styles.miniCircle, { backgroundColor: '#198754' }]}><Icon name="briefcase" color="#fff" size={16} /></View><Text style={styles.pageHeading}>মাঠকর্মী তালিকা</Text></View><Text style={styles.countText}>মোট {bnNumber(employees.length)} জন</Text></View>{employees.length === 0 ? <EmptyState icon="briefcase" title="কোনো মাঠকর্মী নেই" detail="মাঠকর্মীর তথ্য যোগ করতে উপরের + বাটনে চাপুন" /> : employees.map((employee) => <View key={employee.id} style={styles.listCard}><View style={styles.employeeAvatar}>{employee.photoPath ? <Image source={{ uri: employee.photoPath }} style={styles.avatarImage} /> : <Icon name="user" color={purple} size={22} />}</View><View style={styles.listBody}><Text style={styles.listTitle}>{employee.name}</Text><Text style={styles.listMeta}>{employee.mobile}  ·  বয়স: {bnNumber(employee.age)} বছর</Text><Text style={styles.listMeta}>{groups.find((g) => g.id === employee.groupId)?.name ?? 'গ্রুপ নির্ধারিত নয়'}</Text></View></View>)}<Modal visible={modal} transparent animationType="slide" onRequestClose={reset}><Pressable style={styles.modalBackdrop} onPress={reset}><Pressable style={styles.dialogLarge} onPress={() => undefined}><View style={styles.dialogTop}><Text style={styles.dialogTitle}>নতুন মাঠকর্মী যোগ করুন</Text><Pressable onPress={reset}><Icon name="x" /></Pressable></View><ScrollView keyboardShouldPersistTaps="handled"><View style={styles.profilePreview}>{photo ? <Image source={{ uri: photo }} style={styles.profileImage} /> : <Icon name="user" color={purple} size={42} />}</View><View style={styles.photoActions}><Button label="ক্যামেরা" kind="outline" icon="camera" onPress={() => pick(true)} small /><Button label="গ্যালারি" kind="outline" icon="image" onPress={() => pick(false)} small /></View><Field label="নাম" placeholder="নাম লিখুন" value={name} onChangeText={setName} icon="user" /><Field label="মোবাইল" placeholder="01XXXXXXXXX" value={mobile} onChangeText={setMobile} keyboardType="phone-pad" icon="phone" /><Field label="বয়স" placeholder="বয়স লিখুন" value={age} onChangeText={(v) => setAge(v.replace(/[^0-9]/g, '').slice(0, 2))} keyboardType="numeric" icon="gift" /><Field label="ঠিকানা" placeholder="ঠিকানা লিখুন" value={address} onChangeText={setAddress} icon="map-pin" /><Field label="ইউজারনেম" placeholder="ইউজারনেম লিখুন" value={username} onChangeText={setUsername} icon="at-sign" /><Field label="পাসওয়ার্ড" placeholder="পাসওয়ার্ড লিখুন" value={password} onChangeText={setPassword} secureTextEntry icon="lock" /><SelectField label="গ্রুপ অ্যাসাইন" value={groups.find((g) => String(g.id) === groupId)?.name ?? 'গ্রুপ নির্বাচন করুন'} onPress={() => setGroupSelect(true)} /><View style={styles.dialogButtons}><Button label="বাতিল" kind="outline" onPress={reset} /><Button label="সংরক্ষণ" icon="check" onPress={() => { const parsedAge = Number(age); if (!age) { Alert.alert('বয়স লিখুন'); return; } if (parsedAge < 18) { Alert.alert('বয়স সর্বনিম্ন ১৮ বছর হতে হবে'); return; } if (parsedAge > 65) { Alert.alert('বয়স ৬৫ বছরের বেশি হতে পারবে না'); return; } if (!name || !username || !password) { Alert.alert('নাম, ইউজারনেম ও পাসওয়ার্ড লিখুন'); return; } addEmployee({ name, mobile, age: parsedAge, address, username, password, groupId: groupId ? Number(groupId) : undefined, photoPath: photo }); reset(); }} /></View></ScrollView></Pressable></Pressable></Modal></ScreenShell><SelectModal visible={groupSelect} title="গ্রুপ নির্বাচন করুন" options={groups.map((group) => ({ label: `${group.name} · ${group.code}`, value: String(group.id) }))} onClose={() => setGroupSelect(false)} onSelect={setGroupId} /></>;
}

function SelectField({ label, value, onPress }: { label: string; value: string; onPress: () => void }) {
  return <View style={styles.fieldWrap}><Text style={styles.fieldLabel}>{label}</Text><Pressable style={styles.inputShell} onPress={onPress}><Text style={[styles.selectText, value.includes('নির্বাচন') && styles.placeholder]}>{value}</Text><Icon name="chevron-down" color={colors.light.mutedForeground} /></Pressable></View>;
}

function MemberDateField({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  const [showPicker, setShowPicker] = useState(false);
  if (Platform.OS === 'web') {
    return <View style={styles.fieldWrap}>
      <Text style={styles.fieldLabel}>{label}</Text>
      <View style={styles.inputShell}>
        <Icon name="calendar" size={18} color={colors.light.mutedForeground} />
        <input
          aria-label={label}
          type="date"
          value={value}
          onChange={(event) => onChange(event.currentTarget.value)}
          style={webDateInputStyle}
        />
      </View>
    </View>;
  }
  return <View style={styles.fieldWrap}>
    <Text style={styles.fieldLabel}>{label}</Text>
    <Pressable style={styles.inputShell} onPress={() => setShowPicker(true)}>
      <Icon name="calendar" size={18} color={colors.light.mutedForeground} />
      <Text style={styles.selectText}>{value || `${label} নির্বাচন করুন`}</Text>
    </Pressable>
    {showPicker && <DateTimePicker
      value={dateFromValue(value)}
      mode="date"
      display="default"
      onChange={(_, date) => {
        setShowPicker(false);
        if (date) onChange(formatLocalDate(date));
      }}
    />}
  </View>;
}

const memberFields: { key: keyof Omit<Member, 'id' | 'groupId' | 'photoPath'>; label: string; placeholder: string }[] = [
  { key: 'memberNo', label: 'সদস্য নং', placeholder: 'যেমন: 00123' }, { key: 'name', label: 'নাম', placeholder: 'সদস্যের নাম লিখুন' },
  { key: 'fatherName', label: 'পিতার নাম', placeholder: 'পিতার নাম লিখুন' }, { key: 'motherName', label: 'মাতার নাম', placeholder: 'মাতার নাম লিখুন' },
  { key: 'spouseName', label: 'স্বামী/স্ত্রী', placeholder: 'স্বামী/স্ত্রীর নাম লিখুন' }, { key: 'nid', label: 'NID', placeholder: 'জাতীয় পরিচয়পত্র নম্বর লিখুন' },
  { key: 'mobile', label: 'মোবাইল', placeholder: '01XXXXXXXXX' }, { key: 'comment', label: 'মন্তব্য', placeholder: 'মন্তব্য লিখুন...' },
  { key: 'village', label: 'গ্রাম', placeholder: 'গ্রামের নাম লিখুন' }, { key: 'unionName', label: 'ইউনিয়ন', placeholder: 'ইউনিয়নের নাম লিখুন' },
  { key: 'upazila', label: 'উপজেলা', placeholder: 'উপজেলার নাম লিখুন' }, { key: 'district', label: 'জেলা', placeholder: 'জেলার নাম লিখুন' },
];
function MemberScreen({ go }: { go: () => void }) {
  const { groups, addMember } = useApp(); const blank: Omit<Member, 'id' | 'groupId' | 'photoPath'> = { memberNo: '', name: '', fatherName: '', motherName: '', spouseName: '', birthDate: '', nid: '', mobile: '', groupName: '', groupCode: '', admissionDate: today(), comment: '', village: '', unionName: '', upazila: '', district: '' };
  const [form, setForm] = useState(blank); const [photo, setPhoto] = useState<string>(); const [selectedGroup, setSelectedGroup] = useState<Group | null>(null); const [groupSelect, setGroupSelect] = useState(false);
  const update = (key: keyof typeof form, value: string) => setForm((previous) => ({ ...previous, [key]: value }));
  const pick = async (camera: boolean) => { try { const result = camera ? await ImagePicker.launchCameraAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 }) : await ImagePicker.launchImageLibraryAsync({ mediaTypes: ImagePicker.MediaTypeOptions.Images, quality: 0.75 }); if (!result.canceled) setPhoto(result.assets[0].uri); } catch { Alert.alert('ছবি নেওয়া যায়নি'); } };
  return <><ScreenShell title="নতুন সদস্য ভর্তি করুন" onBack={go}><View style={styles.memberAvatar}>{photo ? <Image source={{ uri: photo }} style={styles.avatarImage} /> : <Icon name="user" color={purple} size={40} />}</View><View style={styles.photoActions}><Button label="ক্যামেরা" kind="outline" icon="camera" onPress={() => pick(true)} small /><Button label="গ্যালারি" kind="outline" icon="image" onPress={() => pick(false)} small /></View><View style={styles.formCard}>{memberFields.slice(0, 5).map((field) => <Field key={field.key} label={field.label} placeholder={field.placeholder} value={form[field.key] ?? ''} onChangeText={(value) => update(field.key, value)} />)}<MemberDateField label="জন্ম তারিখ" value={form.birthDate} onChange={(value) => update('birthDate', value)} />{memberFields.slice(5, 7).map((field) => <Field key={field.key} label={field.label} placeholder={field.placeholder} value={form[field.key] ?? ''} onChangeText={(value) => update(field.key, value)} />)}<SelectField label="গ্রুপ নির্বাচন করুন" value={selectedGroup ? `${selectedGroup.name} (${selectedGroup.code})` : 'গ্রুপ নির্বাচন করুন'} onPress={() => setGroupSelect(true)} /><Field label="মন্তব্য" placeholder="মন্তব্য লিখুন..." value={form.comment} onChangeText={(value) => update('comment', value)} multiline /><MemberDateField label="ভর্তি তারিখ" value={form.admissionDate} onChange={(value) => update('admissionDate', value)} /><Text style={styles.sectionHeadingSmall}>ঠিকানা</Text><View style={styles.addressGrid}>{memberFields.slice(7).map((field) => <Field key={field.key} label={field.label} placeholder={field.placeholder} value={form[field.key] ?? ''} onChangeText={(value) => update(field.key, value)} />)}</View><View style={styles.dialogButtons}><Button label="বাতিল" kind="outline" onPress={go} /><Button label="সংরক্ষণ" icon="check" onPress={() => { if (!form.memberNo || !form.name) { Alert.alert('সদস্য নং ও নাম লিখুন'); return; } if (!selectedGroup) { Alert.alert('গ্রুপ নির্বাচন করুন', 'সদস্য সংরক্ষণের আগে একটি গ্রুপ নির্বাচন করুন।'); return; } addMember({ ...form, groupName: selectedGroup.name, groupCode: selectedGroup.code, groupId: selectedGroup.id, photoPath: photo }); Alert.alert('সফল', 'সদস্যের তথ্য সংরক্ষণ হয়েছে', [{ text: 'ঠিক আছে', onPress: go }]); }} /></View></View></ScreenShell><SelectModal visible={groupSelect} title="গ্রুপ নির্বাচন করুন" options={groups.map((group) => ({ label: `${group.name} (${group.code})`, value: String(group.id) }))} onClose={() => setGroupSelect(false)} onSelect={(value) => setSelectedGroup(groups.find((group) => String(group.id) === value) ?? null)} /></>;
}

function LoanScreen({ go }: { go: () => void }) {
  const { members, loans, munafa, addLoan } = useApp(); const [memberId, setMemberId] = useState(''); const [amount, setAmount] = useState(''); const [installmentAmount, setInstallmentAmount] = useState(''); const [type, setType] = useState<CollectionType>('monthly'); const [date, setDate] = useState(today()); const [dateModal, setDateModal] = useState(false); const [memberSelect, setMemberSelect] = useState(false); const [typeSelect, setTypeSelect] = useState(false);
  const rate = munafa[type]; const loan = Number(amount.replace(/,/g, '')) || 0; const profit = loan * rate / 100; const total = loan + profit;
  return <><ScreenShell title="লোন বিতরণ ফর্ম" onBack={go}><View style={styles.loanIntro}><View style={styles.loanBankIcon}><Icon name="credit-card" color="#fff" size={23} /></View><View><Text style={styles.loanIntroTitle}>স্বয়ংক্রিয় মুনাফা হিসাব</Text><Text style={styles.loanIntroText}>মুনাফার হার পরিবর্তনযোগ্য</Text></View></View><View style={styles.formCard}><SelectField label="সদস্য নির্বাচন" value={members.find((m) => String(m.id) === memberId)?.name ?? 'সদস্য নির্বাচন করুন'} onPress={() => setMemberSelect(true)} /><Field label="লোনের পরিমাণ" placeholder="৳ ৫০,০০০" value={amount} onChangeText={setAmount} keyboardType="numeric" icon="info" /><View style={styles.autoField}><View style={styles.autoLabel}><Text style={styles.fieldLabel}>মুনাফা (অটো হিসাব)</Text><Text style={styles.autoBadge}>অটো</Text></View><View style={styles.autoValue}><Text style={styles.autoValueText}>{money(profit)}</Text><Icon name="lock" size={16} color="#8A8190" /></View><Text style={styles.helperText}>সূত্র: {money(loan)} এর {bnNumber(rate)}% = {money(profit)}</Text></View><View style={styles.autoField}><View style={styles.autoLabel}><Text style={styles.fieldLabel}>মোট পরিশোধ</Text><Text style={styles.autoBadge}>অটো</Text></View><View style={[styles.autoValue, { backgroundColor: '#F0EBF8' }]}><Text style={styles.totalText}>{money(total)}</Text><Icon name="check-circle" size={17} color="#198754" /></View></View><SelectField label="কালেকশন টাইপ" value={type === 'monthly' ? 'মাসিক (১০%)' : type === 'weekly' ? 'সাপ্তাহিক (৭%)' : 'দৈনিক (৫%)'} onPress={() => setTypeSelect(true)} /><Field label="আদায়যোগ্য কিস্তি" placeholder="যেমন: ৳ ২,০০০" value={installmentAmount} onChangeText={setInstallmentAmount} keyboardType="numeric" icon="calendar" /><Pressable onPress={() => setDateModal(true)}><Field label="শুরুর তারিখ" placeholder="তারিখ" value={date} readOnly icon="calendar" /></Pressable><Text style={styles.formNote}><Icon name="cpu" size={15} color={purple} />  নোট: মুনাফার হার মুনাফা সেটিংস থেকে পরিবর্তন করা যাবে।</Text><View style={styles.dialogButtons}><Button label="বাতিল" kind="outline" onPress={go} /><Button label="লোন সংরক্ষণ করুন" icon="save" onPress={() => { if (!memberId || !amount) { Alert.alert('সদস্য ও লোনের পরিমাণ নির্বাচন করুন'); return; } addLoan({ memberId: Number(memberId), loanAmount: loan, munafa: profit, totalPayable: total, collectionType: type, munafaPercent: rate, startDate: date, installmentAmount: installmentAmount ? Number(installmentAmount.replace(/,/g, '')) : undefined }); Alert.alert('সফল', 'লোন সংরক্ষণ হয়েছে', [{ text: 'ঠিক আছে', onPress: go }]); }} /></View></View></ScreenShell><SelectModal visible={memberSelect} title="সদস্য নির্বাচন করুন" options={members.map((member) => ({ label: `${member.name} · ${member.memberNo}`, value: String(member.id) }))} onClose={() => setMemberSelect(false)} onSelect={setMemberId} /><SelectModal visible={typeSelect} title="কালেকশন টাইপ" options={[{ label: `মাসিক (${munafa.monthly}%)`, value: 'monthly' }, { label: `সাপ্তাহিক (${munafa.weekly}%)`, value: 'weekly' }, { label: `দৈনিক (${munafa.daily}%)`, value: 'daily' }]} onClose={() => setTypeSelect(false)} onSelect={(value) => setType(value as CollectionType)} /><DateModal visible={dateModal} title="শুরুর তারিখ" value={date} onClose={() => setDateModal(false)} onSelect={setDate} /></>;
}

function CollectionScreen({ go }: { go: () => void }) {
  const { members, loans, collections, addCollection, postCollections, currentUser } = useApp();
  const [collectionFilter, setCollectionFilter] = useState<CollectionType>('daily');
  const [memberId, setMemberId] = useState('');
  const [amount, setAmount] = useState('');
  const [memberSelect, setMemberSelect] = useState(false);
  const [showDraftList, setShowDraftList] = useState(false);
  const filteredMembers = useMemo(() => members.filter((member) => loans.some((loan) => loan.memberId === member.id && loan.collectionType === collectionFilter)), [members, loans, collectionFilter]);
  const member = members.find((item) => String(item.id) === memberId);
  const selectedMemberLoan = loans.find((loan) => loan.memberId === member?.id && loan.collectionType === collectionFilter);
  const collectibleAmount = selectedMemberLoan?.installmentAmount ?? selectedMemberLoan?.collectibleAmount ?? 0;
  const draftCollections = useMemo(() => collections.filter((collection) => {
    if (collection.status !== 'draft' || collection.date !== today()) return false;
    const type = collection.collectionType ?? loans.find((loan) => loan.memberId === collection.memberId)?.collectionType;
    return type === collectionFilter;
  }), [collections, loans, collectionFilter]);
  const collectionTypeLabel = collectionFilter === 'daily' ? 'দৈনিক' : collectionFilter === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক';
  const amountValue = Number(amount.replace(/,/g, '')) || 0;
  const totalCollectedSoFar = selectedMemberLoan
    ? (selectedMemberLoan.paid ?? 0) + collections.filter((collection) => collection.memberId === member?.id && collection.status === 'posted').reduce((sum, collection) => sum + collection.amount, 0)
    : 0;
  const remaining = selectedMemberLoan ? Math.max(0, selectedMemberLoan.totalPayable - totalCollectedSoFar - amountValue) : 0;
  const saveDraft = () => {
    if (!member || !selectedMemberLoan || amountValue <= 0) {
      Alert.alert('তথ্য অসম্পূর্ণ', 'ঋণ নেওয়া সদস্য নির্বাচন করে আদায়ের পরিমাণ লিখুন');
      return;
    }
    addCollection({
      memberId: member.id,
      employeeId: currentUser?.employeeId,
      amount: amountValue,
      date: today(),
      collectionType: collectionFilter,
      memberName: member.name,
      memberPhoto: member.photoPath,
      loanAmount: selectedMemberLoan.loanAmount,
      totalCollectedSoFar,
      remaining,
      todayCollection: amountValue,
    });
    setAmount('');
    setMemberId('');
    setShowDraftList(true);
  };
  return <><ScreenShell title="আদায়" onBack={go}>
    <View style={styles.collectionHeaderRow}>
      <View style={styles.collectionTitleBlock}><Text style={styles.pageHeading}>আজকের আদায়</Text><Text style={styles.pageSubheading}>সদস্য নির্বাচন করে সংগ্রহের তথ্য লিখুন</Text></View>
      <View style={styles.smallDropdown}>
        <Picker selectedValue={collectionFilter} onValueChange={(value) => setCollectionFilter(value as CollectionType)} style={styles.smallPicker}>
          <Picker.Item label="দৈনিক" value="daily" />
          <Picker.Item label="সাপ্তাহিক" value="weekly" />
          <Picker.Item label="মাসিক" value="monthly" />
        </Picker>
      </View>
    </View>
    <View style={styles.formCard}>
      <SelectField label="সদস্য খুঁজুন" value={member ? `${member.name} · ${member.memberNo}` : `${collectionTypeLabel} ঋণের সদস্য নির্বাচন করুন`} onPress={() => setMemberSelect(true)} />
      {member && selectedMemberLoan ? <View style={styles.collectibleCard}><View><Text style={styles.collectibleLabel}>আদায় যোগ্য</Text><Text style={styles.collectibleValue}>{money(collectibleAmount)}</Text></View><View style={styles.collectibleBadge}><Icon name="clock" size={14} color="#B76B00" /><Text style={styles.collectibleBadgeText}>চলমান</Text></View><Text style={styles.collectibleHint}>ঋণ বিতরণের সময় নির্ধারিত</Text></View> : <View style={styles.selectHint}><Icon name="user-check" color={purple} /><Text style={styles.selectHintText}>{collectionTypeLabel} ঋণের সদস্য নির্বাচন করলে আদায় যোগ্য টাকা দেখা যাবে</Text></View>}
      <Field label="আদায়ের পরিমাণ" placeholder="৳ টাকা লিখুন" value={amount} onChangeText={setAmount} keyboardType="numeric" icon="dollar-sign" />
      <Button label="ড্রাফট হিসেবে সংরক্ষণ" icon="save" onPress={saveDraft} />
    </View>
  </ScreenShell>
  <SelectModal visible={memberSelect} title={`${collectionTypeLabel} ঋণের সদস্য নির্বাচন করুন`} options={filteredMembers.map((item) => ({ label: `${item.name} · ${item.memberNo}`, value: String(item.id) }))} onClose={() => setMemberSelect(false)} onSelect={setMemberId} />
  <Modal visible={showDraftList} transparent animationType="slide" onRequestClose={() => setShowDraftList(false)}>
    <Pressable style={styles.modalBackdrop} onPress={() => setShowDraftList(false)}>
      <Pressable style={styles.draftSheet} onPress={() => undefined}>
        <View style={styles.dialogTop}><Text style={styles.dialogTitle}>আজকের আদায় ড্রাফট - {collectionTypeLabel}</Text><Pressable onPress={() => setShowDraftList(false)} hitSlop={8}><Icon name="x" /></Pressable></View>
        <FlatList
          data={draftCollections}
          keyExtractor={(item) => String(item.id)}
          contentContainerStyle={draftCollections.length === 0 ? styles.draftEmptyList : undefined}
          renderItem={({ item }) => {
            const draftMember = members.find((candidate) => candidate.id === item.memberId);
            const draftLoan = loans.find((loan) => loan.memberId === item.memberId && loan.collectionType === collectionFilter);
            const draftName = item.memberName ?? draftMember?.name ?? 'সদস্য';
            const draftLoanAmount = item.loanAmount ?? draftLoan?.loanAmount ?? 0;
            const draftTotal = item.totalCollectedSoFar ?? 0;
            const draftRemaining = item.remaining ?? Math.max(0, (draftLoan?.totalPayable ?? 0) - draftTotal - item.amount);
            return <View style={styles.draftRow}>
              <View style={styles.draftAvatar}>{item.memberPhoto ?? draftMember?.photoPath ? <Image source={{ uri: item.memberPhoto ?? draftMember?.photoPath }} style={styles.draftImage} /> : <Icon name="user" color={purple} size={21} />}</View>
              <View style={styles.draftInfo}><Text style={styles.draftName}>{draftName}</Text><Text style={styles.draftMeta}>ঋণের পরিমাণ: {money(draftLoanAmount)}</Text><Text style={styles.draftMeta}>মোট আদায়: {money(draftTotal)} · বাকি: {money(draftRemaining)}</Text></View>
              <Text style={styles.draftAmount}>{money(item.todayCollection ?? item.amount)}</Text>
            </View>;
          }}
          ListEmptyComponent={<EmptyState icon="save" title="আজকের কোনো ড্রাফট নেই" detail="এই collection type-এর draft এখানে দেখা যাবে" />}
        />
        <Button label="পোস্ট করুন (সব আদায় জমা দিন)" icon="send" disabled={draftCollections.length === 0} onPress={() => { postCollections(draftCollections.map((item) => item.id)); setShowDraftList(false); Alert.alert('পোস্ট হয়েছে', `${bnNumber(draftCollections.length)} টি আদায় পোস্ট করা হয়েছে`); }} />
        <View style={styles.draftCloseButton}><Button label="বন্ধ করুন" kind="outline" onPress={() => setShowDraftList(false)} /></View>
      </Pressable>
    </Pressable>
  </Modal></>;
}

function PostingScreen({ go }: { go: () => void }) {
  const { collections, members, postCollection } = useApp(); const drafts = collections.filter((c) => c.status === 'draft');
  return <ScreenShell title="পোস্টিং দিন" onBack={go}><Text style={styles.pageHeading}>ড্রাফট আদায়</Text><Text style={styles.pageSubheading}>যাচাই করে পোস্ট করলে হিসাবের অন্তর্ভুক্ত হবে</Text>{drafts.length === 0 ? <EmptyState icon="send" title="কোনো ড্রাফট নেই" detail="আদায় স্ক্রিন থেকে নতুন ড্রাফট তৈরি করুন" /> : drafts.map((item) => <View key={item.id} style={styles.postCard}><View style={styles.listIcon}><Icon name="file-text" color={purple} /></View><View style={styles.listBody}><Text style={styles.listTitle}>{members.find((m) => m.id === item.memberId)?.name ?? 'সদস্য'}</Text><Text style={styles.listMeta}>{item.date} · {money(item.amount)}</Text></View><Button label="পোস্ট" icon="send" small onPress={() => { postCollection(item.id); Alert.alert('পোস্ট হয়েছে', 'আদায়ের হিসাব পোস্ট করা হয়েছে'); }} /></View>)}</ScreenShell>;
}

function GroupReportDateField({ label, value, onChange, showPicker, setShowPicker }: { label: string; value: Date; onChange: (value: Date) => void; showPicker: boolean; setShowPicker: (value: boolean) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dateValue = formatLocalDate(value);
  const openWebPicker = () => {
    try {
      inputRef.current?.click();
    } catch {
      // Some browsers do not expose a programmatic date picker.
    }
  };

  if (Platform.OS === 'web') {
    return <View style={styles.dateChipWebWrap}>
      <Pressable onPress={openWebPicker} style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]}>
        <Icon name="calendar" size={17} color={purple} />
        <Text numberOfLines={1} style={styles.dateChipText}>{label}: {value.toLocaleDateString('bn-BD')}</Text>
      </Pressable>
      <input
        ref={inputRef}
        aria-label={label}
        type="date"
        value={dateValue}
        onChange={(event) => {
          const nextValue = event.currentTarget.value;
          if (nextValue) onChange(dateFromValue(nextValue));
        }}
        style={webHiddenDateInputStyle}
      />
    </View>;
  }

  return <View>
    <Pressable onPress={() => setShowPicker(true)} style={({ pressed }) => [styles.dateChip, pressed && styles.pressed]}>
      <Icon name="calendar" size={17} color={purple} />
      <Text numberOfLines={1} style={styles.dateChipText}>{label}: {value.toLocaleDateString('bn-BD')}</Text>
    </Pressable>
    {showPicker && <DateTimePicker
      value={value}
      mode="date"
      display="default"
      onChange={(_, date) => {
        setShowPicker(false);
        if (date) onChange(date);
      }}
    />}
  </View>;
}

function GroupReport({ go }: { go: () => void }) {
  const { collections, groups, loans, members } = useApp();
  const [fromDate, setFromDate] = useState(new Date());
  const [toDate, setToDate] = useState(new Date());
  const [showFrom, setShowFrom] = useState(false);
  const [showTo, setShowTo] = useState(false);
  const [filterType, setFilterType] = useState<'collected' | 'due'>('collected');
  const [selectedGroupId, setSelectedGroupId] = useState<number | null>(null);
  const [groupSelect, setGroupSelect] = useState(false);
  const activeGroupId = selectedGroupId ?? groups[0]?.id;
  const selectedGroup = groups.find((group) => group.id === activeGroupId);
  const groupMembers = useMemo(() => members.filter((member) => member.groupId === activeGroupId), [members, activeGroupId]);
  const fromKey = formatLocalDate(fromDate);
  const toKey = formatLocalDate(toDate);
  const filteredTransactions = useMemo(
    () => collections.filter((collection) => collection.status === 'posted' && collection.date >= fromKey && collection.date <= toKey && groupMembers.some((member) => member.id === collection.memberId)),
    [collections, fromKey, toKey, groupMembers],
  );
  const collectedMembers = useMemo(() => {
    const transactionsByMember = new Map<number, Collection[]>();
    filteredTransactions.forEach((transaction) => {
      const previous = transactionsByMember.get(transaction.memberId) ?? [];
      transactionsByMember.set(transaction.memberId, [...previous, transaction]);
    });
    return groupMembers.flatMap((member) => {
      const transactions = transactionsByMember.get(member.id);
      if (!transactions?.length) return [];
      return [{
        member,
        amount: transactions.reduce((sum, transaction) => sum + transaction.amount, 0),
        date: transactions.reduce((latest, transaction) => transaction.date > latest ? transaction.date : latest, transactions[0].date),
      }];
    });
  }, [filteredTransactions, groupMembers]);
  const dueMembers = useMemo(() => {
    const collectedIds = new Set(filteredTransactions.map((transaction) => transaction.memberId));
    return groupMembers.filter((member) => !collectedIds.has(member.id)).map((member) => {
      const loan = loans.find((item) => item.memberId === member.id);
      return { member, dueAmount: Math.max(0, (loan?.totalPayable ?? 0) - (loan?.paid ?? 0)) };
    });
  }, [filteredTransactions, groupMembers, loans]);
  const total = filteredTransactions.reduce((sum, transaction) => sum + transaction.amount, 0);
  const displayList: GroupReportListItem[] = filterType === 'collected'
    ? collectedMembers
    : dueMembers.map(({ member, dueAmount }) => ({ member, amount: dueAmount }));

  return <><ScreenShell title="গ্রুপের রিপোর্ট" onBack={go}>
    <View style={styles.reportHero}>
      <Text style={styles.reportLabel}>{selectedGroup ? `${selectedGroup.name} · মোট আদায়` : 'মোট আদায়'}</Text>
      <Text style={styles.reportValue}>{money(total)}</Text>
      <Text style={styles.reportMeta}>{bnNumber(filteredTransactions.length)} টি লেনদেন · {bnNumber(groupMembers.length)} জন সদস্য</Text>
    </View>
    {groups.length === 0
      ? <View style={styles.reportGroupEmpty}><Icon name="users" color={purple} size={17} /><Text style={styles.reportGroupEmptyText}>রিপোর্ট দেখতে আগে একটি গ্রুপ তৈরি করুন</Text></View>
      : <SelectField label="গ্রুপ নির্বাচন" value={selectedGroup ? `${selectedGroup.name} · ${selectedGroup.code}` : 'গ্রুপ নির্বাচন করুন'} onPress={() => setGroupSelect(true)} />}
    <View style={styles.reportFilterRow}>
      <View style={styles.reportDatePair}>
        <GroupReportDateField label="থেকে" value={fromDate} onChange={setFromDate} showPicker={showFrom} setShowPicker={setShowFrom} />
        <GroupReportDateField label="পর্যন্ত" value={toDate} onChange={setToDate} showPicker={showTo} setShowPicker={setShowTo} />
      </View>
      <View style={styles.dropdownContainer}>
        <Picker selectedValue={filterType} onValueChange={(value) => setFilterType(value as 'collected' | 'due')} style={styles.reportPicker}>
          <Picker.Item label="আদায়" value="collected" />
          <Picker.Item label="বাকি" value="due" />
        </Picker>
      </View>
    </View>
    <Text style={styles.sectionHeadingSmall}>{filterType === 'collected' ? 'আদায় করা সদস্য' : 'বাকি থাকা সদস্য'}</Text>
    {displayList.length === 0
      ? <EmptyState icon={filterType === 'collected' ? 'check-circle' : 'clock'} title={filterType === 'collected' ? 'এই সময়ে কোনো আদায় নেই' : 'কোনো বাকি সদস্য নেই'} detail={filterType === 'collected' ? 'নির্বাচিত তারিখে পোস্টেড আদায় এখানে দেখা যাবে' : 'নির্বাচিত সময়ে সব সদস্যের আদায় পাওয়া গেছে'} />
      : displayList.map((item) => <View key={item.member.id} style={styles.listCard}>
        <View style={styles.employeeAvatar}>{item.member.photoPath ? <Image source={{ uri: item.member.photoPath }} style={styles.avatarImage} /> : <Icon name="user" color={purple} size={21} />}</View>
        <View style={styles.listBody}>
          <Text style={styles.listTitle}>{item.member.name}</Text>
          <Text style={styles.listMeta}>সদস্য নং: {item.member.memberNo} · {selectedGroup?.name ?? item.member.groupName}</Text>
          <Text style={styles.listMeta}>{filterType === 'collected' ? `শেষ আদায়: ${item.date ?? '—'}` : 'নির্বাচিত সময়ে আদায় হয়নি'}</Text>
        </View>
        <Text style={filterType === 'collected' ? styles.amountGreen : styles.amountDue}>{money(item.amount)}</Text>
      </View>)}
  </ScreenShell><SelectModal visible={groupSelect} title="গ্রুপ নির্বাচন করুন" options={groups.map((group) => ({ label: `${group.name} · ${group.code}`, value: String(group.id) }))} onClose={() => setGroupSelect(false)} onSelect={(value) => setSelectedGroupId(Number(value))} /></>;
}

function BankScreen({ go }: { go: () => void }) {
  const { bankTransactions, employees, members, addBankTransaction } = useApp(); const [direction, setDirection] = useState<'deposit' | 'withdrawal'>('deposit'); const [source, setSource] = useState<'employee' | 'member'>('member'); const [sourceId, setSourceId] = useState(''); const [amount, setAmount] = useState(''); const [date, setDate] = useState(today()); const [nameSelect, setNameSelect] = useState(false);
  const balance = bankTransactions.reduce((sum, item) => sum + (item.direction === 'deposit' ? item.amount : -item.amount), 0); const deposited = bankTransactions.filter((t) => t.direction === 'deposit').reduce((s, t) => s + t.amount, 0); const withdrawn = bankTransactions.filter((t) => t.direction === 'withdrawal').reduce((s, t) => s + t.amount, 0);
  return <><ScreenShell title="ব্যাংক লেনদেন" onBack={go}><View style={styles.balanceCard}><Text style={styles.balanceLabel}>নতুন ব্যালেন্স</Text><Text style={styles.balanceValue}>{money(balance)}</Text><Text style={styles.balanceMeta}>মোট জমা {money(deposited)} · উত্তোলন {money(withdrawn)}</Text></View><View style={styles.segment}><Pressable style={[styles.segmentItem, direction === 'deposit' && styles.segmentActive]} onPress={() => setDirection('deposit')}><Text style={[styles.segmentText, direction === 'deposit' && styles.segmentTextActive]}>জমা</Text></Pressable><Pressable style={[styles.segmentItem, direction === 'withdrawal' && styles.segmentActive]} onPress={() => setDirection('withdrawal')}><Text style={[styles.segmentText, direction === 'withdrawal' && styles.segmentTextActive]}>উত্তোলন</Text></Pressable></View><View style={styles.formCard}><SelectField label="ধরণ" value={source === 'member' ? 'সদস্য' : 'মাঠকর্মী'} onPress={() => { setSource(source === 'member' ? 'employee' : 'member'); setSourceId(''); }} /><SelectField label="নাম" value={(source === 'member' ? members.find((m) => String(m.id) === sourceId)?.name : employees.find((e) => String(e.id) === sourceId)?.name) ?? 'নাম নির্বাচন করুন'} onPress={() => setNameSelect(true)} /><Field label="টাকার পরিমাণ" placeholder="৳ টাকা লিখুন" value={amount} onChangeText={setAmount} keyboardType="numeric" icon="dollar-sign" /><Field label="তারিখ" placeholder="তারিখ" value={date} onChangeText={setDate} icon="calendar" /><Button label="লেনদেন সংরক্ষণ করুন" icon="save" onPress={() => { if (!amount) { Alert.alert('টাকার পরিমাণ লিখুন'); return; } addBankTransaction({ direction, sourceType: source, sourceId: sourceId ? Number(sourceId) : undefined, amount: Number(amount), date }); setAmount(''); Alert.alert('সফল', 'লেনদেন সংরক্ষণ হয়েছে'); }} /></View></ScreenShell><SelectModal visible={nameSelect} title="নাম নির্বাচন করুন" options={(source === 'member' ? members : employees).map((item) => ({ label: `${item.name}`, value: String(item.id) }))} onClose={() => setNameSelect(false)} onSelect={setSourceId} /></>;
}

function Overview({ go, onOpenMembers }: { go: () => void; onOpenMembers: () => void }) {
  const { members, loans, collections, bankTransactions } = useApp(); const totalLoan = loans.reduce((s, l) => s + l.loanAmount, 0); const totalCollection = collections.reduce((s, c) => s + c.amount, 0); const balance = bankTransactions.reduce((s, t) => s + (t.direction === 'deposit' ? t.amount : -t.amount), 0);
  return <ScreenShell title="এক নজরে" onBack={go}><Text style={styles.pageHeading}>সমিতির সারাংশ</Text><Text style={styles.pageSubheading}>আপনার সমিতির বর্তমান চিত্র</Text><View style={styles.overviewGrid}><StatCard icon="users" label="মোট সদস্য" value={bnNumber(members.length)} onPress={onOpenMembers} /><StatCard icon="credit-card" label="মোট ঋণ" value={money(totalLoan)} color="#2D7FC1" /><StatCard icon="trending-up" label="মোট আদায়" value={money(totalCollection)} color="#198754" /><StatCard icon="briefcase" label="ব্যাংক ব্যালেন্স" value={money(balance)} color="#B44875" /></View><View style={styles.insightCard}><View style={styles.insightIcon}><Icon name="activity" color="#198754" /></View><View><Text style={styles.listTitle}>আজকের আপডেট</Text><Text style={styles.listMeta}>পোস্টেড আদায়: {bnNumber(collections.filter((c) => c.status === 'posted').length)} টি</Text><Text style={styles.listMeta}>ড্রাফট: {bnNumber(collections.filter((c) => c.status === 'draft').length)} টি</Text></View></View></ScreenShell>;
}

function MemberInfoCard({ label, value }: { label: string; value: string }) {
  return <View style={styles.memberInfoCard}><Text style={styles.memberInfoLabel}>{label}</Text><Text style={styles.memberInfoValue}>{value || 'তথ্য নেই'}</Text></View>;
}

function AllMembersList({ go, onOpenMember }: { go: () => void; onOpenMember: (memberId: number) => void }) {
  const { members } = useApp();
  const [query, setQuery] = useState('');
  const insets = useSafeAreaInsets();
  const filteredMembers = useMemo(() => {
    const search = query.trim().toLocaleLowerCase();
    if (!search) return members;
    return members.filter((member) => [member.name, member.memberNo, member.groupName, member.groupCode].some((value) => value.toLocaleLowerCase().includes(search)));
  }, [members, query]);

  return <View style={styles.screen}>
    <View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 12) }]}>
      <Pressable style={styles.headerBack} onPress={go} hitSlop={12}><Icon name="arrow-left" color="#fff" size={22} /></Pressable>
      <Text style={styles.headerTitle}>সমিতির সকল সদস্য</Text>
      <View style={styles.headerBack} />
    </View>
    <FlatList
      data={filteredMembers}
      keyExtractor={(item) => String(item.id)}
      contentContainerStyle={[styles.memberListContent, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 24) }]}
      ListHeaderComponent={<View><Text style={styles.pageHeading}>সমিতির সকল সদস্য ({bnNumber(members.length)} জন)</Text><View style={styles.memberSearch}><Icon name="search" color={colors.light.mutedForeground} size={18} /><TextInput value={query} onChangeText={setQuery} placeholder="সদস্য খুঁজুন (নাম/নং/গ্রুপ)" placeholderTextColor="#9B8EAA" style={styles.memberSearchInput} /></View><Text style={styles.memberResultText}>{bnNumber(filteredMembers.length)} জন সদস্য পাওয়া গেছে</Text></View>}
      renderItem={({ item }) => <Pressable onPress={() => onOpenMember(item.id)} style={({ pressed }) => [styles.memberListRow, pressed && styles.pressed]}>
        <View style={styles.memberListAvatar}>{item.photoPath ? <Image source={{ uri: item.photoPath }} style={styles.memberListImage} /> : <Icon name="user" color={purple} size={24} />}</View>
        <View style={styles.memberListBody}><Text style={styles.memberListName}>{item.name}</Text><Text style={styles.memberListMeta}>সদস্য নং: {item.memberNo}</Text><Text style={styles.memberListGroup}>{item.groupName || 'গ্রুপ নির্ধারিত নয়'}{item.groupCode ? ` · ${item.groupCode}` : ''}</Text></View>
        <Icon name="chevron-right" size={20} color={colors.light.mutedForeground} />
      </Pressable>}
      ListEmptyComponent={<EmptyState icon="users" title="কোনো সদস্য পাওয়া যায়নি" detail="নাম, সদস্য নং বা গ্রুপ দিয়ে আবার খুঁজুন" />}
    />
  </View>;
}

function MemberDetails({ go, memberId }: { go: () => void; memberId: number }) {
  const { members, loans, collections, employees } = useApp();
  const [activeTab, setActiveTab] = useState<'personal' | 'loan'>('personal');
  const member = members.find((item) => item.id === memberId);
  const memberLoans = loans.filter((loan) => loan.memberId === memberId).sort((a, b) => b.id - a.id);
  const selectedLoan = memberLoans[0];
  const transactions = collections.filter((transaction) => transaction.memberId === memberId).sort((a, b) => b.date.localeCompare(a.date) || b.id - a.id);
  const postedTotal = transactions.filter((transaction) => transaction.status === 'posted').reduce((sum, transaction) => sum + transaction.amount, 0);
  const totalCollected = (selectedLoan?.paid ?? 0) + postedTotal;
  const remaining = selectedLoan ? Math.max(0, selectedLoan.totalPayable - totalCollected) : 0;
  const collectibleAmount = selectedLoan?.installmentAmount ?? selectedLoan?.collectibleAmount ?? 0;
  const address = member ? [member.village, member.unionName, member.upazila, member.district].filter(Boolean).join(', ') : '';

  if (!member) return <ScreenShell title="সদস্য বিবরণ" onBack={go}><EmptyState icon="user" title="সদস্যের তথ্য পাওয়া যায়নি" detail="সদস্য তালিকায় ফিরে গিয়ে আবার নির্বাচন করুন" /></ScreenShell>;

  return <ScreenShell title="সদস্য বিবরণ" onBack={go}>
    <View style={styles.memberProfileHeader}>
      <View style={styles.memberProfileAvatar}>{member.photoPath ? <Image source={{ uri: member.photoPath }} style={styles.memberProfileImage} /> : <Icon name="user" color={purple} size={34} />}</View>
      <View style={styles.memberProfileInfo}><Text style={styles.memberProfileName}>{member.name}</Text><Text style={styles.memberProfileMeta}>সদস্য নং: {member.memberNo}</Text><Text style={styles.memberProfileGroup}>{member.groupName || 'গ্রুপ নির্ধারিত নয়'}{member.groupCode ? ` · ${member.groupCode}` : ''}</Text></View>
    </View>
    <View style={styles.memberTabs}>
      <Pressable onPress={() => setActiveTab('personal')} style={[styles.memberTab, activeTab === 'personal' && styles.memberTabActive]}><Text style={[styles.memberTabText, activeTab === 'personal' && styles.memberTabTextActive]}>১. ব্যক্তিগত</Text></Pressable>
      <Pressable onPress={() => setActiveTab('loan')} style={[styles.memberTab, activeTab === 'loan' && styles.memberTabActive]}><Text style={[styles.memberTabText, activeTab === 'loan' && styles.memberTabTextActive]}>২. ঋণ বিবরণ</Text></Pressable>
    </View>
    {activeTab === 'personal'
      ? <View style={styles.memberInfoList}>
        <Text style={styles.sectionHeadingSmall}>ব্যক্তিগত তথ্য</Text>
        <MemberInfoCard label="নাম" value={member.name} />
        <MemberInfoCard label="পিতার নাম" value={member.fatherName} />
        <MemberInfoCard label="স্বামী/স্ত্রীর নাম" value={member.spouseName} />
        <MemberInfoCard label="মাতার নাম" value={member.motherName} />
        <MemberInfoCard label="NID" value={member.nid} />
        <MemberInfoCard label="মোবাইল" value={member.mobile} />
        <MemberInfoCard label="জন্ম তারিখ" value={member.birthDate} />
        <MemberInfoCard label="ভর্তি তারিখ" value={member.admissionDate} />
        <MemberInfoCard label="গ্রুপ নাম" value={member.groupName} />
        <MemberInfoCard label="গ্রুপ কোড" value={member.groupCode} />
        <MemberInfoCard label="ঠিকানা" value={address} />
        <MemberInfoCard label="মন্তব্য" value={member.comment} />
        <MemberInfoCard label="নমিনি" value={member.nomineeName ?? ''} />
        <MemberInfoCard label="পেশা" value={member.profession ?? ''} />
      </View>
      : <View style={styles.memberInfoList}>
        <Text style={styles.sectionHeadingSmall}>ঋণ বিতরণ তথ্য</Text>
        {selectedLoan ? <View style={styles.loanDetailsCard}>
          <MemberInfoCard label="ঋণের পরিমাণ" value={money(selectedLoan.loanAmount)} />
          <MemberInfoCard label="আদায় যোগ্য" value={`${money(collectibleAmount)} (${collectionTypeText(selectedLoan.collectionType)})`} />
          <MemberInfoCard label="কালেকশন টাইপ" value={collectionTypeText(selectedLoan.collectionType)} />
          <MemberInfoCard label="বিতরণ তারিখ" value={selectedLoan.startDate} />
          <MemberInfoCard label="মুনাফা" value={`${bnNumber(selectedLoan.munafaPercent)}% · ${money(selectedLoan.munafa)}`} />
          <MemberInfoCard label="মোট পরিশোধযোগ্য" value={money(selectedLoan.totalPayable)} />
        </View> : <EmptyState icon="credit-card" title="কোনো ঋণের তথ্য নেই" detail="এই সদস্যের জন্য এখনো কোনো ঋণ বিতরণ করা হয়নি" />}
        <Text style={styles.sectionHeadingSmall}>আদায় ইতিহাস</Text>
        {transactions.length === 0 ? <EmptyState icon="clock" title="কোনো আদায় ইতিহাস নেই" detail="এই সদস্যের আদায় এখানে দেখা যাবে" /> : transactions.map((transaction) => {
          const collector = transaction.employeeId ? employees.find((employee) => employee.id === transaction.employeeId)?.name : undefined;
          const transactionLoan = loans.find((loan) => loan.memberId === memberId && loan.collectionType === transaction.collectionType) ?? selectedLoan;
          return <View key={transaction.id} style={styles.collectionHistoryRow}><View style={styles.collectionHistoryInfo}><Text style={styles.collectionHistoryTitle}>{transaction.date} · {collector ?? 'মাঠকর্মী নির্ধারিত নয়'}</Text><Text style={styles.collectionHistoryMeta}>{collectionTypeText(transaction.collectionType ?? transactionLoan?.collectionType)}{transaction.status === 'draft' ? ' · ড্রাফট' : ' · পোস্টেড'}</Text></View><Text style={transaction.status === 'posted' ? styles.amountGreen : styles.amountDue}>{money(transaction.amount)}</Text></View>;
        })}
        <View style={styles.memberSummaryCard}><Text style={styles.memberSummaryTitle}>হিসাবের সারাংশ</Text><Text style={styles.memberSummaryText}>মোট আদায়: <Text style={styles.memberSummaryGreen}>{money(totalCollected)}</Text>  ·  বাকি: <Text style={styles.memberSummaryDue}>{money(remaining)}</Text></Text></View>
      </View>}
  </ScreenShell>;
}

function DailyReport({ go, onOpenWorker }: { go: () => void; onOpenWorker: (workerData: WorkerCollectionData) => void }) {
  const { collections, employees } = useApp();
  const todayItems = collections.filter((collection) => collection.date === today());
  const posted = todayItems.filter((collection) => collection.status === 'posted').reduce((sum, collection) => sum + collection.amount, 0);
  const draft = todayItems.filter((collection) => collection.status === 'draft').reduce((sum, collection) => sum + collection.amount, 0);
  const workerGroups = useMemo<WorkerCollectionData[]>(() => {
    const grouped = new Map<string, WorkerCollectionData>();
    todayItems.forEach((transaction) => {
      const employee = employees.find((item) => item.id === transaction.employeeId);
      const workerKey = transaction.employeeId ? `employee-${transaction.employeeId}` : 'unassigned';
      const fieldWorker = employee?.name ?? 'মাঠকর্মী নির্ধারিত নয়';
      const existing = grouped.get(workerKey);
      if (existing) {
        existing.transactions.push(transaction);
        existing.totalAmount += transaction.amount;
        existing.totalMembers = new Set(existing.transactions.map((item) => item.memberId)).size;
      } else {
        grouped.set(workerKey, {
          fieldWorker,
          employeeId: transaction.employeeId,
          totalMembers: 1,
          totalAmount: transaction.amount,
          transactions: [transaction],
        });
      }
    });
    return Array.from(grouped.values());
  }, [todayItems, employees]);

  return <ScreenShell title="দৈনিক আদায় রিপোর্ট" onBack={go}><View style={styles.reportHero}><Text style={styles.reportLabel}>আজকের মোট আদায়</Text><Text style={styles.reportValue}>{money(posted + draft)}</Text><Text style={styles.reportMeta}>{today()}</Text></View><View style={styles.statsRow}><StatCard icon="check-circle" label="পোস্টেড" value={money(posted)} color="#198754" /><StatCard icon="clock" label="ড্রাফট" value={money(draft)} color="#B76B00" /></View><Text style={styles.sectionHeadingSmall}>আজকের লেনদেন</Text>{workerGroups.length === 0 ? <EmptyState icon="calendar" title="আজ কোনো আদায় নেই" detail="মাঠকর্মীর সংগ্রহ এখানে দেখা যাবে" /> : workerGroups.map((item) => <Pressable key={item.employeeId ?? 'unassigned'} style={({ pressed }) => [styles.fieldWorkerCard, pressed && styles.pressed]} onPress={() => onOpenWorker(item)}><View style={styles.fieldWorkerTopRow}><View style={styles.fieldWorkerIdentity}><View style={styles.fieldWorkerAvatar}><Text style={styles.fieldWorkerAvatarText}>{item.fieldWorker.charAt(0)}</Text></View><View style={styles.fieldWorkerInfo}><Text style={styles.fieldWorkerName}>{item.fieldWorker}</Text><Text style={styles.fieldWorkerMeta}>{bnNumber(item.totalMembers)} জন সদস্য থেকে আদায়</Text></View></View><View style={styles.fieldWorkerAmountWrap}><Text style={styles.fieldWorkerAmount}>{money(item.totalAmount)}</Text><Text style={styles.fieldWorkerLink}>বিস্তারিত দেখুন →</Text></View></View></Pressable>)}</ScreenShell>;
}

function FieldWorkerCollectionDetails({ go, workerData }: { go: () => void; workerData: WorkerCollectionData }) {
  const { members } = useApp();
  const memberTransactions = workerData.transactions.map((transaction) => ({
    transaction,
    member: members.find((item) => item.id === transaction.memberId),
  }));
  const insets = useSafeAreaInsets();

  return <View style={styles.screen}><View style={[styles.header, { paddingTop: Math.max(insets.top, Platform.OS === 'web' ? 67 : 12) }]}><Pressable style={styles.headerBack} onPress={go} hitSlop={12}><Icon name="arrow-left" color="#fff" size={22} /></Pressable><Text style={styles.headerTitle}>{workerData.fieldWorker} এর আজকের আদায়</Text><View style={styles.headerBack} /></View><FlatList data={memberTransactions} keyExtractor={(item) => String(item.transaction.id)} contentContainerStyle={[styles.scroll, { paddingBottom: Math.max(insets.bottom, Platform.OS === 'web' ? 34 : 24) }]} ListHeaderComponent={<><View style={styles.workerSummaryCard}><Text style={styles.workerSummaryLabel}>মাঠকর্মী</Text><Text style={styles.workerSummaryName}>{workerData.fieldWorker}</Text><View style={styles.workerSummaryStats}><View style={styles.workerSummaryStat}><Text style={styles.workerSummaryStatLabel}>আজ আদায়</Text><Text style={styles.workerSummaryStatValue}>{bnNumber(workerData.totalMembers)} জন</Text></View><View style={styles.workerSummaryStat}><Text style={styles.workerSummaryStatLabel}>মোট</Text><Text style={styles.workerSummaryStatValue}>{money(workerData.totalAmount)}</Text></View></View></View><Text style={styles.sectionHeadingSmall}>সদস্যভিত্তিক আদায়</Text></>} renderItem={({ item }) => <View style={styles.memberRow}><View style={styles.workerMemberAvatar}>{item.member?.photoPath ? <Image source={{ uri: item.member.photoPath }} style={styles.workerMemberImage} /> : <Icon name="user" color={purple} size={22} />}</View><View style={styles.workerMemberInfo}><Text style={styles.workerMemberName}>{item.member?.name ?? 'সদস্যের তথ্য পাওয়া যায়নি'}</Text><Text style={styles.workerMemberGroup}>{item.member?.groupName ?? 'গ্রুপ নির্ধারিত নয়'}</Text></View><Text style={styles.workerMemberAmount}>{money(item.transaction.amount)}</Text></View>} ListEmptyComponent={<EmptyState icon="users" title="কোনো সদস্যের তথ্য নেই" detail="এই মাঠকর্মীর আজকের লেনদেনে সদস্য পাওয়া যায়নি" />} /></View>;
}

function Settings({ go }: { go: () => void }) {
  const { changeAdminPassword, munafa, updateMunafa } = useApp(); const [oldPassword, setOldPassword] = useState(''); const [newPassword, setNewPassword] = useState(''); const [again, setAgain] = useState('');
  return <ScreenShell title="সেটিংস" onBack={go}><View style={styles.settingsHeader}><View style={styles.settingsIcon}><Icon name="settings" color="#fff" size={25} /></View><View><Text style={styles.pageHeading}>অ্যাডমিন সেটিংস</Text><Text style={styles.pageSubheading}>নিরাপত্তা ও মুনাফা নিয়ন্ত্রণ</Text></View></View><View style={styles.formCard}><Text style={styles.sectionHeadingSmall}>পাসওয়ার্ড পরিবর্তন</Text><Field label="পুরাতন পাসওয়ার্ড" placeholder="পুরাতন পাসওয়ার্ড লিখুন" value={oldPassword} onChangeText={setOldPassword} secureTextEntry icon="lock" /><Field label="নতুন পাসওয়ার্ড" placeholder="নতুন পাসওয়ার্ড লিখুন" value={newPassword} onChangeText={setNewPassword} secureTextEntry icon="key" /><Field label="নতুন পাসওয়ার্ড আবার দিন" placeholder="পুনরায় লিখুন" value={again} onChangeText={setAgain} secureTextEntry icon="check" /><Button label="পাসওয়ার্ড সংরক্ষণ করুন" icon="shield" onPress={() => { if (!newPassword || newPassword !== again) { Alert.alert('পাসওয়ার্ড মিলছে না'); return; } if (!changeAdminPassword(oldPassword, newPassword)) { Alert.alert('পুরাতন পাসওয়ার্ড সঠিক নয়'); return; } setOldPassword(''); setNewPassword(''); setAgain(''); Alert.alert('সফল', 'পাসওয়ার্ড পরিবর্তন হয়েছে'); }} /></View><View style={styles.formCard}><Text style={styles.sectionHeadingSmall}>মুনাফার হার</Text>{(['daily', 'weekly', 'monthly'] as CollectionType[]).map((type) => <View key={type} style={styles.rateRow}><Text style={styles.rateLabel}>{type === 'daily' ? 'দৈনিক' : type === 'weekly' ? 'সাপ্তাহিক' : 'মাসিক'}</Text><View style={styles.rateInput}><TextInput value={String(munafa[type])} keyboardType="numeric" onChangeText={(value) => updateMunafa(type, Number(value) || 0)} style={styles.rateTextInput} /><Text style={styles.percent}>%</Text></View></View>)}</View></ScreenShell>;
}

export default function Index() {
  const { currentUser, hydrated, login, logout } = useApp(); const [screen, setScreen] = useState<Screen>('home'); const [selectedWorker, setSelectedWorker] = useState<WorkerCollectionData | null>(null); const [selectedMemberId, setSelectedMemberId] = useState<number | null>(null);
  if (!hydrated) return <View style={styles.loading}><ActivityIndicator size="large" color={purple} /><Text style={styles.loadingText}>অ্যাপ প্রস্তুত হচ্ছে...</Text></View>;
  if (!currentUser) return <Login onLogin={(role, username, password) => { if (!login(username, password, role)) Alert.alert('লগইন ব্যর্থ', 'ইউজারনেম বা পাসওয়ার্ড সঠিক নয়'); }} />;
  const go = (next: Screen) => setScreen(next);
  if (screen === 'home') return <Home go={go} onLogout={() => Alert.alert('লগআউট করবেন?', 'আপনি আবার লগইন স্ক্রিনে ফিরে যাবেন।', [{ text: 'বাতিল', style: 'cancel' }, { text: 'লগআউট', onPress: logout }])} />;
  const back = () => go('home');
  if (screen === 'groups') return <GroupScreen go={back} />;
  if (screen === 'employees') return <EmployeeScreen go={back} />;
  if (screen === 'members') return <MemberScreen go={back} />;
  if (screen === 'loans') return <LoanScreen go={back} />;
  if (screen === 'bank') return <BankScreen go={back} />;
  if (screen === 'overview') return <Overview go={back} onOpenMembers={() => go('allMembers')} />;
  if (screen === 'allMembers') return <AllMembersList go={back} onOpenMember={(memberId) => { setSelectedMemberId(memberId); go('memberDetails'); }} />;
  if (screen === 'memberDetails' && selectedMemberId !== null) return <MemberDetails memberId={selectedMemberId} go={() => go('allMembers')} />;
  if (screen === 'dailyReport') return <DailyReport go={back} onOpenWorker={(workerData) => { setSelectedWorker(workerData); go('fieldWorkerDetails'); }} />;
  if (screen === 'fieldWorkerDetails' && selectedWorker) return <FieldWorkerCollectionDetails workerData={selectedWorker} go={() => go('dailyReport')} />;
  if (screen === 'settings') return <Settings go={back} />;
  if (screen === 'collection') return <CollectionScreen go={back} />;
  if (screen === 'posting') return <PostingScreen go={back} />;
  return <GroupReport go={back} />;
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.light.background },
  loading: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.light.background, gap: 12 },
  loadingText: { color: colors.light.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 14 },
  header: { backgroundColor: purple, flexDirection: 'row', alignItems: 'center', paddingHorizontal: 18, paddingBottom: 14, gap: 14 },
  headerBack: { width: 30, alignItems: 'flex-start' }, headerTitle: { flex: 1, color: '#fff', fontSize: 20, fontFamily: 'Inter_700Bold' }, headerAction: { width: 30, alignItems: 'flex-end' },
  scroll: { padding: 18, gap: 16 }, homeTop: { paddingTop: 58, paddingHorizontal: 20, paddingBottom: 18, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', backgroundColor: '#fff' },
  eyebrow: { color: colors.light.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }, homeTitle: { fontFamily: 'Inter_700Bold', color: colors.light.foreground, fontSize: 24, marginTop: 4 }, avatarButton: { backgroundColor: '#E4D8FF', width: 42, height: 42, borderRadius: 21, alignItems: 'center', justifyContent: 'center' }, avatarText: { color: purple, fontFamily: 'Inter_700Bold', fontSize: 17 },
  homeScroll: { padding: 18, paddingBottom: 32, gap: 18 }, heroCard: { backgroundColor: purple, borderRadius: 22, minHeight: 152, padding: 20, flexDirection: 'row', overflow: 'hidden' }, heroEyebrow: { color: '#DCC9FF', fontFamily: 'Inter_600SemiBold', fontSize: 12 }, heroTitle: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 22, maxWidth: 220, marginTop: 10, lineHeight: 29 }, heroDetail: { color: '#EBDDFF', fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 8, maxWidth: 210 }, heroShape: { position: 'absolute', right: 16, bottom: 13, transform: [{ rotate: '-12deg' }] },
  statsRow: { flexDirection: 'row', gap: 10 }, statCard: { flex: 1, backgroundColor: '#fff', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#EEE8F4', minHeight: 104 }, statIcon: { width: 34, height: 34, borderRadius: 11, alignItems: 'center', justifyContent: 'center', marginBottom: 9 }, statValue: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }, statLabel: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 },
  sectionHeading: { fontFamily: 'Inter_700Bold', color: colors.light.foreground, fontSize: 18, marginTop: 2 }, sectionHeadingSmall: { fontFamily: 'Inter_700Bold', color: colors.light.foreground, fontSize: 16, marginTop: 3, marginBottom: 6 }, menuGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, menuCard: { backgroundColor: '#fff', borderRadius: 17, padding: 14, width: '48%', minHeight: 141, borderWidth: 1, borderColor: '#EEE8F4' }, menuIcon: { width: 39, height: 39, borderRadius: 13, alignItems: 'center', justifyContent: 'center', marginBottom: 10 }, menuLabel: { fontFamily: 'Inter_700Bold', color: colors.light.foreground, fontSize: 13 }, menuDetail: { fontFamily: 'Inter_400Regular', color: colors.light.mutedForeground, fontSize: 11, marginTop: 5, lineHeight: 15 }, 'menuCard > Feather': { position: 'absolute', right: 11, bottom: 13 },
  tipCard: { backgroundColor: '#EDE7FF', padding: 13, borderRadius: 13, flexDirection: 'row', gap: 9, alignItems: 'center' }, tipText: { flex: 1, color: purple, fontFamily: 'Inter_500Medium', fontSize: 12, lineHeight: 17 },
  pageHeading: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 21 }, pageSubheading: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: -9 }, listHeading: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 3 }, titleWithIcon: { flexDirection: 'row', alignItems: 'center', gap: 10 }, miniCircle: { width: 32, height: 32, borderRadius: 16, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' }, countText: { color: colors.light.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 13 }, listCard: { backgroundColor: '#fff', borderRadius: 16, padding: 14, borderWidth: 1, borderColor: '#EEE8F4', flexDirection: 'row', alignItems: 'center', gap: 12, marginBottom: 10 }, listIcon: { width: 43, height: 43, borderRadius: 13, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center' }, listBody: { flex: 1 }, listTitle: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 15 }, listMeta: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, verticalActions: { gap: 14, alignItems: 'center' }, employeeAvatar: { width: 46, height: 46, borderRadius: 23, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, avatarImage: { width: '100%', height: '100%' }, memberListContent: { padding: 18, gap: 12 }, memberSearch: { minHeight: 48, flexDirection: 'row', alignItems: 'center', gap: 9, paddingHorizontal: 13, borderRadius: 12, borderWidth: 1, borderColor: '#D9CBEA', backgroundColor: '#EDE7FF', marginTop: 15 }, memberSearchInput: { flex: 1, color: colors.light.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 11 }, memberResultText: { color: colors.light.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 12, marginBottom: 2 }, memberListRow: { backgroundColor: '#fff', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#EEE8F4', flexDirection: 'row', alignItems: 'center', gap: 11 }, memberListAvatar: { width: 55, height: 55, borderRadius: 28, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, memberListImage: { width: '100%', height: '100%' }, memberListBody: { flex: 1 }, memberListName: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }, memberListMeta: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, memberListGroup: { color: purple, fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 4 }, memberProfileHeader: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EEE8F4', flexDirection: 'row', alignItems: 'center', gap: 13 }, memberProfileAvatar: { width: 76, height: 76, borderRadius: 38, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, memberProfileImage: { width: '100%', height: '100%' }, memberProfileInfo: { flex: 1 }, memberProfileName: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 20 }, memberProfileMeta: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 }, memberProfileGroup: { color: purple, fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: 5 }, memberTabs: { backgroundColor: '#EDE7F6', borderRadius: 25, padding: 4, flexDirection: 'row', marginTop: 2 }, memberTab: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 21 }, memberTabActive: { backgroundColor: '#fff' }, memberTabText: { color: colors.light.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }, memberTabTextActive: { color: purple }, memberInfoList: { gap: 9 }, memberInfoCard: { backgroundColor: '#fff', borderRadius: 13, padding: 13, borderWidth: 1, borderColor: '#EEE8F4', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, memberInfoLabel: { color: colors.light.mutedForeground, fontFamily: 'Inter_500Medium', fontSize: 12, flex: 0.8 }, memberInfoValue: { color: colors.light.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 13, textAlign: 'right', flex: 1.2 }, loanDetailsCard: { gap: 9 }, collectionHistoryRow: { backgroundColor: '#fff', borderBottomWidth: 1, borderBottomColor: '#EEE8F4', padding: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, collectionHistoryInfo: { flex: 1 }, collectionHistoryTitle: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 13 }, collectionHistoryMeta: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, memberSummaryCard: { backgroundColor: '#E9F7EE', borderRadius: 14, padding: 15, marginTop: 5 }, memberSummaryTitle: { color: '#176B39', fontFamily: 'Inter_700Bold', fontSize: 14 }, memberSummaryText: { color: colors.light.foreground, fontFamily: 'Inter_500Medium', fontSize: 13, marginTop: 7 }, memberSummaryGreen: { color: '#198754', fontFamily: 'Inter_700Bold' }, memberSummaryDue: { color: '#B76B00', fontFamily: 'Inter_700Bold' },
  fieldWorkerCard: { backgroundColor: '#fff', borderRadius: 16, padding: 15, borderWidth: 1, borderColor: '#EEE8F4', marginBottom: 10 }, fieldWorkerTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 12 }, fieldWorkerIdentity: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 12 }, fieldWorkerAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: purple, alignItems: 'center', justifyContent: 'center' }, fieldWorkerAvatarText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 19 }, fieldWorkerInfo: { flex: 1 }, fieldWorkerName: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }, fieldWorkerMeta: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, fieldWorkerAmountWrap: { alignItems: 'flex-end' }, fieldWorkerAmount: { color: '#0B8A42', fontFamily: 'Inter_700Bold', fontSize: 16 }, fieldWorkerLink: { color: purple, fontFamily: 'Inter_500Medium', fontSize: 11, marginTop: 5 },
  workerSummaryCard: { backgroundColor: purple, borderRadius: 20, padding: 18 }, workerSummaryLabel: { color: '#DCC9FF', fontFamily: 'Inter_500Medium', fontSize: 12 }, workerSummaryName: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 22, marginTop: 6 }, workerSummaryStats: { flexDirection: 'row', gap: 10, marginTop: 18 }, workerSummaryStat: { flex: 1, backgroundColor: 'rgba(255,255,255,0.14)', borderRadius: 12, padding: 12 }, workerSummaryStatLabel: { color: '#DCC9FF', fontFamily: 'Inter_400Regular', fontSize: 11 }, workerSummaryStatValue: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 17, marginTop: 5 }, memberRow: { backgroundColor: '#fff', borderRadius: 15, padding: 12, borderWidth: 1, borderColor: '#EEE8F4', flexDirection: 'row', alignItems: 'center', gap: 10, marginBottom: 10 }, workerMemberAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, workerMemberImage: { width: '100%', height: '100%' }, workerMemberInfo: { flex: 1 }, workerMemberName: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }, workerMemberGroup: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 4 }, workerMemberAmount: { color: '#198754', fontFamily: 'Inter_700Bold', fontSize: 14 },
  empty: { alignItems: 'center', justifyContent: 'center', paddingVertical: 70, paddingHorizontal: 22 }, emptyIcon: { width: 66, height: 66, borderRadius: 22, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }, emptyTitle: { fontFamily: 'Inter_700Bold', color: colors.light.foreground, fontSize: 17 }, emptyDetail: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 13, textAlign: 'center', marginTop: 7, lineHeight: 19 },
  button: { minHeight: 48, borderRadius: 13, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingHorizontal: 16, gap: 8, backgroundColor: purple }, button_outline: { backgroundColor: '#fff', borderWidth: 1, borderColor: purple }, button_soft: { backgroundColor: '#EDE7FF' }, button_danger: { backgroundColor: '#C65353' }, buttonSmall: { minHeight: 36, borderRadius: 10, paddingHorizontal: 11 }, buttonText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 14 }, buttonTextDark: { color: purple }, buttonTextSmall: { fontSize: 12 }, pressed: { opacity: 0.72, transform: [{ scale: 0.985 }] }, disabled: { opacity: 0.45 },
  fieldWrap: { gap: 7, marginBottom: 12 }, fieldLabel: { color: '#554964', fontFamily: 'Inter_600SemiBold', fontSize: 13 }, inputShell: { minHeight: 48, borderRadius: 11, borderWidth: 1, borderColor: '#D9CBEA', backgroundColor: '#EDE7FF', paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 9 }, input: { flex: 1, color: colors.light.foreground, fontFamily: 'Inter_400Regular', fontSize: 14, paddingVertical: 11 }, inputMulti: { minHeight: 82, alignItems: 'flex-start' }, inputReadOnly: { backgroundColor: '#F1EDF5' }, selectText: { flex: 1, color: colors.light.foreground, fontFamily: 'Inter_400Regular', fontSize: 14 }, placeholder: { color: '#9B8EAA' },
  dialog: { width: '88%', backgroundColor: '#fff', borderRadius: 22, padding: 20, maxHeight: '85%' }, dialogLarge: { width: '94%', backgroundColor: '#fff', borderRadius: 22, padding: 20, maxHeight: '90%' }, dialogTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }, dialogTitle: { color: purple, fontFamily: 'Inter_700Bold', fontSize: 18, flex: 1 }, modalBackdrop: { flex: 1, backgroundColor: 'rgba(26, 11, 40, 0.48)', alignItems: 'center', justifyContent: 'center' }, sheet: { position: 'absolute', bottom: 0, width: '100%', backgroundColor: '#fff', padding: 20, paddingBottom: 28, borderTopLeftRadius: 25, borderTopRightRadius: 25 }, sheetHandle: { alignSelf: 'center', width: 42, height: 4, borderRadius: 2, backgroundColor: '#D7CCDF', marginBottom: 18 }, sheetTitle: { fontFamily: 'Inter_700Bold', color: colors.light.foreground, fontSize: 19, marginBottom: 14 }, optionRow: { paddingVertical: 15, borderBottomWidth: 1, borderBottomColor: '#F0EBF4', flexDirection: 'row', justifyContent: 'space-between' }, optionText: { color: colors.light.foreground, fontFamily: 'Inter_500Medium', fontSize: 15 },
  profilePreview: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#C8B6FF', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, profileImage: { width: '100%', height: '100%' }, memberAvatar: { width: 90, height: 90, borderRadius: 45, backgroundColor: '#D1C4E9', alignSelf: 'center', alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: purple, overflow: 'hidden' }, photoActions: { flexDirection: 'row', justifyContent: 'center', gap: 9, marginVertical: 15 }, dialogButtons: { flexDirection: 'row', gap: 10, marginTop: 8 }, 'dialogButtons > Button': { flex: 1 }, formCard: { backgroundColor: '#fff', borderRadius: 18, padding: 16, borderWidth: 1, borderColor: '#EEE8F4' }, addressGrid: { gap: 0 }, loanIntro: { backgroundColor: purple, borderRadius: 17, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12 }, loanBankIcon: { width: 43, height: 43, backgroundColor: 'rgba(255,255,255,0.18)', borderRadius: 13, alignItems: 'center', justifyContent: 'center' }, loanIntroTitle: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 }, loanIntroText: { color: '#EBDDFF', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 3 }, autoField: { marginBottom: 13 }, autoLabel: { flexDirection: 'row', alignItems: 'center', gap: 7, marginBottom: 7 }, autoBadge: { backgroundColor: '#E4D8FF', color: purple, fontFamily: 'Inter_700Bold', fontSize: 10, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5 }, autoValue: { minHeight: 49, borderRadius: 11, backgroundColor: '#E2DEE5', paddingHorizontal: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, autoValueText: { color: '#5E5662', fontFamily: 'Inter_700Bold', fontSize: 17 }, totalText: { color: purple, fontFamily: 'Inter_700Bold', fontSize: 17 }, helperText: { color: purple, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 6 }, formNote: { color: purple, fontFamily: 'Inter_500Medium', fontSize: 11, lineHeight: 17, marginVertical: 3 },
  dueCard: { backgroundColor: '#FFF4DC', borderRadius: 14, padding: 14, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }, dueLabel: { color: '#8B6B29', fontFamily: 'Inter_500Medium', fontSize: 12 }, dueValue: { color: '#85500A', fontFamily: 'Inter_700Bold', fontSize: 21, marginTop: 4 }, dueBadge: { flexDirection: 'row', gap: 5, alignItems: 'center', backgroundColor: '#FFE6A8', borderRadius: 20, paddingHorizontal: 9, paddingVertical: 5 }, dueBadgeText: { color: '#8B5B00', fontFamily: 'Inter_600SemiBold', fontSize: 11 }, selectHint: { backgroundColor: '#F7F2FC', borderRadius: 12, padding: 13, flexDirection: 'row', gap: 8, alignItems: 'center', marginBottom: 14 }, selectHintText: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 },
  postCard: { backgroundColor: '#fff', borderRadius: 16, padding: 13, borderWidth: 1, borderColor: '#EEE8F4', flexDirection: 'row', alignItems: 'center', gap: 11, marginBottom: 10 }, amountGreen: { color: '#198754', fontFamily: 'Inter_700Bold', fontSize: 14 }, amountDue: { color: '#B76B00', fontFamily: 'Inter_700Bold', fontSize: 14 }, collectionHeaderRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 10, marginBottom: 12 }, collectionTitleBlock: { flex: 1 }, smallDropdown: { width: 118, height: 42, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: '#D9CBEA', backgroundColor: '#EDE7FF', justifyContent: 'center' }, smallPicker: { width: 140, height: 42, color: purple, fontFamily: 'Inter_600SemiBold' }, collectibleCard: { backgroundColor: '#FFF8E1', borderRadius: 12, padding: 15, marginBottom: 14, position: 'relative' }, collectibleLabel: { color: '#8D6E00', fontFamily: 'Inter_500Medium', fontSize: 13 }, collectibleValue: { color: '#7A5C00', fontFamily: 'Inter_700Bold', fontSize: 24, marginTop: 5 }, collectibleBadge: { position: 'absolute', top: 15, right: 15, flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: '#FFECB3', borderRadius: 20, paddingHorizontal: 10, paddingVertical: 5 }, collectibleBadgeText: { color: '#7A5C00', fontFamily: 'Inter_500Medium', fontSize: 12 }, collectibleHint: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 }, reportHero: { backgroundColor: purple, borderRadius: 19, padding: 20 }, reportLabel: { color: '#DCC9FF', fontFamily: 'Inter_500Medium', fontSize: 12 }, reportValue: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 29, marginTop: 9 }, reportMeta: { color: '#EBDDFF', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 5 }, filterRow: { flexDirection: 'row', gap: 9 }, reportGroupEmpty: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: '#F7F2FC', borderRadius: 12, padding: 13 }, reportGroupEmptyText: { flex: 1, color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 12 }, reportFilterRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: -3 }, reportDatePair: { flex: 1, flexDirection: 'row', gap: 7 }, dateChipWebWrap: { flex: 1, position: 'relative' }, dateChip: { minHeight: 43, flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 9, borderRadius: 11, borderWidth: 1, borderColor: '#D9CBEA', backgroundColor: '#EDE7FF', flex: 1 }, dateChipText: { flex: 1, color: purple, fontFamily: 'Inter_500Medium', fontSize: 11 }, dropdownContainer: { width: 105, minHeight: 43, overflow: 'hidden', borderRadius: 11, borderWidth: 1, borderColor: '#D9CBEA', backgroundColor: '#EDE7FF', justifyContent: 'center' }, reportPicker: { width: 125, height: 43, color: purple, fontFamily: 'Inter_600SemiBold' }, draftSheet: { width: '100%', maxHeight: '90%', backgroundColor: '#fff', padding: 18, paddingBottom: 24, borderTopLeftRadius: 24, borderTopRightRadius: 24 }, draftEmptyList: { flexGrow: 1 }, draftRow: { flexDirection: 'row', alignItems: 'center', gap: 10, padding: 12, borderWidth: 1, borderColor: '#EEE8F4', borderRadius: 12, marginBottom: 10 }, draftAvatar: { width: 50, height: 50, borderRadius: 25, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' }, draftImage: { width: '100%', height: '100%' }, draftInfo: { flex: 1 }, draftName: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }, draftMeta: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 3 }, draftAmount: { color: '#198754', fontFamily: 'Inter_700Bold', fontSize: 14 }, draftCloseButton: { marginTop: 10 }, balanceCard: { backgroundColor: '#2B154A', borderRadius: 20, padding: 21 }, balanceLabel: { color: '#DCC9FF', fontFamily: 'Inter_500Medium', fontSize: 12 }, balanceValue: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 29, marginTop: 8 }, balanceMeta: { color: '#EBDDFF', fontFamily: 'Inter_400Regular', fontSize: 12, marginTop: 7 }, segment: { backgroundColor: '#EDE7FF', borderRadius: 12, padding: 4, flexDirection: 'row' }, segmentItem: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: 9 }, segmentActive: { backgroundColor: '#fff' }, segmentText: { color: colors.light.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 13 }, segmentTextActive: { color: purple }, overviewGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 11 }, 'overviewGrid > View': { width: '48%' }, insightCard: { backgroundColor: '#E9F7EE', borderRadius: 16, padding: 16, flexDirection: 'row', gap: 12, alignItems: 'center' }, insightIcon: { width: 40, height: 40, borderRadius: 13, backgroundColor: '#D2F0DC', alignItems: 'center', justifyContent: 'center' }, settingsHeader: { flexDirection: 'row', gap: 12, alignItems: 'center' }, settingsIcon: { width: 49, height: 49, backgroundColor: purple, borderRadius: 15, alignItems: 'center', justifyContent: 'center' }, rateRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: '#F0EBF4' }, rateLabel: { color: colors.light.foreground, fontFamily: 'Inter_600SemiBold', fontSize: 14 }, rateInput: { flexDirection: 'row', alignItems: 'center', backgroundColor: '#EDE7FF', borderRadius: 9, paddingHorizontal: 10, width: 84 }, rateTextInput: { flex: 1, paddingVertical: 8, color: purple, fontFamily: 'Inter_700Bold', textAlign: 'right' }, percent: { color: purple, fontFamily: 'Inter_700Bold', marginLeft: 4 },
  loginScreen: { flex: 1, backgroundColor: '#2B154A', overflow: 'hidden' }, loginGlow: { position: 'absolute', width: 330, height: 330, borderRadius: 165, backgroundColor: '#5B2C83', opacity: 0.55, right: -110, top: -80 }, loginContent: { flex: 1, paddingHorizontal: 22, paddingTop: 100, alignItems: 'center' }, brandMark: { width: 72, height: 72, borderRadius: 24, backgroundColor: '#5B2C83', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#8760B3' }, brandTitle: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 29, marginTop: 16 }, brandSubtitle: { color: '#DCC9FF', fontFamily: 'Inter_400Regular', fontSize: 13, marginTop: 5 }, loginPrompt: { color: '#fff', fontFamily: 'Inter_600SemiBold', fontSize: 16, marginTop: 65, marginBottom: 17 }, roleRow: { flexDirection: 'row', gap: 12, width: '100%' }, roleCard: { flex: 1, borderRadius: 17, padding: 15, minHeight: 159, borderWidth: 1 }, roleAdmin: { backgroundColor: '#fff', borderColor: '#fff' }, roleField: { backgroundColor: '#F2FCF5', borderColor: '#B8E6C7' }, roleIcon: { width: 46, height: 46, borderRadius: 15, backgroundColor: '#EDE7FF', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }, roleTitle: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 14 }, roleHint: { color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 5 }, loginNote: { flexDirection: 'row', gap: 7, alignItems: 'center', marginTop: 28 }, loginNoteText: { color: '#B9A8C8', fontFamily: 'Inter_400Regular', fontSize: 12 }, loginForm: { marginTop: 52, width: '100%', backgroundColor: '#fff', borderRadius: 21, padding: 19 }, changeRole: { flexDirection: 'row', gap: 6, alignItems: 'center', marginBottom: 20 }, changeRoleText: { color: purple, fontFamily: 'Inter_600SemiBold', fontSize: 12 }, formHeading: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 21, marginBottom: 19 }, errorText: { color: '#C65353', fontFamily: 'Inter_500Medium', fontSize: 12, marginTop: -3, marginBottom: 11 }, demoText: { textAlign: 'center', color: colors.light.mutedForeground, fontFamily: 'Inter_400Regular', fontSize: 11, marginTop: 14 },
  calendarTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 10 }, calendarMonth: { color: colors.light.foreground, fontFamily: 'Inter_700Bold', fontSize: 16 }, weekRow: { flexDirection: 'row', justifyContent: 'space-around', marginVertical: 9 }, weekDay: { width: '14%', textAlign: 'center', color: colors.light.mutedForeground, fontFamily: 'Inter_600SemiBold', fontSize: 11 }, calendarGrid: { flexDirection: 'row', flexWrap: 'wrap' }, dayCell: { width: '14.28%', height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: 20 }, daySelected: { backgroundColor: purple }, dayText: { color: colors.light.foreground, fontFamily: 'Inter_500Medium', fontSize: 13 }, dayTextSelected: { color: '#fff', fontFamily: 'Inter_700Bold' },
});