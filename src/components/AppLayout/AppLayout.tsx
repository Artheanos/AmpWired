import { Canvas } from '../Canvas/Canvas'
import { StatusBar } from '../StatusBar/StatusBar'
import { Toast } from '../Toast/Toast'
import { Toolbar } from '../Toolbar/Toolbar'
import styles from './AppLayout.module.css'

export function AppLayout() {
  return (
    <div className={styles.layout}>
      <Toolbar />
      <main className={styles.main}>
        <Canvas />
      </main>
      <StatusBar />
      <Toast />
    </div>
  )
}
