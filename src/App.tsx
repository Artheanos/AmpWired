import { PatchProvider } from './context/PatchProvider'
import { AppLayout } from './components/AppLayout/AppLayout'

function App() {
  return (
    <PatchProvider>
      <AppLayout />
    </PatchProvider>
  )
}

export default App
