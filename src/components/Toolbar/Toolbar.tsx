import { useCallback, useEffect, useRef, useState } from 'react'
import { usePatch } from '../../context/PatchProvider'
import type { EffectType } from '../../types/patch'
import { createPatch, downloadPatch, parsePatchFile } from '../../utils/patchIO'
import { Modal } from '../Modal/Modal'
import styles from './Toolbar.module.css'

const EFFECT_TYPES: EffectType[] = [
  'distortion',
  'reverb',
  'delay',
  'chorus',
  'eq',
  'compressor',
]

export function Toolbar() {
  const { state, addNode, clearAll, toggleMute, loadPatch } = usePatch()
  const [menuOpen, setMenuOpen] = useState(false)
  const [loadError, setLoadError] = useState<string | null>(null)
  const fileRef = useRef<HTMLInputElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menuOpen) return
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as HTMLElement)) {
        setMenuOpen(false)
      }
    }
    window.addEventListener('mousedown', handleClick)
    return () => window.removeEventListener('mousedown', handleClick)
  }, [menuOpen])

  const handleAdd = useCallback(
    (type: 'source' | 'destination' | EffectType) => {
      const canvas = document.querySelector('[data-canvas]')
      const rect = canvas?.getBoundingClientRect() ?? undefined
      if (type === 'source') {
        addNode('source', undefined, rect)
      } else if (type === 'destination') {
        addNode('destination', undefined, rect)
      } else {
        addNode('effect', type, rect)
      }
      setMenuOpen(false)
    },
    [addNode],
  )

  const handleSave = () => {
    const patch = createPatch(state.nodes, state.connections, state.metadata)
    downloadPatch(patch)
  }

  const handleLoadClick = () => {
    fileRef.current?.click()
  }

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    try {
      const patch = await parsePatchFile(file)
      loadPatch(patch)
      setLoadError(null)
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Failed to load patch')
    }
    e.target.value = ''
  }

  return (
    <>
      <header className={styles.toolbar}>
        <span className={styles.logo}>AmpWired</span>

        <div className={styles.dropdown} ref={menuRef}>
          <button
            type="button"
            className={styles.btn}
            onClick={() => setMenuOpen((o) => !o)}
            aria-expanded={menuOpen}
          >
            + Add Node ▼
          </button>
          {menuOpen && (
            <div className={styles.menu} role="menu">
              <div className={styles.menuSection}>I/O</div>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => handleAdd('source')}
              >
                Source (Input)
              </button>
              <button
                type="button"
                className={styles.menuItem}
                onClick={() => handleAdd('destination')}
              >
                Destination (Output)
              </button>
              <div className={styles.menuSection}>Effects</div>
              {EFFECT_TYPES.map((fx) => (
                <button
                  key={fx}
                  type="button"
                  className={styles.menuItem}
                  onClick={() => handleAdd(fx)}
                >
                  {fx.charAt(0).toUpperCase() + fx.slice(1)}
                </button>
              ))}
            </div>
          )}
        </div>

        <div className={styles.spacer} />

        <button type="button" className={styles.btn} onClick={handleSave}>
          Save
        </button>
        <button type="button" className={styles.btn} onClick={handleLoadClick}>
          Load
        </button>
        <input
          ref={fileRef}
          type="file"
          accept=".json"
          className={styles.hiddenInput}
          onChange={handleFileChange}
        />
        <button
          type="button"
          className={`${styles.btn} ${state.muted ? styles.btnActive : ''}`}
          onClick={toggleMute}
        >
          {state.muted ? 'Unmute' : 'Mute'}
        </button>
        <button
          type="button"
          className={`${styles.btn} ${styles.btnDanger}`}
          onClick={clearAll}
        >
          Clear
        </button>
      </header>

      {loadError && (
        <Modal title="Load Error" onClose={() => setLoadError(null)}>
          <p>{loadError}</p>
        </Modal>
      )}
    </>
  )
}
