import { useState } from 'react'
import { useAuth } from './LoginGate.jsx'
import { useOrgs } from '../hooks/useOrgs.js'
import OrgSelector from './OrgSelector.jsx'
import ProjectGate from './ProjectGate.jsx'

/**
 * Puerta de organización (entre el login y el proyecto). Flujo completo:
 *   LoginGate → OrgGate → ProjectGate → App
 *
 * Si no hay organización activa, muestra el selector; al elegir, monta
 * <ProjectGate> scopeado a esa organización. La org activa vive en sessionStorage
 * (sobrevive a una recarga del SW; una sesión nueva vuelve a preguntar).
 */
const OKEY = 'sqy-active-org'

export default function OrgGate() {
  const { user } = useAuth()
  const { orgs, addOrg, removeOrg } = useOrgs(user)
  const [active, setActive] = useState(() => {
    try { const id = sessionStorage.getItem(OKEY); return id ? (orgs.find((o) => o.id === id) || null) : null } catch { return null }
  })

  function select(o) { try { sessionStorage.setItem(OKEY, o.id) } catch { /* ignore */ }; setActive(o) }
  function change() { try { sessionStorage.removeItem(OKEY) } catch { /* ignore */ }; setActive(null) }
  function createAndOpen(data) { const o = addOrg(data); if (o) select(o) }

  if (active) return <ProjectGate key={active.id} org={active} onChangeOrg={change} />
  return <OrgSelector orgs={orgs} onSelect={select} onCreate={createAndOpen} onRemove={removeOrg} />
}
