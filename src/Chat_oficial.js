require('dotenv').config()
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")
const fs = require("fs")
const path = require("path")

// Función segura para cargar JSON
function cargarJSON(ruta, valorPorDefecto) {
    if (!fs.existsSync(ruta)) {
        fs.writeFileSync(ruta, JSON.stringify(valorPorDefecto, null, 2))
        return valorPorDefecto
    }
    try {
        const contenido = fs.readFileSync(ruta, "utf8").trim()
        if (!contenido) {
            fs.writeFileSync(ruta, JSON.stringify(valorPorDefecto, null, 2))
            return valorPorDefecto
        }
        return JSON.parse(contenido)
    } catch (err) {
        console.error("⚠️ Error al leer JSON:", ruta, err.message)
        return valorPorDefecto
    }
}

// Rutas
const respuestasPath = path.join(__dirname, "../chat_memory.json")
const historialPath = path.join(__dirname, "../mensajes.json")

// Cargar archivos
let respuestas = cargarJSON(respuestasPath, {})
let historial = cargarJSON(historialPath, {})  // objeto { numero: [mensajes] }

// Mensajes ya respondidos
const respondedMessages = new Set()

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')
    const sock = makeWASocket({ auth: state })

    // Guardar credenciales cuando se actualizan
    sock.ev.on('creds.update', saveCreds)

    // Manejar QR y conexión
    sock.ev.on('connection.update', (update) => {
        const { connection, lastDisconnect, qr } = update

        if (qr) {
            console.log('📌 Escanea este QR con WhatsApp:')
            qrcode.generate(qr, { small: true })
        }

        if (connection === 'close') {
            const reason = lastDisconnect?.error?.output?.statusCode
            console.log('❌ Conexión cerrada, motivo:', reason)
            if (reason !== DisconnectReason.loggedOut) {
                console.log('🔄 Reintentando conexión...')
                startBot()
            } else {
                console.log('⚠️ Se cerró sesión, borra auth_info y vuelve a escanear QR')
            }
        }

        if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp!')
        }
    })

    // Responder mensajes y depuración
sock.ev.on('messages.upsert', async function(event) {
    const msg = event.messages[0]
    const from = msg.key.remoteJid
    const messageId = msg.key.id


    if (!msg.message || msg.key.fromMe || event.type !== 'notify' || from.includes("@g.us") || from.includes("@broadcast")) {
        return
    }



    const pushName = msg.pushName || "Sin nombre"

    if (respondedMessages.has(messageId)) return
    respondedMessages.add(messageId)

    // Extraer texto seguro
    let texto = ""
    if (msg.message.conversation) {
        texto = msg.message.conversation
    } else if (msg.message.extendedTextMessage?.text) {
        texto = msg.message.extendedTextMessage.text
    }
    texto = texto.trim()

    // 📌 Guardar en historial agrupado por número
    if (!historial[from]) {
        historial[from] = []
    }
    const nuevoMensaje = {
        mensaje: texto,
        fecha: new Date().toISOString()
    }
    historial[from].push(nuevoMensaje)
    fs.writeFileSync(historialPath, JSON.stringify(historial, null, 2))

    // ✅ Mostrar en consola bonito
    console.log({
        messageTimestamp: msg.messageTimestamp,
        pushName: pushName,
        broadcast: false,
        message: {
            conversation: texto
        },
        messageContextInfo: {
            deviceListMetadata: "[DeviceListMetadata]",
            deviceListMetadataVersion: 2
        },
        messageSecret: "[Uint8Array]"
    })

    // Buscar coincidencia parcial en las claves de chat_memory
    let reply = "👋 ¡Hola! Soy Jenny, tu asistente virtual. ¿Cómo puedo ayudarte hoy?"
    for (const key in respuestas) {
        if (key && texto.toLowerCase().includes(key)) {
            reply = respuestas[key]
            break
        }
    }

    // Enviar mensaje
    await sock.sendMessage(from, { text: reply })

    console.log({
        enviadoA: from,
        pushName: pushName,
        respuesta: reply,
        fecha: new Date().toISOString()
    })
})


}

startBot()
