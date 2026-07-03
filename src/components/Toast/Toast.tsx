import { usePatch } from '../../context/PatchProvider'
import styles from './Toast.module.css'

export function Toast() {
  const { state } = usePatch()
  if (!state.toast) return null
  return <div className={styles.toast} role="alert">{state.toast}</div>
}
