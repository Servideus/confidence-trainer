import { NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useI18n } from './i18n/useI18n'
import { ForecastsPage } from './pages/ForecastsPage'
import { LibraryPage } from './pages/LibraryPage'
import { ResultPage } from './pages/ResultPage'
import { StatsPage } from './pages/StatsPage'
import { TodayPage } from './pages/TodayPage'

function App() {
  const { language, setLanguage, copy } = useI18n()

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="row row-space">
          <h1>{copy.app.title}</h1>
          <div className="row">
            <span className="lang-label">{copy.app.languageLabel}:</span>
            <button
              className={`lang-button${language === 'ru' ? ' is-active' : ''}`}
              onClick={() => setLanguage('ru')}
              type="button"
            >
              RU
            </button>
            <button
              className={`lang-button${language === 'en' ? ' is-active' : ''}`}
              onClick={() => setLanguage('en')}
              type="button"
            >
              EN
            </button>
          </div>
        </div>
        <nav className="row" aria-label="primary navigation">
          <NavLink to="/today" className="nav-link">
            {copy.app.navToday}
          </NavLink>
          <NavLink to="/stats" className="nav-link">
            {copy.app.navStats}
          </NavLink>
          <NavLink to="/forecasts" className="nav-link">
            {copy.app.navForecasts}
          </NavLink>
          <NavLink to="/library" className="nav-link">
            {copy.app.navLibrary}
          </NavLink>
        </nav>
      </header>

      <main className="content">
        <Routes>
          <Route path="/" element={<Navigate to="/today" replace />} />
          <Route path="/today" element={<TodayPage />} />
          <Route path="/result/:responseId" element={<ResultPage />} />
          <Route path="/stats" element={<StatsPage />} />
          <Route path="/forecasts" element={<ForecastsPage />} />
          <Route path="/library" element={<LibraryPage />} />
        </Routes>
      </main>
    </div>
  )
}

export default App
