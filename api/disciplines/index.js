import { dbEnabled, ensureDisciplines } from '../_lib/db.js'
import { disciplinesStructure } from '../../src/data/disciplinesStructure.js'

// GET /api/disciplines → menú de disciplinas/subcategorías desde la base de
// datos. Lectura pública (el menú no es secreto).
//
// - Si la DB no está configurada (sin SQY_DATABASE_URL) → { source:'static',
//   disciplines:null }: el front usa su menú estático de respaldo.
// - Con DB: crea las tablas si faltan, las siembra la primera vez con la
//   estructura estática y devuelve el árbol guardado.
// - Ante cualquier error de DB no rompemos el menú: devolvemos disciplines:null
//   (HTTP 200) y el front cae al estático.
export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'Método no permitido' })
    return
  }
  try {
    if (!dbEnabled()) {
      res.status(200).json({ source: 'static', disciplines: null })
      return
    }
    const disciplines = await ensureDisciplines(disciplinesStructure)
    res.status(200).json({ source: 'db', disciplines })
  } catch (e) {
    res.status(200).json({ source: 'error', error: String(e?.message || e), disciplines: null })
  }
}
