import SettingsSideNav from './settings-side-nav'

export default function SettingsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[calc(100vh-52px)]" style={{ background: 'var(--bg-base)' }}>
      <SettingsSideNav />
      <div className="min-w-0 flex-1 overflow-auto p-6">{children}</div>
    </div>
  )
}
