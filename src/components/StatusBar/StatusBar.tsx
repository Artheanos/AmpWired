import { useEffect, useState } from 'react'
import { usePatch } from '../../context/PatchProvider'
import styles from './StatusBar.module.css'

export function StatusBar() {
  const { state, audioEngine } = usePatch()
  const [contextState, setContextState] = useState('inactive')
  const [sampleRate, setSampleRate] = useState('—')

  useEffect(() => {
    const ctx = audioEngine.audioContext
    if (ctx) {
      setContextState(ctx.state)
      setSampleRate(`${ctx.sampleRate} Hz`)
    } else {
      setContextState('inactive')
      setSampleRate('—')
    }

    const interval = setInterval(() => {
      const c = audioEngine.audioContext
      if (c) {
        setContextState(c.state)
        setSampleRate(`${c.sampleRate} Hz`)
      }
    }, 500)

    return () => clearInterval(interval)
  }, [audioEngine, state.nodes])

  return (
    <footer className={styles.statusBar}>
      <div className={styles.item}>
        <span className={styles.label}>Context:</span>
        <span className={styles.value}>{contextState}</span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>Sample rate:</span>
        <span className={styles.value}>{sampleRate}</span>
      </div>
      <div className={styles.item}>
        <span className={styles.label}>Nodes:</span>
        <span className={styles.value}>{state.nodes.length}</span>
      </div>
    </footer>
  )
}
