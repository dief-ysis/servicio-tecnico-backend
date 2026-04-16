/**
 * Servicio de notificaciones via webhook.
 *
 * Conecta con cualquier automatizador (Make.com, Zapier, n8n, etc.) que
 * a su vez puede enviar WhatsApp Business, SMS, email, etc.
 *
 * Configurar en .env:
 *   NOTIFICACION_WEBHOOK_URL=https://hook.make.com/xxxxx
 *
 * El webhook recibe un POST con:
 *   { evento, equipo_id, numero_ingreso, tipo_equipo, marca, modelo,
 *     cliente_nombre, cliente_telefono, estado, fecha }
 */
const axios = require('axios')

const WEBHOOK_URL = process.env.NOTIFICACION_WEBHOOK_URL

/**
 * Notifica al webhook cuando un equipo cambia a estado 'reparado'.
 * Falla silenciosamente si el webhook no está configurado o da error.
 */
const notificarReparado = async (equipo) => {
  if (!WEBHOOK_URL) return

  try {
    await axios.post(WEBHOOK_URL, {
      evento:           'equipo_reparado',
      equipo_id:        equipo.id,
      numero_ingreso:   equipo.numero_ingreso,
      tipo_equipo:      equipo.tipo_equipo,
      marca:            equipo.marca,
      modelo:           equipo.modelo,
      cliente_nombre:   equipo.cliente_nombre,
      cliente_telefono: equipo.cliente_telefono,
      costo_reparacion: equipo.costo_reparacion,
      estado:           'reparado',
      fecha:            new Date().toISOString()
    }, { timeout: 5000 })
  } catch (err) {
    // No interrumpir el flujo principal si el webhook falla
    console.error('Webhook notificación falló:', err.message)
  }
}

/**
 * Notifica cuando un equipo no tiene reparación (irreparable).
 */
const notificarIrreparable = async (equipo) => {
  if (!WEBHOOK_URL) return

  try {
    await axios.post(WEBHOOK_URL, {
      evento:           'equipo_irreparable',
      equipo_id:        equipo.id,
      numero_ingreso:   equipo.numero_ingreso,
      tipo_equipo:      equipo.tipo_equipo,
      marca:            equipo.marca,
      modelo:           equipo.modelo,
      cliente_nombre:   equipo.cliente_nombre,
      cliente_telefono: equipo.cliente_telefono,
      estado:           'irreparable',
      fecha:            new Date().toISOString()
    }, { timeout: 5000 })
  } catch (err) {
    console.error('Webhook notificación falló:', err.message)
  }
}

module.exports = { notificarReparado, notificarIrreparable }
