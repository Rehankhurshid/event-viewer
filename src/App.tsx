import { BrowserRouter, Routes, Route } from "react-router-dom"
import { EventsPage } from "./pages/EventsPage"
import { MatchesPage } from "./pages/MatchesPage"

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<EventsPage />} />
        <Route path="/matches" element={<MatchesPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App


