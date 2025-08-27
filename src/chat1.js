/* Primer Asistente con Errores

const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, proto } = require("@whiskeysockets/baileys")
const qrcode = require("qrcode-terminal")

// Mensajes ya respondidos
const respondedMessages = new Set()

async function startBot() {
    const { state, saveCreds } = await useMultiFileAuthState('auth_info')

    const sock = makeWASocket({
        auth: state
    })

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
                console.log('⚠️ Se cerró sesión en WhatsApp, borra auth_info y vuelve a escanear QR')
            }
        }

        if (connection === 'open') {
            console.log('✅ Conectado a WhatsApp!')
        }
    })

    // Responder solo **mensajes nuevos**
    sock.ev.on('messages.upsert', async (m) => {
        const msg = m.messages[0]

        // Solo procesar mensajes nuevos
        if (!msg.message || msg.key.fromMe || m.type !== 'notify') return

        const from = msg.key.remoteJid
        const messageId = msg.key.id

        // Evitar responder varias veces al mismo mensaje
        if (respondedMessages.has(messageId)) return
        respondedMessages.add(messageId)

        const texto = msg.message.conversation || msg.message.extendedTextMessage?.text || ""
        const response = `Hola, ¿cómo estás? Mi nombre es Jenny y seré tu asistente virtual 👋`

        await sock.sendMessage(from, { text: response })
    })
}

startBot()

*/