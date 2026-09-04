import { HashRouter, Routes, Route } from 'react-router-dom'
import Layout from './components/Layout'
import LibraryView from './views/Library/LibraryView'
import ReviewView from './views/Review/ReviewView'
import DashboardView from './views/Dashboard/DashboardView'
import SettingsView from './views/Settings/SettingsView'

function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LibraryView />} />
          <Route path="review" element={<ReviewView />} />
          <Route path="dashboard" element={<DashboardView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </HashRouter>
  )
}

export default App
