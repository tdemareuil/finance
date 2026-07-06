import { Navigate, Route, Routes } from 'react-router-dom'
import ProtectedRoute from './components/ProtectedRoute'
import Layout from './components/Layout'
import LoginPage from './pages/LoginPage'
import PortfolioPage from './pages/PortfolioPage'
import AssetDetailPage from './pages/AssetDetailPage'
import DividendsPage from './pages/DividendsPage'
import CsvImportPage from './pages/CsvImportPage'
import SettingsPage from './pages/SettingsPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <ProtectedRoute>
            <Layout />
          </ProtectedRoute>
        }
      >
        <Route path="/portfolio" element={<PortfolioPage />} />
        <Route path="/dashboard" element={<Navigate to="/portfolio" replace />} />
        <Route path="/assets/:assetId" element={<AssetDetailPage />} />
        <Route path="/dividends" element={<DividendsPage />} />
        <Route path="/import" element={<CsvImportPage />} />
        <Route path="/settings" element={<SettingsPage />} />
      </Route>
      <Route path="*" element={<Navigate to="/portfolio" replace />} />
    </Routes>
  )
}
