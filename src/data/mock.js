/**
 * Datos mock (ficticios) para subcategorías que aún no tienen un dataset real
 * cargado desde Excel. Sirven para apreciar el layout del Data Grid.
 *
 * El dataset `ele_mock` (Equipos eléctricos) replica las columnas y el estilo
 * de TAGs vistos en la plataforma de referencia (230-XXX-011, FACILITIES 230,
 * EWP/CWP/CWA-03631-36, estados de aprobación/avance, etc.).
 */

const eleHeaders = [
  'TAG',
  'DESCRIPCIÓN_GENERAL',
  'DESCRIPCIÓN_COMPLEMENTARIA',
  'FACILITIES',
  'COMMODITY',
  'ESPECIALIDAD',
  'COSTO_US',
  'EWP',
  'CWP',
  'CWA',
  'ESTADO_DE_APROBACION',
  'ESTADO_DE_AVANCE',
  'PESO_KG',
  'MODELO',
]

const ePkg = { EWP: 'EWP-03631-36', CWP: 'CWP-03631-36', CWA: 'CWA-03631-36' }

const row = (tag, gen, comp, costo, peso) => ({
  TAG: tag,
  DESCRIPCIÓN_GENERAL: gen,
  DESCRIPCIÓN_COMPLEMENTARIA: comp,
  FACILITIES: 230,
  COMMODITY: '',
  ESPECIALIDAD: 'ELECTRICIDAD',
  COSTO_US: costo,
  ...ePkg,
  ESTADO_DE_APROBACION: 'No Aprobado',
  ESTADO_DE_AVANCE: 'E4',
  PESO_KG: peso,
  MODELO: '',
})

const eleRows = [
  row('230-AIR-011', 'SISTEMA DE AIRE ACONDICIONADO', 'Equipo de aire acondicionado sala eléctrica', 22650, 252),
  row('230-BAT-011', 'BANCO DE BATERÍAS', 'Banco de baterías 125 VDC', 48200, 1015),
  row('230-BCO-011', 'BANCO DE CONDENSADORES', 'Banco de condensadores corrección FP', 18400, 380),
  row('230-CBT-011', 'CARGADOR DE BATERÍAS', 'Cargador de baterías 125 VDC', 12600, 2500),
  row('230-CCM-011', 'CENTRO DE CONTROL DE MOTORES', 'Centro de control de motores 400V', 73800, 600),
  row('230-ECI-011', 'KIT DE EMERGENCIA', 'Kit de emergencia red incendio', 4200, 100),
  row('230-ECI-012', 'EXTINCIÓN INCENDIO', 'Extintor portátil PQS', 320, 10),
  row('230-ECI-013', 'EXTINCIÓN INCENDIO', 'Cilindro sistema fijo de extinción', 5400, 300),
  row('230-ECZ-011', 'SISTEMA PROTECCIÓN', 'Equipo de protección catódica', 9800, 140),
  row('230-ERE-012', 'ESPACIO RESERVADO', 'Espacio reservado tablero futuro', 0, ''),
  row('230-GEN-011', 'GRUPO ELECTRÓGENO', 'Grupo electrógeno diésel 800 KVA emergencia', 142000, 6800),
  row('230-TRF-011', 'TRANSFORMADOR SECO', 'Transformador seco 1500 KVA 13.8/0.4 KV', 96400, 4100),
  row('230-UPS-011', 'UPS REDUNDANTE', 'UPS 60 KVA redundante sala de control', 31500, 720),
]

export const mockDatasets = {
  ele_mock: {
    headers: eleHeaders,
    rows: eleRows,
    count: eleRows.length,
  },
}
