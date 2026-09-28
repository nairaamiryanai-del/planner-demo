import { Routes, Route, useLocation } from 'react-router-dom'
import Sidebar from './components/Sidebar'
import Header from './components/Header'
import StatsWidget from './components/StatsWidget'
import TaskBoard from './components/TaskBoard'
import CalendarView from './components/CalendarView'
import FreelanceTracker from './components/FreelanceTracker'
import MyProjects from './components/MyProjects'
import ChildActivities from './components/ChildActivities'
import TravelPlanner from './components/TravelPlanner'
import ShoppingList from './components/ShoppingList'
import Notes from './components/Notes'
import Goals from './components/Goals'
import Reminders from './components/Reminders'
import Health from './components/Health'
import './App.css'

function App() {
  const location = useLocation()
  return (
    <div className="app-layout">
      <Sidebar />
      <main className="app-main">
        <Header />
        <div className="app-content">
          <div className="route-fade" key={location.pathname}>
            <Routes location={location}>
              <Route path="/" element={<StatsWidget />} />
              <Route path="/tasks" element={<TaskBoard />} />
              <Route path="/calendar" element={<CalendarView />} />
              <Route path="/freelance" element={<FreelanceTracker />} />
              <Route path="/my-projects" element={<MyProjects />} />
              <Route path="/kids" element={<ChildActivities />} />
              <Route path="/travel" element={<TravelPlanner />} />
              <Route path="/shopping" element={<ShoppingList />} />
              <Route path="/notes" element={<Notes />} />
              <Route path="/goals" element={<Goals />} />
              <Route path="/reminders" element={<Reminders />} />
              <Route path="/health" element={<Health />} />
            </Routes>
          </div>
        </div>
      </main>
    </div>
  )
}

export default App
