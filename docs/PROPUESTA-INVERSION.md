# Propuesta de desarrollo y colaboración — Aura GIP para Sonqollay

> **De:** Ignacio · **Para:** Sonqollay (consultora)
> **Objeto:** desarrollo, mantenimiento y modelo de compensación del producto SaaS
> multi-tenant **Aura GIP**, que Sonqollay comercializará a proyectos mineros.
>
> **Reparto base del acuerdo:** yo desarrollo y mantengo el producto; **Sonqollay
> financia la infraestructura (Autodesk/APS + base de datos) y lo vende**. Mi
> compensación es **híbrida: un retainer mensual acotado + una regalía sobre las
> ventas**, para que el desembolso inicial de Sonqollay sea bajo y los incentivos
> queden alineados (yo gano cuando el producto se vende).
>
> ⚠️ **Cifras conservadoras y estimadas**, a ajustar entre las partes. Moneda: **CLP**
> (referencia 1 USD ≈ 950 CLP). Versión 0.2.

---

## 1. Resumen ejecutivo

Sonqollay tendrá un **producto SaaS propio** —no un servicio puntual— para vender a
proyectos mineros: gestión de información de ingeniería (planillas) + **AWP** +
vínculo con el **modelo BIM** (Navisworks), multi-cliente y multi-proyecto.

- **Lo que ya existe:** un MVP funcional con grilla editable, visor 3D, import/export
  y un **plugin de Navisworks propio ya operativo**, cargado con 16 planillas reales.
- **Lo que falta (lo que desarrollo):** convertirlo en SaaS vendible — login,
  aislamiento entre clientes (multi-tenant), AWP real y seguridad.
- **Lo que pone Sonqollay:** infraestructura (Autodesk/APS + base de datos) y la
  **venta** (marca, dominio minero, relación con clientes).
- **Mi compensación (conservadora):** retainer de **CLP 500.000/mes** durante el
  desarrollo (~5 meses) + **mantenimiento continuo** con un **piso de CLP 300.000/mes
  o 20% de regalía sobre las ventas, lo que sea mayor**.

En vez de pedir un pago único grande (poco realista), el modelo **reparte el riesgo**:
Sonqollay desembolsa poco al inicio y paga "en serio" recién cuando el SaaS factura.

---

## 2. El activo que recibe Sonqollay

Un producto terminado y mantenido, listo para facturar a varios clientes a la vez.

| Capacidad | Estado hoy |
|---|---|
| Grilla editable tipo Excel (filtros, orden, columnas, edición masiva, paquetes) | ✅ Funcional |
| Visor 3D BIM (Autodesk Platform Services) con selección cruzada grilla ↔ modelo | ✅ Funcional |
| Plugin Navisworks "Aura GIP" (escribe la planilla sobre el modelo por TAG) | ✅ Funcional, con instalador 1-clic y release automatizado |
| Import/Export CSV y Excel · PWA instalable | ✅ Funcional |
| 16 planillas reales de proyecto cargadas | ✅ Cargado |
| Login + multi-tenant (Supabase) | 🟡 En código, **a activar y completar** |
| AWP como entidad real (árbol CWA→IWP, % de avance) | 🔲 A desarrollar (núcleo del valor) |

> Buena parte del trabajo difícil (visor, plugin, base del producto) **ya está hecho**.
> La inversión de Sonqollay completa el camino a "vendible", no parte de cero.

---

## 3. Reparto de responsabilidades y costos

| | **Sonqollay** | **Yo (desarrollo)** |
|---|---|---|
| Infraestructura | ✅ Paga Autodesk/APS + base de datos + hosting | — |
| Desarrollo del producto | — | ✅ Construye y completa el SaaS |
| Mantenimiento / soporte técnico | — | ✅ Correcciones, mejoras, soporte |
| Comercialización / ventas | ✅ Vende, pone marca y dominio minero | Apoyo técnico en demos |
| Relación con el cliente | ✅ Dueña de la cuenta | — |
| Onboarding de cada proyecto | A coordinar | ✅ Carga/configuración (cobrable aparte, §4) |

