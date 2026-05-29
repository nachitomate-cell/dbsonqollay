/**
 * Datos mock (ficticios) para subcategorías que aún no tienen un dataset real
 * cargado desde Excel. Sirven para apreciar el layout del Data Grid.
 *
 * Las columnas siguen el modelo de ingeniería solicitado:
 * TAG, DESCRIPCIÓN, FACILITIES, COMMODITY, ESPECIALIDAD, COSTO_US,
 * CWP, CWA, ESTADO_DE_APROBACION, PESO_KG.
 */

const eleHeaders = [
  'TAG',
  'DESCRIPCIÓN',
  'FACILITIES',
  'COMMODITY',
  'ESPECIALIDAD',
  'COSTO_US',
  'CWP',
  'CWA',
  'ESTADO_DE_APROBACION',
  'PESO_KG',
]

const eleRows = [
  {
    TAG: '06940-ELE-001',
    DESCRIPCIÓN: 'BANCO DE BATERÍAS 125 VDC',
    FACILITIES: 'Sala Eléctrica Principal',
    COMMODITY: 'ELE-BAT',
    ESPECIALIDAD: 'ELECTRICIDAD',
    COSTO_US: 48200,
    CWP: 'CWP-08-E-02',
    CWA: 'CWA-08',
    ESTADO_DE_APROBACION: 'E4',
    PESO_KG: 1240,
  },
  {
    TAG: '06940-ELE-002',
    DESCRIPCIÓN: 'SISTEMA DE AIRE ACONDICIONADO SALA ELÉCTRICA',
    FACILITIES: 'Sala Eléctrica Principal',
    COMMODITY: 'ELE-HVAC',
    ESPECIALIDAD: 'ELECTRICIDAD',
    COSTO_US: 22650,
    CWP: 'CWP-08-E-02',
    CWA: 'CWA-08',
    ESTADO_DE_APROBACION: 'E3',
    PESO_KG: 560,
  },
  {
    TAG: '06940-ELE-003',
    DESCRIPCIÓN: 'TRANSFORMADOR SECO 1500 KVA 13.8/0.4 KV',
    FACILITIES: 'Subestación Unitaria',
    COMMODITY: 'ELE-TRF',
    ESPECIALIDAD: 'ELECTRICIDAD',
    COSTO_US: 96400,
    CWP: 'CWP-08-E-01',
    CWA: 'CWA-08',
    ESTADO_DE_APROBACION: 'E4',
    PESO_KG: 4100,
  },
  {
    TAG: '06940-ELE-004',
    DESCRIPCIÓN: 'CENTRO DE CONTROL DE MOTORES (CCM) 400V',
    FACILITIES: 'Sala Eléctrica Principal',
    COMMODITY: 'ELE-MCC',
    ESPECIALIDAD: 'ELECTRICIDAD',
    COSTO_US: 73800,
    CWP: 'CWP-08-E-01',
    CWA: 'CWA-08',
    ESTADO_DE_APROBACION: 'E2',
    PESO_KG: 2150,
  },
  {
    TAG: '06940-ELE-005',
    DESCRIPCIÓN: 'GRUPO ELECTRÓGENO DIÉSEL 800 KVA EMERGENCIA',
    FACILITIES: 'Patio de Generación',
    COMMODITY: 'ELE-GEN',
    ESPECIALIDAD: 'ELECTRICIDAD',
    COSTO_US: 142000,
    CWP: 'CWP-08-E-03',
    CWA: 'CWA-08',
    ESTADO_DE_APROBACION: 'E4',
    PESO_KG: 6800,
  },
  {
    TAG: '06940-ELE-006',
    DESCRIPCIÓN: 'UPS 60 KVA REDUNDANTE',
    FACILITIES: 'Sala de Control',
    COMMODITY: 'ELE-UPS',
    ESPECIALIDAD: 'ELECTRICIDAD',
    COSTO_US: 31500,
    CWP: 'CWP-08-E-02',
    CWA: 'CWA-08',
    ESTADO_DE_APROBACION: 'E3',
    PESO_KG: 720,
  },
]

export const mockDatasets = {
  ele_mock: {
    headers: eleHeaders,
    rows: eleRows,
    count: eleRows.length,
  },
}
