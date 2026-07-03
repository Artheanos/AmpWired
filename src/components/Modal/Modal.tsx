import type { ReactNode } from 'react'
import styles from './Modal.module.css'

interface ModalProps {
  title: string
  children: ReactNode
  onClose: () => void
}

export function Modal({ title, children, onClose }: ModalProps) {
  return (
    <div className={styles.overlay} onClick={onClose} role="dialog" aria-modal="true">
      <div className={styles.dialog} onClick={(e) => e.stopPropagation()}>
        <h2 className={styles.title}>{title}</h2>
        <div className={styles.body}>{children}</div>
        <div className={styles.actions}>
          <button type="button" className={styles.btn} onClick={onClose}>
            Close
          </button>
        </div>
      </div>
    </div>
  )
}