---

## 4. Mi compensación (híbrida y conservadora)

Estructura **piso + upside**: un mínimo que me cubre el tiempo, y una regalía que crece
si el producto se vende. **No se suman**: en cada mes se paga *el mayor* entre el piso y
la regalía.

### 4.1 Fase de desarrollo (≈ 5 meses)

| Concepto | Monto | Detalle |
|---|---:|---|
| Retainer mensual de desarrollo | **CLP 500.000 / mes** | Rango razonable: CLP 400.000–600.000 |
| **Total fase de desarrollo (~5 meses)** | **≈ CLP 2.500.000** | ≈ USD 2.600. Pagable por hito/mes |

> Es **una fracción** de lo que costaría contratar este desarrollo a precio de mercado
> (un build así ronda los USD 15.000–25.000). El descuento se compensa con la regalía.

### 4.2 Post-lanzamiento (mantenimiento + regalía)

| Concepto | Monto | Detalle |
|---|---:|---|
| Piso de mantenimiento | **CLP 300.000 / mes** | Soporte, correcciones, actualizaciones, monitoreo |
| Regalía sobre ventas | **20% del ingreso neto recurrente** del SaaS | Neto = suscripciones cobradas − comisiones de pago |
| Regla de pago | **El mayor entre piso y regalía** | Cuando hay pocas ventas cobro el piso; cuando crecen, la regalía |
| Onboarding por proyecto (opcional) | **CLP 150.000–400.000** por proyecto | Si participo en cargar/configurar un cliente nuevo |

> **El precio de venta todavía no está definido.** Sonqollay aún no lo conversó con un
> cliente; por ahora es una apuesta. **Justamente por eso mi compensación es un % + un
> piso, y no un monto atado a un precio fijo:** el acuerdo se puede cerrar hoy y el 20%
> se ajusta solo a lo que finalmente se cobre. El piso me cubre mientras ese precio se
> define y mientras llegan los primeros clientes.

**Cuánto cobraría yo según el precio que Sonqollay termine fijando** (regalía 20% por
proyecto activo/mes; aplica el piso de CLP 300.000 cuando el 20% queda por debajo):

| Precio de venta /proyecto/mes | 1 proyecto | 2 proyectos | 3 proyectos |
|---|---:|---:|---:|
| CLP 1.000.000 (~USD 1.050) | CLP 300.000 ¹ | CLP 400.000 | CLP 600.000 |
| CLP 1.500.000 (~USD 1.580) | CLP 300.000 | CLP 600.000 | CLP 900.000 |
| CLP 2.500.000 (~USD 2.630) | CLP 500.000 | CLP 1.000.000 | CLP 1.500.000 |
| CLP 3.000.000 (~USD 3.160) | CLP 600.000 | CLP 1.200.000 | CLP 1.800.000 |

¹ Manda el piso: el 20% (CLP 200.000) queda por debajo del mínimo de CLP 300.000.

---

## 5. Costos de infraestructura (los financia Sonqollay)

Para que Sonqollay dimensione **su** desembolso recurrente. Estimado, a medir con uso real.

| Servicio | Costo estimado / mes | Nota |
|---|---:|---|
| Autodesk / APS (visor BIM) | CLP 30.000–150.000 | **Pago por uso** (traducción de modelos, almacenamiento). El más variable |
| Base de datos + hosting (Supabase Pro + Vercel) | ≈ CLP 45.000 | ≈ USD 45 |
| Dominio, correo, varios | ≈ CLP 15.000 | |
| **Total infraestructura** | **≈ CLP 90.000–210.000 / mes** | ≈ USD 95–220. Escala con la cantidad de proyectos/modelos |

---

## 6. Plan de ejecución (roadmap resumido)

