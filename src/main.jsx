import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PlannerProvider } from './context/PlannerContext'
import ErrorBoundary from './components/ErrorBoundary'
import './index.css'
import App from './App.jsx'
import { setupPwaUpdate } from './lib/pwaUpdate'

setupPwaUpdate()

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <BrowserRouter>
        <PlannerProvider>
          <App />
        </PlannerProvider>
      </BrowserRouter>
    </ErrorBoundary>
  </StrictMode>,
)
