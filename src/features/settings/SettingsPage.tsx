import DisplayDiagnostic from './DisplayDiagnostic'

export default function SettingsPage() {
  return (
    <section className="page">
      <h1>Réglages</h1>
      <DisplayDiagnostic />
      <p className="build-id">Version {__BUILD_ID__}</p>
    </section>
  )
}