Basado en [PLAN-PRODUCTIZACION-MINERIA.md](./PLAN-PRODUCTIZACION-MINERIA.md). Cada fase
es un hito verificable y se asocia a un mes de retainer.

| Fase | Duración | Entrega |
|---|---|---|
| **Sprint 0 — Seguridad** | ~1 sem | Sacar datos sensibles del repo, cerrar endpoints, definir entorno productivo |
| **Fase 1 — SaaS real** | ~4–6 sem | Login + roles, multi-tenant, una sola fuente de datos (DB), auditoría |
| **Fase 2 — Valor AWP** | ~4–6 sem | AWP como entidad real (árbol CWA→IWP), dominio minero configurable |
| **Fase 3 — Escala** (opcional) | ~4–6 sem | Dashboards/curvas S, idiomas (ES/EN/PT), integraciones enterprise |

Al cierre de **Fase 2** el producto ya es vendible y empieza a aplicar la regalía.

---

## 7. Qué gana Sonqollay (ROI)

Como el precio aún está por definir, muestro el retorno con **2 proyectos activos** a dos
precios posibles. En ambos casos Sonqollay se queda con **~75–80% del ingreso** (el costo
marginal por proyecto es muy bajo).

| Con 2 proyectos activos | a CLP 1.500.000 c/u | a CLP 2.500.000 c/u |
|---|---:|---:|
| Ingreso mensual | CLP 3.000.000 | CLP 5.000.000 |
| − Regalía a Ignacio (20%) | − CLP 600.000 | − CLP 1.000.000 |
| − Infraestructura | − CLP 150.000 | − CLP 150.000 |
| **Margen para Sonqollay** | **≈ CLP 2.250.000 (75%)** | **≈ CLP 3.850.000 (77%)** |

Con apenas 2 proyectos, Sonqollay **recupera lo invertido en el desarrollo (~CLP 2,5 M)
en ~1 mes** de operación, y el producto sigue generando margen recurrente: cada proyecto
nuevo es casi todo margen.

---

## 8. Términos a acordar (importante)

Para que el acuerdo sea claro y me proteja la regalía:

- **Propiedad del código (IP):** definir si conservo la titularidad y **licencio** el
  producto a Sonqollay mientras dure el acuerdo, o si hay cesión con la **regalía
  garantizada por contrato**. (Recomiendo licencia o co-titularidad: la regalía no
  debería depender de la buena voluntad.)
- **Duración de la regalía:** mientras Sonqollay comercialice el producto (atada al
  mantenimiento que presto). Definir qué pasa si dejan de venderlo.
- **Exclusividad:** ¿Sonqollay exclusivo en minería? ¿Puedo licenciar el producto a
  otros rubros (construcción, energía) por mi cuenta?
- **Salida / continuidad:** si me retiro, traspaso documentado; si Sonqollay discontinúa,
  reversión de derechos. Plazo de preaviso de ambas partes.
- **Pago de la regalía:** mensual, **contra cobranza efectiva** (sobre lo realmente
  cobrado, no lo facturado).
- **Onboarding e infra:** confirmar que Autodesk/APS y la base de datos van **siempre**
  por cuenta de Sonqollay, incluso al crecer el uso.

---

## 9. Próximos pasos

1. **Validar los montos** (retainer, piso, % de regalía). El **precio de venta por
   proyecto se define más adelante** (hoy es una apuesta, aún sin conversar con cliente):
   por eso el acuerdo se ancla a un % + piso y no necesita el precio para cerrarse.
2. **Acordar los términos del §8** (sobre todo IP y duración de la regalía) por escrito.
3. **Arrancar Sprint 0** (quita el riesgo legal y deja el MVP presentable).
4. Definir el **primer proyecto piloto** dentro de Sonqollay para anclar la primera venta.

---

> *Documento de trabajo con cifras estimadas y conservadoras. No es un contrato; busca
> alinear el acuerdo antes de formalizarlo. Ajustar con los datos reales de Sonqollay.*
